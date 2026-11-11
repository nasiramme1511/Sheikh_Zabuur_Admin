import crypto from 'crypto';
import { getServerEnv } from './env';
import { AuthenticatedUser } from './auth';
import {
  UPLOAD_SESSION_EXPIRATION_SECONDS,
  MULTIPART_PART_SIZE_BYTES,
  MAX_MULTIPART_PARTS,
} from './pdf-upload-policy';

export interface PdfUploadSessionData {
  uploadId: string;
  storageKey: string;
  adminUserId: string;
  documentId: string;
  moduleId: string;
  volumeNumber: number;
  filename: string;
  fileSize: number;
  partSize: number;
  totalParts: number;
  issuedAt: number;
  expiresAt: number;
}

function getHmacSecret(): string {
  const env = getServerEnv();
  return env.AUTH_SECRET || env.DATABASE_URL || 'sz-multipart-upload-signing-secret';
}

/**
 * Creates an HMAC-SHA256 signed tamper-proof session token for a multipart upload.
 */
export function createUploadSessionToken(params: {
  uploadId: string;
  storageKey: string;
  adminUserId: string;
  documentId: string;
  moduleId: string;
  volumeNumber: number;
  filename: string;
  fileSize: number;
  partSize?: number;
}): { token: string; session: PdfUploadSessionData } {
  const partSize = params.partSize || MULTIPART_PART_SIZE_BYTES;
  const totalParts = Math.ceil(params.fileSize / partSize);

  if (totalParts > MAX_MULTIPART_PARTS) {
    throw new Error(`Total parts (${totalParts}) exceeds maximum allowed (${MAX_MULTIPART_PARTS}).`);
  }

  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + UPLOAD_SESSION_EXPIRATION_SECONDS;

  const session: PdfUploadSessionData = {
    uploadId: params.uploadId,
    storageKey: params.storageKey,
    adminUserId: params.adminUserId,
    documentId: params.documentId,
    moduleId: params.moduleId,
    volumeNumber: params.volumeNumber,
    filename: params.filename,
    fileSize: params.fileSize,
    partSize,
    totalParts,
    issuedAt: now,
    expiresAt,
  };

  const payloadJson = JSON.stringify(session);
  const payloadB64 = Buffer.from(payloadJson, 'utf-8').toString('base64url');

  const signature = crypto
    .createHmac('sha256', getHmacSecret())
    .update(payloadB64)
    .digest('base64url');

  const token = `${payloadB64}.${signature}`;

  return { token, session };
}

/**
 * Validates a signed upload session token, asserts its expiration,
 * and verifies that the caller owns the upload.
 */
export function verifyUploadSessionToken(
  token: string,
  currentUser: AuthenticatedUser
): { valid: boolean; session?: PdfUploadSessionData; error?: string } {
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'Upload session token is required.' };
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    return { valid: false, error: 'Malformed upload session token.' };
  }

  const [payloadB64, signature] = parts;

  const expectedSignature = crypto
    .createHmac('sha256', getHmacSecret())
    .update(payloadB64)
    .digest('base64url');

  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return { valid: false, error: 'Invalid or tampered upload session token signature.' };
  }

  let session: PdfUploadSessionData;
  try {
    const payloadJson = Buffer.from(payloadB64, 'base64url').toString('utf-8');
    session = JSON.parse(payloadJson);
  } catch {
    return { valid: false, error: 'Failed to decode upload session token payload.' };
  }

  const now = Math.floor(Date.now() / 1000);
  if (session.expiresAt && now > session.expiresAt) {
    return { valid: false, error: 'Upload session has expired. Please initiate a new upload.' };
  }

  // Upload ownership check: user must be the initiator or a SUPER_ADMIN
  const isOwner = session.adminUserId === currentUser.id;
  const isSuperAdmin = currentUser.roleId === 'SUPER_ADMIN';

  if (!isOwner && !isSuperAdmin) {
    return {
      valid: false,
      error: 'Upload ownership violation: You do not have permission to modify this upload session.',
    };
  }

  return { valid: true, session };
}

