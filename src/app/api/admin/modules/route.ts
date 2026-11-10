import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const modules = await prisma.audioModule.findMany({
      orderBy: { order: 'asc' },
      include: {
        categories: {
          orderBy: { order: 'asc' },
          select: {
            id: true,
            title: true,
            amharicTitle: true,
            arabicTitle: true,
            parentId: true,
            order: true,
            trackCount: true,
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
