'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { CartItem, clearCart, readCart, saveCart } from '@/lib/cart';
import { money, productImageUrl } from '@/lib/menu';

export default function Cart() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const saved = readCart();
    setItems(saved.items);
    setError(saved.error ?? '');
  }, []);

  function save(next: CartItem[]) {
    try {
      saveCart(next);
      setItems(next);
      setError('');
    } catch {
      setError('Your browser could not save the cart. Check available storage and try again.');
    }
  }

  function removeAll() {
    try {
      clearCart();
      setItems([]);
      setError('');
    } catch {
      setError('Your browser could not clear the saved cart.');
    }
  }

  const total = items.reduce((sum, item) => sum + item.price * item.qty, 0);
  const previewItems = items.some((item) => !item.product_id);

  return (
    <main className="container min-h-[60vh] py-12 text-[#1c1b2a]">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#1c1b2a] pb-6">
        <div>
          <span className="station-tag">ORDER DOCKET · 1800</span>
          <h1 className="serif mt-2 text-3xl font-bold sm:text-5xl">
            Your Station <span className="text-[#ff6b4a] italic">Tray</span>
          </h1>
        </div>
        <Link href="/menu" className="btn secondary text-xs font-bold uppercase tracking-wider">
          <ArrowLeft size={14} /> Add More Items
        </Link>
      </div>

      {error && (
        <p role="alert" className="mt-6 border-[3px] border-[#1c1b2a] bg-[#ffe3dc] p-4 font-mono text-xs text-[#c23348]">
          {error}
        </p>
      )}

      {!items.length ? (
        <div className="mt-12 rounded border-2 border-dashed border-[#1c1b2a] bg-[#fff6e9] p-12 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center border-[3px] border-[#1c1b2a] bg-[#fbe4cd] text-[#ff6b4a]">
            <ShoppingBag size={28} />
          </div>
          <h2 className="serif mt-5 text-2xl font-bold text-[#1c1b2a]">Your tray is empty</h2>
          <p className="mt-2 text-xs text-[#635d64]">
            Browse our stone-baked pizzas, smash burgers, and biryani pots to start your order.
          </p>
          <div className="mt-6">
            <Link href="/menu" className="btn text-xs font-bold uppercase tracking-wider">
              Explore The Menu <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-10 grid gap-8 lg:grid-cols-12">
          {/* Items List */}
          <div className="space-y-4 lg:col-span-8">
            {items.map((item, index) => (
              <article
                key={`${item.product_id ?? item.slug}-${index}`}
                className="flex flex-col gap-4 border-[3px] border-[#1c1b2a] bg-[#fffcf5] p-4 transition-colors hover:border-[#1c1b2a] sm:flex-row sm:items-center"
              >
                {/* Image */}
                <div className="h-20 w-24 shrink-0 overflow-hidden border-[3px] border-[#1c1b2a] bg-[#fff6e9]">
                  {item.image ? (
                    <img
                      className="h-full w-full object-cover"
                      src={productImageUrl(item.image)}
                      alt={item.name}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-[#fbe4cd] p-2 text-center font-mono text-[10px] text-[#ff6b4a]">
                      Pizza Station
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="min-w-0 flex-1">
                  <h2 className="serif text-lg font-bold text-[#1c1b2a]">{item.name}</h2>
                  <p className="font-mono text-xs text-[#ff6b4a] mt-0.5">
                    {money(item.price)} each
                  </p>
                  {!item.product_id && (
                    <p className="mt-1 font-mono text-[10px] text-[#a34023]">
                      Preview item — re-add from live menu before checkout.
                    </p>
                  )}
                </div>

                {/* Stepper */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center border-[3px] border-[#1c1b2a] bg-[#fbe4cd] font-mono">
                    <button
                      type="button"
                      className="flex h-9 w-9 items-center justify-center text-[#635d64] hover:text-[#ff6b4a] transition-colors"
                      onClick={() =>
                        save(
                          items.map((current, i) =>
                            i === index ? { ...current, qty: Math.max(1, current.qty - 1) } : current
                          )
                        )
                      }
                      aria-label="Decrease quantity"
                    >
                      <Minus size={13} />
                    </button>
                    <span className="w-8 text-center text-xs font-bold text-[#1c1b2a]">
                      {item.qty}
                    </span>
                    <button
                      type="button"
                      className="flex h-9 w-9 items-center justify-center text-[#635d64] hover:text-[#ff6b4a] transition-colors"
                      onClick={() =>
                        save(
                          items.map((current, i) =>
                            i === index ? { ...current, qty: Math.min(20, current.qty + 1) } : current
                          )
                        )
                      }
                      aria-label="Increase quantity"
                    >
                      <Plus size={13} />
                    </button>
                  </div>

                  <span className="min-w-16 text-right font-mono text-sm font-bold text-[#1c1b2a]">
                    {money(item.price * item.qty)}
                  </span>

                  <button
                    type="button"
                    className="p-2 text-[#7c747a] hover:text-[#c23348] transition-colors"
                    onClick={() => save(items.filter((_, i) => i !== index))}
                    aria-label={`Remove ${item.name}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </article>
            ))}

            <div className="flex justify-between pt-2">
              <button
                type="button"
                onClick={removeAll}
                className="font-mono text-xs text-[#7c747a] hover:text-[#c23348] transition-colors"
              >
                Clear all items from tray
              </button>
            </div>
          </div>

          {/* Station Guest Bill Summary */}
          <aside className="lg:col-span-4">
            <div className="border-[3px] border-[#1c1b2a] shadow-[6px_6px_0_#1c1b2a] bg-[#fffcf5] p-6 ">
              <div className="border-b border-[#1c1b2a] pb-3">
                <span className="station-stamp">BILL SUMMARY</span>
                <h3 className="serif mt-2 text-2xl font-bold text-[#1c1b2a]">Station Docket</h3>
              </div>

              <div className="mt-5 space-y-3 font-mono text-xs">
                <div className="flex justify-between text-[#635d64]">
                  <span>Items Count:</span>
                  <span>{items.reduce((acc, i) => acc + i.qty, 0)} units</span>
                </div>
                <div className="flex justify-between text-[#635d64]">
                  <span>Subtotal:</span>
                  <span className="font-bold text-[#1c1b2a]">{money(total)}</span>
                </div>
                <div className="flex justify-between text-[#7c747a]">
                  <span>Delivery / Table Fee:</span>
                  <span>Calculated next</span>
                </div>
              </div>

              <div className="mt-6 border-t-2 border-dashed border-[#1c1b2a] pt-4 flex justify-between font-mono">
                <span className="text-sm font-bold uppercase text-[#635d64]">Estimated Total:</span>
                <strong className="text-xl font-bold text-[#ff6b4a]">{money(total)}</strong>
              </div>

              <div className="mt-6">
                <Link
                  href="/checkout"
                  className="btn w-full !py-3 text-xs font-bold uppercase tracking-wider"
                >
                  Proceed to Checkout <ArrowRight size={15} />
                </Link>
              </div>

              {previewItems && (
                <button
                  type="button"
                  onClick={removeAll}
                  className="mt-3 w-full border-[3px] border-[#1c1b2a] p-2 font-mono text-xs text-[#a34023] hover:bg-[#ffdfc2]"
                >
                  Remove preview items
                </button>
              )}

              <p className="mt-4 font-mono text-[10px] text-[#7c747a] leading-relaxed">
                Prices and dish availability are re-verified with live kitchen stock upon checkout submission.
              </p>
            </div>
          </aside>
        </div>
      )}
    </main>
  );
}
