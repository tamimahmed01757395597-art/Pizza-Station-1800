import { NextResponse } from 'next/server';
import { apiError, parseJson } from '@/lib/api';
import { loginSchema } from '@/lib/schemas';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const body = await parseJson(request, loginSchema);
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithPassword(body);
    if (error || !data.user) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }
    return NextResponse.json({ user: data.user });
  } catch (error) {
    return apiError(error);
  }
}
