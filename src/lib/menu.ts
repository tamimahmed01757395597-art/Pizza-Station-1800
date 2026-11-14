export type MenuVariant = {id:string;name:string;price_delta:number;is_available:boolean};
export type MenuAddon = {id:string;name:string;price:number;is_available:boolean};
export type Product = {
  id?:string;
  slug:string;
  name:string;
  category:string;
  categorySlug?:string;
  categoryOrder?:number;
  description:string;
  price:number;
  image?:string;
  badge?:string;
  isAvailable?:boolean;
  tags:string[];
  variants?:MenuVariant[];
  addons?:MenuAddon[];
};
export const money=(n:number)=>`৳${new Intl.NumberFormat('en-BD',{maximumFractionDigits:2}).format(n)}`;

type CatalogProduct = {
  id:string;
  slug:string;
  name:string;
  description:string;
  base_price:number|string;
  image_url:string|null;
  is_active:boolean;
  is_available:boolean;
  is_featured:boolean;
  category:{name:string;slug:string;sort_order:number}|null;
  variants:Array<Omit<MenuVariant,'price_delta'> & {price_delta:number|string}>;
  addons:Array<Omit<MenuAddon,'price'> & {price:number|string}>;
};

export function mapCatalogProduct(row:CatalogProduct):Product {
  return {
    id:row.id,
    slug:row.slug,
    name:row.name,
    category:row.category?.name??'Menu',
    categorySlug:row.category?.slug,
    categoryOrder:row.category?.sort_order,
    description:row.description,
    price:Number(row.base_price),
    image:row.image_url??undefined,
    badge:row.is_featured?'Featured':undefined,
    isAvailable:row.is_available,
    tags:[],
    variants:(row.variants??[])
      .map(variant=>({...variant,price_delta:Number(variant.price_delta)}))
      .sort((left,right)=>left.price_delta-right.price_delta),
    addons:(row.addons??[]).map(addon=>({...addon,price:Number(addon.price)})),
  };
}

export function productImageUrl(image:string):string {
  return image.startsWith('https://')
    ? image
    : `https://images.unsplash.com/${image}?auto=format&fit=crop&w=900&q=85`;
}
