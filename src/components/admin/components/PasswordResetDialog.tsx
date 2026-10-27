import type { FunctionArgs } from "convex/server";
import { api } from "../../../../convex/_generated/api";
import { ConfirmAction } from "@/components/shared/ConfirmAction";
export type PasswordResetTarget = Pick<
  FunctionArgs<typeof api.actions.sendEmail.sendUserInviteEmail>,
  "email" | "projectId" | "role"
>;
export function PasswordResetDialog({
  target,
  onClose,
  onSend,
  pending,
}: {
  target: PasswordResetTarget | null;
  onClose: () => void;
  onSend: (target: PasswordResetTarget) => Promise<boolean>;
  pending: boolean;
}) {
  return (
    <ConfirmAction
      open={target !== null}
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
      title="Şifre sıfırlama bağlantısı gönderilsin mi?"
      description={
        <>
          {target?.email} adresine şifre sıfırlama bağlantısı gönderilecek.
          Mevcut oturumları şifre değişince kapanır.
        </>
      }
      confirmLabel="Bağlantıyı gönder"
      pendingLabel="Gönderiliyor…"
      onConfirm={async () => (target && !pending ? onSend(target) : false)}
    />
  );
}
