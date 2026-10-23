import { useState, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { ConfirmDestructive } from "@/components/shared/ConfirmDestructive";
import { notify } from "@/lib/notify";
import type { Shift } from "./lib/planning";
export function DeleteImpact({
  shift,
  onClose,
  onDeleted,
}: {
  onDeleted?: () => void;
  shift: Shift;
  onClose: () => void;
}) {
  const impact = useQuery(api.shifts.assignmentDeleteImpact, { shiftId: shift._id });
  const remove = useMutation(api.shifts.remove);
  const [confirm, setConfirm] = useState(false);
  return (
    <>
      <DialogImpact open onClose={onClose} title={`${shift.name} silme etkisi`}>
        {!impact ? (
          <SectionSkeleton label="Tüm dönemlerde silme etkisi yükleniyor" />
        ) : (
          <>
            <p className="text-sm">
              {impact.countLabel} {impact.assignmentCount} atama serisi ·{" "}
              {impact.countLabel} {impact.employeeCount} kişi (tüm dönemler).
            </p>
            {impact.skippedAssignments > 0 && (
              <p className="text-xs text-warning">
                Proje bilgisi eksik {impact.skippedAssignments} seri sayım
                dışında; bu seriler silinmeden kalacak.
              </p>
            )}
            {impact.truncated && (
              <p className="text-sm text-warning">
                Sayılar alt sınırdır. Büyük silme için önce atama serilerini
                küçük gruplar halinde kaldırın.
              </p>
            )}
            <Button
              variant="destructive"
              disabled={impact.truncated}
              onClick={() => setConfirm(true)}
            >
              Vardiyayı sil
            </Button>
          </>
        )}
      </DialogImpact>
      {impact && (
        <ConfirmDestructive
          open={confirm}
          onOpenChange={setConfirm}
          title="Vardiya silinsin mi?"
          objectName={shift.name}
          effects={[
            `${impact.countLabel} ${impact.assignmentCount} bağlı atama serisi ve vardiya tanımı tüm dönemlerden kalıcı silinir.`,
            `${impact.countLabel} ${impact.employeeCount} kişi etkilenir.`,
            ...(impact.skippedAssignments > 0
              ? [
                  `Proje bilgisi eksik ${impact.skippedAssignments} seri silinmeden kalacak.`,
                ]
              : []),
          ]}
          confirmLabel="Vardiyayı ve serileri sil"
          onConfirm={async () => {
            const result = await remove({ shiftId: shift._id });
            notify.success(
              "Vardiya silindi",
              `${result.removedAssignments} seri silindi${result.skippedAssignments > 0 ? `; proje bilgisi eksik ${result.skippedAssignments} seri silinmeden kaldı` : ""}.`,
            );
            onDeleted?.();
            onClose();
          }}
        />
      )}
    </>
  );
}
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
function DialogImpact({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Silmeden önce tüm dönemlerdeki bağlı kayıtları inceleyin.
            Pasifleştirme mevcut atamaları silmez.
          </DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
