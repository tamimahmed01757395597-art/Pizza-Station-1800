'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, Pause, Play, Plus, UtensilsCrossed } from 'lucide-react';
import { money, Product, productImageUrl } from '@/lib/menu';
import { useCatalogProducts } from '@/lib/use-catalog-products';
import { AddToBasketButton } from './add-to-basket';

export function ProductCard({ item }: { item: Product }) {
  const [added, setAdded] = useState(false);
  const [error, setError] = useState('');
  const imageRef = useRef<HTMLAnchorElement>(null);
  const needsOptions = Boolean(item.variants?.length || item.addons?.length);

  return (
    <article className="product-card-3d group flex h-full flex-col justify-between">
      <div>
        <Link
          ref={imageRef}
          href={`/menu/${item.slug}`}
          className="relative block aspect-[1.3] overflow-hidden border-b-[3px] border-[#1c1b2a] bg-[#fbe4cd]"
        >
          {item.image ? (
            <img
              src={productImageUrl(item.image)}
              alt={item.name}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 bg-[#fbe4cd] p-6 text-center text-[#635d64]">
              <div className="flex h-11 w-11 items-center justify-center border-[3px] border-[#1c1b2a] bg-[#ffc857] text-[#1c1b2a] shadow-[3px_3px_0_#1c1b2a]">
                <UtensilsCrossed size={19} />
              </div>
              <span className="mono text-[10px] font-bold uppercase tracking-widest text-[#ff6b4a]">{item.category}</span>
              <span className="serif text-xl leading-none text-[#1c1b2a]">{item.name}</span>
            </div>
          )}

          {item.badge && (
            <span className="brut-sticker absolute left-3 top-3 !bg-[#ffc857] !text-[9px]">{item.badge}</span>
          )}

          <span className="absolute bottom-3 right-3 flex h-8 w-8 items-center justify-center border-[3px] border-[#1c1b2a] bg-[#fffcf5] text-[#1c1b2a] shadow-[3px_3px_0_#1c1b2a] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
            <ArrowUpRight size={15} />
          </span>
        </Link>

        <div className="p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="mono text-[10px] font-bold uppercase tracking-widest text-[#ff6b4a]">
              {item.category}
            </span>
            {item.variants && item.variants.length > 0 && (
              <span className="mono text-[10px] text-[#7c747a]">{item.variants.length} Sizes</span>
            )}
          </div>

          <Link href={`/menu/${item.slug}`}>
            <h3 className="serif mt-2 text-xl leading-none text-[#1c1b2a] transition-colors group-hover:text-[#ff6b4a]">
              {item.name}
            </h3>
          </Link>

          <p className="mt-3 line-clamp-2 min-h-10 text-xs font-medium leading-5 text-[#635d64]">
            {item.description}
          </p>
        </div>
      </div>

      <div className="border-t-[3px] border-[#1c1b2a] p-4 pt-3 sm:p-5 sm:pt-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <span className="mono block text-[9px] font-bold uppercase tracking-wider text-[#7c747a]">
              {item.variants?.length ? 'Starts from' : 'Price'}
            </span>
            <strong className="mono text-lg font-bold text-[#1c1b2a]">{money(item.price)}</strong>
          </div>

          {item.id && needsOptions ? (
            <Link
              href={`/menu/${item.slug}`}
              className="mono inline-flex items-center gap-1 border-[3px] border-[#1c1b2a] bg-[#ffc857] px-3.5 py-2 text-[11px] font-bold uppercase tracking-wider text-[#1c1b2a] shadow-[3px_3px_0_#1c1b2a] transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5"
            >
              Choose options
            </Link>
          ) : (
            <AddToBasketButton
              item={{
                product_id: item.id,
                slug: item.slug,
                name: item.name,
                price: item.price,
                qty: 1,
                image: item.image ?? '',
                addon_ids: [],
              }}
              sourceRef={imageRef}
              disabled={!item.id}
              ariaLabel={`Add ${item.name} to order`}
              onAdded={() => {
                setError('');
                setAdded(true);
                setTimeout(() => setAdded(false), 1200);
              }}
              onError={setError}
              className={`mono inline-flex items-center gap-1 border-[3px] border-[#1c1b2a] px-3.5 py-2 text-[11px] font-bold uppercase tracking-wider shadow-[3px_3px_0_#1c1b2a] transition-transform enabled:hover:-translate-x-0.5 enabled:hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:bg-[#ded8d5] disabled:text-[#7c747a] disabled:shadow-none ${
                added
                  ? 'bg-[#7fd1c1] text-[#1c1b2a]'
                  : 'bg-[#ff6b4a] text-[#1c1b2a]'
              }`}
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
            </AddToBasketButton>
          )}
        </div>
        {error && <p role="alert" className="mono mt-2 text-xs font-bold text-[#c23348]">{error}</p>}
      </div>
    </article>
  );
}

export function ProductGrid({ items }: { items: Product[] }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((product) => (
        <ProductCard item={product} key={product.id ?? product.slug} />
      ))}
    </div>
  );
}

export function FeaturedProducts() {
  const catalog = useCatalogProducts();
  const trackRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const [autoPlay, setAutoPlay] = useState(true);

  const items = catalog.status === 'ready'
    ? [
        ...catalog.products.filter((product) => product.badge === 'Featured'),
        ...catalog.products.filter((product) => product.badge !== 'Featured'),
      ].slice(0, 4)
    : [];

  useEffect(() => {
    if (!autoPlay || paused || items.length < 2) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const timer = window.setInterval(() => {
      const track = trackRef.current;
      if (!track) return;
      const card = track.firstElementChild as HTMLElement | null;
      const step = card ? card.offsetWidth + 24 : 360;
      if (track.scrollLeft + track.clientWidth >= track.scrollWidth - 4) {
        track.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        track.scrollBy({ left: step, behavior: 'smooth' });
      }
    }, 4200);

    return () => window.clearInterval(timer);
  }, [autoPlay, paused, items.length, catalog.status]);

  function scrollByCard(direction: number) {
    const track = trackRef.current;
    if (!track) return;
    const card = track.firstElementChild as HTMLElement | null;
    track.scrollBy({ left: direction * (card ? card.offsetWidth + 24 : 360), behavior: 'smooth' });
  }

  if (catalog.status === 'loading') {
    return (
      <div className="border-[3px] border-[#1c1b2a] bg-[#fffcf5] p-10 text-center shadow-[6px_6px_0_#1c1b2a]">
        <p className="mono text-xs font-bold uppercase tracking-widest text-[#635d64]">Scanning the kitchen menu…</p>
      </div>
    );
  }
  if (catalog.status === 'unavailable') {
    return (
      <div className="border-[3px] border-[#1c1b2a] bg-[#ffc857] p-8 text-center shadow-[6px_6px_0_#1c1b2a]">
        <p className="text-sm font-bold text-[#1c1b2a]">Connect Supabase and apply the menu migration to show live favourites here.</p>
      </div>
    );
  }

  return items.length ? (
    <div
      className="product-carousel"
      role="region"
      aria-label="Featured dishes"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false);
      }}
    >
      <div ref={trackRef} className="product-carousel-stage">
        {items.map((item) => (
          <div className="product-carousel-card" key={item.id ?? item.slug}>
            <ProductCard item={item} />
          </div>
        ))}
      </div>
      <div className="product-carousel-controls">
        <button
          type="button"
          className="product-carousel-arrow"
          onClick={() => scrollByCard(-1)}
          aria-label="Previous featured dish"
        >
          <ArrowLeft size={19} />
        </button>
        <button
          type="button"
          className="product-carousel-arrow"
          onClick={() => setAutoPlay((playing) => !playing)}
          aria-label={autoPlay ? 'Pause carousel rotation' : 'Resume carousel rotation'}
        >
          {autoPlay ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <button
          type="button"
          className="product-carousel-arrow"
          onClick={() => scrollByCard(1)}
          aria-label="Next featured dish"
        >
          <ArrowRight size={19} />
        </button>
      </div>
    </div>
  ) : (
    <div className="border-[3px] border-dashed border-[#1c1b2a] bg-[#fffcf5] p-10 text-center shadow-[6px_6px_0_#1c1b2a]">
      <p className="mono text-xs font-bold uppercase tracking-widest text-[#635d64]">
        Kitchen favourites will appear here once the menu is loaded.
      </p>
    </div>
  );
}
