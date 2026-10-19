import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { routeMeta } from './routeMeta';
import { ACTIVE_PROJECT_KEY, APP_THEME_PREFIXES, THEME_CACHE_KEY, THEME_CACHE_MAX_AGE, THEME_SCOPE_KEY, clearThemeScope, readThemeCache, writeThemeCache } from './themeBootstrap';

const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const inline = html.match(/<script id="theme-bootstrap">([\s\S]*?)<\/script>/)?.[1];
function storage() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
}
const scope = { v: 1 as const, userId: 'user-a', projectId: 'project-a' };
function seeded() {
  const store = storage();
  store.setItem(ACTIVE_PROJECT_KEY, scope.projectId);
  writeThemeCache(store, scope, true);
  return store;
}
function boot(store: ReturnType<typeof storage>, pathname: string) {
  let dark = false;
  if (!inline) throw new Error('Missing inline bootstrap');
  runInNewContext(inline, { localStorage: store, location: { pathname }, document: { documentElement: { classList: { add: () => { dark = true; } } } } });
  return dark;
}

describe('pre-paint theme cache', () => {
  it('matches the route metadata and the actual inline route allowlist', () => {
    expect([...APP_THEME_PREFIXES].sort()).toEqual(routeMeta.map(route => route.href).sort());
    const copiedPrefixes = inline?.match(/const prefixes = (\[[^;]+\]);/)?.[1];
    expect(copiedPrefixes).toBeDefined();
    expect(runInNewContext(copiedPrefixes ?? '[]')).toEqual([...APP_THEME_PREFIXES]);
    for (const route of routeMeta) {
      expect(boot(seeded(), route.href)).toBe(true);
      expect(boot(seeded(), `${route.href}/details`)).toBe(true);
    }
  });
  it('applies a matching scoped hint and persists authoritative false', () => {
    const store = seeded();
    expect(readThemeCache(store, '/home')?.dark).toBe(true);
    expect(boot(store, '/home')).toBe(true);
    writeThemeCache(store, scope, false);
    expect(readThemeCache(store, '/home')?.dark).toBe(false);
    expect(boot(store, '/home')).toBe(false);
  });
  it.each(['/','/login','/register','/check-in','/unknown','/home-other'])('keeps public/unknown path %s light', path => {
    expect(readThemeCache(seeded(), path)).toBeNull();
    expect(boot(seeded(), path)).toBe(false);
  });
  it.each(['userId', 'projectId'] as const)('rejects mismatched %s', field => {
    const store = seeded();
    store.setItem(THEME_SCOPE_KEY, JSON.stringify({ ...scope, [field]: 'other' }));
    expect(readThemeCache(store, '/home')).toBeNull();
    expect(boot(store, '/home')).toBe(false);
  });
  it('rejects a separately selected project and a cleared session marker', () => {
    const store = seeded();
    store.setItem(ACTIVE_PROJECT_KEY, 'other');
    expect(readThemeCache(store, '/home')).toBeNull();
    expect(boot(store, '/home')).toBe(false);
    store.setItem(ACTIVE_PROJECT_KEY, scope.projectId);
    clearThemeScope(store);
    expect(readThemeCache(store, '/home')).toBeNull();
    expect(boot(store, '/home')).toBe(false);
  });
  it.each([THEME_CACHE_KEY, THEME_SCOPE_KEY])('ignores malformed JSON at %s', key => {
    const store = seeded();
    store.setItem(key, '{broken');
    expect(readThemeCache(store, '/home')).toBeNull();
    expect(boot(store, '/home')).toBe(false);
  });
  it.each([
    { v: 2 }, { dark: 'true' }, { at: '123' }, { at: Date.now() + 86400000 },
    { at: Date.now() - THEME_CACHE_MAX_AGE - 1000 }, { userId: '' }, { projectId: '' },
  ])('rejects invalid/expired cache %j', change => {
    const store = seeded();
    store.setItem(THEME_CACHE_KEY, JSON.stringify({ ...scope, dark: true, at: Date.now(), ...change }));
    expect(readThemeCache(store, '/home')).toBeNull();
    expect(boot(store, '/home')).toBe(false);
  });
  it('tolerates disabled storage', () => {
    const store = storage();
    store.getItem = () => { throw new Error('Storage disabled'); };
    expect(readThemeCache(store, '/home')).toBeNull();
    expect(boot(store, '/home')).toBe(false);
  });
});
