import type { Metadata } from 'next';
import { QrTableMenu } from '@/components/qr-table-menu';

export const metadata: Metadata = {
  title: 'Table Menu | Pizza Station',
  description: 'Browse the Pizza Station dine-in menu and place an order for your verified table.',
};

export default function TableMenuPage() {
  return <QrTableMenu />;
}
