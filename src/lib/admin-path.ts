// Keep this value in sync with the admin route directory (src/app/station-console).
// The path is intentionally not linked from public pages.
export const ADMIN_BASE_PATH = '/station-console';

export function adminPath(path = '') {
  return path ? `${ADMIN_BASE_PATH}/${path.replace(/^\/+/, '')}` : ADMIN_BASE_PATH;
}
