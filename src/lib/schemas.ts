import { z } from 'zod';

const uuid = z.string().uuid();

/** Strip invisible control characters that can be used to smuggle payloads
 *  through logs, CSV exports or downstream systems. React already escapes
 *  rendered text; this is input normalization, not HTML sanitization. */
const clean = (value: string) => value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
const text = (max = 200) => z.string().trim().max(max).transform(clean)
  .refine((value) => value.length > 0, 'This field is required.');
const longText = (max: number) => z.string().trim().max(max).transform(clean);

export const registerSchema = z.object({
  name: text(120),
  email: z.string().trim().email().max(254),
  password: z.string().min(10).max(128),
  phone: longText(30).optional(),
}).strict();
export const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(128),
}).strict();
export const resetPasswordSchema = z.object({ email: z.string().trim().email().max(254) }).strict();
export const newPasswordSchema = z.object({ password: z.string().min(10).max(128) }).strict();
export const profileUpdateSchema = z.object({
  full_name: text(120).optional(),
  phone: longText(30).nullable().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, {
  message: 'At least one profile field must be provided.',
});

export const onboardingProfileSchema = z.object({
  full_name: text(120),
  phone: longText(30).optional(),
}).strict();

export const onboardingAddressSchema = z.object({
  label: text(40),
  recipient_name: text(120),
  recipient_phone: text(30),
  address_line1: text(200),
  address_line2: longText(200).optional(),
  locality: text(120),
  region: longText(120).optional(),
  postal_code: text(20),
  country_code: z.string().regex(/^[A-Z]{2}$/).default('BD'),
  delivery_instructions: longText(500).optional(),
}).strict();

export const onboardingSchema = onboardingProfileSchema.extend({
  address: onboardingAddressSchema.optional(),
}).strict();

export const productSchema = z.object({
  slug: z.string().trim().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: text(120),
  description: longText(2000).default(''),
  category_id: uuid.nullable().optional(),
  base_price: z.number().finite().nonnegative().max(100000),
  image_url: z.string().url().max(2048).refine((value) => new URL(value).protocol === 'https:').nullable().optional(),
  is_active: z.boolean().default(true),
  is_available: z.boolean().default(true),
  is_featured: z.boolean().default(false),
  variants: z.array(z.object({ name: text(80), price_delta: z.number().finite().nonnegative(), is_available: z.boolean().default(true) }).strict()).max(30).default([]),
  addons: z.array(z.object({ name: text(80), price: z.number().finite().nonnegative(), is_available: z.boolean().default(true) }).strict()).max(50).default([]),
}).strict();
export const productUpdateSchema = productSchema.partial().strict().refine((value) => Object.keys(value).length > 0, {
  message: 'At least one product field must be provided.',
});

export const orderSchema = z.object({
  idempotency_key: uuid,
  order_type: z.enum(['dine_in', 'delivery', 'pickup']),
  payment_method: z.enum(['cash_on_delivery', 'cash_at_restaurant']),
  customer: z.object({ name: text(120), email: z.string().trim().email().max(254), phone: text(30) }).strict(),
  address: longText(500).optional(),
  postal_code: longText(20).transform((value) => value.toUpperCase()).optional(),
  delivery_zone_id: uuid.optional(),
  table_token: z.string().regex(/^[A-Za-z0-9_-]{43}$/).optional(),
  coupon_code: text(40).optional(),
  notes: longText(1000).optional(),
  items: z.array(z.object({
    product_id: uuid,
    variant_id: uuid.optional(),
    addon_ids: z.array(uuid).max(30).default([]),
    quantity: z.number().int().min(1).max(20),
  }).strict()).min(1).max(50),
}).strict().superRefine((value, ctx) => {
  if (value.order_type === 'delivery' && (!value.address || !value.delivery_zone_id)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['address'], message: 'Delivery requires an address and delivery zone.' });
  }
  if (value.order_type === 'dine_in' && !value.table_token) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['table_token'], message: 'Dine-in requires a valid table token.' });
  }
  if (value.order_type === 'delivery' && value.payment_method !== 'cash_on_delivery') {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['payment_method'], message: 'Delivery orders must use cash on delivery.' });
  }
  if (value.order_type !== 'delivery' && value.payment_method !== 'cash_at_restaurant') {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['payment_method'], message: 'This order type must use cash at the restaurant.' });
  }
});

export const orderStatusSchema = z.object({
  status: z.enum(['confirmed', 'preparing', 'ready', 'served', 'completed', 'cancelled']),
}).strict();
export const paymentConfirmationSchema = z.object({
  status: z.enum(['paid', 'refunded']),
  amount: z.number().finite().positive().optional(),
  note: longText(500).optional(),
}).strict();
export const deliveryUpdateSchema = z.object({
  status: z.enum(['assigned', 'picked_up', 'delivered', 'failed']),
  delivery_staff_id: uuid.optional(),
}).strict();
