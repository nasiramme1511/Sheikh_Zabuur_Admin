import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth';
import { recordAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  let user;
  try {
    user = await requirePermission('branding:manage');
  } catch {
    return NextResponse.json({ error: 'Unauthorized or insufficient permissions' }, { status: 403 });
  }

  const { id } = await params;

  const targetBranding = await prisma.appBranding.findUnique({
    where: { id },
  });

  if (!targetBranding) {
    return NextResponse.json({ error: 'Branding version not found' }, { status: 404 });
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      // Set all other versions to false
      await tx.appBranding.updateMany({
        where: { id: { not: id } },
        data: { isCurrent: false },
      });

      // Activate target
      return await tx.appBranding.update({
        where: { id },
        data: { isCurrent: true },
      });
    });

    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    await recordAuditLog({
      adminUserId: user.id,
      action: 'BRANDING_ACTIVATED',
      entityType: 'AppBranding',
      entityId: id,
      details: {
        version: updated.version,
        appName: updated.appName,
      },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ success: true, branding: updated });
  } catch (err) {
    console.error(`[API Branding Activate] Failed to activate branding ${id}:`, err);
    return NextResponse.json({ error: 'Failed to activate branding version' }, { status: 500 });
  }
}

