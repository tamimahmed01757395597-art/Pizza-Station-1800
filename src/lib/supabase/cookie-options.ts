/**
 * Shared session-cookie options for every Supabase server client.
 *
 * `httpOnly` stays false because the browser Supabase client used for live
 * kitchen/dine-in realtime subscriptions must be able to read the session
 * cookie. All session tokens still travel over HTTPS in production and are
 * scoped to this site with SameSite=Lax.
 */
export const supabaseCookieOptions = {
  path: '/',
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 60 * 60 * 24 * 30,
  httpOnly: false,
} as const;
