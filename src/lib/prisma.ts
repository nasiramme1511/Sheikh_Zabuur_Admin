import { PrismaClient } from '@prisma/client';

declare global {
  var __prismaClient: PrismaClient | undefined;
}

/**
 * Creates and exports a singleton instance of PrismaClient.
 * In development, hot-reloading can cause multiple client instances to be created,
 * which exhausts connection pools. Storing it in globalThis prevents leaks.
 */
export const prisma =
  globalThis.__prismaClient ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['warn', 'error']
        : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prismaClient = prisma;
}

export default prisma;
