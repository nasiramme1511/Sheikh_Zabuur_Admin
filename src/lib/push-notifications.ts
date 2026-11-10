import { prisma } from './prisma';

export interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default' | null;
  badge?: number;
  channelId?: string;
}

export interface ExpoPushTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

export function isExpoPushToken(token: string): boolean {
  return typeof token === 'string' && (
    (token.startsWith('ExponentPushToken[') && token.endsWith(']')) ||
    (token.startsWith('ExpoPushToken[') && token.endsWith(']'))
  );
}

/**
 * Sends a batch of push notifications using Expo's Push Notification Gateway.
 * Automatically splits batches into chunks of 100 (Expo maximum).
 */
export async function sendExpoPushNotifications(
  messages: ExpoPushMessage[]
): Promise<{ totalSent: number; totalFailed: number; errors: string[] }> {
  if (messages.length === 0) {
    return { totalSent: 0, totalFailed: 0, errors: [] };
  }

  const EXPO_CHUNK_SIZE = 100;
  const chunks: ExpoPushMessage[][] = [];

  for (let i = 0; i < messages.length; i += EXPO_CHUNK_SIZE) {
    chunks.push(messages.slice(i, i + EXPO_CHUNK_SIZE));
  }

  let totalSent = 0;
  let totalFailed = 0;
  const errors: string[] = [];
  const unregisteredTokens: string[] = [];

  for (const chunk of chunks) {
    try {
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(chunk),
      });

      if (!response.ok) {
        const errorText = await response.text();
        errors.push(`Expo API HTTP error ${response.status}: ${errorText}`);
        totalFailed += chunk.length;
        continue;
      }

      const resData = await response.json();
      const tickets: ExpoPushTicket[] = resData.data || [];

      tickets.forEach((ticket, idx) => {
        if (ticket.status === 'ok') {
          totalSent++;
        } else {
          totalFailed++;
          const errDetail = ticket.details?.error || ticket.message || 'Unknown push error';
          errors.push(errDetail);

          // If device is no longer registered, collect token to mark inactive
          if (errDetail === 'DeviceNotRegistered') {
            unregisteredTokens.push(chunk[idx].to);
          }
        }
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error';
      errors.push(msg);
      totalFailed += chunk.length;
    }
  }

  // Deactivate expired/uninstalled tokens
  if (unregisteredTokens.length > 0) {
    try {
      await prisma.pushDeviceToken.updateMany({
        where: { token: { in: unregisteredTokens } },
        data: { isActive: false },
      });
    } catch (err) {
      console.warn('[PushService] Failed to deactivate unregistered tokens:', err);
    }
  }

  return { totalSent, totalFailed, errors };
}
