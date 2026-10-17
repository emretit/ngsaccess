import { useEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { minute } from "../../../../convex/lib/shiftUx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormFieldWrapper } from "@/components/shared/FormFieldWrapper";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { useUnsavedChangesGuard } from "@/components/shared/UnsavedChangesDialog";
import { errorMessage } from "@/lib/notify";
import { istanbulToday } from "../lib/planning";
import { shiftFormSchema, type ShiftFormValues } from "./shiftFormSchema";
export interface ShiftFormPayload {
  name: string;
  startTime: string;
  endTime: string;
  breakStart?: string | null;
  breakEnd?: string | null;
  lateToleranceMinutes?: number | null;
  earlyExitToleranceMinutes?: number | null;
  overtimeStartToleranceMinutes?: number | null;
  overtimeEnabled: boolean;
  isActive: boolean;
}
export interface EditingShift extends ShiftFormPayload {
  _id: Id<"shifts">;
}
interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (payload: ShiftFormPayload) => Promise<void> | void;
  onUpdate: (
    id: Id<"shifts">,
    payload: ShiftFormPayload,
  ) => Promise<void> | void;
  editingShift: EditingShift | null;
  onClose: () => void;
}
export function AddShiftDialog({
  open,
  onOpenChange,
  onAdd,
  onUpdate,
  editingShift,
  onClose,
}: Props) {
  const [values, setValues] = useState<ShiftFormValues>(() => ({
    name: editingShift?.name ?? "",
    startTime: editingShift?.startTime ?? "",
    endTime: editingShift?.endTime ?? "",
    breakStart: editingShift?.breakStart ?? "",
    breakEnd: editingShift?.breakEnd ?? "",
    lateToleranceMinutes: editingShift?.lateToleranceMinutes ?? undefined,
    earlyExitToleranceMinutes:
      editingShift?.earlyExitToleranceMinutes ?? undefined,
    overtimeStartToleranceMinutes:
      editingShift?.overtimeStartToleranceMinutes ?? undefined,
    overtimeEnabled: editingShift?.overtimeEnabled ?? true,
    isActive: editingShift?.isActive ?? true,
  }));
  const [breakEnabled, setBreakEnabled] = useState(!!editingShift?.breakStart);
  const [baseline, setBaseline] = useState(() =>
    JSON.stringify([values, breakEnabled]),
  );
  const guard = useUnsavedChangesGuard(
    JSON.stringify([values, breakEnabled]) !== baseline,
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState("");
  const [pending, setPending] = useState(false);
  const lock = useRef(false);
  const usage = useQuery(
    api.shifts.definitionUsage,
    editingShift ? { shiftId: editingShift._id } : "skip",
  );
  const [today, setToday] = useState(istanbulToday);
  useEffect(() => {
    const timer = window.setInterval(() => setToday(istanbulToday()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const usageStale = !!usage && usage.asOfDate !== today;
  const close = () => {
    if (!lock.current)
      guard.requestClose(() => {
        onOpenChange(false);
        onClose();
      });
  };
  const duration = (() => {
    try {
      const gross =
        (minute(values.endTime) - minute(values.startTime) + 1440) % 1440;
      const pause =
        breakEnabled && values.breakStart && values.breakEnd
          ? (minute(values.breakEnd) - minute(values.breakStart) + 1440) % 1440
          : 0;
      return { gross, pause, net: gross - pause };
    } catch {
      return null;
    }
  })();
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (lock.current || (editingShift && (!usage || usageStale))) return;
    const parsed = shiftFormSchema.safeParse({
      ...values,
      ...(!breakEnabled ? { breakStart: "", breakEnd: "" } : {}),
    });
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
    setServerError("");
    lock.current = true;
    setPending(true);
    const data = parsed.data;
    const payload: ShiftFormPayload = {
      ...data,
      breakStart: data.breakStart || null,
      breakEnd: data.breakEnd || null,
      lateToleranceMinutes: data.lateToleranceMinutes ?? null,
      earlyExitToleranceMinutes: data.earlyExitToleranceMinutes ?? null,
      overtimeStartToleranceMinutes: data.overtimeStartToleranceMinutes ?? null,
    };
    try {
      if (editingShift) await onUpdate(editingShift._id, payload);
      else await onAdd(payload);
      setBaseline(JSON.stringify([values, breakEnabled]));
      onClose();
    } catch (error) {
      setServerError(errorMessage(error));
    } finally {
      lock.current = false;
      setPending(false);
    }
  };
  const textFields = (
    keys: readonly (
      | "name"
      | "startTime"
      | "endTime"
      | "breakStart"
      | "breakEnd"
    )[],
  ) =>
    keys.map((key) => (
      <FormFieldWrapper
        key={key}
        htmlFor={`shift-${key}`}
        label={
          {
            name: "Vardiya adı",
            startTime: "Başlangıç saati",
            endTime: "Bitiş saati",
            breakStart: "Mola başlangıcı",
            breakEnd: "Mola bitişi",
          }[key]
        }
        error={errors[key]}
      >
        <Input
          id={`shift-${key}`}
          type={key === "name" ? "text" : "time"}
          value={values[key] ?? ""}
          onChange={(e) => setValues({ ...values, [key]: e.target.value })}
        />
      </FormFieldWrapper>
    ));
  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) close();
        }}
      >
        <DialogContent className="sm:max-w-[520px] max-h-[90dvh] overflow-y-auto min-w-0">
          <DialogHeader>
            <DialogTitle>
              {editingShift ? "Vardiya düzenle" : "Yeni vardiya tanımla"}
            </DialogTitle>
            <DialogDescription>
              Çalışma saatini, molayı ve vardiyaya özgü toleransları belirleyin.
            </DialogDescription>
          </DialogHeader>
          <form noValidate onSubmit={(e) => void save(e)} className="space-y-4">
            {serverError && (
              <p role="alert" className="text-sm text-danger">
                {serverError}
              </p>
            )}
            {editingShift &&
              (!usage ? (
                <SectionSkeleton label="Tanım kullanım etkisi yükleniyor" />
              ) : (
                <div
                  role="status"
                  className="rounded-md border p-3 space-y-1 text-sm"
                >
                  <p>
                    {usage.asOfDate} itibarıyla aktif/gelecek:{" "}
                    {usage.countLabel} {usage.assignmentCount} seri ·{" "}
                    {usage.countLabel} {usage.employeeCount} kişi.
                  </p>
                  {usageStale && (
                    <p role="alert" className="text-warning">
                      Gün değişti. Kullanım etkisini yenilemek için{" "}
                      <button
                        type="button"
                        className="underline"
                        onClick={() =>
                          guard.requestClose(() => window.location.reload())
                        }
                      >
                        sayfayı yenileyin
                      </button>
                      .
                    </p>
                  )}
                  {usage.skippedAssignments > 0 && (
                    <p className="text-xs text-warning">
                      Proje bilgisi eksik {usage.skippedAssignments} seri sayım
                      dışında.
                    </p>
                  )}
                  {usage.truncated && (
                    <p className="text-warning">
                      Sayılar alt sınırdır; sıfır sonucu kullanılmadığı anlamına
                      gelmez.
                    </p>
                  )}
                  <p>
                    Saat ve mola değişiklikleri geçmiş atamaların görünümünü de
                    değiştirir. Pasifleştirme mevcut atamaları silmez.
                  </p>
                </div>
              ))}
            <fieldset disabled={pending} className="space-y-4">
              {textFields(["name"])}
              <div className="grid grid-cols-2 gap-3">
                {textFields(["startTime", "endTime"])}
              </div>
              {values.endTime &&
                values.startTime &&
                values.endTime < values.startTime && (
                  <p className="text-xs text-muted-foreground">
                    Bitiş ertesi gün (+1 gün).
                  </p>
                )}
              <label className="flex gap-2 items-center text-sm">
                <input
                  type="checkbox"
                  checked={breakEnabled}
                  onChange={(e) => setBreakEnabled(e.target.checked)}
                />
                Mola tanımla
              </label>
              {breakEnabled && (
                <div className="grid grid-cols-2 gap-3">
                  {textFields(["breakStart", "breakEnd"])}
                </div>
              )}
              {duration && (
                <p role="status" className="text-sm tabular-nums">
                  Brüt {duration.gross} dk · Mola {duration.pause} dk · Net{" "}
                  {duration.net} dk
                </p>
              )}
              <label className="flex gap-2 items-center text-sm">
                <input
                  type="checkbox"
                  checked={values.overtimeEnabled}
                  onChange={(e) =>
                    setValues({ ...values, overtimeEnabled: e.target.checked })
                  }
                />
                Mesai etkin
              </label>
              <p className="text-xs text-muted-foreground">
                Kapalıyken bu vardiyaya bağlı kayıtlarda mesai hesaplanmaz
                (hafta sonu ve tatil dahil).
              </p>
              <label className="flex gap-2 items-center text-sm">
                <input
                  type="checkbox"
                  checked={values.isActive}
                  onChange={(e) =>
                    setValues({ ...values, isActive: e.target.checked })
                  }
                />
                Aktif; yeni atamalarda seçilebilir
              </label>
              <details
                open={
                  Object.keys(errors).some((key) =>
                    key.endsWith("ToleranceMinutes"),
                  )
                    ? true
                    : undefined
                }
              >
                <summary className="cursor-pointer text-sm font-medium">
                  Toleranslar
                </summary>
                <div className="space-y-3 pt-3">
                  {(
                    [
                      "lateToleranceMinutes",
                      "earlyExitToleranceMinutes",
                      "overtimeStartToleranceMinutes",
                    ] as const
                  ).map((key) => (
                    <FormFieldWrapper
                      key={key}
                      htmlFor={`shift-${key}`}
                      label={
                        {
                          lateToleranceMinutes: "Geç kalma toleransı (dk)",
                          earlyExitToleranceMinutes:
                            "Erken çıkış toleransı (dk)",
                          overtimeStartToleranceMinutes:
                            "Mesai başlangıç toleransı (dk)",
                        }[key]
                      }
                      error={errors[key]}
                      hint="Boş bırakılırsa genel ayar kullanılır; 0 tolerans yok demektir."
                    >
                      <Input
                        id={`shift-${key}`}
                        type="number"
                        min={0}
                        max={240}
                        disabled={
                          key === "overtimeStartToleranceMinutes" &&
                          !values.overtimeEnabled
                        }
                        value={values[key] ?? ""}
                        onChange={(e) =>
                          setValues({
                            ...values,
                            [key]:
                              e.target.value === ""
                                ? undefined
                                : Number(e.target.value),
                          })
                        }
                      />
                    </FormFieldWrapper>
                  ))}
                </div>
              </details>
            </fieldset>
            <div className="sticky bottom-0 bg-surface flex flex-wrap justify-end gap-2 border-t py-3">
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={close}
              >
                Vazgeç
              </Button>
              <Button
                disabled={pending || (!!editingShift && (!usage || usageStale))}
                type="submit"
              >
                {pending ? "Kaydediliyor…" : "Kaydet"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      {guard.dialog}
    </>
  );
}
