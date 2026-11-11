import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/lib/auth';
import { createPresignedUploadUrl, validateUploadFile } from '@/lib/storage';

export const dynamic = 'force-dynamic';

const presignBrandingSchema = z.object({
  filename: z.string().min(1, 'Filename is required'),
  contentType: z.string(),
  fileSize: z
    .number()
    .int()
    .positive('File size must be positive')
    .max(15 * 1024 * 1024, 'Max branding image size is 15 MB'),
  brandingType: z.enum([
    'logo',
    'emblem',
    'splash',
    'artwork',
    'android_icon',
    'ios_icon',
    'banner',
  ]),
});

export async function POST(req: NextRequest) {
  try {
    await requirePermission('branding:manage');
  } catch {
    return NextResponse.json(
      { error: 'Unauthorized or insufficient permissions (requires branding:manage)' },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const parseResult = presignBrandingSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parseResult.error.format() },
      { status: 400 }
    );
  }

  const { filename, contentType, fileSize, brandingType } = parseResult.data;

  const validation = validateUploadFile(contentType, fileSize, 'branding');
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  try {
    const uploadDetails = await createPresignedUploadUrl({
      assetType: 'branding',
      filename,
      contentType,
      fileSize,
      brandingType,
    });

    return NextResponse.json({
      success: true,
      ...uploadDetails,
    });
  } catch (err) {
    console.error('[Branding Presign] Failed to create presigned URL:', err);
    return NextResponse.json({ error: 'Failed to generate cloud upload URL' }, { status: 500 });
  }
}
