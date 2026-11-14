import { NextResponse } from 'next/server';
import { apiError, requireRole } from '@/lib/api';

export async function GET() {
  try {
    const { supabase } = await requireRole(['admin', 'manager']);
    const until = new Date();
    const today = new Date(until);
    today.setUTCHours(0, 0, 0, 0);
    const week = new Date(today);
    week.setUTCDate(week.getUTCDate() - 6);
    const [orderResult, todayResult, weekResult] = await Promise.all([
      supabase.from('orders')
        .select('id,order_number,customer_name,order_type,status,payment_status,total,created_at,restaurant_table:restaurant_tables!orders_restaurant_table_id_fkey(label),items:order_items(quantity,snapshot)')
        .order('created_at', { ascending: false }).limit(12),
      supabase.rpc('admin_dashboard_report', { p_since: today.toISOString(), p_until: until.toISOString() }),
      supabase.rpc('admin_dashboard_report', { p_since: week.toISOString(), p_until: until.toISOString() }),
    ]);
    if (orderResult.error) throw orderResult.error;
    if (todayResult.error) throw todayResult.error;
    if (weekResult.error) throw weekResult.error;
    return NextResponse.json({ orders: orderResult.data, today: todayResult.data, week: weekResult.data });
  } catch (error) {
    return apiError(error);
  }
}
