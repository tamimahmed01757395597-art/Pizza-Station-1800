import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.from('delivery_zones')
      .select('id,name,fee,minimum_order,postal_codes')
      .order('name').limit(200);
    if (error) {
      console.error('Delivery zone lookup failed:', error.message);
      return NextResponse.json({ error: 'Unable to load delivery zones.' }, { status: 500 });
    }
    return NextResponse.json({ zones: data });
  } catch (error) {
    return apiError(error);
  }
}
