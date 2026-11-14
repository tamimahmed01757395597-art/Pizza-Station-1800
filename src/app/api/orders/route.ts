import { NextResponse } from 'next/server';
import { apiError, parseJson } from '@/lib/api';
import { orderSchema } from '@/lib/schemas';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { sendOrderEmail } from '@/lib/notifications';

export async function POST(request: Request) {
  try {
    const payload = await parseJson(request, orderSchema);
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc('create_order', { p_payload: payload });
    if (error) {
      if (error.code === '22023') return NextResponse.json({ error: error.message }, { status: 400 });
      if (error.code === '42501') return NextResponse.json({ error: 'You are not authorized to place this order.' }, { status: 403 });
      console.error('Order creation failed:', error.code, error.message);
      return NextResponse.json({ error: 'Unable to place order.' }, { status: 500 });
    }
    if (!data || typeof data !== 'object' || !('id' in data)) {
      console.error('Order RPC returned invalid response:', data);
      return NextResponse.json({ error: 'Unable to place order.' }, { status: 500 });
    }
    if ('duplicate' in data && data.duplicate !== true) {
      await sendOrderEmail({
        order_number: String(data.order_number),
        email: payload.customer.email,
        status: 'pending',
      }).catch((emailError: unknown) => {
        console.error('Order confirmation email failed:', emailError);
      });
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
    const { data, error } = await supabase.from('orders')
      .select('id,order_number,customer_id,customer_name,customer_email,customer_phone,order_type,status,payment_method,payment_status,subtotal,discount,delivery_fee,total,coupon_id,delivery_zone_id,delivery_address,delivery_postal_code,notes,delivery_status,delivery_staff_id,restaurant_table_id,table_session_id,cash_collection_point,created_at,updated_at,items:order_items(*)')
      .order('created_at', { ascending: false }).limit(100);
    if (error) {
      console.error('Order history lookup failed:', error.message);
      return NextResponse.json({ error: 'Unable to load orders.' }, { status: 500 });
    }
    return NextResponse.json({ orders: data });
  } catch (error) {
    return apiError(error);
  }
}
