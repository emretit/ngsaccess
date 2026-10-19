/** Visual hint only: never use this cache for authorization. Origin-scoped by localStorage. */
export const THEME_CACHE_KEY = 'ngs.theme.v1';
export const THEME_SCOPE_KEY = 'ngs.theme.activeScope.v1';
export const ACTIVE_PROJECT_KEY = 'ngs.activeProjectId';
export const THEME_CACHE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
// Keep the tiny pre-CSS copy in index.html in sync; themeBootstrap.test.ts checks both.
export const APP_THEME_PREFIXES = [
  '/home', '/employees', '/devices', '/virtual-readers', '/access-control', '/visitors',
  '/live-monitoring', '/pdks-records', '/shifts', '/leaves', '/reports', '/audit-log', '/alarms',
  '/engineering-department', '/system-admin', '/settings', '/profile',
] as const;

export interface ThemeScope { v: 1; userId: string; projectId: string }
export interface ThemeCache extends ThemeScope { dark: boolean; at: number }
type ThemeStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function isAppThemePath(pathname: string): boolean {
  return APP_THEME_PREFIXES.some(prefix => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function isScope(value: unknown): value is ThemeScope {
  return typeof value === 'object' && value !== null && 'v' in value && value.v === 1 &&
    'userId' in value && typeof value.userId === 'string' && value.userId.length > 0 &&
    'projectId' in value && typeof value.projectId === 'string' && value.projectId.length > 0;
}

export function readThemeCache(storage: ThemeStorage, pathname: string, now = Date.now()): ThemeCache | null {
  try {
    if (!isAppThemePath(pathname)) return null;
    const scope: unknown = JSON.parse(storage.getItem(THEME_SCOPE_KEY) ?? 'null');
    const cache: unknown = JSON.parse(storage.getItem(THEME_CACHE_KEY) ?? 'null');
    if (!isScope(scope) || !isScope(cache) || scope.userId !== cache.userId ||
      scope.projectId !== cache.projectId || storage.getItem(ACTIVE_PROJECT_KEY) !== scope.projectId ||
      !('dark' in cache) || typeof cache.dark !== 'boolean' || !('at' in cache) ||
      typeof cache.at !== 'number' || !Number.isFinite(cache.at) || cache.at > now ||
      now - cache.at > THEME_CACHE_MAX_AGE) return null;
    return cache as ThemeCache;
  } catch { return null; }
}

export function clearThemeScope(storage: ThemeStorage): void {
  try { storage.removeItem(THEME_SCOPE_KEY); } catch { /* Storage can be disabled. */ }
}

export function writeThemeCache(storage: ThemeStorage, scope: ThemeScope, dark: boolean): void {
  try {
    storage.setItem(THEME_CACHE_KEY, JSON.stringify({ ...scope, dark, at: Date.now() }));
    storage.setItem(THEME_SCOPE_KEY, JSON.stringify(scope));
  } catch { clearThemeScope(storage); }
}
