import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { ADMIN_BASE_PATH } from '@/lib/admin-path';
import { checkRateLimit, clientIp } from '@/lib/rate-limit';
import { supabaseCookieOptions } from '@/lib/supabase/cookie-options';

const RATE_LIMIT_RULES = [
  { name: 'auth-login', pattern: /^\/api\/auth\/login$/, limit: 10, windowMs: 10 * 60_000 },
  { name: 'auth-register', pattern: /^\/api\/auth\/register$/, limit: 5, windowMs: 30 * 60_000 },
  { name: 'auth-reset', pattern: /^\/api\/auth\/password-reset$/, limit: 5, windowMs: 15 * 60_000 },
  { name: 'auth-password', pattern: /^\/api\/auth\/password$/, method: 'PATCH', limit: 5, windowMs: 15 * 60_000 },
  { name: 'auth-resend', pattern: /^\/api\/auth\/resend-verification$/, limit: 3, windowMs: 15 * 60_000 },
  { name: 'account-delete', pattern: /^\/api\/account\/delete$/, limit: 2, windowMs: 60 * 60_000 },
  { name: 'admin-write', pattern: /^\/api\/admin\//, limit: 120, windowMs: 60_000 },
  { name: 'orders-create', pattern: /^\/api\/orders$/, method: 'POST', limit: 20, windowMs: 60_000 },
  { name: 'table-resolve', pattern: /^\/api\/tables\/resolve$/, limit: 60, windowMs: 60_000 },
  { name: 'table-orders', pattern: /^\/api\/table-orders\//, limit: 120, windowMs: 60_000 },
  { name: 'image-upload', pattern: /^\/api\/admin\/product-images$/, limit: 20, windowMs: 10 * 60_000 },
];
const DEFAULT_RATE_LIMIT = { name: 'api', limit: 300, windowMs: 60_000 };

function httpOrigin(value: string | undefined) {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.origin : null;
  } catch {
    return null;
  }
}

const supabaseHttpOrigin = httpOrigin(process.env.NEXT_PUBLIC_SUPABASE_URL);
const supabaseRealtimeOrigin = supabaseHttpOrigin?.replace(/^https?:/, 'wss:') ?? null;
const sentryOrigin = httpOrigin(process.env.NEXT_PUBLIC_SENTRY_DSN);
const defined = (values: Array<string | null>) => values.filter((value): value is string => Boolean(value)).join(' ');

// Explicit allow-list: inline scripts only via the per-request nonce, and no
// unsafe-inline/unsafe-eval for scripts. Origins come from configuration where
// the deployment can change them, otherwise from the app's actual integrations.
const contentSecurityPolicy = (nonce: string) => [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  `script-src 'self' 'nonce-${nonce}' https://www.googletagmanager.com`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  `img-src ${defined([
    "'self'",
    'data:',
    'blob:',
    supabaseHttpOrigin,
    'https://images.unsplash.com',
    'https://www.google.com',
  ])}`,
  `connect-src ${defined([
    "'self'",
    supabaseHttpOrigin,
    supabaseRealtimeOrigin,
    sentryOrigin,
    'https://www.googletagmanager.com',
    'https://www.google-analytics.com',
    'https://analytics.google.com',
  ])}`,
  "frame-src https://www.google.com https://www.google.com/maps",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
].join('; ');

function createNonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

function withCsp(response: NextResponse, nonce: string) {
  response.headers.set('Content-Security-Policy', contentSecurityPolicy(nonce));
  response.headers.set('X-Content-Type-Options', 'nosniff');
  return response;
}

function isSameOriginMutation(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (origin && origin !== request.nextUrl.origin) return false;
  if (request.headers.get('sec-fetch-site') === 'cross-origin') return false;
  return true;
}

function rateLimited(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const rule = RATE_LIMIT_RULES.find((entry) => entry.pattern.test(path)
    && (!entry.method || entry.method === request.method)) ?? DEFAULT_RATE_LIMIT;
  const result = checkRateLimit(`${clientIp(request)}:${rule.name}:${path}`, rule.limit, rule.windowMs);
  const headers = {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
  };
  if (!result.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: { ...headers, 'Retry-After': String(result.retryAfter) } },
    );
  }
  return { headers };
}

const GUARDED_PATHS = [
  '/account/profile',
  '/account/addresses',
  '/account/orders',
  '/onboarding',
  '/station-console',
  ADMIN_BASE_PATH,
];

export async function middleware(request: NextRequest) {
  const nonce = createNonce();
  const requestHeaders = new Headers(request.headers);
  // Next.js picks this up and adds the nonce to all of its own inline scripts.
  requestHeaders.set('x-nonce', nonce);
  const path = request.nextUrl.pathname;

  if (path.startsWith('/api/')) {
    if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(request.method) && !isSameOriginMutation(request)) {
      return withCsp(NextResponse.json({ error: 'Cross-origin request rejected.' }, { status: 403 }), nonce);
    }
    const limit = rateLimited(request);
    if (limit instanceof NextResponse) return withCsp(limit, nonce);
    const apiResponse = NextResponse.next();
    Object.entries(limit.headers).forEach(([name, value]) => apiResponse.headers.set(name, value));
    return withCsp(apiResponse, nonce);
  }

  if (path === '/admin' || path.startsWith('/admin/')) {
    return withCsp(new NextResponse('Not Found', { status: 404 }), nonce);
  }

  const isGuarded = GUARDED_PATHS.some((base) => path === base || path.startsWith(`${base}/`));
  if (!isGuarded) {
    return withCsp(NextResponse.next({ request: { headers: requestHeaders } }), nonce);
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return withCsp(NextResponse.json({ error: 'Authentication service is not configured.' }, { status: 503 }), nonce);
  }

  const supabase = createServerClient(url, key, {
    cookieOptions: supabaseCookieOptions,
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
  if (path === `${ADMIN_BASE_PATH}/login`) return withCsp(response, nonce);
  if (error || !user) {
    const loginPath = path.startsWith(ADMIN_BASE_PATH) ? `${ADMIN_BASE_PATH}/login` : '/account/login';
    return withCsp(NextResponse.redirect(new URL(loginPath, request.url)), nonce);
  }
  if (path.startsWith(ADMIN_BASE_PATH)) {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();
    if (profileError || !profile || profile.role === 'customer') {
      return withCsp(NextResponse.redirect(new URL('/', request.url)), nonce);
    }
  }
  return withCsp(response, nonce);
}

export const config = {
  // CSP must cover every response, not only the authenticated routes.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
