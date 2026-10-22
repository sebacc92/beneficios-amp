import type { RequestEventBase } from "@builder.io/qwik-city";

/**
 * Fixed-window rate limiter kept in process memory.
 *
 * IMPORTANT: serverless/edge runs many isolated instances, so a client can get up
 * to `limit` requests *per instance*. This is a mitigation against trivial abuse
 * (scripted loops against the OpenAI endpoint, coupon/login brute force), not a
 * hard guarantee. Move the buckets to Turso or Vercel KV if you need exact limits.
 */
interface Bucket {
  count: number;
  resetAt: number;
}

const globalStore = globalThis as unknown as { __rateLimitBuckets?: Map<string, Bucket> };
if (!globalStore.__rateLimitBuckets) {
  globalStore.__rateLimitBuckets = new Map<string, Bucket>();
}
const buckets = globalStore.__rateLimitBuckets;

// Bounded so a flood of unique keys cannot grow the map without limit.
const MAX_TRACKED_KEYS = 5000;

function pruneExpired(now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Seconds until the window resets. */
  retryAfter: number;
}

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    if (buckets.size >= MAX_TRACKED_KEYS) pruneExpired(now);
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfter: 0 };
  }

  existing.count += 1;
  const retryAfter = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
  if (existing.count > limit) {
    return { allowed: false, remaining: 0, retryAfter };
  }
  return { allowed: true, remaining: limit - existing.count, retryAfter };
}

/** Best-effort client IP, preferring the platform value over spoofable headers. */
export function clientIp(event: RequestEventBase): string {
  const platformIp = event.clientConn?.ip;
  if (platformIp) return platformIp;

  const forwarded = event.request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();

  return event.request.headers.get("x-real-ip") ?? "unknown";
}

/** Convenience wrapper: one limiter key per bucket name + client IP. */
export function rateLimitByIp(
  event: RequestEventBase,
  bucket: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  return rateLimit(`${bucket}:${clientIp(event)}`, limit, windowMs);
}
