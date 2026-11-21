import { afterEach, describe, expect, it } from 'vitest';
import { checkRateLimit, clientIp, resetRateLimits } from '../src/lib/rate-limit';

const originalIpHeader = process.env.RATE_LIMIT_IP_HEADER;

function restoreIpHeader() {
  if (originalIpHeader === undefined) delete process.env.RATE_LIMIT_IP_HEADER;
  else process.env.RATE_LIMIT_IP_HEADER = originalIpHeader;
}

describe('rate limiter', () => {
  afterEach(() => {
    resetRateLimits();
    restoreIpHeader();
  });

  it('allows requests up to the limit and blocks the next one', () => {
    const start = 1_000_000;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      expect(checkRateLimit('client:route', 3, 60_000, start + attempt).allowed).toBe(true);
    }
    const blocked = checkRateLimit('client:route', 3, 60_000, start + 3);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfter).toBe(60);
  });

  it('starts a fresh window after the window expires', () => {
    const start = 2_000_000;
    expect(checkRateLimit('client:route', 1, 1_000, start).allowed).toBe(true);
    expect(checkRateLimit('client:route', 1, 1_000, start + 500).allowed).toBe(false);
    expect(checkRateLimit('client:route', 1, 1_000, start + 1_001).allowed).toBe(true);
  });

  it('tracks separate keys independently', () => {
    expect(checkRateLimit('first', 1, 60_000, 3_000_000).allowed).toBe(true);
    expect(checkRateLimit('first', 1, 60_000, 3_000_001).allowed).toBe(false);
    expect(checkRateLimit('second', 1, 60_000, 3_000_001).allowed).toBe(true);
  });

  it('ignores all client-supplied IP headers when none is configured (F1)', () => {
    delete process.env.RATE_LIMIT_IP_HEADER;
    const request = new Request('http://localhost/api/auth/login', {
      headers: {
        'cf-connecting-ip': '203.0.113.10',
        'x-vercel-forwarded-for': '198.51.100.4',
        'fastly-client-ip': '192.0.2.7',
        'x-forwarded-for': '203.0.113.99',
      },
    });
    expect(clientIp(request)).toBe('unknown');
  });

  it('trusts only the one configured IP header (F1)', () => {
    const request = new Request('http://localhost/api/auth/login', {
      headers: {
        'cf-connecting-ip': '203.0.113.10',
        'x-vercel-forwarded-for': '198.51.100.4',
      },
    });
    process.env.RATE_LIMIT_IP_HEADER = 'x-vercel-forwarded-for';
    expect(clientIp(request)).toBe('198.51.100.4');
  });

  it('uses the last X-Forwarded-For entry and rejects malformed values (F1)', () => {
    const request = new Request('http://localhost/api/auth/login', {
      headers: { 'x-forwarded-for': '203.0.113.10, 198.51.100.4' },
    });
    process.env.RATE_LIMIT_IP_HEADER = 'x-forwarded-for';
    expect(clientIp(request)).toBe('198.51.100.4');

    const malformed = new Request('http://localhost/api/auth/login', {
      headers: { 'x-forwarded-for': 'not-an-ip' },
    });
    expect(clientIp(malformed)).toBe('unknown');
  });

  it('fails closed at bucket capacity instead of flushing live counters (F1)', () => {
    const start = 4_000_000;
    for (let index = 0; index < 10_000; index += 1) {
      checkRateLimit(`client-${index}`, 1, 60_000, start);
    }
    expect(checkRateLimit('client-0', 1, 60_000, start).allowed).toBe(false);
    expect(checkRateLimit('newcomer', 1, 60_000, start).allowed).toBe(false);
    // The existing bucket was not wiped when the newcomer was refused.
    expect(checkRateLimit('client-1', 1, 60_000, start).allowed).toBe(false);
  });

  it('evicts expired buckets individually and accepts new callers (F1)', () => {
    const start = 5_000_000;
    for (let index = 0; index < 10_000; index += 1) {
      checkRateLimit(`old-${index}`, 1, 1_000, start);
    }
    expect(checkRateLimit('fresh', 1, 1_000, start + 1_001).allowed).toBe(true);
  });
});
