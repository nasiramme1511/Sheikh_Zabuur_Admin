import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const now = new Date();

    const announcements = await prisma.announcement.findMany({
      where: {
        isActive: true,
        OR: [
          { startsAt: null },
          { startsAt: { lte: now } },
        ],
        AND: [
          {
            OR: [
              { expiresAt: null },
              { expiresAt: { gte: now } },
            ],
          },
        ],
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' },
      ],
      select: {
        id: true,
        title: true,
        amharicTitle: true,
        content: true,
        amharicContent: true,
        type: true,
        priority: true,
        actionUrl: true,
        actionLabel: true,
        createdAt: true,
      },
    });

    return NextResponse.json(
      { announcements },
      {
        headers: {
          'Cache-Control': 'public, max-age=300, stale-while-revalidate=60',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (err) {
    console.error('[API Announcements] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
