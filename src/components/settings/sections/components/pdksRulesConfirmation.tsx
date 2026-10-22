import type { MouseEventHandler } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import type { RuleConfirmation } from "./pdksRulesModel";

export function PdksRulesConfirmation({
  confirmation,
  pending,
  error,
  onClose,
  onConfirm,
}: {
  confirmation: RuleConfirmation;
  pending: boolean;
  error: string;
  onClose: () => void;
  onConfirm: MouseEventHandler<HTMLButtonElement>;
}) {
  return (
    <AlertDialog
      open={confirmation !== null}
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {confirmation?.kind === "delete"
              ? "Gelecek sürüm silinsin mi?"
              : "Bu tarihteki sürüm değiştirilsin mi?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {confirmation?.kind === "delete"
              ? `${confirmation.rule.effectiveFrom} tarihli gelecek sürüm silinecek.`
              : `${confirmation?.values.effectiveFrom ?? ""} tarihindeki yayın, o tarihteki sürümün yerine geçer.`}{" "}
            Geçmiş günler değişmez.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Vazgeç</AlertDialogCancel>
          <AlertDialogAction disabled={pending} onClick={onConfirm}>
            {pending
              ? "Kaydediliyor…"
              : confirmation?.kind === "delete"
                ? "Sürümü sil"
                : "Yerine yayınla"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
