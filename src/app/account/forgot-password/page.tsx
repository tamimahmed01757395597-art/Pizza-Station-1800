'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { z } from 'zod';
import { validateForm } from '@/lib/form-validation';
import { resetPasswordSchema } from '@/lib/schemas';

const errorSchema = z.object({ error: z.string() });

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMessage('');
    const check = validateForm(resetPasswordSchema, { email });
    if (!check.ok) {
      setErrors(check.errors);
      setError(check.message);
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      const response = await fetch('/api/auth/password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(check.data),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        const parsed = errorSchema.safeParse(result);
        throw new Error(parsed.success ? parsed.data.error : 'Unable to send the reset email.');
      }
      setMessage('If that address has an account, a password reset link is on its way.');
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'Unable to send the reset email.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="container min-h-[60vh] py-16">
      <div className="panel mx-auto max-w-xl p-7 sm:p-9">
        <span className="station-stamp">ACCOUNT RECOVERY</span>
        <h1 className="serif mt-3 text-3xl">Forgot Your Password?</h1>
        <p className="mt-3 text-sm leading-6 text-[#635d64]">
          Enter your email and we will send a secure link to set a new password.
        </p>
        <form onSubmit={submit} className="mt-7 grid gap-4" noValidate>
          <label className="text-sm">
            Email
            <input
              className="field mt-2"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              maxLength={254}
              aria-invalid={Boolean(errors.email)}
            />
            {errors.email && <span className="mt-1 block text-xs text-[#c23348]">{errors.email}</span>}
          </label>
          {error && <p role="alert" className="text-sm text-[#c23348]">{error}</p>}
          {message && <p role="status" className="text-sm text-[#0b7777]">{message}</p>}
          <button className="btn mt-2 disabled:opacity-50" disabled={loading}>
            {loading ? 'Sending…' : 'Send reset link'}
          </button>
        </form>
        <Link href="/account/login" className="mt-5 inline-block text-sm text-[#ff6b4a] underline">← Back to sign in</Link>
      </div>
    </main>
  );
}
