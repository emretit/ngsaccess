import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Plus } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useProjectAccess } from "@/hooks/useProjectAccess";
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
  const { projectIds, isSuperAdmin, loading: projectLoading } = useProjectAccess();
  const projectId = projectIds[0];
  const { toast } = useToast();

  const shifts = useQuery(api.shifts.list, projectLoading ? "skip" : {});
  const createShift = useMutation(api.shifts.create);
  const updateShift = useMutation(api.shifts.update);
  const removeShift = useMutation(api.shifts.remove);

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<EditingShift | null>(null);

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
      toast({ title: "Eklendi", description: `"${payload.name}" oluşturuldu.` });
      if (shifts && shifts.length === 0 && onComplete) onComplete();
    } catch (e) {
      toast({
        title: "Hata",
        description: e instanceof Error ? e.message : "Vardiya eklenemedi",
        variant: "destructive",
      });
    }
  };

  const handleUpdate = async (id: Id<"shifts">, payload: ShiftFormPayload) => {
    try {
      await updateShift({ shiftId: id, ...payload });
      toast({ title: "Güncellendi", description: `"${payload.name}" kaydedildi.` });
    } catch (e) {
      toast({
        title: "Hata",
        description: e instanceof Error ? e.message : "Vardiya güncellenemedi",
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
      isActive: shift.isActive ?? true,
    });
    setIsAddDialogOpen(true);
  };

  const handleDelete = async (shiftId: Id<"shifts">) => {
    try {
      await removeShift({ shiftId });
      toast({ title: "Silindi", description: "Vardiya kaldırıldı." });
    } catch (e) {
      toast({
        title: "Hata",
        description: e instanceof Error ? e.message : "Vardiya silinemedi",
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
    isActive: s.isActive,
  }));

  return (
    <div
      className={
        embedded
          ? "space-y-4"
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
        <div className="flex justify-end">
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

      {hasNoProjectAccess ? (
        <Card className="shadow-md">
          <CardContent className="py-10 text-center text-muted-foreground">
            Vardiya yönetimi için en az bir projeye atanmış olmanız gerekir.
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-md">
          <CardHeader className="bg-card border-b border-border">
            <CardTitle className="text-xl text-foreground">Mevcut Vardiyalar</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Yükleniyor...
              </div>
            ) : (
              <ShiftTable shifts={tableShifts} onEdit={handleEdit} onDelete={handleDelete} />
            )}
          </CardContent>
        </Card>
      )}

      <AddShiftDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onAdd={handleAdd}
        onUpdate={handleUpdate}
        editingShift={editingShift}
        onClose={handleCloseDialog}
      />
    </div>
  );
}
