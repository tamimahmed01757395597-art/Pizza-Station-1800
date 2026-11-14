import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiError, parseJson, requireRole } from '@/lib/api';

type Context = { params: Promise<{ resource: string; id: string }> };
const categoryUpdate = z.object({ name: z.string().trim().min(1).max(100).optional(), slug: z.string().trim().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(), sort_order: z.number().int().optional(), is_active: z.boolean().optional() }).strict();
const couponUpdate = z.object({
  code: z.string().trim().min(2).max(40).transform((value) => value.toUpperCase()).optional(),
  discount_type: z.enum(['percent', 'fixed']).optional(),
  discount_value: z.number().positive().max(100000).optional(),
  minimum_order: z.number().nonnegative().optional(),
  maximum_discount: z.number().nonnegative().nullable().optional(),
  usage_limit: z.number().int().nonnegative().nullable().optional(),
  starts_at: z.string().datetime().nullable().optional(),
  ends_at: z.string().datetime().nullable().optional(),
  is_active: z.boolean().optional(),
}).strict().superRefine((value, ctx) => {
  if (value.discount_type === 'percent' && value.discount_value !== undefined && value.discount_value > 100) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['discount_value'], message: 'Percentage cannot exceed 100.' });
  }
  if (value.starts_at && value.ends_at && value.starts_at >= value.ends_at) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['ends_at'], message: 'End date must be after start date.' });
  }
});
const zoneUpdate = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  fee: z.number().nonnegative().optional(),
  minimum_order: z.number().nonnegative().optional(),
  postal_codes: z.array(z.string().trim().min(1).max(20).transform((value) => value.toUpperCase())).max(500).optional(),
  is_active: z.boolean().optional(),
}).strict();
const profileUpdate = z.object({ full_name: z.string().trim().min(1).max(120).optional(), phone: z.string().trim().max(30).nullable().optional() }).strict();
const roleSchema = z.object({ role: z.enum(['customer', 'manager', 'cashier', 'delivery', 'kitchen']) }).strict();
const inventoryItemUpdate = z.object({
  reorder_level: z.number().int().min(0).max(1000000).optional(),
  sku: z.string().trim().max(100).nullable().optional(),
  unit: z.string().trim().min(1).max(30).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, {
  message: 'At least one inventory field is required.',
});

export async function PATCH(request: Request, { params }: Context) {
  try {
    const { resource, id } = await params;
    if (resource !== 'settings') {
      const parsedId = z.string().uuid().safeParse(id);
      if (!parsedId.success) return NextResponse.json({ error: 'A valid resource ID is required.' }, { status: 400 });
    }
    const { supabase, user, role } = await requireRole(resource === 'inventory'
      ? ['admin', 'manager', 'cashier', 'kitchen', 'delivery']
      : ['admin', 'manager']);
    if (resource === 'inventory') {
      const { data: authorized, error: authorizationError } = await supabase.rpc('has_staff_permission', { p_permission_key: 'inventory.manage' });
      if (authorizationError) throw authorizationError;
      if (authorized !== true) return NextResponse.json({ error: 'Inventory management permission required.' }, { status: 403 });
      const body = await parseJson(request, inventoryItemUpdate);
      const { data, error } = await supabase.from('inventory_items').update(body).eq('id', id)
        .select('id,product_id,product_name_snapshot,sku,is_tracked,quantity_on_hand,reorder_level,unit,updated_at').maybeSingle();
      if (error) throw error;
      if (!data) return NextResponse.json({ error: 'Inventory item not found.' }, { status: 404 });
      return NextResponse.json({ inventory: data });
    }
    if (resource === 'categories') {
      const body = await parseJson(request, categoryUpdate);
      if (Object.keys(body).length === 0) return NextResponse.json({ error: 'At least one category field is required.' }, { status: 400 });
      const { data, error } = await supabase.from('categories').update(body).eq('id', id).select().single();
      if (error) throw error;
      return NextResponse.json({ category: data });
    }
    if (resource === 'coupons') {
      const body = await parseJson(request, couponUpdate);
      if (Object.keys(body).length === 0) return NextResponse.json({ error: 'At least one coupon field is required.' }, { status: 400 });
      const { data, error } = await supabase.from('coupons').update(body).eq('id', id).select().single();
      if (error) throw error;
      return NextResponse.json({ coupon: data });
    }
    if (resource === 'zones') {
      const body = await parseJson(request, zoneUpdate);
      if (Object.keys(body).length === 0) return NextResponse.json({ error: 'At least one zone field is required.' }, { status: 400 });
      const { data, error } = await supabase.from('delivery_zones').update(body).eq('id', id).select().single();
      if (error) throw error;
      return NextResponse.json({ zone: data });
    }
    if (resource === 'customers') {
      if (role !== 'admin') return NextResponse.json({ error: 'Only admins can manage customers.' }, { status: 403 });
      const body = await parseJson(request, profileUpdate);
      if (body.full_name === undefined && body.phone === undefined) return NextResponse.json({ error: 'No customer fields supplied.' }, { status: 400 });
      const { data, error } = await supabase.from('profiles').update(body).eq('id', id).eq('role', 'customer').select('id,email,full_name,phone').single();
      if (error) throw error;
      return NextResponse.json({ customer: data });
    }
    if (resource === 'staff') {
      if (role !== 'admin') return NextResponse.json({ error: 'Only admins can manage staff roles.' }, { status: 403 });
      if (id === user.id) return NextResponse.json({ error: 'You cannot change your own staff role.' }, { status: 400 });
      const { role: staffRole } = await parseJson(request, roleSchema);
      const { data, error } = await supabase.from('profiles').update({ role: staffRole }).eq('id', id).select('id,email,role').single();
      if (error) throw error;
      return NextResponse.json({ staff: data });
    }
    if (resource === 'products') {
      return NextResponse.json({ error: 'Use the product management endpoint.' }, { status: 405 });
    }
    return NextResponse.json({ error: 'This admin resource does not support updates.' }, { status: 405 });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_request: Request, { params }: Context) {
  try {
    const { resource, id } = await params;
    if (!z.string().uuid().safeParse(id).success) {
      return NextResponse.json({ error: 'A valid resource ID is required.' }, { status: 400 });
    }
    const { supabase, role } = await requireRole(['admin', 'manager']);
    if (resource === 'categories') {
      const { error } = await supabase.from('categories').delete().eq('id', id);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }
    if (resource === 'coupons') {
      const { error } = await supabase.from('coupons').delete().eq('id', id);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }
    if (resource === 'zones') {
      const { error } = await supabase.from('delivery_zones').delete().eq('id', id);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }
    if (resource === 'staff') {
      if (role !== 'admin') return NextResponse.json({ error: 'Only admins can manage staff roles.' }, { status: 403 });
      const { error } = await supabase.from('profiles').update({ role: 'customer' }).eq('id', id).neq('role', 'admin');
      if (error) throw error;
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: 'This admin resource cannot be deleted.' }, { status: 405 });
  } catch (error) {
    return apiError(error);
  }
}
