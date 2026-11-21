import { NextResponse } from 'next/server';
import { apiError, enforceRateLimit, getProfileRole, parseJson, STAFF_ROLES } from '@/lib/api';
import { orderSchema } from '@/lib/schemas';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { sendOrderEmail } from '@/lib/notifications';
import { verifiedOrderRecipient } from '@/lib/email-recipients';

export async function POST(request: Request) {
  try {
    const payload = await parseJson(request, orderSchema);
    enforceRateLimit(`order:${payload.customer.email.toLowerCase()}`, 10, 10 * 60_000);
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc('create_order', { p_payload: payload });
    if (error) {
      if (error.code === '22023') return NextResponse.json({ error: error.message }, { status: 400 });
      if (error.code === '42501') return NextResponse.json({ error: 'You are not authorized to place this order.' }, { status: 403 });
      console.error('Order creation failed:', error.code ?? 'unknown code');
      return NextResponse.json({ error: 'Unable to place order.' }, { status: 500 });
    }
    if (!data || typeof data !== 'object' || !('id' in data)) {
      console.error('Order RPC returned an unexpected response shape');
      return NextResponse.json({ error: 'Unable to place order.' }, { status: 500 });
    }
    if ('duplicate' in data && data.duplicate !== true) {
      const recipient = await verifiedOrderRecipient(supabase, payload.customer.email);
      if (recipient) {
        await sendOrderEmail({
          order_number: String(data.order_number),
          email: recipient,
          status: 'pending',
        }).catch((emailError: unknown) => {
          console.error('Order confirmation email failed:', emailError instanceof Error ? emailError.name : 'unknown error');
        });
      }
    }
    return NextResponse.json({ order: data }, { status: 'duplicate' in data && data.duplicate ? 200 : 201 });
  } catch (error) {
    return apiError(error);
  }
}

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    const role = await getProfileRole(supabase, user.id);
    if (role === 'kitchen') {
      const { data: kitchenOrders, error: kitchenError } = await supabase.rpc('get_kitchen_orders');
      if (kitchenError) {
        console.error('Kitchen order lookup failed:', kitchenError.code ?? 'unknown code');
        return NextResponse.json({ error: 'Unable to load orders.' }, { status: 500 });
      }
      return NextResponse.json({ orders: Array.isArray(kitchenOrders) ? kitchenOrders : [] });
    }
    let query = supabase.from('orders')
      .select('id,order_number,customer_id,customer_name,customer_email,customer_phone,order_type,status,payment_method,payment_status,subtotal,discount,delivery_fee,total,coupon_id,delivery_zone_id,delivery_address,delivery_postal_code,notes,delivery_status,delivery_staff_id,restaurant_table_id,table_session_id,cash_collection_point,created_at,updated_at,items:order_items(*)');
    // Defense in depth: RLS already restricts this, but customers should never
    // issue a query that could return another customer's orders.
    if (!role || !(STAFF_ROLES as readonly string[]).includes(role)) {
      query = query.eq('customer_id', user.id);
    }
    const { data, error } = await query.order('created_at', { ascending: false }).limit(100);
    if (error) {
      console.error('Order history lookup failed:', error.message);
      return NextResponse.json({ error: 'Unable to load orders.' }, { status: 500 });
    }
    return NextResponse.json({ orders: data });
  } catch (error) {
    return apiError(error);
  }
}
