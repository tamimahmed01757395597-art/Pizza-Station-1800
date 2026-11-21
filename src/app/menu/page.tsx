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
    <main className="container min-h-[60vh] py-12 sm:py-16 text-[#1c1b2a]">
      {/* Station Menu Board Header (Zero Gradients) */}
      <section className="border-[3px] border-[#1c1b2a] shadow-[6px_6px_0_#1c1b2a] bg-[#fffcf5] p-6 sm:p-10">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1c1b2a] pb-4">
          <div className="flex items-center gap-2">
            <span className="station-tag">ROSTER 1800</span>
            <span className="font-mono text-[11px] text-[#7c747a]">STATION KITCHEN · MANIKGANJ</span>
          </div>
          <div className="flex items-center gap-2 font-mono text-[11px] text-[#ff6b4a]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#0b7777]" />
            <span>ACCEPTING ORDERS FOR DINE-IN & TAKEOUT</span>
          </div>
        </div>

        <div className="mt-6 max-w-3xl">
          <h1 className="serif text-4xl font-bold sm:text-6xl text-[#1c1b2a]">
            The Platform <span className="text-[#ff6b4a] italic">Menu</span>
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-[#635d64] sm:text-base">
            Stone-baked pizzas, hand-crafted smash burgers, slow-cooked Hyderabadi dum biryani pots, crispy appetiser platters, and chilled shakes. Click any item to explore sizes, crusts, and extra toppings.
          </p>
        </div>

        <div className="mt-8 flex flex-wrap gap-3 border-t border-[#1c1b2a] pt-6 font-mono text-xs">
          <a className="btn !py-2.5 !px-5 text-xs font-bold uppercase tracking-wider" href={`tel:${restaurant.phoneE164}`}>
            <Phone size={14} /> Call {restaurant.phone}
          </a>
          <a
            className="btn secondary !py-2.5 !px-5 text-xs font-bold uppercase tracking-wider"
            href={restaurant.mapsUrl}
            target="_blank"
            rel="noreferrer"
          >
            <MapPin size={14} className="text-[#ff6b4a]" /> Find On Google Maps
          </a>
          <Link href="/table" className="btn secondary !py-2.5 !px-5 text-xs font-bold uppercase tracking-wider">
            Dine-In Table QR
          </Link>
        </div>
      </section>

      {/* Catalog status warning if DB not connected */}
      {catalog.status === 'unavailable' && (
        <div role="status" className="mt-6 border-[3px] border-[#1c1b2a] bg-[#fde8d5] p-4 text-xs font-mono text-[#a34023]">
          Live database catalog is not loaded yet. Check Supabase connection and migrations; the original printed station menu pages are displayed below.
        </div>
      )}

      {/* Category Navigation and Search Bar */}
      <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-[#1c1b2a] pb-6">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setCategory('all')}
            className={`rounded px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider transition-colors ${
              category === 'all'
                ? 'border-[3px] border-[#1c1b2a] bg-[#ff6b4a] text-[#1c1b2a] shadow-[3px_3px_0_#1c1b2a]'
                : 'border border-[#1c1b2a] bg-[#fffcf5] text-[#635d64] hover:border-[#ff6b4a] hover:text-[#1c1b2a]'
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
                  ? 'border-[3px] border-[#1c1b2a] bg-[#ff6b4a] text-[#1c1b2a] shadow-[3px_3px_0_#1c1b2a]'
                  : 'border border-[#1c1b2a] bg-[#fffcf5] text-[#635d64] hover:border-[#ff6b4a] hover:text-[#1c1b2a]'
              }`}
            >
              {item.name}
            </button>
          ))}
        </div>

        <label className="relative sm:w-72">
          <Search className="absolute left-3.5 top-3 text-[#7c747a]" size={15} />
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
        <p role="status" className="mt-8 font-mono text-xs text-[#635d64]">
          Accessing current kitchen menu manifest…
        </p>
      )}

      {/* Menu Categories and Listing */}
      <div className="mt-12 space-y-16">
        {groups.map((group) => (
          <section key={group.slug} id={group.slug} className="scroll-mt-28">
            <div className="mb-6 flex items-end justify-between border-b-2 border-[#1c1b2a] pb-3">
              <div>
                <span className="station-tag">CATEGORY</span>
                <h2 className="serif mt-1 text-2xl font-bold sm:text-3xl text-[#1c1b2a]">{group.name}</h2>
              </div>
              <span className="font-mono text-xs text-[#7c747a]">{group.products.length} Items</span>
            </div>

            <ul className="grid gap-4 md:grid-cols-2">
              {group.products.map((item) => (
                <li
                  key={item.id ?? item.slug}
                  className="group flex flex-col justify-between border-[3px] border-[#1c1b2a] bg-[#fffcf5] p-5 transition-colors duration-200 hover:border-[#ff6b4a]"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <Link
                        href={`/menu/${item.slug}`}
                        className="serif text-lg font-bold text-[#1c1b2a] group-hover:text-[#ff6b4a] transition-colors"
                      >
                        {item.name}
                      </Link>
                      <span className="shrink-0 font-mono text-sm font-bold text-[#ff6b4a]">
                        {item.variants?.length ? 'From ' : ''}{money(item.price)}
                      </span>
                    </div>

                    <p className="mt-2 text-xs leading-5 text-[#635d64]">
                      {item.description}
                    </p>

                    {Boolean(item.variants?.length) && (
                      <p className="mt-2 font-mono text-[10px] text-[#7c747a]">
                        Sizes: {item.variants?.map((v) => v.name).join(' · ')}
                      </p>
                    )}
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-[#1c1b2a] pt-3">
                    <span className="font-mono text-[10px] uppercase text-[#7c747a]">
                      {item.badge ? `✦ ${item.badge}` : 'Fresh Daily'}
                    </span>
                    <Link
                      href={`/menu/${item.slug}`}
                      className="inline-flex items-center gap-1 font-mono text-xs font-bold text-[#ff6b4a] hover:underline"
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
          <div className="border-[3px] border-[#1c1b2a] bg-[#fffcf5] py-16 text-center">
            <Utensils size={32} className="mx-auto text-[#ff6b4a] mb-3" />
            <p className="font-mono text-sm text-[#635d64]">
              The digital menu catalog is not loaded yet.
            </p>
            <p className="mt-1 text-xs text-[#7c747a]">
              Apply database migration 005 to seed the live items.
            </p>
          </div>
        )}

        {catalog.status === 'ready' && catalog.products.length > 0 && !filtered.length && (
          <div className="border-[3px] border-[#1c1b2a] bg-[#fffcf5] py-16 text-center font-mono text-xs text-[#635d64]">
            No dishes matching &ldquo;{query}&rdquo; found in {category === 'all' ? 'any category' : category}.
          </div>
        )}
      </div>

      {/* Original Printed Menu Section */}
      <details className="mt-20 border-[3px] border-[#1c1b2a] bg-[#fffcf5] p-6 sm:p-8">
        <summary className="cursor-pointer serif text-xl font-bold text-[#1c1b2a] hover:text-[#ff6b4a] transition-colors">
          View Original Printed Station Menu (Pages 1 & 2)
        </summary>
        <p className="mt-2 text-xs text-[#635d64]">
          High-resolution scans of the physical menus at Pizza Station 1800. Click to enlarge or download for offline viewing.
        </p>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {[1, 2].map((page) => (
            <figure key={page} className="overflow-hidden border-[3px] border-[#1c1b2a] bg-[#fff6e9]">
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
              <figcaption className="flex items-center justify-between border-t border-[#1c1b2a] p-3 font-mono text-xs text-[#635d64]">
                <span>Station Print · Sheet {page}</span>
                <a
                  className="text-[#ff6b4a] hover:underline"
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
