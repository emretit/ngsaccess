import { ConfirmDestructive } from "@/components/shared/ConfirmDestructive";
interface DeviceDeleteDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  deviceName?: string;
  deviceNames?: string[];
  onConfirm: () => Promise<unknown> | void;
}
export function DeviceDeleteDialog({ isOpen, onOpenChange, selectedCount, deviceName, deviceNames, onConfirm }: DeviceDeleteDialogProps) {
  return <ConfirmDestructive open={isOpen} onOpenChange={onOpenChange}
    title="Cihazları sil" objectName={deviceName ?? deviceNames?.join(", ") ?? `${selectedCount} cihaz`}
    effects={["Kapılar, okuyucular ve erişim grubu bağlantıları silinir.", "Cihaza ait yerel bridge iş kuyruğu kaldırılır.", "Kart okuma geçmişi korunur.", "Bu işlem geri alınamaz."]}
    confirmLabel="Sil" onConfirm={async () => { await onConfirm(); }} />;
}
