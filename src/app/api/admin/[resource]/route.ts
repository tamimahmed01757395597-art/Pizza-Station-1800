import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiError, parseJson, requireRole } from '@/lib/api';

type Context = { params: Promise<{ resource: string }> };
const slug = z.string().trim().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const categorySchema = z.object({ name: z.string().trim().min(1).max(100), slug, sort_order: z.number().int().default(0), is_active: z.boolean().default(true) }).strict();
const couponSchema = z.object({
  code: z.string().trim().min(2).max(40).transform((value) => value.toUpperCase()),
  discount_type: z.enum(['percent', 'fixed']),
  discount_value: z.number().positive().max(100000),
  minimum_order: z.number().nonnegative().default(0),
  maximum_discount: z.number().nonnegative().nullable().optional(),
  usage_limit: z.number().int().nonnegative().nullable().optional(),
  starts_at: z.string().datetime().nullable().optional(),
  ends_at: z.string().datetime().nullable().optional(),
  is_active: z.boolean().default(true),
}).strict().superRefine((value, ctx) => {
  if (value.discount_type === 'percent' && value.discount_value > 100) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['discount_value'], message: 'Percentage cannot exceed 100.' });
  }
  if (value.starts_at && value.ends_at && value.starts_at >= value.ends_at) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['ends_at'], message: 'End date must be after start date.' });
  }
});
const zoneSchema = z.object({
  name: z.string().trim().min(1).max(100),
  fee: z.number().nonnegative(),
  minimum_order: z.number().nonnegative().default(0),
  postal_codes: z.array(z.string().trim().min(1).max(20).transform((value) => value.toUpperCase())).max(500).default([]),
  is_active: z.boolean().default(true),
}).strict();
const roleSchema = z.enum(['customer', 'manager', 'cashier', 'delivery', 'kitchen']);
const staffAssignmentSchema = z.object({ id: z.string().uuid(), role: z.enum(['manager', 'cashier', 'delivery', 'kitchen']) }).strict();
const customerSchema = z.object({ id: z.string().uuid(), full_name: z.string().trim().min(1).max(120).optional(), phone: z.string().trim().max(30).nullable().optional() }).strict();
const inventorySchema = z.object({ product_id: z.string().uuid(), quantity_delta: z.number().int().min(-100000).max(100000).refine((value) => value !== 0), reason: z.string().trim().min(1).max(300) }).strict();
const settingSchema = z.object({ key: z.string().trim().min(1).max(100), value: z.unknown() }).strict();

export async function GET(request: Request, { params }: Context) {
  try {
    const { resource } = await params;
    const allowedRoles = resource === 'orders'
      ? ['admin', 'manager', 'cashier', 'kitchen', 'delivery']
      : resource === 'payments'
        ? ['admin', 'manager', 'cashier']
        : resource === 'inventory'
          ? ['admin', 'manager', 'cashier', 'kitchen', 'delivery']
          : ['admin', 'manager'];
    const { supabase, role } = await requireRole(allowedRoles);
    if (resource === 'inventory' || resource === 'payments') {
      const permissionKey = resource === 'inventory' ? 'inventory.manage' : 'payments.confirm';
      const { data: authorized, error: authorizationError } = await supabase.rpc('has_staff_permission', { p_permission_key: permissionKey });
      if (authorizationError) throw authorizationError;
      if (authorized !== true) return NextResponse.json({ error: `${resource === 'inventory' ? 'Inventory management' : 'Cash payment'} permission required.` }, { status: 403 });
    }
    if (resource === 'reports') {
      const { searchParams } = new URL(request.url);
      const period = searchParams.get('period');
      const rawSince = searchParams.get('since');
      const parsedSince = rawSince ? z.string().datetime().safeParse(rawSince) : null;
      if (parsedSince && !parsedSince.success) return NextResponse.json({ error: 'Invalid report date.' }, { status: 400 });
      if (period && !['day', 'week', 'month'].includes(period)) {
        return NextResponse.json({ error: 'Invalid report period.' }, { status: 400 });
      }
      const until = new Date();
      const since = parsedSince?.success ? new Date(parsedSince.data) : new Date(until);
      if (!parsedSince?.success) {
        since.setUTCHours(0, 0, 0, 0);
        since.setUTCDate(since.getUTCDate() - (period === 'day' ? 0 : period === 'week' ? 6 : 29));
      }
      const { data, error } = await supabase.rpc('admin_dashboard_report', {
        p_since: since.toISOString(),
        p_until: until.toISOString(),
      });
      if (error) {
        console.error('Report query failed:', error.message);
        return NextResponse.json({ error: 'Unable to load reports.' }, { status: 500 });
      }
      const report = z.record(z.string(), z.unknown()).safeParse(data);
      if (!report.success) {
        console.error('Report RPC returned an invalid response:', report.error);
        return NextResponse.json({ error: 'Unable to load reports.' }, { status: 500 });
      }
      return NextResponse.json({ reports: {
        since: since.toISOString(),
        until: until.toISOString(),
        ...report.data,
      } });
    }
    if (resource === 'customers') {
      if (role !== 'admin') return NextResponse.json({ error: 'Only admins can manage customers.' }, { status: 403 });
      const { data, error } = await supabase.from('profiles').select('id,email,full_name,phone,created_at').eq('role', 'customer').order('created_at', { ascending: false }).limit(500);
      if (error) throw error;
      return NextResponse.json({ customers: data });
    }
    if (resource === 'staff') {
      if (role !== 'admin') return NextResponse.json({ error: 'Only admins can manage staff.' }, { status: 403 });
      const { data, error } = await supabase.from('profiles').select('id,email,full_name,phone,role,created_at').neq('role', 'customer').order('created_at', { ascending: false }).limit(500);
      if (error) throw error;
      return NextResponse.json({ staff: data });
    }
    if (resource === 'inventory') {
      const { data, error } = await supabase.from('inventory_items')
        .select('id,product_id,product_name_snapshot,sku,is_tracked,quantity_on_hand,reorder_level,unit,updated_at')
        .order('product_name_snapshot').limit(1000);
      if (error) throw error;
      if (new URL(request.url).searchParams.get('history') === 'true') {
        const { data: movements, error: movementError } = await supabase.from('stock_movements')
          .select('id,product_name_snapshot,quantity_delta,reason,created_at,created_by')
          .order('created_at', { ascending: false }).limit(100);
        if (movementError) throw movementError;
        return NextResponse.json({ inventory: data, movements });
      }
      return NextResponse.json({ inventory: data });
    }
    if (resource === 'orders') {
      const { searchParams } = new URL(request.url);
      const orderType = searchParams.get('order_type');
      if (orderType && !z.enum(['dine_in', 'delivery', 'pickup']).safeParse(orderType).success) {
        return NextResponse.json({ error: 'Invalid order type filter.' }, { status: 400 });
      }
      let query = supabase.from('orders')
        .select('id,order_number,customer_id,customer_name,customer_email,customer_phone,order_type,status,payment_method,payment_status,subtotal,discount,delivery_fee,total,coupon_id,delivery_zone_id,delivery_address,delivery_postal_code,delivery_address_snapshot,customer_address_id,notes,delivery_status,delivery_staff_id,restaurant_table_id,table_session_id,cash_collection_point,created_at,updated_at,restaurant_table:restaurant_tables!orders_restaurant_table_id_fkey(label),items:order_items(*),status_history:order_status_history(to_status,created_at)')
        .order('created_at', { ascending: false });
      if (orderType) query = query.eq('order_type', orderType);
      const { data, error } = await query.limit(500);
      if (error) throw error;
      return NextResponse.json({ orders: data });
    }
    if (resource === 'categories') {
      const { data, error } = await supabase.from('categories').select('*').order('sort_order').limit(500);
      if (error) throw error;
      return NextResponse.json({ categories: data });
    }
    if (resource === 'coupons') {
      const { data, error } = await supabase.from('coupons').select('*').order('code').limit(500);
      if (error) throw error;
      return NextResponse.json({ coupons: data });
    }
    if (resource === 'zones') {
      const { data, error } = await supabase.from('delivery_zones').select('*').order('name').limit(500);
      if (error) throw error;
      return NextResponse.json({ zones: data });
    }
    if (resource === 'settings') {
      const { data, error } = await supabase.from('restaurant_settings').select('*').order('key');
      if (error) throw error;
      return NextResponse.json({ settings: data });
    }
    if (resource === 'payments') {
      const { data, error } = await supabase.from('cash_payments')
        .select('id,order_id,status,amount,received_by,received_at,note,receiver:profiles!cash_payments_received_by_fkey(full_name,email)')
        .order('received_at', { ascending: false }).limit(500);
      if (error) throw error;
      return NextResponse.json({ payments: (data ?? []).map((payment) => {
        const receiver = Array.isArray(payment.receiver) ? payment.receiver[0] : null;
        return {
          ...payment,
          receiver_name: receiver?.full_name || receiver?.email || null,
        };
      }) });
    }
    return NextResponse.json({ error: 'Unknown admin resource.' }, { status: 404 });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request, { params }: Context) {
  try {
    const { resource } = await params;
    const { supabase, user, role } = await requireRole(resource === 'inventory'
      ? ['admin', 'manager', 'cashier', 'kitchen', 'delivery']
      : ['admin', 'manager']);
    if (resource === 'inventory') {
      const { data: authorized, error: authorizationError } = await supabase.rpc('has_staff_permission', { p_permission_key: 'inventory.manage' });
      if (authorizationError) throw authorizationError;
      if (authorized !== true) return NextResponse.json({ error: 'Inventory management permission required.' }, { status: 403 });
    }
    if (resource === 'categories') {
      const body = await parseJson(request, categorySchema);
      if (Object.keys(body).length === 0) return NextResponse.json({ error: 'Category details are required.' }, { status: 400 });
      const { data, error } = await supabase.from('categories').insert(body).select().single();
      if (error) throw error;
      return NextResponse.json({ category: data }, { status: 201 });
    }
    if (resource === 'coupons') {
      const body = await parseJson(request, couponSchema);
      if (Object.keys(body).length === 0) return NextResponse.json({ error: 'Coupon details are required.' }, { status: 400 });
      const { data, error } = await supabase.from('coupons').insert(body).select().single();
      if (error) throw error;
      return NextResponse.json({ coupon: data }, { status: 201 });
    }
    if (resource === 'zones') {
      const body = await parseJson(request, zoneSchema);
      if (Object.keys(body).length === 0) return NextResponse.json({ error: 'Zone details are required.' }, { status: 400 });
      const { data, error } = await supabase.from('delivery_zones').insert(body).select().single();
      if (error) throw error;
      return NextResponse.json({ zone: data }, { status: 201 });
    }
    if (resource === 'staff') {
      if (role !== 'admin') return NextResponse.json({ error: 'Only admins can manage staff roles.' }, { status: 403 });
      const body = await parseJson(request, staffAssignmentSchema);
      if (body.id === user.id) return NextResponse.json({ error: 'You cannot change your own staff role.' }, { status: 400 });
      const { data, error } = await supabase.from('profiles').update({ role: body.role }).eq('id', body.id).select('id,email,role').single();
      if (error) throw error;
      return NextResponse.json({ staff: data }, { status: 200 });
    }
    if (resource === 'customers') {
      if (role !== 'admin') return NextResponse.json({ error: 'Only admins can manage customers.' }, { status: 403 });
      const body = await parseJson(request, customerSchema);
      const updates = { full_name: body.full_name, phone: body.phone };
      if (!body.full_name && body.phone === undefined) return NextResponse.json({ error: 'No customer fields supplied.' }, { status: 400 });
      const { data, error } = await supabase.from('profiles').update(updates).eq('id', body.id).eq('role', 'customer').select('id,email,full_name,phone').single();
      if (error) throw error;
      return NextResponse.json({ customer: data });
    }
    if (resource === 'inventory') {
      const body = await parseJson(request, inventorySchema);
      const { error } = await supabase.rpc('adjust_inventory', {
        p_product_id: body.product_id,
        p_quantity_delta: body.quantity_delta,
        p_reason: body.reason,
      });
      if (error) throw error;
      return NextResponse.json({ success: true }, { status: 201 });
    }
    if (resource === 'settings') {
      if (role !== 'admin') return NextResponse.json({ error: 'Only admins can change settings.' }, { status: 403 });
      const body = await parseJson(request, settingSchema);
      const { data, error } = await supabase.from('restaurant_settings')
        .upsert({ key: body.key, value: body.value, visibility: 'private', updated_by: user.id, updated_at: new Date().toISOString() })
        .select().single();
      if (error) throw error;
      return NextResponse.json({ setting: data }, { status: 201 });
    }
    return NextResponse.json({ error: 'This admin resource does not support creation.' }, { status: 405 });
  } catch (error) {
    return apiError(error);
  }
}
