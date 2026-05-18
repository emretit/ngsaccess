import { useMemo, useState } from "react";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Clock, Pencil, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getShiftColor } from "./lib/shiftColor";
import { useToast } from "@/hooks/use-toast";
import {
  AddShiftDialog,
  type EditingShift,
  type ShiftFormPayload,
} from "@/components/settings/sections/components/AddShiftDialog";

type Shift = FunctionReturnType<typeof api.shifts.list>[number];
type Assignment = FunctionReturnType<typeof api.shifts.listAssignments>[number];

interface ShiftListSidebarProps {
  shifts: Shift[];
  assignments: Assignment[];
  projectId?: Id<"projects">;
}

export function ShiftListSidebar({
  shifts,
  assignments,
  projectId,
}: ShiftListSidebarProps) {
  const { toast } = useToast();
  const createShift = useMutation(api.shifts.create);
  const updateShift = useMutation(api.shifts.update);
  const removeShift = useMutation(api.shifts.remove);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<EditingShift | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: Id<"shifts">;
    name: string;
  } | null>(null);

  const assignmentCountByShift = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of assignments) {
      m.set(a.shiftId, (m.get(a.shiftId) ?? 0) + 1);
    }
    return m;
  }, [assignments]);

  const sortedShifts = useMemo(
    () =>
      [...shifts].sort((a, b) => {
        if (a.isActive !== b.isActive) {
          return (a.isActive === false ? 1 : 0) - (b.isActive === false ? 1 : 0);
        }
        return a.startTime.localeCompare(b.startTime);
      }),
    [shifts],
  );

  const handleAdd = async (payload: ShiftFormPayload) => {
    if (!projectId) {
      toast({
        title: "Proje bulunamadı",
        description: "Vardiya eklemek için projeye atanmış olmalısınız.",
        variant: "destructive",
      });
      return;
    }
    try {
      await createShift({ projectId, ...payload });
      toast({
        title: "Vardiya oluşturuldu",
        description: `"${payload.name}" eklendi.`,
      });
    } catch (e) {
      toast({
        title: "Vardiya eklenemedi",
        description: e instanceof Error ? e.message : "Bilinmeyen hata",
        variant: "destructive",
      });
    }
  };

  const handleUpdate = async (id: Id<"shifts">, payload: ShiftFormPayload) => {
    try {
      await updateShift({ shiftId: id, ...payload });
      toast({
        title: "Vardiya güncellendi",
        description: `"${payload.name}" kaydedildi.`,
      });
    } catch (e) {
      toast({
        title: "Vardiya güncellenemedi",
        description: e instanceof Error ? e.message : "Bilinmeyen hata",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (shift: Shift) => {
    setEditingShift({
      _id: shift._id,
      name: shift.name,
      startTime: shift.startTime,
      endTime: shift.endTime,
      breakStart: shift.breakStart,
      breakEnd: shift.breakEnd,
      lateToleranceMinutes: shift.lateToleranceMinutes,
      earlyExitToleranceMinutes: shift.earlyExitToleranceMinutes,
      overtimeStartToleranceMinutes: shift.overtimeStartToleranceMinutes,
      overtimeEnabled: shift.overtimeEnabled ?? true,
      isActive: shift.isActive ?? true,
    });
    setIsDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      const result = await removeShift({ shiftId: deleteTarget.id });
      const removed = result?.removedAssignments ?? 0;
      toast({
        title: "Vardiya silindi",
        description:
          removed > 0
            ? `"${deleteTarget.name}" ve ${removed} bağlı atama kaldırıldı.`
            : `"${deleteTarget.name}" kaldırıldı.`,
      });
      setDeleteTarget(null);
    } catch (e) {
      toast({
        title: "Vardiya silinemedi",
        description: e instanceof Error ? e.message : "Bilinmeyen hata",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <div className="h-full w-full md:w-[260px] shrink-0 bg-card rounded-xl border shadow-xs flex flex-col">
        <div className="flex items-center justify-between gap-2 p-3 border-b">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 shrink-0">
              <Clock className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold leading-tight">
                Vardiyalar
              </h3>
              <p className="text-[11px] text-muted-foreground">
                {sortedShifts.length} tanım
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setEditingShift(null);
              setIsDialogOpen(true);
            }}
            className="h-7 w-7 p-0 shrink-0"
            aria-label="Yeni vardiya ekle"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-2 flex-1 overflow-y-auto max-h-[calc(100vh-12rem)] space-y-1.5">
          {sortedShifts.length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">
              Vardiya yok
            </p>
          ) : (
            sortedShifts.map((s) => {
              const count = assignmentCountByShift.get(s._id) ?? 0;
              const isActive = s.isActive !== false;
              const colorClass = getShiftColor(s._id);
              return (
                <div
                  key={s._id}
                  className={cn(
                    "group rounded-lg border p-2 transition-colors hover:bg-muted/60",
                    !isActive && "opacity-60",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className={cn(
                            "inline-block h-2 w-2 rounded-full shrink-0",
                            colorClass,
                          )}
                        />
                        <span className="text-sm font-medium truncate">
                          {s.name}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {s.startTime}–{s.endTime}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        {!isActive && (
                          <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                            Pasif
                          </Badge>
                        )}
                        {count > 0 && (
                          <span className="text-[11px] text-muted-foreground">
                            {count} atama
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => handleEdit(s)}
                        aria-label="Düzenle"
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive hover:text-destructive"
                        onClick={() =>
                          setDeleteTarget({ id: s._id, name: s.name })
                        }
                        aria-label="Sil"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <AddShiftDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onAdd={handleAdd}
        onUpdate={handleUpdate}
        editingShift={editingShift}
        onClose={() => {
          setIsDialogOpen(false);
          setEditingShift(null);
        }}
      />

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Vardiyayı sil</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && (
                <>
                  <span className="font-medium">"{deleteTarget.name}"</span>{" "}
                  vardiyasını silmek istediğinizden emin misiniz?
                  {(() => {
                    const count =
                      assignmentCountByShift.get(deleteTarget.id) ?? 0;
                    if (count === 0) return " İşlem geri alınamaz.";
                    return ` Bu vardiyaya bağlı ${count} atama da silinecek.`;
                  })()}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleDeleteConfirm();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
