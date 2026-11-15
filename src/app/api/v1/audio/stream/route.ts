import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const ALLOWED_HOST_SUFFIXES = [
  'archive.org',
  'r2.cloudflarestorage.com',
  'sheikhzabur.com',
  'shekhzabur.com',
  'vercel.app',
  'localhost',
  '127.0.0.1',
];

function isAllowedUrl(urlString: string): boolean {
  try {
    const parsed = new URL(urlString);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    const hostname = parsed.hostname.toLowerCase();
    return ALLOWED_HOST_SUFFIXES.some(
      (suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`)
    );
  } catch {
    return false;
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Range, Authorization, Accept',
      'Access-Control-Max-Age': '86400',
    },
  });
}

export async function HEAD(req: NextRequest) {
  return handleAudioStream(req, true);
}

export async function GET(req: NextRequest) {
  return handleAudioStream(req, false);
}

async function handleAudioStream(req: NextRequest, isHeadOnly: boolean) {
  const { searchParams } = new URL(req.url);
  let targetUrl = searchParams.get('url')?.trim() || '';
  const trackId = searchParams.get('trackId')?.trim() || searchParams.get('id')?.trim();

  // If trackId is provided, resolve remoteUrl from database
  if (!targetUrl && trackId) {
    try {
      const track = await prisma.audioTrack.findFirst({
        where: {
          OR: [{ id: trackId }, { trackId }],
        },
        select: { remoteUrl: true },
      });
      if (track?.remoteUrl) {
        targetUrl = track.remoteUrl;
      }
    } catch (err) {
      console.warn('[AudioStream] Error querying track from database:', err);
    }
  }

  if (!targetUrl) {
    return NextResponse.json(
      { error: 'Valid audio URL or trackId is required.' },
      { status: 400 }
    );
  }

  // Handle local simulation or localhost URLs
  if (targetUrl.includes('localhost:3000/api/admin/uploads/mock')) {
    return NextResponse.json(
      { error: 'This audio file was part of an uncommitted local mock upload and is no longer available.' },
      { status: 404 }
    );
  }

  if (!isAllowedUrl(targetUrl)) {
    return NextResponse.json(
      { error: 'Requested audio hostname is not authorized for streaming proxy.' },
      { status: 403 }
    );
  }

  // Forward client Range header if requested (vital for audio scrubbing & streaming)
  const clientRange = req.headers.get('range');
  const fetchHeaders: HeadersInit = {
    'User-Agent': 'SheikhZabuurAudioPlayer/1.0',
    Accept: 'audio/*,*/*',
  };
  if (clientRange) {
    fetchHeaders['Range'] = clientRange;
  }

  try {
    const upstreamRes = await fetch(targetUrl, {
      method: isHeadOnly ? 'HEAD' : 'GET',
      headers: fetchHeaders,
      redirect: 'follow',
      cache: 'no-store',
    });

    if (!upstreamRes.ok && upstreamRes.status !== 206) {
      console.warn(`[AudioStream] Upstream returned status ${upstreamRes.status} for ${targetUrl}`);
      return NextResponse.json(
        { error: `Upstream media server returned status ${upstreamRes.status}` },
        { status: upstreamRes.status }
      );
    }

    const responseHeaders = new Headers();
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    responseHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Range, Authorization, Accept');
    responseHeaders.set('Accept-Ranges', 'bytes');
    responseHeaders.set('Content-Type', upstreamRes.headers.get('content-type') || 'audio/mpeg');

    const contentLength = upstreamRes.headers.get('content-length');
    if (contentLength) responseHeaders.set('Content-Length', contentLength);

    const contentRange = upstreamRes.headers.get('content-range');
    if (contentRange) responseHeaders.set('Content-Range', contentRange);

    const etag = upstreamRes.headers.get('etag');
    if (etag) responseHeaders.set('ETag', etag);

    responseHeaders.set('Cache-Control', 'public, max-age=86400, s-maxage=86400');

    if (isHeadOnly) {
      return new NextResponse(null, {
        status: upstreamRes.status,
        headers: responseHeaders,
      });
    }

    return new NextResponse(upstreamRes.body, {
      status: upstreamRes.status,
      headers: responseHeaders,
    });
  } catch (err: unknown) {
    console.error('[AudioStream] Error fetching upstream audio:', err);
    return NextResponse.json(
      { error: 'Failed to stream audio from remote server.' },
      { status: 502 }
    );
  }
}
