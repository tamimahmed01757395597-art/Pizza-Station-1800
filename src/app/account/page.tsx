import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export default async function AccountEntryPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error && error.name !== 'AuthSessionMissingError') {
    console.error('Account session lookup failed:', error.message);
  }
  redirect(user ? '/account/profile' : '/account/login');
}
