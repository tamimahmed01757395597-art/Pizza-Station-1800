import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function POST() {
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Logout failed:', error.message);
      return NextResponse.json({ error: 'Unable to end session.' }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
