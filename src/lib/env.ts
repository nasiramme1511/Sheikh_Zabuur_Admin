import { z } from 'zod';

/**
 * Server-side environment variables schema.
 * All variables here are strictly isolated to Node.js server runtime
 * and are NEVER exposed to browser-side bundles.
 */
const serverEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL is required')
    .refine(
      (url) => url.startsWith('postgresql://') || url.startsWith('postgres://'),
      'DATABASE_URL must be a valid PostgreSQL connection string'
    ),
  APP_URL: z.string().url().optional().default('http://localhost:3000'),
  AUTH_SECRET: z
    .string()
    .min(32, 'AUTH_SECRET must be at least 32 characters in production')
    .optional(),

  // Storage placeholders (provider-agnostic)
  STORAGE_PROVIDER: z.string().optional().default('s3-compatible'),
  STORAGE_BUCKET_NAME: z.string().optional(),
  STORAGE_ENDPOINT: z.string().optional(),
  STORAGE_ACCESS_KEY_ID: z.string().optional(),
  STORAGE_SECRET_ACCESS_KEY: z.string().optional(),
  STORAGE_PUBLIC_BASE_URL: z.string().url().optional(),
});

/**
 * Client-side environment variables schema (prefixed with NEXT_PUBLIC_).
 * Empty for Phase 1 to guarantee zero credential leakage.
 */
const clientEnvSchema = z.object({
  NEXT_PUBLIC_APP_NAME: z.string().optional().default('Sheikh Zabuur Admin'),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type ClientEnv = z.infer<typeof clientEnvSchema>;

let parsedServerEnv: ServerEnv | null = null;

/**
 * Safely parses and validates server-side environment variables.
 * Throws a formatted error if required variables are missing or invalid.
 */
export function getServerEnv(): ServerEnv {
  if (parsedServerEnv) {
    return parsedServerEnv;
  }

  const result = serverEnvSchema.safeParse(process.env);

  if (!result.success) {
    const formattedErrors = result.error.errors
      .map((err) => `  - ${err.path.join('.')}: ${err.message}`)
      .join('\n');

    throw new Error(
      `❌ Invalid or missing server environment configuration:\n${formattedErrors}\n\nPlease check your .env file against .env.example.`
    );
  }

  parsedServerEnv = result.data;
  return parsedServerEnv;
}

/**
 * Validates client-side environment variables safely.
 */
export function getClientEnv(): ClientEnv {
  const result = clientEnvSchema.safeParse({
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
  });

  if (!result.success) {
    console.warn('⚠️ Invalid client environment configuration:', result.error.format());
    return { NEXT_PUBLIC_APP_NAME: 'Sheikh Zabuur Admin' };
  }

  return result.data;
}

