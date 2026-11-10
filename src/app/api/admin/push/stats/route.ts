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
    const [totalActive, iosCount, androidCount, otherCount, totalBroadcasts] = await Promise.all([
      prisma.pushDeviceToken.count({ where: { isActive: true } }),
      prisma.pushDeviceToken.count({ where: { isActive: true, platform: 'ios' } }),
      prisma.pushDeviceToken.count({ where: { isActive: true, platform: 'android' } }),
      prisma.pushDeviceToken.count({
        where: {
          isActive: true,
          platform: { notIn: ['ios', 'android'] },
        },
      }),
      prisma.pushNotificationBroadcast.count(),
    ]);

    return NextResponse.json({
      totalActive,
      iosCount,
      androidCount,
      otherCount,
      totalBroadcasts,
    });
  } catch (err) {
    console.error('[API Push Stats] Error:', err);
    return NextResponse.json({ error: 'Failed to fetch push statistics' }, { status: 500 });
  }
}

