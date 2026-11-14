import { NextResponse } from 'next/server';
import { apiError, parseJson, requireUser } from '@/lib/api';
import { newPasswordSchema } from '@/lib/schemas';

export async function PATCH(request: Request) {
  try {
    const body = await parseJson(request, newPasswordSchema);
    const { supabase } = await requireUser();
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
