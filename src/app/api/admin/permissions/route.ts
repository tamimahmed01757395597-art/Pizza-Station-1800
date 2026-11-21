import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiError, parseJson, requireRole } from '@/lib/api';

const grantSchema = z.object({
  profile_id: z.string().uuid(),
  permission_key: z.enum(['orders.manage', 'kitchen.manage', 'delivery.update', 'tables.manage', 'payments.confirm', 'inventory.manage']),
}).strict();

export async function GET() {
  try {
    const { supabase } = await requireRole(['admin']);
    const { data, error } = await supabase.from('staff_permissions')
      .select('id,profile_id,permission_key,granted_at')
      .is('revoked_at', null)
      .order('granted_at', { ascending: false }).limit(1000);
    if (error) throw error;
    return NextResponse.json({ permissions: data });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await parseJson(request, grantSchema);
    const { supabase, user } = await requireRole(['admin']);
    const { data: target, error: targetError } = await supabase.from('profiles')
      .select('id,role').eq('id', body.profile_id).maybeSingle();
    if (targetError) throw targetError;
    if (!target || target.role === 'customer') {
      return NextResponse.json({ error: 'Permissions can only be granted to a staff profile.' }, { status: 400 });
    }
    const { data: existing, error: lookupError } = await supabase.from('staff_permissions')
      .select('id').eq('profile_id', body.profile_id).eq('permission_key', body.permission_key)
      .is('revoked_at', null).maybeSingle();
    if (lookupError) throw lookupError;
    if (existing) return NextResponse.json({ error: 'This permission is already active.' }, { status: 409 });
    const { data, error } = await supabase.from('staff_permissions')
      .insert({ ...body, granted_by: user.id }).select('id,profile_id,permission_key,granted_at').single();
    if (error) throw error;
    return NextResponse.json({ permission: data }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
