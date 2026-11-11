import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth, requirePermission } from '@/lib/auth';
import { recordAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

const updateModuleSchema = z.object({
  name: z.string().min(1, 'Name cannot be empty').optional(),
  oromoTitle: z.string().nullable().optional(),
  amharicTitle: z.string().nullable().optional(),
  arabicTitle: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  iconName: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const audioModule = await prisma.audioModule.findUnique({
    where: { id },
    include: {
      categories: {
        orderBy: { sortOrder: 'asc' },
        include: {
          _count: {
            select: { tracks: true, pdfDocuments: true },
          },
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

  if (!audioModule) {
    return NextResponse.json({ error: 'Module not found' }, { status: 404 });
  }

  return NextResponse.json({ module: audioModule });
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

  const parseResult = updateModuleSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parseResult.error.format() },
      { status: 400 }
    );
  }

  const existing = await prisma.audioModule.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: 'Module not found' }, { status: 404 });
  }

  const updateData = parseResult.data;

  try {
    const updated = await prisma.audioModule.update({
      where: { id },
      data: {
        name: updateData.name ?? existing.name,
        title: updateData.name ?? existing.title,
        oromoTitle: updateData.oromoTitle !== undefined ? updateData.oromoTitle : (updateData.amharicTitle !== undefined ? updateData.amharicTitle : existing.oromoTitle),
        amharicTitle: updateData.amharicTitle !== undefined ? updateData.amharicTitle : (updateData.oromoTitle !== undefined ? updateData.oromoTitle : existing.amharicTitle),
        arabicTitle: updateData.arabicTitle !== undefined ? updateData.arabicTitle : existing.arabicTitle,
        description: updateData.description !== undefined ? updateData.description : existing.description,
        iconName: updateData.iconName !== undefined ? updateData.iconName : existing.iconName,
        sortOrder: updateData.sortOrder ?? existing.sortOrder,
        order: updateData.sortOrder ?? existing.order,
        isActive: updateData.isActive ?? existing.isActive,
      },
    });

    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    await recordAuditLog({
      adminUserId: user.id,
      action: 'MODULE_UPDATED',
      entityType: 'AudioModule',
      entityId: id,
      ipAddress,
      userAgent,
      details: {
        previous: {
          name: existing.name,
          sortOrder: existing.sortOrder,
          isActive: existing.isActive,
        },
        updated: {
          name: updated.name,
          sortOrder: updated.sortOrder,
          isActive: updated.isActive,
        },
      },
    });

    return NextResponse.json({ module: updated });
  } catch (err) {
    console.error(`[API Module PUT] Failed to update module ${id}:`, err);
    return NextResponse.json({ error: 'Failed to update module' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  let user;
  try {
    user = await requirePermission('tracks:delete');
  } catch {
    return NextResponse.json({ error: 'Unauthorized or insufficient permissions' }, { status: 403 });
  }

  const { id } = await params;

  const existing = await prisma.audioModule.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          categories: true,
          tracks: true,
          pdfDocuments: true,
        },
      },
    },
  });

  if (!existing) {
    return NextResponse.json({ error: 'Module not found' }, { status: 404 });
  }

  // Safe deletion check: prevent deleting if categories, tracks, or PDFs exist
  if (
    existing._count.categories > 0 ||
    existing._count.tracks > 0 ||
    existing._count.pdfDocuments > 0
  ) {
    return NextResponse.json(
      {
        error: `Cannot delete module "${existing.name}". It contains ${existing._count.categories} categories, ${existing._count.tracks} tracks, and ${existing._count.pdfDocuments} PDF documents. Reassign or delete child content first.`,
      },
      { status: 400 }
    );
  }

  try {
    await prisma.audioModule.delete({ where: { id } });

    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    await recordAuditLog({
      adminUserId: user.id,
      action: 'MODULE_DELETED',
      entityType: 'AudioModule',
      entityId: id,
      ipAddress,
      userAgent,
      details: {
        slug: existing.slug,
        name: existing.name,
      },
    });

    return NextResponse.json({ success: true, message: `Module "${existing.name}" deleted successfully` });
  } catch (err) {
    console.error(`[API Module DELETE] Failed to delete module ${id}:`, err);
    return NextResponse.json({ error: 'Failed to delete module' }, { status: 500 });
  }
}

