
import { Button } from "@/components/ui/button";

interface DeviceBulkActionsProps {
  selectedCount: number;
  onDelete: () => void;
}

export function DeviceBulkActions({
  selectedCount,
  onDelete
}: DeviceBulkActionsProps) {
  return (
    <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
      <span className="text-sm font-medium">{selectedCount} cihaz seçildi</span>
      <Button
        variant="destructive"
        onClick={onDelete}
      >
        Seçilenleri Sil
      </Button>
    </div>
  );
}
