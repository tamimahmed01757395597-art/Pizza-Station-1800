import { NextResponse } from 'next/server';
import { ApiError, apiError, databaseError, enforceRateLimit, getProfileRole, parseJson, requireUser } from '@/lib/api';
import { onboardingSchema } from '@/lib/schemas';

export async function POST(request: Request) {
  try {
    const body = await parseJson(request, onboardingSchema);
    const { supabase, user } = await requireUser();
    enforceRateLimit(`onboarding:${user.id}`, 5, 60 * 60_000);
    const role = await getProfileRole(supabase, user.id);
    if (role !== 'customer') throw new ApiError(403, 'Onboarding is for customer accounts.');

    const { error: profileError } = await supabase.from('profiles').update({
      full_name: body.full_name,
      phone: body.phone ?? null,
      onboarding_completed: true,
    }).eq('id', user.id);
    if (profileError) return databaseError(profileError);

    if (body.address) {
      const { error: addressError } = await supabase.from('addresses').insert({
        customer_id: user.id,
        ...body.address,
      });
      if (addressError) return databaseError(addressError);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
