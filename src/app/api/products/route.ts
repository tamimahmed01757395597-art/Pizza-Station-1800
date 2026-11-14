import { NextResponse } from 'next/server';
import { apiError, ApiError, parseJson, requireRole } from '@/lib/api';
import { z } from 'zod';
import { productSchema } from '@/lib/schemas';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const supabase = await createSupabaseServerClient();
    const category = url.searchParams.get('category');
    const featuredParam = url.searchParams.get('featured');
    if (category && !z.string().uuid().safeParse(category).success) throw new ApiError(400, 'Invalid category ID.');
    if (featuredParam && !z.enum(['true', 'false']).safeParse(featuredParam).success) throw new ApiError(400, 'Invalid featured filter.');
    let query = supabase.from('products')
      .select('id,category_id,slug,name,description,base_price,image_url,is_active,is_available,is_featured,created_at,updated_at,category:categories(id,name,slug,sort_order),variants:product_variants(*),addons:product_addons(*)')
      .order('name').limit(500);
    if (category) query = query.eq('category_id', category);
    if (featuredParam) query = query.eq('is_featured', featuredParam === 'true');
    const { data, error } = await query;
    if (error) {
      console.error('Product lookup failed:', error.message);
      return NextResponse.json({ error: 'Unable to load products.' }, { status: 500 });
    }
    return NextResponse.json({ products: data });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await parseJson(request, productSchema);
    const { supabase } = await requireRole(['admin', 'manager']);
    const { variants, addons, ...product } = body;
    const { data, error } = await supabase.from('products').insert(product).select().single();
    if (error) {
      console.error('Product creation failed:', error.message);
      return NextResponse.json({ error: 'Unable to create product.' }, { status: 400 });
    }
    const variantRows = (variants ?? []).map(({ name, price_delta, is_available }) => ({ product_id: data.id, name, price_delta, is_available }));
    const addonRows = (addons ?? []).map(({ name, price, is_available }) => ({ product_id: data.id, name, price, is_available }));
    const variantResult = variantRows.length ? await supabase.from('product_variants').insert(variantRows) : { error: null };
    const addonResult = addonRows.length ? await supabase.from('product_addons').insert(addonRows) : { error: null };
    if (variantResult.error || addonResult.error) {
      console.error('Product options creation failed:', variantResult.error?.message, addonResult.error?.message);
      return NextResponse.json({ error: 'Product created, but its variants or add-ons could not be saved.' }, { status: 500 });
    }
    return NextResponse.json({ product: data }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
