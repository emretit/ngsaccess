export function readHiddenColumns(slug: string): string[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const saved: unknown = JSON.parse(localStorage.getItem(`reports.columns.${slug}`) ?? '[]');
    return Array.isArray(saved) ? saved.filter((key): key is string => typeof key === 'string') : [];
  } catch { return []; }
}
export function toggleHiddenColumn(hidden: readonly string[], key: string, defaultVisible = true): string[] {
  const marker = defaultVisible ? key : `show:${key}`;
  return hidden.includes(marker) ? hidden.filter(value => value !== marker) : [...hidden, marker];
}
export function saveHiddenColumns(slug: string, hidden: readonly string[]): void {
  try { localStorage.setItem(`reports.columns.${slug}`, JSON.stringify(hidden)); } catch { /* Private mode or full storage: selection remains available for this visit. */ }
}
