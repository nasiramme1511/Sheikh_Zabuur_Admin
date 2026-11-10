import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth';
import { recordAuditLog } from '@/lib/audit';
import { compileCatalog } from '@/lib/catalog-compiler';
import { publishCatalogArtifacts } from '@/lib/catalog-publisher';
import { serializeBigInt } from '@/lib/serialize';

export const dynamic = 'force-dynamic';

const publishSchema = z.object({
  version: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/, 'Version must follow SemVer format (e.g. 2.1.0)'),
  releaseNotes: z.string().optional().default('Production catalog release.'),
});

export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requirePermission('catalog:publish');
  } catch {
    return NextResponse.json(
      { error: 'Unauthorized or insufficient permissions (requires catalog:publish)' },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const parseResult = publishSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parseResult.error.format() },
      { status: 400 }
    );
  }

  const { version, releaseNotes } = parseResult.data;

  // Check if version already exists
  const existing = await prisma.catalogRelease.findUnique({ where: { version } });
  if (existing) {
    return NextResponse.json(
      { error: `Release version '${version}' has already been published. Please choose a higher SemVer version.` },
      { status: 409 }
    );
  }

  try {
    // 1. Compile and validate catalog
    const compilation = await compileCatalog(version);
    if (!compilation.validation.isValid) {
      return NextResponse.json(
        {
          error: 'Catalog compilation validation failed',
          details: compilation.validation.errors,
        },
        { status: 422 }
      );
    }

    // 2. Deploy artifacts to R2 / S3
    const publishResult = await publishCatalogArtifacts(compilation);

    // 3. Atomically update database statuses
    const newRelease = await prisma.$transaction(async (tx) => {
      // Supersede current published releases
      await tx.catalogRelease.updateMany({
        where: { status: 'published' },
        data: { status: 'superseded' },
      });

      // Insert new release
      return tx.catalogRelease.create({
        data: {
          version,
          checksumMd5: compilation.checksumMd5,
          totalModules: compilation.validation.totalModules,
          totalCategories: compilation.validation.totalCategories,
          totalTracks: compilation.validation.totalTracks,
          totalSizeBytes: BigInt(compilation.validation.totalSizeBytes),
          storageUrl: publishResult.catalogUrl,
          releaseNotes,
          status: 'published',
          publishedById: user.id,
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
      action: 'CATALOG_RELEASE_PUBLISHED',
      entityType: 'CatalogRelease',
      entityId: newRelease.id,
      ipAddress,
      userAgent,
      details: {
        version: newRelease.version,
        checksumMd5: newRelease.checksumMd5,
        totalTracks: newRelease.totalTracks,
        totalSizeBytes: Number(newRelease.totalSizeBytes),
        isSimulated: publishResult.isSimulated,
        storageUrl: publishResult.catalogUrl,
      },
    });

    return NextResponse.json({
      success: true,
      release: serializeBigInt(newRelease),
      artifacts: publishResult,
    });
  } catch (err) {
    console.error('[API Release Publish] Error:', err);
    return NextResponse.json(
      { error: 'Failed to publish catalog release' },
      { status: 500 }
    );
  }
}

