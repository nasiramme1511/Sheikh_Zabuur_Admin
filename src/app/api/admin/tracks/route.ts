import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { serializeBigInt } from '@/lib/serialize';
import { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(5, parseInt(searchParams.get('limit') || '25', 10)));
  const search = searchParams.get('search')?.trim() || '';
  const moduleId = searchParams.get('moduleId') || '';
  const categoryId = searchParams.get('categoryId') || '';
  const status = searchParams.get('status') || 'all';
  const sortBy = searchParams.get('sortBy') || 'trackNumber';
  const sortOrder = searchParams.get('sortOrder') === 'desc' ? 'desc' : 'asc';

  const skip = (page - 1) * limit;

  // Build where filter
  const where: Prisma.AudioTrackWhereInput = {};

  if (moduleId) {
    where.moduleId = moduleId;
  }

  if (categoryId) {
    where.categoryId = categoryId;
  }

  if (status === 'published') {
    where.isPublished = true;
  } else if (status === 'draft') {
    where.isPublished = false;
  }

  if (search) {
    where.OR = [
      { id: { contains: search, mode: 'insensitive' } },
      { title: { contains: search, mode: 'insensitive' } },
      { amharicTitle: { contains: search, mode: 'insensitive' } },
      { arabicTitle: { contains: search, mode: 'insensitive' } },
      { originalFilename: { contains: search, mode: 'insensitive' } },
    ];
  }

  // Build orderBy
  let orderBy: Prisma.AudioTrackOrderByWithRelationInput = { trackNumber: sortOrder };
  if (sortBy === 'title') {
    orderBy = { title: sortOrder };
  } else if (sortBy === 'duration') {
    orderBy = { duration: sortOrder };
  } else if (sortBy === 'fileSize') {
    orderBy = { fileSize: sortOrder };
  } else if (sortBy === 'createdAt') {
    orderBy = { createdAt: sortOrder };
  }

  try {
    const [total, tracks] = await Promise.all([
      prisma.audioTrack.count({ where }),
      prisma.audioTrack.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          module: {
            select: { id: true, title: true, amharicTitle: true },
          },
          category: {
            select: { id: true, title: true, amharicTitle: true },
          },
        },
      }),
    ]);

    return NextResponse.json({
      tracks: serializeBigInt(tracks),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error('[API Tracks] Failed to query tracks:', err);
    return NextResponse.json({ error: 'Failed to fetch audio tracks' }, { status: 500 });
  }
}
