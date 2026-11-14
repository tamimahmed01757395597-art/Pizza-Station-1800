'use client';

import {useEffect,useState} from 'react';
import {z} from 'zod';
import {mapCatalogProduct,Product} from '@/lib/menu';

const catalogResponseSchema=z.object({
  products:z.array(z.object({
    id:z.string().uuid(),
    slug:z.string(),
    name:z.string(),
    description:z.string(),
    base_price:z.union([z.number(),z.string()]),
    image_url:z.string().nullable(),
    is_active:z.boolean(),
    is_available:z.boolean(),
    is_featured:z.boolean(),
    category:z.object({name:z.string(),slug:z.string(),sort_order:z.number()}).nullable(),
    variants:z.array(z.object({
      id:z.string().uuid(),
      name:z.string(),
      price_delta:z.union([z.number(),z.string()]),
      is_available:z.boolean(),
    })).default([]),
    addons:z.array(z.object({
      id:z.string().uuid(),
      name:z.string(),
      price:z.union([z.number(),z.string()]),
      is_available:z.boolean(),
    })).default([]),
  })),
});

type CatalogState={
  products:Product[];
  status:'loading'|'ready'|'unavailable';
  error:string|null;
};

export function useCatalogProducts({includeUnavailable=false}:{includeUnavailable?:boolean}={}):CatalogState&{refresh:()=>void} {
  const [state,setState]=useState<CatalogState>({products:[],status:'loading',error:null});
  const [reloadKey,setReloadKey]=useState(0);

  useEffect(()=>{
    let active=true;
    setState(current=>({...current,status:'loading',error:null}));
    fetch('/api/products',{cache:'no-store'})
      .then(async response=>{
        if(!response.ok)throw new Error(`Catalog request failed (${response.status}).`);
        const parsed=catalogResponseSchema.safeParse(await response.json());
        if(!parsed.success)throw new Error('Catalog response was invalid.');
        return parsed.data.products
          .filter(product=>product.is_active&&(includeUnavailable||product.is_available))
          .map(mapCatalogProduct);
      })
      .then(catalog=>{
        if(active)setState({products:catalog,status:'ready',error:null});
      }).catch((loadError:unknown)=>{
        if(!active)return;
        console.error('Catalog loading failed:',loadError);
        setState({
          products:[],
          status:'unavailable',
          error:loadError instanceof Error?loadError.message:'The menu could not be loaded.',
        });
      });
    return ()=>{active=false};
  },[includeUnavailable,reloadKey]);

  return {...state,refresh:()=>setReloadKey(key=>key+1)};
}
