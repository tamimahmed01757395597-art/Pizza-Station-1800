import Link from 'next/link';
import { ArrowRight, Flame, MapPin, Phone, QrCode, ShieldCheck, Sparkles, Utensils, Clock } from 'lucide-react';
import { FeaturedProducts } from '@/components/products';
import { restaurant } from '@/lib/restaurant';

export default function Home() {
  return (
    <main className="bg-[#121110] text-[#f6f1e8]">
      {/* Editorial Split Hero (Zero Gradients) */}
      <section className="border-b border-[#2b2721] bg-[#161412] py-14 sm:py-20">
        <div className="container grid items-center gap-12 lg:grid-cols-12">
          {/* Left Column: Hero Manifesto */}
          <div className="lg:col-span-7">
            <div className="mb-6 flex flex-wrap items-center gap-2">
              <span className="station-tag">
                <span className="h-1.5 w-1.5 rounded-full bg-[#e5b342]" />
                PLATFORM 1800 · MANIKGANJ
              </span>
              <span className="station-stamp">EST. 1800</span>
            </div>

            <h1 className="serif text-4xl font-bold leading-[1.08] sm:text-6xl lg:text-[64px]">
              Fire-baked crusts.<br />
              Charcoal grills.<br />
              <span className="text-[#e5b342] italic">Station craft.</span>
            </h1>

            <p className="mt-6 max-w-xl text-base leading-relaxed text-[#c4bdae] sm:text-lg">
              Freshly stretched stone-hearth pizzas, signature smash burgers, slow-steamed dum biryani pots, and crispy platters. Crafted fresh to order for dine-in table QR, takeout, and local delivery.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/menu" className="btn !py-3 !px-6 text-sm font-bold uppercase tracking-wider">
                Explore The Menu <ArrowRight size={16} />
              </Link>
              <Link href="/table" className="btn secondary !py-3 !px-6 text-sm font-bold uppercase tracking-wider">
                <QrCode size={16} className="text-[#e5b342]" /> Dine-In Table QR
              </Link>
              <a
                href={restaurant.mapsUrl}
                target="_blank"
                rel="noreferrer"
                className="btn secondary !py-3 !px-5 text-sm font-bold uppercase tracking-wider"
              >
                <MapPin size={16} className="text-[#e5b342]" /> Station Map
              </a>
            </div>

            {/* Station Trust Markers */}
            <div className="mt-12 grid grid-cols-2 gap-3 border-t border-[#2b2721] pt-8 sm:grid-cols-4 font-mono text-[11px] text-[#a69f92]">
              <div className="flex items-center gap-2">
                <Flame size={15} className="text-[#c83327] shrink-0" />
                <span>450°C Stone Oven</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck size={15} className="text-[#e5b342] shrink-0" />
                <span>100% Halal Kitchen</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock size={15} className="text-[#3ecf8e] shrink-0" />
                <span>Quick Table Dispatch</span>
              </div>
              <div className="flex items-center gap-2">
                <Utensils size={15} className="text-[#e5b342] shrink-0" />
                <span>Dine-In & Takeout</span>
              </div>
            </div>
          </div>

          {/* Right Column: Framed Editorial Hero Showcase Card */}
          <div className="lg:col-span-5">
            <div className="relative rounded border-2 border-[#3d372e] bg-[#1a1815] p-3 shadow-2xl">
              {/* Photo Container with Crisp Border */}
              <div className="relative aspect-[4/3] overflow-hidden rounded border border-[#2b2721] bg-[#121110]">
                <img
                  src="https://images.unsplash.com/photo-1579751626657-72bc17010498?auto=format&fit=crop&w=1200&q=85"
                  alt="Freshly stone-baked pizza at Pizza Station 1800"
                  className="h-full w-full object-cover"
                />
                <div className="absolute left-3 top-3 border border-[#121110] bg-[#121110] px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-[#e5b342]">
                  Station Signature
                </div>
                <div className="absolute bottom-3 right-3 border border-[#3d372e] bg-[#1a1815] px-2.5 py-1 font-mono text-[10px] text-[#f6f1e8]">
                  Stone Hearth · 450°C
                </div>
              </div>

              {/* Station Docket Details below image */}
              <div className="mt-4 border-t border-[#2b2721] pt-3">
                <div className="flex items-center justify-between font-mono text-xs">
                  <span className="text-[#9e988e]">ITEM NO. 1800-01</span>
                  <span className="text-[#e5b342] font-bold">MANIKGANJ CENTRAL</span>
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <div>
                    <h3 className="serif text-xl font-bold text-[#f6f1e8]">Neapolitan Fire Crust</h3>
                    <p className="text-xs text-[#9e988e]">San Marzano sauce, fresh mozzarella & fresh basil leaves.</p>
                  </div>
                  <Link
                    href="/menu"
                    className="shrink-0 rounded bg-[#e5b342] px-3 py-1.5 font-mono text-xs font-bold text-[#121110] hover:bg-[#f1c35b]"
                  >
                    Order
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Solid Station Marquee Banner (Zero Gradients) */}
      <div className="border-b border-[#2b2721] bg-[#e5b342] py-2.5 text-[#121110]">
        <div className="flex overflow-hidden whitespace-nowrap font-mono text-xs font-bold uppercase tracking-widest">
          <div className="flex shrink-0 items-center gap-8 px-4">
            <span>PIZZA STATION 1800</span>
            <span>✦</span>
            <span>STONE-BAKED PIZZAS</span>
            <span>✦</span>
            <span>CHARCOAL SMASH BURGERS</span>
            <span>✦</span>
            <span>HYDERABADI DUM BIRYANI</span>
            <span>✦</span>
            <span>DINE-IN TABLE QR SYSTEM</span>
            <span>✦</span>
            <span>CRISPY FRIED PLATTERS</span>
            <span>✦</span>
            <span>POSTAL DIV. 1800 MANIKGANJ</span>
            <span>✦</span>
            <span>EAT · DRINK · ENJOY</span>
            <span>✦</span>
          </div>
          <div className="flex shrink-0 items-center gap-8 px-4" aria-hidden="true">
            <span>PIZZA STATION 1800</span>
            <span>✦</span>
            <span>STONE-BAKED PIZZAS</span>
            <span>✦</span>
            <span>CHARCOAL SMASH BURGERS</span>
            <span>✦</span>
            <span>HYDERABADI DUM BIRYANI</span>
            <span>✦</span>
            <span>DINE-IN TABLE QR SYSTEM</span>
            <span>✦</span>
            <span>CRISPY FRIED PLATTERS</span>
            <span>✦</span>
            <span>POSTAL DIV. 1800 MANIKGANJ</span>
            <span>✦</span>
            <span>EAT · DRINK · ENJOY</span>
            <span>✦</span>
          </div>
        </div>
      </div>

      {/* Section: Customer Favourites */}
      <section className="container py-20">
        <div className="mb-10 flex flex-col justify-between gap-4 border-b border-[#2b2721] pb-6 sm:flex-row sm:items-end">
          <div>
            <span className="eyebrow">From The Stone Hearth & Grill</span>
            <h2 className="serif mt-2 text-3xl font-bold sm:text-4xl">
              Customer <span className="text-[#e5b342] italic">Favourites</span>
            </h2>
          </div>
          <Link
            href="/menu"
            className="inline-flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-wider text-[#e5b342] hover:underline"
          >
            Explore Full Menu ({restaurant.name}) <ArrowRight size={15} />
          </Link>
        </div>

        <FeaturedProducts />
      </section>

      {/* Section: The Station Craft Bento Grid */}
      <section className="border-y border-[#2b2721] bg-[#161412] py-20">
        <div className="container">
          <div className="mb-12 max-w-xl">
            <span className="eyebrow">The Station Standard</span>
            <h2 className="serif mt-2 text-3xl font-bold sm:text-4xl">
              Real ingredients, <span className="text-[#e5b342] italic">honest craft.</span>
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[#a69f92]">
              We built Pizza Station 1800 to bring authentic stone-fired dough and serious comfort food to Manikganj, without cutting corners.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {/* Card 1 */}
            <div className="flex flex-col justify-between rounded border border-[#2f2b25] bg-[#1b1917] p-6 sm:p-8">
              <div>
                <span className="station-stamp">PIZZA HERITAGE</span>
                <h3 className="serif mt-4 text-2xl font-bold text-[#f6f1e8]">48-Hour Cold Ferment</h3>
                <p className="mt-3 text-xs leading-relaxed text-[#9e988e]">
                  Our signature pizza dough undergoes a slow 48-hour cold proofing process. Bakes at 450°C into an airy, fragrant crust with authentic blistered leopard spots that won't sit heavy.
                </p>
              </div>
              <div className="mt-6 border-t border-[#292520] pt-4 font-mono text-[11px] text-[#e5b342]">
                ✦ Stretched by Hand Daily
              </div>
            </div>

            {/* Card 2 */}
            <div className="flex flex-col justify-between rounded border border-[#2f2b25] bg-[#1b1917] p-6 sm:p-8">
              <div>
                <span className="station-stamp">CHARCOAL & SPICE</span>
                <h3 className="serif mt-4 text-2xl font-bold text-[#f6f1e8]">Smash Burgers & Dum Biryani</h3>
                <p className="mt-3 text-xs leading-relaxed text-[#9e988e]">
                  A lot more than pizza: seared smash patties with crisp lacy edges on toasted brioche, aromatic long-grain Basmati dum biryani, and golden crispy wings tossed in house glaze.
                </p>
              </div>
              <div className="mt-6 border-t border-[#292520] pt-4 font-mono text-[11px] text-[#e5b342]">
                ✦ Fresh Patties · Rich Spices
              </div>
            </div>

            {/* Card 3 */}
            <div className="flex flex-col justify-between rounded border border-[#2f2b25] bg-[#1b1917] p-6 sm:p-8">
              <div>
                <span className="station-stamp">DINE-IN TECH</span>
                <h3 className="serif mt-4 text-2xl font-bold text-[#f6f1e8]">Instant Table QR Ordering</h3>
                <p className="mt-3 text-xs leading-relaxed text-[#9e988e]">
                  No waving at busy servers or waiting for paper bills. Scan your table QR code, browse live menu stock, customize your toppings, and transmit orders directly to kitchen screens.
                </p>
              </div>
              <div className="mt-6 border-t border-[#292520] pt-4 font-mono text-[11px] text-[#e5b342]">
                ✦ Live Kitchen Status Updates
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Dine-In Station Table QR Banner */}
      <section className="container py-16">
        <div className="rounded border-2 border-[#3d372e] bg-[#1a1815] p-8 sm:p-12">
          <div className="grid items-center gap-8 md:grid-cols-12">
            <div className="md:col-span-8">
              <span className="station-stamp">TABLE SERVICE · 1800</span>
              <h2 className="serif mt-3 text-3xl font-bold sm:text-4xl text-[#f6f1e8]">
                Sitting at a table right now?
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-[#c4bdae]">
                Scan the QR token display card on your table with your phone camera, or click below to enter your table session for instant ordering to the station kitchen.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/table" className="btn !py-2.5 !px-5 text-xs font-bold uppercase tracking-wider">
                  <QrCode size={16} /> Open Table Order Portal
                </Link>
                <Link href="/menu" className="btn secondary !py-2.5 !px-5 text-xs font-bold uppercase tracking-wider">
                  Browse Digital Menu
                </Link>
              </div>
            </div>
            <div className="flex justify-center md:col-span-4">
              <div className="flex flex-col items-center justify-center rounded border border-[#3d372e] bg-[#141210] p-6 text-center font-mono">
                <div className="flex h-16 w-16 items-center justify-center rounded border border-[#483f33] bg-[#1e1b17] text-[#e5b342]">
                  <QrCode size={36} />
                </div>
                <span className="mt-3 text-xs font-bold text-[#f6f1e8]">TABLE CODE ENTRY</span>
                <span className="text-[10px] text-[#8e877c]">Direct Kitchen Transmission</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Station Map & Visit Section */}
      <section className="container pb-20">
        <div className="rounded border border-[#2b2721] bg-[#181614] p-8 sm:p-10">
          <div className="grid gap-8 lg:grid-cols-12">
            <div className="lg:col-span-5 flex flex-col justify-between">
              <div>
                <span className="eyebrow">Station Coordinates</span>
                <h2 className="serif mt-2 text-3xl font-bold text-[#f6f1e8]">
                  Come visit the station.
                </h2>
                <p className="mt-4 text-xs leading-relaxed text-[#9e988e]">
                  Located centrally in Manikganj (Postal Division 1800). Drop in for a quick bite, family dinner, or order ahead for swift curbside pickup.
                </p>

                <div className="mt-6 space-y-3 font-mono text-xs">
                  <div className="flex items-center gap-3">
                    <MapPin size={16} className="text-[#e5b342] shrink-0" />
                    <span>Coordinates: {restaurant.latitude}, {restaurant.longitude}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Phone size={16} className="text-[#e5b342] shrink-0" />
                    <a href={`tel:${restaurant.phoneE164}`} className="text-[#e5b342] hover:underline">
                      {restaurant.phone}
                    </a>
                  </div>
                  <div className="flex items-center gap-3">
                    <Clock size={16} className="text-[#e5b342] shrink-0" />
                    <span>Daily: 11:00 AM – 11:00 PM</span>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-[#25221c] flex flex-wrap gap-3">
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
                  Call Station Hotline
                </a>
              </div>
            </div>

            <div className="lg:col-span-7 overflow-hidden rounded border border-[#2b2721]">
              <iframe
                title="Pizza Station 1800 location map"
                src={`https://www.google.com/maps?q=${restaurant.latitude},${restaurant.longitude}&output=embed`}
                className="h-[360px] w-full border-0 bg-[#121110]"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
