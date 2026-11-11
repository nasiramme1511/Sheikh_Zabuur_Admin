import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth, requirePermission } from '@/lib/auth';
import { recordAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

const createModuleSchema = z.object({
  slug: z
    .string()
    .min(1, 'Slug is required')
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  name: z.string().min(1, 'Name is required'),
  amharicTitle: z.string().nullable().optional(),
  arabicTitle: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  iconName: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
});

export async function GET() {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const modules = await prisma.audioModule.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        categories: {
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            title: true,
            name: true,
            slug: true,
            amharicTitle: true,
            arabicTitle: true,
            parentId: true,
            order: true,
            sortOrder: true,
            trackCount: true,
          },
        },
        _count: {
          select: {
            tracks: true,
            pdfDocuments: true,
            categories: true,
          },
        },
      },
    });

    return NextResponse.json({ modules });
  } catch (err) {
    console.error('[API Modules] Failed to query modules:', err);
    return NextResponse.json({ error: 'Failed to fetch modules' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requirePermission('tracks:edit');
  } catch {
    return NextResponse.json({ error: 'Unauthorized or insufficient permissions' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const parseResult = createModuleSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parseResult.error.format() },
      { status: 400 }
    );
  }

  const { slug, name, amharicTitle, arabicTitle, description, iconName, sortOrder } = parseResult.data;

  // Check if slug or id exists
  const existing = await prisma.audioModule.findFirst({
    where: {
      OR: [{ id: slug }, { slug }],
    },
  });

  if (existing) {
    return NextResponse.json(
      { error: `A module with slug "${slug}" already exists.` },
      { status: 409 }
    );
  }

  const highestOrder = await prisma.audioModule.aggregate({
    _max: { sortOrder: true },
  });
  const nextOrder = sortOrder ?? (highestOrder._max.sortOrder ?? 0) + 1;

  try {
    const newModule = await prisma.audioModule.create({
      data: {
        id: slug,
        slug,
        name,
        title: name,
        amharicTitle: amharicTitle || null,
        arabicTitle: arabicTitle || null,
        description: description || null,
        iconName: iconName || null,
        sortOrder: nextOrder,
        order: nextOrder,
        isActive: true,
      },
    });

    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    await recordAuditLog({
      adminUserId: user.id,
      action: 'MODULE_CREATED',
      entityType: 'AudioModule',
      entityId: newModule.id,
      ipAddress,
      userAgent,
      details: {
        slug: newModule.slug,
        name: newModule.name,
      },
    });

    return NextResponse.json({ module: newModule }, { status: 201 });
  } catch (err) {
    console.error('[API Modules POST] Failed to create module:', err);
    return NextResponse.json({ error: 'Failed to create module' }, { status: 500 });
  }
}

