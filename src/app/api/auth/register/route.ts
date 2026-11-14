import { NextResponse } from 'next/server';
import { apiError, parseJson } from '@/lib/api';
import { registerSchema } from '@/lib/schemas';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const body = await parseJson(request, registerSchema);
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signUp({
      email: body.email,
      password: body.password,
      options: { data: { full_name: body.name, phone: body.phone } },
    });
    if (error) {
      console.error('Registration failed:', error.message);
      return NextResponse.json({ error: 'Unable to create account with those details.' }, { status: 400 });
    }
    return NextResponse.json({ user: data.user, session: data.session }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
