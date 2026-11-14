'use client';

import Link from 'next/link';
import {useParams} from 'next/navigation';
import {useEffect,useMemo,useState} from 'react';
import {addCartItem} from '@/lib/cart';
import {money,productImageUrl} from '@/lib/menu';
import {useCatalogProducts} from '@/lib/use-catalog-products';

export default function ProductDetail() {
  const {slug}=useParams<{slug:string}>();
  const catalog=useCatalogProducts();
  const product=catalog.products.find(item=>item.slug===slug);
  const [variantId,setVariantId]=useState('');
  const [addonIds,setAddonIds]=useState<string[]>([]);
  const [quantity,setQuantity]=useState(1);
  const [cartError,setCartError]=useState('');

  const variants=useMemo(()=>product?.variants?.filter(variant=>variant.is_available)??[],[product]);
  const addons=useMemo(()=>product?.addons?.filter(addon=>addon.is_available)??[],[product]);
  const selectedVariant=variants.find(variant=>variant.id===variantId);
  const selectedAddons=addons.filter(addon=>addonIds.includes(addon.id));
  const estimate=(product?.price??0)+(selectedVariant?.price_delta??0)+selectedAddons.reduce((sum,addon)=>sum+addon.price,0);

  useEffect(()=>{
    setVariantId(product?.variants?.find(variant=>variant.is_available)?.id??'');
    setAddonIds([]);
    setCartError('');
  },[product?.id]);

  if(!product)return <main className="container py-24"><h1>{catalog.status==='loading'?'Loading menu item…':catalog.status==='unavailable'?'Menu temporarily unavailable':'Menu item not found'}</h1><Link href="/menu" className="gold">Back to menu</Link></main>;

  function add() {
    if(!product?.id)return;
    const result=addCartItem({
      product_id:product.id,
      ...(selectedVariant?{variant_id:selectedVariant.id}:{}),
      addon_ids:addonIds,
      slug:product.slug,
      name:`${product.name}${selectedVariant?` (${selectedVariant.name})`:''}${selectedAddons.length?` + ${selectedAddons.map(addon=>addon.name).join(', ')}`:''}`,
      price:estimate,
      qty:quantity,
      image:product.image??'',
    });
    if(!result.ok) {
      setCartError(result.error);
      return;
    }
    window.location.assign('/cart');
  }

  return (
    <main className="container grid gap-10 py-12 md:grid-cols-2">
      {product.image
        ? <img className="max-h-[560px] w-full rounded-2xl object-cover" src={productImageUrl(product.image)} alt={product.name}/>
        : <div className="flex min-h-[360px] flex-col items-center justify-center rounded-2xl bg-[radial-gradient(ellipse_at_top_right,#6f251a,#201513_60%,#111110)] p-8 text-center"><p className="eyebrow">{product.category}</p><p className="mt-3 font-serif text-4xl text-[#f1d8a1]">{product.name}</p></div>}
      <div className="py-5">
        <p className="eyebrow">{product.category}</p>
        <h1 className="mt-2 text-5xl">{product.name}</h1>
        <p className="mt-4 leading-7 text-[#aaa69a]">{product.description}</p>
        <p className="mt-5 text-2xl font-bold gold">From {money(product.price)}</p>
        {!!variants.length&&<fieldset className="mt-8">
          <legend className="mb-3 text-sm font-semibold">Choose an option</legend>
          <div className="grid gap-2">
            {variants.map(variant=><label key={variant.id} className={`flex cursor-pointer items-center justify-between rounded-lg border px-4 py-3 text-sm ${variantId===variant.id?'border-[#e7b84b] text-[#e7b84b]':'border-white/20'}`}>
              <span className="flex items-center gap-3"><input type="radio" name="product-variant" checked={variantId===variant.id} onChange={()=>setVariantId(variant.id)} className="accent-[#e7b84b]"/>{variant.name}</span>
              <span>{money(product.price+variant.price_delta)}</span>
            </label>)}
          </div>
        </fieldset>}

        {!!addons.length&&<fieldset className="mt-7">
          <legend className="mb-3 text-sm font-semibold">Add a little extra</legend>
          {addons.map(addon=><label key={addon.id} className="mb-2 flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-3"><input type="checkbox" checked={addonIds.includes(addon.id)} onChange={event=>setAddonIds(event.target.checked?[...addonIds,addon.id]:addonIds.filter(id=>id!==addon.id))} className="accent-[#e7b84b]"/>{addon.name}</span>
            <span className="text-[#aaa69a]">+ {money(addon.price)}</span>
          </label>)}
        </fieldset>}

        <div className="mt-7 flex items-center gap-4">
          <div className="flex items-center rounded-full border border-white/20">
            <button className="px-4 py-2" onClick={()=>setQuantity(Math.max(1,quantity-1))} aria-label="Decrease quantity">−</button>
            <span>{quantity}</span>
            <button className="px-4 py-2" onClick={()=>setQuantity(Math.min(20,quantity+1))} aria-label="Increase quantity">+</button>
          </div>
          <button onClick={add} disabled={!product.id} className="btn flex-1 disabled:cursor-not-allowed disabled:opacity-50">
            {product.id?`Add to order · ${money(estimate*quantity)}`:'Ordering unavailable'}
          </button>
        </div>
        {cartError&&<p role="alert" className="mt-3 text-sm text-[#ef8a7d]">{cartError}</p>}
        <p className="mt-4 text-xs text-[#888]">Price preview only. Final price and availability are confirmed by the server at checkout.</p>
      </div>
    </main>
  );
}
