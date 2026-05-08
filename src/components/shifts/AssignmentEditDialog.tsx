import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Assignment = FunctionReturnType<typeof api.shifts.listAssignments>[number];
type Shift = FunctionReturnType<typeof api.shifts.list>[number];

interface AssignmentEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignment: Assignment | null;
  shifts: Shift[];
  shiftName: string;
  employeeName: string;
}

export function AssignmentEditDialog({
  open,
  onOpenChange,
  assignment,
  shifts,
  shiftName,
  employeeName,
}: AssignmentEditDialogProps) {
  const { toast } = useToast();
  const updateAssignment = useMutation(api.shifts.updateAssignment);
  const removeAssignment = useMutation(api.shifts.removeAssignment);
  const [shiftId, setShiftId] = useState<string>("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (assignment && open) {
      setShiftId(assignment.shiftId);
      setStartDate(assignment.startDate);
      setEndDate(assignment.endDate);
    }
  }, [assignment, open]);

  if (!assignment) return null;

  const handleSave = async () => {
    if (startDate > endDate) {
      toast({
        title: "Hatalı tarih",
        description: "Bitiş tarihi başlangıçtan önce olamaz",
        variant: "destructive",
      });
      return;
    }
    setBusy(true);
    try {
      await updateAssignment({
        assignmentId: assignment._id,
        shiftId: shiftId as Id<"shifts">,
        startDate,
        endDate,
      });
      toast({ title: "Atama güncellendi" });
      onOpenChange(false);
    } catch (e) {
      toast({
        title: "Hata",
        description: e instanceof Error ? e.message : "Güncellenemedi",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    setBusy(true);
    try {
      await removeAssignment({ assignmentId: assignment._id });
      toast({ title: "Atama silindi" });
      onOpenChange(false);
    } catch (e) {
      toast({
        title: "Hata",
        description: e instanceof Error ? e.message : "Silinemedi",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Atamayı Düzenle</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Çalışan</p>
              <p className="font-medium">{employeeName}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Mevcut Vardiya</p>
              <p className="font-medium">{shiftName}</p>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Vardiyayı Değiştir</Label>
            <Select value={shiftId} onValueChange={setShiftId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {shifts
                  .filter((s) => s.isActive !== false)
                  .map((s) => (
                    <SelectItem key={s._id} value={s._id}>
                      {s.name} ({s.startTime}–{s.endTime})
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs">Başlangıç</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Bitiş</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-between gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              disabled={busy}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="mr-1 h-4 w-4" />
              Sil
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={busy}
              >
                Kapat
              </Button>
              <Button type="button" size="sm" onClick={handleSave} disabled={busy}>
                Kaydet
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
