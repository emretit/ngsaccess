export interface ColumnScope { projectId: string; userId: string }
export function columnStorageKey(slug: string, scope: ColumnScope): string { return `reports.columns.${scope.projectId}.${scope.userId}.${slug}`; }
export function readHiddenColumns(slug: string, scope?: ColumnScope): string[] {
  try {
    if (!scope || typeof localStorage === 'undefined') return [];
    const saved: unknown = JSON.parse(localStorage.getItem(columnStorageKey(slug, scope)) ?? '[]');
    return Array.isArray(saved) ? saved.filter((key): key is string => typeof key === 'string') : [];
  } catch { return []; }
}
export function toggleHiddenColumn(hidden: readonly string[], key: string, defaultVisible = true): string[] {
  const marker = defaultVisible ? key : `show:${key}`;
  return hidden.includes(marker) ? hidden.filter(value => value !== marker) : [...hidden, marker];
}
export function saveHiddenColumns(slug: string, hidden: readonly string[], scope?: ColumnScope): void {
  if (!scope) return;
  try { localStorage.setItem(columnStorageKey(slug, scope), JSON.stringify(hidden)); } catch { /* Private mode or full storage: selection remains available for this visit. */ }
}
