type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfter: number;
};

/** Remove only buckets whose window has already ended. Never clear live counters. */
function evictExpired(now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

/**
 * Fixed-window in-memory limiter. State lives in the current server instance, so
 * limits are per instance rather than global across a multi-instance deployment.
 * Use a shared store (Redis/Upstash) for multi-instance production deployments.
 */
export function checkRateLimit(key: string, limit: number, windowMs: number, now = Date.now()): RateLimitResult {
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    // At capacity we prefer to fail closed for the new caller rather than wipe
    // every existing counter; an attacker must not be able to flush the limiter
    // by generating many unique keys (F1).
    if (!bucket && buckets.size >= MAX_BUCKETS) {
      evictExpired(now);
      if (buckets.size >= MAX_BUCKETS) {
        return { allowed: false, limit, remaining: 0, retryAfter: Math.max(1, Math.ceil(windowMs / 1000)) };
      }
    }
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, limit, remaining: Math.max(0, limit - 1), retryAfter: 0 };
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    return {
      allowed: false,
      limit,
      remaining: 0,
      retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }

  return { allowed: true, limit, remaining: limit - bucket.count, retryAfter: 0 };
}

function looksLikeIp(value: string) {
  const trimmed = value.trim();
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(trimmed)) {
    const octets = trimmed.split('.').map(Number);
    return octets.every((octet) => octet >= 0 && octet <= 255) && octets[0] !== 0;
  }
  return /^[0-9a-fA-F:.]+$/.test(trimmed) && trimmed.includes(':');
}

/**
 * The only header names we are willing to trust, and only when the deployment
 * explicitly tells us which one its CDN/proxy overwrites on every request.
 * Nothing is trusted by default: a client-controlled `cf-connecting-ip` header
 * must never choose its own rate-limit bucket (F1).
 */
const TRUSTED_IP_HEADERS = new Set([
  'cf-connecting-ip',
  'x-vercel-forwarded-for',
  'fastly-client-ip',
  'x-real-ip',
  'x-forwarded-for',
]);

export function clientIp(request: Request) {
  const configured = process.env.RATE_LIMIT_IP_HEADER?.trim().toLowerCase();
  if (!configured || !TRUSTED_IP_HEADERS.has(configured)) return 'unknown';

  const raw = request.headers.get(configured);
  if (!raw) return 'unknown';

  if (configured === 'x-forwarded-for') {
    // A trusted proxy appends the real client as the last entry; never use the
    // attacker-controlled first entry.
    const entries = raw.split(',').map((entry) => entry.trim()).filter(Boolean);
    const last = entries.at(-1);
    return last && looksLikeIp(last) ? last : 'unknown';
  }

  return looksLikeIp(raw) ? raw.trim() : 'unknown';
}

/** Test-only helper: clears all limiter state between unit tests. */
export function resetRateLimits() {
  buckets.clear();
}
