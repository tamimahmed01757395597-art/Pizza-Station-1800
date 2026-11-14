import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiError, requireRole } from '@/lib/api';

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) {
      return NextResponse.json({ error: 'A valid permission ID is required.' }, { status: 400 });
    }
    const { supabase, user } = await requireRole(['admin']);
    const { data, error } = await supabase.from('staff_permissions')
      .update({ revoked_by: user.id, revoked_at: new Date().toISOString() })
      .eq('id', id).is('revoked_at', null).select('id').maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Active permission was not found.' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
