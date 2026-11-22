'use client';

import { animate, arc } from 'motion/react';
import { Pizza } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';
import { addCartItem, type CartItem } from '@/lib/cart';
import { productImageUrl } from '@/lib/menu';

/**
 * ==============   Constants   ================
 */

const BASKET_SIZE = 44;
const FALLBACK_INSET = 24;

type Direction = 'auto' | 'cw' | 'ccw';

interface AddToBasketButtonProps {
  /** The cart line to save when the button is pressed. */
  item: CartItem;
  /** Button label content. */
  children: React.ReactNode;
  /** Extra button classes (border, colours, shadow…). */
  className?: string;
  disabled?: boolean;
  ariaLabel?: string;
  /** The element the pizza should launch from, usually the product image. */
  sourceRef?: React.RefObject<HTMLElement | null>;
  onAdded?: () => void;
  onError?: (message: string) => void;
  /** Fires once the pizza lands (or immediately when motion is reduced). */
  onFlightEnd?: () => void;
  /** Arc tuning, kept close to the original component. */
  strength?: number;
  peak?: number;
  rotate?: number;
  duration?: number;
  direction?: Direction;
}

/**
 * A pizza that arcs out of the product card, shrinks into the header basket
 * and ripples the basket on impact. Falls back to a quiet "added" state when
 * motion is reduced or the basket is off screen.
 */
export function AddToBasketButton({
  item,
  children,
  className = '',
  disabled = false,
  ariaLabel,
  sourceRef,
  onAdded,
  onError,
  onFlightEnd,
  strength = 0.45,
  peak = 0.18,
  rotate = 0.8,
  duration = 0.5,
  direction = 'cw',
}: AddToBasketButtonProps) {
  const [mounted, setMounted] = useState(false);
  const [flying, setFlying] = useState(false);
  const flyingRef = useRef(false);
  const flyerRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  async function fly() {
    const flyer = flyerRef.current;
    const ring = ringRef.current;
    if (!flyer || !ring) return;

    const source = sourceRef?.current;
    const basket = document.querySelector<HTMLElement>('[data-cart-target]');
    const from = source?.getBoundingClientRect();
    const to = basket?.getBoundingClientRect();

    const size = from ? Math.max(64, Math.min(180, Math.min(from.width, from.height))) : 150;
    const startLeft = from ? from.left + (from.width - size) / 2 : window.innerWidth / 2 - size / 2;
    const startTop = from ? from.top + (from.height - size) / 2 : window.innerHeight / 2 - size / 2;

    const endLeft = to ? to.left + to.width / 2 - BASKET_SIZE / 2 : window.innerWidth - FALLBACK_INSET - BASKET_SIZE;
    const endTop = to ? to.top + to.height / 2 - BASKET_SIZE / 2 : FALLBACK_INSET;

    flyer.style.width = `${size}px`;
    flyer.style.height = `${size}px`;
    flyer.style.left = `${startLeft}px`;
    flyer.style.top = `${startTop}px`;
    flyer.style.opacity = '1';

    try {
      // Arc into the basket, shrinking to its size, then clip away at the
      // last moment so the pizza disappears inside.
      await animate(
        flyer,
        {
          x: endLeft - startLeft,
          y: endTop - startTop,
          scale: BASKET_SIZE / size,
          opacity: [1, 1, 0],
        },
        {
          duration,
          path: arc({
            strength,
            peak,
            rotate,
            direction: direction === 'auto' ? undefined : direction,
          }),
          ease: [0.74, 0.18, 0.93, 0.69],
          opacity: { inherit: true, times: [0, 0.92, 1] },
        },
      );

      // Ripple an outline out from the basket as it takes the hit.
      if (to) {
        ring.style.left = `${to.left}px`;
        ring.style.top = `${to.top}px`;
        ring.style.width = `${to.width}px`;
        ring.style.height = `${to.height}px`;
        animate(ring, { scale: [1, 2.4], opacity: [0.85, 0] }, { duration: 0.5, ease: 'easeOut' });

        const icon = basket?.querySelector<HTMLElement>('[data-cart-icon]');
        if (icon) {
          animate(icon, { scale: [1, 1.25, 1], rotate: [0, -8, 0] }, { duration: 0.42, ease: 'easeOut' });
        }
      }
    } finally {
      animate(flyer, { x: 0, y: 0, scale: 1, opacity: 0 }, { duration: 0 });
      flyer.style.opacity = '0';
    }
  }

  function handleClick() {
    if (disabled || flyingRef.current) return;

    const result = addCartItem(item);
    if (!result.ok) {
      onError?.(result.error);
      return;
    }
    onAdded?.();

    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      onFlightEnd?.();
      return;
    }

    flyingRef.current = true;
    setFlying(true);
    void fly().finally(() => {
      flyingRef.current = false;
      setFlying(false);
      onFlightEnd?.();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-busy={flying || undefined}
        className={className}
        style={{
          opacity: flying ? 0.55 : undefined,
          pointerEvents: flying ? 'none' : undefined,
        }}
      >
        {children}
      </button>

      {mounted &&
        createPortal(
          <div aria-hidden="true" style={layer}>
            <div ref={flyerRef} style={flyer}>
              {item.image ? (
                <img src={productImageUrl(item.image)} alt="" style={flyerImage} />
              ) : (
                <Pizza size={48} strokeWidth={1.6} style={flyerIcon} />
              )}
            </div>
            <div ref={ringRef} style={ring} />
          </div>,
          document.body,
        )}
    </>
  );
}

/**
 * ==============   Styles   ================
 */

const layer: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  pointerEvents: 'none',
  zIndex: 90,
};

const flyer: React.CSSProperties = {
  position: 'absolute',
  left: 0,
  top: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'hidden',
  border: '3px solid #1c1b2a',
  background: '#fffcf5',
  opacity: 0,
  willChange: 'transform, opacity',
};

const flyerImage: React.CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
};

const flyerIcon: React.CSSProperties = {
  color: '#ff6b4a',
};

const ring: React.CSSProperties = {
  position: 'absolute',
  left: 0,
  top: 0,
  border: '3px solid #ff6b4a',
  opacity: 0,
  pointerEvents: 'none',
  willChange: 'transform, opacity',
};
