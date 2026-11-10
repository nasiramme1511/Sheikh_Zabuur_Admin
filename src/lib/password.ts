import argon2 from 'argon2';

/**
 * Argon2id password hashing and verification.
 * Adheres to OWASP recommendations: Argon2id with 64 MB memory cost, 3 iterations, 4 parallelism lanes.
 */
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536, // 64 MB
    timeCost: 3,
    parallelism: 4,
  });
}

/**
 * Verifies a plain text password against an Argon2id hash.
 * Constant-time comparison handled internally by argon2.
 */
export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}
