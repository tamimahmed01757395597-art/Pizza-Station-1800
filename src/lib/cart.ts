import { z } from 'zod';

const cartItemSchema = z.object({
  product_id:z.string().uuid().optional(),
  variant_id:z.string().uuid().optional(),
  addon_ids:z.array(z.string().uuid()).optional(),
  slug:z.string(),
  name:z.string(),
  price:z.number().finite().nonnegative(),
  qty:z.number().int().min(1).max(20),
  image:z.string(),
}).passthrough();

export type CartItem=z.infer<typeof cartItemSchema>;
const defaultCartKey='ps-cart';

export function readCart(storageKey=defaultCartKey):{items:CartItem[];error?:string} {
  try {
    const raw=localStorage.getItem(storageKey);
    if(!raw)return {items:[]};
    const parsed:unknown=JSON.parse(raw);
    if(!Array.isArray(parsed))return {items:[],error:'Your saved cart could not be read. Clear it and add your items again.'};
    const result=z.array(cartItemSchema).safeParse(parsed);
    if(!result.success)return {items:[],error:'Your saved cart could not be read. Clear it and add your items again.'};
    return {items:result.data};
  } catch {
    return {items:[],error:'Your saved cart could not be read. Clear it and add your items again.'};
  }
}

export function saveCart(items:CartItem[],storageKey=defaultCartKey):void {
  localStorage.setItem(storageKey,JSON.stringify(items));
  window.dispatchEvent(new Event('cartchange'));
}

export function addCartItem(item:CartItem,storageKey=defaultCartKey):{ok:true}|{ok:false;error:string} {
  const cart=readCart(storageKey);
  if(cart.error)return {ok:false,error:cart.error};
  const addons=[...(item.addon_ids??[])].sort();
  const existingIndex=cart.items.findIndex(current=>
    current.product_id===item.product_id
    && current.variant_id===item.variant_id
    && [...(current.addon_ids??[])].sort().join(',')===addons.join(',')
  );
  const next=[...cart.items];
  if(existingIndex>=0) {
    const quantity=next[existingIndex].qty+item.qty;
    if(quantity>20)return {ok:false,error:'A product can be ordered up to 20 times per selection.'};
    next[existingIndex]={...next[existingIndex],qty:quantity};
  } else {
    if(next.length>=50)return {ok:false,error:'Your cart has reached its 50-item limit.'};
    next.push(item);
  }
  try {
    saveCart(next,storageKey);
    return {ok:true};
  } catch {
    return {ok:false,error:'Your browser could not save the cart. Check available storage and try again.'};
  }
}

export function clearCart(storageKey=defaultCartKey):void {
  localStorage.removeItem(storageKey);
  window.dispatchEvent(new Event('cartchange'));
}
