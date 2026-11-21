import { NextResponse } from 'next/server';
import { apiError, getProfileRole, parseJson, requireRole, requireUuid, STAFF_ROLES } from '@/lib/api';
import { orderStatusSchema } from '@/lib/schemas';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { sendOrderEmail } from '@/lib/notifications';
import { statusEmailRecipient } from '@/lib/email-recipients';

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  try {
    const { id } = await params;
    requireUuid(id);
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    const role = await getProfileRole(supabase, user.id);
    if (role === 'kitchen') {
      const { data: kitchenOrder, error: kitchenError } = await supabase.rpc('get_kitchen_orders', { p_order_id: id });
      if (kitchenError) {
        console.error('Kitchen order lookup failed:', kitchenError.code ?? 'unknown code');
        return NextResponse.json({ error: 'Unable to load order.' }, { status: 500 });
      }
      const orders = Array.isArray(kitchenOrder) ? kitchenOrder : [];
      if (!orders.length) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
      return NextResponse.json({ order: orders[0] });
    }
    let query = supabase.from('orders')
      .select('id,order_number,customer_id,customer_name,customer_email,customer_phone,order_type,status,payment_method,payment_status,subtotal,discount,delivery_fee,total,coupon_id,delivery_zone_id,delivery_address,delivery_postal_code,notes,delivery_status,delivery_staff_id,restaurant_table_id,table_session_id,cash_collection_point,created_at,updated_at,restaurant_table:restaurant_tables!orders_restaurant_table_id_fkey(label),items:order_items(*)')
      .eq('id', id);
    if (!role || !(STAFF_ROLES as readonly string[]).includes(role)) {
      query = query.eq('customer_id', user.id);
    }
    const { data, error } = await query.single();
    if (error || !data) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    return NextResponse.json({ order: data });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request, { params }: Context) {
  try {
    const { id } = await params;
    requireUuid(id);
    const { status } = await parseJson(request, orderStatusSchema);
    const { supabase, role } = await requireRole(['admin', 'manager', 'kitchen', 'cashier']);
    const { data: order, error: lookupError } = await supabase.from('orders')
      .select('id,order_number,customer_id,customer_email,status').eq('id', id).maybeSingle();
    if (lookupError) {
      console.error('Order lookup failed:', lookupError.message);
      return NextResponse.json({ error: 'Unable to load order.' }, { status: 500 });
    }
    if (!order) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    const { error } = await supabase.rpc('update_order_status', { p_order_id: id, p_status: status });
    if (error) {
      if (error.code === '22023') return NextResponse.json({ error: error.message }, { status: 409 });
      if (error.code === '42501') return NextResponse.json({ error: 'You are not authorized to update this order.' }, { status: 403 });
      console.error('Order status update failed:', error.message);
      return NextResponse.json({ error: 'Unable to update order status.' }, { status: 500 });
    }
    // Kitchen stations do not handle customer contact data (F3).
    const emailRecipient = role !== 'kitchen' ? statusEmailRecipient(order) : null;
    if (emailRecipient) {
      await sendOrderEmail({ order_number: order.order_number, email: emailRecipient, status }).catch((emailError: unknown) => {
        console.error('Order status email failed:', emailError instanceof Error ? emailError.name : 'unknown error');
      });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
