import { useActiveProjectScope } from "@/hooks/useActiveProjectScope";
import { schedulesOverlap, validDay } from "../../../convex/lib/shiftUx";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
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
  leaves: _leaves = [],
  holidays: _holidays = [],
  initial,
}: AssignShiftDialogProps) {
  const { projectId } = useActiveProjectScope();
  const { toast } = useToast();
  const assignShift = useMutation(api.shifts.assignShift);
  const [form, setForm] = useState<AssignmentFormValues>(EMPTY);
  const rangeValid = validDay(form.startDate) && validDay(form.endDate) && form.startDate <= form.endDate;
  const rangeLeaves = useQuery(api.leaves.listForRange, open && rangeValid && projectId ? { startDate: form.startDate, endDate: form.endDate, projectId } : "skip");
  const rangeHolidays = useQuery(api.holidays.listForRange, open && rangeValid ? { startDate: form.startDate, endDate: form.endDate } : "skip");
  const employeeProject = employees.find(e => e._id === form.employeeId)?.projectId;
  const leaves = (rangeLeaves ?? []).filter(l => l.employeeId === form.employeeId);
  const holidays = (rangeHolidays ?? []).filter(h => !h.projectId || h.projectId === employeeProject);
  const calendarLoading = rangeValid && (rangeLeaves === undefined || rangeHolidays === undefined);
  const [employeeOpen, setEmployeeOpen] = useState(false);
  const [overlapCount, setOverlapCount] = useState<number | null>(null);
  const [calendarApproved, setCalendarApproved] = useState(false);
  const [calendarConflict, setCalendarConflict] = useState<{
    leaveDays: number;
    holidayDays: number;
  } | null>(null);

  useEffect(() => { setCalendarApproved(false); }, [form.employeeId, form.startDate, form.endDate]);

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
    const shift = shifts.find(s => s._id === form.shiftId);
    if (!shift) return 0;
    return assignments.filter(a => {
      const other = shifts.find(s => s._id === a.shiftId);
      return a.employeeId === form.employeeId && other && schedulesOverlap(form, shift, a, other);
    }).length;
  }, [assignments, shifts, form]);

  const selectedEmployee = employees.find((e) => e._id === form.employeeId);

  const { run: submit, pending: submitting } = useAsyncAction(async (forceConfirm: boolean, skipCalendarCheck: boolean = false) => {
    if (calendarLoading) throw new Error("İzin ve tatiller kontrol ediliyor");
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

    if (!skipCalendarCheck && !calendarApproved && !forceConfirm) {
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

    try {
      const emp = employees.find((e) => e._id === result.data.employeeId);
      await assignShift({
        employeeId: result.data.employeeId as Id<"employees">,
        shiftId: result.data.shiftId as Id<"shifts">,
        projectId: emp?.projectId,
        startDate: result.data.startDate,
        endDate: result.data.endDate,
        forceConfirm,
        calendarConfirmed: skipCalendarCheck || calendarApproved,
      });
      toast({ title: "Vardiya atandı" });
      setOverlapCount(null);
      onOpenChange(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Atama yapılamadı";
      const overlapMatch = /OVERLAP:(\d+)/.exec(msg);
      if (overlapMatch) {
        setOverlapCount(Number(overlapMatch[1]));
      } else if (msg.includes("CALENDAR:")) {
        setCalendarConflict({ leaveDays: 0, holidayDays: 0 });
      } else {
        throw e;
      }
    }
  }, { error: "Atama yapılamadı" });

  return (
    <>
      <Dialog open={open} onOpenChange={value => { if (!submitting) onOpenChange(value); }}>
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
                disabled={submitting || calendarLoading}
              >
                İptal
              </Button>
              <Button onClick={() => submit(false)} disabled={submitting || calendarLoading}>
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
            <div className="text-sm">{assignments.filter(a => a.employeeId === form.employeeId && (() => { const shift = shifts.find(s => s._id === form.shiftId); const other = shifts.find(s => s._id === a.shiftId); return shift && other && schedulesOverlap(form, shift, a, other); })()).map(a => <p key={a._id}>{shifts.find(s => s._id === a.shiftId)?.name} · {a.startDate}–{a.endDate}</p>)}</div>
            <AlertDialogDescription>
              Bu çalışana seçilen aralıkta {overlapCount} mevcut atama
              bulunuyor. Mevcut atamalar korunur; çakışan ek atamaya izin vermek istiyor musunuz?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting || calendarLoading}>Vazgeç</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void submit(true, calendarApproved);
              }}
              disabled={submitting || calendarLoading}
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
            <AlertDialogCancel disabled={submitting || calendarLoading}>Vazgeç</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                setCalendarApproved(true);
                setCalendarConflict(null);
                void submit(false, true);
              }}
              disabled={submitting || calendarLoading}
            >
              Yine de Ata
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
