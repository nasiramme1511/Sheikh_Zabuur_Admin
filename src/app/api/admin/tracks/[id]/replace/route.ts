import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth';
import { recordAuditLog } from '@/lib/audit';
import { serializeBigInt, formatBytes, formatDuration } from '@/lib/serialize';

export const dynamic = 'force-dynamic';

const replaceAudioSchema = z.object({
  storageKey: z.string().min(1, 'Storage key is required'),
  remoteUrl: z.string().url('Remote URL must be valid'),
  originalFilename: z.string().min(1, 'Original filename is required'),
  fileSize: z.number().int().positive('File size must be positive'),
  duration: z.number().int().positive('Duration must be positive'),
  sha256: z.string().optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  let user;
  try {
    user = await requirePermission('tracks:replace');
  } catch {
    return NextResponse.json({ error: 'Unauthorized or insufficient permissions' }, { status: 403 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const parseResult = replaceAudioSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parseResult.error.format() },
      { status: 400 }
    );
  }

  const existingTrack = await prisma.audioTrack.findUnique({
    where: { id },
  });

  if (!existingTrack) {
    return NextResponse.json({ error: 'Track not found' }, { status: 404 });
  }

  const data = parseResult.data;

  try {
    const updated = await prisma.$transaction(async (tx) => {
      // 1. Update the canonical track with new file metadata
      const track = await tx.audioTrack.update({
        where: { id },
        data: {
          storageKey: data.storageKey,
          remoteUrl: data.remoteUrl,
          originalFilename: data.originalFilename,
          fileSize: BigInt(data.fileSize),
          formattedFileSize: formatBytes(data.fileSize),
          duration: data.duration,
          durationSeconds: data.duration,
          formattedDuration: formatDuration(data.duration),
        },
        include: {
          module: true,
          category: true,
        },
      });

      // 2. Register media object for deduplication
      if (data.sha256) {
        await tx.mediaObject.upsert({
          where: { sha256: data.sha256 },
          update: {
            objectKey: data.storageKey,
            fileSizeBytes: BigInt(data.fileSize),
          },
          create: {
            sha256: data.sha256,
            storageProvider: 'cloudflare_r2',
            bucket: 'sheikh-zabuur-audio-catalog',
            objectKey: data.storageKey,
            fileSizeBytes: BigInt(data.fileSize),
            mimeType: 'audio/mpeg',
          },
        });
      }

      return track;
    });

    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    await recordAuditLog({
      adminUserId: user.id,
      action: 'TRACK_AUDIO_REPLACED',
      entityType: 'AudioTrack',
      entityId: id,
      details: {
        trackId: existingTrack.trackId,
        previousUrl: existingTrack.remoteUrl,
        newUrl: data.remoteUrl,
        previousSize: existingTrack.fileSize?.toString(),
        newSize: data.fileSize,
      },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({
      success: true,
      message: 'Audio recording replaced successfully',
      track: serializeBigInt(updated),
    });
  } catch (err) {
    console.error(`[API Track Replace] Failed to replace audio for ${id}:`, err);
    return NextResponse.json({ error: 'Failed to replace audio recording' }, { status: 500 });
  }
}

