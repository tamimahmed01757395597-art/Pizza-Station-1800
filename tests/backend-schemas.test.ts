import { describe, expect, it } from 'vitest';
import { orderSchema, orderStatusSchema, productSchema, registerSchema } from '../src/lib/schemas';

const validOrder = {
  idempotency_key: 'f53d85d9-03d7-4974-979c-42d54c6b41f5',
  order_type: 'pickup',
  payment_method: 'cash_at_restaurant',
  customer: { name: 'Taylor Guest', email: 'taylor@example.com', phone: '+15555550123' },
  items: [{
    product_id: '4782faba-e250-492f-a1e9-186d494a9486',
    quantity: 2,
  }],
};

describe('backend request schemas', () => {
  it('rejects role injection during customer registration', () => {
    const result = registerSchema.safeParse({
      name: 'Taylor',
      email: 'taylor@example.com',
      password: 'a-long-password',
      role: 'admin',
    });
    expect(result.success).toBe(false);
  });

  it('accepts a priced-by-server order shape and rejects client totals', () => {
    expect(orderSchema.safeParse(validOrder).success).toBe(true);
    expect(orderSchema.safeParse({ ...validOrder, total: 0, subtotal: 0 }).success).toBe(false);
  });

  it('requires delivery-zone selection and cash on delivery for delivery orders', () => {
    const delivery = {
      ...validOrder,
      order_type: 'delivery',
      payment_method: 'cash_at_restaurant',
      address: '15 Station Road',
    };
    expect(orderSchema.safeParse(delivery).success).toBe(false);
    const parsed = orderSchema.safeParse({
      ...delivery,
      payment_method: 'cash_on_delivery',
      delivery_zone_id: '19b312d6-7d01-4fe9-82cb-12d116f90924',
      postal_code: 'ab12 3cd',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.postal_code).toBe('AB12 3CD');
  });

  it('requires a table token for dine-in orders', () => {
    const dineIn = { ...validOrder, order_type: 'dine_in' };
    expect(orderSchema.safeParse(dineIn).success).toBe(false);
    expect(orderSchema.safeParse({ ...dineIn, table_token: 'A'.repeat(43) }).success).toBe(true);
    expect(orderSchema.safeParse({ ...dineIn, table_token: 'short-token' }).success).toBe(false);
  });

  it('accepts the served step in the dine-in order lifecycle', () => {
    expect(orderStatusSchema.safeParse({ status: 'served' }).success).toBe(true);
    expect(orderStatusSchema.safeParse({ status: 'accepted' }).success).toBe(false);
  });

  it('rejects negative product prices and client-chosen option identifiers', () => {
    const product = {
      slug: 'garden-pizza',
      name: 'Garden Pizza',
      base_price: 12.5,
    };
    expect(productSchema.safeParse(product).success).toBe(true);
    expect(productSchema.safeParse({ ...product, base_price: -1 }).success).toBe(false);
    expect(productSchema.safeParse({ ...product, price: 0.01 }).success).toBe(false);
    expect(productSchema.safeParse({
      ...product,
      variants: [{ name: 'Large', price_delta: -1 }],
    }).success).toBe(false);
  });
});
