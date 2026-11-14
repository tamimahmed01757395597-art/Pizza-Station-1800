import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {addCartItem,readCart} from '../src/lib/cart';

const productId='4782faba-e250-492f-a1e9-186d494a9486';
const variantId='a1f00301-83e4-41bc-8be8-2c6062d3ff33';
const addonId='71611010-c8cf-428d-b17c-ad375d2d3c00';

describe('backend-linked cart items',()=>{
  let values:Map<string,string>;

  beforeEach(()=>{
    values=new Map();
    vi.stubGlobal('localStorage',{
      getItem:(key:string)=>values.get(key)??null,
      setItem:(key:string,value:string)=>values.set(key,value),
      removeItem:(key:string)=>values.delete(key),
    });
    vi.stubGlobal('window',{dispatchEvent:vi.fn()});
  });

  afterEach(()=>vi.unstubAllGlobals());

  it('keeps product, variant, and add-on IDs for checkout instead of merging unlike selections',()=>{
    const base={
      product_id:productId,
      slug:'margherita',
      name:'Margherita (Small)',
      price:10,
      qty:1,
      image:'pizza.jpg',
      variant_id:variantId,
      addon_ids:[addonId],
    };

    expect(addCartItem(base)).toEqual({ok:true});
    expect(addCartItem({...base,variant_id:undefined,addon_ids:[]})).toEqual({ok:true});

    const saved=readCart();
    expect(saved.error).toBeUndefined();
    expect(saved.items).toHaveLength(2);
    expect(saved.items[0]).toMatchObject({
      product_id:productId,
      variant_id:variantId,
      addon_ids:[addonId],
      qty:1,
    });
    expect(saved.items[1]).toMatchObject({
      product_id:productId,
      addon_ids:[],
      qty:1,
    });
  });

  it('rejects additions that exceed the server quantity limit',()=>{
    const item={product_id:productId,slug:'margherita',name:'Margherita',price:10,qty:20,image:'pizza.jpg',addon_ids:[]};
    expect(addCartItem(item)).toEqual({ok:true});
    expect(addCartItem({...item,qty:1})).toMatchObject({ok:false});
    expect(readCart().items[0].qty).toBe(20);
  });

  it('keeps table ordering in a separate cart from the public website cart',()=>{
    const item={product_id:productId,slug:'margherita',name:'Margherita',price:10,qty:1,image:'pizza.jpg',addon_ids:[]};
    expect(addCartItem(item,'ps-table-cart')).toEqual({ok:true});
    expect(readCart().items).toHaveLength(0);
    expect(readCart('ps-table-cart').items).toHaveLength(1);
  });
});
