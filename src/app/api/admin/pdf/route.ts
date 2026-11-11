import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth';
import { recordAuditLog } from '@/lib/audit';
import { serializeBigInt } from '@/lib/serialize';
import { parsePaginationParams, apiSuccess, apiError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

const createPdfDocumentSchema = z.object({
  documentId: z.string().min(2, 'Document ID must be at least 2 characters'),
  moduleId: z.string().min(1, 'Module ID is required'),
  categoryId: z.string().nullable().optional(),
  title: z.string().min(1, 'Title is required'),
  amharicTitle: z.string().nullable().optional(),
  arabicTitle: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  author: z.string().nullable().optional(),
  isPublished: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  // Optional initial volume
  initialVolume: z
    .object({
      volumeNumber: z.number().int().min(1).default(1),
      title: z.string().default('Volume 1'),
      amharicTitle: z.string().nullable().optional(),
      storageKey: z.string().nullable().optional(),
      remoteUrl: z.string().url('Must be a valid URL').nullable().optional(),
      fileSizeBytes: z.number().int().default(0),
      pageCount: z.number().int().default(0),
      sha256: z.string().nullable().optional(),
    })
    .optional(),
});

export async function GET(req: NextRequest) {
  try {
    await requirePermission('pdf:view');
  } catch {
    return NextResponse.json({ error: 'Unauthorized or insufficient permissions' }, { status: 403 });
  }

  const url = new URL(req.url);
  const { page, limit, skip } = parsePaginationParams(url, 20, 100);
  const searchParams = url.searchParams;
  const search = searchParams.get('search')?.trim() || '';
  const moduleId = searchParams.get('moduleId') || '';
  const categoryId = searchParams.get('categoryId') || '';
  const status = searchParams.get('status') || 'all'; // 'all', 'published', 'draft', 'archived'

  const where: Record<string, unknown> = {};

  if (moduleId) {
    where.moduleId = moduleId;
  }

  if (categoryId) {
    where.categoryId = categoryId;
  }

  if (status === 'published') {
    where.isPublished = true;
    where.archivedAt = null;
  } else if (status === 'draft') {
    where.isPublished = false;
    where.archivedAt = null;
  } else if (status === 'archived') {
    where.archivedAt = { not: null };
  }

  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { amharicTitle: { contains: search, mode: 'insensitive' } },
      { arabicTitle: { contains: search, mode: 'insensitive' } },
      { documentId: { contains: search, mode: 'insensitive' } },
      { author: { contains: search, mode: 'insensitive' } },
    ];
  }

  try {
    const [total, documents] = await Promise.all([
      prisma.pdfDocument.count({ where }),
      prisma.pdfDocument.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        include: {
          module: { select: { id: true, name: true, title: true, amharicTitle: true } },
          category: { select: { id: true, name: true, title: true, amharicTitle: true } },
          volumes: {
            orderBy: { volumeNumber: 'asc' },
          },
        },
      }),
    ]);

    return apiSuccess({
      documents: serializeBigInt(documents),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('[API PDF GET] Error querying PDF documents:', err);
    return apiError('Failed to fetch PDF documents', 500);
  }
}

export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requirePermission('pdf:upload');
  } catch {
    return NextResponse.json({ error: 'Unauthorized or insufficient permissions' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const parseResult = createPdfDocumentSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parseResult.error.format() },
      { status: 400 }
    );
  }

  const data = parseResult.data;

  // Check unique documentId
  const existingDoc = await prisma.pdfDocument.findUnique({
    where: { documentId: data.documentId },
  });

  if (existingDoc) {
    return NextResponse.json(
      { error: `A PDF document with identifier "${data.documentId}" already exists.` },
      { status: 409 }
    );
  }

  try {
    const newDoc = await prisma.$transaction(async (tx) => {
      const doc = await tx.pdfDocument.create({
        data: {
          documentId: data.documentId,
          moduleId: data.moduleId,
          categoryId: data.categoryId || null,
          title: data.title,
          amharicTitle: data.amharicTitle || null,
          arabicTitle: data.arabicTitle || null,
          description: data.description || null,
          author: data.author || null,
          isPublished: data.isPublished,
          sortOrder: data.sortOrder,
          volumes: data.initialVolume
            ? {
                create: {
                  volumeNumber: data.initialVolume.volumeNumber,
                  title: data.initialVolume.title,
                  amharicTitle: data.initialVolume.amharicTitle || null,
                  storageKey: data.initialVolume.storageKey || null,
                  remoteUrl: data.initialVolume.remoteUrl || null,
                  fileSizeBytes: BigInt(data.initialVolume.fileSizeBytes),
                  pageCount: data.initialVolume.pageCount,
                  sha256: data.initialVolume.sha256 || null,
                  isPublished: data.isPublished,
                },
              }
            : undefined,
        },
        include: {
          module: true,
          category: true,
          volumes: true,
        },
      });

      return doc;
    });

    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    await recordAuditLog({
      adminUserId: user.id,
      action: 'PDF_DOCUMENT_CREATED',
      entityType: 'PdfDocument',
      entityId: newDoc.id,
      details: {
        documentId: newDoc.documentId,
        title: newDoc.title,
        moduleId: newDoc.moduleId,
        volumesCount: newDoc.volumes.length,
      },
      ipAddress,
      userAgent,
    });

    return apiSuccess({ document: serializeBigInt(newDoc) }, undefined, 201);
  } catch (err) {
    console.error('[API PDF POST] Failed to create PDF document:', err);
    return apiError('Failed to create PDF document', 500);
  }
}
