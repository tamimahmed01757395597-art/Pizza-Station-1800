import type { Metadata, Viewport } from 'next';
import './globals.css';
import { SiteHeader, SiteFooter } from '@/components/site';
import { TableOrderStatus } from '@/components/table-order-status';
import { GoogleAnalytics } from '@/lib/analytics';

export const metadata: Metadata = {
  title: {
    default: 'Pizza Station 1800 — Menu & Orders',
    template: '%s · Pizza Station 1800',
  },
  description: 'Browse pizza, burgers, biryani, platters, drinks and more at Pizza Station 1800.',
  applicationName: 'Pizza Station 1800',
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#ff6b4a',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <GoogleAnalytics />
        <SiteHeader />
        <TableOrderStatus />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
