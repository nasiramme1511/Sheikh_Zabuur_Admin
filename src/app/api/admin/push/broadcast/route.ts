import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth';
import { recordAuditLog } from '@/lib/audit';
import { sendExpoPushNotifications, ExpoPushMessage } from '@/lib/push-notifications';

export const dynamic = 'force-dynamic';

const broadcastSchema = z.object({
  title: z.string().min(1, 'Notification title is required').max(100),
  body: z.string().min(1, 'Notification body message is required').max(500),
  targetAudience: z.enum(['all', 'ios', 'android']).default('all'),
  data: z.record(z.unknown()).optional(),
});

export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requirePermission('notifications:manage');
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const parseResult = broadcastSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parseResult.error.format() },
      { status: 400 }
    );
  }

  const { title, body: messageBody, targetAudience, data } = parseResult.data;

  // Build token query filter
  const where: { isActive: boolean; platform?: string } = { isActive: true };
  if (targetAudience === 'ios') where.platform = 'ios';
  if (targetAudience === 'android') where.platform = 'android';

  try {
    const devices = await prisma.pushDeviceToken.findMany({
      where,
      select: { token: true },
    });

    const totalTargeted = devices.length;

    let totalSent = 0;
    let totalFailed = 0;
    let status = 'sent';
    let errorMessage: string | null = null;

    if (totalTargeted > 0) {
      const messages: ExpoPushMessage[] = devices.map((d) => ({
        to: d.token,
        title,
        body: messageBody,
        data: data || undefined,
        sound: 'default',
      }));

      const result = await sendExpoPushNotifications(messages);
      totalSent = result.totalSent;
      totalFailed = result.totalFailed;

      if (result.errors.length > 0) {
        errorMessage = result.errors.slice(0, 3).join('; ');
      }
      if (totalSent === 0 && totalFailed > 0) {
        status = 'failed';
      }
    } else {
      // 0 registered devices currently in database
      status = 'sent';
      errorMessage = 'No active device tokens found matching target audience.';
    }

    const broadcast = await prisma.pushNotificationBroadcast.create({
      data: {
        title,
        body: messageBody,
        data: data ? JSON.parse(JSON.stringify(data)) : undefined,
        targetAudience,
        status,
        totalTargeted,
        totalSent,
        totalFailed,
        sentAt: new Date(),
        errorMessage,
        sentById: user.id,
      },
      include: {
        sentBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    await recordAuditLog({
      adminUserId: user.id,
      action: 'PUSH_NOTIFICATION_SENT',
      entityType: 'PushNotificationBroadcast',
      entityId: broadcast.id,
      ipAddress,
      userAgent,
      details: {
        title: broadcast.title,
        targetAudience: broadcast.targetAudience,
        totalTargeted,
        totalSent,
        totalFailed,
        status,
      },
    });

    return NextResponse.json({
      success: true,
      broadcast,
    });
  } catch (err) {
    console.error('[API Push Broadcast] Error:', err);
    return NextResponse.json(
      { error: 'Failed to broadcast push notification' },
      { status: 500 }
    );
  }
}
