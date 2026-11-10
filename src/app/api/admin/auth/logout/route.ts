import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { destroySession, SESSION_COOKIE_NAME, validateSession } from '@/lib/auth';
import { recordAuditLog } from '@/lib/audit';

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
  const userAgent = req.headers.get('user-agent') || 'unknown';

  if (token) {
    const user = await validateSession(token);
    if (user) {
      await recordAuditLog({
        adminUserId: user.id,
        action: 'AUTH_LOGOUT',
        entityType: 'AdminSession',
        ipAddress,
        userAgent,
      });
    }

    await destroySession(token);
  }

  const response = NextResponse.json({ success: true, message: 'Logged out successfully' });

  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });

  return response;
}

