import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiError, parseJson } from '@/lib/api';
import { createTableQrToken } from '@/lib/table-qr-token';
import { requireTableManagement, tableRpcError } from '@/lib/table-management';

const createTableSchema = z.object({
  label: z.string().trim().min(1).max(80),
  section: z.string().trim().max(80).optional(),
  capacity: z.number().int().min(1).max(100).nullable().optional(),
}).strict();
const tableResponseSchema = z.object({
  id: z.string().uuid(),
  label: z.string(),
  section: z.string().nullable().optional(),
  capacity: z.number().nullable().optional(),
  is_active: z.boolean(),
  created_at: z.string().optional(),
});

export async function GET() {
  try {
    const { supabase } = await requireTableManagement();
    const { data: tables, error: tableError } = await supabase.from('restaurant_tables')
      .select('id,label,section,capacity,is_active,created_at')
      .order('label').limit(500);
    if (tableError) throw tableError;

    const { data: sessions, error: sessionError } = await supabase.from('table_sessions')
      .select('id,restaurant_table_id,started_at,expires_at,ended_at')
      .is('ended_at', null).gt('expires_at', new Date().toISOString());
    if (sessionError) throw sessionError;

    return NextResponse.json({
      tables: (tables ?? []).map((table) => ({
        ...table,
        current_session: sessions?.find((session) => session.restaurant_table_id === table.id) ?? null,
      })),
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await parseJson(request, createTableSchema);
    const { supabase } = await requireTableManagement();
    const token = createTableQrToken();
    const { data, error } = await supabase.rpc('admin_create_restaurant_table', {
      p_label: body.label,
      p_section: body.section ?? null,
      p_capacity: body.capacity ?? null,
      p_raw_token: token,
    });
    if (error) throw tableRpcError(error);
    const parsed = tableResponseSchema.safeParse(data);
    if (!parsed.success) {
      console.error('Table creation returned an invalid response:', parsed.error);
      return NextResponse.json({ error: 'The table was created, but its response was invalid. Rotate its QR to print it.' }, { status: 500 });
    }
    return NextResponse.json({ table: parsed.data, token }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
