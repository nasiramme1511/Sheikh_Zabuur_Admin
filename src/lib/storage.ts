import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getServerEnv } from './env';
import {
  MULTIPART_PART_SIZE_BYTES,
  PRESIGNED_PART_EXPIRATION_SECONDS,
  validatePdfUploadMetadata,
} from './pdf-upload-policy';

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

export interface MultipartUploadInitOptions {
  assetType?: StorageAssetType;
  filename: string;
  contentType: string;
  fileSize: number;
  moduleId?: string;
  categoryId?: string;
  documentId?: string;
  volumeNumber?: number;
}

export interface MultipartUploadInitResult {
  uploadId: string;
  storageKey: string;
  remoteUrl: string;
  partSize: number;
  totalParts: number;
  isSimulated: boolean;
}

export interface MultipartPartUrlOptions {
  storageKey: string;
  uploadId: string;
  partNumber: number;
  expiresIn?: number;
}

export interface MultipartPartUrlResult {
  uploadUrl: string;
  partNumber: number;
  expiresIn: number;
  isSimulated: boolean;
}

export interface MultipartCompletePart {
  partNumber: number;
  eTag: string;
}

export interface MultipartCompleteOptions {
  storageKey: string;
  uploadId: string;
  parts: MultipartCompletePart[];
}

export interface MultipartCompleteResult {
  storageKey: string;
  remoteUrl: string;
  location?: string;
  isSimulated: boolean;
}

export interface MultipartAbortOptions {
  storageKey: string;
  uploadId: string;
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
    return validatePdfUploadMetadata({
      filename: 'document.pdf',
      contentType,
      fileSize,
    });
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
export function buildStorageKey(options: PresignedUploadOptions | MultipartUploadInitOptions): string {
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
    const type = (options as PresignedUploadOptions).brandingType || 'general';
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
 * Initializes a multipart upload in Cloudflare R2 / S3.
 * Returns an uploadId and the server-controlled storage key.
 */
export async function createMultipartUpload(
  options: MultipartUploadInitOptions
): Promise<MultipartUploadInitResult> {
  const env = getServerEnv();
  const client = getStorageClient();
  const storageKey = buildStorageKey(options);
  const partSize = MULTIPART_PART_SIZE_BYTES;
  const totalParts = Math.max(1, Math.ceil(options.fileSize / partSize));

  if (!client || !env.STORAGE_BUCKET_NAME) {
    // Simulated local storage fallback
    const uploadId = `sim-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    const localDir = path.join(process.cwd(), '.uploads', `multipart_${uploadId}`);
    try {
      fs.mkdirSync(localDir, { recursive: true });
    } catch (err) {
      console.warn('[Storage Multipart] Could not create local simulated multipart directory:', err);
    }

    const realDownloadUrl = getPublicDownloadUrl(storageKey, options.filename);

    return {
      uploadId,
      storageKey,
      remoteUrl: realDownloadUrl,
      partSize,
      totalParts,
      isSimulated: true,
    };
  }

  const publicBase = env.STORAGE_PUBLIC_BASE_URL
    ? env.STORAGE_PUBLIC_BASE_URL.replace(/\/+$/, '')
    : 'https://cdn.sheikhzabur.com';

  const remoteUrl = `${publicBase}/${storageKey}`;

  const command = new CreateMultipartUploadCommand({
    Bucket: env.STORAGE_BUCKET_NAME,
    Key: storageKey,
    ContentType: options.contentType,
    Metadata: {
      'original-filename': encodeURIComponent(options.filename),
      'asset-type': options.assetType || 'pdf',
      'module-id': options.moduleId || '',
      'document-id': options.documentId || '',
      'volume-number': String(options.volumeNumber || 1),
    },
  });

  const res = await client.send(command);

  if (!res.UploadId) {
    throw new Error('Storage provider did not return an UploadId for multipart initialization.');
  }

  return {
    uploadId: res.UploadId,
    storageKey,
    remoteUrl,
    partSize,
    totalParts,
    isSimulated: false,
  };
}

/**
 * Generates a presigned URL for an individual upload part in Cloudflare R2 / S3.
 */
export async function getMultipartUploadPartUrl(
  options: MultipartPartUrlOptions
): Promise<MultipartPartUrlResult> {
  const env = getServerEnv();
  const client = getStorageClient();
  const expiresIn = options.expiresIn || PRESIGNED_PART_EXPIRATION_SECONDS;

  if (!client || !env.STORAGE_BUCKET_NAME) {
    // Simulated local storage fallback URL
    const search = new URLSearchParams({
      uploadId: options.uploadId,
      partNumber: String(options.partNumber),
    });
    return {
      uploadUrl: `/api/admin/uploads/mock-part?${search.toString()}`,
      partNumber: options.partNumber,
      expiresIn,
      isSimulated: true,
    };
  }

  const command = new UploadPartCommand({
    Bucket: env.STORAGE_BUCKET_NAME,
    Key: options.storageKey,
    UploadId: options.uploadId,
    PartNumber: options.partNumber,
  });

  const uploadUrl = await getSignedUrl(client, command, { expiresIn });

  return {
    uploadUrl,
    partNumber: options.partNumber,
    expiresIn,
    isSimulated: false,
  };
}

/**
 * Completes a multipart upload in Cloudflare R2 / S3 after all parts are uploaded.
 * Parts are validated and sorted by PartNumber in ascending order as strictly required by S3.
 */
export async function completeMultipartUpload(
  options: MultipartCompleteOptions
): Promise<MultipartCompleteResult> {
  const env = getServerEnv();
  const client = getStorageClient();

  if (!options.parts || options.parts.length === 0) {
    throw new Error('Cannot complete multipart upload without parts.');
  }

  // S3 requires parts sorted strictly ascending by PartNumber
  const sortedParts = [...options.parts].sort((a, b) => a.partNumber - b.partNumber);

  // Normalize ETags (must be enclosed in double quotes for AWS SDK / S3 API)
  const formattedParts = sortedParts.map((p) => {
    let tag = p.eTag.trim();
    if (!tag.startsWith('"')) tag = `"${tag}`;
    if (!tag.endsWith('"')) tag = `${tag}"`;
    return {
      PartNumber: p.partNumber,
      ETag: tag,
    };
  });

  if (!client || !env.STORAGE_BUCKET_NAME) {
    // Simulated local storage fallback: merge parts into single destination file
    const safeKey = options.storageKey.replace(/[^a-zA-Z0-9_.-]/g, '_');
    const localDest = path.join(process.cwd(), '.uploads', safeKey);
    const localDir = path.join(process.cwd(), '.uploads', `multipart_${options.uploadId}`);

    try {
      fs.mkdirSync(path.dirname(localDest), { recursive: true });
      const buffers: Buffer[] = [];

      for (const p of sortedParts) {
        const partFile = path.join(localDir, `part_${p.partNumber}`);
        if (fs.existsSync(partFile)) {
          buffers.push(fs.readFileSync(partFile));
        }
      }

      fs.writeFileSync(localDest, Buffer.concat(buffers));

      // Clean up simulated part directory
      fs.rmSync(localDir, { recursive: true, force: true });
    } catch (err) {
      console.warn('[Storage Multipart] Failed to merge simulated local parts:', err);
    }

    const realDownloadUrl = getPublicDownloadUrl(options.storageKey);

    return {
      storageKey: options.storageKey,
      remoteUrl: realDownloadUrl,
      isSimulated: true,
    };
  }

  const publicBase = env.STORAGE_PUBLIC_BASE_URL
    ? env.STORAGE_PUBLIC_BASE_URL.replace(/\/+$/, '')
    : 'https://cdn.sheikhzabur.com';

  const remoteUrl = `${publicBase}/${options.storageKey}`;

  const command = new CompleteMultipartUploadCommand({
    Bucket: env.STORAGE_BUCKET_NAME,
    Key: options.storageKey,
    UploadId: options.uploadId,
    MultipartUpload: {
      Parts: formattedParts,
    },
  });

  const res = await client.send(command);

  return {
    storageKey: options.storageKey,
    remoteUrl,
    location: res.Location,
    isSimulated: false,
  };
}

/**
 * Aborts a multipart upload in Cloudflare R2 / S3 and deletes uploaded parts.
 */
export async function abortMultipartUpload(
  options: MultipartAbortOptions
): Promise<boolean> {
  const env = getServerEnv();
  const client = getStorageClient();

  if (!client || !env.STORAGE_BUCKET_NAME) {
    // Simulated local storage fallback: delete part directory
    try {
      const localDir = path.join(process.cwd(), '.uploads', `multipart_${options.uploadId}`);
      if (fs.existsSync(localDir)) {
        fs.rmSync(localDir, { recursive: true, force: true });
      }
      return true;
    } catch (err) {
      console.warn('[Storage Multipart] Failed to cleanup simulated local parts:', err);
      return false;
    }
  }

  try {
    const command = new AbortMultipartUploadCommand({
      Bucket: env.STORAGE_BUCKET_NAME,
      Key: options.storageKey,
      UploadId: options.uploadId,
    });
    await client.send(command);
    return true;
  } catch (err) {
    console.error(`[Storage Multipart] Failed to abort multipart upload ${options.uploadId}:`, err);
    return false;
  }
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

  // Local storage mode fallback check (.uploads directory or public directory)
  try {
    const safeKey = storageKey.replace(/[^a-zA-Z0-9_.-]/g, '_');
    const localUploadsPath = path.join(process.cwd(), '.uploads', safeKey);
    if (fs.existsSync(localUploadsPath)) {
      const stat = fs.statSync(localUploadsPath);
      return {
        size: stat.size,
        contentType: 'application/pdf',
      };
    }

    const localPublicPath = path.join(process.cwd(), 'public', storageKey);
    if (fs.existsSync(localPublicPath)) {
      const stat = fs.statSync(localPublicPath);
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
