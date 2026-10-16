import { ConfirmDestructive } from "@/components/shared/ConfirmDestructive";
import type { User } from "../types/user-types";
export function DeleteUserDialog({ isOpen, onClose, user, onDelete }: {
  isOpen: boolean; onClose: () => void; user: User | null; onDelete: () => Promise<unknown>;
}) {
  return <ConfirmDestructive open={isOpen} onOpenChange={open => { if (!open) onClose(); }} title="Kullanıcı silinsin mi?" objectName={user?.email ?? "Kullanıcı"} effects={["Hesap ve kimlik doğrulama oturumları silinir.", "Tüm proje üyelikleri kaldırılır."]} confirmLabel="Kullanıcıyı sil" onConfirm={onDelete} />;
}
