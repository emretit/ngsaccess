
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface DeviceDeleteDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  deviceName?: string;
  deviceNames?: string[];
  onConfirm: () => void;
}

export function DeviceDeleteDialog({
  isOpen,
  onOpenChange,
  selectedCount,
  deviceName,
  deviceNames,
  onConfirm
}: DeviceDeleteDialogProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cihazları Sil</AlertDialogTitle>
          <AlertDialogDescription>
            {deviceName ? `"${deviceName}" cihazını` : deviceNames?.length ? `${deviceNames.join(", ")} (${selectedCount} cihaz)` : `${selectedCount} cihazı`} silmek istediğinize emin misiniz? Kapı ve okuyucu tanımları ile erişim grubu bağlantıları silinir, geçmiş kart okumaları korunur. Bu işlem geri alınamaz.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>İptal</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            Sil
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
