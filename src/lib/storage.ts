import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import fs from 'fs';
import path from 'path';
import { getServerEnv } from './env';

let s3ClientInstance: S3Client | null = null;

export function getStorageClient(): S3Client | null {
  const env = getServerEnv();

  if (!env.STORAGE_ACCESS_KEY_ID || !env.STORAGE_SECRET_ACCESS_KEY || !env.STORAGE_BUCKET_NAME) {
    return null;
  }

  if (!s3ClientInstance) {
    s3ClientInstance = new S3Client({
      region: 'auto',
      endpoint: env.STORAGE_ENDPOINT || undefined,
      credentials: {
        accessKeyId: env.STORAGE_ACCESS_KEY_ID,
        secretAccessKey: env.STORAGE_SECRET_ACCESS_KEY,
      },
      forcePathStyle: true,
    });
  }

  return s3ClientInstance;
}

export function isStorageConfigured(): boolean {
  const env = getServerEnv();
  return Boolean(
    env.STORAGE_BUCKET_NAME &&
    env.STORAGE_ACCESS_KEY_ID &&
    env.STORAGE_SECRET_ACCESS_KEY
  );
}

export type StorageAssetType = 'audio' | 'pdf' | 'branding';

export interface PresignedUploadOptions {
  assetType?: StorageAssetType;
  filename: string;
  contentType: string;
  fileSize: number;
  moduleId?: string;
  categoryId?: string;
  documentId?: string;
  volumeNumber?: number;
  brandingType?: string;
}

export interface PresignedUploadResult {
  uploadUrl: string;
  storageKey: string;
  remoteUrl: string;
  isSimulated: boolean;
  expiresIn: number;
}

export function sanitizeStorageFilename(rawName: string): string {
  return rawName
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '_')
    .replace(/_+/g, '_')
    .toLowerCase();
}

/**
 * Validates MIME types and size constraints before issuing presigned URLs.
 */
export function validateUploadFile(
  contentType: string,
  fileSize: number,
  assetType: StorageAssetType
): { valid: boolean; error?: string } {
  if (assetType === 'audio') {
    const validAudioTypes = [
      'audio/mpeg',
      'audio/mp3',
      'audio/mp4',
      'audio/x-m4a',
      'audio/m4a',
      'audio/aac',
      'audio/wav',
      'audio/x-wav',
      'audio/ogg',
    ];
    if (!validAudioTypes.includes(contentType.toLowerCase())) {
      return {
        valid: false,
        error: `Unsupported audio format "${contentType}". Supported: MP3, M4A, AAC, WAV, and OGG.`,
      };
    }
    const maxAudioBytes = 250 * 1024 * 1024; // 250 MB
    if (fileSize > maxAudioBytes) {
      return {
        valid: false,
        error: `Audio file exceeds maximum size limit of 250 MB.`,
      };
    }
  } else if (assetType === 'pdf') {
    const validPdfTypes = [
      'application/pdf',
      'application/x-pdf',
      'application/acrobat',
      'applications/vnd.pdf',
      'text/pdf',
      'application/octet-stream',
    ];
    if (!validPdfTypes.includes(contentType.toLowerCase())) {
      return {
        valid: false,
        error: `Unsupported document format "${contentType}". Only PDF documents are supported.`,
      };
    }
    const maxPdfBytes = 100 * 1024 * 1024; // 100 MB
    if (fileSize > maxPdfBytes) {
      return {
        valid: false,
        error: `PDF document exceeds maximum size limit of 100 MB.`,
      };
    }
  } else if (assetType === 'branding') {
    const validImageTypes = [
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/webp',
      'image/svg+xml',
    ];
    if (!validImageTypes.includes(contentType.toLowerCase())) {
      return {
        valid: false,
        error: `Unsupported image format "${contentType}". Supported: PNG, JPEG, WEBP, and SVG.`,
      };
    }
    const maxImageBytes = 15 * 1024 * 1024; // 15 MB
    if (fileSize > maxImageBytes) {
      return {
        valid: false,
        error: `Branding asset exceeds maximum size limit of 15 MB.`,
      };
    }
  }

  return { valid: true };
}

/**
 * Builds standard, deterministic object keys:
 * - audio: audio/{moduleId}/{categoryId}/{timestamp}-{filename}
 * - pdf:   pdf/{moduleId}/{documentId}/volume-{volumeNumber}.pdf
 * - branding: branding/{type}/{timestamp}-{filename}
 */
export function buildStorageKey(options: PresignedUploadOptions): string {
  const sanitized = sanitizeStorageFilename(options.filename);
  const timestamp = Date.now();
  const assetType = options.assetType || 'audio';

  if (assetType === 'pdf') {
    const mod = options.moduleId || 'general';
    const doc = options.documentId || `doc-${timestamp}`;
    const vol = options.volumeNumber || 1;
    return `pdf/${mod}/${doc}/volume-${vol}.pdf`;
  }

  if (assetType === 'branding') {
    const type = options.brandingType || 'general';
    return `branding/${type}/${timestamp}-${sanitized}`;
  }

  // Audio default
  const mod = options.moduleId || 'general';
  const cat = options.categoryId || 'default';
  return `audio/${mod}/${cat}/${timestamp}-${sanitized}`;
}

/**
 * Resolves a real, mobile-accessible public download URL for any storage object.
 * Replaces any simulated/mock admin routes with standard CDN or public download streaming.
 */
export function getPublicDownloadUrl(storageKey: string, filename?: string): string {
  const env = getServerEnv();

  if (env.STORAGE_PUBLIC_BASE_URL) {
    return `${env.STORAGE_PUBLIC_BASE_URL.replace(/\/+$/, '')}/${storageKey}`;
  }

  const appUrl = (env.APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
  const search = new URLSearchParams({ key: storageKey });
  if (filename) search.set('filename', filename);
  return `${appUrl}/api/v1/pdf/download?${search.toString()}`;
}

/**
 * Generates an S3/Cloudflare R2 presigned PUT URL for direct client-to-cloud upload.
 * Large media files bypass Next.js API servers entirely.
 */
export async function createPresignedUploadUrl(
  options: PresignedUploadOptions
): Promise<PresignedUploadResult> {
  const env = getServerEnv();
  const client = getStorageClient();
  const storageKey = buildStorageKey(options);

  // If storage credentials are not provided (e.g. dev mock), return simulated upload route
  // but ensure remoteUrl is a mobile-accessible public download URL
  if (!client || !env.STORAGE_BUCKET_NAME) {
    const realDownloadUrl = getPublicDownloadUrl(storageKey, options.filename);

    return {
      uploadUrl: `/api/admin/uploads/mock?key=${encodeURIComponent(storageKey)}`,
      storageKey,
      remoteUrl: realDownloadUrl,
      isSimulated: true,
      expiresIn: 3600,
    };
  }

  const publicBase = env.STORAGE_PUBLIC_BASE_URL
    ? env.STORAGE_PUBLIC_BASE_URL.replace(/\/+$/, '')
    : 'https://cdn.sheikhzabur.com';

  const remoteUrl = `${publicBase}/${storageKey}`;

  const command = new PutObjectCommand({
    Bucket: env.STORAGE_BUCKET_NAME,
    Key: storageKey,
    ContentType: options.contentType,
    ContentLength: options.fileSize,
    Metadata: {
      'original-filename': encodeURIComponent(options.filename),
      'asset-type': options.assetType || 'audio',
      'module-id': options.moduleId || '',
      'category-id': options.categoryId || '',
    },
  });

  const uploadUrl = await getSignedUrl(client, command, { expiresIn: 3600 });

  return {
    uploadUrl,
    storageKey,
    remoteUrl,
    isSimulated: false,
    expiresIn: 3600,
  };
}

/**
 * Inspects uploaded object headers in storage bucket or local storage directory
 */
export async function verifyUploadedObject(
  storageKey: string
): Promise<{ size: number; contentType?: string } | null> {
  const env = getServerEnv();
  const client = getStorageClient();

  if (client && env.STORAGE_BUCKET_NAME) {
    try {
      const head = await client.send(
        new HeadObjectCommand({
          Bucket: env.STORAGE_BUCKET_NAME,
          Key: storageKey,
        })
      );
      return {
        size: head.ContentLength || 0,
        contentType: head.ContentType,
      };
    } catch (err) {
      console.error(`[Storage] Failed to head object ${storageKey}:`, err);
      return null;
    }
  }

  // Local storage mode fallback check (.uploads directory)
  try {
    const safeKey = storageKey.replace(/[^a-zA-Z0-9_.-]/g, '_');
    const localPath = path.join(process.cwd(), '.uploads', safeKey);
    if (fs.existsSync(localPath)) {
      const stat = fs.statSync(localPath);
      return {
        size: stat.size,
        contentType: 'application/pdf',
      };
    }
  } catch (err) {
    console.error(`[Storage] Failed to verify local object ${storageKey}:`, err);
  }

  return null;
}

/**
 * Deletes an object from cloud storage bucket
 */
export async function deleteStorageObject(storageKey: string): Promise<boolean> {
  const env = getServerEnv();
  const client = getStorageClient();

  if (!client || !env.STORAGE_BUCKET_NAME) {
    // Delete local file if exists
    try {
      const safeKey = storageKey.replace(/[^a-zA-Z0-9_.-]/g, '_');
      const localPath = path.join(process.cwd(), '.uploads', safeKey);
      if (fs.existsSync(localPath)) {
        fs.unlinkSync(localPath);
      }
    } catch (err) {
      console.error(`[Storage] Failed to delete local object ${storageKey}:`, err);
    }
    return true;
  }

  try {
    await client.send(
      new DeleteObjectCommand({
        Bucket: env.STORAGE_BUCKET_NAME,
        Key: storageKey,
      })
    );
    return true;
  } catch (err) {
    console.error(`[Storage] Failed to delete object ${storageKey}:`, err);
    return false;
  }
}

/**
 * Generates a presigned GET URL for secure downloading/reading private files
 */
export async function createPresignedDownloadUrl(
  storageKey: string,
  expiresInSeconds = 3600
): Promise<string> {
  const env = getServerEnv();
  const client = getStorageClient();

  if (!client || !env.STORAGE_BUCKET_NAME) {
    return getPublicDownloadUrl(storageKey);
  }

  const command = new GetObjectCommand({
    Bucket: env.STORAGE_BUCKET_NAME,
    Key: storageKey,
  });

  return await getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}
