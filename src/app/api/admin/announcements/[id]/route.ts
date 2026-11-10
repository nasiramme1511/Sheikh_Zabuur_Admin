import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth';
import { recordAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

const updateAnnouncementSchema = z.object({
  title: z.string().min(1, 'Title is required').optional(),
  amharicTitle: z.string().nullable().optional(),
  content: z.string().min(1, 'Content is required').optional(),
  amharicContent: z.string().nullable().optional(),
  type: z.enum(['info', 'warning', 'maintenance', 'new_content']).optional(),
  priority: z.number().int().optional(),
  isActive: z.boolean().optional(),
  startsAt: z.string().datetime().nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  actionUrl: z.string().url().nullable().optional(),
  actionLabel: z.string().nullable().optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  let user;
  try {
    user = await requirePermission('announcements:manage');
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const parseResult = updateAnnouncementSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parseResult.error.format() },
      { status: 400 }
    );
  }

  const existing = await prisma.announcement.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: 'Announcement not found' }, { status: 404 });
  }

  const data = parseResult.data;

  try {
    const updated = await prisma.announcement.update({
      where: { id },
      data: {
        title: data.title ?? existing.title,
        amharicTitle: data.amharicTitle !== undefined ? data.amharicTitle : existing.amharicTitle,
        content: data.content ?? existing.content,
        amharicContent: data.amharicContent !== undefined ? data.amharicContent : existing.amharicContent,
        type: data.type ?? existing.type,
        priority: data.priority ?? existing.priority,
        isActive: data.isActive !== undefined ? data.isActive : existing.isActive,
        startsAt: data.startsAt !== undefined ? (data.startsAt ? new Date(data.startsAt) : null) : existing.startsAt,
        expiresAt: data.expiresAt !== undefined ? (data.expiresAt ? new Date(data.expiresAt) : null) : existing.expiresAt,
        actionUrl: data.actionUrl !== undefined ? data.actionUrl : existing.actionUrl,
        actionLabel: data.actionLabel !== undefined ? data.actionLabel : existing.actionLabel,
      },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    await recordAuditLog({
      adminUserId: user.id,
      action: 'ANNOUNCEMENT_UPDATED',
      entityType: 'Announcement',
      entityId: id,
      ipAddress,
      userAgent,
      details: {
        title: updated.title,
        isActive: updated.isActive,
      },
    });

    return NextResponse.json({ announcement: updated });
  } catch (err) {
    console.error(`[API Announcement PUT] Error for ${id}:`, err);
    return NextResponse.json({ error: 'Failed to update announcement' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  let user;
  try {
    user = await requirePermission('announcements:manage');
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { id } = await params;

  try {
    await prisma.announcement.delete({ where: { id } });

    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    await recordAuditLog({
      adminUserId: user.id,
      action: 'ANNOUNCEMENT_DELETED',
      entityType: 'Announcement',
      entityId: id,
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ success: true, message: 'Announcement deleted.' });
  } catch (err) {
    console.error(`[API Announcement DELETE] Error for ${id}:`, err);
    return NextResponse.json({ error: 'Failed to delete announcement' }, { status: 500 });
  }
}

