'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, Minus, Plus, UtensilsCrossed } from 'lucide-react';
import { addCartItem } from '@/lib/cart';
import { money, productImageUrl } from '@/lib/menu';
import { useCatalogProducts } from '@/lib/use-catalog-products';

export default function ProductDetail() {
  const { slug } = useParams<{ slug: string }>();
  const catalog = useCatalogProducts();
  const product = catalog.products.find((item) => item.slug === slug);
  const [variantId, setVariantId] = useState('');
  const [addonIds, setAddonIds] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [cartError, setCartError] = useState('');

  const variants = useMemo(() => product?.variants?.filter((variant) => variant.is_available) ?? [], [product]);
  const addons = useMemo(() => product?.addons?.filter((addon) => addon.is_available) ?? [], [product]);
  const selectedVariant = variants.find((variant) => variant.id === variantId);
  const selectedAddons = addons.filter((addon) => addonIds.includes(addon.id));
  const estimate = (product?.price ?? 0) + (selectedVariant?.price_delta ?? 0) + selectedAddons.reduce((sum, addon) => sum + addon.price, 0);

  useEffect(() => {
    setVariantId(product?.variants?.find((variant) => variant.is_available)?.id ?? '');
    setAddonIds([]);
    setCartError('');
  }, [product?.id]);

  if (!product) {
    return (
      <main className="container py-24 text-center font-mono text-[#1c1b2a]">
        <h1 className="serif text-3xl font-bold">
          {catalog.status === 'loading'
            ? 'Accessing station menu item…'
            : catalog.status === 'unavailable'
            ? 'Station menu temporarily unavailable'
            : 'Menu item not found'}
        </h1>
        <div className="mt-6">
          <Link href="/menu" className="btn secondary text-xs uppercase tracking-wider">
            <ArrowLeft size={14} /> Back to Full Menu
          </Link>
        </div>
      </main>
    );
  }

  function add() {
    if (!product?.id) return;
    const result = addCartItem({
      product_id: product.id,
      ...(selectedVariant ? { variant_id: selectedVariant.id } : {}),
      addon_ids: addonIds,
      slug: product.slug,
      name: `${product.name}${selectedVariant ? ` (${selectedVariant.name})` : ''}${selectedAddons.length ? ` + ${selectedAddons.map((addon) => addon.name).join(', ')}` : ''}`,
      price: estimate,
      qty: quantity,
      image: product.image ?? '',
    });
    if (!result.ok) {
      setCartError(result.error);
      return;
    }
    window.location.assign('/cart');
  }

  return (
    <main className="container py-12 text-[#1c1b2a]">
      {/* Breadcrumbs */}
      <div className="mb-8 flex items-center gap-2 font-mono text-xs text-[#7c747a]">
        <Link href="/menu" className="hover:text-[#ff6b4a] transition-colors">
          Menu
        </Link>
        <span>/</span>
        <span className="text-[#635d64]">{product.category}</span>
        <span>/</span>
        <span className="text-[#ff6b4a]">{product.name}</span>
      </div>

      <div className="grid gap-12 lg:grid-cols-12">
        {/* Left Column: Image or Solid Brand Frame (Zero Gradients) */}
        <div className="lg:col-span-6">
          <div className="border-[3px] border-[#1c1b2a] shadow-[6px_6px_0_#1c1b2a] bg-[#fff6e9] p-3 ">
            <div className="relative aspect-square overflow-hidden border-[3px] border-[#1c1b2a] bg-[#fbe4cd]">
              {product.image ? (
                <img
                  className="h-full w-full object-cover"
                  src={productImageUrl(product.image)}
                  alt={product.name}
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-3 bg-[#fbe4cd] p-8 text-center text-[#635d64]">
                  <div className="flex h-14 w-14 items-center justify-center border-[3px] border-[#1c1b2a] bg-[#ffc857] text-[#ff6b4a]">
                    <UtensilsCrossed size={28} />
                  </div>
                  <span className="station-stamp">{product.category}</span>
                  <h2 className="serif text-3xl font-bold text-[#1c1b2a]">{product.name}</h2>
                  <span className="font-mono text-xs text-[#7c747a]">Pizza Station 1800 · Freshly Prepared</span>
                </div>
              )}

              {product.badge && (
                <span className="absolute left-4 top-4 border border-[#ff6b4a] bg-[#fff6e9] px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-[#ff6b4a]">
                  {product.badge}
                </span>
              )}
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-[#1c1b2a] pt-3 font-mono text-xs text-[#7c747a]">
              <span>PREPARED FRESH TO ORDER</span>
              <span className="text-[#ff6b4a]">100% HALAL</span>
            </div>
          </div>
        </div>

        {/* Right Column: Customizer & Details */}
        <div className="lg:col-span-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="station-tag">{product.category}</span>
              <span className="font-mono text-xs text-[#7c747a]">PLATFORM 1800</span>
            </div>

            <h1 className="serif mt-3 text-3xl font-bold sm:text-5xl text-[#1c1b2a]">
              {product.name}
            </h1>

            <p className="mt-4 text-sm leading-relaxed text-[#635d64]">
              {product.description}
            </p>

            <div className="mt-6 flex items-baseline gap-3 border-y border-[#1c1b2a] py-4">
              <span className="font-mono text-xs uppercase tracking-wider text-[#7c747a]">Price:</span>
              <strong className="font-mono text-2xl font-bold text-[#ff6b4a]">
                {money(estimate)}
              </strong>
              {variants.length > 0 && (
                <span className="font-mono text-xs text-[#7c747a]">
                  (Varies with selected size / crust)
                </span>
              )}
            </div>

            {/* Variants Radio Group */}
            {Boolean(variants.length) && (
              <fieldset className="mt-8">
                <legend className="font-mono text-xs font-bold uppercase tracking-wider text-[#635d64] mb-3">
                  1. Select Size / Portion:
                </legend>
                <div className="grid gap-2">
                  {variants.map((variant) => {
                    const isSelected = variantId === variant.id;
                    return (
                      <label
                        key={variant.id}
                        className={`flex cursor-pointer items-center justify-between rounded border p-3.5 transition-colors font-mono text-xs ${
                          isSelected
                            ? 'border-[#ff6b4a] bg-[#ffdfc2] text-[#1c1b2a]'
                            : 'border-[#1c1b2a] bg-[#fffcf5] text-[#635d64] hover:border-[#1c1b2a]'
                        }`}
                      >
                        <span className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="product-variant"
                            checked={isSelected}
                            onChange={() => setVariantId(variant.id)}
                            className="accent-[#ff6b4a]"
                          />
                          <span className="font-bold">{variant.name}</span>
                        </span>
                        <span className="text-[#ff6b4a] font-bold">
                          {money(product.price + variant.price_delta)}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            )}

            {/* Addons Checkbox Group */}
            {Boolean(addons.length) && (
              <fieldset className="mt-7">
                <legend className="font-mono text-xs font-bold uppercase tracking-wider text-[#635d64] mb-3">
                  2. Extras & Toppings:
                </legend>
                <div className="grid gap-2">
                  {addons.map((addon) => {
                    const isSelected = addonIds.includes(addon.id);
                    return (
                      <label
                        key={addon.id}
                        className={`flex cursor-pointer items-center justify-between rounded border p-3 transition-colors font-mono text-xs ${
                          isSelected
                            ? 'border-[#ff6b4a] bg-[#ffdfc2] text-[#1c1b2a]'
                            : 'border-[#1c1b2a] bg-[#fffcf5] text-[#635d64] hover:border-[#1c1b2a]'
                        }`}
                      >
                        <span className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(event) =>
                              setAddonIds(
                                event.target.checked
                                  ? [...addonIds, addon.id]
                                  : addonIds.filter((id) => id !== addon.id)
                              )
                            }
                            className="accent-[#ff6b4a]"
                          />
                          <span>{addon.name}</span>
                        </span>
                        <span className="text-[#ff6b4a]">+{money(addon.price)}</span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            )}
          </div>

          {/* Action Bar */}
          <div className="mt-10 border-t border-[#1c1b2a] pt-6">
            <div className="flex flex-wrap items-center gap-4">
              {/* Quantity Counter */}
              <div className="flex items-center border-[3px] border-[#1c1b2a] bg-[#fff6e9] font-mono">
                <button
                  type="button"
                  className="flex h-11 w-11 items-center justify-center text-[#635d64] hover:text-[#ff6b4a] transition-colors"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  aria-label="Decrease quantity"
                >
                  <Minus size={15} />
                </button>
                <span className="w-10 text-center font-bold text-sm text-[#1c1b2a]">
                  {quantity}
                </span>
                <button
                  type="button"
                  className="flex h-11 w-11 items-center justify-center text-[#635d64] hover:text-[#ff6b4a] transition-colors"
                  onClick={() => setQuantity(Math.min(20, quantity + 1))}
                  aria-label="Increase quantity"
                >
                  <Plus size={15} />
                </button>
              </div>

              {/* Order Button */}
              <button
                onClick={add}
                disabled={!product.id}
                className="btn flex-1 !py-3 text-sm font-bold uppercase tracking-wider disabled:cursor-not-allowed disabled:bg-[#ded8d5] disabled:text-[#7c747a]"
              >
                {product.id
                  ? `Add To Cart · ${money(estimate * quantity)}`
                  : 'Menu Item Unavailable'}
              </button>
            </div>

            {cartError && (
              <p role="alert" className="mt-3 font-mono text-xs text-[#c23348]">
                {cartError}
              </p>
            )}

            <p className="mt-4 font-mono text-[11px] text-[#7c747a]">
              Estimated price shown. Final receipt, delivery fee, and coupons verified at checkout.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
