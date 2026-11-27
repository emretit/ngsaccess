import { invalidatePdksSnapshots } from "@/lib/pdksInvalidation";
import { ShiftSelect } from "./ShiftSelect";
import { shiftScheduleSummary } from "../../../convex/lib/shiftSchedule";
import { bulkAssignmentRequest, focusAssignmentError, planFormError, withShiftSchedule } from "./lib/planForm";
import { shiftMessage, shortDate, shiftTimeLabel } from "./lib/planning";
import { AssignmentEmployeeTree } from "./AssignmentEmployeeTree";
import { useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FormFieldWrapper } from "@/components/shared/FormFieldWrapper";
import { AssignmentDateFields } from "./AssignmentDateFields";
import { OPEN_SHIFT_END } from "../../../convex/lib/shiftRange";
import { useUnsavedChangesGuard } from "@/components/shared/UnsavedChangesDialog";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { errorMessage, notify } from "@/lib/notify";
import {
  bulkAssignmentFormSchema,
  type BulkAssignmentFormValues,
} from "./assignmentFormSchema";
import {
  DEFAULT_WORKING_DAYS,
  decisionLabels,
  decisionTone,
  resultSummary,
  istanbulToday,
  type Apply,
  type Employee,
  type Shift,
  type Preview,
} from "./lib/planning";
import { LEAVE_TYPE_LABEL_TR } from "./lib/calendarOverlays";
export interface AssignShiftDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: Id<"projects">;
  employees: Employee[];
  shifts: Shift[];
  initial?: { shiftId?: Id<"shifts">; employeeIds?: string[]; startDate?: string; endDate?: string };
}
export function AssignShiftDialog({
  open,
  onOpenChange,
  projectId,
  employees,
  shifts,
  initial,
}: AssignShiftDialogProps) {
  const [draftValues, setValues] = useState<BulkAssignmentFormValues>(() => ({
    target: "people",
    employeeIds: initial?.employeeIds ?? [],
    // Pasif vardiya seçeneklerde yok; önceden seçilmiş gelirse görünmeyen değer gönderilmesin.
    shiftId: shifts.some(s => s._id === initial?.shiftId && s.isActive !== false) ? initial?.shiftId ?? "" : "",
    startDate: initial?.startDate ?? istanbulToday(),
    endDate: initial?.endDate ?? istanbulToday(),
    weekPattern: [...DEFAULT_WORKING_DAYS],
  }));
  const values = withShiftSchedule(draftValues, shifts);
  const [baseline, setBaseline] = useState(() => JSON.stringify(values));
  const guard = useUnsavedChangesGuard(JSON.stringify(values) !== baseline);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState("");
  const [forceConfirm, setForceConfirm] = useState(false);
  const [calendarConfirmed, setCalendarConfirmed] = useState(false);
  const [result, setResult] = useState<Apply | null>(null);
  const [pending, setPending] = useState(false);
  const lock = useRef(false);
  const planErrorRef = useRef<HTMLParagraphElement>(null);
  const apply = useMutation(api.shifts.bulkAssignShift);
  const close = () => {
    if (!lock.current) guard.requestClose(() => onOpenChange(false));
  };
  const change = (next: BulkAssignmentFormValues) => {
    setValues(next);
    setResult(null);
    setForceConfirm(false);
    setCalendarConfirmed(false);
    setServerError("");
  };
  const save = async () => {
    if (lock.current) return;
    const parsed = bulkAssignmentFormSchema.safeParse(values);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues)
        next[String(issue.path[0])] = issue.message;
      setErrors(next);
      focusAssignmentError(planErrorRef, Boolean(next.plan || next.shiftId));
      return;
    }
    const planError = planFormError(parsed.data, shifts);
    if (planError) { setErrors({ plan: planError }); focusAssignmentError(planErrorRef, true); return; }
    setErrors({});
    lock.current = true;
    setPending(true);
    setServerError("");
    try {
      const response = await apply(bulkAssignmentRequest(parsed.data, projectId, forceConfirm, calendarConfirmed));
      if (response.insertedCount > 0) invalidatePdksSnapshots();
      const remaining = response.results.filter(item => item.status !== "assigned");
      if (remaining.length === 0) {
        notify.success(`${response.insertedCount} çalışana vardiya atandı.`);
        setBaseline(JSON.stringify(values));
        onOpenChange(false);
      } else {
        const nextValues = { ...parsed.data, employeeIds: remaining.map(item => item.employeeId) };
        setValues(nextValues);
        setResult(response);
        setForceConfirm(false);
        setCalendarConfirmed(false);
        setBaseline(JSON.stringify(nextValues));
      }
    } catch (error) {
      setServerError(errorMessage(error));
    } finally {
      lock.current = false;
      setPending(false);
    }
  };
  const unassigned = result?.results.filter(item => item.status !== "assigned") ?? [];
  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) close();
        }}
      >
        <DialogContent className="[&_button]:max-sm:min-h-11 [&_label:has(input[type=checkbox])]:min-h-11 [&_label:has(input[type=checkbox])]:items-center sm:max-w-[560px] max-h-[90dvh] overflow-y-auto min-w-0">
          <DialogHeader>
            <DialogTitle>Vardiya ata</DialogTitle>
            <DialogDescription>
              Vardiya, çalışan ve tarih seçin. Bitiş tarihi için Süresiz seçebilirsiniz.
            </DialogDescription>
          </DialogHeader>
          {serverError && (
            <p role="alert" className="text-danger text-sm">
              {shiftMessage(serverError)}
            </p>
          )}
          <fieldset disabled={pending} className="space-y-4 min-w-0">
            <FormFieldWrapper htmlFor="assignment-shift" label="Vardiya" error={errors.shiftId || errors.plan}>
              <ShiftSelect id="assignment-shift" label="Vardiya" value={values.shiftId} placeholder="Vardiya seçin"
                options={shifts.filter(shift => shift.isActive !== false).map(shift => ({ value: shift._id, label: `${shift.name} · ${shiftTimeLabel(shift)}` }))}
                onChange={shiftId => change({ ...values, shiftId })} invalid={Boolean(errors.shiftId || errors.plan)} />
            </FormFieldWrapper>
            {values.shiftId && <p className="text-xs text-muted-foreground">{shiftScheduleSummary(shifts.find(shift => shift._id === values.shiftId) ?? {})}</p>}
            {(errors.plan || errors.shiftId) && <p ref={planErrorRef} tabIndex={-1} role="alert" className="text-xs text-danger">{errors.plan || errors.shiftId}</p>}
            <AssignmentEmployeeTree projectId={projectId} employees={employees} selectedIds={values.employeeIds}
              onChange={employeeIds => change({ ...values, employeeIds })} error={errors.employeeIds} />
            <AssignmentDateFields idPrefix="assignment" startDate={values.startDate} endDate={values.endDate}
              errors={errors} onChange={dates => change({ ...values, ...dates })} />
          </fieldset>
          {result && (
            <section role="status" className="space-y-3 rounded-md border p-3 text-sm">
              <h3 className="font-semibold">{result.insertedCount ? "Bazı çalışanlara atama yapılamadı" : "Atama yapılamadı"}</h3>
              <p>{resultSummary(result)}</p>
              <ul className="divide-y">
                {unassigned.map(item => <Decision key={item.employeeId} item={item} unlimited={values.endDate === OPEN_SHIFT_END} />)}
              </ul>
              {unassigned.some(item => item.conflict) && (
                <label className="flex items-start gap-2">
                  <input type="checkbox" className="size-4 shrink-0 accent-primary" disabled={pending}
                    checked={forceConfirm} onChange={event => setForceConfirm(event.target.checked)} />
                  Vardiya çakışmalarına rağmen ek atama oluşturmayı onaylıyorum.
                </label>
              )}
              {unassigned.some(item => item.leave || item.holiday) && (
                <label className="flex items-start gap-2">
                  <input type="checkbox" className="size-4 shrink-0 accent-primary" disabled={pending}
                    checked={calendarConfirmed} onChange={event => setCalendarConfirmed(event.target.checked)} />
                  İzin ve tatil günlerine rağmen tüm seriyi atamayı onaylıyorum.
                </label>
              )}
            </section>
          )}
          <div className="sticky bottom-0 bg-surface flex flex-wrap justify-end gap-2 border-t py-3">
            <Button variant="outline" disabled={pending} onClick={close}>
              Vazgeç
            </Button>
            <Button disabled={pending} onClick={() => void save()}>
              {pending ? "Atanıyor…" : "Vardiya ata"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {guard.dialog}
    </>
  );
}
export function Decision({ item, unlimited = false }: { item: Preview["results"][number] | Apply["results"][number]; unlimited?: boolean }) {
  return (
    <li className="py-2 space-y-1 text-sm break-words">
      <p className="font-medium">{item.employeeName || "Çalışan"}</p>
      <StatusBadge
        className="max-w-full whitespace-normal text-left"
        tone={decisionTone(item.status)}
      >
        {decisionLabels[item.status]}
      </StatusBadge>
      <p className="text-xs">
        {shiftMessage(item.reason)} · {unlimited ? "Süresiz atama" : `${item.occurrenceCount} başlangıç günü`}
      </p>
      {item.conflict && (
        <p className="text-xs">
          {item.conflict.shiftName} · {shortDate(item.conflict.startDate)}–
          {shortDate(item.conflict.endDate)} · {shiftTimeLabel(item.conflict)}
        </p>
      )}
      {item.leave && (
        <p className="text-xs">
          {shortDate(item.leave.date)} ·{" "}
          {LEAVE_TYPE_LABEL_TR[item.leave.leaveType] ?? item.leave.leaveType}{" "}
          izni
        </p>
      )}
      {item.holiday && (
        <p className="text-xs">
          {shortDate(item.holiday.date)} · {item.holiday.name}
          {item.holiday.isHalfDay ? " · Yarım gün" : ""}
        </p>
      )}
    </li>
  );
}
