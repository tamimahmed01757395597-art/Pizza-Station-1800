'use client';

import {useMemo,useState} from 'react';
import Link from 'next/link';
import {Search} from 'lucide-react';
import {money,Product} from '@/lib/menu';
import {useCatalogProducts} from '@/lib/use-catalog-products';
import {restaurant} from '@/lib/restaurant';

function categorySlug(product:Product):string {
  return product.categorySlug??product.category.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
}

export default function MenuPage() {
  const [query,setQuery]=useState('');
  const [category,setCategory]=useState('all');
  const catalog=useCatalogProducts();
  const categories=useMemo(()=>{
    const seen=new Map<string,{slug:string;name:string;sortOrder:number}>();
    for(const product of catalog.products) {
      const slug=categorySlug(product);
      if(!seen.has(slug))seen.set(slug,{slug,name:product.category,sortOrder:product.categoryOrder??999});
    }
    return [...seen.values()].sort((left,right)=>left.sortOrder-right.sortOrder||left.name.localeCompare(right.name));
  },[catalog.products]);
  const filtered=useMemo(()=>catalog.products.filter(product=>
    (category==='all'||categorySlug(product)===category)
    && `${product.name} ${product.description} ${product.tags.join(' ')}`.toLowerCase().includes(query.toLowerCase())
  ),[catalog.products,category,query]);
  const groups=categories.map(item=>({
    ...item,
    products:filtered.filter(product=>categorySlug(product)===item.slug),
  })).filter(item=>item.products.length);

  return (
    <main className="container min-h-[60vh] py-12 sm:py-16">
      <section className="panel relative overflow-hidden p-6 sm:p-10">
        <div className="pointer-events-none absolute -right-20 -top-32 h-72 w-72 rounded-full bg-[#c9342e]/15 blur-3xl"/>
        <p className="eyebrow">Pizza Station · 1800</p>
        <h1 className="mt-2 text-5xl sm:text-6xl">The <span className="gold italic">menu</span></h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-[#c5c0b5]">Pizza, burgers, biryani, platters, drinks and more. Browse the menu and choose an item to see its sizes and extras.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a className="btn" href={`tel:${restaurant.phoneE164}`}>Call {restaurant.phone}</a>
          <a className="btn secondary" href={restaurant.mapsUrl} target="_blank" rel="noreferrer">Find us on Google Maps</a>
        </div>
      </section>

      {catalog.status==='unavailable'&&<p role="status" className="mt-5 rounded-xl border border-[#e7b84b]/40 bg-[#e7b84b]/10 p-4 text-sm text-[#e9d6a2]">The live menu is unavailable. Apply the Pizza Station menu migration and check the Supabase connection; the original printed menu pages are available below.</p>}

      <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <button onClick={()=>setCategory('all')} className={`rounded-full border px-4 py-2 text-xs ${category==='all'?'border-[#e7b84b] bg-[#e7b84b] text-[#17140b]':'border-white/15 text-[#ddd] hover:border-[#e7b84b]'}`}>All</button>
          {categories.map(item=><button key={item.slug} onClick={()=>setCategory(item.slug)} className={`rounded-full border px-4 py-2 text-xs ${category===item.slug?'border-[#e7b84b] bg-[#e7b84b] text-[#17140b]':'border-white/15 text-[#ddd] hover:border-[#e7b84b]'}`}>{item.name}</button>)}
        </div>
        <label className="relative">
          <Search className="absolute left-3 top-3 text-[#a6a29a]" size={16}/>
          <input className="field w-full !pl-10 sm:w-64" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search the menu…" aria-label="Search menu"/>
        </label>
      </div>
      {catalog.status==='loading'&&<p role="status" className="mt-4 text-xs text-[#aaa69a]">Loading the current menu…</p>}
      <div className="mt-10 space-y-12">
        {groups.map(group=><section key={group.slug} id={group.slug} className="scroll-mt-28">
          <div className="mb-4 flex items-end justify-between border-b border-[#e7b84b]/35 pb-3">
            <div><p className="eyebrow">Pizza Station 1800</p><h2 className="mt-1 text-3xl">{group.name}</h2></div>
            <span className="text-xs text-[#8f8b82]">{group.products.length} items</span>
          </div>
          <ul className="grid gap-3 md:grid-cols-2">
            {group.products.map(item=><li key={item.id??item.slug} className="panel flex min-h-28 items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                <Link href={`/menu/${item.slug}`} className="font-semibold hover:text-[#e7b84b]">{item.name}</Link>
                <p className="mt-1 text-xs leading-5 text-[#aaa69a]">{item.description}</p>
                {!!item.variants?.length&&<p className="mt-1 text-[11px] text-[#8f8b82]">Options: {item.variants.map(variant=>variant.name).join(' · ')}</p>}
              </div>
              <div className="shrink-0 text-right">
                <p className="font-semibold text-[#e7b84b]">{item.variants?.length?'From ':''}{money(item.price)}</p>
                <Link href={`/menu/${item.slug}`} className="mt-1 inline-block text-xs text-[#c5c0b5] underline decoration-white/20 underline-offset-4 hover:text-white">{item.variants?.length||item.addons?.length?'Choose options':'View item'}</Link>
              </div>
            </li>)}
          </ul>
        </section>)}
        {catalog.status==='ready'&&!catalog.products.length&&<p className="py-16 text-center text-[#aaa69a]">The digital menu is not loaded yet. Apply migration 005 to add the Pizza Station menu.</p>}
        {catalog.status==='ready'&&catalog.products.length>0&&!filtered.length&&<p className="py-16 text-center text-[#aaa69a]">No menu items match that search.</p>}
      </div>

      <details className="panel mt-14 p-5 sm:p-7">
        <summary className="cursor-pointer text-lg font-semibold">View the original printed menu</summary>
        <p className="mt-2 text-sm text-[#aaa69a]">These are the menu pages you provided. Select an image to open it full size, or download it.</p>
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          {[1,2].map(page=><figure key={page} className="overflow-hidden rounded-xl border border-white/10">
            <a href={`/images/pizza-station-menu-page-${page}.png`} target="_blank" rel="noreferrer" aria-label={`Open original menu page ${page}`}>
              <img src={`/images/pizza-station-menu-page-${page}.png`} alt={`Pizza Station 1800 printed menu, page ${page}`} className="w-full"/>
            </a>
            <figcaption className="flex items-center justify-between p-3 text-sm"><span>Printed menu · page {page}</span><a className="text-[#e7b84b] underline underline-offset-4" href={`/images/pizza-station-menu-page-${page}.png`} download={`pizza-station-menu-${page}.png`}>Download</a></figcaption>
          </figure>)}
        </div>
      </details>
    </main>
  );
}
