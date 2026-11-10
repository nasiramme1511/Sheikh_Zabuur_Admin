import { prisma } from './prisma';

export interface AuditLogOptions {
  adminUserId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  details?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Records a structured, non-repudiation audit event to the database.
 * Never throws exceptions that would interrupt the parent business transaction.
 */
export async function recordAuditLog(options: AuditLogOptions): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        adminUserId: options.adminUserId ?? null,
        action: options.action,
        entityType: options.entityType,
        entityId: options.entityId ?? null,
        details: options.details ? JSON.parse(JSON.stringify(options.details)) : undefined,
        ipAddress: options.ipAddress ?? null,
        userAgent: options.userAgent ?? null,
      },
    });
  } catch (err) {
    console.error('[AuditLog] Failed to record audit log:', err instanceof Error ? err.message : err);
  }
}
