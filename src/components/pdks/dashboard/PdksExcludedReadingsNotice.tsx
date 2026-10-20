export function PdksExcludedReadingsNotice({ count }: { count?: number }) {
  if (!count || count <= 0) return null;
  return <span className="text-xs text-muted-foreground">{count} okuma PDKS dışı bırakıldı</span>;
}
