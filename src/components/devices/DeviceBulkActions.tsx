import { Button } from "@/components/ui/button";
import { BulkBar } from "@/components/shared/BulkBar";
export function DeviceBulkActions({ selectedCount, onDelete, onClear }: { selectedCount: number; onDelete: () => void; onClear: () => void }) {
  return <BulkBar count={selectedCount} onClear={onClear}><Button variant="destructive" size="sm" onClick={onDelete}>Seçilenleri sil</Button></BulkBar>;
}
