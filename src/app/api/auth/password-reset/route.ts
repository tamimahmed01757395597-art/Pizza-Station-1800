import { NextResponse } from 'next/server';
import { apiError, enforceRateLimit, parseJson } from '@/lib/api';
import { resetPasswordSchema } from '@/lib/schemas';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const { email } = await parseJson(request, resetPasswordSchema);
    enforceRateLimit(`password-reset:${email.toLowerCase()}`, 5, 15 * 60_000);
    const supabase = await createSupabaseServerClient();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    if (!siteUrl) throw new Error('NEXT_PUBLIC_SITE_URL is not configured.');
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${siteUrl}/auth/callback?next=/account/reset-password`,
    });
    if (error) {
      console.error('Password reset request failed:', error.message);
      return NextResponse.json({ error: 'Unable to send password reset email.' }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
