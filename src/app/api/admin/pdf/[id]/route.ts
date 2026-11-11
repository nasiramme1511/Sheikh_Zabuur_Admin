import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth';
import { recordAuditLog } from '@/lib/audit';
import { serializeBigInt } from '@/lib/serialize';
import { deleteStorageObject } from '@/lib/storage';

export const dynamic = 'force-dynamic';

const updatePdfSchema = z.object({
  title: z.string().min(1, 'Title cannot be empty').optional(),
  amharicTitle: z.string().nullable().optional(),
  arabicTitle: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  author: z.string().nullable().optional(),
  moduleId: z.string().optional(),
  categoryId: z.string().nullable().optional(),
  isPublished: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    await requirePermission('pdf:view');
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const document = await prisma.pdfDocument.findUnique({
    where: { id },
    include: {
      module: true,
      category: true,
      volumes: {
        orderBy: { volumeNumber: 'asc' },
      },
    },
  });

  if (!document) {
    return NextResponse.json({ error: 'PDF document not found' }, { status: 404 });
  }

  return NextResponse.json({ document: serializeBigInt(document) });
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  let user;
  try {
    user = await requirePermission('pdf:edit');
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

  const parseResult = updatePdfSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parseResult.error.format() },
      { status: 400 }
    );
  }

  const existingDoc = await prisma.pdfDocument.findUnique({ where: { id } });
  if (!existingDoc) {
    return NextResponse.json({ error: 'PDF document not found' }, { status: 404 });
  }

  const updateData = parseResult.data;

  try {
    const updated = await prisma.pdfDocument.update({
      where: { id },
      data: {
        title: updateData.title ?? existingDoc.title,
        amharicTitle: updateData.amharicTitle !== undefined ? updateData.amharicTitle : existingDoc.amharicTitle,
        arabicTitle: updateData.arabicTitle !== undefined ? updateData.arabicTitle : existingDoc.arabicTitle,
        description: updateData.description !== undefined ? updateData.description : existingDoc.description,
        author: updateData.author !== undefined ? updateData.author : existingDoc.author,
        moduleId: updateData.moduleId ?? existingDoc.moduleId,
        categoryId: updateData.categoryId !== undefined ? updateData.categoryId : existingDoc.categoryId,
        isPublished: updateData.isPublished !== undefined ? updateData.isPublished : existingDoc.isPublished,
        sortOrder: updateData.sortOrder ?? existingDoc.sortOrder,
      },
      include: {
        module: true,
        category: true,
        volumes: true,
      },
    });

    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    await recordAuditLog({
      adminUserId: user.id,
      action: 'PDF_DOCUMENT_UPDATED',
      entityType: 'PdfDocument',
      entityId: id,
      details: {
        previous: {
          title: existingDoc.title,
          isPublished: existingDoc.isPublished,
        },
        updated: {
          title: updated.title,
          isPublished: updated.isPublished,
        },
      },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ success: true, document: serializeBigInt(updated) });
  } catch (err) {
    console.error(`[API PDF PUT] Failed to update document ${id}:`, err);
    return NextResponse.json({ error: 'Failed to update PDF document' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  let user;
  try {
    user = await requirePermission('pdf:delete');
  } catch {
    return NextResponse.json({ error: 'Unauthorized or insufficient permissions' }, { status: 403 });
  }

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const permanent = searchParams.get('permanent') === 'true';

  const doc = await prisma.pdfDocument.findUnique({
    where: { id },
    include: { volumes: true },
  });

  if (!doc) {
    return NextResponse.json({ error: 'PDF document not found' }, { status: 404 });
  }

  const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
  const userAgent = req.headers.get('user-agent') || 'unknown';

  try {
    if (permanent) {
      // Hard delete: remove volumes from storage and DB
      for (const vol of doc.volumes) {
        if (vol.storageKey) {
          await deleteStorageObject(vol.storageKey);
        }
      }

      await prisma.pdfDocument.delete({ where: { id } });

      await recordAuditLog({
        adminUserId: user.id,
        action: 'PDF_DOCUMENT_PERMANENT_DELETE',
        entityType: 'PdfDocument',
        entityId: id,
        details: { documentId: doc.documentId, title: doc.title },
        ipAddress,
        userAgent,
      });

      return NextResponse.json({ success: true, message: 'PDF document permanently deleted' });
    } else {
      // Soft-archive
      const nextArchived = doc.archivedAt ? null : new Date();
      const updated = await prisma.pdfDocument.update({
        where: { id },
        data: {
          archivedAt: nextArchived,
          isPublished: nextArchived ? false : doc.isPublished,
        },
      });

      await recordAuditLog({
        adminUserId: user.id,
        action: nextArchived ? 'PDF_DOCUMENT_ARCHIVED' : 'PDF_DOCUMENT_RESTORED',
        entityType: 'PdfDocument',
        entityId: id,
        details: { documentId: doc.documentId, archivedAt: nextArchived },
        ipAddress,
        userAgent,
      });

      return NextResponse.json({
        success: true,
        archived: Boolean(nextArchived),
        document: serializeBigInt(updated),
      });
    }
  } catch (err) {
    console.error(`[API PDF DELETE] Failed to delete document ${id}:`, err);
    return NextResponse.json({ error: 'Failed to process document deletion' }, { status: 500 });
  }
}
