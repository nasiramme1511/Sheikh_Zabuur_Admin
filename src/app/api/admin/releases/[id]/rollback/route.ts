import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth';
import { recordAuditLog } from '@/lib/audit';
import { rollbackCatalogArtifacts } from '@/lib/catalog-publisher';
import { serializeBigInt } from '@/lib/serialize';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  let user;
  try {
    user = await requirePermission('catalog:rollback');
  } catch {
    return NextResponse.json(
      { error: 'Unauthorized or insufficient permissions (requires catalog:rollback)' },
      { status: 403 }
    );
  }

  const { id } = await params;

  const targetRelease = await prisma.catalogRelease.findUnique({
    where: { id },
    include: {
      publishedBy: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  if (!targetRelease) {
    return NextResponse.json({ error: 'Target release not found' }, { status: 404 });
  }

  if (targetRelease.status === 'published') {
    return NextResponse.json(
      { error: `Release ${targetRelease.version} is already the active published release.` },
      { status: 400 }
    );
  }

  try {
    // 1. Rollback storage artifacts in R2 / S3
    await rollbackCatalogArtifacts(targetRelease.version);

    // 2. Atomically update release statuses in PostgreSQL
    const updated = await prisma.$transaction(async (tx) => {
      // Mark current active release as rolled_back
      await tx.catalogRelease.updateMany({
        where: { status: 'published' },
        data: { status: 'rolled_back' },
      });

      // Restore target release as published
      return tx.catalogRelease.update({
        where: { id },
        data: {
          status: 'published',
          publishedAt: new Date(),
        },
        include: {
          publishedBy: {
            select: { id: true, name: true, email: true },
          },
        },
      });
    });

    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    await recordAuditLog({
      adminUserId: user.id,
      action: 'CATALOG_ROLLBACK',
      entityType: 'CatalogRelease',
      entityId: updated.id,
      ipAddress,
      userAgent,
      details: {
        restoredVersion: updated.version,
        checksumMd5: updated.checksumMd5,
        totalTracks: updated.totalTracks,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Successfully rolled back active catalog to version ${updated.version}.`,
      release: serializeBigInt(updated),
    });
  } catch (err) {
    console.error(`[API Release Rollback] Failed to rollback release ${id}:`, err);
    return NextResponse.json(
      { error: 'Failed to execute catalog rollback' },
      { status: 500 }
    );
  }
}
