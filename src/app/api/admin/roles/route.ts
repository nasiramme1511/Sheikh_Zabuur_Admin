import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requirePermission('roles:manage');
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const [roles, allPermissions] = await Promise.all([
      prisma.adminRole.findMany({
        orderBy: { id: 'asc' },
        include: {
          rolePermissions: {
            select: { permissionId: true },
          },
          _count: {
            select: { users: true },
          },
        },
      }),
      prisma.permission.findMany({
        orderBy: [{ module: 'asc' }, { id: 'asc' }],
      }),
    ]);

    const formattedRoles = roles.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      userCount: r._count.users,
      permissions: r.rolePermissions.map((rp) => rp.permissionId),
    }));

    return NextResponse.json({
      roles: formattedRoles,
      permissions: allPermissions,
    });
  } catch (err) {
    console.error('[API Roles GET] Error:', err);
    return NextResponse.json({ error: 'Failed to fetch roles' }, { status: 500 });
  }
}
