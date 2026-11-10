import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth';
import { recordAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

const DEFAULT_SETTINGS = [
  {
    key: 'min_mobile_version',
    value: '1.0.0',
    description: 'Minimum required mobile application version to connect.',
    isPublic: true,
  },
  {
    key: 'maintenance_mode',
    value: 'false',
    description: 'When enabled, mobile app displays a maintenance alert.',
    isPublic: true,
  },
  {
    key: 'announcement_banner_enabled',
    value: 'true',
    description: 'Global toggle to display in-app announcement banners.',
    isPublic: true,
  },
  {
    key: 'cdn_cache_ttl_seconds',
    value: '86400',
    description: 'Catalog CDN caching TTL in seconds (default: 86400 = 24h).',
    isPublic: false,
  },
  {
    key: 'playback_streaming_enabled',
    value: 'true',
    description: 'Enable or disable direct CDN audio streaming in mobile app.',
    isPublic: true,
  },
];

export async function GET() {
  try {
    await requirePermission('settings:manage');
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Seed default settings if database table is empty
    const count = await prisma.systemSetting.count();
    if (count === 0) {
      await prisma.systemSetting.createMany({ data: DEFAULT_SETTINGS });
    }

    const settings = await prisma.systemSetting.findMany({
      orderBy: { key: 'asc' },
    });

    return NextResponse.json({ settings });
  } catch (err) {
    console.error('[API Settings GET] Error:', err);
    return NextResponse.json({ error: 'Failed to fetch system settings' }, { status: 500 });
  }
}

const updateSettingsSchema = z.object({
  settings: z.record(z.string()),
});

export async function PUT(req: NextRequest) {
  let user;
  try {
    user = await requirePermission('settings:manage');
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const parseResult = updateSettingsSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parseResult.error.format() },
      { status: 400 }
    );
  }

  const { settings } = parseResult.data;

  try {
    await prisma.$transaction(
      Object.entries(settings).map(([key, value]) =>
        prisma.systemSetting.upsert({
          where: { key },
          create: {
            key,
            value,
            isPublic: ['min_mobile_version', 'maintenance_mode', 'playback_streaming_enabled'].includes(key),
          },
          update: { value },
        })
      )
    );

    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    await recordAuditLog({
      adminUserId: user.id,
      action: 'SYSTEM_SETTINGS_UPDATED',
      entityType: 'SystemSetting',
      ipAddress,
      userAgent,
      details: { updatedKeys: Object.keys(settings) },
    });

    return NextResponse.json({ success: true, message: 'Settings saved successfully.' });
  } catch (err) {
    console.error('[API Settings PUT] Error:', err);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
