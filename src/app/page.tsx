import Link from 'next/link';
import {ArrowRight,MapPin,Phone} from 'lucide-react';
import {FeaturedProducts} from '@/components/products';
import {restaurant} from '@/lib/restaurant';

export default function Home() {
  return <main>
    <section className="relative min-h-[610px] overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(90deg,#111110_5%,rgba(17,17,16,.92)_34%,rgba(17,17,16,.15)_100%)]"/>
      <img src="https://images.unsplash.com/photo-1579751626657-72bc17010498?auto=format&fit=crop&w=2000&q=90" alt="A freshly prepared pizza" className="absolute inset-0 -z-10 h-full w-full object-cover object-center"/>
      <div className="container relative flex min-h-[610px] items-center py-16">
        <div className="max-w-[600px]">
          <p className="eyebrow mb-5">{restaurant.name} · Eat. Drink. Enjoy.</p>
          <h1 className="text-5xl leading-[1.02] sm:text-7xl">A lot more<br/>than <span className="gold italic">pizza.</span></h1>
          <p className="mt-6 max-w-md text-base leading-7 text-[#d0ccc2]">Find pizza, burgers, biryani, platters, drinks and more on the Pizza Station 1800 menu.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link className="btn" href="/menu">Explore the menu <ArrowRight size={16}/></Link>
            <a className="btn secondary" href={restaurant.mapsUrl} target="_blank" rel="noreferrer">Get directions <MapPin size={16}/></a>
          </div>
          <div className="mt-12 flex flex-wrap gap-7 text-xs text-[#ddd8cc]">
            <span className="flex items-center gap-2"><MapPin size={15} className="gold"/>{restaurant.latitude}, {restaurant.longitude}</span>
            <a className="flex items-center gap-2 hover:text-white" href={`tel:${restaurant.phoneE164}`}><Phone size={15} className="gold"/>{restaurant.phone}</a>
          </div>
        </div>
      </div>
      <div className="absolute bottom-5 right-8 hidden rounded-full border border-[#e7b84b]/60 px-4 py-2 text-xs italic text-[#e7b84b] lg:block">Eat. Drink. Enjoy.</div>
    </section>

    <section className="container py-20">
      <div className="mb-8 flex items-end justify-between">
        <div><p className="eyebrow">From the Pizza Station menu</p><h2 className="mt-2 text-4xl">Customer <span className="gold italic">favourites</span></h2></div>
        <Link href="/menu" className="flex items-center gap-2 text-sm text-[#e7b84b]">Full menu <ArrowRight size={15}/></Link>
      </div>
      <FeaturedProducts/>
    </section>

    <section className="container py-16">
      <div className="panel flex flex-col items-start justify-between gap-5 p-8 sm:flex-row sm:items-center">
        <div><p className="eyebrow">Pizza Station 1800</p><h2 className="mt-2 text-3xl">Find us on the map.</h2><p className="mt-2 text-sm text-[#aaa69a]">{restaurant.phone}</p></div>
        <a className="btn" href={restaurant.mapsUrl} target="_blank" rel="noreferrer">Open Google Maps <ArrowRight size={16}/></a>
      </div>
    </section>
  </main>;
}
