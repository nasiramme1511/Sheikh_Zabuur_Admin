import fs from 'fs/promises';
import path from 'path';
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getStorageClient, isStorageConfigured } from './storage';
import { getServerEnv } from './env';
import { CompilationResult } from './catalog-compiler';

export interface PublishResult {
  version: string;
  checksumMd5: string;
  checksumSha256: string;
  catalogUrl: string;
  versionUrl: string;
  isSimulated: boolean;
  publishedAt: string;
}

/**
 * Publishes compiled catalog artifacts atomically to Cloudflare R2 / S3,
 * and maintains historical version archives for instant rollback.
 */
export async function publishCatalogArtifacts(
  compilation: CompilationResult
): Promise<PublishResult> {
  const env = getServerEnv();
  const client = getStorageClient();
  const isConfigured = isStorageConfigured();
  const version = compilation.versionManifest.version;
  const publishedAt = compilation.versionManifest.updatedAt;

  const publicBase = env.STORAGE_PUBLIC_BASE_URL
    ? env.STORAGE_PUBLIC_BASE_URL.replace(/\/+$/, '')
    : 'https://cdn.sheikhzabur.com';

  const catalogKey = 'catalog/catalog.json';
  const versionKey = 'catalog/catalogVersion.json';
  const historyCatalogKey = `catalog/history/catalog-${version}.json`;
  const historyVersionKey = `catalog/history/catalogVersion-${version}.json`;

  // Always write local public copy for local development & fallback serving
  const localCatalogDir = path.join(process.cwd(), 'public', 'catalog');
  const localHistoryDir = path.join(process.cwd(), 'public', 'catalog', 'history');

  try {
    await fs.mkdir(localHistoryDir, { recursive: true });
    await fs.writeFile(path.join(localCatalogDir, 'catalog.json'), compilation.catalogJson, 'utf-8');
    await fs.writeFile(path.join(localCatalogDir, 'catalogVersion.json'), compilation.versionManifestJson, 'utf-8');
    await fs.writeFile(path.join(localHistoryDir, `catalog-${version}.json`), compilation.catalogJson, 'utf-8');
    await fs.writeFile(path.join(localHistoryDir, `catalogVersion-${version}.json`), compilation.versionManifestJson, 'utf-8');
  } catch (err) {
    console.warn('[CatalogPublisher] Failed to write local public files:', err);
  }

  // If cloud storage is configured, upload atomically to R2
  if (isConfigured && client && env.STORAGE_BUCKET_NAME) {
    const bucket = env.STORAGE_BUCKET_NAME;

    // 1. Upload immutable historical archive copies first
    await Promise.all([
      client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: historyCatalogKey,
          Body: compilation.catalogJson,
          ContentType: 'application/json; charset=utf-8',
          CacheControl: 'public, max-age=31536000, immutable',
        })
      ),
      client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: historyVersionKey,
          Body: compilation.versionManifestJson,
          ContentType: 'application/json; charset=utf-8',
          CacheControl: 'public, max-age=31536000, immutable',
        })
      ),
    ]);

    // 2. Upload main catalog.json (1 day cache)
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: catalogKey,
        Body: compilation.catalogJson,
        ContentType: 'application/json; charset=utf-8',
        CacheControl: 'public, max-age=86400, stale-while-revalidate=3600',
      })
    );

    // 3. Atomically upload catalogVersion.json last (no-cache)
    // Mobile devices poll this file to detect catalog upgrades
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: versionKey,
        Body: compilation.versionManifestJson,
        ContentType: 'application/json; charset=utf-8',
        CacheControl: 'no-cache, must-revalidate',
      })
    );
  }

  return {
    version,
    checksumMd5: compilation.checksumMd5,
    checksumSha256: compilation.checksumSha256,
    catalogUrl: `${publicBase}/${catalogKey}`,
    versionUrl: `${publicBase}/${versionKey}`,
    isSimulated: !isConfigured,
    publishedAt,
  };
}

/**
 * Rolls back the active catalog in Cloudflare R2 / S3 to a historical version.
 */
export async function rollbackCatalogArtifacts(targetVersion: string): Promise<boolean> {
  const env = getServerEnv();
  const client = getStorageClient();
  const isConfigured = isStorageConfigured();

  const historyCatalogKey = `catalog/history/catalog-${targetVersion}.json`;
  const historyVersionKey = `catalog/history/catalogVersion-${targetVersion}.json`;
  const catalogKey = 'catalog/catalog.json';
  const versionKey = 'catalog/catalogVersion.json';

  // Local fallback rollback
  const localHistoryDir = path.join(process.cwd(), 'public', 'catalog', 'history');
  const localCatalogDir = path.join(process.cwd(), 'public', 'catalog');

  try {
    const histCatalog = await fs.readFile(path.join(localHistoryDir, `catalog-${targetVersion}.json`), 'utf-8');
    const histVersion = await fs.readFile(path.join(localHistoryDir, `catalogVersion-${targetVersion}.json`), 'utf-8');

    await fs.writeFile(path.join(localCatalogDir, 'catalog.json'), histCatalog, 'utf-8');
    await fs.writeFile(path.join(localCatalogDir, 'catalogVersion.json'), histVersion, 'utf-8');
  } catch (err) {
    console.warn(`[CatalogPublisher] Local historical files not found for ${targetVersion}:`, err);
  }

  // Cloud rollback
  if (isConfigured && client && env.STORAGE_BUCKET_NAME) {
    const bucket = env.STORAGE_BUCKET_NAME;

    // Retrieve historical files
    const [catalogObj, versionObj] = await Promise.all([
      client.send(new GetObjectCommand({ Bucket: bucket, Key: historyCatalogKey })),
      client.send(new GetObjectCommand({ Bucket: bucket, Key: historyVersionKey })),
    ]);

    const catalogBody = await catalogObj.Body?.transformToString();
    const versionBody = await versionObj.Body?.transformToString();

    if (!catalogBody || !versionBody) {
      throw new Error(`Historical release ${targetVersion} not found in cloud storage.`);
    }

    // Re-deploy as active
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: catalogKey,
        Body: catalogBody,
        ContentType: 'application/json; charset=utf-8',
        CacheControl: 'public, max-age=86400, stale-while-revalidate=3600',
      })
    );

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: versionKey,
        Body: versionBody,
        ContentType: 'application/json; charset=utf-8',
        CacheControl: 'no-cache, must-revalidate',
      })
    );
  }

  return true;
}
