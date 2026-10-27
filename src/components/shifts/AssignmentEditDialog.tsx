import { planShiftIds } from "../../../convex/lib/shiftPlan";
import { AssignmentPatternEditor } from "./AssignmentPatternEditor";
import { assignmentFields, focusAssignmentError, planFormError, planSummary } from "./lib/planForm";
import type { DepartmentAssignment } from "./lib/planning";
import { WeekdaySelection } from "./WeekdaySelection";
import { ShiftSelect } from "./ShiftSelect";
import { shiftMessage, shortDate, shiftTimeLabel } from "./lib/planning";
import { shiftError } from "./lib/shiftError";
import { useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FormFieldWrapper } from "@/components/shared/FormFieldWrapper";
import { DateRangeFields } from "@/components/shared/DateRangeFields";
import { ConfirmDestructive } from "@/components/shared/ConfirmDestructive";
import { useUnsavedChangesGuard } from "@/components/shared/UnsavedChangesDialog";
import { notify } from "@/lib/notify";
import { DAYS, type Assignment, type Shift } from "./lib/planning";
import {
  bulkAssignmentFormSchema,
  type BulkAssignmentFormValues,
} from "./assignmentFormSchema";
interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignment: Assignment | DepartmentAssignment | null;
  shifts: Shift[];
  shiftName: string;
  employeeName: string;
}
export function AssignmentEditDialog(props: Props) {
  return props.assignment && props.open ? (
    <EditForm
      key={props.assignment._id}
      {...props}
      assignment={props.assignment}
    />
  ) : null;
}
function EditForm({
  open,
  onOpenChange,
  assignment,
  shifts,
  shiftName,
  employeeName,
}: Props & { assignment: Assignment | DepartmentAssignment }) {
  const [values, setValues] = useState<BulkAssignmentFormValues>({
    target: "employeeId" in assignment ? "people" : "department",
    departmentId: "departmentId" in assignment ? assignment.departmentId : undefined,
    employeeIds: "employeeId" in assignment ? [assignment.employeeId] : [],
    plan: assignment.plan,
    shiftId: assignment.shiftId,
    startDate: assignment.startDate,
    endDate: assignment.endDate,
    specificDays: !!assignment.weekPattern?.length,
    weekPattern: DAYS.filter(([code]) =>
      assignment.weekPattern?.includes(code),
    ).map(([code]) => code),
  });
  const assignmentLabel = assignment.plan && planShiftIds(assignment.plan).length > 1 ? planSummary(assignment.plan) : shiftName;
  const [baseline, setBaseline] = useState(() => JSON.stringify(values));
  const guard = useUnsavedChangesGuard(JSON.stringify(values) !== baseline);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<ReturnType<typeof shiftError>>();
  const [forceConfirm, setForceConfirm] = useState(false);
  const [calendarConfirmed, setCalendarConfirmed] = useState(false);
  const [confirm, setConfirm] = useState<"save" | "delete" | null>(null);
  const [pending, setPending] = useState(false);
  const lock = useRef(false);
  const planErrorRef = useRef<HTMLParagraphElement>(null);
  const selectedShiftIds = values.plan ? planShiftIds(values.plan) : [values.shiftId];
  const hasInactiveShift = shifts.some(shift => shift.isActive === false && selectedShiftIds.includes(shift._id));
  const updateDepartment = useMutation(api.shiftPlans.updateDepartmentAssignment);
  const removeDepartment = useMutation(api.shiftPlans.removeDepartmentAssignment);
  const update = useMutation(api.shifts.updateAssignment);
  const remove = useMutation(api.shifts.removeAssignment);
  const close = () => {
    if (!lock.current) guard.requestClose(() => onOpenChange(false));
  };
  const change = (next: BulkAssignmentFormValues) => {
    setValues(next);
    setForceConfirm(false);
    setCalendarConfirmed(false);
    setServerError(undefined);
  };
  const prepare = () => {
    if (hasInactiveShift) return;
    const parsed = bulkAssignmentFormSchema.safeParse(values);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues)
        next[String(issue.path[0])] = issue.message;
      setErrors(next);
      focusAssignmentError(planErrorRef, Boolean(next.plan || ((assignment.plan || "departmentId" in assignment) && next.shiftId)));
      return;
    }
    const planError = planFormError(parsed.data, shifts);
    if (planError) { setErrors({ plan: planError }); focusAssignmentError(planErrorRef, true); return; }
    setErrors({});
    setConfirm("save");
  };
  const commit = async () => {
    if (lock.current) throw new Error("İşlem sürüyor");
    lock.current = true;
    setPending(true);
    setServerError(undefined);
    try {
      if ("departmentId" in assignment) {
        if (confirm === "delete") await removeDepartment({ departmentAssignmentId: assignment._id });
        else await updateDepartment({ departmentAssignmentId: assignment._id, ...assignmentFields(values, Boolean(assignment.plan)), weekPattern: values.plan && values.plan.kind !== "weekly" ? [] : values.specificDays ? values.weekPattern : [], forceConfirm });
      } else {
        if (confirm === "delete") await remove({ assignmentId: assignment._id });
        else await update({ assignmentId: assignment._id, ...assignmentFields(values, Boolean(assignment.plan)), weekPattern: values.plan && values.plan.kind !== "weekly" ? [] : values.specificDays ? values.weekPattern : [], forceConfirm, calendarConfirmed });
      }
      notify.success(
        confirm === "delete"
          ? "Atama serisi silindi"
          : "Atama serisi güncellendi",
      );
      setBaseline(JSON.stringify(values));
      onOpenChange(false);
    } catch (error) {
      setServerError(shiftError(error));
      throw error;
    } finally {
      lock.current = false;
      setPending(false);
    }
  };
  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) close();
        }}
      >
        <DialogContent className="[&_button]:max-sm:min-h-11 [&_label:has(input[type=checkbox])]:min-h-11 [&_label:has(input[type=checkbox])]:items-center sm:max-w-[520px] max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Tüm atama serisini düzenle</DialogTitle>
            <DialogDescription>
              {employeeName} · {assignmentLabel} · {shortDate(assignment.startDate)}–
              {shortDate(assignment.endDate)}. Kaydetme ve silme tüm seriye uygulanır. Tek
              gün istisnası desteklenmiyor.
            </DialogDescription>
          </DialogHeader>
          {serverError && (
            <p role="alert" className="text-sm text-danger">
              {shiftMessage(serverError.message)}
            </p>
          )}
          <fieldset disabled={pending} className="space-y-4">
            {!assignment.plan && !("departmentId" in assignment) && errors.plan && <p ref={planErrorRef} tabIndex={-1} role="alert" className="text-sm text-danger">{errors.plan}</p>}
            {(assignment.plan || "departmentId" in assignment) ? <AssignmentPatternEditor values={values} shifts={shifts} onChange={change} errors={errors} errorRef={planErrorRef} /> : <FormFieldWrapper
              htmlFor="edit-shift"
              label="Vardiya"
              error={errors.shiftId}
            >
              <ShiftSelect id="edit-shift" label="Vardiya" value={values.shiftId}
                invalid={!!errors.shiftId} describedBy={[errors.shiftId ? "edit-shift-error" : "", hasInactiveShift ? "edit-inactive-shift" : ""].filter(Boolean).join(" ") || undefined}
                onChange={(shiftId) => change({ ...values, shiftId })}
                options={shifts.filter(s => s.isActive !== false || s._id === assignment.shiftId).map(s => ({ value: s._id, label: `${s.name} · ${shiftTimeLabel(s)}` }))} />
            </FormFieldWrapper>}
            {hasInactiveShift && <p id="edit-inactive-shift" role="status" className="text-xs text-muted-foreground">Bu vardiya pasif; kaydetmek için aktif bir vardiya seçin.</p>}
            <DateRangeFields idPrefix="edit" layout="row" labels={{ start: "Başlangıç", end: "Bitiş" }}
              value={{ start: values.startDate, end: values.endDate }}
              errors={{ start: errors.startDate, end: errors.endDate }}
              onChange={(next) => change({ ...values, startDate: next.start, endDate: next.end })} />
            {!(assignment.plan || "departmentId" in assignment) && <><label className="flex gap-2 text-sm">
              <input
                type="checkbox" className="size-6 shrink-0 accent-primary"
                checked={values.specificDays}
                onChange={(e) =>
                  change({ ...values, specificDays: e.target.checked })
                }
              />
              Belirli günler
            </label>
            {values.specificDays ? (
              <WeekdaySelection id="assignment-days" value={values.weekPattern} error={errors.weekPattern}
                    onChange={(weekPattern) => change({ ...values, weekPattern })} />
            ) : (
              <p className="text-sm">Her gün</p>
            )}</>}
            <p className="text-xs text-muted-foreground">
              {shortDate(values.startDate)}–{shortDate(values.endDate)} dahil tüm seri. Mevcut diğer
              atamalar korunur.
            </p>
            {serverError?.code === "SHIFT_OVERLAP" && (
              <label className="flex gap-2 text-sm">
                <input
                  type="checkbox" className="size-6 shrink-0 accent-primary"
                  checked={forceConfirm}
                  onChange={(e) => setForceConfirm(e.target.checked)}
                />
                Mevcut vardiyayla çakışmayı onaylıyorum.
              </label>
            )}
            {serverError?.code === "SHIFT_CALENDAR_CONFLICT" && (
              <label className="flex gap-2 text-sm">
                <input
                  type="checkbox" className="size-6 shrink-0 accent-primary"
                  checked={calendarConfirmed}
                  onChange={(e) => setCalendarConfirmed(e.target.checked)}
                />
                İzin ve tatil çakışmasına rağmen tüm seriyi güncellemeyi
                onaylıyorum.
              </label>
            )}
          </fieldset>
          <div className="sticky bottom-0 bg-surface flex flex-wrap gap-2 justify-between py-3">
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => setConfirm("delete")}
            >
              Tüm seriyi sil
            </Button>
            <Button variant="outline" disabled={pending} onClick={close}>
              Vazgeç
            </Button>
            <Button disabled={pending || hasInactiveShift} onClick={prepare}>
              Kaydet
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <ConfirmDestructive
        open={confirm !== null}
        onOpenChange={(next) => {
          if (!next) setConfirm(null);
        }}
        title={
          confirm === "delete"
            ? "Tüm seri silinsin mi?"
            : "Tüm seri güncellensin mi?"
        }
        objectName={`${employeeName} · ${assignmentLabel} · ${shortDate(assignment.startDate)}–${shortDate(assignment.endDate)}`}
        effects={[
          confirm === "delete"
            ? "Bu atamanın tüm tarih aralığı kalıcı silinir."
            : `Tüm seri ${shortDate(values.startDate)}–${shortDate(values.endDate)} ve seçili günlerle güncellenir.`,
        ]}
        confirmLabel={
          confirm === "delete" ? "Tüm seriyi sil" : "Tüm seriyi güncelle"
        }
        onConfirm={commit}
      />
      {guard.dialog}
    </>
  );
}
