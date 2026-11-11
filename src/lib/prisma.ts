import { PrismaClient } from '@prisma/client';

declare global {
  var __prismaClient: PrismaClient | undefined;
}

/**
 * Sanitizes and optimizes the PostgreSQL connection URL for Serverless runtimes:
 * 1. Strips accidental surrounding quotes.
 * 2. Adds pgbouncer=true when targeting Neon / pgBouncer pooled hosts.
 * 3. Extends connection timeout to 15s to tolerate Neon compute cold starts.
 */
function getSanitizedDatabaseUrl(): string | undefined {
  let url = process.env.DATABASE_URL?.trim().replace(/^["'"]|["'"]$/g, '');
  if (!url) return undefined;

  // If using Neon pooler host and missing pgbouncer flag, append it
  if (url.includes('-pooler.') && !url.includes('pgbouncer=true')) {
    const separator = url.includes('?') ? '&' : '?';
    url = `${url}${separator}pgbouncer=true`;
  }

  // Extend connect_timeout to allow Neon compute cold start wakeup
  if (!url.includes('connect_timeout=')) {
    const separator = url.includes('?') ? '&' : '?';
    url = `${url}${separator}connect_timeout=15`;
  }

  return url;
}

const dbUrl = getSanitizedDatabaseUrl();

/**
 * Creates and exports a singleton instance of PrismaClient.
 * In serverless environments, connection instances are reused across function invocations.
 */
export const prisma =
  globalThis.__prismaClient ??
  new PrismaClient({
    datasources: dbUrl ? { db: { url: dbUrl } } : undefined,
    log:
      process.env.NODE_ENV === 'development'
        ? ['warn', 'error']
        : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prismaClient = prisma;
}

export default prisma;
