import { Button } from "@/components/ui/button";
export function SaveBar({ dirty, saving = false, onSave, onCancel }: { dirty: boolean; saving?: boolean; onSave: () => void; onCancel: () => void }) {
  if (!dirty) return null;
  return <div role="region" aria-label="Kaydedilmemiş değişiklikler" className="sticky bottom-0 z-10 flex flex-wrap items-center justify-end gap-3 border-t bg-surface px-4 py-3">
    <span role="status" className="mr-auto text-xs text-muted-foreground">Kaydedilmemiş değişiklikler var</span>
    <Button type="button" variant="outline" disabled={saving} onClick={onCancel}>Vazgeç</Button><Button type="button" disabled={saving} onClick={onSave}>{saving ? "Kaydediliyor…" : "Kaydet"}</Button>
  </div>;
}
