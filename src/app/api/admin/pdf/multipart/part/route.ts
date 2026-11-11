import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/lib/auth';
import { getMultipartUploadPartUrl } from '@/lib/storage';
import { verifyUploadSessionToken } from '@/lib/upload-session';
import { PRESIGNED_PART_EXPIRATION_SECONDS } from '@/lib/pdf-upload-policy';

export const dynamic = 'force-dynamic';

const partUrlSchema = z.object({
  uploadId: z.string().min(1, 'Upload ID is required'),
  uploadSessionToken: z.string().min(1, 'Upload session token is required'),
  partNumber: z.coerce.number().int().min(1, 'Part number must be at least 1'),
});

export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requirePermission('pdf:upload');
  } catch {
    return NextResponse.json(
      { error: 'Unauthorized or insufficient permissions (requires pdf:upload)' },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const parseResult = partUrlSchema.safeParse(body);
  if (!parseResult.success) {
    const errorDetails = parseResult.error.errors
      .map((e) => `${e.path.join('.')}: ${e.message}`)
      .join(', ');
    return NextResponse.json(
      { error: `Validation failed: ${errorDetails}`, details: parseResult.error.format() },
      { status: 400 }
    );
  }

  const { uploadId, uploadSessionToken, partNumber } = parseResult.data;

  // Validate session token and ownership
  const tokenValidation = verifyUploadSessionToken(uploadSessionToken, user);
  if (!tokenValidation.valid || !tokenValidation.session) {
    return NextResponse.json(
      { error: tokenValidation.error || 'Invalid or expired upload session token.' },
      { status: 403 }
    );
  }

  const session = tokenValidation.session;

  // Verify uploadId matches token
  if (session.uploadId !== uploadId) {
    return NextResponse.json(
      { error: 'Upload ID mismatch with authenticated session token.' },
      { status: 400 }
    );
  }

  // Validate partNumber against session totalParts
  if (partNumber > session.totalParts) {
    return NextResponse.json(
      {
        error: `Invalid part number ${partNumber}. Maximum parts for this file is ${session.totalParts}.`,
      },
      { status: 400 }
    );
  }

  try {
    const partDetails = await getMultipartUploadPartUrl({
      storageKey: session.storageKey,
      uploadId: session.uploadId,
      partNumber,
      expiresIn: PRESIGNED_PART_EXPIRATION_SECONDS,
    });

    return NextResponse.json({
      success: true,
      partNumber,
      uploadUrl: partDetails.uploadUrl,
      expiresIn: partDetails.expiresIn,
      isSimulated: partDetails.isSimulated,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : `Failed to generate upload URL for part ${partNumber}.`;
    console.error(`[PDF Multipart Part] Failed to generate URL for part ${partNumber}:`, err);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
