/**
 * Single source of truth for station-console section authorization.
 * Used by both the client navigation and the server-rendered section page.
 */

export const ADMIN_SECTION_ACCESS: Record<string, string> = {
  overview: 'overview',
  orders: 'orders',
  'dine-in': 'orders',
  kitchen: 'kitchen',
  tables: 'tables',
  menu: 'menu',
  inventory: 'inventory',
  customers: 'customers',
  promotions: 'promotions',
  delivery: 'delivery',
  payments: 'payments',
  staff: 'staff',
  reports: 'reports',
  settings: 'settings',
};

export const ACCESS_PERMISSIONS: Record<string, string> = {
  orders: 'orders.manage',
  kitchen: 'kitchen.manage',
  tables: 'tables.manage',
  inventory: 'inventory.manage',
  payments: 'payments.confirm',
};

export function accessForSection(section: string) {
  return ADMIN_SECTION_ACCESS[section] ?? null;
}

export function permissionForAccess(access: string) {
  return ACCESS_PERMISSIONS[access] ?? null;
}

export function canOpenAdminSection(role: string, permissions: string[], access: string) {
  if (role === 'admin') return true;
  if (role === 'manager') return !['staff', 'settings', 'customers'].includes(access);
  if (access === 'orders') return role === 'cashier' || permissions.includes('orders.manage');
  if (access === 'kitchen') return role === 'kitchen' || permissions.includes('kitchen.manage');
  if (access === 'payments') return role === 'cashier' && permissions.includes('payments.confirm');
  if (access === 'delivery') return role === 'delivery';
  if (access === 'tables') return permissions.includes('tables.manage');
  if (access === 'inventory') return permissions.includes('inventory.manage');
  return false;
}
