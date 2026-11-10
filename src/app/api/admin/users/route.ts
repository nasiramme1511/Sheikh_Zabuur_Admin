import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth';
import { hashPassword } from '@/lib/password';
import { recordAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

const createUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().min(1, 'Name is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  roleId: z.string().min(1, 'Role is required'),
  isActive: z.boolean().default(true),
});

export async function GET() {
  try {
    await requirePermission('users:manage');
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const users = await prisma.adminUser.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        roleId: true,
        isActive: true,
        lastLoginAt: true,
        failedLoginAttempts: true,
        lockedUntil: true,
        createdAt: true,
        role: {
          select: { id: true, name: true, description: true },
        },
        _count: {
          select: { sessions: true },
        },
      },
    });

    return NextResponse.json({ users });
  } catch (err) {
    console.error('[API Users GET] Error:', err);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let currentUser;
  try {
    currentUser = await requirePermission('users:manage');
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const parseResult = createUserSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parseResult.error.format() },
      { status: 400 }
    );
  }

  const { email, name, password, roleId, isActive } = parseResult.data;

  // Check unique email
  const existing = await prisma.adminUser.findUnique({
    where: { email: email.toLowerCase() },
  });
  if (existing) {
    return NextResponse.json({ error: 'Email is already registered' }, { status: 409 });
  }

  // Verify role exists
  const role = await prisma.adminRole.findUnique({ where: { id: roleId } });
  if (!role) {
    return NextResponse.json({ error: 'Selected role does not exist' }, { status: 404 });
  }

  try {
    const passwordHash = await hashPassword(password);

    const newUser = await prisma.adminUser.create({
      data: {
        email: email.toLowerCase(),
        name,
        passwordHash,
        roleId,
        isActive,
      },
      select: {
        id: true,
        email: true,
        name: true,
        roleId: true,
        isActive: true,
        createdAt: true,
        role: true,
      },
    });

    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    await recordAuditLog({
      adminUserId: currentUser.id,
      action: 'USER_CREATED',
      entityType: 'AdminUser',
      entityId: newUser.id,
      ipAddress,
      userAgent,
      details: {
        email: newUser.email,
        name: newUser.name,
        roleId: newUser.roleId,
      },
    });

    return NextResponse.json({ user: newUser }, { status: 201 });
  } catch (err) {
    console.error('[API Users POST] Error:', err);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}
