import crypto from 'crypto';
import { cookies } from 'next/headers';
import { prisma } from './prisma';

export const SESSION_COOKIE_NAME = 'sz_admin_session';
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  roleId: string;
  roleName: string;
  permissions: string[];
}

/**
 * Computes a SHA-256 hash of the session token.
 * We store only the hash in the database to prevent database leakage from compromising live sessions.
 */
export function hashSessionToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Creates a cryptographically random session token, hashes it,
 * and saves the session record in PostgreSQL.
 */
export async function createSession(userId: string, ipAddress?: string | null, userAgent?: string | null) {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const sessionTokenHash = hashSessionToken(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);

  const session = await prisma.adminSession.create({
    data: {
      userId,
      sessionTokenHash,
      ipAddress: ipAddress ?? null,
      userAgent: userAgent ?? null,
      expiresAt,
    },
  });

  return { rawToken, session };
}

/**
 * Validates a raw session token against the database.
 * Returns the authenticated user, role, and granular permissions.
 */
export async function validateSession(rawToken: string): Promise<AuthenticatedUser | null> {
  if (!rawToken || typeof rawToken !== 'string') {
    return null;
  }

  const sessionTokenHash = hashSessionToken(rawToken);

  const session = await prisma.adminSession.findUnique({
    where: { sessionTokenHash },
    include: {
      user: {
        include: {
          role: {
            include: {
              rolePermissions: {
                include: {
                  permission: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!session) {
    return null;
  }

  // Check expiration
  if (session.expiresAt < new Date()) {
    // Delete expired session asynchronously
    prisma.adminSession.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  // Check account status
  if (!session.user.isActive) {
    return null;
  }

  const permissions = session.user.role.rolePermissions.map((rp) => rp.permission.id);

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    roleId: session.user.role.id,
    roleName: session.user.role.name,
    permissions,
  };
}

/**
 * Revokes and deletes a session.
 */
export async function destroySession(rawToken: string): Promise<void> {
  if (!rawToken) return;
  const sessionTokenHash = hashSessionToken(rawToken);

  await prisma.adminSession.deleteMany({
    where: { sessionTokenHash },
  });
}

/**
 * Retrieves the currently authenticated user from Next.js request cookies.
 */
export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  return await validateSession(token);
}

/**
 * Asserts that the caller is authenticated. Throws an error if not.
 */
export async function requireAuth(): Promise<AuthenticatedUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('UNAUTHORIZED');
  }
  return user;
}

/**
 * Asserts that the caller has a specific permission. Throws an error if not.
 */
export async function requirePermission(permissionId: string): Promise<AuthenticatedUser> {
  const user = await requireAuth();

  // Super Admin bypasses individual permission checks
  if (user.roleId === 'SUPER_ADMIN') {
    return user;
  }

  if (!user.permissions.includes(permissionId)) {
    throw new Error('FORBIDDEN');
  }

  return user;
}
