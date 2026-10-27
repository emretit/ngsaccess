import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { usePermissions } from "@/hooks/usePermissions";
import { TreePanel, TreePanelHeader, treeFixedItemClass, TREE_NAME_BUTTON, TREE_ROW_ACTIONS } from "@/components/shared/TreePanel";
import { RowActions } from "@/components/shared/RowActions";
import { QuerySectionBoundary } from "@/components/shared/QuerySectionBoundary";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AddShiftDialog } from "./definitions/AddShiftDialog";
import { AssignShiftDialog } from "./AssignShiftDialog";
import { DeleteImpact } from "./ShiftDeleteImpact";
import { shiftTimeLabel, type Shift } from "./lib/planning";
import { useShiftDefinitionActions } from "./useShiftDefinitionActions";

export function ShiftTree({ projectId, selectedShiftId, onSelectShift, createOpen: controlledCreateOpen, onCreateOpenChange }: {
  projectId: Id<"projects">;
  selectedShiftId?: Id<"shifts">;
  onSelectShift: (id: Id<"shifts"> | undefined) => void;
  createOpen?: boolean;
  onCreateOpenChange?: (open: boolean) => void;
}) {
  const { can } = usePermissions();
  const canManage = can("schedule.manage");
  const shifts = useQuery(api.shifts.list, { projectId });
  const { add, edit } = useShiftDefinitionActions(projectId);
  const [localCreateOpen, setLocalCreateOpen] = useState(false);
  const createOpen = controlledCreateOpen ?? localCreateOpen;
  const setCreateOpen = onCreateOpenChange ?? setLocalCreateOpen;
  const [editing, setEditing] = useState<Shift | null>(null);
  const [deleting, setDeleting] = useState<Shift | null>(null);
  const [assigning, setAssigning] = useState<Shift | null>(null);
  const closeForm = () => { setEditing(null); setCreateOpen(false); };
  // Silinmiş ya da başka projeye ait vardiya adresten gelirse filtre boş liste vermesin.
  const staleSelection = Boolean(shifts && selectedShiftId && !shifts.some(shift => shift._id === selectedShiftId));
  useEffect(() => { if (staleSelection) onSelectShift(undefined); }, [staleSelection, onSelectShift]);
  return <>
    <TreePanel id="pdks-shifts" label="Vardiyalar"
      summary={shifts?.find(shift => shift._id === selectedShiftId)?.name ?? "Tüm vardiyalar"}
      header={<TreePanelHeader title="Vardiyalar" addLabel="Vardiya ekle" onAddClick={canManage ? () => setCreateOpen(true) : undefined} />}>
      <button type="button" className={cn(treeFixedItemClass, "pl-2")} aria-pressed={!selectedShiftId} onClick={() => onSelectShift(undefined)}>Tüm vardiyalar</button>
      {!shifts ? <SectionSkeleton rows={3} label="Vardiyalar yükleniyor" /> : !shifts.length ? <div className="space-y-2 p-2 text-sm text-muted-foreground">
        <p>Henüz vardiya yok</p>
        {canManage && <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}>Vardiya ekle</Button>}
      </div> : [...shifts].sort((a, b) => a.startTime.localeCompare(b.startTime)).map(shift => {
        return <div key={shift._id} className={cn("group flex min-w-0 items-center rounded-sm pl-2 hover:bg-muted", selectedShiftId === shift._id && "bg-selected text-primary")}>
          <button type="button" className={cn(TREE_NAME_BUTTON, "py-1")} aria-pressed={selectedShiftId === shift._id}
            onClick={() => onSelectShift(selectedShiftId === shift._id ? undefined : shift._id)}>
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate">{shift.name}</span>
              {shift.isActive === false && <span className="text-[10px] text-muted-foreground">Pasif</span>}
            </span>
            <span className="block text-xs font-normal text-muted-foreground">{shiftTimeLabel(shift)}</span>
          </button>
          {canManage && <div className={TREE_ROW_ACTIONS}><RowActions label={`${shift.name} işlemleri`}>
            <DropdownMenuItem onSelect={() => setEditing(shift)}>Düzenle</DropdownMenuItem>
            {shift.isActive !== false && <DropdownMenuItem onSelect={() => setAssigning(shift)}>Kişi ata</DropdownMenuItem>}
            <DropdownMenuItem className="text-danger" onSelect={() => setDeleting(shift)}>Sil</DropdownMenuItem>
          </RowActions></div>}
        </div>;
      })}
    </TreePanel>
    {canManage && (createOpen || editing) && <QuerySectionBoundary resetKey={editing?._id ?? "new"} title="Vardiya formu yüklenemedi">
      <AddShiftDialog key={editing?._id ?? "new"} open onOpenChange={next => { if (!next) closeForm(); }} onClose={closeForm}
        editingShift={editing ? { ...editing, overtimeEnabled: editing.overtimeEnabled ?? true, isActive: editing.isActive ?? true } : null}
        onAdd={add} onUpdate={edit} />
    </QuerySectionBoundary>}
    {canManage && assigning && <QuerySectionBoundary resetKey={assigning._id} title="Vardiya atama formu yüklenemedi">
      <AssignFromTree projectId={projectId} shift={assigning} shifts={shifts ?? []} onClose={() => setAssigning(null)} />
    </QuerySectionBoundary>}
    {canManage && deleting && <QuerySectionBoundary resetKey={deleting._id} title="Silme etkisi yüklenemedi">
      <DeleteImpact shift={deleting} onDeleted={() => { if (selectedShiftId === deleting._id) onSelectShift(undefined); }} onClose={() => setDeleting(null)} />
    </QuerySectionBoundary>}
  </>;
}

/** Çalışan listesi yalnız "Kişi ata" açıkken yüklenir; PDKS sayfası her açılışta tüm personele abone olmaz. */
function AssignFromTree({ projectId, shift, shifts, onClose }: {
  projectId: Id<"projects">; shift: Shift; shifts: Shift[]; onClose: () => void;
}) {
  const employees = useQuery(api.employees.list, { projectId });
  if (!employees) return <SectionSkeleton label="Çalışanlar yükleniyor" />;
  return <AssignShiftDialog key={shift._id} open projectId={projectId} employees={employees} shifts={shifts}
    initial={{ shiftId: shift._id }} onOpenChange={next => { if (!next) onClose(); }} />;
}
