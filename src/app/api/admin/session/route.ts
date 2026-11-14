import { NextResponse } from 'next/server';
import { apiError, requireUser } from '@/lib/api';

export async function GET() {
  try {
    const { supabase, user } = await requireUser();
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role,full_name,email')
      .eq('id', user.id)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile || profile.role === 'customer') {
      return NextResponse.json({ error: 'Staff access required.' }, { status: 403 });
    }

    const { data: permissions, error: permissionError } = await supabase
      .from('staff_permissions')
      .select('permission_key')
      .eq('profile_id', user.id)
      .is('revoked_at', null);
    if (permissionError) throw permissionError;
    return NextResponse.json({
      profile: {
        role: profile.role,
        full_name: profile.full_name,
        email: profile.email,
      },
      permissions: (permissions ?? []).map(({ permission_key }) => permission_key),
    });
  } catch (error) {
    return apiError(error);
  }
}
