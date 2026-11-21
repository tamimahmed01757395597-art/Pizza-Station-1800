'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Menu as MenuIcon, X, ShoppingBag, MapPin, Phone, Clock, QrCode, ArrowUpRight } from 'lucide-react';
import { restaurant } from '@/lib/restaurant';

function isStandaloneTableRoute(pathname: string) {
  return pathname === '/table' || pathname.startsWith('/table/') || pathname.startsWith('/table-menu');
}

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);

  useEffect(() => {
    const sync = () => {
      try {
        const raw = localStorage.getItem('ps-cart');
        const items = raw ? JSON.parse(raw) : [];
        setCount(items.reduce((total: number, item: { qty: number }) => total + (item.qty || 0), 0));
      } catch {
        setCount(0);
      }
    };
    sync();
    window.addEventListener('storage', sync);
    window.addEventListener('cartchange', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('cartchange', sync);
    };
  }, []);

  if (isStandaloneTableRoute(pathname)) return null;

  return (
    <header className="sticky top-0 z-50 border-b border-[#2b2721] bg-[#141311]">
      {/* Station Announcement Utility Bar */}
      <div className="border-b border-[#221f1a] bg-[#0c0c0b] py-1.5 text-xs">
        <div className="container flex items-center justify-between font-mono text-[11px] text-[#a69f92]">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-[#e5b342]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#3ecf8e]" />
              STATION KITCHEN OPEN
            </span>
            <span className="hidden sm:inline text-[#666055]">|</span>
            <span className="hidden sm:inline">11:00 AM – 11:00 PM DAILY</span>
            <span className="hidden md:inline text-[#666055]">|</span>
            <span className="hidden md:inline">POSTAL DIV. 1800, MANIKGANJ</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/table" className="flex items-center gap-1 text-[#e5b342] hover:underline">
              <QrCode size={12} />
              <span>Dine-In Table QR</span>
            </Link>
            <span className="text-[#666055]">|</span>
            <a href={`tel:${restaurant.phoneE164}`} className="hover:text-[#f6f1e8]">
              {restaurant.phone}
            </a>
          </div>
        </div>
      </div>

      {/* Main Masthead Header */}
      <div className="container flex h-[72px] items-center justify-between">
        <Link href="/" className="group flex items-center gap-3">
          <div className="relative flex h-11 w-11 items-center justify-center rounded border border-[#3d372e] bg-[#1a1815] p-1 transition-colors group-hover:border-[#e5b342]">
            <img
              src="/images/pizza-station-logo.png"
              alt="Pizza Station 1800"
              className="h-full w-full object-contain"
            />
          </div>
          <div className="flex flex-col">
            <span className="serif text-lg font-bold tracking-tight text-[#f6f1e8] group-hover:text-[#e5b342] transition-colors">
              PIZZA STATION <span className="font-mono text-xs font-normal text-[#e5b342]">1800</span>
            </span>
            <span className="font-mono text-[9px] uppercase tracking-widest text-[#9e988e]">
              Eat · Drink · Enjoy
            </span>
          </div>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden items-center gap-7 text-xs font-bold uppercase tracking-wider text-[#d0c9bc] md:flex">
          <Link
            href="/menu"
            className={`transition-colors hover:text-[#e5b342] ${pathname === '/menu' ? 'text-[#e5b342]' : ''}`}
          >
            The Menu
          </Link>
          <Link
            href="/table"
            className={`transition-colors hover:text-[#e5b342] ${pathname.startsWith('/table') ? 'text-[#e5b342]' : ''}`}
          >
            Table QR
          </Link>
          <Link
            href="/contact"
            className={`transition-colors hover:text-[#e5b342] ${pathname === '/contact' ? 'text-[#e5b342]' : ''}`}
          >
            Location
          </Link>
          <Link
            href="/account"
            className={`transition-colors hover:text-[#e5b342] ${pathname.startsWith('/account') ? 'text-[#e5b342]' : ''}`}
          >
            Account
          </Link>
        </nav>

        {/* Right CTA / Cart */}
        <div className="flex items-center gap-3">
          <Link
            href="/cart"
            className="relative flex h-10 w-10 items-center justify-center rounded border border-[#353029] bg-[#1b1917] text-[#f6f1e8] transition-colors hover:border-[#e5b342] hover:text-[#e5b342]"
            aria-label={`Cart with ${count} items`}
          >
            <ShoppingBag size={18} />
            {count > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#c83327] px-1 font-mono text-[10px] font-bold text-white">
                {count}
              </span>
            )}
          </Link>

          <Link href="/menu" className="btn hidden sm:inline-flex !py-2 !px-4 text-xs font-bold uppercase tracking-wider">
            Order Now
          </Link>

          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded border border-[#353029] bg-[#1b1917] text-[#f6f1e8] md:hidden hover:border-[#e5b342]"
            onClick={() => setOpen(!open)}
            aria-label="Toggle navigation"
          >
            {open ? <X size={20} /> : <MenuIcon size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {open && (
        <div className="border-t border-[#2b2721] bg-[#181614] py-5 md:hidden">
          <nav className="container grid gap-3 font-mono text-xs uppercase tracking-wider">
            <Link
              href="/menu"
              onClick={() => setOpen(false)}
              className="flex items-center justify-between border-b border-[#2b2721] pb-2 text-[#f6f1e8] hover:text-[#e5b342]"
            >
              <span>The Station Menu</span>
              <span className="text-[#8e877c]">→</span>
            </Link>
            <Link
              href="/table"
              onClick={() => setOpen(false)}
              className="flex items-center justify-between border-b border-[#2b2721] pb-2 text-[#f6f1e8] hover:text-[#e5b342]"
            >
              <span>Dine-In Table QR</span>
              <span className="text-[#e5b342]">Instant</span>
            </Link>
            <Link
              href="/contact"
              onClick={() => setOpen(false)}
              className="flex items-center justify-between border-b border-[#2b2721] pb-2 text-[#f6f1e8] hover:text-[#e5b342]"
            >
              <span>Platform Location & Hours</span>
              <span className="text-[#8e877c]">→</span>
            </Link>
            <Link
              href="/account"
              onClick={() => setOpen(false)}
              className="flex items-center justify-between border-b border-[#2b2721] pb-2 text-[#f6f1e8] hover:text-[#e5b342]"
            >
              <span>Customer Account</span>
              <span className="text-[#8e877c]">→</span>
            </Link>
            <div className="pt-2">
              <a
                href={`tel:${restaurant.phoneE164}`}
                className="btn secondary w-full text-center"
              >
                Call Station: {restaurant.phone}
              </a>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

export function SiteFooter() {
  const pathname = usePathname();
  if (isStandaloneTableRoute(pathname)) return null;

  return (
    <footer className="mt-24 border-t border-[#2b2721] bg-[#0c0c0b] text-[#c4bdae]">
      {/* Top Footer Banner */}
      <div className="border-b border-[#1f1d18] bg-[#12110f] py-4">
        <div className="container flex flex-wrap items-center justify-between gap-4 font-mono text-[11px] uppercase tracking-wider text-[#8e877c]">
          <span className="flex items-center gap-2">
            <span className="station-stamp">DIV. 1800</span>
            <span>STONE-FIRED PIZZA · DUM BIRYANI · SMASH BURGERS</span>
          </span>
          <span className="flex items-center gap-3">
            <span>DINE-IN</span>
            <span>·</span>
            <span>TAKEOUT</span>
            <span>·</span>
            <span>MANIKGANJ DELIVERY</span>
          </span>
        </div>
      </div>

      <div className="container py-16">
        <div className="grid gap-10 md:grid-cols-4">
          {/* Brand Info */}
          <div className="space-y-4 md:col-span-1">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded border border-[#353029] bg-[#181614] p-1">
                <img
                  src="/images/pizza-station-logo.png"
                  alt={restaurant.name}
                  className="h-full w-full object-contain"
                />
              </div>
              <div>
                <h3 className="serif text-lg font-bold text-[#f6f1e8]">PIZZA STATION</h3>
                <span className="font-mono text-xs text-[#e5b342]">POST CODE 1800</span>
              </div>
            </div>
            <p className="text-xs leading-relaxed text-[#9e988e]">
              A distinctive platform kitchen serving freshly stretched stone-baked crusts, charcoal smash burgers, slow-steamed biryani pots, and crisp platters in Manikganj.
            </p>
            <div className="pt-2">
              <span className="station-stamp">Eat · Drink · Enjoy</span>
            </div>
          </div>

          {/* Quick Menu */}
          <div>
            <p className="eyebrow mb-4">The Platform Menu</p>
            <ul className="space-y-2 text-xs font-mono">
              <li>
                <Link href="/menu#pizza" className="hover:text-[#e5b342] transition-colors">
                  → Stone-Fired Pizzas
                </Link>
              </li>
              <li>
                <Link href="/menu#burgers" className="hover:text-[#e5b342] transition-colors">
                  → Station Smash Burgers
                </Link>
              </li>
              <li>
                <Link href="/menu#biryani" className="hover:text-[#e5b342] transition-colors">
                  → Dum Biryani & Rice Pots
                </Link>
              </li>
              <li>
                <Link href="/menu#platters" className="hover:text-[#e5b342] transition-colors">
                  → Crispy Platters & Wings
                </Link>
              </li>
              <li>
                <Link href="/menu#beverages" className="hover:text-[#e5b342] transition-colors">
                  → Cold Shakes & Mocktails
                </Link>
              </li>
            </ul>
          </div>

          {/* Station Service */}
          <div>
            <p className="eyebrow mb-4">Service & Hours</p>
            <div className="space-y-3 text-xs">
              <div className="flex items-start gap-2.5">
                <Clock size={15} className="mt-0.5 text-[#e5b342] shrink-0" />
                <div>
                  <strong className="block text-[#f6f1e8]">Kitchen Hours</strong>
                  <span className="text-[#9e988e]">Monday – Sunday</span>
                  <p className="font-mono text-[#e5b342]">11:00 AM – 11:00 PM</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <QrCode size={15} className="mt-0.5 text-[#e5b342] shrink-0" />
                <div>
                  <strong className="block text-[#f6f1e8]">Table QR Ordering</strong>
                  <span className="text-[#9e988e]">Scan from your dining table for direct kitchen dispatch.</span>
                </div>
              </div>
            </div>
          </div>

          {/* Location & Contact */}
          <div>
            <p className="eyebrow mb-4">Platform Dispatch</p>
            <div className="space-y-3 text-xs">
              <a
                href={restaurant.mapsUrl}
                target="_blank"
                rel="noreferrer"
                className="group flex items-start gap-2.5 hover:text-[#f6f1e8]"
              >
                <MapPin size={15} className="mt-0.5 text-[#e5b342] shrink-0" />
                <div>
                  <strong className="block text-[#f6f1e8] group-hover:text-[#e5b342] transition-colors">
                    Manikganj Station Hub
                  </strong>
                  <span className="text-[#9e988e]">Open Google Maps Navigation</span>
                  <p className="font-mono text-[11px] text-[#6e685f]">
                    {restaurant.latitude}, {restaurant.longitude}
                  </p>
                </div>
              </a>
              <a
                href={`tel:${restaurant.phoneE164}`}
                className="flex items-center gap-2.5 text-[#f6f1e8] hover:text-[#e5b342] font-mono text-sm"
              >
                <Phone size={15} className="text-[#e5b342] shrink-0" />
                <span>{restaurant.phone}</span>
              </a>
              <div className="pt-2">
                <a
                  href={restaurant.mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn secondary w-full !py-2 text-xs"
                >
                  Get Directions <ArrowUpRight size={13} />
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom rules */}
        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-[#1f1d18] pt-8 text-[11px] font-mono text-[#6e685f] sm:flex-row">
          <p>© 2026 {restaurant.name} · All rights reserved.</p>
          <div className="flex items-center gap-6">
            <Link href="/menu" className="hover:text-[#9e988e]">Menu</Link>
            <Link href="/table" className="hover:text-[#9e988e]">Table QR</Link>
            <Link href="/contact" className="hover:text-[#9e988e]">Find Us</Link>
            <Link href="/admin" className="hover:text-[#9e988e]">Station Admin</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
