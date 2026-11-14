'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { z } from 'zod';
import { money } from '@/lib/menu';

const errorSchema = z.object({ error: z.string() });
const registrationResponseSchema = z.object({ session: z.unknown().nullable().optional() });
const profileResponseSchema = z.object({
  profile: z.object({
    email: z.string(),
    full_name: z.string(),
    phone: z.string().nullable(),
  }),
});
const customerOrderSchema = z.object({
  id: z.string().uuid(),
  order_number: z.string(),
  order_type: z.string(),
  status: z.string(),
  payment_status: z.string(),
  subtotal: z.union([z.number(), z.string()]),
  discount: z.union([z.number(), z.string()]),
  delivery_fee: z.union([z.number(), z.string()]),
  total: z.union([z.number(), z.string()]),
  created_at: z.string(),
  items: z.array(z.object({ quantity: z.number(), snapshot: z.unknown() }).passthrough()).default([]),
});
const customerOrdersSchema = z.object({ orders: z.array(customerOrderSchema) });

const titles: Record<string, string> = {
  login: 'Welcome back',
  register: 'Create your account',
  profile: 'Your profile',
  addresses: 'Saved addresses',
  orders: 'Order history',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function snapshotName(snapshot: unknown) {
  if (!isRecord(snapshot)) return 'Menu item';
  let name = typeof snapshot.name === 'string' ? snapshot.name : 'Menu item';
  if (typeof snapshot.variant === 'object' && snapshot.variant !== null && 'name' in snapshot.variant && typeof snapshot.variant.name === 'string') {
    name += ` (${snapshot.variant.name})`;
  }
  if ('addons' in snapshot && Array.isArray(snapshot.addons)) {
    const addonNames = snapshot.addons.filter((addon): addon is { name: string } =>
      typeof addon === 'object' && addon !== null && 'name' in addon && typeof addon.name === 'string',
    ).map((addon) => addon.name);
    if (addonNames.length) name += ` + ${addonNames.join(', ')}`;
  }
  return name;
}

export default function AccountPage() {
  const { page } = useParams<{ page: string }>();
  const router = useRouter();
  const title = titles[page];
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [orders, setOrders] = useState<z.infer<typeof customerOrderSchema>[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [ordersLoading, setOrdersLoading] = useState(false);

  useEffect(() => {
    if (page === 'orders') {
      let active = true;
      setOrdersLoading(true);
      setError('');
      fetch('/api/orders', { cache: 'no-store' })
        .then(async (response) => {
          const result: unknown = await response.json();
          if (!response.ok) {
            const parsed = errorSchema.safeParse(result);
            throw new Error(parsed.success ? parsed.data.error : 'Unable to load order history.');
          }
          const parsed = customerOrdersSchema.safeParse(result);
          if (!parsed.success) throw new Error('The order history response was invalid.');
          if (active) setOrders(parsed.data.orders);
        })
        .catch((ordersError: unknown) => {
          if (active) setError(ordersError instanceof Error ? ordersError.message : 'Unable to load order history.');
        })
        .finally(() => {
          if (active) setOrdersLoading(false);
        });
      return () => { active = false; };
    }
    if (page !== 'profile') return;
    let active = true;
    setProfileLoading(true);
    setError('');

    fetch('/api/account/profile')
      .then(async (response) => {
        const result: unknown = await response.json();
        if (!response.ok) {
          const parsed = errorSchema.safeParse(result);
          throw new Error(parsed.success ? parsed.data.error : 'Unable to load your profile.');
        }
        const parsed = profileResponseSchema.safeParse(result);
        if (!parsed.success) throw new Error('The profile response was invalid.');
        if (active) {
          setName(parsed.data.profile.full_name);
          setPhone(parsed.data.profile.phone ?? '');
          setProfileEmail(parsed.data.profile.email);
        }
      })
      .catch((profileError: unknown) => {
        if (active) setError(profileError instanceof Error ? profileError.message : 'Unable to load your profile.');
      })
      .finally(() => {
        if (active) setProfileLoading(false);
      });

    return () => {
      active = false;
    };
  }, [page]);

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const registering = page === 'register';
      const response = await fetch(registering ? '/api/auth/register' : '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registering
          ? { name: name.trim(), email: email.trim(), password, ...(phone.trim() ? { phone: phone.trim() } : {}) }
          : { email: email.trim(), password }),
      });
      const result: unknown = await response.json();

      if (!response.ok) {
        const parsed = errorSchema.safeParse(result);
        throw new Error(parsed.success ? parsed.data.error : 'Unable to continue. Please try again.');
      }

      if (registering) {
        const parsed = registrationResponseSchema.safeParse(result);
        if (!parsed.success) throw new Error('Account created, but the response was unexpected. Please try signing in.');
        if (!parsed.data.session) {
          setMessage('Account created. Check your email to confirm your address, then sign in.');
          return;
        }
      }

      router.replace('/account/profile');
      router.refresh();
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Unable to continue. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMessage('');
    setSavingProfile(true);
    try {
      const response = await fetch('/api/account/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: name.trim(), phone: phone.trim() || null }),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        const parsed = errorSchema.safeParse(result);
        throw new Error(parsed.success ? parsed.data.error : 'Unable to save your profile.');
      }
      const parsed = profileResponseSchema.safeParse(result);
      if (!parsed.success) throw new Error('Your profile was saved, but the response was invalid.');
      setName(parsed.data.profile.full_name);
      setPhone(parsed.data.profile.phone ?? '');
      setProfileEmail(parsed.data.profile.email);
      setMessage('Profile saved.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save your profile.');
    } finally {
      setSavingProfile(false);
    }
  }

  async function signOut() {
    setError('');
    setSigningOut(true);
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      const result: unknown = await response.json();
      if (!response.ok) {
        const parsed = errorSchema.safeParse(result);
        throw new Error(parsed.success ? parsed.data.error : 'Unable to sign out.');
      }
      router.replace('/account/login');
      router.refresh();
    } catch (signOutError) {
      setError(signOutError instanceof Error ? signOutError.message : 'Unable to sign out.');
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <main className="container min-h-[55vh] py-16">
      <div className="panel mx-auto max-w-xl p-7 sm:p-9">
        <p className="eyebrow">Pizza Station account</p>
        <h1 className="mt-2 text-4xl">{title || 'Account page'}</h1>
        {['login', 'register'].includes(page) ? (
          <>
            <p className="mt-3 text-sm leading-6 text-[#a6a29a]">
              {page === 'login' ? 'Sign in to your customer account.' : 'Create an account to get started.'}
            </p>
            <form onSubmit={submitAuth} className="mt-7 grid gap-4">
              {page === 'register' && (
                <>
                  <label className="text-sm">Full name
                    <input className="field mt-2" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} required maxLength={120} />
                  </label>
                  <label className="text-sm">Phone (optional)
                    <input className="field mt-2" type="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} maxLength={30} />
                  </label>
                </>
              )}
              <label className="text-sm">Email
                <input className="field mt-2" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required maxLength={254} />
              </label>
              <label className="text-sm">Password
                <input className="field mt-2" type="password" autoComplete={page === 'register' ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} required minLength={page === 'register' ? 10 : 1} maxLength={128} />
                {page === 'register' && <span className="mt-1 block text-xs text-[#a6a29a]">Use at least 10 characters.</span>}
              </label>
              {error && <p role="alert" className="text-sm text-[#ef8a7d]">{error}</p>}
              {message && <p role="status" className="text-sm text-[#e7b84b]">{message}</p>}
              <button className="btn mt-2 disabled:opacity-50" disabled={loading}>
                {loading ? 'Please wait…' : page === 'login' ? 'Sign in' : 'Create account'}
              </button>
            </form>
            <p className="mt-5 text-sm text-[#a6a29a]">
              {page === 'login' ? (
                <>New to us? <Link className="gold" href="/account/register">Create an account</Link></>
              ) : (
                <>Already have an account? <Link className="gold" href="/account/login">Sign in</Link></>
              )}
            </p>
            {page === 'login' && (
              <p className="mt-3 text-sm text-[#a6a29a]">
                Staff? <Link className="gold" href="/admin/login">Staff sign in</Link>
              </p>
            )}
          </>
        ) : page === 'profile' ? (
          <>
            <p className="mt-3 text-sm text-[#a6a29a]">{profileEmail || (profileLoading ? 'Loading your account…' : '')}</p>
            <form onSubmit={saveProfile} className="mt-7 grid gap-4">
              <label className="text-sm">Full name
                <input className="field mt-2" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} required maxLength={120} disabled={profileLoading || savingProfile} />
              </label>
              <label className="text-sm">Phone
                <input className="field mt-2" type="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} maxLength={30} disabled={profileLoading || savingProfile} />
              </label>
              {error && <p role="alert" className="text-sm text-[#ef8a7d]">{error}</p>}
              {message && <p role="status" className="text-sm text-[#e7b84b]">{message}</p>}
              <button className="btn mt-2 disabled:opacity-50" disabled={profileLoading || savingProfile}>
                {profileLoading ? 'Loading profile…' : savingProfile ? 'Saving…' : 'Save profile'}
              </button>
            </form>
            <div className="mt-5 flex flex-wrap gap-3 text-sm">
              <Link className="text-[#e7b84b] underline" href="/account/orders">View past orders</Link>
              <Link className="text-[#aaa69a] underline" href="/menu">Browse menu</Link>
            </div>
            <button type="button" className="mt-5 text-sm text-[#e7b84b] underline disabled:opacity-50" onClick={signOut} disabled={signingOut}>
              {signingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </>
        ) : page === 'addresses' ? (
          <div className="mt-7 grid gap-4">
            <p className="text-sm text-[#aaa69a]">Saved addresses are not connected yet.</p>
            <label className="text-sm">Address label<input className="field mt-2" placeholder="Home, work…" /></label>
            <label className="text-sm">Address details<textarea className="field mt-2" rows={3} placeholder="Street, area, city" /></label>
            <button className="btn mt-2" disabled type="button">Address storage not connected</button>
          </div>
        ) : page === 'orders' ? (
          <div className="mt-7 grid gap-4">
            <Link href="/account/profile" className="text-sm text-[#e7b84b] underline">← Back to profile</Link>
            {error && <p role="alert" className="rounded-lg border border-[#ef8a7d]/30 bg-[#ef8a7d]/10 p-4 text-sm text-[#ef8a7d]">{error}</p>}
            {ordersLoading ? <p role="status" className="text-sm text-[#aaa69a]">Loading your orders…</p> : orders.length ? orders.map((order) => (
              <article key={order.id} className="rounded-xl border border-white/10 bg-black/10 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><h2 className="font-semibold">{order.order_number}</h2><p className="mt-1 text-xs capitalize text-[#aaa69a]">{order.order_type.replaceAll('_', ' ')} · {new Date(order.created_at).toLocaleString()}</p></div>
                  <div className="text-right"><p className="font-semibold">{money(Number(order.total))}</p><p className="mt-1 text-xs capitalize text-[#e7b84b]">{order.status.replaceAll('_', ' ')} · {order.payment_status}</p></div>
                </div>
                <ul className="mt-3 grid gap-1 border-t border-white/5 pt-3 text-sm text-[#d6d1c7]">
                  {order.items.map((item, index) => <li key={`${order.id}-${index}`}>{item.quantity} × {snapshotName(item.snapshot)}</li>)}
                </ul>
              </article>
            )) : !error && <div className="rounded-xl border border-dashed border-white/10 p-8 text-center">
              <p className="text-sm text-[#aaa69a]">No orders are linked to this account yet.</p>
              <Link href="/menu" className="mt-4 inline-block rounded-full bg-[#c9342e] px-5 py-3 text-sm font-semibold text-white">Browse the menu</Link>
            </div>}
          </div>
        ) : (
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              ['Profile', '/account/profile'],
              ['Addresses', '/account/addresses'],
              ['Orders', '/account/orders'],
            ].map(([label, href]) => (
              <Link className="rounded-lg border border-white/10 p-4 text-sm hover:border-[#e7b84b]" href={href} key={href}>
                {label} →
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
