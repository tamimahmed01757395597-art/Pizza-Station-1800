import { NextResponse } from 'next/server';
import { apiError, enforceRateLimit, parseJson } from '@/lib/api';
import { resetPasswordSchema } from '@/lib/schemas';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    // The user may not have a session yet when email confirmation is enabled,
    // so this endpoint takes an address instead of requiring authentication.
    const { email } = await parseJson(request, resetPasswordSchema);
    enforceRateLimit(`resend-verification:${email.toLowerCase()}`, 3, 15 * 60_000);
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    if (error) {
      // Don't echo provider messages that may contain the address.
      console.error('Verification resend failed:', error.code ?? 'unknown code');
      return NextResponse.json({ error: 'Unable to send the verification email right now. Please try again later.' }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
