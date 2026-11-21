import { NextResponse } from 'next/server';
import { apiError, enforceRateLimit, parseJson } from '@/lib/api';
import { registerSchema } from '@/lib/schemas';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const body = await parseJson(request, registerSchema);
    enforceRateLimit(`register:${body.email.toLowerCase()}`, 5, 30 * 60_000);
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
    // Return only whether a session was created so the UI can show the
    // "confirm your email" message. Never expose raw tokens in the response.
    return NextResponse.json({ session: Boolean(data.session) }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
