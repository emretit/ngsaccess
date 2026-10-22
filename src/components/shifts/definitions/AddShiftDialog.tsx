import { shortDate } from "../lib/planning";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Doc, Id } from "../../../../convex/_generated/dataModel";
import { DEFAULT_FLEXIBLE } from "../../../../convex/lib/pdksFlexible";
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
import { shiftPayloadSchema, type ShiftFormPayload, type ShiftFormValues } from "./shiftFormSchema";
export type { ShiftFormPayload } from "./shiftFormSchema";
export type EditingShift = Pick<Doc<"shifts">, "_id" | "name" | "startTime" | "endTime" | "scheduleType" | "flexible" | "breakStart" | "breakEnd" | "lateToleranceMinutes" | "earlyExitToleranceMinutes" | "overtimeStartToleranceMinutes"> & { overtimeEnabled: boolean; isActive: boolean };
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
    scheduleType: editingShift?.scheduleType ?? "fixed",
    flexible: editingShift?.flexible ?? { ...DEFAULT_FLEXIBLE },
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
    const parsed = shiftPayloadSchema.safeParse({
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
    const payload: ShiftFormPayload = parsed.data;
    try {
      if (editingShift && editingShift.scheduleType !== "flexible" && values.scheduleType !== "flexible") await onUpdate(editingShift._id, payload);
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
        <DialogContent className="[&_button]:max-sm:min-h-11 [&_label:has(input[type=checkbox])]:min-h-11 [&_label:has(input[type=checkbox])]:items-center sm:max-w-[520px] max-h-[90dvh] overflow-y-auto min-w-0">
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
                    {shortDate(usage.asOfDate)} itibarıyla aktif/gelecek:{" "}
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
                    {editingShift.scheduleType === "flexible" || values.scheduleType === "flexible"
                      ? "Yeni tanım kaydedilir; geçmiş atamalar korunur. Yeni tanımı gelecek tarihli atayın."
                      : "Saat ve mola değişiklikleri geçmiş atamaların görünümünü de değiştirir. Pasifleştirme mevcut atamaları silmez."}
                  </p>
                </div>
              ))}
            <fieldset disabled={pending} className="space-y-4">
              {textFields(["name"])}
              <FormFieldWrapper htmlFor="shift-scheduleType" label="Vardiya türü">
                <select id="shift-scheduleType" className="w-full rounded-md border bg-surface p-2" value={values.scheduleType ?? "fixed"}
                  onChange={e => { setValues({ ...values, scheduleType: e.target.value === "flexible" ? "flexible" : "fixed" }); setErrors({}); }}>
                  <option value="fixed">Sabit</option><option value="flexible">Esnek</option>
                </select>
              </FormFieldWrapper>
              {(values.scheduleType === "flexible" || editingShift?.scheduleType === "flexible") && (
                <p role="status" className="text-sm text-muted-foreground">Esnek vardiya değişikliğinde yeni tanım oluşturulur. Geçmiş hesapları korumak için yeni tanımı gelecek tarihli atayın.</p>
              )}
              {values.scheduleType === "flexible" ? (
                <FlexibleFields value={values.flexible ?? DEFAULT_FLEXIBLE} error={errors.flexible} onChange={flexible => setValues({ ...values, flexible })} />
              ) : <>
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
                  type="checkbox" className="size-6 shrink-0 accent-primary"
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
              </>}
              <label className="flex gap-2 items-center text-sm">
                <input
                  type="checkbox" className="size-6 shrink-0 accent-primary"
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
                  type="checkbox" className="size-6 shrink-0 accent-primary"
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
                  ).filter(key => values.scheduleType !== "flexible" || key === "overtimeStartToleranceMinutes").map((key) => (
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
                {pending ? "Kaydediliyor…" : editingShift && (values.scheduleType === "flexible" || editingShift.scheduleType === "flexible") ? "Yeni tanım olarak kaydet" : "Kaydet"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      {guard.dialog}
    </>
  );
}

function FlexibleFields({ value, error, onChange }: {
  value: NonNullable<ShiftFormValues["flexible"]>;
  error?: string;
  onChange: (value: NonNullable<ShiftFormValues["flexible"]>) => void;
}) {
  return <fieldset className="space-y-3" aria-describedby={error ? "flexible-error" : undefined}>
    <legend className="text-sm font-medium">Esnek çalışma pencereleri</legend>
    {error && <p id="flexible-error" role="alert" className="text-sm text-danger">{error}</p>}
    <div className="grid grid-cols-2 gap-3">
      {([ ["requiredNetMinutes", "Günlük net hedef (dk)"], ["maxSpanMinutes", "Azami oturum (dk)"] ] as const).map(([key, label]) =>
        <FormFieldWrapper key={key} htmlFor={`flex-${key}`} label={label}>
          <Input id={`flex-${key}`} type="number" min={1} max={1440} step={1} aria-invalid={!!error} value={Number.isNaN(value[key]) ? "" : value[key]} onChange={e => onChange({ ...value, [key]: e.target.value === "" ? Number.NaN : Number(e.target.value) })} />
        </FormFieldWrapper>)}
      {([ ["checkInStart", "En erken giriş"], ["checkInEnd", "En geç giriş"], ["checkOutStart", "En erken çıkış (giriş günü)"], ["checkOutEnd", "En geç çıkış"] ] as const).map(([key, label]) =>
        <FormFieldWrapper key={key} htmlFor={`flex-${key}`} label={label}>
          <Input id={`flex-${key}`} type="time" aria-invalid={!!error} value={value[key]} onChange={e => onChange({ ...value, [key]: e.target.value })} />
        </FormFieldWrapper>)}
    </div>
    <FormFieldWrapper htmlFor="flex-dayOffset" label="En geç çıkış günü">
      <select id="flex-dayOffset" className="w-full rounded-md border bg-surface p-2" value={value.checkOutEndDayOffset} onChange={e => onChange({ ...value, checkOutEndDayOffset: e.target.value === "1" ? 1 : 0 })}>
        <option value={0}>Giriş günü</option><option value={1}>Ertesi gün (+1)</option>
      </select>
    </FormFieldWrapper>
    <FormFieldWrapper htmlFor="flex-breakMode" label="Mola modu">
      <select id="flex-breakMode" className="w-full rounded-md border bg-surface p-2" value={value.breakMode} onChange={e => onChange({ ...value, breakMode: e.target.value === "duration" ? "duration" : "existingLegal" })}>
        <option value="duration">Süre molası</option><option value="existingLegal">Mevcut otomatik mola</option>
      </select>
    </FormFieldWrapper>
    {value.breakMode === "duration" && <FormFieldWrapper htmlFor="flex-breakMinutes" label="Mola süresi (dk)">
      <Input id="flex-breakMinutes" type="number" min={0} max={1439} step={1} aria-invalid={!!error} value={value.breakMinutes ?? ""} onChange={e => onChange({ ...value, breakMinutes: e.target.value === "" ? undefined : Number(e.target.value) })} />
    </FormFieldWrapper>}
  </fieldset>;
}
