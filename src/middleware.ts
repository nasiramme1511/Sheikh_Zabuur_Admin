import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = [
  '/login',
  '/api/health',
  '/api/admin/auth/login',
  '/api/v1',
];

const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
};

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Cache-Control, Accept',
  'Access-Control-Max-Age': '86400',
};

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isV1Api = pathname.startsWith('/api/v1');

  // Handle CORS preflight for mobile API endpoints
  if (isV1Api && request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: {
        ...CORS_HEADERS,
        ...SECURITY_HEADERS,
      },
    });
  }

  // 1. Allow static resources and Next internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // 2. Allow explicitly public paths
  const isPublicPath = PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(path + '/'));
  const sessionCookie = request.cookies.get('sz_admin_session')?.value;

  // 3. If accessing /login and session cookie exists, redirect to home
  if (pathname === '/login' && sessionCookie) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // 4. If accessing protected route and no session cookie, redirect or return 401
  if (!isPublicPath && !sessionCookie) {
    if (pathname.startsWith('/api/')) {
      const unauthorizedResponse = NextResponse.json(
        { error: 'Unauthorized', authenticated: false },
        { status: 401 }
      );
      applySecurityHeaders(unauthorizedResponse, isV1Api);
      return unauthorizedResponse;
    }

    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  const response = NextResponse.next();
  applySecurityHeaders(response, isV1Api);
  return response;
}

function applySecurityHeaders(res: NextResponse, isV1Api: boolean): void {
  for (const [key, val] of Object.entries(SECURITY_HEADERS)) {
    res.headers.set(key, val);
  }
  if (isV1Api) {
    for (const [key, val] of Object.entries(CORS_HEADERS)) {
      res.headers.set(key, val);
    }
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
