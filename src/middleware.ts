import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.json({ error: 'Authentication service is not configured.' }, { status: 503 });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        });
      },
    },
  });
  const { data: { user }, error } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  if (path === '/admin/login') return response;
  if (error || !user) {
    const loginPath = path.startsWith('/admin') ? '/admin/login' : '/account/login';
    return NextResponse.redirect(new URL(loginPath, request.url));
  }
  if (path.startsWith('/admin')) {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();
    if (profileError || !profile || profile.role === 'customer') {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }
  return response;
}

export const config = {
  matcher: ['/account/profile/:path*', '/account/addresses/:path*', '/account/orders/:path*', '/admin/:path*'],
};
