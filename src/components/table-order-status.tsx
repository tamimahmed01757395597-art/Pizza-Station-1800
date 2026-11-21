'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { z } from 'zod';
import { tableDisplayLabel } from '@/lib/table-label';

export function TableOrderStatus() {
  const pathname = usePathname();
  const [tableNumber, setTableNumber] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (pathname === '/table' || pathname.startsWith('/table/') || pathname.startsWith('/table-menu')) return;
    let active = true;
    let requestId = 0;
    const sync = () => {
      const currentRequest = ++requestId;
      const token = localStorage.getItem('ps-table-token');
      setTableNumber('');
      setMessage('');
      if (!token) return;
      fetch('/api/tables/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
        cache: 'no-store',
      }).then(async (response) => {
        const result: unknown = await response.json();
        if (response.status === 400) {
          localStorage.removeItem('ps-table-token');
          localStorage.removeItem('ps-table-number');
          throw new Error('This table is not accepting orders. Scan its QR again or ask staff to open a session.');
        }
        if (!response.ok) throw new Error('Could not verify this table. Check your connection and try again.');
        return z.object({ table_number: z.string().min(1).max(80) }).parse(result);
      }).then(({ table_number }) => {
        if (!active || currentRequest !== requestId) return;
        localStorage.setItem('ps-table-number', table_number);
        setTableNumber(table_number);
      }).catch((error: unknown) => {
        if (!active || currentRequest !== requestId) return;
        console.error('Dine-in table status validation failed:', error);
        setMessage(error instanceof Error ? error.message : 'Could not verify this table.');
      });
    };
    sync();
    window.addEventListener('tablechange', sync);
    window.addEventListener('storage', sync);
    return () => {
      active = false;
      window.removeEventListener('tablechange', sync);
      window.removeEventListener('storage', sync);
    };
  }, [pathname]);

  if (pathname === '/table' || pathname.startsWith('/table/') || pathname.startsWith('/table-menu')) return null;
  if (!tableNumber && !message) return null;
  return tableNumber
    ? <div role="status" className="border-b border-[#1c1b2a] bg-[#fde8d5] px-4 py-2 text-center font-mono text-xs text-[#ff6b4a]"><span className="inline-block h-1.5 w-1.5 rounded-full bg-[#0b7777] mr-2"></span>Dine-In Session Active · <strong className="text-[#1c1b2a]">{tableDisplayLabel(tableNumber)}</strong></div>
    : <div role="alert" className="border-b border-[#c23348] bg-[#ffe3dc] px-4 py-2 text-center font-mono text-xs text-[#c23348]">{message}</div>;
}
