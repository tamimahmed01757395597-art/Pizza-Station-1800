import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiError, requireUuid } from '@/lib/api';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const tableTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
const orderStatusResponseSchema = z.object({
  order_number: z.string().min(1),
  table_number: z.string().min(1),
  status: z.enum(['pending', 'confirmed', 'preparing', 'ready', 'served', 'completed', 'cancelled']),
  payment_status: z.enum(['unpaid', 'paid', 'refunded']),
  total: z.union([z.number(), z.string()]),
  created_at: z.string(),
  items: z.array(z.unknown()),
});
type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Context) {
  try {
    const { id } = await params;
    requireUuid(id);
    const token = tableTokenSchema.safeParse(request.headers.get('x-table-token'));
    if (!token.success) return NextResponse.json({ error: 'A valid table QR token is required.' }, { status: 400 });

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc('get_dine_in_order_status', {
      p_order_id: id,
      p_raw_token: token.data,
    });
    if (error) {
      if (error.code === '22023') return NextResponse.json({ error: 'Order not found for this table QR.' }, { status: 404 });
      console.error('Dine-in order status lookup failed:', error.code, error.message);
      return NextResponse.json({ error: 'Unable to load order status.' }, { status: 500 });
    }

    const parsed = orderStatusResponseSchema.safeParse(data);
    if (!parsed.success) {
      console.error('Dine-in order status RPC returned an invalid response:', parsed.error.flatten());
      return NextResponse.json({ error: 'Unable to load order status.' }, { status: 500 });
    }
    return NextResponse.json(parsed.data, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return apiError(error);
  }
}
