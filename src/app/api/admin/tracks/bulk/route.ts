import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth';
import { recordAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

const bulkTracksActionSchema = z.object({
  trackIds: z.array(z.string()).min(1, 'At least one track ID is required'),
  action: z.enum(['publish', 'unpublish', 'archive', 'restore', 'change_category']),
  targetCategoryId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requirePermission('tracks:bulk');
  } catch {
    return NextResponse.json({ error: 'Unauthorized or insufficient permissions' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const parseResult = bulkTracksActionSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parseResult.error.format() },
      { status: 400 }
    );
  }

  const { trackIds, action, targetCategoryId } = parseResult.data;

  try {
    let updateResult;

    if (action === 'publish') {
      updateResult = await prisma.audioTrack.updateMany({
        where: { id: { in: trackIds } },
        data: { isPublished: true, archivedAt: null },
      });
    } else if (action === 'unpublish') {
      updateResult = await prisma.audioTrack.updateMany({
        where: { id: { in: trackIds } },
        data: { isPublished: false },
      });
    } else if (action === 'archive') {
      updateResult = await prisma.audioTrack.updateMany({
        where: { id: { in: trackIds } },
        data: { archivedAt: new Date(), isPublished: false },
      });
    } else if (action === 'restore') {
      updateResult = await prisma.audioTrack.updateMany({
        where: { id: { in: trackIds } },
        data: { archivedAt: null },
      });
    } else if (action === 'change_category') {
      if (!targetCategoryId) {
        return NextResponse.json({ error: 'targetCategoryId is required for change_category action' }, { status: 400 });
      }

      const targetCat = await prisma.audioCategory.findUnique({
        where: { id: targetCategoryId },
      });

      if (!targetCat) {
        return NextResponse.json({ error: 'Target category not found' }, { status: 404 });
      }

      updateResult = await prisma.audioTrack.updateMany({
        where: { id: { in: trackIds } },
        data: {
          categoryId: targetCat.id,
          moduleId: targetCat.moduleId,
        },
      });
    }

    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    await recordAuditLog({
      adminUserId: user.id,
      action: `TRACKS_BULK_${action.toUpperCase()}`,
      entityType: 'AudioTrack',
      details: {
        action,
        count: updateResult?.count || 0,
        trackIds,
        targetCategoryId,
      },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({
      success: true,
      message: `Successfully executed ${action} on ${updateResult?.count || 0} audio tracks.`,
      count: updateResult?.count || 0,
    });
  } catch (err) {
    console.error('[API Tracks Bulk] Bulk action failed:', err);
    return NextResponse.json({ error: 'Failed to execute bulk action' }, { status: 500 });
  }
}

