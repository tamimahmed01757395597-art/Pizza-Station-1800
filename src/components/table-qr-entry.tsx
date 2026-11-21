'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';

const tableResponseSchema = z.object({ table_number: z.string().min(1).max(80) });
const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

export function TableQrEntry({ initialToken }: { initialToken?: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<'checking' | 'valid' | 'invalid'>('checking');
  const [tableNumber, setTableNumber] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    const token = initialToken ?? window.location.hash.slice(1);
    if (!tokenSchema.safeParse(token).success) {
      localStorage.removeItem('ps-table-token');
      localStorage.removeItem('ps-table-number');
      setStatus('invalid');
      setMessage('This QR code is incomplete or invalid. Please scan the code at your table again.');
      return;
    }

    window.history.replaceState(window.history.state, '', initialToken ? '/table' : window.location.pathname);
    fetch('/api/tables/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
      cache: 'no-store',
    })
      .then(async (response) => {
        const result: unknown = await response.json();
        if (!response.ok) {
          const error = z.object({ error: z.string() }).safeParse(result);
          throw new Error(error.success ? error.data.error : 'This table is not accepting orders.');
        }
        const parsed = tableResponseSchema.safeParse(result);
        if (!parsed.success) throw new Error('The table could not be verified.');
        return parsed.data;
      })
      .then(({ table_number }) => {
        if (!active) return;
        localStorage.setItem('ps-table-token', token);
        localStorage.setItem('ps-table-number', table_number);
        setTableNumber(table_number);
        setStatus('valid');
        window.dispatchEvent(new Event('tablechange'));
        window.setTimeout(() => {
          if (active) router.replace('/table-menu');
        }, 1200);
      })
      .catch((error: unknown) => {
        if (!active) return;
        localStorage.removeItem('ps-table-token');
        localStorage.removeItem('ps-table-number');
        setStatus('invalid');
        setMessage(error instanceof Error ? error.message : 'This table is not accepting orders.');
        window.dispatchEvent(new Event('tablechange'));
      });

    return () => { active = false; };
  }, [initialToken, router]);

  return (
    <main className="container min-h-[55vh] py-16 text-[#f6f1e8]">
      <section className="mx-auto max-w-xl rounded border-2 border-[#38332a] bg-[#181614] p-8 sm:p-10 shadow-2xl">
        <div className="flex items-center gap-2">
          <span className="station-tag">DINE-IN PLATFORM</span>
          <span className="font-mono text-xs text-[#8e877c]">STATION 1800</span>
        </div>

        {status === 'checking' && (
          <div className="mt-4">
            <h1 className="serif text-3xl font-bold sm:text-4xl text-[#f6f1e8]">
              Verifying Your Table…
            </h1>
            <p role="status" className="mt-3 font-mono text-xs leading-relaxed text-[#c4bdae]">
              Checking table security token and active station kitchen session.
            </p>
            <div className="mt-6 flex items-center gap-2 font-mono text-xs text-[#e5b342]">
              <span className="h-2 w-2 rounded-full bg-[#e5b342] animate-pulse" />
              <span>Contacting table dispatcher…</span>
            </div>
          </div>
        )}

        {status === 'valid' && (
          <div className="mt-4">
            <span className="station-stamp">TABLE VERIFIED</span>
            <h1 className="serif mt-3 text-3xl font-bold sm:text-4xl text-[#f6f1e8]">
              Welcome to {tableNumber}.
            </h1>
            <p role="status" className="mt-3 font-mono text-xs leading-relaxed text-[#c4bdae]">
              Your table is active and verified. Redirecting you to the live dining menu…
            </p>
            <div className="mt-6">
              <Link href="/table-menu" className="btn text-xs font-bold uppercase tracking-wider">
                Open Table Menu Now
              </Link>
            </div>
          </div>
        )}

        {status === 'invalid' && (
          <div className="mt-4">
            <span className="inline-block px-2 py-0.5 border border-[#c83327] bg-[#221514] font-mono text-xs text-[#ef8a7d]">
              TABLE UNAVAILABLE
            </span>
            <h1 className="serif mt-3 text-3xl font-bold sm:text-4xl text-[#f6f1e8]">
              Session Not Verified
            </h1>
            <p role="alert" className="mt-3 font-mono text-xs leading-relaxed text-[#ef8a7d]">
              {message}
            </p>
            <div className="mt-6 flex gap-3">
              <Link href="/menu" className="btn text-xs font-bold uppercase tracking-wider">
                Browse Public Menu
              </Link>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
