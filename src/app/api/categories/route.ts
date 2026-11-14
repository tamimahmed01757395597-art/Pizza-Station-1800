import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.from('categories').select('id,name,slug,sort_order').order('sort_order');
    if (error) {
      console.error('Category lookup failed:', error.message);
      return NextResponse.json({ error: 'Unable to load categories.' }, { status: 500 });
    }
    return NextResponse.json({ categories: data });
  } catch (error) {
    return apiError(error);
  }
}
