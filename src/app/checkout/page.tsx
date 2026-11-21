'use client';

import Link from 'next/link';
import {type FormEvent,useEffect,useMemo,useRef,useState} from 'react';
import {z} from 'zod';
import {clearCart,readCart,type CartItem} from '@/lib/cart';
import {money,type Product} from '@/lib/menu';
import {clearIdempotencyKey,idempotencyKey,payloadSignature} from '@/lib/order-idempotency';
import {useCatalogProducts} from '@/lib/use-catalog-products';

const zonesResponseSchema=z.object({
  zones:z.array(z.object({
    id:z.string().uuid(),
    name:z.string(),
    fee:z.union([z.number(),z.string()]),
    minimum_order:z.union([z.number(),z.string()]),
    postal_codes:z.array(z.string()),
  })),
});

const orderResponseSchema=z.object({
  order:z.object({
    id:z.string().uuid(),
    order_number:z.string(),
    total:z.union([z.number(),z.string()]).optional(),
    duplicate:z.boolean().optional(),
  }),
});
const tableResponseSchema=z.object({table_number:z.string().min(1).max(80)});

type DeliveryZone=z.infer<typeof zonesResponseSchema>['zones'][number];
type PlacedOrder=z.infer<typeof orderResponseSchema>['order'];
type OrderMode='delivery'|'pickup'|'dine_in';
type TableValidation='checking'|'valid'|'invalid'|'none';

function isCartItemAvailable(item:CartItem,productMap:Map<string,Product>):boolean {
  if(!item.product_id)return false;
  const product=productMap.get(item.product_id);
  if(!product)return false;
  if(item.variant_id&&!product.variants?.some(variant=>variant.id===item.variant_id&&variant.is_available))return false;
  const addons=item.addon_ids??[];
  return new Set(addons).size===addons.length&&addons.every(id=>product.addons?.some(addon=>addon.id===id&&addon.is_available));
}

export default function Checkout() {
  const catalog=useCatalogProducts();
  const [items,setItems]=useState<CartItem[]>([]);
  const [cartError,setCartError]=useState('');
  const [mode,setMode]=useState<OrderMode>('delivery');
  const [tableToken,setTableToken]=useState('');
  const [tableNumber,setTableNumber]=useState('');
  const [tableValidation,setTableValidation]=useState<TableValidation>('checking');
  const [name,setName]=useState('');
  const [phone,setPhone]=useState('');
  const [email,setEmail]=useState('');
  const [address,setAddress]=useState('');
  const [postalCode,setPostalCode]=useState('');
  const [couponCode,setCouponCode]=useState('');
  const [zoneId,setZoneId]=useState('');
  const [zones,setZones]=useState<DeliveryZone[]>([]);
  const [zonesLoading,setZonesLoading]=useState(true);
  const [zonesError,setZonesError]=useState('');
  const [formError,setFormError]=useState('');
  const [clearError,setClearError]=useState('');
  const [submitting,setSubmitting]=useState(false);
  const [placedOrder,setPlacedOrder]=useState<PlacedOrder|null>(null);
  const requestCache=useRef<{signature:string;key:string}|null>(null);

  useEffect(()=>{
    const savedCart=readCart();
    setItems(savedCart.items);
    setCartError(savedCart.error??'');
    const token=localStorage.getItem('ps-table-token');
    if(!token) {
      setTableValidation('none');
      return;
    }
    fetch('/api/tables/resolve',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({token}),
      cache:'no-store',
    }).then(async response=>{
      const result:unknown=await response.json();
      if(!response.ok)throw new Error('The scanned table is no longer accepting dine-in orders. Scan its QR again or ask staff to open the table.');
      const parsed=tableResponseSchema.safeParse(result);
      if(!parsed.success)throw new Error('The scanned table could not be verified. Scan its QR again.');
      setTableToken(token);
      setTableNumber(parsed.data.table_number);
      setTableValidation('valid');
      setMode('dine_in');
    }).catch((error:unknown)=>{
      localStorage.removeItem('ps-table-token');
      localStorage.removeItem('ps-table-number');
      setTableToken('');
      setTableNumber('');
      setTableValidation('invalid');
      setFormError(error instanceof Error?error.message:'The table could not be verified.');
      window.dispatchEvent(new Event('tablechange'));
    });
  },[]);

  useEffect(()=>{
    let active=true;
    fetch('/api/delivery-zones',{cache:'no-store'})
      .then(async response=>{
        if(!response.ok)throw new Error('Delivery zones could not be loaded');
        const parsed=zonesResponseSchema.safeParse(await response.json());
        if(!parsed.success)throw new Error('Delivery zone response was invalid');
        return parsed.data.zones;
      })
      .then(data=>{
        if(!active)return;
        setZones(data);
        if(data.length)setZoneId(current=>current||data[0].id);
        setZonesError('');
      })
      .catch(()=>{
        if(active)setZonesError('Delivery options could not be loaded. Check the Supabase connection and delivery zone setup.');
      })
      .finally(()=>{
        if(active)setZonesLoading(false);
      });
    return ()=>{active=false};
  },[]);

  const productMap=useMemo(()=>new Map(catalog.products.flatMap(product=>product.id?[[product.id,product] as const]:[])),[catalog.products]);
  const unavailableItems=items.filter(item=>!isCartItemAvailable(item,productMap));
  const zone=zones.find(item=>item.id===zoneId);
  const postalMatches=!zone||zone.postal_codes.length===0||zone.postal_codes.includes(postalCode.trim().toUpperCase());
  const readyToSubmit=Boolean(
    catalog.status==='ready'
    && items.length>0
    && !cartError
    && unavailableItems.length===0
    && name.trim()
    && phone.trim()
    && z.string().email().safeParse(email.trim()).success
    && (mode!=='delivery'||(
      address.trim()
      && postalCode.trim()
      && zone
      && postalMatches
      && !zonesLoading
      && !zonesError
    ))
    && (mode!=='dine_in'||(tableValidation==='valid'&&tableToken.length===43))
  );

  async function placeOrder(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError('');
    if(catalog.status!=='ready') {
      setFormError('The live menu is unavailable. Check your Supabase configuration and migrations.');
      return;
    }
    if(cartError||!items.length||unavailableItems.length) {
      setFormError('Your cart contains preview or unavailable items. Re-add products from the connected menu before ordering.');
      return;
    }
    if(!name.trim()||!phone.trim()||!z.string().email().safeParse(email.trim()).success) {
      setFormError('Enter your name, a valid email address, and phone number.');
      return;
    }
    if(mode==='delivery'&&(!address.trim()||!postalCode.trim()||!zone||!postalMatches)) {
      setFormError('Enter a delivery address and a postal code covered by the selected zone.');
      return;
    }
    if(mode==='dine_in'&&(tableValidation!=='valid'||tableToken.length!==43)) {
      setFormError('Scan a valid restaurant table QR code with an open staff session before placing a dine-in order.');
      return;
    }

    const orderItems=items.filter((item):item is CartItem&{product_id:string}=>Boolean(item.product_id));
    if(orderItems.length!==items.length) {
      setFormError('Your cart contains preview items. Re-add products from the connected menu before ordering.');
      return;
    }
    const orderPayload={
      order_type:mode,
      payment_method:mode==='delivery'?'cash_on_delivery':'cash_at_restaurant',
      customer:{name:name.trim(),email:email.trim(),phone:phone.trim()},
      ...(mode==='delivery'?{address:address.trim(),postal_code:postalCode.trim().toUpperCase(),delivery_zone_id:zoneId}:{}),
      ...(mode==='dine_in'?{table_token:tableToken.trim()}:{}),
      ...(couponCode.trim()?{coupon_code:couponCode.trim().toUpperCase()}:{}),
      items:orderItems.map(item=>({
        product_id:item.product_id,
        ...(item.variant_id?{variant_id:item.variant_id}:{}),
        addon_ids:item.addon_ids??[],
        quantity:item.qty,
      })),
    };
    let signature:string;
    try {
      signature=await payloadSignature(orderPayload);
    } catch(error) {
      console.error('Could not safely fingerprint the checkout request:',error);
      setFormError('Secure checkout could not start in this browser. Use an updated browser over HTTPS and try again.');
      return;
    }
    const payload={...orderPayload,idempotency_key:idempotencyKey(signature,requestCache)};
    setSubmitting(true);
    try {
      const response=await fetch('/api/orders',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify(payload),
      });
      const result:unknown=await response.json();
      if(!response.ok) {
        const parsedError=z.object({error:z.string()}).safeParse(result);
        setFormError(parsedError.success?parsedError.data.error:'The order could not be placed. Please try again.');
        return;
      }
      const parsed=orderResponseSchema.safeParse(result);
      if(!parsed.success) {
        setFormError('The server returned an unexpected response. Contact the restaurant before retrying.');
        console.error('Order response did not match the expected shape:',parsed.error);
        return;
      }
      setPlacedOrder(parsed.data.order);
      try {
        clearCart();
        setItems([]);
        setCartError('');
      } catch(error) {
        console.error('Order was placed but the saved cart could not be cleared:',error);
        setClearError('Your order is placed, but this browser could not clear the saved cart.');
      }
      clearIdempotencyKey(requestCache);
    } catch(error) {
      console.error('Order request failed:',error);
      setFormError('Could not reach the ordering service. Check your connection and retry.');
    } finally {
      setSubmitting(false);
    }
  }

  if(placedOrder) {
    const total=placedOrder.total===undefined?null:Number(placedOrder.total);
    return (
      <main className="container min-h-[60vh] py-14">
        <p className="eyebrow">Order received</p>
        <section className="panel mt-8 max-w-2xl p-8">
          <h1 className="text-4xl">Thank you.</h1>
          <p className="mt-4">Your order number is <strong className="gold">{placedOrder.order_number}</strong>.</p>
          {total!==null&&Number.isFinite(total)&&<p className="mt-2">Server-calculated total: <strong>{money(total)}</strong></p>}
          {placedOrder.duplicate&&<p className="mt-3 text-sm text-[#635d64]">This is the confirmation for an order already received.</p>}
          {clearError&&<p role="status" className="mt-4 text-sm text-[#a34023]">{clearError}</p>}
          <Link href="/menu" className="btn mt-6">Back to menu</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="container min-h-[60vh] py-14">
      <p className="eyebrow">Almost there</p>
      <h1 className="mt-2 text-5xl">Checkout</h1>
      <div className="panel mt-8 max-w-3xl p-6 sm:p-8">
        {catalog.status==='unavailable'&&<div role="alert" className="border-[3px] border-[#1c1b2a] bg-[#ff6b4a]/10 p-4 text-sm leading-6 text-[#a34023]"><strong>Ordering is unavailable.</strong> The live menu could not be loaded. Configure Supabase and apply the database migrations before placing orders.</div>}
        {catalog.status==='loading'&&<p role="status" className="border-[3px] border-[#1c1b2a] p-4 text-sm text-[#635d64]">Checking the live menu…</p>}
        {cartError&&<p role="alert" className="mt-4 text-sm text-[#c23348]">{cartError}</p>}
        {items.length>0&&unavailableItems.length>0&&catalog.status==='ready'&&<div role="alert" className="mt-4 border-[3px] border-[#1c1b2a] bg-[#ff6b4a]/10 p-4 text-sm text-[#a34023]">Some saved cart items are from the preview menu or are no longer available. Remove them and add items again from the live menu.</div>}
        {!items.length&&<div className="mt-4 border-[3px] border-[#1c1b2a] p-4 text-sm text-[#635d64]">Your cart is empty. Add items from the live menu before checkout. <Link className="text-[#ff6b4a] underline" href="/menu">Browse menu</Link></div>}

        <form onSubmit={placeOrder} className="mt-7">
          <fieldset>
            <legend className="mb-3 font-semibold">How would you like your pizza?</legend>
            <div className="grid grid-cols-3 gap-2">
              {([
                ['delivery','Delivery'],
                ['pickup','Pickup'],
                ['dine_in','Dine-in'],
              ] as const).map(([value,label])=><button type="button" key={value} onClick={()=>setMode(value)} className={`rounded-lg border px-2 py-3 text-sm ${mode===value?'border-[#ff6b4a] text-[#ff6b4a]':'border-[#1c1b2a]/30'}`}>{label}</button>)}
            </div>
          </fieldset>

          {mode==='dine_in'&&<div className="mt-5 border-[3px] border-[#1c1b2a] bg-[#ff6b4a]/10 p-4 text-sm">
            {tableValidation==='checking'&&<p role="status">Verifying the scanned table…</p>}
            {tableValidation==='valid'&&<p role="status">Ordering at <strong className="gold">{tableNumber}</strong>. The server will verify the QR and session again when you place the order.</p>}
            {tableValidation==='invalid'&&<p role="alert" className="text-[#c23348]">This table is not accepting orders. Scan its QR again or ask staff to open a session.</p>}
            {tableValidation==='none'&&<p role="alert" className="text-[#c23348]">Scan the QR code at your table before placing a dine-in order.</p>}
          </div>}

          {mode==='delivery'&&<div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="text-sm sm:col-span-2">Delivery address
              <input className="field mt-2" value={address} onChange={event=>setAddress(event.target.value)} autoComplete="street-address" maxLength={500} required/>
            </label>
            <label className="text-sm">Postal code
              <input className="field mt-2" value={postalCode} onChange={event=>setPostalCode(event.target.value)} autoComplete="postal-code" maxLength={20} required/>
            </label>
            <label className="text-sm">Delivery zone
              <select className="field mt-2" value={zoneId} onChange={event=>setZoneId(event.target.value)} required disabled={zonesLoading||zones.length===0}>
                <option value="">{zonesLoading?'Loading zones…':'Select a delivery zone'}</option>
                {zones.map(item=><option key={item.id} value={item.id}>{item.name} — {money(Number(item.fee))} delivery</option>)}
              </select>
            </label>
            {zonesError&&<p role="alert" className="text-sm text-[#c23348] sm:col-span-2">{zonesError}</p>}
            {zone&&<p className="text-xs text-[#635d64] sm:col-span-2">Minimum order: {money(Number(zone.minimum_order))}{zone.postal_codes.length?` · Serves ${zone.postal_codes.join(', ')}`:''}</p>}
            {zone&&postalCode.trim()&&!postalMatches&&<p role="alert" className="text-sm text-[#c23348] sm:col-span-2">That postal code is outside the selected delivery zone.</p>}
          </div>}

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="text-sm">Name
              <input className="field mt-2" value={name} onChange={event=>setName(event.target.value)} autoComplete="name" maxLength={120} required/>
            </label>
            <label className="text-sm">Phone
              <input className="field mt-2" type="tel" value={phone} onChange={event=>setPhone(event.target.value)} autoComplete="tel" maxLength={30} required/>
            </label>
          </div>
          <label className="mt-5 block text-sm">Email for updates
            <input className="field mt-2" type="email" value={email} onChange={event=>setEmail(event.target.value)} autoComplete="email" maxLength={254} required/>
          </label>
          <label className="mt-5 block text-sm">Coupon code (optional)
            <input className="field mt-2" value={couponCode} onChange={event=>setCouponCode(event.target.value)} maxLength={40}/>
          </label>
          <p className="mt-5 text-sm">Payment: <strong className="gold">Cash {mode==='delivery'?'on delivery':'at restaurant'}</strong></p>
          <p className="mt-2 text-xs text-[#635d64]">Prices, discounts, delivery fees, availability, and the final total are verified by the server.</p>
          {formError&&<p role="alert" className="mt-4 border-[3px] border-[#1c1b2a] bg-[#c23348]/10 p-3 text-sm text-[#c23348]">{formError}</p>}
          <button type="submit" disabled={!readyToSubmit||submitting} className="mt-6 w-full border-[3px] border-[#1c1b2a] bg-[#ff6b4a] shadow-[5px_5px_0_#1c1b2a] px-5 py-4 font-bold text-[#1c1b2a] disabled:cursor-not-allowed disabled:bg-[#ded8d5] disabled:text-[#7c747a]">
            {submitting?'Submitting securely…':'Place order'}
          </button>
          <Link href="/cart" className="mt-4 block text-center text-sm text-[#ff6b4a]">Back to cart</Link>
        </form>
      </div>
    </main>
  );
}
