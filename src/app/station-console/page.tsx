'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import { money } from '@/lib/menu';
import { adminPath } from '@/lib/admin-path';

const orderSchema = z.object({
  id: z.string().uuid(),
  order_number: z.string(),
  customer_name: z.string(),
  order_type: z.string(),
  status: z.string(),
  payment_status: z.string(),
  total: z.union([z.number(), z.string()]),
  created_at: z.string(),
  restaurant_table: z.object({ label: z.string() }).nullable().optional(),
  items: z.array(z.object({ quantity: z.number(), snapshot: z.unknown() }).passthrough()).default([]),
}).passthrough();
const dashboardReportSchema = z.object({
  order_count: z.number(),
  paid_revenue: z.union([z.number(), z.string()]),
  pending_count: z.number(),
  completed_count: z.number(),
  daily_sales: z.array(z.object({ day: z.string(), sales: z.union([z.number(), z.string()]) })),
  best_sellers: z.array(z.object({ name: z.string(), quantity: z.number() })),
});
const dashboardResponseSchema = z.object({
  orders: z.array(orderSchema),
  today: dashboardReportSchema,
  week: dashboardReportSchema,
});
type Order = z.infer<typeof orderSchema>;

export default function AdminOverviewPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [todayReport, setTodayReport] = useState<z.infer<typeof dashboardReportSchema> | null>(null);
  const [weekReport, setWeekReport] = useState<z.infer<typeof dashboardReportSchema> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const response = await fetch('/api/admin/summary', { cache: 'no-store' });
        const result: unknown = await response.json();
        if (!response.ok) {
          const parsed = z.object({ error: z.string() }).safeParse(result);
          throw new Error(parsed.success ? parsed.data.error : 'Unable to load dashboard data.');
        }
        const parsed = dashboardResponseSchema.safeParse(result);
        if (!parsed.success) throw new Error('The orders response was invalid.');
        if (active) {
          setOrders(parsed.data.orders);
          setTodayReport(parsed.data.today);
          setWeekReport(parsed.data.week);
        }
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load dashboard data.');
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, []);

  const metrics = useMemo(() => {
    const salesByDay = new Map((weekReport?.daily_sales ?? []).map((entry) => [entry.day.slice(0, 10), Number(entry.sales)]));
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setUTCHours(0, 0, 0, 0);
      date.setUTCDate(date.getUTCDate() - (6 - index));
      const key = date.toISOString().slice(0, 10);
      return { label: date.toLocaleDateString(undefined, { weekday: 'short' }), sales: salesByDay.get(key) ?? 0 };
    });
    return {
      paidSales: Number(todayReport?.paid_revenue ?? 0),
      pending: todayReport?.pending_count ?? 0,
      completed: todayReport?.completed_count ?? 0,
      bestSellers: (weekReport?.best_sellers ?? []).slice(0, 5).map((item) => [item.name, item.quantity] as [string, number]),
      days,
      totalOrders: todayReport?.order_count ?? 0,
    };
  }, [todayReport, weekReport]);

  const maxSales = Math.max(1, ...metrics.days.map((day) => day.sales));
  const chartPoints = metrics.days.map((day, index) => `${index * 100},${94 - (day.sales / maxSales) * 78}`).join(' ');

  return (
    <main className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#e7b84b]">Operations overview</p>
          <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">Good service starts here.</h1>
          <p className="mt-2 text-sm text-[#9b978f]">Live figures from your Supabase orders.</p>
        </div>
        <Link href={adminPath('orders')} className="rounded-full bg-[#c9342e] px-5 py-3 text-sm font-semibold text-white hover:bg-[#df4038]">View live orders</Link>
      </div>

      {error && <p role="alert" className="mt-6 rounded-xl border border-[#ef8a7d]/30 bg-[#ef8a7d]/10 p-4 text-sm text-[#ef8a7d]">{error}</p>}
      {loading ? (
        <p role="status" className="mt-8 text-sm text-[#aaa69a]">Loading live business data…</p>
      ) : (
        <>
          <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ['Today’s sales', money(metrics.paidSales), 'Paid orders today'],
              ['Orders today', String(metrics.totalOrders), 'All order types'],
              ['Needs attention', String(metrics.pending), 'Pending or confirmed'],
              ['Completed today', String(metrics.completed), 'Finished orders'],
            ].map(([label, value, note]) => (
              <article key={label} className="rounded-2xl border border-white/10 bg-[#151514] p-5 shadow-xl shadow-black/10">
                <p className="text-sm text-[#aaa69a]">{label}</p>
                <p className="mt-3 text-3xl font-semibold tracking-tight">{value}</p>
                <p className="mt-2 text-xs text-[#77746e]">{note}</p>
              </article>
            ))}
          </section>

          <section className="mt-5 grid gap-5 xl:grid-cols-[1.6fr_1fr]">
            <article className="rounded-2xl border border-white/10 bg-[#151514] p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div><h2 className="text-lg font-semibold">Paid sales · last 7 days</h2><p className="mt-1 text-xs text-[#88857e]">Calculated from recorded paid orders</p></div>
                <span className="rounded-full border border-[#e7b84b]/30 px-3 py-1 text-xs text-[#e7b84b]">Revenue</span>
              </div>
              <div className="mt-6">
                {orders.length ? (
                  <>
                    <svg viewBox="0 0 600 120" className="h-48 w-full overflow-visible" role="img" aria-label="Paid sales chart for the last seven days">
                      <line x1="0" y1="96" x2="600" y2="96" stroke="#343330" strokeWidth="1" />
                      <polyline points={chartPoints} fill="none" stroke="#e7b84b" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                      {metrics.days.map((day, index) => <g key={`${day.label}-${index}`}>
                        <circle cx={index * 100} cy={94 - (day.sales / maxSales) * 78} r="4" fill="#c9342e" />
                        <text x={index * 100} y="116" fill="#8f8b82" fontSize="10" textAnchor="middle">{day.label}</text>
                      </g>)}
                    </svg>
                    <div className="flex justify-between text-xs text-[#8f8b82]"><span>{money(0)}</span><span>{money(maxSales)}</span></div>
                  </>
                ) : <p className="py-12 text-center text-sm text-[#8f8b82]">No order data yet. Sales will appear when customers place orders.</p>}
              </div>
            </article>
            <article className="rounded-2xl border border-white/10 bg-[#151514] p-5 sm:p-6">
              <h2 className="text-lg font-semibold">Best-selling items</h2>
              <p className="mt-1 text-xs text-[#88857e]">Quantities in the loaded order history</p>
              {metrics.bestSellers.length ? <ol className="mt-5 grid gap-3">
                {metrics.bestSellers.map(([name, count], index) => (
                  <li key={name} className="flex items-center justify-between gap-3 rounded-xl bg-black/20 px-4 py-3">
                    <span className="truncate text-sm"><span className="mr-3 text-xs text-[#e7b84b]">0{index + 1}</span>{name}</span>
                    <span className="shrink-0 text-sm font-semibold">{count}</span>
                  </li>
                ))}
              </ol> : <p className="mt-6 text-sm text-[#8f8b82]">No sold items to rank yet.</p>}
            </article>
          </section>

          <section className="mt-5 rounded-2xl border border-white/10 bg-[#151514]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4 sm:px-6">
              <div><h2 className="font-semibold">Recent orders</h2><p className="mt-1 text-xs text-[#88857e]">Newest orders from the admin feed</p></div>
              <Link href={adminPath('orders')} className="text-sm text-[#e7b84b] hover:underline">All orders →</Link>
            </div>
            {orders.length ? <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-[#77746e]"><tr><th className="px-5 py-3">Order</th><th className="px-5 py-3">Customer</th><th className="px-5 py-3">Type / table</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Total</th></tr></thead>
                <tbody>{orders.slice(0, 6).map((order) => <tr key={order.id} className="border-t border-white/5">
                  <td className="px-5 py-3 font-medium">{order.order_number}</td>
                  <td className="px-5 py-3 text-[#ccc7bc]">{order.customer_name}</td>
                  <td className="px-5 py-3 capitalize text-[#aaa69a]">{order.order_type.replace('_', ' ')}{order.restaurant_table?.label ? ` · ${order.restaurant_table.label}` : ''}</td>
                  <td className="px-5 py-3"><span className="rounded-full bg-white/5 px-2.5 py-1 text-xs capitalize">{order.status.replaceAll('_', ' ')}</span></td>
                  <td className="px-5 py-3 text-right">{money(Number(order.total))}</td>
                </tr>)}</tbody>
              </table>
            </div> : <p className="p-6 text-sm text-[#8f8b82]">No orders have been placed yet.</p>}
          </section>
          <p className="mt-4 text-xs text-[#6f6c65]">Today's totals and seven-day charts are aggregated from the full order history in PostgreSQL. Recent orders are the newest 12.</p>
        </>
      )}
    </main>
  );
}
