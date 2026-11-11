import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth';
import { recordAuditLog } from '@/lib/audit';
import { serializeBigInt } from '@/lib/serialize';
import { getPublicDownloadUrl } from '@/lib/storage';

export const dynamic = 'force-dynamic';

const addVolumeSchema = z.object({
  volumeNumber: z.number().int().min(1),
  title: z.string().min(1, 'Volume title is required'),
  oromoTitle: z.string().nullable().optional(),
  amharicTitle: z.string().nullable().optional(),
  storageKey: z.string().nullable().optional(),
  remoteUrl: z.string().nullable().optional(),
  fileSizeBytes: z.number().int().default(0),
  pageCount: z.number().int().default(0),
  sha256: z.string().nullable().optional(),
  isPublished: z.boolean().default(true),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  let user;
  try {
    user = await requirePermission('pdf:upload');
  } catch {
    return NextResponse.json({ error: 'Unauthorized or insufficient permissions' }, { status: 403 });
  }

  const { id: documentId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const parseResult = addVolumeSchema.safeParse(body);
  if (!parseResult.success) {
    const errorDetails = parseResult.error.errors
      .map((e) => `${e.path.join('.')}: ${e.message}`)
      .join(', ');
    return NextResponse.json(
      { error: `Validation failed: ${errorDetails}`, details: parseResult.error.format() },
      { status: 400 }
    );
  }

  const doc = await prisma.pdfDocument.findUnique({
    where: { id: documentId },
    include: { volumes: true },
  });

  if (!doc) {
    return NextResponse.json({ error: 'PDF document not found' }, { status: 404 });
  }

  const data = parseResult.data;

  // Check if volumeNumber already exists
  const existingVol = doc.volumes.find((v) => v.volumeNumber === data.volumeNumber);
  if (existingVol) {
    return NextResponse.json(
      { error: `Volume ${data.volumeNumber} already exists for this document.` },
      { status: 409 }
    );
  }

  try {
    const newVolume = await prisma.pdfVolume.create({
      data: {
        documentId,
        volumeNumber: data.volumeNumber,
        title: data.title,
        oromoTitle: data.oromoTitle || data.amharicTitle || null,
        amharicTitle: data.amharicTitle || data.oromoTitle || null,
        storageKey: data.storageKey || null,
        remoteUrl: data.storageKey
          ? getPublicDownloadUrl(data.storageKey, `${doc.documentId}-vol${data.volumeNumber}.pdf`)
          : data.remoteUrl || null,
        fileSizeBytes: BigInt(data.fileSizeBytes),
        pageCount: data.pageCount,
        sha256: data.sha256 || null,
        isPublished: data.isPublished,
      },
    });

    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    await recordAuditLog({
      adminUserId: user.id,
      action: 'PDF_VOLUME_ADDED',
      entityType: 'PdfVolume',
      entityId: newVolume.id,
      details: {
        documentId: doc.documentId,
        volumeNumber: newVolume.volumeNumber,
        title: newVolume.title,
      },
      ipAddress,
      userAgent,
    });

    return NextResponse.json(
      { success: true, volume: serializeBigInt(newVolume) },
      { status: 201 }
    );
  } catch (err) {
    console.error(`[API Volume POST] Failed to add volume to doc ${documentId}:`, err);
    return NextResponse.json({ error: 'Failed to add volume' }, { status: 500 });
  }
}

