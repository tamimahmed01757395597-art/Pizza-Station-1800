import { NextResponse } from 'next/server';
import { apiError, databaseError, parseJson, requireUser } from '@/lib/api';
import { profileUpdateSchema } from '@/lib/schemas';

export async function GET() {
  try {
    const { supabase, user } = await requireUser();
    const { data, error } = await supabase
      .from('profiles')
      .select('email,full_name,phone,onboarding_completed')
      .eq('id', user.id)
      .maybeSingle();
    if (error) return databaseError(error);
    if (!data) return NextResponse.json({ error: 'Your profile could not be found.' }, { status: 404 });
    const { data: { user: freshUser } } = await supabase.auth.getUser();
    return NextResponse.json({
      profile: {
        ...data,
        email_verified: Boolean(freshUser?.email_confirmed_at),
        onboarding_completed: Boolean((data as { onboarding_completed?: boolean }).onboarding_completed),
      },
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await parseJson(request, profileUpdateSchema);
    const { supabase, user } = await requireUser();
    const { data, error } = await supabase
      .from('profiles')
      .update(body)
      .eq('id', user.id)
      .select('email,full_name,phone,onboarding_completed')
      .single();
    if (error) return databaseError(error);
    const { data: { user: freshUser } } = await supabase.auth.getUser();
    return NextResponse.json({
      profile: {
        ...data,
        email_verified: Boolean(freshUser?.email_confirmed_at),
        onboarding_completed: Boolean((data as { onboarding_completed?: boolean }).onboarding_completed),
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
