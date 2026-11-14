'use client';

import { useParams } from 'next/navigation';
import { TableQrEntry } from '@/components/table-qr-entry';

export default function LegacyTableQrPage() {
  const { token } = useParams<{ token: string }>();
  return <TableQrEntry initialToken={token} />;
}
