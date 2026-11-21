import { ApiError, requireUser } from '@/lib/api';

export async function requireTableManagement() {
  const context = await requireUser();
  const { data: profile, error: profileError } = await context.supabase.from('profiles')
    .select('role').eq('id', context.user.id).maybeSingle();
  if (profileError) throw profileError;
  if (!profile || profile.role === 'customer') {
    throw new ApiError(403, 'Staff access is required.');
  }
  const { data, error } = await context.supabase.rpc('can_manage_tables');
  if (error) throw error;
  if (data !== true) throw new ApiError(403, 'Table management permission required.');
  return { ...context, role: profile.role };
}

export function tableRpcError(error: { code?: string; message: string }) {
  if (error.code === '42501') return new ApiError(403, 'Table management permission required.');
  if (error.code === '22023') return new ApiError(400, error.message);
  if (error.code === '23505') return new ApiError(409, 'A table with that number already exists.');
  console.error('Table QR database operation failed:', error.code ?? 'unknown code');
  return new ApiError(500, 'The table operation could not be completed.');
}
