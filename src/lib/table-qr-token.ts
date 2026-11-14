import { randomBytes } from 'node:crypto';

export function createTableQrToken() {
  return randomBytes(32).toString('base64url');
}
