'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { z } from 'zod';
import { ADMIN_BASE_PATH } from '@/lib/admin-path';

const errorSchema = z.object({ error: z.string() });

export default function StaffLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        const parsed = errorSchema.safeParse(result);
        throw new Error(parsed.success ? parsed.data.error : 'Unable to sign in.');
      }
      router.replace(ADMIN_BASE_PATH);
    } catch (signInError) {
      setError(signInError instanceof Error ? signInError.message : 'Unable to sign in.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="container min-h-[55vh] py-16">
      <section className="panel mx-auto max-w-lg p-8">
        <p className="eyebrow">Staff access</p>
        <h1 className="mt-2 text-4xl">Sign in to the control room</h1>
        <p className="mt-3 text-sm text-[#aaa69a]">Use your staff account. Dashboard modules are checked against your server-side role and permissions.</p>
        <form onSubmit={signIn} className="mt-6 grid gap-4">
          <label className="text-sm">Email
            <input className="field mt-2" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required maxLength={254} />
          </label>
          <label className="text-sm">Password
            <input className="field mt-2" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required maxLength={128} />
          </label>
          {error && <p role="alert" className="text-sm text-[#ef8a7d]">{error}</p>}
          <button className="btn mt-2 disabled:opacity-50" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</button>
        </form>
        <p className="mt-5 text-sm text-[#a6a29a]">
          Need an account first? <Link href="/account/register" className="gold">Create one</Link>, then ask an owner to grant staff access.
        </p>
        <Link href="/menu" className="mt-5 inline-block text-sm text-[#e7b84b]">Return to menu</Link>
      </section>
    </main>
  );
}
