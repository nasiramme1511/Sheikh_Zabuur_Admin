/**
 * High-performance, in-memory sliding-window rate limiter for API endpoints.
 *
 * Tracks request timestamps per key (e.g. IP address or user ID) and enforces
 * rate limits over a configurable time window. Includes automatic garbage collection
 * to prevent memory leaks in long-running processes.
 */

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum allowed requests within window
}

interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTimeMs: number;
  retryAfterSeconds?: number;
}

export class RateLimiter {
  private readonly windowMs: number;
  private readonly maxRequests: number;
  private readonly hits = new Map<string, number[]>();
  private lastCleanup = Date.now();
  private readonly cleanupIntervalMs = 60 * 1000; // Cleanup every 60s

  constructor(config: RateLimitConfig) {
    this.windowMs = config.windowMs;
    this.maxRequests = config.maxRequests;
  }

  /**
   * Check if a request key is within limit, and record the hit if allowed.
   */
  public check(key: string): RateLimitResult {
    const now = Date.now();
    this.maybeCleanup(now);

    const windowStart = now - this.windowMs;
    const timestamps = (this.hits.get(key) || []).filter((ts) => ts > windowStart);

    if (timestamps.length >= this.maxRequests) {
      const oldestInWindow = timestamps[0] || now;
      const resetTimeMs = oldestInWindow + this.windowMs;
      const retryAfterSeconds = Math.max(1, Math.ceil((resetTimeMs - now) / 1000));

      return {
        allowed: false,
        limit: this.maxRequests,
        remaining: 0,
        resetTimeMs,
        retryAfterSeconds,
      };
    }

    // Record this hit
    timestamps.push(now);
    this.hits.set(key, timestamps);

    const resetTimeMs = (timestamps[0] || now) + this.windowMs;

    return {
      allowed: true,
      limit: this.maxRequests,
      remaining: Math.max(0, this.maxRequests - timestamps.length),
      resetTimeMs,
    };
  }

  /**
   * Periodically remove keys that have no timestamps in the current window.
   */
  private maybeCleanup(now: number): void {
    if (now - this.lastCleanup < this.cleanupIntervalMs) {
      return;
    }
    this.lastCleanup = now;
    const windowStart = now - this.windowMs;

    for (const [key, timestamps] of this.hits.entries()) {
      const valid = timestamps.filter((ts) => ts > windowStart);
      if (valid.length === 0) {
        this.hits.delete(key);
      } else {
        this.hits.set(key, valid);
      }
    }
  }
}

/**
 * Pre-configured rate limiters for key application surfaces:
 */

// 1. Strict rate limiter for admin authentication (e.g. 10 attempts per minute per IP)
export const authRateLimiter = new RateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 10,
});

// 2. Sensitive admin mutation endpoints (e.g. 30 requests per minute per IP)
export const adminActionRateLimiter = new RateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 30,
});

// 3. Public mobile push token registration (e.g. 20 requests per minute per IP)
export const publicPushRateLimiter = new RateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 20,
});

// 4. Public catalog endpoints (e.g. 120 requests per minute per IP)
export const publicCatalogRateLimiter = new RateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 120,
});

