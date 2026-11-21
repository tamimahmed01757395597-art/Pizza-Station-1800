import Link from 'next/link';
import { ArrowRight, Clock, MapPin, Phone, QrCode } from 'lucide-react';
import { restaurant } from '@/lib/restaurant';

const copy: Record<string, { eyebrow: string; title: string; intro: string; body: string }> = {
  'order-confirmation': {
    eyebrow: 'Station Order Receipt',
    title: 'Order Status Update',
    intro: 'No active order found in this browser session.',
    body: 'Once you place a pickup, delivery, or dine-in table order through checkout, your official order ticket and live preparation status will display here.',
  },
  track: {
    eyebrow: 'Kitchen Dispatch Tracking',
    title: 'Track Your Station Order',
    intro: 'Follow your food preparation from stone hearth to table or doorstep.',
    body: 'Live tracking activates after your order is confirmed by the Pizza Station kitchen.',
  },
};

export default async function ContentPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;

  if (section === 'contact') {
    return (
      <main className="container min-h-[60vh] py-14 text-[#f6f1e8]">
        <div className="flex flex-wrap items-center gap-2">
          <span className="station-tag">POSTAL DIV. 1800</span>
          <span className="font-mono text-xs text-[#8e877c]">MANIKGANJ CENTRAL</span>
        </div>

        <h1 className="serif mt-3 text-4xl font-bold sm:text-6xl">
          Visit Pizza Station <span className="text-[#e5b342] italic">1800</span>
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-[#c4bdae]">
          Find our platform kitchen in Manikganj for dine-in stone-baked pizza, smash burgers, and dum biryani, or contact our team directly for hot pickup and table inquiries.
        </p>

        <div className="mt-8 grid gap-6 md:grid-cols-3">
          <div className="rounded border border-[#2b2721] bg-[#181614] p-5">
            <span className="station-stamp">HOTLINE</span>
            <h3 className="serif mt-3 text-lg font-bold text-[#f6f1e8]">Telephone Orders</h3>
            <p className="mt-2 text-xs text-[#9e988e]">Speak directly with the station kitchen manager.</p>
            <a
              href={`tel:${restaurant.phoneE164}`}
              className="mt-4 inline-flex items-center gap-2 font-mono text-sm font-bold text-[#e5b342] hover:underline"
            >
              <Phone size={14} /> {restaurant.phone}
            </a>
          </div>

          <div className="rounded border border-[#2b2721] bg-[#181614] p-5">
            <span className="station-stamp">SERVICE HOURS</span>
            <h3 className="serif mt-3 text-lg font-bold text-[#f6f1e8]">Daily Timings</h3>
            <p className="mt-2 text-xs text-[#9e988e]">Open seven days a week for dine-in & takeout.</p>
            <div className="mt-4 flex items-center gap-2 font-mono text-xs text-[#e5b342]">
              <Clock size={14} /> 11:00 AM – 11:00 PM
            </div>
          </div>

          <div className="rounded border border-[#2b2721] bg-[#181614] p-5">
            <span className="station-stamp">TABLE QR</span>
            <h3 className="serif mt-3 text-lg font-bold text-[#f6f1e8]">Dining In?</h3>
            <p className="mt-2 text-xs text-[#9e988e]">Order straight from your table using our digital QR service.</p>
            <Link
              href="/table"
              className="mt-4 inline-flex items-center gap-1 font-mono text-xs font-bold text-[#e5b342] hover:underline"
            >
              <QrCode size={14} /> Launch Table QR
            </Link>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <a
            className="btn !py-2.5 !px-5 text-xs font-bold uppercase tracking-wider"
            href={restaurant.mapsUrl}
            target="_blank"
            rel="noreferrer"
          >
            Open in Google Maps <ArrowRight size={14} />
          </a>
          <a
            className="btn secondary !py-2.5 !px-5 text-xs font-bold uppercase tracking-wider"
            href={`tel:${restaurant.phoneE164}`}
          >
            Call {restaurant.phone}
          </a>
        </div>

        <div className="mt-10 overflow-hidden rounded border border-[#2b2721] bg-[#161412]">
          <div className="flex items-center justify-between border-b border-[#2b2721] bg-[#181614] px-4 py-2 font-mono text-xs text-[#8e877c]">
            <span>STATION SATELLITE RADAR</span>
            <span>{restaurant.latitude}, {restaurant.longitude}</span>
          </div>
          <iframe
            title="Pizza Station 1800 location map"
            src={`https://www.google.com/maps?q=${restaurant.latitude},${restaurant.longitude}&output=embed`}
            className="h-[420px] w-full border-0 bg-[#121110]"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </main>
    );
  }

  const content = copy[section];
  if (!content) {
    return (
      <main className="container min-h-[50vh] py-24 text-center text-[#f6f1e8]">
        <span className="station-stamp">ERROR 404</span>
        <h1 className="serif mt-4 text-4xl font-bold">Platform Not Found</h1>
        <p className="mt-3 font-mono text-xs text-[#9e988e]">
          The station route you requested does not exist on this line.
        </p>
        <div className="mt-6">
          <Link href="/" className="btn text-xs font-bold uppercase tracking-wider">
            Return to Station Concourse
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="container min-h-[55vh] py-20 text-[#f6f1e8]">
      <span className="station-tag">{content.eyebrow}</span>
      <h1 className="serif mt-3 max-w-3xl text-4xl font-bold sm:text-5xl">
        {content.title}
      </h1>
      <p className="mt-4 max-w-xl text-base text-[#c4bdae]">{content.intro}</p>
      <p className="mt-3 max-w-2xl text-xs leading-relaxed text-[#8e877c] font-mono">
        {content.body}
      </p>
      {['order-confirmation', 'track'].includes(section) && (
        <div className="mt-8">
          <Link href="/menu" className="btn text-xs font-bold uppercase tracking-wider">
            Explore Station Menu
          </Link>
        </div>
      )}
    </main>
  );
}
