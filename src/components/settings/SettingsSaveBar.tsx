import { Button } from "@/components/ui/button";

/** Local adapter: shared SaveBar does not yet support section-specific labels or validation. */
export function SettingsSaveBar({ dirty, saving = false, valid = true, label, onCancel }: {
  dirty: boolean; saving?: boolean; valid?: boolean; label: string; onCancel: () => void;
}) {
  if (!dirty) return null;
  return <div role="region" aria-label="Kaydedilmemiş değişiklikler" className="flex flex-wrap items-center justify-end gap-3 border-t py-4">
    <span role="status" className="mr-auto text-xs text-muted-foreground">Kaydedilmemiş değişiklikler</span>
    <Button type="button" variant="outline" disabled={saving} onClick={onCancel}>Vazgeç</Button>
    <Button type="submit" disabled={saving || !valid} className="max-w-full whitespace-normal">{saving ? "Kaydediliyor…" : label}</Button>
  </div>;
}
