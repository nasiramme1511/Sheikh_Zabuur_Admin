import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/lib/auth';
import { recordAuditLog } from '@/lib/audit';
import { createMultipartUpload } from '@/lib/storage';
import {
  MAX_PDF_SIZE_BYTES,
  MIN_PDF_SIZE_BYTES,
  validatePdfUploadMetadata,
  sanitizePdfFilename,
} from '@/lib/pdf-upload-policy';
import { createUploadSessionToken } from '@/lib/upload-session';

export const dynamic = 'force-dynamic';

const initMultipartSchema = z.object({
  filename: z.string().min(1, 'Filename is required'),
  contentType: z.string().default('application/pdf'),
  fileSize: z
    .number()
    .int('File size must be an integer')
    .min(MIN_PDF_SIZE_BYTES, 'File cannot be empty')
    .max(MAX_PDF_SIZE_BYTES, 'PDF exceeds 500 MiB limit'),
  moduleId: z.string().optional().default('general'),
  documentId: z.string().optional().default(''),
  volumeNumber: z.coerce.number().int().min(1).default(1),
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

  const parseResult = initMultipartSchema.safeParse(body);
  if (!parseResult.success) {
    const errorDetails = parseResult.error.errors
      .map((e) => `${e.path.join('.')}: ${e.message}`)
      .join(', ');
    return NextResponse.json(
      { error: `Validation failed: ${errorDetails}`, details: parseResult.error.format() },
      { status: 400 }
    );
  }

  const { filename, contentType, fileSize, moduleId, documentId, volumeNumber } = parseResult.data;

  // Validate policy
  const validation = validatePdfUploadMetadata({ filename, contentType, fileSize });
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const sanitizedFilename = sanitizePdfFilename(filename);
  const effectiveModuleId = moduleId && moduleId.trim() ? moduleId.trim() : 'general';
  const effectiveDocumentId =
    documentId && documentId.trim() ? documentId.trim() : `doc-${Date.now()}`;

  try {
    const uploadInit = await createMultipartUpload({
      assetType: 'pdf',
      filename: sanitizedFilename,
      contentType: contentType || 'application/pdf',
      fileSize,
      moduleId: effectiveModuleId,
      documentId: effectiveDocumentId,
      volumeNumber,
    });

    // Create cryptographically signed upload session token
    const { token: uploadSessionToken, session } = createUploadSessionToken({
      uploadId: uploadInit.uploadId,
      storageKey: uploadInit.storageKey,
      adminUserId: user.id,
      documentId: effectiveDocumentId,
      moduleId: effectiveModuleId,
      volumeNumber,
      filename: sanitizedFilename,
      fileSize,
      partSize: uploadInit.partSize,
    });

    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    await recordAuditLog({
      adminUserId: user.id,
      action: 'PDF_MULTIPART_UPLOAD_INITIALIZED',
      entityType: 'PdfDocument',
      entityId: effectiveDocumentId,
      details: {
        uploadId: uploadInit.uploadId,
        storageKey: uploadInit.storageKey,
        fileSize,
        totalParts: uploadInit.totalParts,
        partSize: uploadInit.partSize,
        filename: sanitizedFilename,
      },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({
      success: true,
      uploadId: uploadInit.uploadId,
      uploadSessionToken,
      storageKey: uploadInit.storageKey,
      remoteUrl: uploadInit.remoteUrl,
      partSize: uploadInit.partSize,
      totalParts: uploadInit.totalParts,
      fileSize,
      expiresAt: session.expiresAt,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to initialize multipart upload in storage.';
    console.error('[PDF Multipart Init] Failed to initialize multipart upload:', err);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
