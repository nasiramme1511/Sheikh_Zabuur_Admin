import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth';
import { recordAuditLog } from '@/lib/audit';
import { serializeBigInt } from '@/lib/serialize';

export const dynamic = 'force-dynamic';

const completeUploadSchema = z.object({
  storageKey: z.string().min(1, 'storageKey is required'),
  remoteUrl: z.string().url('remoteUrl must be a valid URL'),
  originalFilename: z.string().min(1, 'originalFilename is required'),
  moduleId: z.string().min(1, 'moduleId is required'),
  categoryId: z.string().min(1, 'categoryId is required'),
  title: z.string().min(1, 'title is required'),
  oromoTitle: z.string().nullable().optional(),
  amharicTitle: z.string().nullable().optional(),
  arabicTitle: z.string().nullable().optional(),
  duration: z.number().int().min(1, 'duration must be at least 1 second'),
  fileSize: z.number().int().positive('fileSize must be positive'),
  trackNumber: z.number().int().min(1).optional(),
  isPublished: z.boolean().optional().default(false),
});

export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requirePermission('tracks:upload');
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

  const parseResult = completeUploadSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parseResult.error.format() },
      { status: 400 }
    );
  }

  const data = parseResult.data;

  // Verify category and module exist
  const category = await prisma.audioCategory.findFirst({
    where: {
      id: data.categoryId,
      moduleId: data.moduleId,
    },
    include: {
      module: true,
    },
  });

  if (!category) {
    return NextResponse.json(
      { error: `Category '${data.categoryId}' in module '${data.moduleId}' not found` },
      { status: 404 }
    );
  }

  try {
    // Determine next track number if not provided
    let trackNum = data.trackNumber;
    if (!trackNum) {
      const highest = await prisma.audioTrack.findFirst({
        where: { categoryId: data.categoryId },
        orderBy: { trackNumber: 'desc' },
        select: { trackNumber: true },
      });
      trackNum = (highest?.trackNumber || 0) + 1;
    }

    // Determine deterministic unique track ID
    const baseId = `${data.categoryId}-${trackNum.toString().padStart(3, '0')}`;
    let trackId = baseId;
    let collisionCount = 1;

    while (await prisma.audioTrack.findUnique({ where: { id: trackId } })) {
      trackId = `${baseId}-${collisionCount}`;
      collisionCount++;
    }

    // Determine trackOrder
    const highestOrder = await prisma.audioTrack.findFirst({
      where: { categoryId: data.categoryId },
      orderBy: { trackOrder: 'desc' },
      select: { trackOrder: true },
    });
    const trackOrder = (highestOrder?.trackOrder || 0) + 1;

    // Transactionally create track and increment category counter
    const newTrack = await prisma.$transaction(async (tx) => {
      const track = await tx.audioTrack.create({
        data: {
          id: trackId,
          trackId: trackId,
          moduleId: data.moduleId,
          categoryId: data.categoryId,
          parentId: data.categoryId,
          trackNumber: trackNum,
          trackOrder,
          sortOrder: trackOrder,
          title: data.title,
          oromoTitle: data.oromoTitle || data.amharicTitle || null,
          amharicTitle: data.amharicTitle || data.oromoTitle || null,
          arabicTitle: data.arabicTitle || null,
          duration: data.duration,
          durationSeconds: data.duration,
          fileSize: BigInt(data.fileSize),
          originalFilename: data.originalFilename,
          storageKey: data.storageKey,
          remoteUrl: data.remoteUrl,
          isPublished: data.isPublished,
          metadata: {
            uploadedByUserId: user.id,
            uploadedByEmail: user.email,
            uploadedAt: new Date().toISOString(),
          },
        },
        include: {
          module: true,
          category: true,
        },
      });

      await tx.audioCategory.update({
        where: { id: data.categoryId },
        data: {
          trackCount: { increment: 1 },
        },
      });

      return track;
    });

    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    await recordAuditLog({
      adminUserId: user.id,
      action: 'TRACK_UPLOADED',
      entityType: 'AudioTrack',
      entityId: newTrack.id,
      ipAddress,
      userAgent,
      details: {
        trackId: newTrack.id,
        title: newTrack.title,
        moduleId: newTrack.moduleId,
        categoryId: newTrack.categoryId,
        fileSize: Number(newTrack.fileSize),
        duration: newTrack.duration,
        storageKey: newTrack.storageKey,
        remoteUrl: newTrack.remoteUrl,
      },
    });

    return NextResponse.json({
      success: true,
      track: serializeBigInt(newTrack),
    });
  } catch (err) {
    console.error('[Upload Complete] Failed to create audio track:', err);
    return NextResponse.json(
      { error: 'Failed to record uploaded track in database' },
      { status: 500 }
    );
  }
}
