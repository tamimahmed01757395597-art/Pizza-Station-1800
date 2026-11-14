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
    <main className="container min-h-[55vh] py-16">
      <section className="panel mx-auto max-w-xl p-8">
        <p className="eyebrow">Dine in</p>
        {status === 'checking' && <>
          <h1 className="mt-2 text-4xl">Checking your table…</h1>
          <p role="status" className="mt-4 text-[#aaa69a]">Verifying the table QR and its open service session.</p>
        </>}
        {status === 'valid' && <>
          <h1 className="mt-2 text-4xl">Welcome to {tableNumber}.</h1>
          <p role="status" className="mt-4 text-[#aaa69a]">Your table is verified. Opening the menu…</p>
          <Link href="/table-menu" className="btn mt-6">Continue to table menu</Link>
        </>}
        {status === 'invalid' && <>
          <h1 className="mt-2 text-4xl">Table unavailable.</h1>
          <p role="alert" className="mt-4 text-[#aaa69a]">{message}</p>
        </>}
      </section>
    </main>
  );
}
