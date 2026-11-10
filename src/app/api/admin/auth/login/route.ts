import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { verifyPassword } from '@/lib/password';
import { createSession, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from '@/lib/auth';
import { recordAuditLog } from '@/lib/audit';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export async function POST(req: NextRequest) {
  const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
  const userAgent = req.headers.get('user-agent') || 'unknown';

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Malformed JSON payload' }, { status: 400 });
  }

  const parseResult = loginSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parseResult.error.format() },
      { status: 400 }
    );
  }

  const { email, password } = parseResult.data;
  const normalizedEmail = email.toLowerCase().trim();

  // 1. Fetch user by email
  const user = await prisma.adminUser.findUnique({
    where: { email: normalizedEmail },
    include: { role: true },
  });

  // Generic failure message to prevent user enumeration attacks
  const genericAuthError = 'Invalid email or password';

  if (!user) {
    await recordAuditLog({
      action: 'AUTH_LOGIN_FAILED',
      entityType: 'AdminUser',
      details: { email: normalizedEmail, reason: 'USER_NOT_FOUND' },
      ipAddress,
      userAgent,
    });
    return NextResponse.json({ error: genericAuthError }, { status: 401 });
  }

  // 2. Check if account is active
  if (!user.isActive) {
    await recordAuditLog({
      adminUserId: user.id,
      action: 'AUTH_LOGIN_FAILED',
      entityType: 'AdminUser',
      entityId: user.id,
      details: { email: normalizedEmail, reason: 'ACCOUNT_DEACTIVATED' },
      ipAddress,
      userAgent,
    });
    return NextResponse.json({ error: 'Account is deactivated. Contact a Super Administrator.' }, { status: 403 });
  }

  // 3. Check for active temporary lockout
  const now = new Date();
  if (user.lockedUntil && user.lockedUntil > now) {
    const minutesLeft = Math.ceil((user.lockedUntil.getTime() - now.getTime()) / (60 * 1000));
    return NextResponse.json(
      {
        error: `Account is temporarily locked due to too many failed attempts. Try again in ${minutesLeft} minute(s).`,
      },
      { status: 423 }
    );
  }

  // 4. Verify password with Argon2id
  const isMatch = await verifyPassword(user.passwordHash, password);

  if (!isMatch) {
    const updatedFailures = user.failedLoginAttempts + 1;
    const shouldLock = updatedFailures >= MAX_FAILED_ATTEMPTS;
    const lockedUntil = shouldLock ? new Date(now.getTime() + LOCKOUT_MINUTES * 60 * 1000) : null;

    await prisma.adminUser.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: updatedFailures,
        lockedUntil,
      },
    });

    await recordAuditLog({
      adminUserId: user.id,
      action: 'AUTH_LOGIN_FAILED',
      entityType: 'AdminUser',
      entityId: user.id,
      details: {
        email: normalizedEmail,
        failedAttempts: updatedFailures,
        locked: shouldLock,
      },
      ipAddress,
      userAgent,
    });

    return NextResponse.json(
      {
        error: shouldLock
          ? `Account locked for ${LOCKOUT_MINUTES} minutes due to excessive failed attempts.`
          : genericAuthError,
      },
      { status: 401 }
    );
  }

  // 5. Success: reset failed attempts, update last login
  await prisma.adminUser.update({
    where: { id: user.id },
    data: {
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: now,
    },
  });

  // 6. Create cryptographic session
  const { rawToken } = await createSession(user.id, ipAddress, userAgent);

  // 7. Audit log login event
  await recordAuditLog({
    adminUserId: user.id,
    action: 'AUTH_LOGIN_SUCCESS',
    entityType: 'AdminUser',
    entityId: user.id,
    details: {
      email: user.email,
      role: user.role.id,
    },
    ipAddress,
    userAgent,
  });

  // 8. Set secure HttpOnly session cookie
  const response = NextResponse.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role.id,
      roleName: user.role.name,
    },
  });

  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: rawToken,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  return response;
}

