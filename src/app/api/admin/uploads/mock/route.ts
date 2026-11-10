import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function PUT(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const key = searchParams.get('key') || 'unknown';

  // Read the stream to simulate payload reception without consuming memory
  try {
    const reader = req.body?.getReader();
    if (reader) {
      while (!(await reader.read()).done) {
        // stream through
      }
    }
  } catch (err) {
    console.warn('[Mock Upload] Error reading stream:', err);
  }

  return NextResponse.json({
    success: true,
    message: 'Mock upload accepted. In production, uploads stream directly to Cloudflare R2.',
    key,
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Content-Length',
    },
  });
}
