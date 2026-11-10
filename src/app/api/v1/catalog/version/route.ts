import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import fs from 'fs/promises';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 1. Try reading the local compiled manifest
    const localManifestPath = path.join(process.cwd(), 'public', 'catalog', 'catalogVersion.json');
    try {
      const content = await fs.readFile(localManifestPath, 'utf-8');
      return new NextResponse(content, {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, must-revalidate',
          'Access-Control-Allow-Origin': '*',
        },
      });
    } catch {
      // If local file not yet created, construct from active database release
    }

    const activeRelease = await prisma.catalogRelease.findFirst({
      where: { status: 'published' },
      orderBy: { publishedAt: 'desc' },
    });

    if (!activeRelease) {
      return NextResponse.json({ error: 'No active catalog release available' }, { status: 404 });
    }

    const manifest = {
      version: activeRelease.version,
      updatedAt: activeRelease.publishedAt.toISOString(),
      minAppVersion: '1.0.0',
      totalModules: activeRelease.totalModules,
      totalTracks: activeRelease.totalTracks,
      totalSizeBytes: Number(activeRelease.totalSizeBytes),
      formattedTotalSize: `${(Number(activeRelease.totalSizeBytes) / (1024 * 1024 * 1024)).toFixed(2)} GB`,
      checksum: activeRelease.checksumMd5,
    };

    return NextResponse.json(manifest, {
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, must-revalidate',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    console.error('[API Catalog Version] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
