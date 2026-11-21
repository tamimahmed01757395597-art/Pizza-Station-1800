'use client';

import Link from 'next/link';
import {useParams} from 'next/navigation';
import {ProductGrid} from '@/components/products';
import {Product} from '@/lib/menu';
import {useCatalogProducts} from '@/lib/use-catalog-products';

function categorySlug(product:Product):string {
  return product.categorySlug??product.category.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
}

export default function CategoryPage() {
  const params=useParams<{category:string}>();
  const category=decodeURIComponent(params.category);
  const catalog=useCatalogProducts();
  const items=catalog.products.filter(product=>categorySlug(product)===category);

  return (
    <main className="container min-h-[55vh] py-14">
      <p className="eyebrow">Explore by taste</p>
      <h1 className="mt-2 text-5xl capitalize">{items[0]?.category??category.replaceAll('-',' ')} <span className="gold italic">menu</span></h1>
      <Link href="/menu" className="mt-4 inline-block text-sm text-[#ff6b4a]">← All menu</Link>
      {catalog.status==='unavailable'&&<p role="status" className="mt-5 border-[3px] border-[#1c1b2a] bg-[#ff6b4a]/10 p-4 text-sm text-[#a34023]">The live menu is unavailable. Connect Supabase and apply the restaurant menu migration.</p>}
      {catalog.status==='loading'&&<p className="mt-5 text-sm text-[#635d64]">Loading the current menu…</p>}
      <div className="mt-8">
        {items.length?<ProductGrid items={items}/>:catalog.status==='ready'?<div className="panel mt-7 p-8"><p className="text-[#635d64]">We don’t have a category called “{category.replaceAll('-',' ')}” yet.</p><Link href="/menu" className="mt-3 inline-block text-[#ff6b4a]">Browse all menu items →</Link></div>:null}
      </div>
    </main>
  );
}
