import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth';
import { compileCatalog } from '@/lib/catalog-compiler';
import { serializeBigInt } from '@/lib/serialize';

export const dynamic = 'force-dynamic';

function suggestNextVersion(currentVersion: string): { patch: string; minor: string; major: string } {
  const parts = currentVersion.split('.').map((p) => parseInt(p, 10) || 0);
  const major = parts[0] || 2;
  const minor = parts[1] || 0;
  const patch = parts[2] || 0;

  return {
    patch: `${major}.${minor}.${patch + 1}`,
    minor: `${major}.${minor + 1}.0`,
    major: `${major + 1}.0.0`,
  };
}

export async function POST() {
  try {
    await requirePermission('catalog:publish');
  } catch {
    return NextResponse.json(
      { error: 'Unauthorized or insufficient permissions (requires catalog:publish)' },
      { status: 403 }
    );
  }

  try {
    const activeRelease = await prisma.catalogRelease.findFirst({
      where: { status: 'published' },
      orderBy: { publishedAt: 'desc' },
    });

    const currentVersion = activeRelease?.version || '2.0.0';
    const suggested = suggestNextVersion(currentVersion);

    // Compile with suggested patch version
    const compilation = await compileCatalog(suggested.patch);

    // Compute diff against active release
    const currentTrackCount = activeRelease?.totalTracks || 1731;
    const currentSizeBytes = Number(activeRelease?.totalSizeBytes || 39565187587);

    const trackDelta = compilation.validation.totalTracks - currentTrackCount;
    const sizeDeltaBytes = compilation.validation.totalSizeBytes - currentSizeBytes;

    // Determine recommended version: if new tracks added, recommend minor, else patch
    const recommendedVersion = trackDelta > 0 ? suggested.minor : suggested.patch;

    return NextResponse.json({
      success: true,
      currentVersion,
      suggestedVersions: suggested,
      recommendedVersion,
      validation: compilation.validation,
      checksumMd5: compilation.checksumMd5,
      checksumSha256: compilation.checksumSha256,
      diff: {
        trackDelta,
        sizeDeltaBytes,
        currentTrackCount,
        newTrackCount: compilation.validation.totalTracks,
        currentSizeBytes,
        newSizeBytes: compilation.validation.totalSizeBytes,
      },
      previewManifest: serializeBigInt(compilation.versionManifest),
    });
  } catch (err) {
    console.error('[API Release Compile] Error:', err);
    return NextResponse.json(
      { error: 'Failed to compile catalog release draft' },
      { status: 500 }
    );
  }
}

