import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { isStorageConfigured } from '@/lib/storage';
import { getServerEnv } from '@/lib/env';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const env = getServerEnv();
  const configured = isStorageConfigured();

  return NextResponse.json({
    configured,
    provider: env.STORAGE_PROVIDER || 's3-compatible',
    bucket: env.STORAGE_BUCKET_NAME || 'Not configured',
    endpoint: env.STORAGE_ENDPOINT ? 'Configured' : 'Default / Auto',
    publicBaseUrl: env.STORAGE_PUBLIC_BASE_URL || 'https://cdn.sheikhzabur.com',
  });
}

