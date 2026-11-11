import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getStorageClient } from '@/lib/storage';
import { getServerEnv } from '@/lib/env';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

function getSafeFilePath(key: string): string | null {
  const safeKey = key.replace(/[^a-zA-Z0-9_.-]/g, '_');
  const uploadsPath = path.join(process.cwd(), '.uploads', safeKey);
  if (fs.existsSync(uploadsPath)) return uploadsPath;
  const publicPath = path.join(process.cwd(), 'public', key);
  if (fs.existsSync(publicPath)) return publicPath;
  return null;
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Range, Authorization',
    },
  });
}

export async function HEAD(req: NextRequest) {
  const res = await handleDownload(req, true);
  return res;
}

export async function GET(req: NextRequest) {
  return handleDownload(req, false);
}

async function handleDownload(req: NextRequest, isHeadOnly: boolean) {
  const { searchParams } = new URL(req.url);
  let storageKey = searchParams.get('key')?.trim() || '';
  const documentId = searchParams.get('documentId')?.trim();
  const volumeNumberStr = searchParams.get('volume');
  const customFilename = searchParams.get('filename')?.trim();

  // If documentId is provided, lookup volume from database
  if (!storageKey && documentId) {
    const volNum = volumeNumberStr ? parseInt(volumeNumberStr, 10) : 1;
    const doc = await prisma.pdfDocument.findFirst({
      where: {
        documentId,
        isPublished: true,
        archivedAt: null,
      },
      include: {
        volumes: {
          where: {
            volumeNumber: volNum,
            isPublished: true,
            archivedAt: null,
          },
        },
      },
    });

    const vol = doc?.volumes[0];
    if (vol?.storageKey) {
      storageKey = vol.storageKey;
    }
  }

  if (!storageKey) {
    return NextResponse.json({ error: 'Storage key or valid documentId is required' }, { status: 400 });
  }

  const filename = customFilename || storageKey.split('/').pop() || 'document.pdf';

  const env = getServerEnv();
  const client = getStorageClient();

  // 1. Cloudflare R2 / S3 Storage Mode
  if (client && env.STORAGE_BUCKET_NAME) {
    try {
      const rangeHeader = req.headers.get('range');
      const command = new GetObjectCommand({
        Bucket: env.STORAGE_BUCKET_NAME,
        Key: storageKey,
        Range: rangeHeader || undefined,
      });

      const response = await client.send(command);
      const headers = new Headers();
      headers.set('Content-Type', response.ContentType || 'application/pdf');
      headers.set('Access-Control-Allow-Origin', '*');
      headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      headers.set('Content-Disposition', `inline; filename="${filename}"`);
      headers.set('Accept-Ranges', 'bytes');
      headers.set('Cache-Control', 'public, max-age=86400, stale-while-revalidate=3600');

      if (response.ContentRange) {
        headers.set('Content-Range', response.ContentRange);
      }
      if (response.ContentLength) {
        headers.set('Content-Length', String(response.ContentLength));
      }

      if (isHeadOnly) {
        return new NextResponse(null, {
          status: response.ContentRange ? 206 : 200,
          headers,
        });
      }

      // Convert readable stream to web stream
      const stream = response.Body as unknown as ReadableStream;
      return new NextResponse(stream, {
        status: response.ContentRange ? 206 : 200,
        headers,
      });
    } catch (err) {
      console.error('[PDF Download] R2 fetch error for key:', storageKey, err);
      // Fallback to local check if R2 returns NoSuchKey
    }
  }

  // 2. Local / Public Static Disk Storage Mode
  const filePath = getSafeFilePath(storageKey);
  if (!filePath || !fs.existsSync(filePath)) {
    return NextResponse.json(
      { error: 'PDF file not found. Ensure the document has been uploaded and published.' },
      {
        status: 404,
        headers: { 'Access-Control-Allow-Origin': '*' },
      }
    );
  }

  try {
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.get('range');

    const headers = new Headers();
    headers.set('Content-Type', 'application/pdf');
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    headers.set('Content-Disposition', `inline; filename="${filename}"`);
    headers.set('Accept-Ranges', 'bytes');
    headers.set('Cache-Control', 'public, max-age=86400, stale-while-revalidate=3600');

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (start >= fileSize || end >= fileSize) {
        headers.set('Content-Range', `bytes */${fileSize}`);
        return new NextResponse(null, { status: 416, headers });
      }

      const chunkSize = end - start + 1;
      headers.set('Content-Range', `bytes ${start}-${end}/${fileSize}`);
      headers.set('Content-Length', String(chunkSize));

      if (isHeadOnly) {
        return new NextResponse(null, { status: 206, headers });
      }

      const fileStream = fs.createReadStream(filePath, { start, end });
      const stream = new ReadableStream({
        start(controller) {
          fileStream.on('data', (chunk) => controller.enqueue(chunk));
          fileStream.on('end', () => controller.close());
          fileStream.on('error', (err) => controller.error(err));
        },
      });

      return new NextResponse(stream, { status: 206, headers });
    }

    headers.set('Content-Length', String(fileSize));
    if (isHeadOnly) {
      return new NextResponse(null, { status: 200, headers });
    }

    const fileStream = fs.createReadStream(filePath);
    const stream = new ReadableStream({
      start(controller) {
        fileStream.on('data', (chunk) => controller.enqueue(chunk));
        fileStream.on('end', () => controller.close());
        fileStream.on('error', (err) => controller.error(err));
      },
    });

    return new NextResponse(stream, { status: 200, headers });
  } catch (err) {
    console.error('[PDF Download] Local streaming error:', err);
    return NextResponse.json({ error: 'Failed to stream PDF document' }, { status: 500 });
  }
}

