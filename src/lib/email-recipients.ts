import { getProfileRole } from '@/lib/api';
import { checkRateLimit } from '@/lib/rate-limit';
import type { createSupabaseServerClient } from '@/lib/supabase/server';

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

// Staff who handle phone/counter orders may send to the address on that order.
// Kitchen and delivery accounts do not need this capability.
const ORDER_EMAIL_STAFF_ROLES = new Set(['admin', 'manager', 'cashier']);
const EMAIL_LIMIT = 5;
const EMAIL_WINDOW_MS = 15 * 60_000;

function emailAllowed(recipient: string) {
  // Never fail the order itself because the optional email cap was reached.
  return checkRateLimit(`order-email:${recipient}`, EMAIL_LIMIT, EMAIL_WINDOW_MS).allowed;
}

/**
 * Order confirmations must not turn the restaurant domain into an open relay.
 * Guests receive no email; signed-in customers only receive it at their own
 * verified address. Eligible staff may send to the address on the order they
 * are handling (for example a phone order taken at the counter).
 */
export async function verifiedOrderRecipient(supabase: ServerClient, orderEmail: string): Promise<string | null> {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user?.email || !user.email_confirmed_at) return null;

  const role = await getProfileRole(supabase, user.id);
  const recipient = (role && ORDER_EMAIL_STAFF_ROLES.has(role) ? orderEmail : user.email).trim().toLowerCase();
  if (!recipient || !emailAllowed(recipient)) return null;
  return recipient;
}

/**
 * Status notifications go only to orders tied to a registered customer.
 * New authenticated orders store the verified auth email rather than the
 * submitted address, so this cannot be redirected to a third party (F4).
 * Anonymous orders deliberately receive no outbound email.
 */
export function statusEmailRecipient(order: { customer_id: string | null; customer_email: string | null }) {
  const recipient = order.customer_email?.trim().toLowerCase();
  if (!order.customer_id || !recipient || !emailAllowed(recipient)) return null;
  return recipient;
}
