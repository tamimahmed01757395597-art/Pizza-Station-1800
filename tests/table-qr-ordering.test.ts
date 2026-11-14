import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  rpc: vi.fn(),
  sendOrderEmail: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}));
vi.mock('@/lib/notifications', () => ({
  sendOrderEmail: mocks.sendOrderEmail,
}));

import { POST as resolveTable } from '../src/app/api/tables/resolve/route';
import { POST as createOrder } from '../src/app/api/orders/route';
import { GET as getDineInOrderStatus } from '../src/app/api/table-orders/[id]/route';
import { createTableQrToken } from '../src/lib/table-qr-token';

const token = 'A'.repeat(43);
const validDineInOrder = {
  idempotency_key: 'f53d85d9-03d7-4974-979c-42d54c6b41f5',
  order_type: 'dine_in',
  payment_method: 'cash_at_restaurant',
  customer: { name: 'Taylor Guest', email: 'taylor@example.com', phone: '+15555550123' },
  table_token: token,
  items: [{
    product_id: '4782faba-e250-492f-a1e9-186d494a9486',
    quantity: 1,
  }],
};

function request(path: string, body: unknown) {
  return new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function statusRequest(id: string, tableToken: string) {
  return new Request(`http://localhost/api/table-orders/${id}`, {
    headers: { 'x-table-token': tableToken },
  });
}

describe('table QR ordering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createSupabaseServerClient.mockResolvedValue({ rpc: mocks.rpc });
    mocks.sendOrderEmail.mockResolvedValue(undefined);
  });

  it('creates a 256-bit URL-safe QR token', () => {
    const generated = createTableQrToken();
    expect(generated).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(generated, 'base64url')).toHaveLength(32);
  });

  it('rejects malformed or invalid tokens without returning a table number', async () => {
    const malformed = await resolveTable(request('/api/tables/resolve', { token: 'short' }));
    expect(malformed.status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();

    mocks.rpc.mockResolvedValue({
      data: null,
      error: { code: '22023', message: 'Table QR is invalid or not accepting orders' },
    });
    const invalid = await resolveTable(request('/api/tables/resolve', { token }));
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).not.toHaveProperty('table_number');
  });

  it.each([
    ['inactive table', 'Table QR is invalid or not accepting orders'],
    ['closed table session', 'Table QR is invalid or not accepting orders'],
  ])('does not resolve a QR for an %s', async (_scenario, message) => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: '22023', message } });
    const response = await resolveTable(request('/api/tables/resolve', { token }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'This table QR is invalid or is not accepting orders.' });
  });

  it('returns only the table number after server validation', async () => {
    mocks.rpc.mockResolvedValue({ data: { table_number: 'Table 7' }, error: null });
    const response = await resolveTable(request('/api/tables/resolve', { token }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ table_number: 'Table 7' });
    expect(mocks.rpc).toHaveBeenCalledWith('resolve_table_qr', { p_raw_token: token });
  });

  it('submits the QR token to the atomic order RPC and accepts a valid dine-in order', async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        id: '00bbfd5a-31f0-4b9d-9f22-6c790fb47fca',
        order_number: 'PS-20261114-0123456789AB',
        total: 14.5,
        duplicate: false,
      },
      error: null,
    });
    const response = await createOrder(request('/api/orders', validDineInOrder));
    expect(response.status).toBe(201);
    expect(mocks.rpc).toHaveBeenCalledWith('create_order', {
      p_payload: expect.objectContaining({ table_token: token }),
    });
    expect(mocks.rpc.mock.calls[0][1].p_payload).not.toHaveProperty('restaurant_table_id');
  });

  it('rejects an order when its table session closes before submission', async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { code: '22023', message: 'Table QR is invalid or the table session is closed' },
    });
    const response = await createOrder(request('/api/orders', validDineInOrder));
    expect(response.status).toBe(400);
  });

  it('requires the table token to read a guest order status', async () => {
    const invalid = await getDineInOrderStatus(statusRequest('00bbfd5a-31f0-4b9d-9f22-6c790fb47fca', 'bad'), {
      params: Promise.resolve({ id: '00bbfd5a-31f0-4b9d-9f22-6c790fb47fca' }),
    });
    expect(invalid.status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('returns only the QR-scoped dine-in receipt and status', async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        order_number: 'PS-20261114-0123456789AB',
        table_number: 'Table 7',
        status: 'preparing',
        payment_status: 'unpaid',
        total: 14.5,
        created_at: '2026-11-14T12:00:00Z',
        items: [{ name: 'Pizza', quantity: 1 }],
      },
      error: null,
    });
    const response = await getDineInOrderStatus(statusRequest('00bbfd5a-31f0-4b9d-9f22-6c790fb47fca', token), {
      params: Promise.resolve({ id: '00bbfd5a-31f0-4b9d-9f22-6c790fb47fca' }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      order_number: 'PS-20261114-0123456789AB',
      table_number: 'Table 7',
      status: 'preparing',
      payment_status: 'unpaid',
    });
    expect(mocks.rpc).toHaveBeenCalledWith('get_dine_in_order_status', {
      p_order_id: '00bbfd5a-31f0-4b9d-9f22-6c790fb47fca',
      p_raw_token: token,
    });
  });
});
