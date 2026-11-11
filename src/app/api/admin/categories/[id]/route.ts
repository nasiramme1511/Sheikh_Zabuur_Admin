import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth';
import { recordAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

const updateCategorySchema = z.object({
  title: z.string().min(1, 'Title cannot be empty').optional(),
  amharicTitle: z.string().nullable().optional(),
  arabicTitle: z.string().nullable().optional(),
  order: z.number().int().optional(),
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

  const category = await prisma.audioCategory.findUnique({
    where: { id },
    include: {
      module: true,
      parent: true,
      children: true,
      _count: {
        select: { tracks: true },
      },
    },
  });

  if (!category) {
    return NextResponse.json({ error: 'Category not found' }, { status: 404 });
  }

  return NextResponse.json({ category });
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

  const parseResult = updateCategorySchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parseResult.error.format() },
      { status: 400 }
    );
  }

  const existing = await prisma.audioCategory.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: 'Category not found' }, { status: 404 });
  }

  const updateData = parseResult.data;

  try {
    const updated = await prisma.audioCategory.update({
      where: { id },
      data: {
        title: updateData.title ?? existing.title,
        amharicTitle: updateData.amharicTitle !== undefined ? updateData.amharicTitle : existing.amharicTitle,
        arabicTitle: updateData.arabicTitle !== undefined ? updateData.arabicTitle : existing.arabicTitle,
        order: updateData.order ?? existing.order,
      },
      include: {
        module: true,
        parent: true,
      },
    });

    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    await recordAuditLog({
      adminUserId: user.id,
      action: 'CATEGORY_UPDATED',
      entityType: 'AudioCategory',
      entityId: id,
      ipAddress,
      userAgent,
      details: {
        previous: {
          title: existing.title,
          amharicTitle: existing.amharicTitle,
          arabicTitle: existing.arabicTitle,
          order: existing.order,
        },
        updated: {
          title: updated.title,
          amharicTitle: updated.amharicTitle,
          arabicTitle: updated.arabicTitle,
          order: updated.order,
        },
      },
    });

    return NextResponse.json({ category: updated });
  } catch (err) {
    console.error(`[API Category PUT] Failed to update category ${id}:`, err);
    return NextResponse.json({ error: 'Failed to update category' }, { status: 500 });
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

  const existing = await prisma.audioCategory.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          tracks: true,
          children: true,
          pdfDocuments: true,
        },
      },
    },
  });

  if (!existing) {
    return NextResponse.json({ error: 'Category not found' }, { status: 404 });
  }

  // Safe deletion check: prevent deleting if tracks, subcategories, or PDFs exist
  if (
    existing._count.tracks > 0 ||
    existing._count.children > 0 ||
    existing._count.pdfDocuments > 0
  ) {
    return NextResponse.json(
      {
        error: `Cannot delete category "${existing.title || existing.name}". It contains ${existing._count.tracks} tracks, ${existing._count.children} child subcategories, and ${existing._count.pdfDocuments} PDF documents. Remove or reassign child content first.`,
      },
      { status: 400 }
    );
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.audioCategory.delete({ where: { id } });

      await tx.audioModule.update({
        where: { id: existing.moduleId },
        data: {
          submoduleCount: {
            decrement: 1,
          },
        },
      });
    });

    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    await recordAuditLog({
      adminUserId: user.id,
      action: 'CATEGORY_DELETED',
      entityType: 'AudioCategory',
      entityId: id,
      ipAddress,
      userAgent,
      details: {
        moduleId: existing.moduleId,
        slug: existing.slug,
        name: existing.name || existing.title,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Category "${existing.title || existing.name}" deleted successfully`,
    });
  } catch (err) {
    console.error(`[API Category DELETE] Failed to delete category ${id}:`, err);
    return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 });
  }
}
