import { NextResponse } from 'next/server';
import { apiError, enforceRateLimit, parseJson, requireUser } from '@/lib/api';
import { newPasswordSchema } from '@/lib/schemas';

export async function PATCH(request: Request) {
  try {
    const body = await parseJson(request, newPasswordSchema);
    const { supabase, user } = await requireUser();
    enforceRateLimit(`password-change:${user.id}`, 5, 15 * 60_000);
    const { error } = await supabase.auth.updateUser({ password: body.password });
    if (error) {
      console.error('Password update failed:', error.message);
      return NextResponse.json({ error: 'Unable to update password.' }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
