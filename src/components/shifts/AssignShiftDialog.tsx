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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import { parseDateString, formatDateString } from "@/lib/date";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  assignmentFormSchema,
  type AssignmentFormValues,
} from "./assignmentFormSchema";
import { findRangeConflicts } from "./lib/calendarOverlays";

type Employee = FunctionReturnType<typeof api.employees.list>[number];
type Shift = FunctionReturnType<typeof api.shifts.list>[number];
type Assignment = FunctionReturnType<typeof api.shifts.listAssignments>[number];
type Holiday = FunctionReturnType<typeof api.holidays.listForRange>[number];
type Leave = FunctionReturnType<typeof api.leaves.listForRange>[number];

interface AssignShiftDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employees: Employee[];
  shifts: Shift[];
  assignments: Assignment[];
  leaves?: Leave[];
  holidays?: Holiday[];
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
  leaves = [],
  holidays = [],
  initial,
}: AssignShiftDialogProps) {
  const { toast } = useToast();
  const assignShift = useMutation(api.shifts.assignShift);
  const [form, setForm] = useState<AssignmentFormValues>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [employeeOpen, setEmployeeOpen] = useState(false);
  const [overlapCount, setOverlapCount] = useState<number | null>(null);
  const [calendarConflict, setCalendarConflict] = useState<{
    leaveDays: number;
    holidayDays: number;
  } | null>(null);

  useEffect(() => {
    if (open) {
      setForm({ ...EMPTY, ...initial });
      setOverlapCount(null);
      setCalendarConflict(null);
    }
  }, [open, initial]);

  const activeShifts = useMemo(
    () => shifts.filter((s) => s.isActive !== false),
    [shifts],
  );

  const localConflicts = useMemo(() => {
    if (!form.employeeId || !form.startDate || !form.endDate) return 0;
    return assignments.filter(
      (a) =>
        a.employeeId === form.employeeId &&
        a.startDate <= form.endDate &&
        a.endDate >= form.startDate,
    ).length;
  }, [assignments, form.employeeId, form.startDate, form.endDate]);

  const selectedEmployee = employees.find((e) => e._id === form.employeeId);

  const submit = async (forceConfirm: boolean, skipCalendarCheck = false) => {
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

    if (!skipCalendarCheck && !forceConfirm) {
      const conflicts = findRangeConflicts(
        result.data.employeeId,
        result.data.startDate,
        result.data.endDate,
        leaves,
        holidays,
      );
      if (conflicts.leaveDates.length > 0 || conflicts.holidayDates.length > 0) {
        setCalendarConflict({
          leaveDays: conflicts.leaveDates.length,
          holidayDays: conflicts.holidayDates.length,
        });
        return;
      }
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
        forceConfirm,
      });
      toast({ title: "Vardiya atandı" });
      setOverlapCount(null);
      onOpenChange(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Atama yapılamadı";
      const overlapMatch = /OVERLAP:(\d+)/.exec(msg);
      if (overlapMatch) {
        setOverlapCount(Number(overlapMatch[1]));
      } else {
        toast({
          title: "Atama yapılamadı",
          description: msg,
          variant: "destructive",
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Vardiya Ata</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>Çalışan</Label>
              <Popover open={employeeOpen} onOpenChange={setEmployeeOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={employeeOpen}
                    className="w-full justify-between font-normal"
                  >
                    {selectedEmployee
                      ? `${selectedEmployee.firstName} ${selectedEmployee.lastName}`
                      : "Çalışan seçin"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Çalışan ara..." />
                    <CommandList>
                      <CommandEmpty>Sonuç yok.</CommandEmpty>
                      <CommandGroup>
                        {employees.map((e) => {
                          const label = `${e.firstName} ${e.lastName}`;
                          return (
                            <CommandItem
                              key={e._id}
                              value={label}
                              onSelect={() => {
                                setForm((p) => ({ ...p, employeeId: e._id }));
                                setEmployeeOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  form.employeeId === e._id
                                    ? "opacity-100"
                                    : "opacity-0",
                                )}
                              />
                              {label}
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Vardiya</Label>
              <Select
                value={form.shiftId}
                onValueChange={(v) => setForm((p) => ({ ...p, shiftId: v }))}
                disabled={activeShifts.length === 0}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      activeShifts.length === 0
                        ? "Aktif vardiya yok"
                        : "Vardiya seçin"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {activeShifts.map((s) => (
                    <SelectItem key={s._id} value={s._id}>
                      {s.name} ({s.startTime}–{s.endTime})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Başlangıç</Label>
                <DatePicker
                  date={parseDateString(form.startDate)}
                  onSelect={(d) =>
                    setForm((p) => ({ ...p, startDate: formatDateString(d) }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Bitiş</Label>
                <DatePicker
                  date={parseDateString(form.endDate)}
                  onSelect={(d) =>
                    setForm((p) => ({ ...p, endDate: formatDateString(d) }))
                  }
                  minDate={parseDateString(form.startDate)}
                />
              </div>
            </div>

            {localConflicts > 0 && (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                Uyarı: Bu çalışana seçilen aralıkta {localConflicts} mevcut
                atama var.
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
              <Button onClick={() => submit(false)} disabled={submitting}>
                {submitting ? "Atanıyor..." : "Ata"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={overlapCount !== null}
        onOpenChange={(o) => !o && setOverlapCount(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Çakışan atama var</AlertDialogTitle>
            <AlertDialogDescription>
              Bu çalışana seçilen aralıkta {overlapCount} mevcut atama
              bulunuyor. Yine de eklemek istiyor musunuz?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Vazgeç</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void submit(true);
              }}
              disabled={submitting}
            >
              Yine de Ata
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={calendarConflict !== null}
        onOpenChange={(o) => !o && setCalendarConflict(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>İzin/Tatil günleri var</AlertDialogTitle>
            <AlertDialogDescription>
              {calendarConflict && (
                <>
                  Seçilen aralıkta
                  {calendarConflict.leaveDays > 0 && (
                    <> <b>{calendarConflict.leaveDays}</b> izin günü</>
                  )}
                  {calendarConflict.leaveDays > 0 &&
                    calendarConflict.holidayDays > 0 &&
                    " ve"}
                  {calendarConflict.holidayDays > 0 && (
                    <> <b>{calendarConflict.holidayDays}</b> resmi tatil</>
                  )}
                  {" "}var. Atamayı yine de yapmak istiyor musunuz?
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Vazgeç</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                setCalendarConflict(null);
                void submit(false, true);
              }}
              disabled={submitting}
            >
              Yine de Ata
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
