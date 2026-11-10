import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const publicSettings = await prisma.systemSetting.findMany({
      where: { isPublic: true },
      select: { key: true, value: true },
    });

    const settingsMap: Record<string, string> = {};
    for (const s of publicSettings) {
      settingsMap[s.key] = s.value;
    }

    return NextResponse.json(
      { settings: settingsMap },
      {
        headers: {
          'Cache-Control': 'public, max-age=300, stale-while-revalidate=60',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (err) {
    console.error('[API Public Settings] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

