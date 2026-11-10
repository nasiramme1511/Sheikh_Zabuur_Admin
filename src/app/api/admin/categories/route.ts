import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

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
      orderBy: { order: 'asc' },
      include: {
        module: {
          select: { id: true, title: true, amharicTitle: true },
        },
      },
    });

    return NextResponse.json({ categories });
  } catch (err) {
    console.error('[API Categories] Failed to query categories:', err);
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
  }
}

