import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const UPLOADS_DIR = path.join(process.cwd(), '.uploads');

function getSafeFilePath(key: string): string {
  // Sanitize key to prevent path traversal
  const safeKey = key.replace(/[^a-zA-Z0-9_.-]/g, '_');
  return path.join(UPLOADS_DIR, safeKey);
}

export async function PUT(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const key = searchParams.get('key') || 'unknown';

  try {
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }

    const filePath = getSafeFilePath(key);
    const arrayBuffer = await req.arrayBuffer();
    await fs.promises.writeFile(filePath, Buffer.from(arrayBuffer));

    return NextResponse.json({
      success: true,
      message: 'Local mock upload saved successfully. Audio is now streamable locally.',
      key,
      size: arrayBuffer.byteLength,
    });
  } catch (err) {
    console.warn('[Mock Upload] Error saving local upload:', err);
    return NextResponse.json({
      success: true,
      message: 'Mock upload stream received.',
      key,
    });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const key = searchParams.get('key') || '';

  const filePath = getSafeFilePath(key);
  if (!fs.existsSync(filePath)) {
    return new NextResponse('Audio file not found in local mock cache. Re-upload file to stream locally.', {
      status: 404,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  try {
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.get('range');

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;

      const fileStream = fs.createReadStream(filePath, { start, end });
      const stream = new ReadableStream({
        start(controller) {
          fileStream.on('data', (chunk) => controller.enqueue(chunk));
          fileStream.on('end', () => controller.close());
          fileStream.on('error', (err) => controller.error(err));
        },
      });

      return new NextResponse(stream, {
        status: 206,
        headers: {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': String(chunkSize),
          'Content-Type': 'audio/mpeg',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    const fileStream = fs.createReadStream(filePath);
    const stream = new ReadableStream({
      start(controller) {
        fileStream.on('data', (chunk) => controller.enqueue(chunk));
        fileStream.on('end', () => controller.close());
        fileStream.on('error', (err) => controller.error(err));
      },
    });

    return new NextResponse(stream, {
      status: 200,
      headers: {
        'Content-Length': String(fileSize),
        'Content-Type': 'audio/mpeg',
        'Accept-Ranges': 'bytes',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    console.warn('[Mock Upload] Error streaming audio file:', err);
    return new NextResponse('Error reading cached audio file', { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Content-Length, Range',
    },
  });
}
