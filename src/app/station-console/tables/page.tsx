'use client';

import Link from 'next/link';
import QRCode from 'qrcode';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { z } from 'zod';
import { money } from '@/lib/menu';
import { adminPath } from '@/lib/admin-path';

const sessionSummarySchema = z.object({
  id: z.string().uuid(),
  started_at: z.string(),
  expires_at: z.string(),
  ended_at: z.string().nullable(),
});
const tableSchema = z.object({
  id: z.string().uuid(),
  label: z.string(),
  section: z.string().nullable().optional(),
  capacity: z.number().nullable().optional(),
  is_active: z.boolean(),
  current_session: sessionSummarySchema.nullable(),
});
const tablesSchema = z.object({ tables: z.array(tableSchema) });
const itemSchema = z.object({
  quantity: z.number(),
  snapshot: z.unknown(),
});
const orderSchema = z.object({
  id: z.string().uuid(),
  order_number: z.string(),
  customer_name: z.string(),
  status: z.string(),
  payment_status: z.string(),
  total: z.union([z.number(), z.string()]),
  created_at: z.string(),
  items: z.array(itemSchema),
});
const sessionSchema = z.object({
  id: z.string().uuid(),
  started_at: z.string(),
  expires_at: z.string(),
  ended_at: z.string().nullable(),
  orders: z.array(orderSchema),
});
const sessionsSchema = z.object({ sessions: z.array(sessionSchema) });
const apiErrorSchema = z.object({ error: z.string() });

type Table = z.infer<typeof tableSchema>;
type TableSession = z.infer<typeof sessionSchema>;
type GeneratedQr = { label: string; url: string; image: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function snapshotDescription(snapshot: unknown) {
  if (!isRecord(snapshot)) return 'Menu item';
  const record = snapshot;
  const name = typeof record.name === 'string' ? record.name : 'Menu item';
  const variantName = isRecord(record.variant) && typeof record.variant.name === 'string'
    ? ` (${record.variant.name})`
    : '';
  const addons = Array.isArray(record.addons)
    ? record.addons.flatMap((addon) => isRecord(addon) && typeof addon.name === 'string' ? [addon.name] : [])
    : [];
  return `${name}${variantName}${addons.length ? ` + ${addons.join(', ')}` : ''}`;
}

async function responseJson(response: Response) {
  const result: unknown = await response.json();
  if (!response.ok) {
    const parsedError = apiErrorSchema.safeParse(result);
    throw new Error(parsedError.success ? parsedError.data.error : 'The request could not be completed.');
  }
  return result;
}

export default function AdminTablesPage() {
  const [tables, setTables] = useState<Table[]>([]);
  const [sessions, setSessions] = useState<TableSession[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [generatedQr, setGeneratedQr] = useState<GeneratedQr | null>(null);
  const [label, setLabel] = useState('');
  const [section, setSection] = useState('');
  const [capacity, setCapacity] = useState('');
  const [editingTable, setEditingTable] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editSection, setEditSection] = useState('');
  const [editCapacity, setEditCapacity] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadTables = useCallback(async () => {
    const response = await fetch('/api/admin/tables', { cache: 'no-store' });
    const parsed = tablesSchema.safeParse(await responseJson(response));
    if (!parsed.success) throw new Error('The table list response was invalid.');
    setTables(parsed.data.tables);
  }, []);

  useEffect(() => {
    let active = true;
    loadTables().catch((loadError: unknown) => {
      if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load tables.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [loadTables]);

  async function createQr(labelForQr: string, token: string) {
    const url = `${window.location.origin}/table-menu#${token}`;
    const image = await QRCode.toDataURL(url, {
      errorCorrectionLevel: 'H',
      margin: 3,
      width: 420,
      color: { dark: '#111110', light: '#ffffff' },
    });
    setGeneratedQr({ label: labelForQr, url, image });
  }

  async function createTable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/admin/tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: label.trim(),
          ...(section.trim() ? { section: section.trim() } : {}),
          ...(capacity ? { capacity: Number(capacity) } : {}),
        }),
      });
      const result = await responseJson(response);
      const parsed = z.object({
        table: tableSchema.omit({ current_session: true }),
        token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
      }).safeParse(result);
      if (!parsed.success) throw new Error('The table was created, but the QR response was invalid.');
      await createQr(parsed.data.table.label, parsed.data.token);
      setLabel('');
      setSection('');
      setCapacity('');
      setNotice(`Created ${parsed.data.table.label}. Download and print its QR now; the raw token cannot be recovered later.`);
      await loadTables();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Unable to create the table.');
    } finally {
      setSaving(false);
    }
  }

  async function runAction(table: Table, action: 'activate' | 'deactivate' | 'rotate_qr' | 'open_session' | 'close_session', sessionId?: string) {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch(`/api/admin/tables/${table.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...(sessionId ? { session_id: sessionId } : {}) }),
      });
      const result: unknown = await responseJson(response);
      if (action === 'rotate_qr') {
        const parsed = z.object({
          table: tableSchema.omit({ current_session: true }),
          token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
        }).safeParse(result);
        if (!parsed.success) throw new Error('The QR was rotated, but the response was invalid.');
        await createQr(parsed.data.table.label, parsed.data.token);
        setNotice(`QR rotated for ${parsed.data.table.label}. The previous code is now invalid; download and print this one.`);
      } else if (action === 'open_session') {
        setNotice(`Opened a new service session for ${table.label}.`);
      } else if (action === 'close_session') {
        setNotice(`Closed the service session for ${table.label}.`);
      } else {
        setNotice(`${table.label} ${action === 'activate' ? 'activated' : 'deactivated'}.`);
      }
      await loadTables();
      if (selectedTable === table.id) await loadSessions(table.id);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to update the table.');
    } finally {
      setSaving(false);
    }
  }

  async function loadSessions(tableId: string) {
    const response = await fetch(`/api/admin/tables/${tableId}/sessions`, { cache: 'no-store' });
    const parsed = sessionsSchema.safeParse(await responseJson(response));
    if (!parsed.success) throw new Error('The session history response was invalid.');
    setSessions(parsed.data.sessions);
    setSelectedTable(tableId);
  }

  async function saveTableEdit(event: FormEvent<HTMLFormElement>, table: Table) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch(`/api/admin/tables/${table.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'edit',
          label: editLabel.trim(),
          section: editSection.trim(),
          capacity: editCapacity ? Number(editCapacity) : null,
        }),
      });
      await responseJson(response);
      setEditingTable(null);
      setNotice(`Saved details for ${editLabel.trim()}.`);
      await loadTables();
    } catch (editError) {
      setError(editError instanceof Error ? editError.message : 'Unable to save table details.');
    } finally {
      setSaving(false);
    }
  }

  async function showSessions(tableId: string) {
    setError('');
    try {
      await loadSessions(tableId);
    } catch (sessionError) {
      setError(sessionError instanceof Error ? sessionError.message : 'Unable to load table sessions.');
    }
  }

  const selectedTableLabel = tables.find((table) => table.id === selectedTable)?.label ?? '';
  if (loading) return <main className="container min-h-[55vh] py-16"><p role="status">Loading table management…</p></main>;

  return (
    <main className="container min-h-[60vh] py-12">
      <p className="eyebrow">Staff tools</p>
      <h1 className="mt-2 text-5xl">Table QR management</h1>
      <p className="mt-3 max-w-3xl leading-7 text-[#aaa69a]">
        QR codes identify a table, while staff-opened sessions control when orders are accepted. Only a token hash is stored in the database; create or rotate a QR to download a new printable code.
      </p>
      <p className="mt-2 text-sm text-[#aaa69a]">
        Staff sign-in: <Link href={adminPath('login')} className="gold underline">Sign in</Link>
      </p>
      {error && <p role="alert" className="mt-5 rounded-lg border border-[#ef8a7d]/40 bg-[#ef8a7d]/10 p-4 text-sm text-[#ef8a7d]">{error}</p>}
      {notice && <p role="status" className="mt-5 rounded-lg border border-[#e7b84b]/40 bg-[#e7b84b]/10 p-4 text-sm text-[#e9d6a2]">{notice}</p>}

      <section className="panel mt-8 p-6">
        <h2 className="text-xl font-semibold">Add a restaurant table</h2>
        <form onSubmit={createTable} className="mt-4 grid gap-3 sm:grid-cols-4">
          <label className="text-sm">Table number / label
            <input className="field mt-2" value={label} onChange={(event) => setLabel(event.target.value)} maxLength={80} required />
          </label>
          <label className="text-sm">Section (optional)
            <input className="field mt-2" value={section} onChange={(event) => setSection(event.target.value)} maxLength={80} />
          </label>
          <label className="text-sm">Capacity (optional)
            <input className="field mt-2" type="number" value={capacity} onChange={(event) => setCapacity(event.target.value)} min={1} max={100} />
          </label>
          <button className="btn self-end disabled:opacity-50" disabled={saving}>{saving ? 'Saving…' : 'Create table + QR'}</button>
        </form>
      </section>

      {generatedQr && <section className="panel mt-8 flex flex-col items-center gap-4 p-6 text-center print-card">
        <p className="eyebrow">Printable table code</p>
        <h2 className="text-2xl font-semibold">{generatedQr.label}</h2>
        <img src={generatedQr.image} alt={`QR code for ${generatedQr.label}`} className="h-64 w-64 rounded bg-white p-2" />
        <div className="flex flex-wrap justify-center gap-3 print:hidden">
          <a className="btn" href={generatedQr.image} download={`${generatedQr.label.replace(/[^a-zA-Z0-9-]+/g, '-')}-qr.png`}>Download QR PNG</a>
          <button type="button" className="rounded-full border border-white/20 px-5 py-3" onClick={() => window.print()}>Print QR</button>
        </div>
        <p className="max-w-xl text-xs text-[#aaa69a] print:hidden">Keep the printed QR at this table. Rotating it invalidates every copy of the previous code.</p>
      </section>}

      <section className="mt-8 grid gap-4">
        <h2 className="text-2xl font-semibold">Restaurant tables</h2>
        {!tables.length && <p className="panel p-6 text-sm text-[#aaa69a]">No tables yet. Create one above to generate its first QR code.</p>}
        {tables.map((table) => <article key={table.id} className="panel p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h3 className="text-xl font-semibold">{table.label}</h3>
              <p className="mt-1 text-sm text-[#aaa69a]">
                {table.section || 'No section'}{table.capacity ? ` · Seats ${table.capacity}` : ''}
                {' · '}<span className={table.is_active ? 'text-emerald-300' : 'text-[#ef8a7d]'}>{table.is_active ? 'Active' : 'Inactive'}</span>
              </p>
              {table.current_session
                ? <p className="mt-2 text-sm text-[#e9d6a2]">Session open until {new Date(table.current_session.expires_at).toLocaleString()}</p>
                : <p className="mt-2 text-sm text-[#aaa69a]">No open service session</p>}
              <p className="mt-2 text-xs text-[#928d83]">QR hash is protected. Rotate to issue a fresh printable QR; the old token is not recoverable.</p>
              {editingTable === table.id && <form onSubmit={(event) => saveTableEdit(event, table)} className="mt-4 grid gap-3 sm:grid-cols-3">
                <label className="text-xs text-[#aaa69a]">Label<input className="field mt-1" value={editLabel} onChange={(event) => setEditLabel(event.target.value)} required maxLength={80} /></label>
                <label className="text-xs text-[#aaa69a]">Section<input className="field mt-1" value={editSection} onChange={(event) => setEditSection(event.target.value)} maxLength={80} /></label>
                <label className="text-xs text-[#aaa69a]">Capacity<input className="field mt-1" type="number" value={editCapacity} onChange={(event) => setEditCapacity(event.target.value)} min={1} max={100} /></label>
                <div className="flex gap-2 sm:col-span-3"><button className="rounded-full bg-[#c9342e] px-4 py-2 text-sm text-white disabled:opacity-50" disabled={saving}>Save details</button><button type="button" className="rounded-full border border-white/20 px-4 py-2 text-sm" onClick={() => setEditingTable(null)}>Cancel</button></div>
              </form>}
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={saving} onClick={() => { setEditingTable(table.id); setEditLabel(table.label); setEditSection(table.section ?? ''); setEditCapacity(table.capacity?.toString() ?? ''); }} className="rounded-full border border-white/20 px-4 py-2 text-sm disabled:opacity-40">Edit details</button>
              <button type="button" disabled={saving || !table.is_active || Boolean(table.current_session)} onClick={() => runAction(table, 'open_session')} className="rounded-full border border-white/20 px-4 py-2 text-sm disabled:opacity-40">Open session</button>
              {table.current_session && <button type="button" disabled={saving} onClick={() => runAction(table, 'close_session', table.current_session?.id)} className="rounded-full border border-white/20 px-4 py-2 text-sm disabled:opacity-40">Close session</button>}
              <button type="button" disabled={saving} onClick={() => runAction(table, 'rotate_qr')} className="rounded-full border border-[#e7b84b]/50 px-4 py-2 text-sm text-[#e9d6a2] disabled:opacity-40">Rotate / print QR</button>
              <button type="button" disabled={saving} onClick={() => runAction(table, table.is_active ? 'deactivate' : 'activate')} className="rounded-full border border-white/20 px-4 py-2 text-sm disabled:opacity-40">{table.is_active ? 'Deactivate' : 'Activate'}</button>
              <button type="button" disabled={saving} onClick={() => showSessions(table.id)} className="rounded-full border border-white/20 px-4 py-2 text-sm disabled:opacity-40">Sessions &amp; orders</button>
            </div>
          </div>
        </article>)}
      </section>

      {selectedTable && <section className="panel mt-8 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-semibold">Session history · {selectedTableLabel}</h2>
          <button type="button" onClick={() => { setSelectedTable(null); setSessions([]); }} className="text-sm text-[#e7b84b] underline">Close history</button>
        </div>
        {!sessions.length && <p className="mt-4 text-sm text-[#aaa69a]">No sessions have been opened for this table.</p>}
        <div className="mt-5 grid gap-4">
          {sessions.map((session) => <div key={session.id} className="rounded-xl border border-white/10 p-4">
            <div className="flex flex-wrap justify-between gap-2 text-sm">
              <p>{session.ended_at ? 'Closed' : new Date(session.expires_at).getTime() <= Date.now() ? 'Expired' : 'Open'} · Started {new Date(session.started_at).toLocaleString()}</p>
              <p className="text-[#aaa69a]">{session.orders.length} order{session.orders.length === 1 ? '' : 's'}</p>
            </div>
            {session.orders.map((order) => <div key={order.id} className="mt-4 rounded-lg bg-black/20 p-4">
              <div className="flex flex-wrap justify-between gap-2">
                <strong>{order.order_number} · {selectedTableLabel} · {order.customer_name}</strong>
                <span>{order.status} · {money(Number(order.total))}</span>
              </div>
              <p className="mt-1 text-xs text-[#aaa69a]">{new Date(order.created_at).toLocaleString()} · Cash {order.payment_status}</p>
              <ul className="mt-2 text-sm text-[#ddd]">
                {order.items.map((item, index) => <li key={`${order.id}-${index}`}>{item.quantity} × {snapshotDescription(item.snapshot)}</li>)}
              </ul>
            </div>)}
          </div>)}
        </div>
      </section>}
    </main>
  );
}
