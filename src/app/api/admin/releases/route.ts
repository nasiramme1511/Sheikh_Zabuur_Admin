import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth';
import { serializeBigInt } from '@/lib/serialize';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requirePermission('catalog:view');
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const releases = await prisma.catalogRelease.findMany({
      orderBy: { publishedAt: 'desc' },
      include: {
        publishedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return NextResponse.json({
      releases: serializeBigInt(releases),
    });
  } catch (err) {
    console.error('[API Releases GET] Error:', err);
    return NextResponse.json({ error: 'Failed to fetch catalog releases' }, { status: 500 });
  }
}
