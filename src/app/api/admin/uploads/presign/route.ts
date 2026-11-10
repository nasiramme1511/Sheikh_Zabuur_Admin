import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth';
import { createPresignedUploadUrl } from '@/lib/storage';

export const dynamic = 'force-dynamic';

const ALLOWED_AUDIO_TYPES = [
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/m4a',
  'audio/x-m4a',
  'audio/aac',
  'audio/ogg',
  'audio/wav',
];

const presignSchema = z.object({
  filename: z.string().min(1, 'Filename is required'),
  contentType: z.string().refine(
    (ct) => ALLOWED_AUDIO_TYPES.includes(ct.toLowerCase()),
    'Invalid audio MIME type. Supported: MP3, M4A, AAC, WAV, OGG'
  ),
  fileSize: z
    .number()
    .int()
    .positive('File size must be positive')
    .max(250 * 1024 * 1024, 'Max file size is 250 MB'),
  moduleId: z.string().min(1, 'Module ID is required'),
  categoryId: z.string().min(1, 'Category ID is required'),
});

export async function POST(req: NextRequest) {
  try {
    await requirePermission('tracks:upload');
  } catch {
    return NextResponse.json(
      { error: 'Unauthorized or insufficient permissions (requires tracks:upload)' },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const parseResult = presignSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parseResult.error.format() },
      { status: 400 }
    );
  }

  const { filename, contentType, fileSize, moduleId, categoryId } = parseResult.data;

  // Validate module and category exist
  const category = await prisma.audioCategory.findFirst({
    where: {
      id: categoryId,
      moduleId,
    },
    include: {
      module: true,
    },
  });

  if (!category) {
    return NextResponse.json(
      { error: `Category '${categoryId}' in module '${moduleId}' not found` },
      { status: 404 }
    );
  }

  try {
    const uploadDetails = await createPresignedUploadUrl({
      filename,
      contentType,
      moduleId,
      categoryId,
      fileSize,
    });

    return NextResponse.json({
      success: true,
      ...uploadDetails,
      category: {
        id: category.id,
        title: category.title,
        moduleTitle: category.module.title,
      },
    });
  } catch (err) {
    console.error('[Upload Presign] Failed to create presigned URL:', err);
    return NextResponse.json(
      { error: 'Failed to generate cloud upload URL' },
      { status: 500 }
    );
  }
}
