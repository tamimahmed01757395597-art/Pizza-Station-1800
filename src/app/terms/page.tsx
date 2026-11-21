import type { Metadata } from 'next';
import { restaurant } from '@/lib/restaurant';

export const metadata: Metadata = { title: 'Terms of Service', description: 'Terms for using Pizza Station 1800.' };

const sections = [
  {
    title: 'Using this site',
    body: 'By browsing or placing an order you agree to these terms. You must be legally able to enter a contract in your jurisdiction and agree to provide accurate information when you register or check out.',
  },
  {
    title: 'Your account',
    body: 'Keep your password confidential and tell us immediately if you suspect unauthorised use. You are responsible for activity under your account. We may suspend accounts used for abuse, fraud, or attempts to interfere with the service.',
  },
  {
    title: 'Orders and prices',
    body: 'Menu items, prices and availability are shown on the site and may change without notice. An order is only confirmed once our kitchen accepts it. If an item is unavailable we may substitute it with a similar item or refund the difference where applicable.',
  },
  {
    title: 'Payment',
    body: 'We currently accept cash on delivery and cash at the restaurant. All amounts are shown in local currency and taxes or delivery fees, where applicable, are displayed before you confirm your order.',
  },
  {
    title: 'Delivery and dine-in',
    body: 'Delivery times are estimates and can vary with traffic, weather and kitchen load. Please provide a complete address and a reachable phone number. For dine-in, scan the QR code at your table; the token is only valid while that table session is active.',
  },
  {
    title: 'Cancellations',
    body: 'You may cancel an order before it enters preparation by contacting us on ' + restaurant.phone + '. Once preparation has begun we may not be able to cancel, and already-prepared food cannot be refunded.',
  },
  {
    title: 'Content ownership',
    body: 'Text, graphics, logos and menu photography on this site belong to ' + restaurant.name + ' or our licensors and may not be copied or reused without permission.',
  },
  {
    title: 'Availability and liability',
    body: 'We aim to keep the site available but do not guarantee uninterrupted access. To the extent permitted by law, we are not liable for indirect losses arising from use of the site or from delivery delays outside our reasonable control.',
  },
  {
    title: 'Changes',
    body: 'We may revise these terms from time to time. The date below indicates the current version, and continued use of the site after a change means you accept the updated terms.',
  },
  {
    title: 'Contact',
    body: 'Questions about these terms can be sent by calling ' + restaurant.phone + ' or by visiting our kitchen in Manikganj.',
  },
];

export default function TermsPage() {
  return (
    <main className="container min-h-[60vh] py-14 text-[#1c1b2a]">
      <span className="station-stamp">THE RULES OF THE HOUSE</span>
      <h1 className="serif mt-3 text-4xl sm:text-5xl">Terms of Service</h1>
      <p className="mono mt-3 text-xs uppercase tracking-widest text-[#7c747a]">Last updated: 21 November 2026</p>
      <p className="mt-6 max-w-2xl text-base leading-relaxed text-[#635d64]">
        A short, plain-English agreement covering accounts, orders and using this website.
      </p>
      <div className="mt-9 grid gap-4">
        {sections.map((section, index) => (
          <section key={section.title} className="border-[3px] border-[#1c1b2a] bg-[#fffcf5] p-5 sm:p-6">
            <h2 className="serif text-lg"><span className="text-[#ff6b4a]">{String(index + 1).padStart(2, '0')}. </span>{section.title}</h2>
            <p className="mt-3 text-sm leading-7 text-[#635d64]">{section.body}</p>
          </section>
        ))}
      </div>
    </main>
  );
}
