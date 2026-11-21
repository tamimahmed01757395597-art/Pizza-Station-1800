'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { z } from 'zod';
import { validateForm } from '@/lib/form-validation';
import { newPasswordSchema } from '@/lib/schemas';

const errorSchema = z.object({ error: z.string() });

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const check = validateForm(newPasswordSchema, { password });
    const nextErrors = check.ok ? {} : check.errors;
    if (confirm !== password) nextErrors.confirm = 'The passwords do not match.';
    setErrors(nextErrors);
    if (!check.ok || confirm !== password) return;

    setLoading(true);
    try {
      const response = await fetch('/api/auth/password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(check.data),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        const parsed = errorSchema.safeParse(result);
        throw new Error(parsed.success ? parsed.data.error : 'Unable to update your password.');
      }
      router.replace('/account/profile');
      router.refresh();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'Unable to update your password.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="container min-h-[60vh] py-16">
      <div className="panel mx-auto max-w-xl p-7 sm:p-9">
        <span className="station-stamp">NEW CREDENTIALS</span>
        <h1 className="serif mt-3 text-3xl">Set a New Password</h1>
        <p className="mt-3 text-sm leading-6 text-[#635d64]">Use at least 10 characters.</p>
        <form onSubmit={submit} className="mt-7 grid gap-4" noValidate>
          <label className="text-sm">
            New password
            <input
              className="field mt-2"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              maxLength={128}
              aria-invalid={Boolean(errors.password)}
            />
            {errors.password && <span className="mt-1 block text-xs text-[#c23348]">{errors.password}</span>}
          </label>
          <label className="text-sm">
            Confirm password
            <input
              className="field mt-2"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              maxLength={128}
              aria-invalid={Boolean(errors.confirm)}
            />
            {errors.confirm && <span className="mt-1 block text-xs text-[#c23348]">{errors.confirm}</span>}
          </label>
          {error && <p role="alert" className="text-sm text-[#c23348]">{error}</p>}
          <button className="btn mt-2 disabled:opacity-50" disabled={loading}>
            {loading ? 'Saving…' : 'Update password'}
          </button>
        </form>
        <Link href="/account/login" className="mt-5 inline-block text-sm text-[#ff6b4a] underline">Back to sign in</Link>
      </div>
    </main>
  );
}
