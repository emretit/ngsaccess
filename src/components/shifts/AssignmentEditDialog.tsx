import { WeekdaySelection } from "./WeekdaySelection";
import { ShiftSelect } from "./ShiftSelect";
import { shiftMessage, shortDate, shiftTimeLabel } from "./lib/planning";
import { shiftError } from "./lib/shiftError";
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
import { ConfirmDestructive } from "@/components/shared/ConfirmDestructive";
import { useUnsavedChangesGuard } from "@/components/shared/UnsavedChangesDialog";
import { notify } from "@/lib/notify";
import { DAYS, type Assignment, type Shift } from "./lib/planning";
import {
  bulkAssignmentFormSchema,
  type BulkAssignmentFormValues,
} from "./assignmentFormSchema";
import { DateInput } from "@/components/ui/date-picker";
interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignment: Assignment | null;
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
}: Props & { assignment: Assignment }) {
  const [values, setValues] = useState<BulkAssignmentFormValues>({
    employeeIds: [assignment.employeeId],
    shiftId: assignment.shiftId,
    startDate: assignment.startDate,
    endDate: assignment.endDate,
    specificDays: !!assignment.weekPattern?.length,
    weekPattern: DAYS.filter(([code]) =>
      assignment.weekPattern?.includes(code),
    ).map(([code]) => code),
  });
  const [baseline, setBaseline] = useState(() => JSON.stringify(values));
  const guard = useUnsavedChangesGuard(JSON.stringify(values) !== baseline);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<ReturnType<typeof shiftError>>();
  const [forceConfirm, setForceConfirm] = useState(false);
  const [calendarConfirmed, setCalendarConfirmed] = useState(false);
  const [confirm, setConfirm] = useState<"save" | "delete" | null>(null);
  const [pending, setPending] = useState(false);
  const lock = useRef(false);
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
    const parsed = bulkAssignmentFormSchema.safeParse(values);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues)
        next[String(issue.path[0])] = issue.message;
      setErrors(next);
      requestAnimationFrame(() =>
        document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      );
      return;
    }
    setErrors({});
    setConfirm("save");
  };
  const commit = async () => {
    if (lock.current) throw new Error("İşlem sürüyor");
    lock.current = true;
    setPending(true);
    setServerError(undefined);
    try {
      if (confirm === "delete") await remove({ assignmentId: assignment._id });
      else
        await update({
          assignmentId: assignment._id,
          shiftId: values.shiftId as Id<"shifts">,
          startDate: values.startDate,
          endDate: values.endDate,
          weekPattern: values.specificDays ? values.weekPattern : [],
          forceConfirm,
          calendarConfirmed,
        });
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
              {employeeName} · {shiftName} · {shortDate(assignment.startDate)}–
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
            <FormFieldWrapper
              htmlFor="edit-shift"
              label="Vardiya"
              error={errors.shiftId}
            >
              <ShiftSelect id="edit-shift" label="Vardiya" value={values.shiftId}
                invalid={!!errors.shiftId} describedBy={errors.shiftId ? "edit-shift-error" : undefined}
                onChange={(shiftId) => change({ ...values, shiftId })}
                options={shifts.filter(s => s.isActive !== false || s._id === assignment.shiftId).map(s => ({ value: s._id, label: `${s.name} · ${shiftTimeLabel(s)}` }))} />
            </FormFieldWrapper>
            <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-3">
              {(["startDate", "endDate"] as const).map((key) => (
                <FormFieldWrapper
                  key={key}
                  htmlFor={`edit-${key}`}
                  label={key === "startDate" ? "Başlangıç" : "Bitiş"}
                  error={errors[key]}
                >
                  <DateInput
                    id={`edit-${key}`}
                    value={values[key]}
                    onChange={(value) => change({ ...values, [key]: value })}
                  />
                </FormFieldWrapper>
              ))}
            </div>
            <label className="flex gap-2 text-sm">
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
            )}
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
            <Button disabled={pending} onClick={prepare}>
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
        objectName={`${employeeName} · ${shiftName} · ${shortDate(assignment.startDate)}–${shortDate(assignment.endDate)}`}
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
