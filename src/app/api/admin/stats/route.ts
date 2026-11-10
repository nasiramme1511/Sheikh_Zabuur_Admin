import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { formatBytes } from '@/lib/serialize';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [
      totalTracks,
      publishedTracks,
      draftTracks,
      archivedTracks,
      totalModules,
      totalCategories,
      activeRelease,
      storageAggregate,
      durationAggregate,
    ] = await Promise.all([
      prisma.audioTrack.count(),
      prisma.audioTrack.count({ where: { isPublished: true, archivedAt: null } }),
      prisma.audioTrack.count({ where: { isPublished: false, archivedAt: null } }),
      prisma.audioTrack.count({ where: { archivedAt: { not: null } } }),
      prisma.audioModule.count({ where: { isActive: true } }),
      prisma.audioCategory.count({ where: { isActive: true } }),
      prisma.catalogRelease.findFirst({
        where: { status: 'published' },
        orderBy: { publishedAt: 'desc' },
        select: { version: true, totalTracks: true, publishedAt: true },
      }),
      prisma.mediaObject.aggregate({
        _sum: { fileSizeBytes: true },
      }),
      prisma.audioTrack.aggregate({
        _sum: { durationSeconds: true },
      }),
    ]);

    const totalSizeBytes = storageAggregate._sum.fileSizeBytes || BigInt(0);
    const totalDurationSeconds = durationAggregate._sum.durationSeconds || 0;
    const totalAudioHours = (totalDurationSeconds / 3600).toFixed(2);

    return NextResponse.json({
      success: true,
      stats: {
        tracks: {
          total: totalTracks,
          published: publishedTracks,
          draft: draftTracks,
          archived: archivedTracks,
        },
        modules: {
          total: totalModules,
        },
        categories: {
          total: totalCategories,
        },
        storage: {
          totalSizeBytes: totalSizeBytes.toString(),
          formattedSize: formatBytes(totalSizeBytes),
          totalSeconds: totalDurationSeconds,
          totalHours: totalAudioHours,
        },
        release: {
          activeVersion: activeRelease?.version || '2.0.0',
          publishedAt: activeRelease?.publishedAt?.toISOString() || null,
        },
      },
    });
  } catch (err: unknown) {
    console.error('[Stats API] Error computing platform statistics:', err);
    return NextResponse.json({ error: 'Failed to compute statistics' }, { status: 500 });
  }
}

