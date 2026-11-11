import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/lib/auth';
import { recordAuditLog } from '@/lib/audit';
import { abortMultipartUpload } from '@/lib/storage';
import { verifyUploadSessionToken } from '@/lib/upload-session';

export const dynamic = 'force-dynamic';

const abortMultipartSchema = z.object({
  uploadId: z.string().min(1, 'Upload ID is required'),
  uploadSessionToken: z.string().min(1, 'Upload session token is required'),
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

  const parseResult = abortMultipartSchema.safeParse(body);
  if (!parseResult.success) {
    const errorDetails = parseResult.error.errors
      .map((e) => `${e.path.join('.')}: ${e.message}`)
      .join(', ');
    return NextResponse.json(
      { error: `Validation failed: ${errorDetails}`, details: parseResult.error.format() },
      { status: 400 }
    );
  }

  const { uploadId, uploadSessionToken } = parseResult.data;

  // Validate session token and ownership
  const tokenValidation = verifyUploadSessionToken(uploadSessionToken, user);
  if (!tokenValidation.valid || !tokenValidation.session) {
    return NextResponse.json(
      { error: tokenValidation.error || 'Invalid or expired upload session token.' },
      { status: 403 }
    );
  }

  const session = tokenValidation.session;

  if (session.uploadId !== uploadId) {
    return NextResponse.json(
      { error: 'Upload ID mismatch with authenticated session token.' },
      { status: 400 }
    );
  }

  try {
    await abortMultipartUpload({
      storageKey: session.storageKey,
      uploadId: session.uploadId,
    });

    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    await recordAuditLog({
      adminUserId: user.id,
      action: 'PDF_MULTIPART_UPLOAD_ABORTED',
      entityType: 'PdfDocument',
      entityId: session.documentId,
      details: {
        uploadId: session.uploadId,
        storageKey: session.storageKey,
        totalParts: session.totalParts,
      },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({
      success: true,
      message: 'Multipart upload successfully aborted and cleaned up.',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to abort multipart upload.';
    console.error('[PDF Multipart Abort] Failed to abort multipart upload:', err);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
