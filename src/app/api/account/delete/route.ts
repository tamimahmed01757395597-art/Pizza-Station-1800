import { NextResponse } from 'next/server';
import { ApiError, apiError, enforceRateLimit, getProfileRole, requireUser } from '@/lib/api';

export async function DELETE() {
  try {
    const { supabase, user } = await requireUser();
    enforceRateLimit(`account-delete:${user.id}`, 2, 60 * 60_000);
    const role = await getProfileRole(supabase, user.id);
    if (role !== 'customer') {
      throw new ApiError(403, 'Staff accounts must be removed by an administrator.');
    }
    const { error } = await supabase.rpc('delete_own_account');
    if (error) {
      console.error('Account deletion failed:', error.code ?? 'unknown code');
      throw new ApiError(400, 'We could not delete your account. Please contact support.');
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
