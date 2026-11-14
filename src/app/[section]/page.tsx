import Link from 'next/link';
import {restaurant} from '@/lib/restaurant';

const copy:Record<string,{eyebrow:string;title:string;intro:string;body:string}>={
  'order-confirmation':{eyebrow:'Order update',title:'No order placed yet',intro:'There is no confirmed order to show.',body:'Checkout is not connected to a secure backend yet. When order submission is implemented, this page will display a real confirmation.'},
  track:{eyebrow:'Order tracking',title:'Follow your order',intro:'Order status appears here after a real order has been placed.',body:'Live tracking requires the order backend and Supabase Realtime connection.'},
};

export default async function ContentPage({params}:{params:Promise<{section:string}>}) {
  const {section}=await params;
  if(section==='contact')return <main className="container min-h-[50vh] py-16">
    <p className="eyebrow">Come visit</p>
    <h1 className="mt-3 text-5xl sm:text-6xl">Pizza Station <span className="gold italic">1800</span></h1>
    <p className="mt-5 max-w-xl text-lg text-[#e5dfd3]">Find the restaurant on Google Maps or call us using the number shown on the menu.</p>
    <div className="mt-7 flex flex-wrap gap-3">
      <a className="btn" href={`tel:${restaurant.phoneE164}`}>Call {restaurant.phone}</a>
      <a className="btn secondary" href={restaurant.mapsUrl} target="_blank" rel="noreferrer">Open Google Maps</a>
    </div>
    <p className="mt-5 text-sm text-[#aaa69a]">Location: {restaurant.latitude}, {restaurant.longitude}</p>
    <div className="mt-8 overflow-hidden rounded-2xl border border-white/10">
      <iframe title="Pizza Station 1800 location map" src={`https://www.google.com/maps?q=${restaurant.latitude},${restaurant.longitude}&output=embed`} className="h-[420px] w-full border-0" loading="lazy" referrerPolicy="no-referrer-when-downgrade"/>
    </div>
  </main>;

  const content=copy[section];
  if(!content)return <main className="container py-24"><h1 className="text-4xl">Page not found</h1><Link href="/" className="gold">Return home</Link></main>;
  return <main className="container min-h-[50vh] py-20">
    <p className="eyebrow">{content.eyebrow}</p>
    <h1 className="mt-3 max-w-3xl text-5xl leading-tight sm:text-6xl">{content.title}</h1>
    <p className="mt-5 max-w-xl text-lg text-[#e5dfd3]">{content.intro}</p>
    <p className="mt-4 max-w-2xl leading-7 text-[#a6a29a]">{content.body}</p>
    {['order-confirmation','track'].includes(section)&&<Link className="btn mt-7" href="/menu">Browse menu</Link>}
  </main>;
}
