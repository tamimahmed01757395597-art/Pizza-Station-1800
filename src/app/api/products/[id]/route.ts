import { NextResponse } from 'next/server';
import { apiError, parseJson, requireRole, requireUuid } from '@/lib/api';
import { productUpdateSchema } from '@/lib/schemas';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  try {
    const { id } = await params;
    requireUuid(id);
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.from('products')
      .select('id,category_id,slug,name,description,base_price,image_url,is_active,is_available,is_featured,created_at,updated_at,category:categories(id,name,slug),variants:product_variants(*),addons:product_addons(*)')
      .eq('id', id).maybeSingle();
    if (error) {
      console.error('Product lookup failed:', error.message);
      return NextResponse.json({ error: 'Unable to load product.' }, { status: 500 });
    }
    if (!data) return NextResponse.json({ error: 'Product not found.' }, { status: 404 });
    return NextResponse.json({ product: data });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request, { params }: Context) {
  try {
    const { id } = await params;
    requireUuid(id);
    const body = await parseJson(request, productUpdateSchema);
    const { supabase } = await requireRole(['admin', 'manager']);
    const { data: existing, error: lookupError } = await supabase.from('products').select('id').eq('id', id).maybeSingle();
    if (lookupError) throw lookupError;
    if (!existing) return NextResponse.json({ error: 'Product not found.' }, { status: 404 });
    const { variants, addons, ...fields } = body;
    if (Object.keys(fields).length) {
      const { error } = await supabase.from('products').update(fields).eq('id', id);
      if (error) {
        console.error('Product update failed:', error.message);
        return NextResponse.json({ error: 'Unable to update product.' }, { status: 400 });
      }
    }
    if (variants) {
      const { error: deleteError } = await supabase.from('product_variants').delete().eq('product_id', id);
      if (deleteError) return NextResponse.json({ error: 'Unable to replace product variants.' }, { status: 400 });
      if (variants.length) {
        const { error } = await supabase.from('product_variants').insert(variants.map(({ name, price_delta, is_available }) => ({ product_id: id, name, price_delta, is_available })));
        if (error) return NextResponse.json({ error: 'Unable to save product variants.' }, { status: 400 });
      }
    }
    if (addons) {
      const { error: deleteError } = await supabase.from('product_addons').delete().eq('product_id', id);
      if (deleteError) return NextResponse.json({ error: 'Unable to replace product add-ons.' }, { status: 400 });
      if (addons.length) {
        const { error } = await supabase.from('product_addons').insert(addons.map(({ name, price, is_available }) => ({ product_id: id, name, price, is_available })));
        if (error) return NextResponse.json({ error: 'Unable to save product add-ons.' }, { status: 400 });
      }
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_request: Request, { params }: Context) {
  try {
    const { id } = await params;
    requireUuid(id);
    const { supabase } = await requireRole(['admin', 'manager']);
    const { data, error } = await supabase.from('products').delete().eq('id', id).select('id').maybeSingle();
    if (error) {
      console.error('Product deletion failed:', error.message);
      return NextResponse.json({ error: 'Unable to delete product.' }, { status: 400 });
    }
    if (!data) return NextResponse.json({ error: 'Product not found.' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
