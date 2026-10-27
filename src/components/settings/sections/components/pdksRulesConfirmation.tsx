import type { MouseEventHandler } from "react";
import { ConfirmDestructive } from "@/components/shared/ConfirmDestructive";
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
import { calculationSummary, checkpointSummary, type Targets, type RuleConfirmation } from "./pdksRulesModel";

export function PdksRulesConfirmation({
  targets,
  confirmation,
  pending,
  error,
  onClose,
  onConfirm,
  onDelete,
}: {
  targets?: Targets;
  confirmation: RuleConfirmation;
  pending: boolean;
  error: string;
  onClose: () => void;
  onConfirm: MouseEventHandler<HTMLButtonElement>;
  onDelete: () => Promise<unknown>;
}) {
  if (confirmation?.kind === "delete") {
    const rule = confirmation.rule;
    return (
      <ConfirmDestructive
        open
        onOpenChange={open => { if (!open) onClose(); }}
        title="Gelecek sürüm silinsin mi?"
        objectName={`${rule.effectiveFrom} tarihli gelecek sürüm`}
        effects={[
          `${rule.effectiveFrom} tarihli gelecek sürüm silinecek.`,
          "Geçmiş günler değişmez.",
          calculationSummary(rule),
          ...(rule.checkpointMode === "selected"
            ? [`Seçili noktalar: ${checkpointSummary(rule.targets, targets)}`]
            : []),
        ]}
        confirmLabel="Sürümü sil"
        errorTitle="Gelecek sürüm silinemedi"
        onConfirm={onDelete}
      />
    );
  }
  const selected = confirmation?.values;
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
            Bu tarihteki sürüm değiştirilsin mi?
          </AlertDialogTitle>
          <AlertDialogDescription>
            {`${confirmation?.values.effectiveFrom ?? ""} tarihindeki yayın, o tarihteki sürümün yerine geçer.`}{" "}
            Geçmiş günler değişmez.
            {selected && ` ${calculationSummary(selected)}`}
            {selected?.checkpointMode === "selected" &&
              ` Seçili noktalar: ${checkpointSummary(selected.targets, targets)}`}
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
              : "Yerine yayınla"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
