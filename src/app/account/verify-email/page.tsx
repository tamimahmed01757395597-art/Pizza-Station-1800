'use client';

import Link from 'next/link';
import { Suspense, useState, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { z } from 'zod';

const errorSchema = z.object({ error: z.string() });

function VerifyEmail() {
  const params = useSearchParams();
  const verified = params.get('verified') === '1';
  const failed = params.get('error') === '1';
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState(failed ? 'That verification link is invalid or has expired.' : '');
  const [loading, setLoading] = useState(false);

  async function resend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMessage('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Enter a valid email address.');
      return;
    }
    setLoading(true);
    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        const parsed = errorSchema.safeParse(result);
        throw new Error(parsed.success ? parsed.data.error : 'Unable to resend the verification email.');
      }
      setMessage('A fresh verification link is on its way.');
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'Unable to resend the verification email.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="container min-h-[60vh] py-16">
      <div className="panel mx-auto max-w-xl p-7 text-center sm:p-9">
        <span className="station-stamp">EMAIL CHECK</span>
        <h1 className="serif mt-3 text-3xl">{verified ? 'Address Confirmed' : 'Verify Your Email'}</h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-[#635d64]">
          {verified
            ? 'Your email is confirmed. You are all set to order.'
            : 'Open the verification link we sent to your inbox. If it is missing, request a new one below.'}
        </p>
        {error && <p role="alert" className="mt-5 text-sm text-[#c23348]">{error}</p>}
        {message && <p role="status" className="mt-5 text-sm text-[#0b7777]">{message}</p>}
        <form onSubmit={resend} className="mt-7 grid gap-3 text-left">
          <label className="text-sm">
            Account email
            <input
              className="field mt-2"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              placeholder="you@example.com"
              required
              maxLength={254}
            />
          </label>
          <div className="flex justify-center">
            <button className="btn disabled:opacity-50" disabled={loading}>
              {loading ? 'Sending…' : 'Resend verification email'}
            </button>
          </div>
        </form>
        <div className="mt-6 flex flex-wrap justify-center gap-4 text-sm">
          <Link href="/account/profile" className="text-[#ff6b4a] underline">Go to my profile</Link>
          <Link href="/account/login" className="text-[#635d64] underline">Sign in</Link>
        </div>
      </div>
    </main>
  );
}

export default function VerifyEmailPage() {
  return <Suspense fallback={<main className="container min-h-[60vh] py-16"><p role="status" className="text-sm text-[#635d64]">Loading…</p></main>}><VerifyEmail /></Suspense>;
}
