import { useEffect, useMemo, useState } from "react";
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
import { useToast } from "@/hooks/use-toast";
import {
  assignmentFormSchema,
  type AssignmentFormValues,
} from "./assignmentFormSchema";

type Employee = FunctionReturnType<typeof api.employees.list>[number];
type Shift = FunctionReturnType<typeof api.shifts.list>[number];
type Assignment = FunctionReturnType<typeof api.shifts.listAssignments>[number];

interface AssignShiftDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employees: Employee[];
  shifts: Shift[];
  assignments: Assignment[];
  initial?: Partial<AssignmentFormValues>;
}

const EMPTY: AssignmentFormValues = {
  employeeId: "",
  shiftId: "",
  startDate: "",
  endDate: "",
};

export function AssignShiftDialog({
  open,
  onOpenChange,
  employees,
  shifts,
  assignments,
  initial,
}: AssignShiftDialogProps) {
  const { toast } = useToast();
  const assignShift = useMutation(api.shifts.assignShift);
  const [form, setForm] = useState<AssignmentFormValues>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [forceConfirm, setForceConfirm] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({ ...EMPTY, ...initial });
      setForceConfirm(false);
    }
  }, [open, initial]);

  const activeShifts = useMemo(
    () => shifts.filter((s) => s.isActive !== false),
    [shifts],
  );

  const conflicts = useMemo(() => {
    if (!form.employeeId || !form.startDate || !form.endDate) return [];
    return assignments.filter(
      (a) =>
        a.employeeId === form.employeeId &&
        a.startDate <= form.endDate &&
        a.endDate >= form.startDate,
    );
  }, [assignments, form.employeeId, form.startDate, form.endDate]);

  const handleSubmit = async () => {
    const result = assignmentFormSchema.safeParse(form);
    if (!result.success) {
      const first = result.error.issues[0];
      toast({
        title: "Hatalı form",
        description: first?.message ?? "Alanları kontrol edin",
        variant: "destructive",
      });
      return;
    }

    if (conflicts.length > 0 && !forceConfirm) {
      setForceConfirm(true);
      toast({
        title: "Çakışma uyarısı",
        description: `Bu çalışana seçilen aralıkta ${conflicts.length} mevcut atama var. Yine de eklemek için tekrar "Ata" butonuna tıklayın.`,
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const emp = employees.find((e) => e._id === result.data.employeeId);
      await assignShift({
        employeeId: result.data.employeeId as Id<"employees">,
        shiftId: result.data.shiftId as Id<"shifts">,
        projectId: emp?.projectId,
        startDate: result.data.startDate,
        endDate: result.data.endDate,
      });
      toast({ title: "Vardiya atandı" });
      onOpenChange(false);
    } catch (e) {
      toast({
        title: "Hata",
        description: e instanceof Error ? e.message : "Atama yapılamadı",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Vardiya Ata</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="space-y-2">
            <Label>Çalışan</Label>
            <Select
              value={form.employeeId}
              onValueChange={(v) => setForm((p) => ({ ...p, employeeId: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Çalışan seçin" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((e) => (
                  <SelectItem key={e._id} value={e._id}>
                    {e.firstName} {e.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Vardiya</Label>
            <Select
              value={form.shiftId}
              onValueChange={(v) => setForm((p) => ({ ...p, shiftId: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Vardiya seçin" />
              </SelectTrigger>
              <SelectContent>
                {activeShifts.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    Aktif vardiya yok
                  </div>
                ) : (
                  activeShifts.map((s) => (
                    <SelectItem key={s._id} value={s._id}>
                      {s.name} ({s.startTime}–{s.endTime})
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Başlangıç</Label>
              <Input
                type="date"
                value={form.startDate}
                onChange={(e) =>
                  setForm((p) => ({ ...p, startDate: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Bitiş</Label>
              <Input
                type="date"
                value={form.endDate}
                onChange={(e) =>
                  setForm((p) => ({ ...p, endDate: e.target.value }))
                }
              />
            </div>
          </div>

          {conflicts.length > 0 && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              <p className="font-medium">
                Çakışma: {conflicts.length} mevcut atama bu aralığı kapsıyor.
              </p>
              <p className="mt-1 text-xs opacity-80">
                Yine de eklemek için "Ata" butonuna tekrar tıklayın.
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              İptal
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Atanıyor..." : forceConfirm && conflicts.length > 0 ? "Yine de Ata" : "Ata"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
