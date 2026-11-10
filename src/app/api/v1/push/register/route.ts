import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const registerTokenSchema = z.object({
  token: z.string().min(1, 'Push token is required'),
  platform: z.enum(['ios', 'android', 'web', 'unknown']).default('unknown'),
  appVersion: z.string().optional(),
  deviceModel: z.string().optional(),
  locale: z.string().optional().default('am'),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const parseResult = registerTokenSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parseResult.error.format() },
      { status: 400 }
    );
  }

  const { token, platform, appVersion, deviceModel, locale } = parseResult.data;

  try {
    const deviceToken = await prisma.pushDeviceToken.upsert({
      where: { token },
      create: {
        token,
        platform,
        appVersion,
        deviceModel,
        locale,
        isActive: true,
        lastSeenAt: new Date(),
      },
      update: {
        platform,
        appVersion,
        deviceModel,
        locale,
        isActive: true,
        lastSeenAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      id: deviceToken.id,
      registeredAt: deviceToken.updatedAt.toISOString(),
    });
  } catch (err) {
    console.error('[Push Token Register] Error:', err);
    return NextResponse.json(
      { error: 'Failed to register push token' },
      { status: 500 }
    );
  }
}

