import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

interface DatabaseHealth {
  status: 'healthy' | 'unhealthy' | 'unconfigured';
  latencyMs?: number;
  message?: string;
}

interface HealthResponse {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  uptimeSeconds: number;
  environment: string;
  version: string;
  checks: {
    database: DatabaseHealth;
  };
}

export async function GET() {
  const startTime = Date.now();
  let dbHealth: DatabaseHealth = { status: 'unconfigured' };

  if (process.env.DATABASE_URL) {
    try {
      const dbStart = Date.now();
      // Lightweight connection ping without querying business tables
      await prisma.$queryRaw`SELECT 1`;
      const dbLatency = Date.now() - dbStart;

      dbHealth = {
        status: 'healthy',
        latencyMs: dbLatency,
      };
    } catch (err: unknown) {
      // Do not expose error stack traces or connection strings
      console.error('[Health Check] Database connectivity check failed:', err instanceof Error ? err.message : err);
      dbHealth = {
        status: 'unhealthy',
        message: 'Database service is currently unreachable',
      };
    }
  } else {
    dbHealth = {
      status: 'unconfigured',
      message: 'DATABASE_URL environment variable is not defined',
    };
  }

  const isHealthy = dbHealth.status === 'healthy';
  const isDegraded = dbHealth.status === 'unconfigured';

  const responseBody: HealthResponse = {
    status: isHealthy ? 'ok' : isDegraded ? 'degraded' : 'error',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV || 'development',
    version: '0.1.0-phase1',
    checks: {
      database: dbHealth,
    },
  };

  const httpStatus = isHealthy ? 200 : isDegraded ? 200 : 503;

  return NextResponse.json(responseBody, {
    status: httpStatus,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'X-Response-Time-Ms': (Date.now() - startTime).toString(),
    },
  });
}

