import { NextResponse } from 'next/server';
import { z, ZodError, type ZodType } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export function requireUuid(value: string) {
  const parsed = z.string().uuid().safeParse(value);
  if (!parsed.success) throw new ApiError(400, 'A valid resource ID is required.');
  return parsed.data;
}

export async function parseJson<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ApiError(400, 'Request body must be valid JSON.');
  }
  return schema.parse(body);
}

export async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error && error.status !== 401 && error.name !== 'AuthSessionMissingError') throw error;
  if (error || !user) throw new ApiError(401, 'Authentication required.');
  return { supabase, user };
}

export async function requireRole(roles: string[]) {
  const { supabase, user } = await requireUser();
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  if (error) throw error;
  if (!profile || !roles.includes(profile.role)) {
    throw new ApiError(403, 'You are not authorized to perform this action.');
  }
  return { supabase, user, role: profile.role };
}

export function apiError(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof ZodError) {
    return NextResponse.json({ error: 'Invalid request.', details: error.flatten() }, { status: 400 });
  }
  console.error('API request failed:', error);
  return NextResponse.json({ error: 'An unexpected server error occurred.' }, { status: 500 });
}

export function databaseError(error: { message: string; code?: string }) {
  console.error('Supabase request failed:', error.code, error.message);
  return NextResponse.json({ error: 'The database request could not be completed.' }, { status: 500 });
}
