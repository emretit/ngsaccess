import { useState, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { RowActions } from "@/components/shared/RowActions";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { QuerySectionBoundary } from "@/components/shared/QuerySectionBoundary";
import { ConfirmDestructive } from "@/components/shared/ConfirmDestructive";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { notify } from "@/lib/notify";
import {
  AddShiftDialog,
  type ShiftFormPayload,
} from "./definitions/AddShiftDialog";
import type { Shift } from "./lib/planning";
export function ShiftListSidebar({
  open,
  onOpenChange,
  shifts,
  projectId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shifts: Shift[];
  projectId: Id<"projects">;
}) {
  const create = useMutation(api.shifts.create);
  const update = useMutation(api.shifts.update);
  const [editing, setEditing] = useState<Shift | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<Shift | null>(null);
  const add = async (payload: ShiftFormPayload) => {
    await create({ ...payload, projectId });
    notify.success("Vardiya oluşturuldu");
  };
  const edit = async (shiftId: Id<"shifts">, payload: ShiftFormPayload) => {
    await update({ ...payload, shiftId });
    notify.success("Vardiya güncellendi");
  };
  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-[420px] overflow-y-auto min-w-0">
          <SheetHeader>
            <SheetTitle>Vardiya tanımları</SheetTitle>
            <SheetDescription>
              Çalışma saatleri burada; genel mesai ve tatil politikaları
              Ayarlar'da yönetilir.
            </SheetDescription>
          </SheetHeader>
          <Button
            className="my-4"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            Yeni vardiya tanımla
          </Button>
          {!shifts.length ? (
            <EmptyState
              compact
              title="Henüz vardiya tanımlanmamış"
              description="Atama yapabilmek için çalışma saatlerini tanımlayın."
            />
          ) : (
            <ul className="divide-y">
              {[...shifts]
                .sort((a, b) => a.startTime.localeCompare(b.startTime))
                .map((shift) => (
                  <li key={shift._id} className="flex items-center gap-2 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium break-words">{shift.name}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {shift.startTime}–{shift.endTime}
                        {shift.endTime < shift.startTime ? " (+1 gün)" : ""}
                      </p>
                      <QuerySectionBoundary
                        resetKey={shift._id}
                        title="Kullanım sayısı yüklenemedi"
                      >
                        <DefinitionCount shiftId={shift._id} />
                      </QuerySectionBoundary>
                      <StatusBadge
                        tone={shift.isActive === false ? "neutral" : "success"}
                      >
                        {shift.isActive === false ? "Pasif" : "Aktif"}
                      </StatusBadge>
                    </div>
                    <RowActions label={`${shift.name} işlemleri`}>
                      <DropdownMenuItem
                        onSelect={() => {
                          setEditing(shift);
                          setFormOpen(true);
                        }}
                      >
                        Düzenle
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => setDeleting(shift)}
                        className="text-danger"
                      >
                        Silme etkisini incele
                      </DropdownMenuItem>
                    </RowActions>
                  </li>
                ))}
            </ul>
          )}
        </SheetContent>
      </Sheet>
      {formOpen && (
        <QuerySectionBoundary
          resetKey={editing?._id ?? "new"}
          title="Vardiya formu yüklenemedi"
        >
          <AddShiftDialog
            open
            onOpenChange={setFormOpen}
            onClose={() => setFormOpen(false)}
            editingShift={
              editing
                ? {
                    ...editing,
                    overtimeEnabled: editing.overtimeEnabled ?? true,
                    isActive: editing.isActive ?? true,
                  }
                : null
            }
            onAdd={add}
            onUpdate={edit}
          />
        </QuerySectionBoundary>
      )}
      {deleting && (
        <QuerySectionBoundary
          resetKey={deleting._id}
          title="Silme etkisi yüklenemedi"
        >
          <DeleteImpact shift={deleting} onClose={() => setDeleting(null)} />
        </QuerySectionBoundary>
      )}
    </>
  );
}
function DefinitionCount({ shiftId }: { shiftId: Id<"shifts"> }) {
  const impact = useQuery(api.shifts.assignmentDeleteImpact, { shiftId });
  return impact ? (
    <p className="text-xs text-muted-foreground">
      Tüm dönemlerde {impact.countLabel.toLocaleLowerCase("tr-TR")}{" "}
      {impact.assignmentCount} atama serisi
      {impact.skippedAssignments > 0 && (
        <span className="block">
          Proje bilgisi eksik {impact.skippedAssignments} seri sayım dışında.
        </span>
      )}
    </p>
  ) : (
    <span role="status" className="text-xs text-muted-foreground">
      Atama sayısı yükleniyor…
    </span>
  );
}
function DeleteImpact({
  shift,
  onClose,
}: {
  shift: Shift;
  onClose: () => void;
}) {
  const impact = useQuery(api.shifts.assignmentDeleteImpact, {
    shiftId: shift._id,
  });
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
