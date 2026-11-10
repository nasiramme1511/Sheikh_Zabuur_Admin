import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
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

export interface PresignedUploadOptions {
  filename: string;
  contentType: string;
  moduleId: string;
  categoryId: string;
  fileSize: number;
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
 * Generates an S3/Cloudflare R2 presigned PUT URL for direct client-to-cloud upload.
 * Large audio files (30MB-100MB+) bypass Next.js API servers entirely.
 */
export async function createPresignedUploadUrl(
  options: PresignedUploadOptions
): Promise<PresignedUploadResult> {
  const env = getServerEnv();
  const client = getStorageClient();

  const sanitized = sanitizeStorageFilename(options.filename);
  const timestamp = Date.now();
  const storageKey = `audio/${options.moduleId}/${options.categoryId}/${timestamp}-${sanitized}`;

  const publicBase = env.STORAGE_PUBLIC_BASE_URL
    ? env.STORAGE_PUBLIC_BASE_URL.replace(/\/+$/, '')
    : 'https://cdn.sheikhzabur.com';

  const remoteUrl = `${publicBase}/${storageKey}`;

  // If storage credentials are not provided (e.g. dev mock), return simulated upload route
  if (!client || !env.STORAGE_BUCKET_NAME) {
    return {
      uploadUrl: `/api/admin/uploads/mock?key=${encodeURIComponent(storageKey)}`,
      storageKey,
      remoteUrl,
      isSimulated: true,
      expiresIn: 3600,
    };
  }

  const command = new PutObjectCommand({
    Bucket: env.STORAGE_BUCKET_NAME,
    Key: storageKey,
    ContentType: options.contentType,
    ContentLength: options.fileSize,
    Metadata: {
      'original-filename': encodeURIComponent(options.filename),
      'module-id': options.moduleId,
      'category-id': options.categoryId,
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
 * Inspects uploaded object headers in storage bucket (if configured)
 */
export async function verifyUploadedObject(storageKey: string): Promise<{ size: number; contentType?: string } | null> {
  const env = getServerEnv();
  const client = getStorageClient();

  if (!client || !env.STORAGE_BUCKET_NAME) {
    return null;
  }

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

