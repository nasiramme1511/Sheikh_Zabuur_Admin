import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth';
import { recordAuditLog } from '@/lib/audit';
import { serializeBigInt } from '@/lib/serialize';
import { deleteStorageObject } from '@/lib/storage';

export const dynamic = 'force-dynamic';

const updateVolumeSchema = z.object({
  title: z.string().min(1).optional(),
  amharicTitle: z.string().nullable().optional(),
  storageKey: z.string().nullable().optional(),
  remoteUrl: z.string().url().nullable().optional(),
  fileSizeBytes: z.number().int().optional(),
  pageCount: z.number().int().optional(),
  sha256: z.string().nullable().optional(),
  isPublished: z.boolean().optional(),
});

interface RouteParams {
  params: Promise<{ id: string; volumeNumber: string }>;
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  let user;
  try {
    user = await requirePermission('pdf:edit');
  } catch {
    return NextResponse.json({ error: 'Unauthorized or insufficient permissions' }, { status: 403 });
  }

  const { id: documentId, volumeNumber: volStr } = await params;
  const volumeNumber = parseInt(volStr, 10);

  if (isNaN(volumeNumber)) {
    return NextResponse.json({ error: 'Invalid volume number' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const parseResult = updateVolumeSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parseResult.error.format() },
      { status: 400 }
    );
  }

  const existing = await prisma.pdfVolume.findUnique({
    where: {
      documentId_volumeNumber: { documentId, volumeNumber },
    },
  });

  if (!existing) {
    return NextResponse.json({ error: 'Volume not found' }, { status: 404 });
  }

  const data = parseResult.data;

  try {
    const updated = await prisma.pdfVolume.update({
      where: { id: existing.id },
      data: {
        title: data.title ?? existing.title,
        amharicTitle: data.amharicTitle !== undefined ? data.amharicTitle : existing.amharicTitle,
        storageKey: data.storageKey !== undefined ? data.storageKey : existing.storageKey,
        remoteUrl: data.remoteUrl !== undefined ? data.remoteUrl : existing.remoteUrl,
        fileSizeBytes: data.fileSizeBytes !== undefined ? BigInt(data.fileSizeBytes) : existing.fileSizeBytes,
        pageCount: data.pageCount !== undefined ? data.pageCount : existing.pageCount,
        sha256: data.sha256 !== undefined ? data.sha256 : existing.sha256,
        isPublished: data.isPublished !== undefined ? data.isPublished : existing.isPublished,
        versionNumber: data.storageKey && data.storageKey !== existing.storageKey
          ? existing.versionNumber + 1
          : existing.versionNumber,
      },
    });

    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    await recordAuditLog({
      adminUserId: user.id,
      action: 'PDF_VOLUME_UPDATED',
      entityType: 'PdfVolume',
      entityId: updated.id,
      details: {
        documentId,
        volumeNumber,
        replacedFile: Boolean(data.storageKey && data.storageKey !== existing.storageKey),
      },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ success: true, volume: serializeBigInt(updated) });
  } catch (err) {
    console.error(`[API Volume PUT] Failed to update volume ${volumeNumber}:`, err);
    return NextResponse.json({ error: 'Failed to update volume' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  let user;
  try {
    user = await requirePermission('pdf:delete');
  } catch {
    return NextResponse.json({ error: 'Unauthorized or insufficient permissions' }, { status: 403 });
  }

  const { id: documentId, volumeNumber: volStr } = await params;
  const volumeNumber = parseInt(volStr, 10);

  if (isNaN(volumeNumber)) {
    return NextResponse.json({ error: 'Invalid volume number' }, { status: 400 });
  }

  const existing = await prisma.pdfVolume.findUnique({
    where: {
      documentId_volumeNumber: { documentId, volumeNumber },
    },
  });

  if (!existing) {
    return NextResponse.json({ error: 'Volume not found' }, { status: 404 });
  }

  try {
    if (existing.storageKey) {
      await deleteStorageObject(existing.storageKey);
    }

    await prisma.pdfVolume.delete({ where: { id: existing.id } });

    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    await recordAuditLog({
      adminUserId: user.id,
      action: 'PDF_VOLUME_DELETED',
      entityType: 'PdfVolume',
      entityId: existing.id,
      details: { documentId, volumeNumber },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ success: true, message: 'Volume deleted successfully' });
  } catch (err) {
    console.error(`[API Volume DELETE] Failed to delete volume:`, err);
    return NextResponse.json({ error: 'Failed to delete volume' }, { status: 500 });
  }
}
