import { NextResponse } from 'next/server';
import { apiError, enforceRateLimit, parseJson } from '@/lib/api';
import { loginSchema } from '@/lib/schemas';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const body = await parseJson(request, loginSchema);
    enforceRateLimit(`login:${body.email.toLowerCase()}`, 10, 10 * 60_000);
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithPassword(body);
    if (error || !data.user) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }
    // The session cookie carries the credentials; don't hand tokens or the full
    // user object back to page JavaScript.
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
