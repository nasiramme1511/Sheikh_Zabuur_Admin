import { z } from 'zod';

/**
 * Trims whitespace and strips surrounding double/single quotes if present.
 * Converts empty strings to undefined so optional/defaultable Zod schemas handle them cleanly.
 */
function cleanEnvValue(val: unknown): unknown {
  if (typeof val !== 'string') return val;
  const trimmed = val.trim().replace(/^["']|["']$/g, '').trim();
  return trimmed === '' ? undefined : trimmed;
}

/**
 * Server-side environment variables schema.
 * All variables here are strictly isolated to Node.js server runtime
 * and are NEVER exposed to browser-side bundles.
 */
const serverEnvSchema = z.object({
  NODE_ENV: z
    .preprocess(cleanEnvValue, z.enum(['development', 'test', 'production']).default('development')),
  DATABASE_URL: z.preprocess(
    cleanEnvValue,
    z
      .string()
      .min(1, 'DATABASE_URL is required')
      .refine(
        (url) => url.startsWith('postgresql://') || url.startsWith('postgres://'),
        'DATABASE_URL must be a valid PostgreSQL connection string'
      )
  ),
  APP_URL: z
    .preprocess(cleanEnvValue, z.string().url().optional())
    .default('http://localhost:3000'),
  AUTH_SECRET: z.preprocess(cleanEnvValue, z.string().optional()),

  // Storage placeholders (provider-agnostic)
  STORAGE_PROVIDER: z.preprocess(cleanEnvValue, z.string().optional()).default('s3-compatible'),
  STORAGE_BUCKET_NAME: z.preprocess(cleanEnvValue, z.string().optional()),
  STORAGE_ENDPOINT: z.preprocess(cleanEnvValue, z.string().optional()),
  STORAGE_ACCESS_KEY_ID: z.preprocess(cleanEnvValue, z.string().optional()),
  STORAGE_SECRET_ACCESS_KEY: z.preprocess(cleanEnvValue, z.string().optional()),
  STORAGE_PUBLIC_BASE_URL: z.preprocess(cleanEnvValue, z.string().url().optional()),
});

/**
 * Client-side environment variables schema (prefixed with NEXT_PUBLIC_).
 * Empty for Phase 1 to guarantee zero credential leakage.
 */
const clientEnvSchema = z.object({
  NEXT_PUBLIC_APP_NAME: z.preprocess(cleanEnvValue, z.string().optional()).default('Sheikh Zabuur Admin'),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type ClientEnv = z.infer<typeof clientEnvSchema>;

let parsedServerEnv: ServerEnv | null = null;

/**
 * Safely parses and validates server-side environment variables.
 * Falls back gracefully to prevent runtime server crashes while logging configuration issues.
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

    console.error(
      `⚠️ Environment configuration warning:\n${formattedErrors}\nFalling back to sanitized environment variables.`
    );

    // Provide safe defaults so routes do not hard crash
    parsedServerEnv = {
      NODE_ENV: (cleanEnvValue(process.env.NODE_ENV) as 'development' | 'test' | 'production') || 'development',
      DATABASE_URL: (cleanEnvValue(process.env.DATABASE_URL) as string) || '',
      APP_URL: (cleanEnvValue(process.env.APP_URL) as string) || 'http://localhost:3000',
      AUTH_SECRET: cleanEnvValue(process.env.AUTH_SECRET) as string | undefined,
      STORAGE_PROVIDER: (cleanEnvValue(process.env.STORAGE_PROVIDER) as string) || 's3-compatible',
      STORAGE_BUCKET_NAME: cleanEnvValue(process.env.STORAGE_BUCKET_NAME) as string | undefined,
      STORAGE_ENDPOINT: cleanEnvValue(process.env.STORAGE_ENDPOINT) as string | undefined,
      STORAGE_ACCESS_KEY_ID: cleanEnvValue(process.env.STORAGE_ACCESS_KEY_ID) as string | undefined,
      STORAGE_SECRET_ACCESS_KEY: cleanEnvValue(process.env.STORAGE_SECRET_ACCESS_KEY) as string | undefined,
      STORAGE_PUBLIC_BASE_URL: cleanEnvValue(process.env.STORAGE_PUBLIC_BASE_URL) as string | undefined,
    };

    return parsedServerEnv;
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
