'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { z } from 'zod';
import { money } from '@/lib/menu';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { tableDisplayLabel } from '@/lib/table-label';

type Row = Record<string, unknown>;

const rowResponse = z.record(z.string(), z.unknown());
const errorSchema = z.object({ error: z.string() });
const permissions = ['orders.manage', 'kitchen.manage', 'tables.manage', 'payments.confirm', 'inventory.manage'];

function isRow(value: unknown): value is Row {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function text(row: Row, key: string, fallback = '—') {
  const value = row[key];
  return typeof value === 'string' && value ? value : fallback;
}
function amount(row: Row, key: string) {
  const value = Number(row[key] ?? 0);
  return Number.isFinite(value) ? value : 0;
}
function flag(row: Row, key: string) {
  return row[key] === true;
}
function itemLabel(snapshot: unknown) {
  if (!isRow(snapshot)) return 'Menu item';
  let value = text(snapshot, 'name', 'Menu item');
  if (isRow(snapshot.variant) && typeof snapshot.variant.name === 'string') value += ` (${snapshot.variant.name})`;
  if (Array.isArray(snapshot.addons)) {
    const addonNames = snapshot.addons.filter(isRow).map((addon) => text(addon, 'name', '')).filter(Boolean);
    if (addonNames.length) value += ` + ${addonNames.join(', ')}`;
  }
  return value;
}
function titleFor(section: string) {
  const titles: Record<string, string> = {
    orders: 'Live orders', 'dine-in': 'Live dine-in orders', kitchen: 'Kitchen display', menu: 'Menu management', inventory: 'Inventory',
    customers: 'Customers', promotions: 'Promotions', delivery: 'Delivery operations',
    payments: 'Cash payments', staff: 'Staff & permissions', reports: 'Sales reports', settings: 'Restaurant settings',
  };
  return titles[section] ?? 'Admin workspace';
}

async function requestJson(path: string, options?: RequestInit): Promise<Row> {
  const response = await fetch(path, { ...options, cache: 'no-store' });
  const result: unknown = await response.json();
  const parsed = rowResponse.safeParse(result);
  if (!parsed.success) throw new Error('The server returned an invalid response.');
  if (!response.ok) {
    const error = errorSchema.safeParse(parsed.data);
    throw new Error(error.success ? error.data.error : 'The request could not be completed.');
  }
  return parsed.data;
}

async function listFrom(path: string, key: string): Promise<Row[]> {
  const result = await requestJson(path);
  const value = result[key];
  if (!Array.isArray(value) || !value.every(isRow)) throw new Error(`The ${key} response was invalid.`);
  return value;
}

function Panel({ title, children, description }: { title: string; children: React.ReactNode; description?: string }) {
  return <section className="rounded-2xl border border-white/10 bg-[#151514] p-5 sm:p-6">
    <div className="mb-5"><h2 className="text-lg font-semibold">{title}</h2>{description && <p className="mt-1 text-xs text-[#8f8b82]">{description}</p>}</div>
    {children}
  </section>;
}

function Field({ label, value, onChange, type = 'text', required = false, min, placeholder }: {
  label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean; min?: string; placeholder?: string;
}) {
  return <label className="grid gap-1.5 text-xs text-[#aaa69a]">{label}
    <input className="field" type={type} value={value} onChange={(event) => onChange(event.target.value)} required={required} min={min} placeholder={placeholder} />
  </label>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-[#8f8b82]">{children}</p>;
}

export function AdminWorkspace({ section }: { section: string }) {
  const [data, setData] = useState<Record<string, Row[]>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState('all');
  const [form, setForm] = useState<Record<string, string>>({});
  const [staffRole, setStaffRole] = useState('');
  const [staffPermissions, setStaffPermissions] = useState<string[]>([]);
  const pageSize = 10;

  const load = useCallback(async () => {
    const next: Record<string, Row[]> = {};
    const session = await requestJson('/api/admin/session');
    const profile = isRow(session.profile) ? session.profile : {};
    const role = text(profile, 'role', '');
    setStaffRole(role);
    setStaffPermissions(Array.isArray(session.permissions) ? session.permissions.filter((permission): permission is string => typeof permission === 'string') : []);
    if (section === 'dine-in') {
      next.orders = await listFrom('/api/admin/orders?order_type=dine_in', 'orders');
    } else if (['orders', 'kitchen', 'payments', 'delivery'].includes(section)) {
      next.orders = await listFrom('/api/admin/orders', 'orders');
    }
    if (section === 'menu') {
      const [products, categories] = await Promise.all([
        listFrom('/api/products', 'products'),
        listFrom('/api/admin/categories', 'categories'),
      ]);
      next.products = products;
      next.categories = categories;
    } else if (section === 'inventory') {
      next.inventory = await listFrom('/api/admin/inventory', 'inventory');
      try { next.movements = await listFrom('/api/admin/inventory?history=true', 'movements'); } catch { next.movements = []; }
    } else if (section === 'customers') {
      const [customers, orders] = await Promise.all([
        listFrom('/api/admin/customers', 'customers'),
        listFrom('/api/admin/orders', 'orders'),
      ]);
      next.customers = customers;
      next.orders = orders;
    } else if (section === 'promotions') {
      next.coupons = await listFrom('/api/admin/coupons', 'coupons');
    } else if (section === 'delivery') {
      const orders = await listFrom('/api/admin/orders', 'orders');
      next.orders = orders;
      if (role === 'delivery') {
        next.zones = [];
        next.staff = [];
      } else {
        const [zones, staff] = await Promise.all([
          listFrom('/api/admin/zones', 'zones'),
          listFrom('/api/admin/staff', 'staff'),
        ]);
        next.zones = zones;
        next.staff = staff.filter((entry) => entry.role === 'delivery');
      }
    } else if (section === 'payments') {
      next.payments = await listFrom('/api/admin/payments', 'payments');
    } else if (section === 'staff') {
      const [staff, grants, customers] = await Promise.all([
        listFrom('/api/admin/staff', 'staff'),
        listFrom('/api/admin/permissions', 'permissions'),
        listFrom('/api/admin/customers', 'customers'),
      ]);
      next.staff = staff;
      next.permissions = grants;
      next.customers = customers;
    } else if (section === 'settings') {
      next.settings = await listFrom('/api/admin/settings', 'settings');
    } else if (section === 'orders' || section === 'kitchen') {
      next.orders = await listFrom('/api/admin/orders', 'orders');
    }
    setData(next);
  }, [section]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    load().catch((loadError: unknown) => {
      if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load this workspace.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    const timer = ['orders', 'dine-in', 'kitchen', 'payments', 'delivery'].includes(section)
      ? window.setInterval(() => { load().catch((refreshError: unknown) => {
          if (active) setError(refreshError instanceof Error ? refreshError.message : 'Unable to refresh data.');
        }); }, 15000)
      : undefined;
    let channel: ReturnType<ReturnType<typeof createSupabaseBrowserClient>['channel']> | undefined;
    if (section === 'orders' || section === 'dine-in') {
      try {
        const supabase = createSupabaseBrowserClient();
        const eventFilter = {
          event: '*',
          schema: 'public',
          table: 'orders',
          ...(section === 'dine-in' ? { filter: 'order_type=eq.dine_in' } : {}),
        } as const;
        channel = supabase.channel(`admin-${section}-orders`)
          .on('postgres_changes', eventFilter, () => {
            load().catch((refreshError: unknown) => {
              if (active) setError(refreshError instanceof Error ? refreshError.message : 'Unable to refresh live orders.');
            });
          })
          .subscribe((status: string) => {
            if (active && (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT')) {
              setError('Live order updates are unavailable. Automatic refresh will continue every 15 seconds.');
            }
          });
      } catch (realtimeError) {
        setError(realtimeError instanceof Error ? realtimeError.message : 'Live order updates could not be connected.');
      }
    }
    return () => {
      active = false;
      if (timer) window.clearInterval(timer);
      if (channel) void createSupabaseBrowserClient().removeChannel(channel);
    };
  }, [load, section]);

  async function mutate(path: string, method: string, body?: unknown) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await requestJson(path, {
        method,
        ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
      });
      setNotice('Changes saved.');
      await load();
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : 'Unable to save changes.');
    } finally {
      setBusy(false);
    }
  }

  function value(key: string) { return form[key] ?? ''; }
  function setValue(key: string, next: string) { setForm((current) => ({ ...current, [key]: next })); }

  async function submit(event: FormEvent<HTMLFormElement>, path: string, body: unknown) {
    event.preventDefault();
    await mutate(path, 'POST', body);
    setForm({});
  }

  const allRows = section === 'dine-in'
    ? data.orders ?? []
    : data[section] ?? data[section === 'promotions' ? 'coupons' : section === 'payments' ? 'orders' : section] ?? [];
  const filtered = useMemo(() => {
    const source = section === 'kitchen' || section === 'payments' || section === 'delivery' ? data.orders ?? [] : allRows;
    return source.filter((row) => {
      const contents = Object.values(row).filter((entry) => typeof entry === 'string').join(' ').toLowerCase();
      const matchesSearch = contents.includes(search.trim().toLowerCase());
      const matchesStatus = statusFilter === 'all' || row.status === statusFilter || row.payment_status === statusFilter;
      if (section === 'kitchen') return matchesSearch && ['pending', 'confirmed', 'preparing', 'ready'].includes(String(row.status));
      if (section === 'payments') return matchesSearch && (statusFilter === 'all' ? row.payment_status !== 'paid' : matchesStatus);
      if (section === 'delivery') return matchesSearch && row.order_type === 'delivery' && matchesStatus;
      if (section === 'orders') return matchesSearch && matchesStatus;
      if (section === 'dine-in') return matchesSearch && row.order_type === 'dine_in' && matchesStatus;
      return matchesSearch;
    });
  }, [allRows, data.orders, search, section, statusFilter]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice(page * pageSize, (page + 1) * pageSize);

  async function updateOrder(id: string, status: string) {
    await mutate(`/api/orders/${id}`, 'PATCH', { status });
  }
  async function markPaid(order: Row) {
    await mutate(`/api/orders/${text(order, 'id')}/payment`, 'POST', { status: 'paid', amount: amount(order, 'total') });
  }
  async function refundPayment(payment: Row) {
    if (!window.confirm(`Record a refund of ${money(amount(payment, 'amount'))} for this order?`)) return;
    await mutate(`/api/orders/${text(payment, 'order_id')}/payment`, 'POST', {
      status: 'refunded',
      amount: amount(payment, 'amount'),
      note: 'Refund recorded from admin dashboard',
    });
  }

  const heading = titleFor(section);
  const canManageOrders = ['admin', 'manager'].includes(staffRole) || staffPermissions.includes('orders.manage');
  const canManageKitchen = staffPermissions.includes('kitchen.manage');
  const description: Record<string, string> = {
    orders: 'Incoming orders and lifecycle controls. Live updates are delivered through Supabase Realtime.',
    'dine-in': 'New table orders, customizations, instructions and table assignment. Live updates are delivered through Supabase Realtime.',
    kitchen: 'Prioritize active tickets and move orders through preparation. Refreshes automatically every 15 seconds.',
    menu: 'Manage product catalog, categories, pricing, images, options and availability.',
    inventory: 'Monitor current stock and record traceable inventory adjustments.',
    customers: 'Customer profiles and the orders associated with each customer.',
    promotions: 'Configure coupon eligibility, discounts, validity and redemption limits.',
    delivery: 'Delivery zones, fees, minimums and live delivery assignments.',
    payments: 'Cash due at the restaurant or delivery, with recorded payment history.',
    staff: 'Assign registered accounts to staff roles and grant scoped permissions.',
    reports: 'Revenue and order breakdowns calculated from actual order records.',
    settings: 'Restaurant configuration stored in Supabase.',
  };

  return (
    <main className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#e7b84b]">Admin workspace</p>
        <h1 className="mt-2 text-3xl font-semibold">{heading}</h1>
        <p className="mt-2 max-w-3xl text-sm text-[#96928a]">{description[section] ?? 'Manage restaurant operations.'}</p>
      </div>
      {error && <p role="alert" className="mb-5 rounded-xl border border-[#ef8a7d]/30 bg-[#ef8a7d]/10 p-4 text-sm text-[#ef8a7d]">{error}</p>}
      {notice && <p role="status" className="mb-5 rounded-xl border border-[#e7b84b]/30 bg-[#e7b84b]/10 p-4 text-sm text-[#e9d6a2]">{notice}</p>}
      {loading ? <p role="status" className="py-12 text-center text-sm text-[#aaa69a]">Loading live Supabase data…</p> : (
        <div className="grid gap-5">
          {['orders', 'dine-in', 'kitchen', 'payments', 'delivery', 'customers', 'inventory', 'promotions'].includes(section) && (
            <div className="flex flex-col gap-3 sm:flex-row">
              <input className="field max-w-xl" placeholder="Search records…" value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} aria-label="Search records" />
              {['orders', 'dine-in', 'payments'].includes(section) && <select className="field sm:max-w-xs" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(0); }} aria-label="Filter by status">
                {(section === 'payments' ? ['all', 'unpaid', 'paid', 'refunded'] : ['all', 'pending', 'confirmed', 'preparing', 'ready', 'served', 'completed', 'cancelled']).map((status) => <option value={status} key={status}>{status === 'all' ? 'All statuses' : status === 'confirmed' ? 'Accepted' : status.replaceAll('_', ' ')}</option>)}
              </select>}
            </div>
          )}

          {['orders', 'kitchen'].includes(section) && <Panel title={section === 'kitchen' ? 'Kitchen tickets' : 'Order queue'} description="Status changes are checked by the order API and PostgreSQL before being saved.">
            {pageRows.length ? <div className="grid gap-3">
              {pageRows.map((order) => <OrderCard key={text(order, 'id')} order={order} kitchen={section === 'kitchen'} canManageOrders={canManageOrders} canManageKitchen={canManageKitchen} busy={busy} onStatus={updateOrder} />)}
            </div> : <Empty>No matching orders. New orders will appear here when submitted.</Empty>}
          </Panel>}
          {section === 'dine-in' && <Panel title="Live dine-in orders" description="Table orders are refreshed by Supabase Realtime; PostgreSQL verifies every status transition.">
            {pageRows.length ? <div className="grid gap-3">
              {pageRows.map((order) => <OrderCard key={text(order, 'id')} order={order} kitchen={false} canManageOrders={canManageOrders} canManageKitchen={canManageKitchen} busy={busy} onStatus={updateOrder} />)}
            </div> : <Empty>No dine-in orders match this filter. New table orders will appear here automatically.</Empty>}
          </Panel>}

          {section === 'payments' && <PaymentWorkspace orders={pageRows} history={data.payments ?? []} busy={busy} onPaid={markPaid} onRefund={refundPayment} />}
          {section === 'delivery' && <DeliveryWorkspace orders={pageRows} zones={data.zones ?? []} staff={data.staff ?? []} role={staffRole} busy={busy} onUpdate={mutate} />}
          {section === 'menu' && <MenuWorkspace products={data.products ?? []} categories={data.categories ?? []} busy={busy} onMutate={mutate} />}
          {section === 'inventory' && <InventoryWorkspace items={data.inventory ?? []} movements={data.movements ?? []} busy={busy} onMutate={mutate} />}
          {section === 'customers' && <CustomerWorkspace customers={pageRows} orders={data.orders ?? []} />}
          {section === 'promotions' && <PromotionWorkspace coupons={pageRows} busy={busy} onSubmit={submit} onMutate={mutate} value={value} setValue={setValue} />}
          {section === 'staff' && <StaffWorkspace staff={data.staff ?? []} customers={data.customers ?? []} grants={data.permissions ?? []} busy={busy} onMutate={mutate} value={value} setValue={setValue} />}
          {section === 'reports' && <ReportWorkspace />}
          {section === 'settings' && <SettingsWorkspace settings={data.settings ?? []} busy={busy} onSubmit={submit} value={value} setValue={setValue} />}

          {filtered.length > pageSize && <div className="flex items-center justify-between text-sm text-[#aaa69a]">
            <span>Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, filtered.length)} of {filtered.length}</span>
            <div className="flex gap-2">
              <button type="button" className="rounded-lg border border-white/10 px-3 py-2 disabled:opacity-40" onClick={() => setPage((current) => Math.max(0, current - 1))} disabled={page === 0}>Previous</button>
              <button type="button" className="rounded-lg border border-white/10 px-3 py-2 disabled:opacity-40" onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))} disabled={page >= pageCount - 1}>Next</button>
            </div>
          </div>}
        </div>
      )}
    </main>
  );
}

function OrderCard({ order, kitchen, canManageOrders, canManageKitchen, busy, onStatus }: { order: Row; kitchen: boolean; canManageOrders: boolean; canManageKitchen: boolean; busy: boolean; onStatus: (id: string, status: string) => void }) {
  const status = text(order, 'status', 'pending');
  const isDineIn = order.order_type === 'dine_in';
  const nextStatus: Record<string, string> = isDineIn
    ? { pending: 'confirmed', confirmed: 'preparing', preparing: 'ready', ready: 'served', served: 'completed' }
    : { pending: 'confirmed', confirmed: 'preparing', preparing: 'ready', ready: 'completed' };
  const statusLabels: Record<string, string> = { confirmed: 'Accepted' };
  const table = isRow(order.restaurant_table) ? text(order.restaurant_table, 'label', '') : '';
  const items = Array.isArray(order.items) ? order.items.filter(isRow) : [];
  const history = Array.isArray(order.status_history) ? order.status_history.filter(isRow) : [];
  const preparingAt = history.find((entry) => entry.to_status === 'preparing');
  const readyAt = history.find((entry) => entry.to_status === 'ready');
  const next = nextStatus[status];
  const canAdvance = Boolean(next) && (
    canManageOrders
    || (canManageKitchen && (next === 'preparing' || next === 'ready'))
  );
  return <article className={`rounded-xl border bg-black/20 p-4 ${status === 'pending' ? 'border-[#c9342e]/40' : 'border-white/10'}`}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{text(order, 'order_number')}</h3><span className="rounded-full bg-white/5 px-2.5 py-1 text-xs">{statusLabels[status] ?? status.replaceAll('_', ' ')}</span></div>
        <p className="mt-1 text-sm text-[#aaa69a]">{text(order, 'customer_name')} · {text(order, 'order_type').replaceAll('_', ' ')}{table ? ` · ${tableDisplayLabel(table)}` : ''}</p>
        <p className="mt-1 text-xs text-[#77746e]">{new Date(text(order, 'created_at')).toLocaleString()} · Payment {text(order, 'payment_status')}</p>
        {kitchen && (preparingAt || readyAt) && <p className="mt-1 text-xs text-[#e7b84b]">
          {preparingAt && `Preparation started ${new Date(text(preparingAt, 'created_at')).toLocaleTimeString()}`}
          {preparingAt && readyAt && ' · '}
          {readyAt && `Ready ${new Date(text(readyAt, 'created_at')).toLocaleTimeString()}`}
        </p>}
      </div>
      <div className="text-right"><p className="font-semibold">{money(amount(order, 'total'))}</p>{next && canAdvance && <button type="button" disabled={busy} onClick={() => onStatus(text(order, 'id'), next)} className="mt-2 rounded-full bg-[#c9342e] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">{next === 'confirmed' ? 'Accept order' : next === 'served' ? 'Mark served' : next === 'completed' && isDineIn ? 'Complete order' : next.replace('_', ' ')}</button>}{isDineIn && canManageOrders && ['pending', 'confirmed'].includes(status) && <button type="button" disabled={busy} onClick={() => onStatus(text(order, 'id'), 'cancelled')} className="mt-2 block w-full rounded-full border border-white/15 px-4 py-2 text-xs font-semibold text-[#ef8a7d] disabled:opacity-50">Reject order</button>}</div>
    </div>
    <details className="mt-3 border-t border-white/5 pt-3">
      <summary className="cursor-pointer text-xs text-[#e7b84b]">Order details · {items.length} line{items.length === 1 ? '' : 's'}</summary>
      <div className="mt-3 grid gap-2 text-sm">
        {items.map((item, index) => <p key={`${text(order, 'id')}-${index}`} className="text-[#d6d1c7]">{amount(item, 'quantity')} × {itemLabel(item.snapshot)}</p>)}
        <p className="text-xs text-[#8f8b82]">{text(order, 'customer_email')} · {text(order, 'customer_phone')}</p>
        {typeof order.notes === 'string' && order.notes && <p className="text-xs text-[#aaa69a]">Note: {order.notes}</p>}
      </div>
    </details>
  </article>;
}

function PaymentWorkspace({ orders, history, busy, onPaid, onRefund }: { orders: Row[]; history: Row[]; busy: boolean; onPaid: (order: Row) => void; onRefund: (payment: Row) => void }) {
  const due = orders.filter((order) => order.payment_status !== 'paid' && order.status !== 'cancelled');
  return <>
    <Panel title="Cash due" description="Only mark payment after cash has physically been received. Amount is checked against the server order total.">
      {due.length ? <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm">
        <thead className="text-xs uppercase text-[#77746e]"><tr><th className="py-3">Order</th><th>Customer</th><th>Collection</th><th className="text-right">Due</th><th /></tr></thead>
        <tbody>{due.map((order) => <tr key={text(order, 'id')} className="border-t border-white/5">
          <td className="py-3">{text(order, 'order_number')}</td><td>{text(order, 'customer_name')}</td><td className="capitalize">{text(order, 'cash_collection_point', text(order, 'order_type')).replaceAll('_', ' ')}</td><td className="text-right">{money(amount(order, 'total'))}</td>
          <td className="text-right"><button type="button" disabled={busy} onClick={() => onPaid(order)} className="rounded-full bg-[#c9342e] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Cash received</button></td>
        </tr>)}</tbody>
      </table></div> : <Empty>No unpaid orders in the current order feed.</Empty>}
    </Panel>
    <Panel title="Recorded cash payments" description="Receiver and timestamp are written by the database payment function.">
      {history.length ? <div className="overflow-x-auto"><table className="w-full min-w-[600px] text-left text-sm">
        <thead className="text-xs uppercase text-[#77746e]"><tr><th className="py-3">Order ID</th><th>Status</th><th>Amount</th><th>Received by</th><th>Received at</th><th /></tr></thead>
        <tbody>{history.map((payment) => <tr className="border-t border-white/5" key={text(payment, 'id')}><td className="py-3">{text(payment, 'order_id')}</td><td className="capitalize">{text(payment, 'status')}</td><td>{money(amount(payment, 'amount'))}</td><td>{text(payment, 'receiver_name', text(payment, 'received_by'))}</td><td>{new Date(text(payment, 'received_at')).toLocaleString()}</td><td>{text(payment, 'status') === 'paid' && <button type="button" disabled={busy} onClick={() => onRefund(payment)} className="text-xs text-[#ef8a7d] disabled:opacity-50">Refund</button>}</td></tr>)}</tbody>
      </table></div> : <Empty>No cash payments have been recorded yet.</Empty>}
    </Panel>
  </>;
}

function DeliveryWorkspace({ orders, zones, staff, role, busy, onUpdate }: { orders: Row[]; zones: Row[]; staff: Row[]; role: string; busy: boolean; onUpdate: (path: string, method: string, body?: unknown) => Promise<void> }) {
  const deliveryOrders = orders.filter((order) => order.order_type === 'delivery');
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [zoneName, setZoneName] = useState('');
  const [zoneFee, setZoneFee] = useState('');
  const [zoneMinimum, setZoneMinimum] = useState('');
  const [postalCodes, setPostalCodes] = useState('');
  const [zoneEdits, setZoneEdits] = useState<Record<string, { fee: string; minimum: string }>>({});
  return <>
    {role !== 'delivery' && <Panel title="Delivery zones" description="Fees and minimums are used by server-side order pricing.">
      <form onSubmit={(event) => {
        event.preventDefault();
        void onUpdate('/api/admin/zones', 'POST', { name: zoneName, fee: Number(zoneFee), minimum_order: Number(zoneMinimum || 0), postal_codes: postalCodes.split(',').map((code) => code.trim()).filter(Boolean) });
        setZoneName(''); setZoneFee(''); setZoneMinimum(''); setPostalCodes('');
      }} className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Field label="Zone name" value={zoneName} onChange={setZoneName} required />
        <Field label="Delivery fee" type="number" min="0" value={zoneFee} onChange={setZoneFee} required />
        <Field label="Minimum order" type="number" min="0" value={zoneMinimum} onChange={setZoneMinimum} />
        <Field label="Postal codes (comma-separated)" value={postalCodes} onChange={setPostalCodes} />
        <button disabled={busy} className="self-end rounded-xl bg-[#c9342e] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">Add zone</button>
      </form>
      {zones.length ? <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{zones.map((zone) => {
        const zoneId = text(zone, 'id');
        const edit = zoneEdits[zoneId] ?? { fee: String(amount(zone, 'fee')), minimum: String(amount(zone, 'minimum_order')) };
        return <div key={zoneId} className="rounded-xl border border-white/10 bg-black/20 p-4">
          <div className="flex items-start justify-between gap-2"><div><p className="font-medium">{text(zone, 'name')}</p><p className="mt-1 text-sm text-[#aaa69a]">{money(amount(zone, 'fee'))} delivery · {money(amount(zone, 'minimum_order'))} minimum</p></div>
            <button type="button" disabled={busy} onClick={() => onUpdate(`/api/admin/zones/${zoneId}`, 'PATCH', { is_active: !flag(zone, 'is_active') })} className="text-xs text-[#e7b84b]">{flag(zone, 'is_active') ? 'Active' : 'Inactive'}</button>
          </div>
          <form onSubmit={(event) => { event.preventDefault(); void onUpdate(`/api/admin/zones/${zoneId}`, 'PATCH', { fee: Number(edit.fee), minimum_order: Number(edit.minimum) }); }} className="mt-3 grid grid-cols-2 gap-2">
            <input aria-label="Delivery fee" className="field" type="number" min="0" value={edit.fee} onChange={(event) => setZoneEdits((current) => ({ ...current, [zoneId]: { ...edit, fee: event.target.value } }))} />
            <input aria-label="Minimum order" className="field" type="number" min="0" value={edit.minimum} onChange={(event) => setZoneEdits((current) => ({ ...current, [zoneId]: { ...edit, minimum: event.target.value } }))} />
            <button disabled={busy} className="col-span-2 rounded-lg border border-white/10 px-3 py-2 text-xs disabled:opacity-50">Save fees</button>
          </form>
        </div>;
      })}</div> : <Empty>No delivery zones configured.</Empty>}
    </Panel>}
    <Panel title="Delivery orders">
      {deliveryOrders.length ? <div className="grid gap-3">{deliveryOrders.map((order) => <article key={text(order, 'id')} className="rounded-xl border border-white/10 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">{text(order, 'order_number')} · {text(order, 'customer_name')}</h3><p className="mt-1 text-xs text-[#aaa69a]">{text(order, 'delivery_address_snapshot', text(order, 'delivery_address'))} · {text(order, 'delivery_status', text(order, 'status'))}</p></div><strong>{money(amount(order, 'total'))}</strong></div>
        {role === 'delivery' ? <div className="mt-3 flex gap-2">
          {(text(order, 'delivery_status') === 'assigned' ? ['picked_up'] : text(order, 'delivery_status') === 'picked_up' ? ['delivered', 'failed'] : []).map((status) => <button key={status} type="button" disabled={busy} onClick={() => onUpdate(`/api/orders/${text(order, 'id')}/delivery`, 'PATCH', { status })} className="rounded-full border border-white/15 px-4 py-2 text-xs capitalize disabled:opacity-50">{status.replace('_', ' ')}</button>)}
        </div> : <div className="mt-3 flex flex-wrap gap-2"><select className="field max-w-xs" value={assignments[text(order, 'id')] ?? text(order, 'delivery_staff_id', '')} onChange={(event) => setAssignments((current) => ({ ...current, [text(order, 'id')]: event.target.value }))}>
          <option value="">Select delivery staff</option>{staff.map((member) => <option key={text(member, 'id')} value={text(member, 'id')}>{text(member, 'full_name', text(member, 'email'))}</option>)}
        </select>
        <button type="button" disabled={busy || !(assignments[text(order, 'id')] ?? text(order, 'delivery_staff_id', ''))} onClick={() => onUpdate(`/api/orders/${text(order, 'id')}/delivery`, 'PATCH', { status: 'assigned', delivery_staff_id: assignments[text(order, 'id')] ?? text(order, 'delivery_staff_id') })} className="rounded-full border border-white/15 px-4 py-2 text-xs disabled:opacity-40">Assign</button></div>
        }
      </article>)}</div> : <Empty>No delivery orders in the current order feed.</Empty>}
    </Panel>
  </>;
}

function MenuWorkspace({ products, categories, busy, onMutate }: { products: Row[]; categories: Row[]; busy: boolean; onMutate: (path: string, method: string, body?: unknown) => Promise<void> }) {
  const [categoryName, setCategoryName] = useState('');
  const [categorySlug, setCategorySlug] = useState('');
  const [productName, setProductName] = useState('');
  const [productPrice, setProductPrice] = useState('');
  const [productCategory, setProductCategory] = useState('');
  const [productImage, setProductImage] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [productOptions, setProductOptions] = useState('');
  const [productAddons, setProductAddons] = useState('');
  const [localError, setLocalError] = useState('');
  const [editingProduct, setEditingProduct] = useState<Row | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editImage, setEditImage] = useState('');
  const [editVariants, setEditVariants] = useState('');
  const [editAddons, setEditAddons] = useState('');

  async function createCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onMutate('/api/admin/categories', 'POST', { name: categoryName, slug: categorySlug });
    setCategoryName(''); setCategorySlug('');
  }
  async function createProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError('');
    try {
      let imageUrl: string | null = productImage || null;
      if (imageFile) {
        const formData = new FormData();
        formData.set('image', imageFile);
        const upload = await fetch('/api/admin/product-images', { method: 'POST', body: formData });
        const uploadResult: unknown = await upload.json();
        const parsedUpload = z.object({ url: z.string().url() }).safeParse(uploadResult);
        if (!upload.ok || !parsedUpload.success) throw new Error('Product image upload failed.');
        imageUrl = parsedUpload.data.url;
      }
      const parseOptions = (raw: string, key: 'name' | 'price') => raw.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
        const [name, rawPrice] = line.split('|').map((part) => part.trim());
        const price = Number(rawPrice);
        if (!name || !Number.isFinite(price) || price < 0) throw new Error('Use one option per line in the format Name | price.');
        return key === 'price' ? { name, price } : { name, price_delta: price };
      });
      const variants = parseOptions(productOptions, 'name');
      const addons = parseOptions(productAddons, 'price');
      await onMutate('/api/products', 'POST', {
        name: productName,
        slug: productName.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
        base_price: Number(productPrice),
        category_id: productCategory || null,
        image_url: imageUrl,
        variants,
        addons,
      });
      setProductName(''); setProductPrice(''); setProductImage(''); setImageFile(null); setProductOptions(''); setProductAddons('');
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'Unable to create product.');
    }
  }
  function optionLines(value: unknown, priceKey: 'price_delta' | 'price') {
    if (!Array.isArray(value)) return '';
    return value.filter(isRow).map((option) => `${text(option, 'name', '')} | ${amount(option, priceKey)}`).join('\n');
  }
  function beginEdit(product: Row) {
    setEditingProduct(product);
    setEditName(text(product, 'name', ''));
    setEditDescription(text(product, 'description', ''));
    setEditPrice(String(amount(product, 'base_price')));
    setEditCategory(text(product, 'category_id', ''));
    setEditImage(text(product, 'image_url', ''));
    setEditVariants(optionLines(product.variants, 'price_delta'));
    setEditAddons(optionLines(product.addons, 'price'));
  }
  async function saveProductEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingProduct) return;
    setLocalError('');
    try {
      const parseOptions = (raw: string, type: 'variant' | 'addon') => raw.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
        const [name, rawPrice] = line.split('|').map((part) => part.trim());
        const price = Number(rawPrice);
        if (!name || !Number.isFinite(price) || price < 0) throw new Error('Use one option per line in the format Name | price.');
        return type === 'variant'
          ? { name, price_delta: price, is_available: true }
          : { name, price, is_available: true };
      });
      await onMutate(`/api/products/${text(editingProduct, 'id')}`, 'PATCH', {
        name: editName,
        description: editDescription,
        base_price: Number(editPrice),
        category_id: editCategory || null,
        image_url: editImage || null,
        variants: parseOptions(editVariants, 'variant'),
        addons: parseOptions(editAddons, 'addon'),
      });
      setEditingProduct(null);
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'Unable to save product.');
    }
  }
  return <>
    {localError && <p role="alert" className="rounded-xl border border-[#ef8a7d]/30 bg-[#ef8a7d]/10 p-4 text-sm text-[#ef8a7d]">{localError}</p>}
    <Panel title="Add product" description="Variants and add-ons use one line each: Name | price. Prices are validated by the server.">
      <form onSubmit={createProduct} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Field label="Product name" value={productName} onChange={setProductName} required />
        <Field label="Base price" type="number" min="0" value={productPrice} onChange={setProductPrice} required />
        <label className="grid gap-1.5 text-xs text-[#aaa69a]">Category<select className="field" value={productCategory} onChange={(event) => setProductCategory(event.target.value)}><option value="">No category</option>{categories.map((category) => <option key={text(category, 'id')} value={text(category, 'id')}>{text(category, 'name')}</option>)}</select></label>
        <Field label="Image URL (optional)" value={productImage} onChange={setProductImage} />
        <label className="grid gap-1.5 text-xs text-[#aaa69a]">Upload image<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setImageFile(event.target.files?.[0] ?? null)} className="text-xs" /></label>
        <button disabled={busy} className="rounded-xl bg-[#c9342e] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">Create product</button>
        <label className="grid gap-1.5 text-xs text-[#aaa69a]">Variants<textarea className="field" rows={3} value={productOptions} onChange={(event) => setProductOptions(event.target.value)} placeholder={'Large | 3.00\\nGluten-free | 2.00'} /></label>
        <label className="grid gap-1.5 text-xs text-[#aaa69a]">Add-ons<textarea className="field" rows={3} value={productAddons} onChange={(event) => setProductAddons(event.target.value)} placeholder={'Extra cheese | 1.50'} /></label>
      </form>
    </Panel>
    <Panel title="Categories">
      <form onSubmit={createCategory} className="mb-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <Field label="Category name" value={categoryName} onChange={(next) => { setCategoryName(next); if (!categorySlug || categorySlug === categoryName.toLowerCase().replace(/[^a-z0-9]+/g, '-')) setCategorySlug(next.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')); }} required />
        <Field label="URL slug" value={categorySlug} onChange={setCategorySlug} required />
        <button disabled={busy} className="self-end rounded-xl border border-white/15 px-4 py-3 text-sm disabled:opacity-50">Add category</button>
      </form>
      <div className="grid gap-2 sm:grid-cols-2">{categories.map((category) => <div key={text(category, 'id')} className="rounded-xl border border-white/10 bg-black/20 p-3">
        <div className="flex items-center justify-between gap-2"><strong className="text-sm">{text(category, 'name')}</strong><button type="button" disabled={busy} onClick={() => onMutate(`/api/admin/categories/${text(category, 'id')}`, 'PATCH', { is_active: !flag(category, 'is_active') })} className="text-xs text-[#e7b84b]">{flag(category, 'is_active') ? 'Active' : 'Inactive'}</button></div>
        <form onSubmit={(event) => {
          event.preventDefault();
          const values = new FormData(event.currentTarget);
          void onMutate(`/api/admin/categories/${text(category, 'id')}`, 'PATCH', { name: values.get('name'), slug: values.get('slug') });
        }} className="mt-3 grid grid-cols-[1fr_1fr_auto] gap-2">
          <input name="name" className="field" aria-label="Category name" defaultValue={text(category, 'name', '')} required maxLength={100} />
          <input name="slug" className="field" aria-label="Category slug" defaultValue={text(category, 'slug', '')} required maxLength={100} />
          <button disabled={busy} className="rounded-lg border border-white/10 px-3 text-xs disabled:opacity-50">Save</button>
        </form>
        <button type="button" disabled={busy} onClick={() => { if (window.confirm(`Delete category ${text(category, 'name')}? Products will remain but become uncategorized.`)) onMutate(`/api/admin/categories/${text(category, 'id')}`, 'DELETE'); }} className="mt-2 text-xs text-[#ef8a7d]">Delete category</button>
      </div>)}</div>
      {!categories.length && <Empty>No categories created.</Empty>}
    </Panel>
    <Panel title="Menu products">
      {editingProduct && <form onSubmit={saveProductEdit} className="mb-5 grid gap-3 rounded-xl border border-[#e7b84b]/20 bg-black/20 p-4 sm:grid-cols-2">
        <p className="font-semibold sm:col-span-2">Edit {text(editingProduct, 'name')}</p>
        <Field label="Product name" value={editName} onChange={setEditName} required />
        <Field label="Base price" type="number" min="0" value={editPrice} onChange={setEditPrice} required />
        <label className="grid gap-1.5 text-xs text-[#aaa69a]">Category<select className="field" value={editCategory} onChange={(event) => setEditCategory(event.target.value)}><option value="">No category</option>{categories.map((category) => <option key={text(category, 'id')} value={text(category, 'id')}>{text(category, 'name')}</option>)}</select></label>
        <Field label="Image URL" value={editImage} onChange={setEditImage} />
        <label className="grid gap-1.5 text-xs text-[#aaa69a] sm:col-span-2">Description<textarea className="field" rows={2} value={editDescription} onChange={(event) => setEditDescription(event.target.value)} /></label>
        <label className="grid gap-1.5 text-xs text-[#aaa69a]">Variants · Name | price<textarea className="field" rows={3} value={editVariants} onChange={(event) => setEditVariants(event.target.value)} /></label>
        <label className="grid gap-1.5 text-xs text-[#aaa69a]">Add-ons · Name | price<textarea className="field" rows={3} value={editAddons} onChange={(event) => setEditAddons(event.target.value)} /></label>
        <div className="flex gap-2 sm:col-span-2"><button disabled={busy} className="rounded-full bg-[#c9342e] px-4 py-2 text-sm text-white disabled:opacity-50">Save product</button><button type="button" onClick={() => setEditingProduct(null)} className="rounded-full border border-white/15 px-4 py-2 text-sm">Cancel</button></div>
      </form>}
      {products.length ? <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left text-sm"><thead className="text-xs uppercase text-[#77746e]"><tr><th className="py-3">Product</th><th>Category</th><th>Price</th><th>Featured</th><th>Availability</th><th>Manage</th><th /></tr></thead><tbody>
        {products.map((product) => <tr key={text(product, 'id')} className="border-t border-white/5">
          <td className="py-3"><div className="flex items-center gap-3">{text(product, 'image_url', '') && <img src={text(product, 'image_url', '')} alt="" className="h-10 w-10 rounded-lg object-cover" />}<span>{text(product, 'name')}</span></div></td>
          <td>{isRow(product.category) ? text(product.category, 'name') : '—'}</td><td>{money(amount(product, 'base_price'))}</td>
          <td><button type="button" disabled={busy} onClick={() => onMutate(`/api/products/${text(product, 'id')}`, 'PATCH', { is_featured: !flag(product, 'is_featured') })} className="text-xs text-[#e7b84b]">{flag(product, 'is_featured') ? 'Featured' : 'Not featured'}</button></td>
          <td><button type="button" disabled={busy} onClick={() => onMutate(`/api/products/${text(product, 'id')}`, 'PATCH', { is_available: !flag(product, 'is_available') })} className="text-xs">{flag(product, 'is_available') ? 'Available' : 'Unavailable'}</button></td>
          <td><button type="button" disabled={busy} onClick={() => beginEdit(product)} className="text-xs text-[#e7b84b]">Edit</button></td>
          <td><button type="button" disabled={busy} onClick={() => { if (window.confirm(`Delete ${text(product, 'name')}? Historical order snapshots are retained.`)) onMutate(`/api/products/${text(product, 'id')}`, 'DELETE'); }} className="text-xs text-[#ef8a7d]">Delete</button></td>
        </tr>)}
      </tbody></table></div> : <Empty>No products found.</Empty>}
    </Panel>
  </>;
}

function InventoryWorkspace({ items, movements, busy, onMutate }: { items: Row[]; movements: Row[]; busy: boolean; onMutate: (path: string, method: string, body?: unknown) => Promise<void> }) {
  const [adjust, setAdjust] = useState<Record<string, string>>({});
  const [reorder, setReorder] = useState<Record<string, string>>({});
  return <>
    <Panel title="Stock levels" description="Low-stock warnings use each item’s configured reorder level.">
      {items.length ? <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm">
        <thead className="text-xs uppercase text-[#77746e]"><tr><th className="py-3">Inventory item</th><th>SKU</th><th>On hand</th><th>Reorder at</th><th>Stock status</th><th>Adjustment</th></tr></thead>
        <tbody>{items.map((item) => {
          const low = amount(item, 'quantity_on_hand') <= amount(item, 'reorder_level');
          return <tr key={text(item, 'id')} className="border-t border-white/5"><td className="py-3">{text(item, 'product_name_snapshot')}</td><td>{text(item, 'sku', '—')}</td><td>{amount(item, 'quantity_on_hand')} {text(item, 'unit', '')}</td><td>
              <div className="flex items-center gap-2"><span>{amount(item, 'reorder_level')}</span><input aria-label="Set reorder level" className="field w-20" type="number" min="0" value={reorder[text(item, 'id')] ?? String(amount(item, 'reorder_level'))} onChange={(event) => setReorder((current) => ({ ...current, [text(item, 'id')]: event.target.value }))} /><button type="button" disabled={busy} onClick={() => onMutate(`/api/admin/inventory/${text(item, 'id')}`, 'PATCH', { reorder_level: Number(reorder[text(item, 'id')] ?? amount(item, 'reorder_level')) })} className="text-xs text-[#e7b84b]">Save</button></div>
            </td><td className={low ? 'text-[#ef8a7d]' : 'text-emerald-300'}>{low ? 'Low stock' : 'In stock'}</td><td>
              <div className="flex gap-2"><input className="field w-24" type="number" value={adjust[text(item, 'id')] ?? ''} onChange={(event) => setAdjust((current) => ({ ...current, [text(item, 'id')]: event.target.value }))} placeholder="+/- qty" />
                <button type="button" disabled={busy || !adjust[text(item, 'id')] || text(item, 'product_id', '') === ''} onClick={() => { const quantity = Number(adjust[text(item, 'id')]); if (!Number.isInteger(quantity) || quantity === 0) return; onMutate('/api/admin/inventory', 'POST', { product_id: text(item, 'product_id'), quantity_delta: quantity, reason: 'Dashboard stock adjustment' }); setAdjust((current) => ({ ...current, [text(item, 'id')]: '' })); }} className="rounded-lg border border-white/10 px-3 text-xs disabled:opacity-40">Adjust</button>
              </div>
          </td></tr>;
        })}</tbody>
      </table></div> : <Empty>No inventory records found.</Empty>}
    </Panel>
    <Panel title="Recent stock movements">
      {movements.length ? <div className="grid gap-2">{movements.slice(0, 20).map((movement) => <div key={text(movement, 'id')} className="flex flex-wrap justify-between gap-2 border-b border-white/5 py-2 text-sm"><span>{text(movement, 'product_name_snapshot')} · {text(movement, 'reason')}</span><span className="text-[#aaa69a]">{amount(movement, 'quantity_delta') > 0 ? '+' : ''}{amount(movement, 'quantity_delta')} · {new Date(text(movement, 'created_at')).toLocaleString()}</span></div>)}</div> : <Empty>No stock movement history.</Empty>}
    </Panel>
  </>;
}

function CustomerWorkspace({ customers, orders }: { customers: Row[]; orders: Row[] }) {
  return <Panel title="Customer directory" description="Select a customer row to inspect order history and lifetime value.">
    {customers.length ? <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm">
      <thead className="text-xs uppercase text-[#77746e]"><tr><th className="py-3">Name</th><th>Email</th><th>Phone</th><th>Orders</th><th>Lifetime total</th><th>Order history</th></tr></thead><tbody>
      {customers.map((customer) => {
        const customerOrders = orders.filter((order) => order.customer_id === customer.id);
        return <tr key={text(customer, 'id')} className="border-t border-white/5 align-top">
          <td className="py-3">{text(customer, 'full_name')}</td><td>{text(customer, 'email')}</td><td>{text(customer, 'phone')}</td><td>{customerOrders.length}</td><td>{money(customerOrders.reduce((sum, order) => sum + amount(order, 'total'), 0))}</td>
          <td><details><summary className="cursor-pointer text-[#e7b84b]">View orders</summary><div className="mt-2 grid gap-2">{customerOrders.map((order) => <p key={text(order, 'id')} className="text-xs">{text(order, 'order_number')} · {text(order, 'status')} · {money(amount(order, 'total'))}</p>)}</div></details></td>
        </tr>;
      })}
    </tbody></table></div> : <Empty>No customer accounts found.</Empty>}
  </Panel>;
}

function PromotionWorkspace({ coupons, busy, onSubmit, onMutate, value, setValue }: {
  coupons: Row[]; busy: boolean; onSubmit: (event: FormEvent<HTMLFormElement>, path: string, body: unknown) => Promise<void>; onMutate: (path: string, method: string, body?: unknown) => Promise<void>; value: (key: string) => string; setValue: (key: string, next: string) => void;
}) {
  return <>
    <Panel title="Create coupon" description="Discount validation and redemption limits are enforced by the order transaction.">
      <form onSubmit={(event) => onSubmit(event, '/api/admin/coupons', {
        code: value('code').toUpperCase(), discount_type: value('discount_type') || 'percent',
        discount_value: Number(value('discount_value')), minimum_order: Number(value('minimum_order') || 0),
        usage_limit: value('usage_limit') ? Number(value('usage_limit')) : null,
        starts_at: value('starts_at') ? new Date(value('starts_at')).toISOString() : null,
        ends_at: value('ends_at') ? new Date(value('ends_at')).toISOString() : null,
      })} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Field label="Coupon code" value={value('code')} onChange={(next) => setValue('code', next)} required />
        <label className="grid gap-1.5 text-xs text-[#aaa69a]">Discount type<select className="field" value={value('discount_type') || 'percent'} onChange={(event) => setValue('discount_type', event.target.value)}><option value="percent">Percent</option><option value="fixed">Fixed amount</option></select></label>
        <Field label="Discount value" type="number" min="0.01" value={value('discount_value')} onChange={(next) => setValue('discount_value', next)} required />
        <Field label="Minimum order" type="number" min="0" value={value('minimum_order')} onChange={(next) => setValue('minimum_order', next)} />
        <Field label="Usage limit (blank = unlimited)" type="number" min="0" value={value('usage_limit')} onChange={(next) => setValue('usage_limit', next)} />
        <Field label="Starts at" type="datetime-local" value={value('starts_at')} onChange={(next) => setValue('starts_at', next)} />
        <Field label="Expires at" type="datetime-local" value={value('ends_at')} onChange={(next) => setValue('ends_at', next)} />
        <button disabled={busy} className="self-end rounded-xl bg-[#c9342e] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">Create coupon</button>
      </form>
    </Panel>
    <Panel title="Coupons">
      {coupons.length ? <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="text-xs uppercase text-[#77746e]"><tr><th className="py-3">Code</th><th>Discount</th><th>Minimum</th><th>Uses</th><th>Validity</th><th>Enabled</th></tr></thead>                  <tbody>{coupons.map((coupon) => <tr key={text(coupon, 'id')} className="border-t border-white/5"><td className="py-3 font-semibold">{text(coupon, 'code')}</td><td>{text(coupon, 'discount_type') === 'percent' ? `${amount(coupon, 'discount_value')}%` : money(amount(coupon, 'discount_value'))}</td><td>{money(amount(coupon, 'minimum_order'))}</td><td>{text(coupon, 'usage_limit', 'Unlimited')}</td><td className="text-xs">{text(coupon, 'starts_at', 'Any start')} – {text(coupon, 'ends_at', 'No expiry')}</td><td><button type="button" disabled={busy} onClick={() => onMutate(`/api/admin/coupons/${text(coupon, 'id')}`, 'PATCH', { is_active: !flag(coupon, 'is_active') })} className="text-xs text-[#e7b84b]">{flag(coupon, 'is_active') ? 'Active' : 'Paused'}</button></td>
        <td><details><summary className="cursor-pointer text-xs text-[#e7b84b]">Edit</summary><form onSubmit={(event) => {
          event.preventDefault();
          const values = new FormData(event.currentTarget);
          const start = String(values.get('starts_at') ?? '');
          const end = String(values.get('ends_at') ?? '');
          void onMutate(`/api/admin/coupons/${text(coupon, 'id')}`, 'PATCH', {
            code: values.get('code'), discount_type: values.get('discount_type'),
            discount_value: Number(values.get('discount_value')), minimum_order: Number(values.get('minimum_order')),
            usage_limit: values.get('usage_limit') ? Number(values.get('usage_limit')) : null,
            maximum_discount: values.get('maximum_discount') ? Number(values.get('maximum_discount')) : null,
            starts_at: start ? new Date(start).toISOString() : null,
            ends_at: end ? new Date(end).toISOString() : null,
          });
        }} className="absolute z-10 mt-2 grid w-64 gap-2 rounded-xl border border-white/10 bg-[#181817] p-3 shadow-2xl">
          <input name="code" className="field" aria-label="Coupon code" defaultValue={text(coupon, 'code', '')} required />
          <select name="discount_type" className="field" defaultValue={text(coupon, 'discount_type', 'percent')}><option value="percent">Percent</option><option value="fixed">Fixed</option></select>
          <input name="discount_value" className="field" aria-label="Discount value" type="number" min="0.01" defaultValue={amount(coupon, 'discount_value')} required />
          <input name="minimum_order" className="field" aria-label="Minimum order" type="number" min="0" defaultValue={amount(coupon, 'minimum_order')} />
          <input name="usage_limit" className="field" aria-label="Usage limit" type="number" min="0" defaultValue={text(coupon, 'usage_limit', '') === 'Unlimited' ? '' : text(coupon, 'usage_limit', '')} placeholder="Unlimited" />
          <input name="maximum_discount" className="field" aria-label="Maximum discount" type="number" min="0" defaultValue={coupon.maximum_discount == null ? '' : String(coupon.maximum_discount)} placeholder="No cap" />
          <input name="starts_at" className="field" aria-label="Starts at" type="datetime-local" defaultValue={text(coupon, 'starts_at', '').slice(0, 16)} />
          <input name="ends_at" className="field" aria-label="Expires at" type="datetime-local" defaultValue={text(coupon, 'ends_at', '').slice(0, 16)} />
          <button disabled={busy} className="rounded-lg bg-[#c9342e] px-3 py-2 text-xs font-semibold text-white">Save coupon</button>
        </form></details></td>
        <td><button type="button" disabled={busy} onClick={() => { if (window.confirm(`Delete coupon ${text(coupon, 'code')}? Existing order snapshots are retained.`)) onMutate(`/api/admin/coupons/${text(coupon, 'id')}`, 'DELETE'); }} className="text-xs text-[#ef8a7d]">Delete</button></td></tr>)}</tbody></table></div> : <Empty>No coupons configured.</Empty>}
    </Panel>
  </>;
}

function StaffWorkspace({ staff, customers, grants, busy, onMutate, value, setValue }: {
  staff: Row[]; customers: Row[]; grants: Row[]; busy: boolean; onMutate: (path: string, method: string, body?: unknown) => Promise<void>; value: (key: string) => string; setValue: (key: string, next: string) => void;
}) {
  return <>
    <Panel title="Assign a registered account" description="For security, staff first create an account through customer registration; an owner then promotes it here.">
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <label className="grid gap-1.5 text-xs text-[#aaa69a]">Registered account<select className="field" value={value('staff_id')} onChange={(event) => setValue('staff_id', event.target.value)} required><option value="">Select a registered account</option>{customers.map((customer) => <option key={text(customer, 'id')} value={text(customer, 'id')}>{text(customer, 'full_name')} · {text(customer, 'email')}</option>)}</select></label>
        <label className="grid gap-1.5 text-xs text-[#aaa69a]">Role<select className="field" value={value('staff_role') || 'manager'} onChange={(event) => setValue('staff_role', event.target.value)}><option value="manager">Manager</option><option value="cashier">Cashier</option><option value="delivery">Delivery</option><option value="kitchen">Kitchen (requires migration 004)</option></select></label>
        <button type="button" disabled={busy} onClick={() => onMutate('/api/admin/staff', 'POST', { id: value('staff_id'), role: value('staff_role') || 'manager' })} className="self-end rounded-xl bg-[#c9342e] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">Assign role</button>
      </div>
    </Panel>
    <Panel title="Staff directory">
      {staff.length ? <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="text-xs uppercase text-[#77746e]"><tr><th className="py-3">Staff member</th><th>Email</th><th>Role</th><th>Joined</th><th /></tr></thead><tbody>{staff.map((member) => <tr key={text(member, 'id')} className="border-t border-white/5"><td className="py-3">{text(member, 'full_name')}</td><td>{text(member, 'email')}</td><td>
        <select className="field max-w-[150px]" value={text(member, 'role')} disabled={busy || text(member, 'role') === 'admin'} onChange={(event) => onMutate('/api/admin/staff', 'POST', { id: text(member, 'id'), role: event.target.value })}>
          <option value="manager">Manager</option><option value="cashier">Cashier</option><option value="delivery">Delivery</option><option value="kitchen">Kitchen</option>
        </select>
      </td><td>{new Date(text(member, 'created_at')).toLocaleDateString()}</td><td><button type="button" disabled={busy || text(member, 'role') === 'admin'} onClick={() => { if (window.confirm(`Remove ${text(member, 'full_name')} from staff?`)) onMutate(`/api/admin/staff/${text(member, 'id')}`, 'DELETE'); }} className="text-xs text-[#ef8a7d] disabled:opacity-40">Remove</button></td></tr>)}</tbody></table></div> : <Empty>No staff accounts yet.</Empty>}
    </Panel>
    <Panel title="Permission grants" description="Permission grants are enforced by server-side RPCs and RLS policies.">
      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]"><Field label="Staff profile UUID" value={value('permission_staff_id')} onChange={(next) => setValue('permission_staff_id', next)} required />
        <label className="grid gap-1.5 text-xs text-[#aaa69a]">Permission<select className="field" value={value('permission_key') || permissions[0]} onChange={(event) => setValue('permission_key', event.target.value)}>{permissions.map((permission) => <option key={permission}>{permission}</option>)}</select></label>
        <button type="button" disabled={busy} onClick={() => onMutate('/api/admin/permissions', 'POST', { profile_id: value('permission_staff_id'), permission_key: value('permission_key') || permissions[0] })} className="self-end rounded-xl border border-white/15 px-4 py-3 text-sm disabled:opacity-50">Grant access</button>
      </div>
      {grants.length ? <div className="grid gap-2">{grants.map((grant) => <div key={text(grant, 'id')} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-black/20 px-3 py-2 text-xs"><span>{text(grant, 'profile_id')} · {text(grant, 'permission_key')}</span><button type="button" disabled={busy} onClick={() => onMutate(`/api/admin/permissions/${text(grant, 'id')}`, 'DELETE')} className="text-[#ef8a7d]">Revoke</button></div>)}</div> : <Empty>No explicit grants.</Empty>}
    </Panel>
  </>;
}

function ReportWorkspace() {
  const [period, setPeriod] = useState('week');
  const [report, setReport] = useState<Row | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    requestJson(`/api/admin/reports?period=${period}`)
      .then((response) => {
        if (!isRow(response.reports)) throw new Error('The report response was invalid.');
        if (active) setReport(response.reports);
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load reports.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [period]);

  const sales = Array.isArray(report?.daily_sales) ? report.daily_sales.filter(isRow) : [];
  const bestSellers = Array.isArray(report?.best_sellers) ? report.best_sellers.filter(isRow) : [];
  const types = Array.isArray(report?.order_type_counts) ? report.order_type_counts.filter(isRow) : [];
  const maxSales = Math.max(1, ...sales.map((item) => Number(item.sales ?? 0)));
  return <>
    <div className="flex gap-2">{[['day', 'Today'], ['week', '7 days'], ['month', '30 days']].map(([value, label]) => <button key={value} type="button" onClick={() => setPeriod(value)} className={`rounded-full px-4 py-2 text-sm ${period === value ? 'bg-[#c9342e] text-white' : 'border border-white/10 text-[#aaa69a]'}`}>{label}</button>)}</div>
    {error && <p role="alert" className="rounded-xl border border-[#ef8a7d]/30 bg-[#ef8a7d]/10 p-4 text-sm text-[#ef8a7d]">{error}</p>}
    {loading ? <p role="status" className="py-8 text-center text-sm text-[#aaa69a]">Loading aggregated report…</p> : report && <>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[['Orders', amount(report, 'order_count').toString()], ['Paid revenue', money(amount(report, 'paid_revenue'))], ['Cash received', money(amount(report, 'cash_received'))], ['Completed orders', amount(report, 'completed_count').toString()]].map(([label, total]) => <div key={label} className="rounded-2xl border border-white/10 bg-[#151514] p-5"><p className="text-sm text-[#aaa69a]">{label}</p><p className="mt-2 text-2xl font-semibold">{total}</p></div>)}
      </section>
      <Panel title="Daily paid sales">
        {sales.length ? <div className="flex h-56 items-end gap-2 border-b border-white/10 px-2">
          {sales.map((item) => <div key={text(item, 'day')} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
            <span className="text-[10px] text-[#aaa69a]">{money(Number(item.sales ?? 0))}</span>
            <div className="w-full max-w-12 rounded-t-md bg-gradient-to-t from-[#c9342e] to-[#e7b84b]" style={{ height: `${Math.max(3, (Number(item.sales ?? 0) / maxSales) * 70)}%` }} />
            <span className="text-[10px] text-[#8f8b82]">{new Date(text(item, 'day')).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
          </div>)}
        </div> : <Empty>No sales for this period.</Empty>}
      </Panel>
      <Panel title="Revenue and orders by type">
        {types.length ? <div className="grid gap-3 sm:grid-cols-3">{types.map((item) => <div key={text(item, 'type')} className="rounded-xl bg-black/20 p-4"><p className="capitalize text-[#aaa69a]">{text(item, 'type').replaceAll('_', ' ')}</p><p className="mt-2 text-xl font-semibold">{money(Number(item.revenue ?? 0))}</p><p className="mt-1 text-xs text-[#8f8b82]">{amount(item, 'orders')} orders</p></div>)}</div> : <Empty>No orders in this period.</Empty>}
      </Panel>
      <Panel title="Best-selling products">
        {bestSellers.length ? <div className="grid gap-2">{bestSellers.map((item) => <div key={text(item, 'name')} className="flex justify-between rounded-lg bg-black/20 px-4 py-3 text-sm"><span>{text(item, 'name')}</span><strong>{amount(item, 'quantity')} sold</strong></div>)}</div> : <Empty>No sales data for this period.</Empty>}
      </Panel>
    </>}
  </>;
}

function SettingsWorkspace({ settings, busy, onSubmit, value, setValue }: {
  settings: Row[]; busy: boolean; onSubmit: (event: FormEvent<HTMLFormElement>, path: string, body: unknown) => Promise<void>; value: (key: string) => string; setValue: (key: string, next: string) => void;
}) {
  const [localError, setLocalError] = useState('');
  return <>
    <Panel title="Update restaurant setting" description="Values are JSON so opening hours and contact details can be represented without schema changes.">
      <form onSubmit={(event) => {
        event.preventDefault();
        setLocalError('');
        try {
          void onSubmit(event, '/api/admin/settings', { key: value('setting_key'), value: JSON.parse(value('setting_value')) });
        } catch {
          setLocalError('Setting value must be valid JSON.');
        }
      }} className="grid gap-3 sm:grid-cols-[1fr_2fr_auto]">
        <Field label="Key" value={value('setting_key')} onChange={(next) => setValue('setting_key', next)} required placeholder="restaurant.contact" />
        <label className="grid gap-1.5 text-xs text-[#aaa69a]">JSON value<textarea className="field" rows={2} value={value('setting_value')} onChange={(event) => setValue('setting_value', event.target.value)} required placeholder={'{"phone":"+1 800 555 0180"}'} /></label>
        <button disabled={busy} className="self-end rounded-xl bg-[#c9342e] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">Save setting</button>
      </form>
      {localError && <p role="alert" className="mt-3 text-sm text-[#ef8a7d]">{localError}</p>}
    </Panel>
    <Panel title="Saved settings">
      {settings.length ? <div className="grid gap-2">{settings.map((setting) => <div key={text(setting, 'key')} className="grid gap-2 rounded-lg bg-black/20 p-3 sm:grid-cols-[1fr_2fr]"><strong className="text-sm">{text(setting, 'key')}</strong><pre className="overflow-x-auto whitespace-pre-wrap text-xs text-[#aaa69a]">{JSON.stringify(setting.value, null, 2)}</pre></div>)}</div> : <Empty>No restaurant settings saved.</Empty>}
    </Panel>
  </>;
}
