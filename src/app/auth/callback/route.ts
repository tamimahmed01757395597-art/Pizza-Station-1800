import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const OTP_TYPES = new Set(['signup', 'invite', 'magiclink', 'recovery', 'email_change', 'email']);

function safeNextPath(value: string | null) {
  const fallback = '/account/profile';
  if (!value || value.includes('\\') || /[\u0000-\u001f]/.test(value)) return fallback;
  if (!value.startsWith('/') || value.startsWith('//')) return fallback;

  // Resolving against a fixed origin lets us prove the target stays on this site
  // (this also rejects encoded slashes, backslashes and scheme-relative URLs).
  const resolved = new URL(value, 'https://pizza-station-1800.invalid');
  if (resolved.origin !== 'https://pizza-station-1800.invalid') return fallback;
  return `${resolved.pathname}${resolved.search}${resolved.hash}`;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const code = params.get('code');
  const tokenHash = params.get('token_hash');
  const otpType = params.get('type');
  const requestedNext = params.get('next');
  const nextPath = safeNextPath(requestedNext);

  if (!code && !tokenHash) {
    return NextResponse.redirect(new URL('/account/login?error=callback', request.url));
  }

  const supabase = await createSupabaseServerClient();

  if (tokenHash) {
    if (!otpType || !OTP_TYPES.has(otpType)) {
      return NextResponse.redirect(new URL('/account/login?error=callback', request.url));
    }
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: otpType as EmailOtpType,
    });
    if (error) {
      console.error('Email verification failed:', error.code ?? 'unknown code');
      return NextResponse.redirect(new URL('/account/verify-email?error=1', request.url));
    }
    const destination = requestedNext
      ? nextPath
      : otpType === 'recovery'
        ? '/account/reset-password'
        : '/account/verify-email?verified=1';
    return NextResponse.redirect(new URL(destination, request.url));
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code!);
  if (error) {
    console.error('Auth callback failed:', error.code ?? 'unknown code');
    return NextResponse.redirect(new URL('/account/login?error=callback', request.url));
  }
  return NextResponse.redirect(new URL(nextPath, request.url));
}
