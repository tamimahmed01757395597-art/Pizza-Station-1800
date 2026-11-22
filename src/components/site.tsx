'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Menu as MenuIcon, X, ShoppingBag, MapPin, Phone, Clock, QrCode, ArrowUpRight, Star } from 'lucide-react';
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

  const nav = [
    { href: '/menu', label: 'The Menu', active: pathname === '/menu' || pathname.startsWith('/menu/') },
    { href: '/table', label: 'Table QR', active: pathname.startsWith('/table') },
    { href: '/contact', label: 'Find Us', active: pathname === '/contact' },
    { href: '/account', label: 'Account', active: pathname.startsWith('/account') },
  ];

  return (
    <header className="sticky top-0 z-50 border-b-4 border-[#1c1b2a] bg-[#fff6e9] shadow-[0_6px_0_#1c1b2a20]">
      {/* Utility strip */}
      <div className="border-b-[3px] border-[#1c1b2a] bg-[#1c1b2a] py-1.5">
        <div className="container flex items-center justify-between font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#fff6e9] sm:text-[11px]">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-2 text-[#7fd1c1]">
              <span className="h-2 w-2 rounded-full bg-[#7fd1c1]" />
              Kitchen open
            </span>
            <span className="hidden text-[#7c747a] sm:inline">///</span>
            <span className="hidden text-[#ffc857] sm:inline">11:00 AM – 11:00 PM</span>
            <span className="hidden text-[#7c747a] md:inline">///</span>
            <span className="hidden md:inline">Manikganj · Postal 1800</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/table" className="flex items-center gap-1.5 text-[#ffc857] hover:text-[#ff6b4a]">
              <QrCode size={13} /> Table QR
            </Link>
            <span className="text-[#7c747a]">///</span>
            <a href={`tel:${restaurant.phoneE164}`} className="hover:text-[#ffc857]">
              {restaurant.phone}
            </a>
          </div>
        </div>
      </div>

      {/* Main masthead */}
      <div className="container flex h-[82px] items-center justify-between gap-4">
        <Link href="/" className="group flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center border-[3px] border-[#1c1b2a] bg-[#ff6b4a] p-1 shadow-[4px_4px_0_#1c1b2a] transition-transform group-hover:-translate-x-0.5 group-hover:-translate-y-0.5">
            <img
              src="/images/pizza-station-logo.png"
              alt="Pizza Station 1800"
              className="h-full w-full object-contain"
            />
          </div>
          <div className="flex flex-col leading-none">
            <span className="serif text-[17px] font-black tracking-tighter text-[#1c1b2a] group-hover:text-[#ff6b4a] sm:text-[20px]">
              PIZZA STATION <span className="mono inline-block rotate-[-4deg] bg-[#ffc857] px-1.5 py-0.5 text-[11px] text-[#1c1b2a]">1800</span>
            </span>
            <span className="mono mt-1.5 text-[9px] font-bold uppercase tracking-[0.22em] text-[#7c747a]">
              Eat · Drink · Enjoy
            </span>
          </div>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`border-2 px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-wider transition-all ${
                item.active
                  ? 'border-[#1c1b2a] bg-[#1c1b2a] text-[#ffc857] shadow-[3px_3px_0_#ff6b4a]'
                  : 'border-transparent text-[#1c1b2a] hover:border-[#1c1b2a] hover:bg-[#ffc857] hover:shadow-[3px_3px_0_#1c1b2a]'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/cart"
            data-cart-target
            className="relative flex h-11 w-11 items-center justify-center border-[3px] border-[#1c1b2a] bg-[#fffcf5] text-[#1c1b2a] shadow-[3px_3px_0_#1c1b2a] transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 hover:bg-[#ffc857]"
            aria-label={`Cart with ${count} items`}
          >
            <span data-cart-icon className="flex">
              <ShoppingBag size={19} />
            </span>
            {count > 0 && (
              <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center border-2 border-[#1c1b2a] bg-[#ff6b4a] px-1 font-mono text-[10px] font-bold text-[#1c1b2a]">
                {count}
              </span>
            )}
          </Link>

          <Link href="/menu" className="btn hidden !px-5 !py-3 text-[11px] sm:inline-flex">
            Order now <ArrowUpRight size={15} />
          </Link>

          <button
            type="button"
            className="flex h-11 w-11 items-center justify-center border-[3px] border-[#1c1b2a] bg-[#fffcf5] text-[#1c1b2a] shadow-[3px_3px_0_#1c1b2a] lg:hidden"
            onClick={() => setOpen(!open)}
            aria-label="Toggle navigation"
          >
            {open ? <X size={21} /> : <MenuIcon size={21} />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="border-t-4 border-[#1c1b2a] bg-[#fffcf5] py-5 lg:hidden">
          <nav className="container grid gap-2">
            {nav.map((item, index) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`flex items-center justify-between border-[3px] border-[#1c1b2a] px-4 py-3 font-mono text-xs font-bold uppercase tracking-wider shadow-[3px_3px_0_#1c1b2a] ${
                  index % 2 === 0 ? 'bg-[#ffc857] text-[#1c1b2a]' : 'bg-[#fff6e9] text-[#1c1b2a]'
                }`}
              >
                {item.label}
                <span>→</span>
              </Link>
            ))}
            <a href={`tel:${restaurant.phoneE164}`} className="btn mt-2 w-full text-xs">
              Call station: {restaurant.phone}
            </a>
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
    <footer className="mt-24 border-t-[5px] border-[#1c1b2a] bg-[#1c1b2a] text-[#fff6e9]">
      {/* Sticker strip */}
      <div className="border-b-[3px] border-[#1c1b2a] bg-[#ffc857] py-3 text-[#1c1b2a]">
        <div className="container flex flex-wrap items-center justify-between gap-3 font-mono text-[10px] font-bold uppercase tracking-[0.14em] sm:text-[11px]">
          <span className="flex items-center gap-2">
            <Star size={14} fill="#1c1b2a" />
            Stone-fired pizza · Smash burgers · Dum biryani · Crispy platters
          </span>
          <span className="hidden sm:inline">Dine-in /// Takeout /// Manikganj delivery</span>
        </div>
      </div>

      <div className="container py-16">
        <div className="grid gap-10 md:grid-cols-4">
          {/* Brand */}
          <div className="space-y-4 md:col-span-1">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center border-[3px] border-[#fff6e9] bg-[#ff6b4a] p-1 shadow-[4px_4px_0_#ffc857]">
                <img src="/images/pizza-station-logo.png" alt={restaurant.name} className="h-full w-full object-contain" />
              </div>
              <div>
                <h3 className="serif text-lg font-black text-[#fff6e9]">PIZZA STATION</h3>
                <span className="mono text-xs font-bold text-[#ffc857]">POST CODE 1800</span>
              </div>
            </div>
            <p className="text-xs leading-relaxed text-[#d6cfc9]">
              A loud little kitchen in Manikganj serving stone-baked crusts, charcoal smash burgers, slow-steamed biryani pots and crisp platters. Fresh, fast, unapologetically good.
            </p>
            <span className="brut-sticker pop">Eat · Drink · Enjoy</span>
          </div>

          {/* Menu links */}
          <div>
            <p className="eyebrow !border-[#ff6b4a] !text-[#ffc857]">The menu</p>
            <ul className="mt-5 space-y-3 font-mono text-xs font-bold uppercase tracking-wider">
              {[
                ['/menu#pizza', 'Stone-fired pizzas'],
                ['/menu#burgers', 'Smash burgers'],
                ['/menu#biryani', 'Dum biryani pots'],
                ['/menu#platters', 'Platters & wings'],
                ['/menu#beverages', 'Shakes & mocktails'],
              ].map(([href, label]) => (
                <li key={href}>
                  <Link href={href} className="group flex items-center gap-2 text-[#fff6e9] hover:text-[#ffc857]">
                    <span className="text-[#ff6b4a] transition-transform group-hover:translate-x-1">▸</span>
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Hours */}
          <div>
            <p className="eyebrow !border-[#ff6b4a] !text-[#ffc857]">Service & hours</p>
            <div className="mt-5 space-y-4 text-xs">
              <div className="flex items-start gap-3">
                <Clock size={17} className="mt-0.5 shrink-0 text-[#7fd1c1]" />
                <div>
                  <strong className="block font-bold uppercase text-[#fff6e9]">Kitchen hours</strong>
                  <span className="text-[#d6cfc9]">Monday – Sunday</span>
                  <p className="mono mt-1 font-bold text-[#ffc857]">11:00 AM – 11:00 PM</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <QrCode size={17} className="mt-0.5 shrink-0 text-[#7fd1c1]" />
                <div>
                  <strong className="block font-bold uppercase text-[#fff6e9]">Table QR ordering</strong>
                  <span className="text-[#d6cfc9]">Scan at your table, order straight to the kitchen.</span>
                </div>
              </div>
            </div>
          </div>

          {/* Location */}
          <div>
            <p className="eyebrow !border-[#ff6b4a] !text-[#ffc857]">Find the station</p>
            <div className="mt-5 space-y-4 text-xs">
              <a href={restaurant.mapsUrl} target="_blank" rel="noreferrer" className="group flex items-start gap-3 hover:text-[#ffc857]">
                <MapPin size={17} className="mt-0.5 shrink-0 text-[#ff6b4a]" />
                <div>
                  <strong className="block font-bold uppercase text-[#fff6e9] group-hover:text-[#ffc857]">Manikganj hub</strong>
                  <span className="text-[#d6cfc9]">Open Google Maps</span>
                  <p className="mono mt-1 text-[10px] text-[#958d92]">{restaurant.latitude}, {restaurant.longitude}</p>
                </div>
              </a>
              <a href={`tel:${restaurant.phoneE164}`} className="mono flex items-center gap-3 text-sm font-bold text-[#fff6e9] hover:text-[#ffc857]">
                <Phone size={16} className="text-[#ff6b4a]" />
                {restaurant.phone}
              </a>
              <a href={restaurant.mapsUrl} target="_blank" rel="noreferrer" className="btn secondary !border-[#fff6e9] !text-[#fff6e9] !shadow-[4px_4px_0_#ffc857] w-full !py-2.5 text-[11px] hover:!bg-[#ff6b4a] hover:!text-[#1c1b2a]">
                Get directions <ArrowUpRight size={14} />
              </a>
            </div>
          </div>
        </div>

        {/* Giant outline wordmark */}
        <div className="mt-14 select-none border-t-4 border-[#fff6e9] pt-8 text-center">
          <div
            className="serif text-[13vw] leading-[0.8] tracking-tighter sm:text-[80px]"
            style={{ WebkitTextStroke: '2px #fff6e9', color: 'transparent' }}
          >
            PIZZA STATION 1800
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center justify-between gap-4 border-t-4 border-[#fff6e9] pt-6 font-mono text-[10px] font-bold uppercase tracking-widest text-[#958d92] sm:flex-row">
          <p>© 2026 {restaurant.name} · All rights reserved.</p>
          <div className="flex flex-wrap items-center gap-5">
            <Link href="/menu" className="hover:text-[#ffc857]">Menu</Link>
            <Link href="/table" className="hover:text-[#ffc857]">Table QR</Link>
            <Link href="/contact" className="hover:text-[#ffc857]">Find us</Link>
            <Link href="/privacy" className="hover:text-[#ffc857]">Privacy</Link>
            <Link href="/terms" className="hover:text-[#ffc857]">Terms</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
