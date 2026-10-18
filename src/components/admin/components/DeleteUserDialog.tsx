import { useState } from "react";
import { ConfirmDestructive } from "@/components/shared/ConfirmDestructive";
import { errorMessage, notify } from "@/lib/notify";
import { useAdminFormGuard } from "../hooks/useAdminFormGuard";
import { userName, type User } from "../types/user-types";
export function DeleteUserDialog({
  isOpen,
  onClose,
  user,
  onDelete,
}: {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  onDelete: () => Promise<unknown>;
}) {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState<{ id: string; message: string }>();
  useAdminFormGuard("admin-user-delete", false, pending);
  return (
    <ConfirmDestructive
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Kullanıcı silinsin mi?"
      objectName={
        user ? `${userName(user)} · ${user.email ?? ""}` : "Kullanıcı"
      }
      effects={[
        "Hesap ve kimlik doğrulama oturumları silinir.",
        "Tüm proje üyelikleri kaldırılır.",
        "Bu işlem geri alınamaz.",
        ...(failed && failed.id === user?._id ? [failed.message] : []),
      ]}
      confirmLabel="Kullanıcıyı sil"
      onConfirm={async () => {
        if (!user || ("isSelf" in user && user.isSelf))
          throw new Error("Kendi hesabınızı silemezsiniz.");
        setPending(true);
        setFailed(undefined);
        try {
          await onDelete();
          notify.success("Kullanıcı silindi");
        } catch (error) {
          setFailed({ id: user._id, message: errorMessage(error) });
          throw error;
        } finally {
          setPending(false);
        }
      }}
    />
  );
}
