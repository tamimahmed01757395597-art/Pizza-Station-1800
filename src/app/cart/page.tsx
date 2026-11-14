'use client';

import Link from 'next/link';
import {useEffect,useState} from 'react';
import {CartItem,clearCart,readCart,saveCart} from '@/lib/cart';
import {money,productImageUrl} from '@/lib/menu';

export default function Cart() {
  const [items,setItems]=useState<CartItem[]>([]);
  const [error,setError]=useState('');

  useEffect(()=>{
    const saved=readCart();
    setItems(saved.items);
    setError(saved.error??'');
  },[]);

  function save(next:CartItem[]) {
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

  const total=items.reduce((sum,item)=>sum+item.price*item.qty,0);
  const previewItems=items.some(item=>!item.product_id);

  return (
    <main className="container min-h-[55vh] py-14">
      <p className="eyebrow">Your order</p>
      <h1 className="mt-2 text-5xl">The <span className="gold italic">cart</span></h1>
      {error&&<p role="alert" className="mt-5 rounded-lg border border-[#ef8a7d]/40 bg-[#ef8a7d]/10 p-4 text-sm text-[#ef8a7d]">{error}</p>}
      {!items.length?<div className="panel mt-8 p-10 text-center"><p className="text-lg">Your cart is taking a little breather.</p>{error&&<button type="button" onClick={removeAll} className="mt-4 rounded-full border border-white/20 px-4 py-2 text-sm">Clear saved cart</button>}<Link href="/menu" className="btn mt-5">Explore the menu</Link></div>:<div className="mt-8 grid gap-8 lg:grid-cols-[1fr_340px]">
        <div className="grid gap-3">
          {items.map((item,index)=><article key={`${item.product_id??item.slug}-${index}`} className="panel flex items-center gap-4 p-4">
            {item.image?<img className="h-20 w-24 rounded-lg object-cover" src={productImageUrl(item.image)} alt={item.name}/>:<div className="flex h-20 w-24 shrink-0 items-center justify-center rounded-lg bg-[#281b16] p-2 text-center text-xs text-[#f1d8a1]">{item.name}</div>}
            <div className="flex-1"><h2 className="font-semibold">{item.name}</h2><p className="mt-1 text-sm gold">{money(item.price)} estimate each</p>{!item.product_id&&<p className="mt-1 text-xs text-[#e9d6a2]">Preview item — add again from the connected menu.</p>}</div>
            <div className="flex items-center gap-3">
              <button onClick={()=>save(items.map((current,i)=>i===index?{...current,qty:Math.max(1,current.qty-1)}:current))} aria-label="Decrease quantity">−</button>
              {item.qty}
              <button onClick={()=>save(items.map((current,i)=>i===index?{...current,qty:Math.min(20,current.qty+1)}:current))} aria-label="Increase quantity">+</button>
            </div>
            <button className="ml-2 text-xs text-[#ef8a7d]" onClick={()=>save(items.filter((_,i)=>i!==index))}>Remove</button>
          </article>)}
        </div>
        <aside className="panel h-fit p-6">
          <h2 className="text-2xl">Summary</h2>
          <p className="mt-5 text-xs text-[#aaa69a]">Enter a coupon at checkout. Delivery fees, discounts, availability, and the final total are calculated by the server.</p>
          <div className="mt-5 flex justify-between border-t border-white/10 pt-4"><span>Subtotal estimate</span><strong>{money(total)}</strong></div>
          {previewItems&&<button type="button" onClick={removeAll} className="mt-5 w-full rounded-full border border-white/20 px-4 py-3 text-sm hover:border-[#e7b84b]">Clear preview items</button>}
          <Link href="/checkout" className="btn mt-6 w-full">Continue to checkout</Link>
        </aside>
      </div>}
    </main>
  );
}
