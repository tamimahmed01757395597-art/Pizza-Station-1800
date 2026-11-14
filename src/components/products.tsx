'use client';

import Link from 'next/link';
import {useState} from 'react';
import {ArrowUpRight,Plus} from 'lucide-react';
import {addCartItem} from '@/lib/cart';
import {money,Product,productImageUrl} from '@/lib/menu';
import {useCatalogProducts} from '@/lib/use-catalog-products';

export function ProductCard({item}:{item:Product}) {
  const [added,setAdded]=useState(false);
  const [error,setError]=useState('');
  const needsOptions=Boolean(item.variants?.length||item.addons?.length);

  function add() {
    if(!item.id||needsOptions)return;
    const result=addCartItem({
      product_id:item.id,
      slug:item.slug,
      name:item.name,
      price:item.price,
      qty:1,
      image:item.image??'',
      addon_ids:[],
    });
    if(!result.ok) {
      setError(result.error);
      return;
    }
    setError('');
    setAdded(true);
    setTimeout(()=>setAdded(false),1100);
  }

  return (
    <article className="panel group overflow-hidden">
      <Link href={`/menu/${item.slug}`} className="relative block aspect-[1.26] overflow-hidden">
        {item.image
          ? <img src={productImageUrl(item.image)} alt={item.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105"/>
          : <div className="flex h-full flex-col items-center justify-center gap-2 bg-[radial-gradient(ellipse_at_top_right,#6f251a,#201513_60%,#111110)] p-6 text-center"><span className="eyebrow">{item.category}</span><span className="font-serif text-2xl text-[#f1d8a1]">{item.name}</span></div>}
        {item.badge&&<span className="absolute left-3 top-3 rounded-full bg-[#111]/85 px-3 py-1 text-[10px] font-semibold tracking-wide text-[#e7b84b]">{item.badge}</span>}
        <span className="absolute bottom-3 right-3 rounded-full bg-black/65 p-2"><ArrowUpRight size={15}/></span>
      </Link>
      <div className="p-4">
        <p className="eyebrow !text-[9px]">{item.category}</p>
        <Link href={`/menu/${item.slug}`}><h3 className="mt-1 text-xl">{item.name}</h3></Link>
        <p className="mt-2 line-clamp-2 min-h-10 text-xs leading-5 text-[#aaa69c]">{item.description}</p>
        <div className="mt-4 flex items-center justify-between">
          <strong className="text-sm">{money(item.price)}</strong>
          {item.id&&needsOptions
            ? <Link href={`/menu/${item.slug}`} className="rounded-full bg-[#e7b84b] px-4 py-2 text-xs font-bold text-[#17140b] hover:bg-[#f3cf78]">Choose options</Link>
            : <button
                onClick={add}
                disabled={!item.id}
                className="rounded-full bg-[#e7b84b] px-4 py-2 text-xs font-bold text-[#17140b] hover:bg-[#f3cf78] disabled:cursor-not-allowed disabled:bg-[#514a39] disabled:text-[#b9ac8d]"
                aria-label={`Add ${item.name} to cart`}
                title={!item.id?'Ordering requires the connected menu':undefined}
              >
                {added?'Added ✓':item.id?<span className="flex items-center gap-1"><Plus size={14}/> Add</span>:'Unavailable'}
              </button>}
        </div>
        {error&&<p role="alert" className="mt-3 text-xs text-[#ef8a7d]">{error}</p>}
      </div>
    </article>
  );
}

export function ProductGrid({items}:{items:Product[]}) {
  return <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{items.map(product=><ProductCard item={product} key={product.id??product.slug}/>)}</div>;
}

export function FeaturedProducts() {
  const catalog=useCatalogProducts();
  if(catalog.status==='loading')return <p role="status" className="text-sm text-[#aaa69a]">Loading the menu…</p>;
  if(catalog.status==='unavailable')return <p role="status" className="text-sm text-[#aaa69a]">Connect Supabase and apply the restaurant menu migration to show the current menu here.</p>;
  const items=[...catalog.products.filter(product=>product.badge==='Featured'),...catalog.products.filter(product=>product.badge!=='Featured')].slice(0,3);
  return items.length?<ProductGrid items={items}/>:<p className="text-sm text-[#aaa69a]">Menu favourites will appear here.</p>;
}
