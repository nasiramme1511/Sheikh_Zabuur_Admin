import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isStorageConfigured } from '@/lib/storage';

export const dynamic = 'force-dynamic';

interface DatabaseHealth {
  status: 'healthy' | 'unhealthy' | 'unconfigured';
  latencyMs?: number;
  message?: string;
}

interface StorageHealth {
  status: 'configured' | 'simulation_mode';
  provider: 's3_compatible' | 'local_simulated';
}

interface CatalogHealth {
  activeReleaseVersion?: string;
  totalTracks?: number;
  publishedAt?: string;
}

interface SystemMetrics {
  uptimeSeconds: number;
  memoryUsageMb: {
    heapUsed: number;
    heapTotal: number;
    rss: number;
  };
}

interface HealthResponse {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  environment: string;
  version: string;
  checks: {
    database: DatabaseHealth;
    storage: StorageHealth;
    catalog: CatalogHealth;
  };
  system: SystemMetrics;
}

export async function GET() {
  try {
  const startTime = Date.now();
  let dbHealth: DatabaseHealth = { status: 'unconfigured' };
  let catalogHealth: CatalogHealth = {};

  // 1. Database Connectivity & Ping
  if (process.env.DATABASE_URL) {
    try {
      const dbStart = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      const dbLatency = Date.now() - dbStart;

      dbHealth = {
        status: 'healthy',
        latencyMs: dbLatency,
      };

      // Retrieve active release metadata for health report
      const activeRelease = await prisma.catalogRelease.findFirst({
        where: { status: 'published' },
        orderBy: { publishedAt: 'desc' },
        select: {
          version: true,
          totalTracks: true,
          publishedAt: true,
        },
      });

      if (activeRelease) {
        catalogHealth = {
          activeReleaseVersion: activeRelease.version,
          totalTracks: activeRelease.totalTracks,
          publishedAt: activeRelease.publishedAt?.toISOString(),
        };
      }
    } catch (err: unknown) {
      console.error('[Health Check] Database check failed:', err instanceof Error ? err.message : err);
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

  // 2. Storage System Health
  const storageConfigured = isStorageConfigured();
  const storageHealth: StorageHealth = {
    status: storageConfigured ? 'configured' : 'simulation_mode',
    provider: storageConfigured ? 's3_compatible' : 'local_simulated',
  };

  // 3. System Memory & Metrics
  const mem = process.memoryUsage();
  const systemMetrics: SystemMetrics = {
    uptimeSeconds: Math.floor(process.uptime()),
    memoryUsageMb: {
      heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
      rss: Math.round(mem.rss / 1024 / 1024),
    },
  };

  const isHealthy = dbHealth.status === 'healthy';
  const isDegraded = dbHealth.status === 'unconfigured';

  const responseBody: HealthResponse = {
    status: isHealthy ? 'ok' : isDegraded ? 'degraded' : 'error',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0',
    checks: {
      database: dbHealth,
      storage: storageHealth,
      catalog: catalogHealth,
    },
    system: systemMetrics,
  };

  const httpStatus = isHealthy ? 200 : isDegraded ? 200 : 503;

  return NextResponse.json(responseBody, {
    status: httpStatus,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'X-Response-Time-Ms': (Date.now() - startTime).toString(),
    },
  });
  } catch (fatalErr) {
    console.error('[Health Fatal Error]', fatalErr);
    return NextResponse.json(
      {
        status: 'error',
        error: fatalErr instanceof Error ? fatalErr.message : String(fatalErr),
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
