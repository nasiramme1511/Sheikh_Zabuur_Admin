import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth, requirePermission } from '@/lib/auth';
import { recordAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

const createCategorySchema = z.object({
  moduleId: z.string().min(1, 'Module ID is required'),
  parentId: z.string().nullable().optional(),
  slug: z
    .string()
    .min(1, 'Slug is required')
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  name: z.string().min(1, 'Name is required'),
  amharicTitle: z.string().nullable().optional(),
  arabicTitle: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
});

export async function GET(req: NextRequest) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const moduleId = searchParams.get('moduleId');

  try {
    const categories = await prisma.audioCategory.findMany({
      where: moduleId ? { moduleId } : undefined,
      orderBy: { sortOrder: 'asc' },
      include: {
        module: {
          select: { id: true, title: true, name: true, amharicTitle: true },
        },
        parent: {
          select: { id: true, title: true, name: true },
        },
        _count: {
          select: { tracks: true, pdfDocuments: true, children: true },
        },
      },
    });

    return NextResponse.json({ categories });
  } catch (err) {
    console.error('[API Categories] Failed to query categories:', err);
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
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

  const parseResult = createCategorySchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parseResult.error.format() },
      { status: 400 }
    );
  }

  const { moduleId, parentId, slug, name, amharicTitle, arabicTitle, description, sortOrder } = parseResult.data;

  // Validate module exists
  const moduleExists = await prisma.audioModule.findUnique({ where: { id: moduleId } });
  if (!moduleExists) {
    return NextResponse.json({ error: `Target module "${moduleId}" does not exist.` }, { status: 400 });
  }

  // Validate parent category exists if provided
  if (parentId) {
    const parentCategory = await prisma.audioCategory.findUnique({ where: { id: parentId } });
    if (!parentCategory) {
      return NextResponse.json({ error: `Parent category "${parentId}" does not exist.` }, { status: 400 });
    }
  }

  // Check unique slug within module
  const existingSlug = await prisma.audioCategory.findFirst({
    where: { moduleId, slug },
  });
  if (existingSlug) {
    return NextResponse.json(
      { error: `Category slug "${slug}" is already in use in module "${moduleExists.name}".` },
      { status: 409 }
    );
  }

  // Canonical ID format
  const canonicalId = slug.startsWith(`${moduleId}-`) ? slug : `${moduleId}-${slug}`;

  // Check if id already exists
  const existingId = await prisma.audioCategory.findUnique({ where: { id: canonicalId } });
  const categoryId = existingId ? `${canonicalId}-${Date.now().toString(36)}` : canonicalId;

  const highestOrder = await prisma.audioCategory.aggregate({
    where: { moduleId },
    _max: { sortOrder: true },
  });
  const nextOrder = sortOrder ?? (highestOrder._max.sortOrder ?? 0) + 1;

  try {
    const newCategory = await prisma.$transaction(async (tx) => {
      const cat = await tx.audioCategory.create({
        data: {
          id: categoryId,
          moduleId,
          parentId: parentId || null,
          slug,
          name,
          title: name,
          amharicTitle: amharicTitle || null,
          arabicTitle: arabicTitle || null,
          description: description || null,
          sortOrder: nextOrder,
          order: nextOrder,
          isActive: true,
        },
        include: {
          module: { select: { id: true, name: true, title: true } },
        },
      });

      // Update module's submodule count
      await tx.audioModule.update({
        where: { id: moduleId },
        data: { submoduleCount: { increment: 1 } },
      });

      return cat;
    });

    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    await recordAuditLog({
      adminUserId: user.id,
      action: 'CATEGORY_CREATED',
      entityType: 'AudioCategory',
      entityId: newCategory.id,
      ipAddress,
      userAgent,
      details: {
        moduleId: newCategory.moduleId,
        slug: newCategory.slug,
        name: newCategory.name,
      },
    });

    return NextResponse.json({ category: newCategory }, { status: 201 });
  } catch (err) {
    console.error('[API Categories POST] Failed to create category:', err);
    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 });
  }
}


