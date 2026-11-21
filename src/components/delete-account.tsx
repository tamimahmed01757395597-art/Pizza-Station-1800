'use client';

import { useState, type FormEvent } from 'react';
import { z } from 'zod';

const errorSchema = z.object({ error: z.string() });

export function DeleteAccountButton() {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function remove(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (confirmation !== 'DELETE') {
      setError('Type DELETE exactly to confirm.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const response = await fetch('/api/account/delete', { method: 'DELETE' });
      const result: unknown = await response.json();
      if (!response.ok) {
        const parsed = errorSchema.safeParse(result);
        throw new Error(parsed.success ? parsed.data.error : 'Unable to delete your account.');
      }
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.assign('/account/login?deleted=1');
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'Unable to delete your account.');
      setLoading(false);
    }
  }

  return (
    <div className="mt-8 border-[3px] border-[#c23348] bg-[#c23348]/5 p-5">
      <h2 className="serif text-lg text-[#c23348]">Danger Zone</h2>
      <p className="mt-2 text-sm leading-6 text-[#635d64]">
        Permanently delete your account and saved addresses. Past orders are kept for accounting but are
        anonymised so they can no longer be linked to you. This cannot be undone.
      </p>
      <button
        type="button"
        onClick={() => { setOpen(true); setError(''); setConfirmation(''); }}
        className="mt-4 border-[3px] border-[#c23348] bg-white px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-[#c23348] shadow-[4px_4px_0_#c23348] disabled:opacity-50"
      >
        Delete my account
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1c1b2a]/70 p-4" role="dialog" aria-modal="true" aria-labelledby="delete-title">
          <form onSubmit={remove} className="panel w-full max-w-md p-6">
            <h2 id="delete-title" className="serif text-xl text-[#c23348]">Delete this account?</h2>
            <p className="mt-3 text-sm leading-6 text-[#635d64]">
              This action is permanent. Type <strong className="mono text-[#1c1b2a]">DELETE</strong> to confirm.
            </p>
            <input
              className="field mt-4"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="off"
              aria-label="Type DELETE to confirm"
              placeholder="DELETE"
            />
            {error && <p role="alert" className="mt-3 text-sm text-[#c23348]">{error}</p>}
            <div className="mt-5 flex flex-wrap gap-3">
              <button type="submit" className="btn disabled:opacity-50" disabled={loading}>
                {loading ? 'Deleting…' : 'Permanently delete'}
              </button>
              <button type="button" className="btn secondary" onClick={() => setOpen(false)} disabled={loading}>Cancel</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
