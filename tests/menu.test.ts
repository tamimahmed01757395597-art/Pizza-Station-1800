import {describe,expect,it} from 'vitest';
import {mapCatalogProduct,money} from '../src/lib/menu';

describe('restaurant menu display',()=>{
  it('formats prices in Bangladeshi taka',()=>{
    expect(money(150)).toBe('৳150');
    expect(money(1200)).toBe('৳1,200');
  });

  it('keeps unsupplied product photos blank and sorts options by actual price',()=>{
    const product=mapCatalogProduct({
      id:'10000000-0000-4000-8000-000000000001',
      slug:'ps1800-regular-chicken-pizza',
      name:'Regular Chicken Pizza',
      description:'Chicken and cheese.',
      base_price:'490',
      image_url:null,
      is_active:true,
      is_available:true,
      is_featured:false,
      category:{name:'Pizza',slug:'pizza',sort_order:1},
      variants:[
        {id:'10000000-0000-4000-8000-000000000003',name:'Large',price_delta:'260',is_available:true},
        {id:'10000000-0000-4000-8000-000000000002',name:'Small',price_delta:'0',is_available:true},
      ],
      addons:[],
    });

    expect(product.image).toBeUndefined();
    expect(product.variants?.map(variant=>variant.name)).toEqual(['Small','Large']);
    expect(product.price+Number(product.variants?.[1].price_delta)).toBe(750);
  });
});
