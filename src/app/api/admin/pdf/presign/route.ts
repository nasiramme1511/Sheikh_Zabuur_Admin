import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/lib/auth';
import { createPresignedUploadUrl, validateUploadFile } from '@/lib/storage';
import { MAX_PDF_SIZE_BYTES } from '@/lib/pdf-upload-policy';

export const dynamic = 'force-dynamic';

const presignPdfSchema = z.object({
  filename: z.string().min(1, 'Filename is required'),
  contentType: z.string().default('application/pdf'),
  fileSize: z
    .number()
    .int()
    .positive('File size must be positive')
    .max(MAX_PDF_SIZE_BYTES, `Max PDF size is 500 MiB`),
  moduleId: z.string().optional().default('general'),
  documentId: z.string().optional().default(''),
  volumeNumber: z.coerce.number().int().min(1).default(1),
});

export async function POST(req: NextRequest) {
  try {
    await requirePermission('pdf:upload');
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

  const parseResult = presignPdfSchema.safeParse(body);
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
  const effectiveModuleId = moduleId && moduleId.trim() ? moduleId.trim() : 'general';
  const effectiveDocumentId = documentId && documentId.trim() ? documentId.trim() : `doc-${Date.now()}`;

  // Validate format and size
  const validation = validateUploadFile(contentType, fileSize, 'pdf');
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  try {
    const uploadDetails = await createPresignedUploadUrl({
      assetType: 'pdf',
      filename,
      contentType,
      fileSize,
      moduleId: effectiveModuleId,
      documentId: effectiveDocumentId,
      volumeNumber,
    });

    return NextResponse.json({
      success: true,
      ...uploadDetails,
    });
  } catch (err) {
    console.error('[PDF Presign] Failed to generate cloud upload URL:', err);
    return NextResponse.json({ error: 'Failed to generate cloud upload URL' }, { status: 500 });
  }
}

