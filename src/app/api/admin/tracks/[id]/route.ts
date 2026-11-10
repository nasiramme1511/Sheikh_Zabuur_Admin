import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth';
import { recordAuditLog } from '@/lib/audit';
import { serializeBigInt } from '@/lib/serialize';

export const dynamic = 'force-dynamic';

const updateTrackSchema = z.object({
  title: z.string().min(1, 'Title cannot be empty').optional(),
  amharicTitle: z.string().nullable().optional(),
  arabicTitle: z.string().nullable().optional(),
  trackNumber: z.number().int().min(1).optional(),
  trackOrder: z.number().int().optional(),
  isPublished: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    await requirePermission('tracks:view');
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const track = await prisma.audioTrack.findUnique({
    where: { id },
    include: {
      module: true,
      category: true,
    },
  });

  if (!track) {
    return NextResponse.json({ error: 'Track not found' }, { status: 404 });
  }

  return NextResponse.json({ track: serializeBigInt(track) });
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  let user;
  try {
    user = await requirePermission('tracks:edit');
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

  const parseResult = updateTrackSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parseResult.error.format() },
      { status: 400 }
    );
  }

  const existingTrack = await prisma.audioTrack.findUnique({ where: { id } });
  if (!existingTrack) {
    return NextResponse.json({ error: 'Track not found' }, { status: 404 });
  }

  const updateData = parseResult.data;

  try {
    const updated = await prisma.audioTrack.update({
      where: { id },
      data: {
        title: updateData.title ?? existingTrack.title,
        amharicTitle: updateData.amharicTitle !== undefined ? updateData.amharicTitle : existingTrack.amharicTitle,
        arabicTitle: updateData.arabicTitle !== undefined ? updateData.arabicTitle : existingTrack.arabicTitle,
        trackNumber: updateData.trackNumber ?? existingTrack.trackNumber,
        trackOrder: updateData.trackOrder ?? existingTrack.trackOrder,
        isPublished: updateData.isPublished !== undefined ? updateData.isPublished : existingTrack.isPublished,
        metadata: updateData.metadata !== undefined ? JSON.parse(JSON.stringify(updateData.metadata)) : undefined,
      },
      include: {
        module: true,
        category: true,
      },
    });

    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    await recordAuditLog({
      adminUserId: user.id,
      action: 'TRACK_UPDATE',
      entityType: 'AudioTrack',
      entityId: id,
      details: {
        trackId: id,
        previous: {
          title: existingTrack.title,
          amharicTitle: existingTrack.amharicTitle,
          isPublished: existingTrack.isPublished,
        },
        updated: {
          title: updated.title,
          amharicTitle: updated.amharicTitle,
          isPublished: updated.isPublished,
        },
      },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ success: true, track: serializeBigInt(updated) });
  } catch (err) {
    console.error(`[API Track Update] Failed to update track ${id}:`, err);
    return NextResponse.json({ error: 'Failed to update track' }, { status: 500 });
  }
}

