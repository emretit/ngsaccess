import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Button } from "@/components/ui/button";
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
import { Clock, Loader2, Plus } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useActiveProject } from "@/contexts/ActiveProjectContext";
import { useToast } from "@/hooks/use-toast";
import { ShiftTable, type ShiftRow } from "./components/ShiftTable";
import {
  AddShiftDialog,
  type EditingShift,
  type ShiftFormPayload,
} from "./components/AddShiftDialog";

interface ShiftSettingsProps {
  onComplete?: () => void;
  embedded?: boolean;
}

export function ShiftSettings({ onComplete, embedded = false }: ShiftSettingsProps) {
  const { projectId, isSuperAdmin, loading: projectLoading } = useActiveProject();
  const { toast } = useToast();

  const shifts = useQuery(api.shifts.list, projectLoading ? "skip" : {});
  const assignments = useQuery(
    api.shifts.listAssignments,
    projectLoading ? "skip" : {},
  );
  const createShift = useMutation(api.shifts.create);
  const updateShift = useMutation(api.shifts.update);
  const removeShift = useMutation(api.shifts.remove);

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<EditingShift | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: Id<"shifts">;
    name: string;
  } | null>(null);

  const assignmentCountByShift = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of assignments ?? []) {
      m.set(a.shiftId, (m.get(a.shiftId) ?? 0) + 1);
    }
    return m;
  }, [assignments]);

  const handleAdd = async (payload: ShiftFormPayload) => {
    if (!projectId) {
      toast({
        title: "Proje bulunamadı",
        description: "Vardiya eklemek için en az bir projeye atanmış olmalısınız.",
        variant: "destructive",
      });
      return;
    }
    try {
      await createShift({ projectId, ...payload });
      toast({ title: "Vardiya oluşturuldu", description: `"${payload.name}" eklendi.` });
      if (shifts && shifts.length === 0 && onComplete) onComplete();
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
      toast({ title: "Vardiya güncellendi", description: `"${payload.name}" kaydedildi.` });
    } catch (e) {
      toast({
        title: "Vardiya güncellenemedi",
        description: e instanceof Error ? e.message : "Bilinmeyen hata",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (shift: ShiftRow) => {
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
    setIsAddDialogOpen(true);
  };

  const handleDeleteRequest = (shiftId: Id<"shifts">) => {
    const shift = (shifts ?? []).find((s) => s._id === shiftId);
    if (!shift) return;
    setDeleteTarget({ id: shiftId, name: shift.name });
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

  const handleCloseDialog = () => {
    setIsAddDialogOpen(false);
    setEditingShift(null);
  };

  const isLoading = projectLoading || shifts === undefined;
  const hasNoProjectAccess = !projectLoading && !projectId && !isSuperAdmin;

  const tableShifts: ShiftRow[] = (shifts ?? []).map((s) => ({
    _id: s._id,
    name: s.name,
    startTime: s.startTime,
    endTime: s.endTime,
    breakStart: s.breakStart,
    breakEnd: s.breakEnd,
    lateToleranceMinutes: s.lateToleranceMinutes,
    earlyExitToleranceMinutes: s.earlyExitToleranceMinutes,
    overtimeStartToleranceMinutes: s.overtimeStartToleranceMinutes,
    overtimeEnabled: s.overtimeEnabled,
    isActive: s.isActive,
  }));

  const shiftCount = tableShifts.length;

  return (
    <div
      className={
        embedded
          ? "space-y-3"
          : "space-y-6 p-6 bg-muted/50 min-h-screen"
      }
    >
      {!embedded && (
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Vardiya Ayarları</h1>
            <p className="text-muted-foreground mt-2">Çalışma vardiyalarını yönetin ve düzenleyin</p>
          </div>
          <Button
            onClick={() => setIsAddDialogOpen(true)}
            className="bg-primary hover:bg-primary/90 text-white"
            disabled={hasNoProjectAccess}
          >
            <Plus className="w-4 h-4 mr-2" />
            Yeni Vardiya Ekle
          </Button>
        </div>
      )}
      {embedded && (
        <div className="rounded-xl border bg-card shadow-xs p-4 md:p-6">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 mr-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <Clock className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-semibold leading-tight">Vardiya Tanımları</h2>
                <p className="text-xs text-muted-foreground">
                  {shiftCount} vardiya tanımlı
                </p>
              </div>
            </div>
            <div className="ml-auto">
              <Button
                onClick={() => setIsAddDialogOpen(true)}
                disabled={hasNoProjectAccess}
                size="sm"
                className="h-8 gap-1.5 text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                Yeni Vardiya
              </Button>
            </div>
          </div>
        </div>
      )}

      {hasNoProjectAccess ? (
        <div className="rounded-xl border bg-card shadow-xs py-10 text-center text-muted-foreground text-sm">
          Vardiya yönetimi için en az bir projeye atanmış olmanız gerekir.
        </div>
      ) : (
        <div className="rounded-xl border bg-card shadow-xs overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Yükleniyor...
            </div>
          ) : (
            <ShiftTable
              shifts={tableShifts}
              onEdit={handleEdit}
              onDelete={handleDeleteRequest}
              onAdd={hasNoProjectAccess ? undefined : () => setIsAddDialogOpen(true)}
            />
          )}
        </div>
      )}

      <AddShiftDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onAdd={handleAdd}
        onUpdate={handleUpdate}
        editingShift={editingShift}
        onClose={handleCloseDialog}
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
                    const count = assignmentCountByShift.get(deleteTarget.id) ?? 0;
                    if (count === 0) return " İşlem geri alınamaz.";
                    return ` Bu vardiyaya bağlı ${count} atama da silinecek. İşlem geri alınamaz.`;
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
    </div>
  );
}
