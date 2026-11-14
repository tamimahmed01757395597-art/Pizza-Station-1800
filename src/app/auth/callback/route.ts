import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const requestedPath = request.nextUrl.searchParams.get('next') ?? '/account/profile';
  const nextPath = requestedPath.startsWith('/') && !requestedPath.startsWith('//')
    ? requestedPath
    : '/account/profile';
  if (!code) return NextResponse.redirect(new URL('/account/login?error=callback', request.url));
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error('Auth callback failed:', error.message);
    return NextResponse.redirect(new URL('/account/login?error=callback', request.url));
  }
  return NextResponse.redirect(new URL(nextPath, request.url));
}
