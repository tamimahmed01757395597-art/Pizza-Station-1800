'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  BarChart3, ChefHat, CircleDollarSign, ClipboardList, CookingPot, LayoutDashboard,
  LogOut, Menu, Package, Percent, Settings, Shield, Truck, Users, Utensils, X,
} from 'lucide-react';
import { z } from 'zod';
import { ADMIN_BASE_PATH, adminPath } from '@/lib/admin-path';
import { canOpenAdminSection } from '@/lib/admin-access';

const sessionSchema = z.object({
  profile: z.object({ role: z.string(), full_name: z.string(), email: z.string() }),
  permissions: z.array(z.string()),
});

const links = [
  { href: adminPath(), label: 'Overview', icon: LayoutDashboard, access: 'overview' },
  { href: adminPath('orders'), label: 'Live orders', icon: ClipboardList, access: 'orders' },
  { href: adminPath('dine-in'), label: 'Live dine-in orders', icon: Utensils, access: 'orders' },
  { href: adminPath('kitchen'), label: 'Kitchen display', icon: ChefHat, access: 'kitchen' },
  { href: adminPath('tables'), label: 'Tables & QR', icon: Utensils, access: 'tables' },
  { href: adminPath('menu'), label: 'Menu management', icon: CookingPot, access: 'menu' },
  { href: adminPath('inventory'), label: 'Inventory', icon: Package, access: 'inventory' },
  { href: adminPath('customers'), label: 'Customers', icon: Users, access: 'customers' },
  { href: adminPath('promotions'), label: 'Promotions', icon: Percent, access: 'promotions' },
  { href: adminPath('delivery'), label: 'Delivery', icon: Truck, access: 'delivery' },
  { href: adminPath('payments'), label: 'Cash payments', icon: CircleDollarSign, access: 'payments' },
  { href: adminPath('staff'), label: 'Staff & permissions', icon: Shield, access: 'staff' },
  { href: adminPath('reports'), label: 'Reports', icon: BarChart3, access: 'reports' },
  { href: adminPath('settings'), label: 'Settings', icon: Settings, access: 'settings' },
];

function AdminNavigation({ onNavigate, role, permissions }: { onNavigate?: () => void; role: string; permissions: string[] }) {
  const pathname = usePathname();
  return (
    <nav className="grid gap-1">
      {links.filter((item) => canOpenAdminSection(role, permissions, item.access)).map(({ href, label, icon: Icon }) => {
        const active = pathname === href || (href !== ADMIN_BASE_PATH && pathname.startsWith(`${href}/`));
        return (
          <Link
            href={href}
            key={href}
            onClick={onNavigate}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${active ? 'bg-[#c9342e] text-white shadow-lg shadow-red-950/30' : 'text-[#b9b5ad] hover:bg-white/5 hover:text-white'}`}
          >
            <Icon size={17} strokeWidth={1.8} />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [profile, setProfile] = useState<{ role: string; full_name: string; email: string } | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let active = true;
    fetch('/api/admin/session', { cache: 'no-store' })
      .then(async (response) => {
        const result: unknown = await response.json();
        if (!response.ok) {
          const parsed = z.object({ error: z.string() }).safeParse(result);
          throw new Error(parsed.success ? parsed.data.error : 'Staff access could not be verified.');
        }
        const parsed = sessionSchema.safeParse(result);
        if (!parsed.success) throw new Error('Staff access response was invalid.');
        if (active) {
          setProfile(parsed.data.profile);
          setPermissions(parsed.data.permissions);
        }
      })
      .catch((sessionError: unknown) => {
        if (active) setError(sessionError instanceof Error ? sessionError.message : 'Staff access could not be verified.');
      });
    return () => { active = false; };
  }, []);

  async function signOut() {
    setSigningOut(true);
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (!response.ok) throw new Error('Unable to sign out.');
      router.replace(adminPath('login'));
      router.refresh();
    } catch (signOutError) {
      setError(signOutError instanceof Error ? signOutError.message : 'Unable to sign out.');
      setSigningOut(false);
    }
  }

  if (pathname === adminPath('login')) return <>{children}</>;

  return (
    <div className="min-h-[75vh] bg-[#0c0c0c] text-[#f4f0e7]">
      <div className="mx-auto flex max-w-[1680px]">
        <aside className="sticky top-0 hidden h-screen w-[260px] shrink-0 border-r border-white/10 bg-[#111110] p-5 md:block">
          <Link href={ADMIN_BASE_PATH} className="mb-9 block">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#e7b84b]">Pizza Station</p>
            <p className="mt-1 text-xl font-semibold">Control room</p>
          </Link>
          <AdminNavigation role={profile?.role ?? ''} permissions={permissions} />
          <div className="absolute inset-x-5 bottom-5 border-t border-white/10 pt-4">
            <p className="truncate text-sm font-medium">{profile?.full_name || 'Staff account'}</p>
            <p className="mt-1 truncate text-xs text-[#8f8b82]">{profile?.role || 'Checking access…'}</p>
            <button type="button" onClick={signOut} disabled={signingOut} className="mt-4 flex items-center gap-2 text-sm text-[#d1ccc1] hover:text-white disabled:opacity-50">
              <LogOut size={15} />{signingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </aside>
        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-white/10 bg-[#111110]/95 px-4 backdrop-blur md:px-8">
            <button type="button" onClick={() => setMobileOpen((open) => !open)} className="rounded-lg border border-white/10 p-2 md:hidden" aria-label="Toggle admin navigation">
              {mobileOpen ? <X size={19} /> : <Menu size={19} />}
            </button>
            <p className="hidden text-sm font-medium text-[#d6d1c7] md:block">{links.find((item) => item.href === pathname)?.label ?? 'Pizza Station Admin'}</p>
            <p className="ml-auto truncate pl-3 text-xs text-[#aaa69a]">{profile?.email || 'Secure staff workspace'}</p>
          </header>
          {mobileOpen && (
            <div className="fixed inset-0 z-40 bg-black/70 md:hidden" onClick={() => setMobileOpen(false)}>
              <aside className="h-full w-[290px] overflow-y-auto border-r border-white/10 bg-[#111110] p-5" onClick={(event) => event.stopPropagation()}>
                <Link href={ADMIN_BASE_PATH} onClick={() => setMobileOpen(false)} className="mb-6 block text-lg font-semibold">Pizza Station</Link>
                <AdminNavigation onNavigate={() => setMobileOpen(false)} role={profile?.role ?? ''} permissions={permissions} />
              </aside>
            </div>
          )}
          {error && <p role="alert" className="mx-4 mt-4 rounded-lg border border-[#ef8a7d]/30 bg-[#ef8a7d]/10 p-3 text-sm text-[#ef8a7d] md:mx-8">{error}</p>}
          {children}
        </div>
      </div>
    </div>
  );
}
