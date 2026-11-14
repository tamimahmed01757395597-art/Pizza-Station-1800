import { NextResponse } from 'next/server';
import { apiError, parseJson, requireRole, requireUuid } from '@/lib/api';
import { deliveryUpdateSchema } from '@/lib/schemas';
import { sendOrderEmail } from '@/lib/notifications';

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Context) {
  try {
    const { id } = await params;
    requireUuid(id);
    const body = await parseJson(request, deliveryUpdateSchema);
    const { supabase, user, role } = await requireRole(['admin', 'manager', 'delivery']);
    const { data: order, error: lookupError } = await supabase.from('orders')
      .select('id,order_number,customer_email,delivery_staff_id,delivery_status').eq('id', id).maybeSingle();
    if (lookupError) {
      console.error('Delivery order lookup failed:', lookupError.message);
      return NextResponse.json({ error: 'Unable to load delivery order.' }, { status: 500 });
    }
    if (!order) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    if (role === 'delivery' && order.delivery_staff_id !== user.id) {
      return NextResponse.json({ error: 'This delivery is not assigned to you.' }, { status: 403 });
    }
    const nextAssignee = role === 'delivery' ? user.id : body.delivery_staff_id ?? order.delivery_staff_id;
    const { error } = await supabase.rpc('update_delivery', {
      p_order_id: id,
      p_status: body.status,
      p_staff_id: nextAssignee,
    });
    if (error) {
      if (error.code === '22023') return NextResponse.json({ error: error.message }, { status: 400 });
      if (error.code === '42501') {
        return NextResponse.json({ error: 'You are not authorized to update this delivery or its assignment.' }, { status: role === 'delivery' ? 403 : 400 });
      }
      console.error('Delivery update failed:', error.message);
      return NextResponse.json({ error: 'Unable to update delivery.' }, { status: 500 });
    }
    await sendOrderEmail({ order_number: order.order_number, email: order.customer_email, status: body.status }).catch((emailError: unknown) => {
      console.error('Delivery status email failed:', emailError);
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
