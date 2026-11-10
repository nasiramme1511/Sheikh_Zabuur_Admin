import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth';
import { recordAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

const announcementSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  amharicTitle: z.string().nullable().optional(),
  content: z.string().min(1, 'Content is required'),
  amharicContent: z.string().nullable().optional(),
  type: z.enum(['info', 'warning', 'maintenance', 'new_content']).default('info'),
  priority: z.number().int().default(0),
  isActive: z.boolean().default(true),
  startsAt: z.string().datetime().nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  actionUrl: z.string().url().nullable().optional(),
  actionLabel: z.string().nullable().optional(),
});

export async function GET() {
  try {
    await requirePermission('announcements:manage');
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const announcements = await prisma.announcement.findMany({
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' },
      ],
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return NextResponse.json({ announcements });
  } catch (err) {
    console.error('[API Announcements GET] Error:', err);
    return NextResponse.json({ error: 'Failed to fetch announcements' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requirePermission('announcements:manage');
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const parseResult = announcementSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parseResult.error.format() },
      { status: 400 }
    );
  }

  const data = parseResult.data;

  try {
    const announcement = await prisma.announcement.create({
      data: {
        title: data.title,
        amharicTitle: data.amharicTitle || null,
        content: data.content,
        amharicContent: data.amharicContent || null,
        type: data.type,
        priority: data.priority,
        isActive: data.isActive,
        startsAt: data.startsAt ? new Date(data.startsAt) : null,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        actionUrl: data.actionUrl || null,
        actionLabel: data.actionLabel || null,
        createdById: user.id,
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
      action: 'ANNOUNCEMENT_CREATED',
      entityType: 'Announcement',
      entityId: announcement.id,
      ipAddress,
      userAgent,
      details: {
        title: announcement.title,
        type: announcement.type,
        priority: announcement.priority,
      },
    });

    return NextResponse.json({ announcement }, { status: 201 });
  } catch (err) {
    console.error('[API Announcement POST] Error:', err);
    return NextResponse.json({ error: 'Failed to create announcement' }, { status: 500 });
  }
}

