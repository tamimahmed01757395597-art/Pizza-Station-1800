import Link from 'next/link';
import { ArrowRight, Flame, MapPin, Phone, QrCode, ShieldCheck, Utensils, Clock, Star, Zap } from 'lucide-react';
import { FeaturedProducts } from '@/components/products';
import { ScrollReveal } from '@/components/scroll-reveal';
import { restaurant } from '@/lib/restaurant';

const marqueeItems = [
  'Stone-baked pizzas',
  'Charcoal smash burgers',
  'Hyderabadi dum biryani',
  'Crispy fried platters',
  'Dine-in table QR',
  'Postal division 1800',
  'Eat · Drink · Enjoy',
];

export default function Home() {
  return (
    <main className="bg-[#fff6e9] text-[#1c1b2a]">
      <ScrollReveal>
        {/* ============ HERO ============ */}
        <section className="relative overflow-hidden border-b-4 border-[#1c1b2a] bg-[#fff6e9] py-14 sm:py-20">
          <div className="halftone pointer-events-none absolute -left-14 top-6 h-64 w-64 opacity-20" />
          <div className="halftone pointer-events-none absolute -bottom-24 -right-16 h-80 w-80 opacity-15" />
          <div className="pointer-events-none absolute right-[6%] top-8 hidden h-20 w-20 rotate-12 border-4 border-[#1c1b2a] bg-[#0b7777] shadow-[6px_6px_0_#1c1b2a] lg:block" />
          <div className="pointer-events-none absolute left-[47%] top-4 hidden h-12 w-12 rounded-full border-4 border-[#1c1b2a] bg-[#ff7b9c] shadow-[4px_4px_0_#1c1b2a] lg:block" />

          <div className="container relative grid items-center gap-14 lg:grid-cols-12">
            {/* Copy */}
            <div className="lg:col-span-7">
              <div className="mb-7 flex flex-wrap items-center gap-3">
                <span className="brut-sticker hero-sticker">
                  <span className="h-2 w-2 rounded-full bg-[#7fd1c1]" />
                  Platform 1800 · Manikganj
                </span>
                <span className="station-stamp">Est. 1800</span>
              </div>

              <h1 className="hero-title serif text-[clamp(2.9rem,7.4vw,5.6rem)] leading-[0.9] tracking-[-0.045em]">
                Fire-baked.<br />
                <span className="marker">Charcoal-grilled.</span><br />
                <span className="marker tomato-marker">Always fresh.</span>
              </h1>

              <p className="hero-copy mt-7 max-w-xl text-base font-medium leading-relaxed text-[#635d64] sm:text-lg">
                Stone-hearth pizzas, lacy-edged smash burgers, slow-steamed dum biryani and crispy platters — made to order in Manikganj. Dine in, take away, or get it delivered.
              </p>

              <div className="hero-actions mt-9 flex flex-wrap items-center gap-4">
                <Link href="/menu" className="btn !px-7 !py-4 text-sm">
                  Explore the menu <ArrowRight size={17} />
                </Link>
                <Link href="/table" className="btn secondary !px-6 !py-4 text-sm">
                  <QrCode size={17} /> Dine-in table QR
                </Link>
                <a
                  href={restaurant.mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mono inline-flex items-center gap-2 border-b-[3px] border-[#1c1b2a] pb-1 text-xs font-bold uppercase tracking-wider hover:text-[#ff6b4a] hover:border-[#ff6b4a]"
                >
                  <MapPin size={15} /> Find us
                </a>
              </div>

              {/* Trust pills */}
              <div className="mt-12 flex flex-wrap gap-2.5 border-t-[3px] border-dashed border-[#1c1b2a] pt-7">
                {[
                  { icon: Flame, label: '450°C stone oven', color: '#ff6b4a' },
                  { icon: ShieldCheck, label: '100% halal kitchen', color: '#7fd1c1' },
                  { icon: Zap, label: 'Quick table dispatch', color: '#0b7777' },
                  { icon: Utensils, label: 'Dine-in & takeout', color: '#ffc857' },
                ].map(({ icon: Icon, label, color }) => (
                  <span
                    key={label}
                    className="mono flex items-center gap-2 border-[3px] border-[#1c1b2a] bg-[#fffcf5] px-3 py-2 text-[10px] font-bold uppercase tracking-wider shadow-[3px_3px_0_#1c1b2a]"
                  >
                    <span className="flex h-5 w-5 items-center justify-center border-2 border-[#1c1b2a]" style={{ background: color }}>
                      <Icon size={12} />
                    </span>
                    {label}
                  </span>
                ))}
              </div>
            </div>

            {/* Visual */}
            <div className="relative lg:col-span-5">
              <div className="absolute -right-3 -top-3 h-32 w-32 border-[3px] border-[#1c1b2a] bg-[#ffc857] shadow-[5px_5px_0_#1c1b2a]" />
              <div className="absolute -bottom-4 -left-4 h-28 w-28 rounded-full border-[3px] border-[#1c1b2a] bg-[#ff7b9c] shadow-[5px_5px_0_#1c1b2a]" />
              <div className="brut-frame relative rotate-[1.5deg] p-3">
                <div className="relative aspect-[4/3] overflow-hidden border-[3px] border-[#1c1b2a] bg-[#fbe4cd]">
                  <img
                    src="https://images.unsplash.com/photo-1579751626657-72bc17010498?auto=format&fit=crop&w=1200&q=85"
                    alt="Freshly stone-baked pizza at Pizza Station 1800"
                    className="h-full w-full object-cover"
                  />
                  <span className="brut-sticker pop absolute left-3 top-3 !rotate-[-5deg]">Station signature</span>
                  <span className="mono absolute bottom-3 right-3 border-[3px] border-[#1c1b2a] bg-[#fff6e9] px-2.5 py-1 text-[10px] font-bold uppercase shadow-[3px_3px_0_#1c1b2a]">
                    Stone hearth · 450°C
                  </span>
                </div>
                <div className="mt-4 flex items-end justify-between gap-3 border-t-[3px] border-[#1c1b2a] pt-3">
                  <div>
                    <p className="mono text-[10px] font-bold uppercase tracking-widest text-[#7c747a]">Item no. 1800-01</p>
                    <h2 className="serif mt-1 text-xl leading-none">Neapolitan fire crust</h2>
                    <p className="mt-2 text-xs text-[#635d64]">San Marzano sauce, fresh mozzarella & basil.</p>
                  </div>
                  <Link href="/menu" className="btn !px-4 !py-2.5 text-[11px] shrink-0">Order</Link>
                </div>
              </div>
              <div className="brut-sticker blue absolute -left-6 top-1/2 hidden !rotate-[-8deg] sm:inline-flex">
                <Star size={13} fill="currentColor" /> Baked fresh daily
              </div>
            </div>
          </div>
        </section>

        {/* ============ MARQUEE ============ */}
        <div className="marquee-band" aria-hidden="true">
          <div className="marquee-track">
            {[0, 1].map((copy) => (
              <span key={copy}>
                {marqueeItems.map((item) => (
                  <span key={item} className="flex items-center gap-7">
                    {item}
                    <span className="marquee-star">✦</span>
                  </span>
                ))}
              </span>
            ))}
          </div>
        </div>

        {/* ============ FAVOURITES ============ */}
        <section data-scroll-reveal className="container py-20">
          <div className="mb-10 flex flex-col justify-between gap-5 border-b-[3px] border-[#1c1b2a] pb-6 sm:flex-row sm:items-end">
            <div>
              <span className="eyebrow">01 / Most wanted</span>
              <h2 className="serif mt-3 text-4xl leading-none sm:text-5xl">
                Customer <span className="marker">favourites</span>
              </h2>
            </div>
            <Link
              href="/menu"
              className="mono inline-flex items-center gap-2 border-[3px] border-[#1c1b2a] bg-[#ffc857] px-4 py-3 text-[11px] font-bold uppercase tracking-wider shadow-[3px_3px_0_#1c1b2a] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[5px_5px_0_#1c1b2a]"
            >
              See the full menu <ArrowRight size={14} />
            </Link>
          </div>
          <FeaturedProducts />
        </section>

        {/* ============ STATS STRIP ============ */}
        <section data-scroll-reveal className="border-y-[3px] border-[#1c1b2a] bg-[#1c1b2a] text-[#fff6e9]">
          <div className="container grid grid-cols-2 divide-x-2 divide-[#fff6e9]/20 md:grid-cols-4">
            {[
              ['450°', 'Stone oven heat'],
              ['48 HR', 'Cold dough ferment'],
              ['100%', 'Halal kitchen'],
              ['1800', 'Postal division'],
            ].map(([value, label]) => (
              <div key={label} className="px-4 py-8 text-center sm:px-6 sm:py-10">
                <div className="serif text-3xl text-[#ffc857] sm:text-4xl">{value}</div>
                <p className="mono mt-2 text-[9px] font-bold uppercase tracking-[0.16em] text-[#d6cfc9] sm:text-[10px]">{label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ============ CRAFT / BENTO ============ */}
        <section data-scroll-reveal className="border-b-4 border-[#1c1b2a] bg-[#fff6e9] py-20">
          <div className="container">
            <div className="mb-12 max-w-2xl">
              <span className="eyebrow">02 / The station standard</span>
              <h2 className="serif mt-3 text-4xl leading-none sm:text-5xl">
                Real ingredients.<br /><span className="marker" style={{ background: '#7fd1c1' }}>No shortcuts.</span>
              </h2>
              <p className="mt-5 max-w-xl text-sm font-medium leading-relaxed text-[#635d64]">
                We built Pizza Station 1800 to bring proper stone-fired dough and serious comfort food to Manikganj — without cutting corners.
              </p>
            </div>

            <div className="craft-grid grid gap-7 md:grid-cols-3">
              <div data-scroll-reveal className="brut-card flex flex-col justify-between bg-[#ffc857]">
                <div>
                  <div className="flex items-start justify-between">
                    <span className="station-stamp !bg-[#1c1b2a] !text-[#ffc857]">Pizza heritage</span>
                    <span className="count-num">01</span>
                  </div>
                  <h3 className="serif mt-5 text-2xl leading-none">48-hour cold ferment</h3>
                  <p className="mt-4 text-sm font-medium leading-relaxed text-[#1c1b2a]/80">
                    Slow-proofed dough baked at 450°C into an airy, fragrant crust with authentic blistered leopard spots.
                  </p>
                </div>
                <div className="mono mt-7 border-t-[3px] border-[#1c1b2a] pt-4 text-[10px] font-bold uppercase tracking-wider">
                  ✦ Stretched by hand, daily
                </div>
              </div>

              <div data-scroll-reveal className="brut-card flex flex-col justify-between bg-[#0b7777] text-[#fffcf5]">
                <div>
                  <div className="flex items-start justify-between">
                    <span className="station-stamp !border-[#fffcf5] !bg-[#fffcf5] !text-[#0b7777]">Charcoal & spice</span>
                    <span className="count-num !text-transparent" style={{ WebkitTextStroke: '2px #fffcf5' }}>02</span>
                  </div>
                  <h3 className="serif mt-5 text-2xl leading-none">Burgers & biryani</h3>
                  <p className="mt-4 text-sm font-medium leading-relaxed text-[#fffcf5]/85">
                    Seared smash patties with crisp lacy edges, aromatic Basmati dum biryani, and golden wings in house glaze.
                  </p>
                </div>
                <div className="mono mt-7 border-t-[3px] border-[#fffcf5] pt-4 text-[10px] font-bold uppercase tracking-wider">
                  ✦ Fresh patties · Rich spices
                </div>
              </div>

              <div data-scroll-reveal className="brut-card flex flex-col justify-between bg-[#7fd1c1]">
                <div>
                  <div className="flex items-start justify-between">
                    <span className="station-stamp !bg-[#1c1b2a] !text-[#7fd1c1]">Dine-in tech</span>
                    <span className="count-num">03</span>
                  </div>
                  <h3 className="serif mt-5 text-2xl leading-none">Instant table QR</h3>
                  <p className="mt-4 text-sm font-medium leading-relaxed text-[#1c1b2a]/80">
                    Scan your table code, browse live stock, customise toppings and transmit orders straight to kitchen screens.
                  </p>
                </div>
                <div className="mono mt-7 border-t-[3px] border-[#1c1b2a] pt-4 text-[10px] font-bold uppercase tracking-wider">
                  ✦ Live kitchen status updates
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============ TABLE QR BANNER ============ */}
        <section data-scroll-reveal className="container py-20">
          <div className="border-[4px] border-[#1c1b2a] bg-[#ff6b4a] p-7 text-[#1c1b2a] shadow-[10px_10px_0_#1c1b2a] sm:p-12">
            <div className="grid items-center gap-9 md:grid-cols-12">
              <div className="md:col-span-8">
                <span className="brut-sticker !bg-[#1c1b2a] !text-[#ffc857] !rotate-[-3deg]">Table service · 1800</span>
                <h2 className="serif mt-5 text-4xl leading-[0.95] sm:text-5xl">
                  Sitting at a table<br />right now?
                </h2>
                <p className="mt-5 max-w-xl text-sm font-medium leading-relaxed text-[#1c1b2a]/85">
                  Scan the QR card on your table, browse the live menu, and send your order straight to the kitchen. No waiting, no waving.
                </p>
                <div className="mt-7 flex flex-wrap gap-4">
                  <Link href="/table" className="btn !border-[#1c1b2a] !bg-[#1c1b2a] !text-[#ffc857] !shadow-[5px_5px_0_#fffcf5] hover:!bg-[#ffc857] hover:!text-[#1c1b2a]">
                    <QrCode size={17} /> Open table portal
                  </Link>
                  <Link href="/menu" className="btn !border-[#1c1b2a] !bg-[#fffcf5] !text-[#1c1b2a] !shadow-[5px_5px_0_#1c1b2a] hover:!bg-[#ffc857]">
                    Browse digital menu
                  </Link>
                </div>
              </div>
              <div className="flex justify-center md:col-span-4">
                <div className="relative">
                  <div className="absolute -right-3 -top-3 h-full w-full border-[3px] border-[#1c1b2a] bg-[#ffc857]" />
                  <div className="relative flex h-52 w-52 flex-col items-center justify-center border-[4px] border-[#1c1b2a] bg-[#fff6e9] text-center text-[#1c1b2a] shadow-[8px_8px_0_#1c1b2a]">
                    <div className="flex h-20 w-20 items-center justify-center border-[3px] border-[#1c1b2a] bg-[#ffc857]">
                      <QrCode size={44} />
                    </div>
                    <span className="mono mt-4 text-xs font-bold uppercase tracking-widest">Table code entry</span>
                    <span className="mono mt-1 text-[9px] uppercase tracking-wider text-[#7c747a]">Direct kitchen transmission</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============ VISIT / MAP ============ */}
        <section data-scroll-reveal className="container pb-20">
          <div className="grid gap-8 lg:grid-cols-12">
            <div className="flex flex-col justify-between lg:col-span-5">
              <div>
                <span className="eyebrow">03 / Station coordinates</span>
                <h2 className="serif mt-3 text-4xl leading-none sm:text-5xl">Come visit<br />the station.</h2>
                <p className="mt-5 text-sm font-medium leading-relaxed text-[#635d64]">
                  Find us centrally in Manikganj (Postal Division 1800). Drop in for a quick bite, family dinner, or order ahead for swift pickup.
                </p>
                <div className="mono mt-7 space-y-3 text-xs font-bold">
                  <div className="flex items-center gap-3 border-b-[3px] border-dashed border-[#1c1b2a] pb-3">
                    <MapPin size={17} className="shrink-0 text-[#ff6b4a]" />
                    {restaurant.latitude}, {restaurant.longitude}
                  </div>
                  <div className="flex items-center gap-3 border-b-[3px] border-dashed border-[#1c1b2a] pb-3">
                    <Phone size={17} className="shrink-0 text-[#ff6b4a]" />
                    <a href={`tel:${restaurant.phoneE164}`} className="hover:text-[#ff6b4a]">{restaurant.phone}</a>
                  </div>
                  <div className="flex items-center gap-3">
                    <Clock size={17} className="shrink-0 text-[#ff6b4a]" />
                    Daily · 11:00 AM – 11:00 PM
                  </div>
                </div>
              </div>
              <div className="mt-9 flex flex-wrap gap-4">
                <a href={restaurant.mapsUrl} target="_blank" rel="noreferrer" className="btn !px-5 !py-3 text-xs">
                  Open in Google Maps <ArrowRight size={15} />
                </a>
                <a href={`tel:${restaurant.phoneE164}`} className="btn secondary !px-5 !py-3 text-xs">
                  Call the station
                </a>
              </div>
            </div>

            <div className="lg:col-span-7">
              <div className="brut-frame overflow-hidden p-2">
                <iframe
                  title="Pizza Station 1800 location map"
                  src={`https://www.google.com/maps?q=${restaurant.latitude},${restaurant.longitude}&output=embed`}
                  className="h-[380px] w-full border-[3px] border-[#1c1b2a] bg-[#fbe4cd]"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            </div>
          </div>
        </section>
      </ScrollReveal>
    </main>
  );
}
