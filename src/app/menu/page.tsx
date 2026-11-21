'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, BookOpen, MapPin, Phone, Search, Utensils } from 'lucide-react';
import { money, Product } from '@/lib/menu';
import { useCatalogProducts } from '@/lib/use-catalog-products';
import { restaurant } from '@/lib/restaurant';

function categorySlug(product: Product): string {
  return product.categorySlug ?? product.category.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export default function MenuPage() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const catalog = useCatalogProducts();

  const categories = useMemo(() => {
    const seen = new Map<string, { slug: string; name: string; sortOrder: number }>();
    for (const product of catalog.products) {
      const slug = categorySlug(product);
      if (!seen.has(slug)) seen.set(slug, { slug, name: product.category, sortOrder: product.categoryOrder ?? 999 });
    }
    return [...seen.values()].sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name));
  }, [catalog.products]);

  const filtered = useMemo(() => catalog.products.filter((product) =>
    (category === 'all' || categorySlug(product) === category)
    && `${product.name} ${product.description} ${product.tags.join(' ')}`.toLowerCase().includes(query.toLowerCase())
  ), [catalog.products, category, query]);

  const groups = categories.map((item) => ({
    ...item,
    products: filtered.filter((product) => categorySlug(product) === item.slug),
  })).filter((item) => item.products.length);

  return (
    <main className="container min-h-[60vh] py-12 sm:py-16 text-[#f6f1e8]">
      {/* Station Menu Board Header (Zero Gradients) */}
      <section className="rounded border-2 border-[#38332a] bg-[#171513] p-6 sm:p-10">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#2a2620] pb-4">
          <div className="flex items-center gap-2">
            <span className="station-tag">ROSTER 1800</span>
            <span className="font-mono text-[11px] text-[#8e877c]">STATION KITCHEN · MANIKGANJ</span>
          </div>
          <div className="flex items-center gap-2 font-mono text-[11px] text-[#e5b342]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#3ecf8e]" />
            <span>ACCEPTING ORDERS FOR DINE-IN & TAKEOUT</span>
          </div>
        </div>

        <div className="mt-6 max-w-3xl">
          <h1 className="serif text-4xl font-bold sm:text-6xl text-[#f6f1e8]">
            The Platform <span className="text-[#e5b342] italic">Menu</span>
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-[#c4bdae] sm:text-base">
            Stone-baked pizzas, hand-crafted smash burgers, slow-cooked Hyderabadi dum biryani pots, crispy appetiser platters, and chilled shakes. Click any item to explore sizes, crusts, and extra toppings.
          </p>
        </div>

        <div className="mt-8 flex flex-wrap gap-3 border-t border-[#2a2620] pt-6 font-mono text-xs">
          <a className="btn !py-2.5 !px-5 text-xs font-bold uppercase tracking-wider" href={`tel:${restaurant.phoneE164}`}>
            <Phone size={14} /> Call {restaurant.phone}
          </a>
          <a
            className="btn secondary !py-2.5 !px-5 text-xs font-bold uppercase tracking-wider"
            href={restaurant.mapsUrl}
            target="_blank"
            rel="noreferrer"
          >
            <MapPin size={14} className="text-[#e5b342]" /> Find On Google Maps
          </a>
          <Link href="/table" className="btn secondary !py-2.5 !px-5 text-xs font-bold uppercase tracking-wider">
            Dine-In Table QR
          </Link>
        </div>
      </section>

      {/* Catalog status warning if DB not connected */}
      {catalog.status === 'unavailable' && (
        <div role="status" className="mt-6 rounded border border-[#3e3423] bg-[#1d1912] p-4 text-xs font-mono text-[#ecd8a6]">
          Live database catalog is not loaded yet. Check Supabase connection and migrations; the original printed station menu pages are displayed below.
        </div>
      )}

      {/* Category Navigation and Search Bar */}
      <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-[#28241e] pb-6">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setCategory('all')}
            className={`rounded px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider transition-colors ${
              category === 'all'
                ? 'border border-[#e5b342] bg-[#e5b342] text-[#121110]'
                : 'border border-[#353029] bg-[#181614] text-[#c4bdae] hover:border-[#e5b342] hover:text-[#f6f1e8]'
            }`}
          >
            All Items
          </button>
          {categories.map((item) => (
            <button
              key={item.slug}
              onClick={() => setCategory(item.slug)}
              className={`rounded px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider transition-colors ${
                category === item.slug
                  ? 'border border-[#e5b342] bg-[#e5b342] text-[#121110]'
                  : 'border border-[#353029] bg-[#181614] text-[#c4bdae] hover:border-[#e5b342] hover:text-[#f6f1e8]'
              }`}
            >
              {item.name}
            </button>
          ))}
        </div>

        <label className="relative sm:w-72">
          <Search className="absolute left-3.5 top-3 text-[#8e877c]" size={15} />
          <input
            className="field w-full !pl-10 font-mono text-xs"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search pizza, burger, biryani…"
            aria-label="Search menu"
          />
        </label>
      </div>

      {catalog.status === 'loading' && (
        <p role="status" className="mt-8 font-mono text-xs text-[#9e988e]">
          Accessing current kitchen menu manifest…
        </p>
      )}

      {/* Menu Categories and Listing */}
      <div className="mt-12 space-y-16">
        {groups.map((group) => (
          <section key={group.slug} id={group.slug} className="scroll-mt-28">
            <div className="mb-6 flex items-end justify-between border-b-2 border-[#38332a] pb-3">
              <div>
                <span className="station-tag">CATEGORY</span>
                <h2 className="serif mt-1 text-2xl font-bold sm:text-3xl text-[#f6f1e8]">{group.name}</h2>
              </div>
              <span className="font-mono text-xs text-[#8e877c]">{group.products.length} Items</span>
            </div>

            <ul className="grid gap-4 md:grid-cols-2">
              {group.products.map((item) => (
                <li
                  key={item.id ?? item.slug}
                  className="group flex flex-col justify-between rounded border border-[#2b2721] bg-[#181614] p-5 transition-colors duration-200 hover:border-[#e5b342]"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <Link
                        href={`/menu/${item.slug}`}
                        className="serif text-lg font-bold text-[#f6f1e8] group-hover:text-[#e5b342] transition-colors"
                      >
                        {item.name}
                      </Link>
                      <span className="shrink-0 font-mono text-sm font-bold text-[#e5b342]">
                        {item.variants?.length ? 'From ' : ''}{money(item.price)}
                      </span>
                    </div>

                    <p className="mt-2 text-xs leading-5 text-[#9e988e]">
                      {item.description}
                    </p>

                    {Boolean(item.variants?.length) && (
                      <p className="mt-2 font-mono text-[10px] text-[#736c61]">
                        Sizes: {item.variants?.map((v) => v.name).join(' · ')}
                      </p>
                    )}
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-[#23201a] pt-3">
                    <span className="font-mono text-[10px] uppercase text-[#666055]">
                      {item.badge ? `✦ ${item.badge}` : 'Fresh Daily'}
                    </span>
                    <Link
                      href={`/menu/${item.slug}`}
                      className="inline-flex items-center gap-1 font-mono text-xs font-bold text-[#e5b342] hover:underline"
                    >
                      {item.variants?.length || item.addons?.length ? 'Choose Options' : 'View Item'}
                      <ArrowRight size={12} />
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}

        {catalog.status === 'ready' && !catalog.products.length && (
          <div className="rounded border border-[#2b2721] bg-[#181614] py-16 text-center">
            <Utensils size={32} className="mx-auto text-[#e5b342] mb-3" />
            <p className="font-mono text-sm text-[#9e988e]">
              The digital menu catalog is not loaded yet.
            </p>
            <p className="mt-1 text-xs text-[#6e685f]">
              Apply database migration 005 to seed the live items.
            </p>
          </div>
        )}

        {catalog.status === 'ready' && catalog.products.length > 0 && !filtered.length && (
          <div className="rounded border border-[#2b2721] bg-[#181614] py-16 text-center font-mono text-xs text-[#9e988e]">
            No dishes matching &ldquo;{query}&rdquo; found in {category === 'all' ? 'any category' : category}.
          </div>
        )}
      </div>

      {/* Original Printed Menu Section */}
      <details className="mt-20 rounded border border-[#2b2721] bg-[#181614] p-6 sm:p-8">
        <summary className="cursor-pointer serif text-xl font-bold text-[#f6f1e8] hover:text-[#e5b342] transition-colors">
          View Original Printed Station Menu (Pages 1 & 2)
        </summary>
        <p className="mt-2 text-xs text-[#9e988e]">
          High-resolution scans of the physical menus at Pizza Station 1800. Click to enlarge or download for offline viewing.
        </p>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {[1, 2].map((page) => (
            <figure key={page} className="overflow-hidden rounded border border-[#353029] bg-[#121110]">
              <a
                href={`/images/pizza-station-menu-page-${page}.png`}
                target="_blank"
                rel="noreferrer"
                aria-label={`Open original menu page ${page}`}
                className="block hover:opacity-95 transition-opacity"
              >
                <img
                  src={`/images/pizza-station-menu-page-${page}.png`}
                  alt={`Pizza Station 1800 printed menu page ${page}`}
                  className="w-full object-contain"
                />
              </a>
              <figcaption className="flex items-center justify-between border-t border-[#2a2620] p-3 font-mono text-xs text-[#c4bdae]">
                <span>Station Print · Sheet {page}</span>
                <a
                  className="text-[#e5b342] hover:underline"
                  href={`/images/pizza-station-menu-page-${page}.png`}
                  download={`pizza-station-menu-${page}.png`}
                >
                  Download File ↓
                </a>
              </figcaption>
            </figure>
          ))}
        </div>
      </details>
    </main>
  );
}
