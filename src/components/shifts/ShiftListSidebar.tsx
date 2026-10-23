import { usePermissions } from "@/hooks/usePermissions";
import type { FunctionReturnType } from "convex/server";
import { shiftTimeLabel } from "./lib/planning";
type DefinitionImpact = FunctionReturnType<typeof api.shifts.definitionImpacts>[number];
import { useState, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { onRowActivate, ROW_CLICK_CLASS } from "@/lib/tableRowClick";
import { shiftColorClasses } from "./lib/shiftColors";
import { RowActions } from "@/components/shared/RowActions";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { QuerySectionBoundary } from "@/components/shared/QuerySectionBoundary";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ConfirmDestructive } from "@/components/shared/ConfirmDestructive";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { notify } from "@/lib/notify";
import {
  AddShiftDialog,
  type ShiftFormPayload,
} from "./definitions/AddShiftDialog";
import type { Shift } from "./lib/planning";
/** Definitions table shared by the dedicated definitions page. */
export function ShiftListSidebar({ shifts, projectId, createOpen, onCreateOpenChange }: {
  shifts: Shift[];
  projectId: Id<"projects">;
  createOpen: boolean;
  onCreateOpenChange: (open: boolean) => void;
}) {
  const { can } = usePermissions();
  const canManage = can("schedule.manage");
  const create = useMutation(api.shifts.create);
  const update = useMutation(api.shifts.update);
  const [editing, setEditing] = useState<Shift | null>(null);
  const [deleting, setDeleting] = useState<Shift | null>(null);
  const closeForm = () => { setEditing(null); onCreateOpenChange(false); };
  const add = async ({ color, ...payload }: ShiftFormPayload) => {
    await create({ ...payload, color: color ?? undefined, projectId });
    notify.success("Vardiya oluşturuldu");
  };
  const edit = async (shiftId: Id<"shifts">, { color, ...payload }: ShiftFormPayload) => {
    const current = shifts.find((shift) => shift._id === shiftId);
    // Renk yalnız değiştiyse gönderilir: Convex'ten önce yayınlanan web eski backend'de düzenlemeyi bozmasın.
    const colorPatch = (color ?? null) !== (current?.color ?? null) ? { color } : {};
    await update(current?.scheduleType === "flexible"
      ? { shiftId, name: payload.name, isActive: payload.isActive, ...colorPatch }
      : { ...payload, ...colorPatch, shiftId });
    notify.success("Vardiya güncellendi");
  };
  const table = (impacts: DefinitionImpact[] | undefined | null) => <div className="overflow-hidden rounded-md border">
        <Table aria-label="Vardiya tanımları">
          <TableHeader><TableRow>
            <TableHead>Ad</TableHead><TableHead>Tür</TableHead><TableHead>Saat</TableHead>
            <TableHead>Mola</TableHead><TableHead>Atama serisi</TableHead><TableHead>Durum</TableHead>
            {canManage && <TableHead className="w-11"><span className="sr-only">İşlemler</span></TableHead>}
          </TableRow></TableHeader>
          <TableBody>{[...shifts].sort((a, b) => a.startTime.localeCompare(b.startTime)).map(shift => {
            const color = shiftColorClasses(shift.color);
            return <TableRow key={shift._id} className={canManage ? ROW_CLICK_CLASS : undefined}
              onClick={canManage ? onRowActivate(() => setEditing(shift)) : undefined}>
              <TableCell><span className="flex items-center gap-2 font-medium">
                {color && <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${color.dot}`} />}
                {shift.name}</span></TableCell>
              <TableCell>{shift.scheduleType === "flexible" ? "Esnek" : "Sabit"}</TableCell>
              <TableCell className="whitespace-nowrap tabular-nums">{shiftTimeLabel(shift)}</TableCell>
              <TableCell className="whitespace-nowrap tabular-nums">{shift.breakStart && shift.breakEnd ? `${shift.breakStart}–${shift.breakEnd}` : "—"}</TableCell>
              <TableCell><DefinitionCount impact={impacts?.find(item => item.shiftId === shift._id)} loading={impacts === undefined} /></TableCell>
              <TableCell><StatusBadge tone={shift.isActive === false ? "neutral" : "success"}>{shift.isActive === false ? "Pasif" : "Aktif"}</StatusBadge></TableCell>
              {canManage && <TableCell><RowActions label={`${shift.name} işlemleri`}>
                <DropdownMenuItem onSelect={() => setEditing(shift)}>Düzenle</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setDeleting(shift)} className="text-danger">Silme etkisini incele</DropdownMenuItem>
              </RowActions></TableCell>}
            </TableRow>;
          })}</TableBody>
        </Table>
      </div>;
  return <>
    {!shifts.length ? <EmptyState title="Henüz vardiya tanımlanmamış"
      description="Atama yapabilmek için çalışma saatlerini tanımlayın."
      action={canManage ? { label: "Yeni vardiya tanımla", onClick: () => onCreateOpenChange(true) } : undefined} />
      : <ErrorBoundary key={projectId} fallback={() => table(null)}>
        <DefinitionImpacts projectId={projectId}>{table}</DefinitionImpacts>
      </ErrorBoundary>}
    {canManage && (createOpen || editing) && <QuerySectionBoundary resetKey={editing?._id ?? "new"} title="Vardiya formu yüklenemedi">
      <AddShiftDialog key={editing?._id ?? "new"} open onOpenChange={next => { if (!next) closeForm(); }} onClose={closeForm}
        editingShift={editing ? { ...editing, overtimeEnabled: editing.overtimeEnabled ?? true, isActive: editing.isActive ?? true } : null}
        onAdd={add} onUpdate={edit} />
    </QuerySectionBoundary>}
    {canManage && deleting && <QuerySectionBoundary resetKey={deleting._id} title="Silme etkisi yüklenemedi">
      <DeleteImpact shift={deleting} onClose={() => setDeleting(null)} />
    </QuerySectionBoundary>}
  </>;
}

function DefinitionImpacts({ projectId, children }: {
  projectId: Id<"projects">;
  children: (impacts: DefinitionImpact[] | undefined) => ReactNode;
}) {
  return children(useQuery(api.shifts.definitionImpacts, { projectId }));
}

export function DefinitionCount({ impact, loading = false }: { impact?: DefinitionImpact; loading?: boolean }) {
  if (loading) return <span role="status" className="text-muted-foreground">Atama sayısı yükleniyor…</span>;
  if (!impact) return <span className="text-muted-foreground">Sayı yüklenemedi</span>;
  if (impact.assignmentCount === null) return <span className="text-muted-foreground">Hesaplanamadı</span>;
  return <span className="text-muted-foreground">
    <span title="Tüm dönemlerdeki atama serileri">{impact.countLabel} {impact.assignmentCount}</span>
    {impact.skippedAssignments > 0 && <span className="block">Proje bilgisi eksik veya uyuşmayan {impact.skippedAssignments} seri sayım dışında.</span>}
  </span>;
}
export function DeleteImpact({
  shift,
  onClose,
}: {
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
