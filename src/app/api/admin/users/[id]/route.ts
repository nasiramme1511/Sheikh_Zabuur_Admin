import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth';
import { hashPassword } from '@/lib/password';
import { recordAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

const updateUserSchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  roleId: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(8, 'Password must be at least 8 characters').optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  let currentUser;
  try {
    currentUser = await requirePermission('users:manage');
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const parseResult = updateUserSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parseResult.error.format() },
      { status: 400 }
    );
  }

  const existing = await prisma.adminUser.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const data = parseResult.data;

  // Prevent user from deactivating themselves
  if (currentUser.id === id && data.isActive === false) {
    return NextResponse.json(
      { error: 'You cannot deactivate your own account.' },
      { status: 400 }
    );
  }

  try {
    let passwordHash: string | undefined;
    if (data.password) {
      passwordHash = await hashPassword(data.password);
    }

    const updated = await prisma.adminUser.update({
      where: { id },
      data: {
        name: data.name ?? existing.name,
        roleId: data.roleId ?? existing.roleId,
        isActive: data.isActive !== undefined ? data.isActive : existing.isActive,
        passwordHash: passwordHash ?? existing.passwordHash,
      },
      select: {
        id: true,
        email: true,
        name: true,
        roleId: true,
        isActive: true,
        role: true,
      },
    });

    // If password was reset or deactivated, invalidate user's active sessions
    if (passwordHash || data.isActive === false) {
      await prisma.adminSession.deleteMany({ where: { userId: id } });
    }

    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    await recordAuditLog({
      adminUserId: currentUser.id,
      action: 'USER_UPDATED',
      entityType: 'AdminUser',
      entityId: id,
      ipAddress,
      userAgent,
      details: {
        name: updated.name,
        roleId: updated.roleId,
        isActive: updated.isActive,
        passwordReset: !!passwordHash,
      },
    });

    return NextResponse.json({ user: updated });
  } catch (err) {
    console.error(`[API User PUT] Error for ${id}:`, err);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  let currentUser;
  try {
    currentUser = await requirePermission('users:manage');
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { id } = await params;

  if (currentUser.id === id) {
    return NextResponse.json({ error: 'You cannot delete your own account.' }, { status: 400 });
  }

  const superAdminCount = await prisma.adminUser.count({
    where: { roleId: 'SUPER_ADMIN', isActive: true },
  });

  const target = await prisma.adminUser.findUnique({ where: { id } });
  if (target?.roleId === 'SUPER_ADMIN' && superAdminCount <= 1) {
    return NextResponse.json(
      { error: 'Cannot delete the last active Super Administrator.' },
      { status: 400 }
    );
  }

  try {
    await prisma.adminUser.delete({ where: { id } });

    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    await recordAuditLog({
      adminUserId: currentUser.id,
      action: 'USER_DELETED',
      entityType: 'AdminUser',
      entityId: id,
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ success: true, message: 'User deleted.' });
  } catch (err) {
    console.error(`[API User DELETE] Error for ${id}:`, err);
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
}
