import { ConfirmDestructive } from "@/components/shared/ConfirmDestructive";
interface EmployeeDeleteDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  names?: string;
  onConfirm: () => Promise<unknown>;
}
export function EmployeeDeleteDialog({ isOpen, onOpenChange, selectedCount, names, onConfirm }: EmployeeDeleteDialogProps) {
  return <ConfirmDestructive open={isOpen} onOpenChange={onOpenChange} title="Personeller silinsin mi?"
    objectName={names || `${selectedCount} personel`} confirmLabel="Personelleri sil" onConfirm={onConfirm}
    effects={[`${selectedCount} personel ve vardiya atamaları kalıcı silinir.`, "Erişim üyelikleri, mobil giriş ve oturumlar kaldırılır; kişisel veriler temizlenir.", "Cihazlardan kaldırma kuyruğa alınır; cihaz teslimi bu işlemde doğrulanmaz."]} />;
}
