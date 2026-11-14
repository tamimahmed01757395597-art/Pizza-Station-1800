import { NextResponse } from 'next/server';
import { apiError, parseJson, requireRole, requireUuid } from '@/lib/api';
import { paymentConfirmationSchema } from '@/lib/schemas';

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Context) {
  try {
    const { id } = await params;
    requireUuid(id);
    const body = await parseJson(request, paymentConfirmationSchema);
    const { supabase } = await requireRole(['admin', 'manager', 'cashier']);
    const { data: authorized, error: authorizationError } = await supabase.rpc('has_staff_permission', { p_permission_key: 'payments.confirm' });
    if (authorizationError) throw authorizationError;
    if (authorized !== true) return NextResponse.json({ error: 'Cash payment permission required.' }, { status: 403 });
    const { data: order, error: lookupError } = await supabase.from('orders').select('total,payment_status').eq('id', id).maybeSingle();
    if (lookupError) {
      console.error('Payment order lookup failed:', lookupError.message);
      return NextResponse.json({ error: 'Unable to load order.' }, { status: 500 });
    }
    if (!order) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    if (body.status === 'paid' && Number(body.amount) !== Number(order.total)) {
      return NextResponse.json({ error: 'Payment amount must match the order total.' }, { status: 400 });
    }
    const { error } = await supabase.rpc('confirm_cash_payment', {
      p_order_id: id,
      p_status: body.status,
      p_amount: body.amount ?? order.total,
      p_note: body.note ?? null,
    });
    if (error) {
      if (error.code === '22023') return NextResponse.json({ error: error.message }, { status: 400 });
      if (error.code === '42501') return NextResponse.json({ error: 'You are not authorized to confirm this payment.' }, { status: 403 });
      console.error('Cash payment confirmation failed:', error.code, error.message);
      return NextResponse.json({ error: 'Unable to record cash payment.' }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
