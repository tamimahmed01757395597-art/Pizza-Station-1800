import { NextResponse } from 'next/server';
import { apiError, requireUuid } from '@/lib/api';
import { requireTableManagement } from '@/lib/table-management';

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  try {
    const id = requireUuid((await params).id);
    const { supabase } = await requireTableManagement();
    const { data: sessions, error: sessionError } = await supabase.from('table_sessions')
      .select('id,restaurant_table_id,started_at,expires_at,ended_at,ended_by')
      .eq('restaurant_table_id', id)
      .order('started_at', { ascending: false }).limit(50);
    if (sessionError) throw sessionError;

    const sessionIds = (sessions ?? []).map((session) => session.id);
    let orders: Array<Record<string, unknown>> = [];
    if (sessionIds.length) {
      const { data, error } = await supabase.from('orders')
        .select('id,order_number,restaurant_table_id,table_session_id,customer_name,status,payment_status,total,created_at,items:order_items(id,quantity,unit_price,line_total,snapshot)')
        .in('table_session_id', sessionIds)
        .order('created_at', { ascending: false }).limit(500);
      if (error) throw error;
      orders = data ?? [];
    }

    return NextResponse.json({
      sessions: (sessions ?? []).map((session) => ({
        ...session,
        orders: orders.filter((order) => order.table_session_id === session.id),
      })),
    });
  } catch (error) {
    return apiError(error);
  }
}
