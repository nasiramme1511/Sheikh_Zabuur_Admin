import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth';
import { recordAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

const updateRolePermissionsSchema = z.object({
  permissions: z.array(z.string()),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  let user;
  try {
    user = await requirePermission('roles:manage');
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { id } = await params;

  if (id === 'SUPER_ADMIN') {
    return NextResponse.json(
      { error: 'Super Administrator role permissions are protected and cannot be modified.' },
      { status: 400 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const parseResult = updateRolePermissionsSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parseResult.error.format() },
      { status: 400 }
    );
  }

  const { permissions } = parseResult.data;

  // Verify role exists
  const role = await prisma.adminRole.findUnique({ where: { id } });
  if (!role) {
    return NextResponse.json({ error: 'Role not found' }, { status: 404 });
  }

  try {
    // Transactionally update role permissions
    await prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId: id } });

      if (permissions.length > 0) {
        await tx.rolePermission.createMany({
          data: permissions.map((pId) => ({
            roleId: id,
            permissionId: pId,
          })),
        });
      }
    });

    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    await recordAuditLog({
      adminUserId: user.id,
      action: 'ROLE_PERMISSIONS_UPDATED',
      entityType: 'AdminRole',
      entityId: id,
      ipAddress,
      userAgent,
      details: {
        roleId: id,
        assignedPermissionsCount: permissions.length,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Updated permissions for role ${role.name}.`,
    });
  } catch (err) {
    console.error(`[API Role PUT] Error for ${id}:`, err);
    return NextResponse.json({ error: 'Failed to update role permissions' }, { status: 500 });
  }
}

