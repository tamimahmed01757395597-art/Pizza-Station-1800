import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetRateLimits } from '../src/lib/rate-limit';

const mocks = vi.hoisted(() => ({ getProfileRole: vi.fn() }));
vi.mock('@/lib/api', () => ({ getProfileRole: mocks.getProfileRole }));

import { statusEmailRecipient, verifiedOrderRecipient } from '../src/lib/email-recipients';

type SupabaseClient = Parameters<typeof verifiedOrderRecipient>[0];

function client(user: { id: string; email: string; email_confirmed_at: string | null } | null) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
    },
  } as unknown as SupabaseClient;
}

const verifiedUser = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'Customer@Example.com',
  email_confirmed_at: '2026-11-20T00:00:00Z',
};

describe('order email recipients', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRateLimits();
  });

  it('sends no confirmation email to a guest-supplied address (F4)', async () => {
    mocks.getProfileRole.mockResolvedValue(null);
    expect(await verifiedOrderRecipient(client(null), 'victim@example.com')).toBeNull();
  });

  it('sends no confirmation email to an unverified account (F4)', async () => {
    mocks.getProfileRole.mockResolvedValue('customer');
    const unverified = { ...verifiedUser, email_confirmed_at: null };
    expect(await verifiedOrderRecipient(client(unverified), 'victim@example.com')).toBeNull();
  });

  it('sends a customer confirmation only to the verified account address (F4)', async () => {
    mocks.getProfileRole.mockResolvedValue('customer');
    expect(await verifiedOrderRecipient(client(verifiedUser), 'victim@example.com')).toBe('customer@example.com');
  });

  it('does not let kitchen accounts choose an arbitrary confirmation address (F4)', async () => {
    mocks.getProfileRole.mockResolvedValue('kitchen');
    expect(await verifiedOrderRecipient(client(verifiedUser), 'victim@example.com')).toBe('customer@example.com');
  });

  it('lets an eligible staff member send to the address on a phone order (F4)', async () => {
    mocks.getProfileRole.mockResolvedValue('cashier');
    expect(await verifiedOrderRecipient(client(verifiedUser), ' Phone.Order@Example.com ')).toBe('phone.order@example.com');
  });

  it('sends status email only for registered-customer orders (F4)', () => {
    expect(statusEmailRecipient({ customer_id: null, customer_email: 'victim@example.com' })).toBeNull();
    expect(statusEmailRecipient({ customer_id: verifiedUser.id, customer_email: null })).toBeNull();
    expect(statusEmailRecipient({
      customer_id: verifiedUser.id,
      customer_email: 'Customer@Example.com',
    })).toBe('customer@example.com');
  });

  it('silently skips email after the per-recipient cap is reached (F4)', () => {
    const order = { customer_id: verifiedUser.id, customer_email: 'customer@example.com' };
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(statusEmailRecipient(order)).toBe('customer@example.com');
    }
    expect(statusEmailRecipient(order)).toBeNull();
  });
});
