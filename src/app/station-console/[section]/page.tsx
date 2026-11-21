import { notFound, redirect } from 'next/navigation';
import { AdminWorkspace } from '@/components/admin-workspace';
import { accessForSection, canOpenAdminSection, permissionForAccess } from '@/lib/admin-access';
import { ADMIN_BASE_PATH } from '@/lib/admin-path';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export default async function AdminSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const access = accessForSection(section);
  if (!access) notFound();

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`${ADMIN_BASE_PATH}/login`);

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  if (!profile || profile.role === 'customer') redirect('/');

  // Navigation is hidden client-side for unauthorized sections; verify it here
  // too so a direct URL cannot bypass the UI restriction.
  const permission = permissionForAccess(access);
  let permissions: string[] = [];
  if (permission) {
    const { data: allowed } = await supabase.rpc('has_staff_permission', { p_permission_key: permission });
    permissions = allowed ? [permission] : [];
  }
  if (!canOpenAdminSection(profile.role, permissions, access)) redirect(ADMIN_BASE_PATH);

  return <AdminWorkspace section={section} />;
}
