import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/lib/auth';
import { recordAuditLog } from '@/lib/audit';
import { completeMultipartUpload, verifyUploadedObject } from '@/lib/storage';
import { verifyUploadSessionToken } from '@/lib/upload-session';
import { MAX_PDF_SIZE_BYTES } from '@/lib/pdf-upload-policy';

export const dynamic = 'force-dynamic';

const partItemSchema = z.object({
  partNumber: z.number().int().min(1),
  eTag: z.string().min(1, 'ETag is required'),
});

const completeMultipartSchema = z.object({
  uploadId: z.string().min(1, 'Upload ID is required'),
  uploadSessionToken: z.string().min(1, 'Upload session token is required'),
  parts: z.array(partItemSchema).min(1, 'At least one part is required'),
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

  const parseResult = completeMultipartSchema.safeParse(body);
  if (!parseResult.success) {
    const errorDetails = parseResult.error.errors
      .map((e) => `${e.path.join('.')}: ${e.message}`)
      .join(', ');
    return NextResponse.json(
      { error: `Validation failed: ${errorDetails}`, details: parseResult.error.format() },
      { status: 400 }
    );
  }

  const { uploadId, uploadSessionToken, parts } = parseResult.data;

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

  // Validate part count against session
  if (parts.length !== session.totalParts) {
    return NextResponse.json(
      {
        error: `Incomplete upload: Received ${parts.length} parts, but file requires exactly ${session.totalParts} parts.`,
      },
      { status: 400 }
    );
  }

  // Check for duplicate or missing parts
  const seenParts = new Set<number>();
  for (const p of parts) {
    if (seenParts.has(p.partNumber)) {
      return NextResponse.json(
        { error: `Duplicate part number detected: ${p.partNumber}.` },
        { status: 400 }
      );
    }
    seenParts.add(p.partNumber);

    if (p.partNumber < 1 || p.partNumber > session.totalParts) {
      return NextResponse.json(
        { error: `Part number ${p.partNumber} is out of expected range (1..${session.totalParts}).` },
        { status: 400 }
      );
    }
  }

  // Check that all parts from 1 to totalParts are present
  for (let i = 1; i <= session.totalParts; i++) {
    if (!seenParts.has(i)) {
      return NextResponse.json(
        { error: `Missing upload part: Part number ${i} was not provided.` },
        { status: 400 }
      );
    }
  }

  try {
    // Complete multipart upload in storage
    const completionResult = await completeMultipartUpload({
      storageKey: session.storageKey,
      uploadId: session.uploadId,
      parts,
    });

    // Verify actual object headers on R2 / storage
    const verified = await verifyUploadedObject(session.storageKey);
    if (!verified) {
      console.warn(`[PDF Multipart Complete] HeadObject check pending or delayed for key: ${session.storageKey}`);
    } else {
      if (verified.size > MAX_PDF_SIZE_BYTES) {
        return NextResponse.json(
          {
            error: `Uploaded object size (${verified.size} bytes) exceeds maximum limit of 500 MiB.`,
          },
          { status: 400 }
        );
      }
    }

    const finalSize = verified?.size || session.fileSize;

    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    await recordAuditLog({
      adminUserId: user.id,
      action: 'PDF_MULTIPART_UPLOAD_COMPLETED',
      entityType: 'PdfDocument',
      entityId: session.documentId,
      details: {
        uploadId: session.uploadId,
        storageKey: session.storageKey,
        fileSizeBytes: finalSize,
        totalParts: session.totalParts,
        isSimulated: completionResult.isSimulated,
      },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({
      success: true,
      storageKey: session.storageKey,
      remoteUrl: completionResult.remoteUrl,
      fileSizeBytes: finalSize,
      documentId: session.documentId,
      moduleId: session.moduleId,
      volumeNumber: session.volumeNumber,
      isSimulated: completionResult.isSimulated,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to complete multipart upload in cloud storage.';
    console.error('[PDF Multipart Complete] Failed to complete upload:', err);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
