import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiError, ApiError, parseJson } from '@/lib/api';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const resolveSchema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
}).strict();
const resolveResponseSchema = z.object({ table_number: z.string().min(1).max(80) });

export async function POST(request: Request) {
  try {
    const { token } = await parseJson(request, resolveSchema);
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc('resolve_table_qr', { p_raw_token: token });
    if (error) {
      if (error.code === '22023') return NextResponse.json({ error: 'This table QR is invalid or is not accepting orders.' }, { status: 400 });
      console.error('Table QR validation failed:', error.code, error.message);
      return NextResponse.json({ error: 'Table validation is temporarily unavailable.' }, { status: 500 });
    }
    const parsed = resolveResponseSchema.safeParse(data);
    if (!parsed.success) {
      console.error('Table QR validation returned an invalid response:', parsed.error);
      throw new ApiError(500, 'Table validation is temporarily unavailable.');
    }
    return NextResponse.json(parsed.data);
  } catch (error) {
    return apiError(error);
  }
}
