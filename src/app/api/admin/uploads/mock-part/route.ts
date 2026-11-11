import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const UPLOADS_DIR = path.join(process.cwd(), '.uploads');

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Content-Length',
      'Access-Control-Expose-Headers': 'ETag',
    },
  });
}

export async function PUT(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rawUploadId = searchParams.get('uploadId') || 'unknown';
  const rawPartNumber = searchParams.get('partNumber') || '1';

  const safeUploadId = rawUploadId.replace(/[^a-zA-Z0-9_.-]/g, '_');
  const partNumber = parseInt(rawPartNumber, 10) || 1;

  const multipartDir = path.join(UPLOADS_DIR, `multipart_${safeUploadId}`);

  try {
    if (!fs.existsSync(multipartDir)) {
      fs.mkdirSync(multipartDir, { recursive: true });
    }

    const partPath = path.join(multipartDir, `part_${partNumber}`);
    const arrayBuffer = await req.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    await fs.promises.writeFile(partPath, buffer);

    const md5Hash = crypto.createHash('md5').update(buffer).digest('hex');
    const eTag = `"${md5Hash}"`;

    const headers = new Headers();
    headers.set('ETag', eTag);
    headers.set('Access-Control-Expose-Headers', 'ETag');
    headers.set('Access-Control-Allow-Origin', '*');

    return new NextResponse(
      JSON.stringify({
        success: true,
        partNumber,
        size: buffer.length,
        eTag,
      }),
      {
        status: 200,
        headers,
      }
    );
  } catch (err: unknown) {
    console.error(`[Mock Part Upload] Failed to write part ${partNumber}:`, err);
    return NextResponse.json(
      { error: 'Failed to write simulated part file' },
      { status: 500 }
    );
  }
}
