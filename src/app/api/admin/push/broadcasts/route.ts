import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requirePermission('notifications:manage');
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const broadcasts = await prisma.pushNotificationBroadcast.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        sentBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return NextResponse.json({ broadcasts });
  } catch (err) {
    console.error('[API Broadcasts GET] Error:', err);
    return NextResponse.json({ error: 'Failed to fetch broadcasts' }, { status: 500 });
  }
}

