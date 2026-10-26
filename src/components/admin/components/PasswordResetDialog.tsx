import type { FunctionArgs } from "convex/server";
import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from "@/components/ui/alert-dialog";
export type PasswordResetTarget = Pick<FunctionArgs<typeof api.actions.sendEmail.sendUserInviteEmail>, "email" | "projectId" | "role">;
export function PasswordResetDialog({ target, onClose, onSend, pending }: {
  target: PasswordResetTarget | null;
  onClose: () => void;
  onSend: (target: PasswordResetTarget) => Promise<boolean>;
  pending: boolean;
}) {
  return <AlertDialog open={target !== null} onOpenChange={open => { if (!open && !pending) onClose(); }}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Şifre sıfırlama bağlantısı gönderilsin mi?</AlertDialogTitle>
        <AlertDialogDescription>{target?.email} adresine şifre sıfırlama bağlantısı gönderilecek. Mevcut oturumları şifre değişince kapanır.</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel disabled={pending}>Vazgeç</AlertDialogCancel>
        <Button disabled={pending} onClick={async () => { if (target && await onSend(target)) onClose(); }}>
          {pending ? "Gönderiliyor…" : "Bağlantıyı gönder"}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}

