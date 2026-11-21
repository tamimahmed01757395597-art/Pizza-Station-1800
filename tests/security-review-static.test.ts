import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function source(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf8');
}

describe('security review remediation shape', () => {
  it('makes delivery.update grantable in the API and staff UI (F8)', () => {
    expect(source('src/app/api/admin/permissions/route.ts')).toContain("'delivery.update'");
    expect(source('src/components/admin-workspace.tsx')).toContain("'delivery.update'");
  });

  it('enforces a nonce-based CSP without unsafe eval (F6)', () => {
    const middleware = source('src/middleware.ts');
    const config = source('next.config.ts');
    expect(middleware).toContain("response.headers.set('Content-Security-Policy'");
    expect(middleware).toContain("requestHeaders.set('x-nonce'");
    expect(middleware).not.toContain("'unsafe-eval'");
    expect(middleware).not.toContain("connect-src 'self' https: wss:");
    expect(config).not.toContain('Content-Security-Policy-Report-Only');
  });

  it('uses the reduced kitchen projection in every order API (F3)', () => {
    expect(source('src/app/api/admin/[resource]/route.ts')).toContain("rpc('get_kitchen_orders')");
    expect(source('src/app/api/orders/route.ts')).toContain("rpc('get_kitchen_orders')");
    const orderRoute = source('src/app/api/orders/[id]/route.ts');
    expect(orderRoute).toContain("rpc('get_kitchen_orders', { p_order_id: id })");
    expect(orderRoute).toContain("role !== 'kitchen' ? statusEmailRecipient");
    const migration = source('supabase/migrations/202611220001_security_review_remediation.sql');
    expect(migration).toContain('get_kitchen_orders');
    expect(migration).not.toContain("'customer_email'");
  });

  it('throttles direct RPC calls and fixes anonymous idempotency ownership (F2/F5)', () => {
    const migration = source('supabase/migrations/202611220001_security_review_remediation.sql');
    expect(migration).toContain('order_submission_throttle');
    expect(migration).toContain('and customer_id is null');
    expect(migration).toContain('email_confirmed_at');
    expect(migration).toContain('revoke all on function public.create_order(jsonb) from public');
  });
});
