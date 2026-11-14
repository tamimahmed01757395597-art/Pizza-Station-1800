import { z } from 'zod';

export type IdempotencyCache = { current: { signature: string; key: string } | null };

export function idempotencyKey(signature: string, cache: IdempotencyCache, namespace = 'ps-checkout'): string {
  if (cache.current?.signature === signature) return cache.current.key;
  let key = '';
  try {
    const savedSignature = sessionStorage.getItem(`${namespace}-signature`);
    const savedKey = sessionStorage.getItem(`${namespace}-key`);
    if (savedSignature === signature && savedKey && z.string().uuid().safeParse(savedKey).success) key = savedKey;
  } catch (error) {
    console.error('Could not read the order retry key:', error);
  }
  if (!key) key = crypto.randomUUID();
  cache.current = { signature, key };
  try {
    sessionStorage.setItem(`${namespace}-signature`, signature);
    sessionStorage.setItem(`${namespace}-key`, key);
  } catch (error) {
    console.error('Could not save the order retry key:', error);
  }
  return key;
}

export async function payloadSignature(payload: unknown): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(payload)));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function clearIdempotencyKey(cache: IdempotencyCache, namespace = 'ps-checkout') {
  cache.current = null;
  try {
    sessionStorage.removeItem(`${namespace}-signature`);
    sessionStorage.removeItem(`${namespace}-key`);
  } catch (error) {
    console.error('Could not clear the order retry key:', error);
  }
}
