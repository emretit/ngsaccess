import { AssignmentPatternEditor } from "./AssignmentPatternEditor";
import { DepartmentTargetPicker, DepartmentPreviewPanel } from "./DepartmentTargetPicker";
import { assignmentFields, bulkAssignmentRequest, departmentAssignmentRequest, focusAssignmentError, planFormError } from "./lib/planForm";
import { shiftMessage, shortDate, shiftTimeLabel } from "./lib/planning";
import { useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
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
import { Input } from "@/components/ui/input";
import { FormFieldWrapper } from "@/components/shared/FormFieldWrapper";
import { useUnsavedChangesGuard } from "@/components/shared/UnsavedChangesDialog";
import { PlanQueryBoundary } from "./PlanQueryBoundary";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { errorMessage } from "@/lib/notify";
import {
  bulkAssignmentFormSchema,
  type BulkAssignmentFormValues,
} from "./assignmentFormSchema";
import {
  decisionLabels,
  decisionTone,
  previewSummary,
  resultSummary,
  istanbulToday,
  type Apply,
  type Employee,
  type Shift,
  type Preview,
} from "./lib/planning";
import { LEAVE_TYPE_LABEL_TR } from "./lib/calendarOverlays";
import { DateInput } from "@/components/ui/date-picker";
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
  const [values, setValues] = useState<BulkAssignmentFormValues>(() => ({
    target: "people",
    departmentId: "",
    employeeIds: initial?.employeeIds ?? [],
    // Pasif vardiya seçeneklerde yok; önceden seçilmiş gelirse görünmeyen değer gönderilmesin.
    shiftId: shifts.some(s => s._id === initial?.shiftId && s.isActive !== false) ? initial?.shiftId ?? "" : "",
    startDate: initial?.startDate ?? istanbulToday(),
    endDate: initial?.endDate ?? istanbulToday(),
    specificDays: false,
    weekPattern: [],
  }));
  const [baseline, setBaseline] = useState(() => JSON.stringify(values));
  const guard = useUnsavedChangesGuard(JSON.stringify(values) !== baseline);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState("");
  const [search, setSearch] = useState("");
  const [previewValues, setPreviewValues] =
    useState<BulkAssignmentFormValues | null>(null);
  const [forceConfirm, setForceConfirm] = useState(false);
  const [calendarConfirmed, setCalendarConfirmed] = useState(false);
  const [result, setResult] = useState<Apply | null>(null);
  const [pending, setPending] = useState(false);
  const lock = useRef(false);
  const planErrorRef = useRef<HTMLParagraphElement>(null);
  const [departmentSaved, setDepartmentSaved] = useState(false);
  const assignDepartment = useMutation(api.shiftPlans.assignDepartment);
  const apply = useMutation(api.shifts.bulkAssignShift);
  const close = () => {
    if (!lock.current) guard.requestClose(() => onOpenChange(false));
  };
  const change = (next: BulkAssignmentFormValues) => {
    setValues(next);
    setPreviewValues(null);
    setForceConfirm(false);
    setCalendarConfirmed(false);
    setServerError("");
  };
  const prepare = () => {
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
    setPreviewValues(parsed.data);
  };
  const save = async () => {
    if (!previewValues || lock.current || result) return;
    lock.current = true;
    setPending(true);
    setServerError("");
    try {
      if (previewValues.target === "department") {
        await assignDepartment(departmentAssignmentRequest(previewValues, projectId, forceConfirm));
        setDepartmentSaved(true);
        setBaseline(JSON.stringify(values));
        return;
      }
      const response = await apply(bulkAssignmentRequest(previewValues, projectId, forceConfirm, calendarConfirmed));
      setResult(response);
      setBaseline(JSON.stringify(values));
    } catch (error) {
      setServerError(errorMessage(error));
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
        <DialogContent className="[&_button]:max-sm:min-h-11 [&_label:has(input[type=checkbox])]:min-h-11 [&_label:has(input[type=checkbox])]:items-center sm:max-w-[560px] max-h-[90dvh] overflow-y-auto min-w-0">
          <DialogHeader>
            <DialogTitle>Vardiya ata</DialogTitle>
            <DialogDescription>
              Kişi veya departman seçin, deseni belirleyin ve önizlemeyi onaylayın.
            </DialogDescription>
          </DialogHeader>
          {serverError && (
            <p role="alert" className="text-danger text-sm">
              {shiftMessage(serverError)}
            </p>
          )}
          {departmentSaved ? <section role="status" className="space-y-3"><p>Departman ataması oluşturuldu.</p><Button onClick={() => onOpenChange(false)}>Kapat</Button></section> : result ? (
            <section role="status" className="space-y-3">
              <h3 className="font-semibold">
                {result.insertedCount ? "Atama sonucu" : "Atama yapılamadı"}
              </h3>
              <p>{resultSummary(result)}</p>
              <ul className="divide-y">
                {result.results.map((item) => (
                  <li key={item.employeeId} className="py-2 space-y-1">
                    <p>
                      {item.employeeName ||
                        employees.find((e) => e._id === item.employeeId)
                          ?.firstName ||
                        "Çalışan"}
                    </p>
                    <StatusBadge
                      className="max-w-full whitespace-normal text-left"
                      tone={decisionTone(item.status)}
                    >
                      {decisionLabels[item.status]}
                    </StatusBadge>
                    <p className="text-xs">{shiftMessage(item.reason)}</p>
                  </li>
                ))}
              </ul>
              <Button
                variant="outline"
                disabled={!result.results.some((r) => r.status !== "assigned")}
                onClick={() => {
                  const skipped = result.results
                    .filter((r) => r.status !== "assigned")
                    .map((r) => r.employeeId);
                  change({ ...values, employeeIds: skipped });
                  setResult(null);
                }}
              >
                Yalnız atlananları incele
              </Button>
              <Button onClick={() => onOpenChange(false)}>Kapat</Button>
            </section>
          ) : (
            <>
              <fieldset disabled={pending} className="space-y-4 min-w-0">
                <h3 className="text-sm font-semibold">1. Kime</h3>
                <div role="group" aria-label="Atama hedefi" className="flex gap-1">
                  <Button type="button" variant={values.target !== "department" ? "default" : "outline"} aria-pressed={values.target !== "department"} onClick={() => change({ ...values, target: "people" })}>Kişiler</Button>
                  <Button type="button" variant={values.target === "department" ? "default" : "outline"} aria-pressed={values.target === "department"} onClick={() => change({ ...values, target: "department" })}>Departman</Button>
                </div>
                {values.target === "department" ? <DepartmentTargetPicker projectId={projectId} value={values.departmentId ?? ""} previewValues={bulkAssignmentFormSchema.safeParse(values).success && !planFormError(values, shifts) ? values : undefined} onChange={departmentId => change({ ...values, departmentId })} error={errors.departmentId} /> : <>
                <FormFieldWrapper
                  htmlFor="assignment-people"
                  label="Çalışanlar"
                  error={errors.employeeIds}
                >
                  <Input
                    id="assignment-people"
                    type="search"
                    placeholder="Çalışan ara"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </FormFieldWrapper>
                <p className="text-xs break-words">
                  Seçilen {values.employeeIds.length} kişi:{" "}
                  {employees
                    .filter((e) => values.employeeIds.includes(e._id))
                    .map((e) => `${e.firstName} ${e.lastName}`)
                    .join(", ") || "Henüz seçim yok"}
                </p>
                <div className="max-h-40 overflow-y-auto border rounded-md divide-y">
                  {employees
                    .filter((e) =>
                      `${e.firstName} ${e.lastName} ${e.email ?? ""}`
                        .toLocaleLowerCase("tr-TR")
                        .includes(search.toLocaleLowerCase("tr-TR")),
                    )
                    .map((e) => (
                      <label key={e._id} className="flex gap-2 p-2 text-sm">
                        <input
                          type="checkbox" className="size-6 shrink-0 accent-primary"
                          checked={values.employeeIds.includes(e._id)}
                          onChange={() =>
                            change({
                              ...values,
                              employeeIds: values.employeeIds.includes(e._id)
                                ? values.employeeIds.filter(
                                    (id) => id !== e._id,
                                  )
                                : [...values.employeeIds, e._id],
                            })
                          }
                        />
                        <span className="min-w-0 break-words">
                          {e.firstName} {e.lastName}
                          <span className="block text-xs text-muted-foreground break-all">
                            {e.email}
                          </span>
                        </span>
                      </label>
                    ))}
                </div>
                </>}
                <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-3">
                  {(["startDate", "endDate"] as const).map((key) => (
                    <FormFieldWrapper
                      key={key}
                      htmlFor={`assignment-${key}`}
                      label={key === "startDate" ? "Başlangıç" : "Bitiş"}
                      error={errors[key]}
                    >
                      <DateInput
                        id={`assignment-${key}`}
                        value={values[key]}
                        onChange={(value) => change({ ...values, [key]: value })}
                      />
                    </FormFieldWrapper>
                  ))}
                </div>
                <AssignmentPatternEditor values={values} shifts={shifts} onChange={change} errors={errors} errorRef={planErrorRef} />
                <p className="text-xs text-muted-foreground">
                  {shortDate(values.startDate)}–{shortDate(values.endDate)} dahil aralık ·{" "}
                  {values.target === "department" ? "Departman ve alt departmanlar" : `${values.employeeIds.length} kişi`}. Gece vardiyaları ertesi güne
                  devam edebilir.
                </p>
              </fieldset>
              {previewValues && (
                <PlanQueryBoundary
                  resetKey={JSON.stringify([
                    previewValues,
                    forceConfirm,
                    calendarConfirmed,
                  ])}
                >
                  {previewValues.target === "department" ? <DepartmentPreviewPanel values={previewValues} projectId={projectId} forceConfirm={forceConfirm} setForceConfirm={setForceConfirm} pending={pending} onSave={() => void save()} /> : <PreviewPanel
                    values={previewValues}
                    projectId={projectId}
                    forceConfirm={forceConfirm}
                    calendarConfirmed={calendarConfirmed}
                    setForceConfirm={setForceConfirm}
                    setCalendarConfirmed={setCalendarConfirmed}
                    pending={pending}
                    onSave={() => void save()}
                  />}
                </PlanQueryBoundary>
              )}
              <div className="sticky bottom-0 bg-surface flex flex-wrap justify-end gap-2 border-t py-3">
                <Button variant="outline" disabled={pending} onClick={close}>
                  Vazgeç
                </Button>
                <Button variant={previewValues ? "outline" : "default"} disabled={pending} onClick={prepare}>
                  {previewValues ? "Önizlemeyi yenile" : "Önizle"}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      {guard.dialog}
    </>
  );
}
export function PreviewPanel({
  values,
  projectId,
  forceConfirm,
  calendarConfirmed,
  setForceConfirm,
  setCalendarConfirmed,
  pending,
  onSave,
}: {
  values: BulkAssignmentFormValues;
  projectId: Id<"projects">;
  forceConfirm: boolean;
  calendarConfirmed: boolean;
  setForceConfirm: (value: boolean) => void;
  setCalendarConfirmed: (value: boolean) => void;
  pending: boolean;
  onSave: () => void;
}) {
  const preview = useQuery(api.shifts.previewBulkAssign, {
    projectId,
    employeeIds: values.employeeIds as Id<"employees">[],
    ...assignmentFields(values),
    forceConfirm,
    calendarConfirmed,
  });
  if (!preview)
    return <SectionSkeleton label="Atama önizlemesi hesaplanıyor" />;
  return (
    <section ref={(node) => { if (node && !node.dataset.shown) { node.dataset.shown = "1"; node.querySelector("[data-apply]")?.scrollIntoView?.({ block: "center" }); } }} className="space-y-3 border-t pt-3">
      <h3 className="font-medium">3. Önizleme</h3>
      <p role="status" className="text-sm">
        {previewSummary(preview.summary)}
      </p>
      <ul className="divide-y">
        {preview.results.map((item) => (
          <Decision key={item.employeeId} item={item} />
        ))}
      </ul>
      {preview.results.some((r) => r.conflict) && (
        <label className="flex gap-2 text-sm">
          <input
            type="checkbox" className="size-6 shrink-0 accent-primary"
            disabled={pending}
            checked={forceConfirm}
            onChange={(e) => setForceConfirm(e.target.checked)}
          />
          Vardiya çakışmalarına rağmen ek atama oluşturmayı onaylıyorum.
        </label>
      )}
      {preview.results.some((r) => r.leave || r.holiday) && (
        <label className="flex gap-2 text-sm">
          <input
            type="checkbox" className="size-6 shrink-0 accent-primary"
            disabled={pending}
            checked={calendarConfirmed}
            onChange={(e) => setCalendarConfirmed(e.target.checked)}
          />
          İzin ve tatil günlerine rağmen tüm seriyi atamayı onaylıyorum.
        </label>
      )}
      <p className="text-xs text-muted-foreground">
        Uygulamada yeniden kontrol edilir. Uygun kişiler atanır; diğerlerinin
        gerekçeleri sonuçta kalır.
      </p>
      <Button data-apply onClick={onSave} disabled={pending}>
        {pending ? "Atanıyor…" : "Önizlenen kişilere uygula"}
      </Button>
    </section>
  );
}
export function Decision({ item }: { item: Preview["results"][number] }) {
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
        {shiftMessage(item.reason)} · {item.occurrenceCount} başlangıç günü
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
