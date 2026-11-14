'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Check, Clock3, ImageOff, LoaderCircle, Minus, Plus, ShoppingBag, Utensils, X } from 'lucide-react';
import { z } from 'zod';
import { addCartItem, clearCart, readCart, saveCart, type CartItem } from '@/lib/cart';
import { money, type MenuAddon, type MenuVariant, type Product } from '@/lib/menu';
import { clearIdempotencyKey, idempotencyKey, payloadSignature } from '@/lib/order-idempotency';
import { tableDisplayLabel } from '@/lib/table-label';
import { useCatalogProducts } from '@/lib/use-catalog-products';

const tableResponseSchema = z.object({ table_number: z.string().min(1).max(80) });
const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
const orderResponseSchema = z.object({
  order: z.object({
    id: z.string().uuid(),
    order_number: z.string().min(1),
    total: z.union([z.number().finite(), z.string().regex(/^\d+(?:\.\d{1,2})?$/)]),
    status: z.string().optional(),
  }),
});
const statusResponseSchema = z.object({
  order_number: z.string().min(1),
  table_number: z.string().min(1),
  status: z.enum(['pending', 'confirmed', 'preparing', 'ready', 'served', 'completed', 'cancelled']),
  payment_status: z.string().min(1),
  total: z.union([z.number().finite(), z.string().regex(/^\d+(?:\.\d{1,2})?$/)]),
});
const tableCartKey = 'ps-table-cart';
type PlacedOrder = {
  id: string;
  orderNumber: string;
  total: number;
  status: string;
  paymentStatus: string;
  tableNumber: string;
  items: CartItem[];
};
type TrackedOrder = Omit<PlacedOrder, 'items'>;

function productCategorySlug(product: Product) {
  return product.categorySlug ?? product.category.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

function ProductPhoto({ product }: { product: Product }) {
  return product.image?.startsWith('https://') ? (
    <img src={product.image} alt="" className="h-full w-full object-cover" loading="lazy" />
  ) : (
    <div className="flex h-full flex-col items-center justify-center gap-2 bg-[#eadfc9] text-[#615a4e]">
      <ImageOff size={28} aria-hidden="true" />
      <span className="text-xs font-bold uppercase tracking-wider">Photo coming soon</span>
    </div>
  );
}

function CartPanel({
  items,
  subtotal,
  placing,
  error,
  name,
  email,
  phone,
  notes,
  onName,
  onEmail,
  onPhone,
  onNotes,
  onQuantity,
  onRemove,
  onClear,
  onSubmit,
}: {
  items: CartItem[];
  subtotal: number;
  placing: boolean;
  error: string;
  name: string;
  email: string;
  phone: string;
  notes: string;
  onName: (value: string) => void;
  onEmail: (value: string) => void;
  onPhone: (value: string) => void;
  onNotes: (value: string) => void;
  onQuantity: (index: number, delta: number) => void;
  onRemove: (index: number) => void;
  onClear: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="flex h-full max-h-[88vh] min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-between border-b-4 border-[#111111] pb-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#d93625]">Your order</p>
          <h2 className="mt-1 text-2xl font-black uppercase">Order basket</h2>
        </div>
        <span className="border-2 border-[#111111] bg-[#ffd400] px-2 py-1 text-sm font-black">{items.length}</span>
      </div>

      {items.length === 0 ? (
        <div className="min-h-0 flex-1 overflow-y-auto py-8">
          <p className="text-sm font-semibold text-[#615a4e]">Your order is empty. Add a dish to get started.</p>
          {error && <button type="button" onClick={onClear} className="mt-3 border-2 border-[#111111] bg-[#ffd400] px-3 py-2 text-xs font-black uppercase">Clear saved cart</button>}
        </div>
      ) : (
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto py-4">
          {items.map((item, index) => (
            <div key={`${item.product_id}-${item.variant_id}-${item.addon_ids?.join(',')}-${index}`} className="border-b-2 border-[#111111]/15 pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-black leading-tight">{item.name}</p>
                  <p className="mt-1 text-sm font-semibold">{money(item.price)} each</p>
                </div>
                <button type="button" onClick={() => onRemove(index)} className="p-1 text-[#d93625]" aria-label={`Remove ${item.name}`}>
                  <X size={18} />
                </button>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => onQuantity(index, -1)} className="border-2 border-[#111111] p-1" aria-label={`Decrease ${item.name} quantity`}><Minus size={14} /></button>
                  <span className="min-w-6 text-center font-black">{item.qty}</span>
                  <button type="button" onClick={() => onQuantity(index, 1)} className="border-2 border-[#111111] p-1" aria-label={`Increase ${item.name} quantity`}><Plus size={14} /></button>
                </div>
                <span className="font-black">{money(item.price * item.qty)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="border-t-4 border-[#111111] pt-4">
        <div className="flex justify-between text-sm font-bold"><span>Subtotal</span><span>{money(subtotal)}</span></div>
        <div className="mt-2 flex justify-between text-lg font-black"><span>Total</span><span>{money(subtotal)}</span></div>
        <p className="mt-2 text-xs leading-5 text-[#615a4e]">Dine-in only. No delivery fee or online payment. The server verifies all prices when you place the order.</p>
      </div>

      {items.length > 0 && (
        <div className="min-h-0 shrink overflow-y-auto pt-4">
          <div className="space-y-3">
            <p className="border-2 border-[#111111] bg-[#ffd400] p-3 text-xs font-black uppercase">Cash payment at the cashier or manager&apos;s desk after your order.</p>
            <label className="block text-xs font-black uppercase">Name
              <input required maxLength={120} value={name} onChange={(event) => onName(event.target.value)} className="mt-1 w-full border-2 border-[#111111] bg-white px-3 py-2 text-sm font-medium normal-case outline-none focus:ring-2 focus:ring-[#d93625]" />
            </label>
            <label className="block text-xs font-black uppercase">Email
              <input required type="email" maxLength={254} value={email} onChange={(event) => onEmail(event.target.value)} className="mt-1 w-full border-2 border-[#111111] bg-white px-3 py-2 text-sm font-medium normal-case outline-none focus:ring-2 focus:ring-[#d93625]" />
            </label>
            <label className="block text-xs font-black uppercase">Phone
              <input required type="tel" maxLength={30} value={phone} onChange={(event) => onPhone(event.target.value)} className="mt-1 w-full border-2 border-[#111111] bg-white px-3 py-2 text-sm font-medium normal-case outline-none focus:ring-2 focus:ring-[#d93625]" />
            </label>
            <label className="block text-xs font-black uppercase">Special instructions (optional)
              <textarea maxLength={1000} value={notes} onChange={(event) => onNotes(event.target.value)} rows={2} className="mt-1 w-full border-2 border-[#111111] bg-white px-3 py-2 text-sm font-medium normal-case outline-none focus:ring-2 focus:ring-[#d93625]" />
            </label>
          </div>
        </div>
      )}

      {error && <p role="alert" className="mt-3 shrink-0 border-2 border-[#d93625] bg-[#d93625]/10 p-3 text-sm font-bold text-[#8b2017]">{error}</p>}
      {items.length > 0 && (
        <button type="submit" disabled={placing} className="mt-4 flex min-h-14 shrink-0 items-center justify-center gap-2 border-4 border-[#111111] bg-[#d93625] px-4 font-black uppercase tracking-wide text-white shadow-[4px_4px_0_#111111] disabled:opacity-60">
          {placing && <LoaderCircle size={18} className="animate-spin" />}
          {placing ? 'Sending order…' : 'Place order · cash at restaurant'}
        </button>
      )}
    </form>
  );
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    pending: 'New order',
    confirmed: 'Accepted',
    preparing: 'Preparing',
    ready: 'Ready',
    served: 'Served',
    completed: 'Completed',
    cancelled: 'Cancelled',
  };
  return labels[status] ?? status.replaceAll('_', ' ');
}

export function QrTableMenu() {
  const { products, status: productsStatus, error: productsError, refresh } = useCatalogProducts({ includeUnavailable: true });
  const productsLoading = productsStatus === 'loading';
  const [tableState, setTableState] = useState<'checking' | 'ready' | 'invalid'>('checking');
  const [tableToken, setTableToken] = useState('');
  const [tableNumber, setTableNumber] = useState('');
  const [tableError, setTableError] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartError, setCartError] = useState('');
  const [category, setCategory] = useState('all');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedVariant, setSelectedVariant] = useState('');
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [customizeQuantity, setCustomizeQuantity] = useState(1);
  const [cartOpen, setCartOpen] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [placeError, setPlaceError] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [trackedOrders, setTrackedOrders] = useState<TrackedOrder[]>([]);
  const [placedOrder, setPlacedOrder] = useState<PlacedOrder | null>(null);
  const [statusError, setStatusError] = useState('');
  const [cartClearError, setCartClearError] = useState('');
  const trackedOrdersRef = useRef<TrackedOrder[]>([]);
  const requestCache = useRef<{ signature: string; key: string } | null>(null);

  const categories = useMemo(() => {
    const distinct = new Map<string, { slug: string; name: string; order: number }>();
    products.forEach((product) => {
      const slug = productCategorySlug(product);
      if (!distinct.has(slug)) distinct.set(slug, { slug, name: product.category, order: product.categoryOrder ?? 999 });
    });
    return [...distinct.values()].sort((left, right) => left.order - right.order || left.name.localeCompare(right.name));
  }, [products]);
  const visibleProducts = useMemo(() => category === 'all'
    ? products
    : products.filter((product) => productCategorySlug(product) === category), [category, products]);
  const productGroups = useMemo(() => category === 'all'
    ? categories.map((item) => ({
      ...item,
      products: products.filter((product) => productCategorySlug(product) === item.slug),
    })).filter((item) => item.products.length > 0)
    : [{ slug: category, name: categories.find((item) => item.slug === category)?.name ?? 'Menu', products: visibleProducts }],
  [categories, category, products, visibleProducts]);
  const subtotal = cart.reduce((total, item) => total + item.price * item.qty, 0);
  const itemCount = cart.reduce((total, item) => total + item.qty, 0);

  useEffect(() => {
    let active = true;
    const queryToken = new URLSearchParams(window.location.search).get('token');
    const hashToken = window.location.hash.slice(1);
    const token = queryToken || hashToken || localStorage.getItem('ps-table-token') || '';
    if (queryToken || hashToken) window.history.replaceState(window.history.state, '', '/table-menu');
    if (!tokenSchema.safeParse(token).success) {
      setTableState('invalid');
      setTableError('This QR code is incomplete or invalid. Please scan the QR code at your table or ask staff for help.');
      return () => { active = false; };
    }

    fetch('/api/tables/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
      cache: 'no-store',
    }).then(async (response) => {
      const result: unknown = await response.json();
      if (!response.ok) {
        const parsed = z.object({ error: z.string() }).safeParse(result);
        throw new Error(parsed.success ? parsed.data.error : 'This table is not accepting orders.');
      }
      return tableResponseSchema.parse(result);
    }).then(({ table_number }) => {
      if (!active) return;
      setTableToken(token);
      setTableNumber(table_number);
      const savedCart = readCart(tableCartKey);
      setCart(savedCart.items);
      setCartError(savedCart.error ?? '');
      localStorage.setItem('ps-table-token', token);
      localStorage.setItem('ps-table-number', table_number);
      window.dispatchEvent(new Event('tablechange'));
      setTableState('ready');
    }).catch((error: unknown) => {
      if (!active) return;
      console.error('Table menu QR verification failed:', error);
      localStorage.removeItem('ps-table-token');
      localStorage.removeItem('ps-table-number');
      setTableError(error instanceof Error ? error.message : 'This table is not accepting orders.');
      setTableState('invalid');
    });
    return () => { active = false; };
  }, []);

  const refreshOrderStatus = useCallback(async (order: TrackedOrder, token: string) => {
    try {
      const response = await fetch(`/api/table-orders/${order.id}`, {
        headers: { 'x-table-token': token },
        cache: 'no-store',
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        const parsed = z.object({ error: z.string() }).safeParse(result);
        throw new Error(parsed.success ? parsed.data.error : 'Order status could not be refreshed.');
      }
      const current = statusResponseSchema.parse(result);
      setTrackedOrders((previous) => previous.map((item) => item.id === order.id ? {
        ...item,
        status: current.status,
        paymentStatus: current.payment_status,
        total: Number(current.total),
        tableNumber: current.table_number,
      } : item));
      setPlacedOrder((previous) => previous?.id === order.id ? {
        ...previous,
        status: current.status,
        paymentStatus: current.payment_status,
        total: Number(current.total),
        tableNumber: current.table_number,
      } : previous);
      setStatusError('');
    } catch (error) {
      console.error('Dine-in order status refresh failed:', error);
      setStatusError(error instanceof Error ? error.message : 'Order status could not be refreshed.');
    }
  }, []);

  useEffect(() => {
    trackedOrdersRef.current = trackedOrders;
  }, [trackedOrders]);

  useEffect(() => {
    if (!tableToken) return;
    const refreshTrackedOrders = () => {
      trackedOrdersRef.current
        .filter((order) => !['completed', 'cancelled'].includes(order.status))
        .forEach((order) => void refreshOrderStatus(order, tableToken));
    };
    const interval = window.setInterval(refreshTrackedOrders, 6000);
    return () => window.clearInterval(interval);
  }, [tableToken, refreshOrderStatus]);

  function addProduct(product: Product, variant?: MenuVariant, addons: MenuAddon[] = [], quantity = 1) {
    if (!product.id) {
      setCartError('This menu item is missing its product record. Please ask staff for help.');
      setCartOpen(true);
      return;
    }
    const choices = [variant?.name, ...addons.map((addon) => addon.name)].filter(Boolean);
    const item: CartItem = {
      product_id: product.id,
      ...(variant ? { variant_id: variant.id } : {}),
      addon_ids: addons.map((addon) => addon.id),
      slug: product.slug,
      name: choices.length ? `${product.name} · ${choices.join(' · ')}` : product.name,
      price: product.price + (variant?.price_delta ?? 0) + addons.reduce((total, addon) => total + addon.price, 0),
      qty: quantity,
      image: product.image ?? '',
    };
    const result = addCartItem(item, tableCartKey);
    if (!result.ok) {
      setCartError(result.error);
      setCartOpen(true);
      return;
    }
    setCart(readCart(tableCartKey).items);
    setCartError('');
  }

  function startProduct(product: Product) {
    const variants = (product.variants ?? []).filter((variant) => variant.is_available);
    const addons = (product.addons ?? []).filter((addon) => addon.is_available);
    if (variants.length || addons.length) {
      setSelectedProduct(product);
      setSelectedVariant(variants[0]?.id ?? '');
      setSelectedAddons([]);
      setCustomizeQuantity(1);
      return;
    }
    addProduct(product);
  }

  function confirmCustomization() {
    if (!selectedProduct) return;
    const variant = selectedProduct.variants?.find((item) => item.id === selectedVariant && item.is_available);
    const addons = (selectedProduct.addons ?? []).filter((item) => selectedAddons.includes(item.id) && item.is_available);
    addProduct(selectedProduct, variant, addons, customizeQuantity);
    setSelectedProduct(null);
  }

  function changeQuantity(index: number, delta: number) {
    const next = [...cart];
    const quantity = next[index].qty + delta;
    if (quantity < 1) next.splice(index, 1);
    else if (quantity <= 20) next[index] = { ...next[index], qty: quantity };
    else {
      setCartError('A product can be ordered up to 20 times per selection.');
      return;
    }
    try {
      saveCart(next, tableCartKey);
      setCart(next);
      setCartError('');
    } catch (error) {
      console.error('Unable to update dine-in cart:', error);
      setCartError('Your browser could not save the cart. Check available storage and try again.');
    }
  }

  function removeCartItem(index: number) {
    const next = cart.filter((_, itemIndex) => itemIndex !== index);
    try {
      saveCart(next, tableCartKey);
      setCart(next);
      setCartError('');
    } catch (error) {
      console.error('Unable to remove dine-in cart item:', error);
      setCartError('Your browser could not update the cart. Check available storage and try again.');
    }
  }

  function emptyCart() {
    try {
      clearCart(tableCartKey);
      setCart([]);
      setCartError('');
      setCartClearError('');
      return true;
    } catch (error) {
      console.error('Unable to clear dine-in cart:', error);
      setCartError('Your browser could not clear the cart. Check available storage and try again.');
      return false;
    }
  }

  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (placing || cart.length === 0 || !tableToken) return;
    if (cart.some((item) => !item.product_id)) {
      setPlaceError('A saved menu item is no longer linked to a product. Remove it and add it again.');
      return;
    }
    setPlacing(true);
    setPlaceError('');
    try {
      const orderPayload = {
        order_type: 'dine_in',
        payment_method: 'cash_at_restaurant',
        customer: { name: customerName.trim(), email: customerEmail.trim(), phone: customerPhone.trim() },
        table_token: tableToken,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        items: cart.map((item) => ({
          product_id: item.product_id,
          ...(item.variant_id ? { variant_id: item.variant_id } : {}),
          addon_ids: item.addon_ids ?? [],
          quantity: item.qty,
        })),
      };
      let signature: string;
      try {
        signature = await payloadSignature(orderPayload);
      } catch (error) {
        console.error('Could not fingerprint the dine-in order request:', error);
        setPlaceError('Secure ordering is unavailable in this browser. Use an updated browser over HTTPS and try again.');
        return;
      }
      const key = idempotencyKey(signature, requestCache, 'ps-table-order');
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...orderPayload, idempotency_key: key }),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        const parsed = z.object({ error: z.string() }).safeParse(result);
        throw new Error(parsed.success ? parsed.data.error : 'Your order could not be submitted. Please try again.');
      }
      const parsed = orderResponseSchema.safeParse(result);
      if (!parsed.success) throw new Error('The order was sent, but its confirmation response was invalid. Please ask staff to check your table.');
      const order = parsed.data.order;
      const receipt: PlacedOrder = {
        id: order.id,
        orderNumber: order.order_number,
        total: Number(order.total),
        status: order.status ?? 'pending',
        paymentStatus: 'unpaid',
        tableNumber,
        items: cart,
      };
      setTrackedOrders((previous) => [
        receipt,
        ...previous.filter((item) => item.id !== receipt.id),
      ].slice(0, 10));
      setPlacedOrder(receipt);
      const cartWasCleared = emptyCart();
      if (cartWasCleared) clearIdempotencyKey(requestCache, 'ps-table-order');
      else setCartClearError('Your order was sent, but this browser could not clear its saved cart. Do not submit the same items again; ask staff to verify your order.');
      setCartOpen(false);
    } catch (error) {
      console.error('Dine-in order submission failed:', error);
      setPlaceError(error instanceof Error ? error.message : 'Your order could not be submitted. Please try again.');
    } finally {
      setPlacing(false);
    }
  }

  if (tableState === 'checking') {
    return <main className="grid min-h-screen place-items-center bg-[#f5ebd7] p-6 text-[#111111]"><p role="status" className="flex items-center gap-3 text-lg font-black uppercase"><LoaderCircle className="animate-spin" />Verifying your table…</p></main>;
  }
  if (tableState === 'invalid') {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f5ebd7] p-6 text-[#111111]">
        <section className="max-w-lg border-4 border-[#111111] bg-white p-7 shadow-[8px_8px_0_#111111]">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-[#d93625]">Pizza Station · Table ordering</p>
          <h1 className="mt-3 text-4xl font-black uppercase">Table unavailable</h1>
          <p role="alert" className="mt-4 font-semibold">{tableError}</p>
          <p className="mt-5 border-2 border-[#111111] bg-[#ffd400] p-3 text-sm font-bold">Please ask a staff member to activate this table and open its dining session.</p>
        </section>
      </main>
    );
  }

  const cartProps = {
    items: cart,
    subtotal,
    placing,
    error: cartError || placeError,
    name: customerName,
    email: customerEmail,
    phone: customerPhone,
    notes,
    onName: setCustomerName,
    onEmail: setCustomerEmail,
    onPhone: setCustomerPhone,
    onNotes: setNotes,
    onQuantity: changeQuantity,
    onRemove: removeCartItem,
    onClear: () => { emptyCart(); setPlaceError(''); },
    onSubmit: submitOrder,
  };

  return (
    <main className="min-h-screen bg-[#f5ebd7] pb-24 text-[#111111] lg:pb-10">
      <header className="border-b-4 border-[#111111] bg-[#111111] px-4 py-4 text-[#f5ebd7] sm:px-7">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center border-2 border-[#f5ebd7] bg-[#ffd400] text-[#111111]"><Utensils size={22} /></div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#ffd400]">Welcome to Pizza Station</p>
              <h1 className="text-lg font-black uppercase sm:text-xl">{tableDisplayLabel(tableNumber)}</h1>
            </div>
          </div>
          <button type="button" onClick={() => setCartOpen(true)} className="relative flex min-h-11 items-center gap-2 border-2 border-[#111111] bg-[#ffd400] px-3 font-black text-[#111111] shadow-[3px_3px_0_#f5ebd7]">
            <ShoppingBag size={18} /> <span className="hidden sm:inline">Your order</span> <span className="border-l-2 border-[#111111] pl-2">{itemCount}</span>
          </button>
        </div>
      </header>

      <section className="mx-auto max-w-[1440px] px-4 pt-7 sm:px-7 sm:pt-10">
        <div className="mb-6 border-l-8 border-[#d93625] pl-4">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-[#d93625]">Made fresh · served here</p>
          <h2 className="mt-1 text-3xl font-black uppercase sm:text-5xl">Pick your favorites.</h2>
          <p className="mt-2 max-w-2xl text-sm font-semibold text-[#615a4e]">Choose from the menu, customize your order, and pay in cash at the restaurant.</p>
        </div>

        {trackedOrders.length > 0 && (
          <section aria-labelledby="table-order-status-title" className="mb-8 border-4 border-[#111111] bg-white p-4 shadow-[5px_5px_0_#111111] sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-2 border-b-4 border-[#111111] pb-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-[#d93625]">Live updates</p>
                <h2 id="table-order-status-title" className="mt-1 text-2xl font-black uppercase">Your order status</h2>
              </div>
              <p className="text-xs font-bold text-[#615a4e]">Refreshes automatically</p>
            </div>
            <div className="mt-4 grid gap-3">
              {trackedOrders.map((order) => (
                <article key={order.id} className="flex flex-wrap items-center justify-between gap-3 border-2 border-[#111111] bg-[#f5ebd7] p-3">
                  <div>
                    <p className="text-xs font-black uppercase text-[#615a4e]">{order.orderNumber} · {tableDisplayLabel(order.tableNumber)}</p>
                    <p className="mt-1 text-lg font-black" aria-live="polite">{statusLabel(order.status)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-black">{money(order.total)}</p>
                    <p className="text-xs font-bold uppercase">Payment: {order.paymentStatus}</p>
                  </div>
                </article>
              ))}
            </div>
            {statusError && <p role="status" className="mt-3 text-sm font-semibold text-[#8b2017]">{statusError} We’ll retry automatically.</p>}
          </section>
        )}

        <div className="mb-7 flex gap-2 overflow-x-auto pb-2" aria-label="Menu categories">
          {[{ slug: 'all', name: 'All items' }, ...categories].map((item) => (
            <button type="button" key={item.slug} onClick={() => setCategory(item.slug)} aria-pressed={category === item.slug} className={`shrink-0 border-2 border-[#111111] px-4 py-2 text-sm font-black uppercase transition ${category === item.slug ? 'bg-[#111111] text-[#f5ebd7]' : 'bg-white hover:bg-[#ffd400]'}`}>
              {item.name}
            </button>
          ))}
        </div>

        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div>
            {productsLoading && <p role="status" className="flex items-center gap-2 py-10 font-bold"><LoaderCircle className="animate-spin" />Loading the menu…</p>}
            {productsError && <div role="alert" className="border-4 border-[#d93625] bg-white p-5"><p className="font-black">Menu unavailable</p><p className="mt-1 text-sm">{productsError}</p><button type="button" onClick={() => void refresh()} className="mt-3 border-2 border-[#111111] bg-[#ffd400] px-4 py-2 font-black uppercase">Try again</button></div>}
            {!productsLoading && !productsError && visibleProducts.length === 0 && <p className="border-4 border-dashed border-[#111111]/30 p-8 text-center font-bold">No menu items are listed in this category yet.</p>}
            {!productsLoading && !productsError && visibleProducts.length > 0 && (
              <div className="space-y-9">
                {productGroups.map((group) => <section key={group.slug}>
                  <div className="mb-4 flex items-end justify-between border-b-4 border-[#111111] pb-2">
                    <h3 className="text-2xl font-black uppercase sm:text-3xl">{group.name}</h3>
                    <span className="text-xs font-black uppercase text-[#615a4e]">{group.products.length} items</span>
                  </div>
                  <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                    {group.products.map((product) => (
                      <article key={product.id ?? product.slug} className="overflow-hidden border-4 border-[#111111] bg-white shadow-[5px_5px_0_#111111]">
                        <div className="relative h-48 border-b-4 border-[#111111] sm:h-56"><ProductPhoto product={product} />
                          {product.badge && <span className="absolute left-3 top-3 border-2 border-[#111111] bg-[#ffd400] px-2 py-1 text-xs font-black uppercase">{product.badge}</span>}
                        </div>
                        <div className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#d93625]">{product.category}</p>
                              <h4 className="mt-1 text-xl font-black leading-tight">{product.name}</h4>
                            </div>
                            <span className="shrink-0 border-2 border-[#111111] bg-[#ffd400] px-2 py-1 font-black">{money(product.price)}</span>
                          </div>
                          {product.description && <p className="mt-2 line-clamp-2 text-sm leading-5 text-[#615a4e]">{product.description}</p>}
                          <div className="mt-4 flex items-center justify-between gap-3">
                            <span className={`text-xs font-black uppercase ${product.isAvailable !== false ? 'text-[#247443]' : 'text-[#d93625]'}`}>{product.isAvailable !== false ? 'Available' : 'Currently unavailable'}</span>
                            <button type="button" disabled={product.isAvailable === false} onClick={() => startProduct(product)} className="min-h-11 border-2 border-[#111111] bg-[#d93625] px-3 text-xs font-black uppercase text-white shadow-[3px_3px_0_#111111] disabled:cursor-not-allowed disabled:bg-[#777] disabled:shadow-none">
                              {product.isAvailable !== false ? 'Add to order' : 'Unavailable'}
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>)}
              </div>
            )}
          </div>

          <aside className="sticky top-4 hidden border-4 border-[#111111] bg-white p-5 shadow-[6px_6px_0_#111111] lg:block">
            <CartPanel {...cartProps} />
          </aside>
        </div>
      </section>

      <button type="button" onClick={() => setCartOpen(true)} className="fixed inset-x-4 bottom-4 z-20 flex min-h-14 items-center justify-between border-4 border-[#111111] bg-[#ffd400] px-5 font-black uppercase shadow-[5px_5px_0_#111111] lg:hidden">
        <span>{itemCount > 0 ? `${itemCount} item${itemCount === 1 ? '' : 's'} · ${money(subtotal)}` : 'Your order is empty'}</span><span>{itemCount > 0 ? 'Place order →' : 'View menu →'}</span>
      </button>

      {cartOpen && <div className="fixed inset-0 z-40 bg-[#111111]/70 p-3 lg:hidden" onClick={() => setCartOpen(false)}>
        <section role="dialog" aria-modal="true" aria-label="Your dine-in order" className="ml-auto flex h-full max-w-lg flex-col border-4 border-[#111111] bg-[#f5ebd7] p-5 shadow-[8px_8px_0_#111111]" onClick={(event) => event.stopPropagation()}>
          <div className="mb-4 flex justify-end"><button type="button" onClick={() => setCartOpen(false)} aria-label="Close order panel" className="border-2 border-[#111111] bg-white p-2"><X size={18} /></button></div>
          <CartPanel {...cartProps} />
        </section>
      </div>}

      {selectedProduct && <div className="fixed inset-0 z-50 grid place-items-center bg-[#111111]/80 p-4" onClick={() => setSelectedProduct(null)}>
        <section role="dialog" aria-modal="true" aria-labelledby="customize-title" className="max-h-[90vh] w-full max-w-xl overflow-y-auto border-4 border-[#111111] bg-[#f5ebd7] p-5 shadow-[8px_8px_0_#ffd400] sm:p-7" onClick={(event) => event.stopPropagation()}>
          <div className="flex items-start justify-between gap-3">
            <div><p className="text-xs font-black uppercase tracking-[0.2em] text-[#d93625]">Make it yours</p><h2 id="customize-title" className="mt-1 text-3xl font-black uppercase">{selectedProduct.name}</h2></div>
            <button type="button" onClick={() => setSelectedProduct(null)} aria-label="Close customizations" className="border-2 border-[#111111] bg-white p-2"><X size={18} /></button>
          </div>
          {!!selectedProduct.variants?.filter((item) => item.is_available).length && <fieldset className="mt-5">
            <legend className="mb-2 text-xs font-black uppercase tracking-wider">Choose a size</legend>
            <div className="grid gap-2">
              {selectedProduct.variants?.filter((item) => item.is_available).map((variant) => <label key={variant.id} className="flex cursor-pointer items-center justify-between border-2 border-[#111111] bg-white p-3 font-bold">
                <span className="flex items-center gap-2"><input type="radio" name="product-variant" value={variant.id} checked={selectedVariant === variant.id} onChange={() => setSelectedVariant(variant.id)} />{variant.name}</span>
                <span>{variant.price_delta ? `+${money(variant.price_delta)}` : 'Included'}</span>
              </label>)}
            </div>
          </fieldset>}
          {!!selectedProduct.addons?.filter((item) => item.is_available).length && <fieldset className="mt-5">
            <legend className="mb-2 text-xs font-black uppercase tracking-wider">Add-ons</legend>
            <div className="grid gap-2">
              {selectedProduct.addons?.filter((item) => item.is_available).map((addon) => <label key={addon.id} className="flex cursor-pointer items-center justify-between border-2 border-[#111111] bg-white p-3 font-bold">
                <span className="flex items-center gap-2"><input type="checkbox" checked={selectedAddons.includes(addon.id)} onChange={(event) => setSelectedAddons((current) => event.target.checked ? [...current, addon.id] : current.filter((id) => id !== addon.id))} />{addon.name}</span>
                <span>+{money(addon.price)}</span>
              </label>)}
            </div>
          </fieldset>}
          <div className="mt-5 flex items-center justify-between border-t-2 border-[#111111] pt-4">
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setCustomizeQuantity((current) => Math.max(1, current - 1))} aria-label="Decrease quantity" className="border-2 border-[#111111] bg-white p-2"><Minus size={16} /></button>
              <span className="font-black">{customizeQuantity}</span>
              <button type="button" onClick={() => setCustomizeQuantity((current) => Math.min(20, current + 1))} aria-label="Increase quantity" className="border-2 border-[#111111] bg-white p-2"><Plus size={16} /></button>
            </div>
            <button type="button" onClick={confirmCustomization} className="flex min-h-12 items-center gap-2 border-2 border-[#111111] bg-[#ffd400] px-4 font-black uppercase shadow-[3px_3px_0_#111111]"><Check size={17} />Add to order</button>
          </div>
        </section>
      </div>}

      {placedOrder && <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[#111111]/85 p-4">
        <section role="dialog" aria-modal="true" aria-labelledby="order-confirmation-title" className="my-auto w-full max-w-xl border-4 border-[#111111] bg-[#f5ebd7] p-6 shadow-[8px_8px_0_#ffd400] sm:p-8">
          <div className="grid h-14 w-14 place-items-center border-4 border-[#111111] bg-[#ffd400]"><Check size={30} strokeWidth={3} /></div>
          <p className="mt-5 text-xs font-black uppercase tracking-[0.22em] text-[#d93625]">Order sent to the team</p>
          <h2 id="order-confirmation-title" className="mt-1 text-3xl font-black uppercase sm:text-4xl">Your order has been sent!</h2>
          <p className="mt-3 border-2 border-[#111111] bg-white p-3 text-sm font-bold">Please pay at the cashier or manager&apos;s desk after your order. Online payment is not available for dine-in.</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="border-2 border-[#111111] bg-white p-3"><p className="text-[10px] font-black uppercase text-[#615a4e]">Order</p><p className="mt-1 font-black">{placedOrder.orderNumber}</p></div>
            <div className="border-2 border-[#111111] bg-white p-3"><p className="text-[10px] font-black uppercase text-[#615a4e]">Table</p><p className="mt-1 font-black">{tableDisplayLabel(placedOrder.tableNumber)}</p></div>
          </div>
          <div className="mt-4 border-2 border-[#111111] bg-white p-4">
            <div className="max-h-40 space-y-2 overflow-y-auto">
              {placedOrder.items.map((item, index) => <div key={`${item.product_id}-${item.variant_id}-${index}`} className="flex justify-between gap-3 text-sm"><span className="font-semibold">{item.qty} × {item.name}</span><span className="font-black">{money(item.qty * item.price)}</span></div>)}
            </div>
            <div className="mt-3 flex justify-between border-t-2 border-[#111111] pt-3 font-black"><span>Total</span><span>{money(placedOrder.total)}</span></div>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3 border-2 border-[#111111] bg-[#ffd400] p-3">
            <span className="flex items-center gap-2 text-xs font-black uppercase"><Clock3 size={16} />{statusLabel(placedOrder.status)}</span>
            <span className="text-xs font-black uppercase">Payment: {placedOrder.paymentStatus}</span>
          </div>
          {cartClearError && <p role="alert" className="mt-3 border-2 border-[#d93625] bg-white p-3 text-xs font-bold text-[#8b2017]">{cartClearError}</p>}
          {statusError && <p role="status" className="mt-2 text-xs font-semibold text-[#8b2017]">Status refresh: {statusError}</p>}
          <button type="button" onClick={() => setPlacedOrder(null)} className="mt-5 min-h-12 w-full border-4 border-[#111111] bg-[#d93625] font-black uppercase text-white shadow-[4px_4px_0_#111111]">Back to the menu</button>
        </section>
      </div>}
    </main>
  );
}
