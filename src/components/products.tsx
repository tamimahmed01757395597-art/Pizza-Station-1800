'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowUpRight, Check, Plus, UtensilsCrossed } from 'lucide-react';
import { addCartItem } from '@/lib/cart';
import { money, Product, productImageUrl } from '@/lib/menu';
import { useCatalogProducts } from '@/lib/use-catalog-products';

export function ProductCard({ item }: { item: Product }) {
  const [added, setAdded] = useState(false);
  const [error, setError] = useState('');
  const needsOptions = Boolean(item.variants?.length || item.addons?.length);

  function add() {
    if (!item.id || needsOptions) return;
    const result = addCartItem({
      product_id: item.id,
      slug: item.slug,
      name: item.name,
      price: item.price,
      qty: 1,
      image: item.image ?? '',
      addon_ids: [],
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError('');
    setAdded(true);
    setTimeout(() => setAdded(false), 1200);
  }

  return (
    <article className="group flex flex-col justify-between rounded border border-[#2f2b24] bg-[#181614] transition-colors duration-200 hover:border-[#e5b342]">
      <div>
        <Link href={`/menu/${item.slug}`} className="relative block aspect-[1.3] overflow-hidden border-b border-[#2b2721] bg-[#141210]">
          {item.image ? (
            <img
              src={productImageUrl(item.image)}
              alt={item.name}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 bg-[#211a17] p-6 text-center text-[#d5ccbe]">
              <div className="flex h-10 w-10 items-center justify-center rounded border border-[#453a32] bg-[#181311] text-[#e5b342]">
                <UtensilsCrossed size={18} />
              </div>
              <span className="font-mono text-[10px] uppercase tracking-widest text-[#e5b342]">{item.category}</span>
              <span className="serif text-xl font-bold text-[#f6f1e8]">{item.name}</span>
            </div>
          )}

          {/* Solid Badges */}
          {item.badge && (
            <span className="absolute left-3 top-3 border border-[#e5b342] bg-[#141311] px-2.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-[#e5b342]">
              {item.badge}
            </span>
          )}

          <span className="absolute bottom-3 right-3 flex h-7 w-7 items-center justify-center rounded border border-[#3d372e] bg-[#121110] text-[#f6f1e8] opacity-90 transition-transform group-hover:scale-110">
            <ArrowUpRight size={14} />
          </span>
        </Link>

        <div className="p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#e5b342]">
              {item.category}
            </span>
            {item.variants && item.variants.length > 0 && (
              <span className="font-mono text-[10px] text-[#8e877c]">
                {item.variants.length} Sizes
              </span>
            )}
          </div>

          <Link href={`/menu/${item.slug}`}>
            <h3 className="serif mt-1.5 text-lg font-bold text-[#f6f1e8] transition-colors group-hover:text-[#e5b342]">
              {item.name}
            </h3>
          </Link>

          <p className="mt-2 line-clamp-2 min-h-10 text-xs leading-5 text-[#9e988e]">
            {item.description}
          </p>
        </div>
      </div>

      <div className="border-t border-[#25221d] p-4 sm:p-5 pt-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <span className="block font-mono text-[9px] uppercase tracking-wider text-[#736c61]">
              {item.variants?.length ? 'Starts from' : 'Price'}
            </span>
            <strong className="font-mono text-base font-bold text-[#f6f1e8]">
              {money(item.price)}
            </strong>
          </div>

          {item.id && needsOptions ? (
            <Link
              href={`/menu/${item.slug}`}
              className="inline-flex items-center gap-1 rounded bg-[#27231d] px-3.5 py-2 text-xs font-bold uppercase tracking-wider text-[#e5b342] border border-[#3e372b] transition-colors hover:bg-[#e5b342] hover:text-[#121110]"
            >
              Choose Options
            </Link>
          ) : (
            <button
              onClick={add}
              disabled={!item.id}
              className={`inline-flex items-center gap-1 rounded px-3.5 py-2 text-xs font-bold uppercase tracking-wider transition-colors disabled:cursor-not-allowed disabled:bg-[#25221e] disabled:text-[#666055] ${
                added
                  ? 'border border-[#3ecf8e] bg-[#1a2e22] text-[#3ecf8e]'
                  : 'border border-[#e5b342] bg-[#e5b342] text-[#121110] hover:bg-[#f1c35b]'
              }`}
              aria-label={`Add ${item.name} to order`}
              title={!item.id ? 'Ordering requires the connected menu' : undefined}
            >
              {added ? (
                <>
                  <Check size={14} /> Added
                </>
              ) : item.id ? (
                <>
                  <Plus size={14} /> Add
                </>
              ) : (
                'Unavailable'
              )}
            </button>
          )}
        </div>
        {error && <p role="alert" className="mt-2 font-mono text-xs text-[#ef8a7d]">{error}</p>}
      </div>
    </article>
  );
}

export function ProductGrid({ items }: { items: Product[] }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((product) => (
        <ProductCard item={product} key={product.id ?? product.slug} />
      ))}
    </div>
  );
}

export function FeaturedProducts() {
  const catalog = useCatalogProducts();
  if (catalog.status === 'loading') {
    return (
      <div className="rounded border border-[#2b2721] bg-[#181614] p-10 text-center font-mono text-xs text-[#9e988e]">
        Scanning station menu items…
      </div>
    );
  }
  if (catalog.status === 'unavailable') {
    return (
      <div className="rounded border border-[#3d3224] bg-[#1e1b16] p-8 text-center text-xs text-[#d8caad]">
        Connect Supabase and apply the restaurant menu migration to show the live menu favourites here.
      </div>
    );
  }
  const items = [
    ...catalog.products.filter((product) => product.badge === 'Featured'),
    ...catalog.products.filter((product) => product.badge !== 'Featured'),
  ].slice(0, 3);

  return items.length ? (
    <ProductGrid items={items} />
  ) : (
    <div className="rounded border border-[#2b2721] bg-[#181614] p-10 text-center font-mono text-xs text-[#9e988e]">
      Station kitchen favourites will appear here once loaded.
    </div>
  );
}
