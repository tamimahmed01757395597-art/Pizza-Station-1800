import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { idempotencyKey, type IdempotencyCache } from '../src/lib/order-idempotency';

const firstKey = 'f53d85d9-03d7-4974-979c-42d54c6b41f5';
const secondKey = 'c0e0a1f5-f2d7-4a2d-b260-9993b18d8138';

describe('order retry keys', () => {
  let values: Map<string, string>;

  beforeEach(() => {
    values = new Map();
    vi.stubGlobal('sessionStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    });
    vi.stubGlobal('crypto', { randomUUID: vi.fn().mockReturnValueOnce(firstKey).mockReturnValue(secondKey) });
  });

  afterEach(() => vi.unstubAllGlobals());

  it('reuses a retry key for the same payload and rotates it when the payload changes', () => {
    const cache: IdempotencyCache = { current: null };
    expect(idempotencyKey('payload-a', cache, 'ps-table-order')).toBe(firstKey);
    expect(idempotencyKey('payload-a', cache, 'ps-table-order')).toBe(firstKey);
    expect(idempotencyKey('payload-b', cache, 'ps-table-order')).toBe(secondKey);
  });

  it('restores a matching key after the component cache is recreated', () => {
    const firstCache: IdempotencyCache = { current: null };
    idempotencyKey('payload-a', firstCache, 'ps-table-order');
    const restoredCache: IdempotencyCache = { current: null };
    expect(idempotencyKey('payload-a', restoredCache, 'ps-table-order')).toBe(firstKey);
  });
});
