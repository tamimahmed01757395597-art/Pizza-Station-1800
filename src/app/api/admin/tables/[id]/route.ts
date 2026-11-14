import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiError, parseJson, requireUuid } from '@/lib/api';
import { createTableQrToken } from '@/lib/table-qr-token';
import { requireTableManagement, tableRpcError } from '@/lib/table-management';

type Context = { params: Promise<{ id: string }> };
const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('edit'), label: z.string().trim().min(1).max(80), section: z.string().trim().max(80).optional(), capacity: z.number().int().min(1).max(100).nullable().optional() }).strict(),
  z.object({ action: z.literal('activate') }).strict(),
  z.object({ action: z.literal('deactivate') }).strict(),
  z.object({ action: z.literal('rotate_qr') }).strict(),
  z.object({ action: z.literal('open_session') }).strict(),
  z.object({ action: z.literal('close_session'), session_id: z.string().uuid() }).strict(),
]);
const tableResponseSchema = z.object({
  id: z.string().uuid(),
  label: z.string(),
  is_active: z.boolean().optional(),
});

export async function PATCH(request: Request, { params }: Context) {
  try {
    const id = requireUuid((await params).id);
    const body = await parseJson(request, actionSchema);
    const { supabase } = await requireTableManagement();

    if (body.action === 'open_session') {
      const { data, error } = await supabase.rpc('open_table_session', { p_restaurant_table_id: id });
      if (error) throw tableRpcError(error);
      if (typeof data !== 'string' || !z.string().uuid().safeParse(data).success) {
        console.error('Open table session returned an invalid session ID:', data);
        return NextResponse.json({ error: 'Unable to open the table session.' }, { status: 500 });
      }
      return NextResponse.json({ session_id: data });
    }

    if (body.action === 'close_session') {
      const { error } = await supabase.rpc('close_table_session', { p_table_session_id: body.session_id });
      if (error) throw tableRpcError(error);
      return NextResponse.json({ success: true });
    }

    if (body.action === 'edit') {
      const { data, error } = await supabase.rpc('admin_update_restaurant_table', {
        p_restaurant_table_id: id,
        p_label: body.label,
        p_section: body.section ?? null,
        p_capacity: body.capacity ?? null,
      });
      if (error) throw tableRpcError(error);
      const parsed = tableResponseSchema.safeParse(data);
      if (!parsed.success) {
        console.error('Table update returned an invalid response:', parsed.error);
        return NextResponse.json({ error: 'Unable to save table details.' }, { status: 500 });
      }
      return NextResponse.json({ table: parsed.data });
    }

    if (body.action === 'rotate_qr') {
      const token = createTableQrToken();
      const { data, error } = await supabase.rpc('admin_rotate_restaurant_table_qr', {
        p_restaurant_table_id: id,
        p_raw_token: token,
      });
      if (error) throw tableRpcError(error);
      const parsed = tableResponseSchema.safeParse(data);
      if (!parsed.success) {
        console.error('QR rotation returned an invalid response:', parsed.error);
        return NextResponse.json({ error: 'The QR was rotated, but its response was invalid. Rotate again to print it.' }, { status: 500 });
      }
      return NextResponse.json({ table: parsed.data, token });
    }

    const { data, error } = await supabase.rpc('admin_set_restaurant_table_active', {
      p_restaurant_table_id: id,
      p_is_active: body.action === 'activate',
    });
    if (error) throw tableRpcError(error);
    const parsed = tableResponseSchema.safeParse(data);
    if (!parsed.success) {
      console.error('Table status update returned an invalid response:', parsed.error);
      return NextResponse.json({ error: 'Unable to update the table status.' }, { status: 500 });
    }
    return NextResponse.json({ table: parsed.data });
  } catch (error) {
    return apiError(error);
  }
}
