import type { FixedShiftRules } from "../../../../convex/lib/pdksFixedRules";
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
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { FormFieldWrapper } from "@/components/shared/FormFieldWrapper";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { useUnsavedChangesGuard } from "@/components/shared/UnsavedChangesDialog";
import { errorMessage } from "@/lib/notify";
import { istanbulToday } from "../lib/planning";
import { shiftPayloadSchema, type ShiftFormPayload, type ShiftFormValues } from "./shiftFormSchema";
import { SHIFT_COLOR_KEYS } from "../../../../convex/lib/shiftColors";
import { SHIFT_COLORS } from "../lib/shiftColors";
import { cn } from "@/lib/utils";
export type { ShiftFormPayload } from "./shiftFormSchema";
export type EditingShift = Pick<Doc<"shifts">, "_id" | "name" | "color" | "startTime" | "endTime" | "scheduleType" | "flexible" | "breakStart" | "breakEnd" | "lateToleranceMinutes" | "earlyExitToleranceMinutes" | "overtimeStartToleranceMinutes"> & { overtimeEnabled: boolean; isActive: boolean } & { [K in keyof FixedShiftRules]?: FixedShiftRules[K] | null };
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
    validWindow: editingShift?.validWindow ?? undefined,
    absentAfterLateMinutes: editingShift?.absentAfterLateMinutes ?? undefined,
    minWorkMinutes: editingShift?.minWorkMinutes ?? undefined,
    missingCheckInLateMinutes: editingShift?.missingCheckInLateMinutes ?? undefined,
    holidayWorkRequired: editingShift?.holidayWorkRequired ?? undefined,
    name: editingShift?.name ?? "",
    color: editingShift?.color,
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
  const [initialStructure] = useState(() => withoutCosmetic(values));
  // Esnek tanımda yalnız ad/renk/aktiflik değiştiyse yeni tanım açılmaz, yerinde güncellenir.
  const flexibleCosmeticEdit = editingShift?.scheduleType === "flexible" && values.scheduleType === "flexible"
    && withoutCosmetic(values) === initialStructure;
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
      if (editingShift && ((editingShift.scheduleType !== "flexible" && values.scheduleType !== "flexible") || flexibleCosmeticEdit)) await onUpdate(editingShift._id, payload);
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
                    {flexibleCosmeticEdit
                      ? "Ad, renk ve aktiflik bu tanımda güncellenir. Saat veya hesap değişikliği yeni tanım olarak kaydedilir."
                      : editingShift.scheduleType === "flexible" || values.scheduleType === "flexible"
                      ? "Yeni tanım kaydedilir; geçmiş atamalar korunur. Yeni tanımı gelecek tarihli atayın."
                      : "Saat ve mola değişiklikleri geçmiş atamaların görünümünü de değiştirir. Pasifleştirme mevcut atamaları silmez."}
                  </p>
                </div>
              ))}
            <fieldset disabled={pending} className="space-y-4">
              {textFields(["name"])}
              <div className="space-y-2">
                <p id="shift-type-label" className="text-sm font-medium">Vardiya türü</p>
                <div role="group" aria-labelledby="shift-type-label" className="flex gap-1">
                  {([["fixed", "Sabit"], ["flexible", "Esnek"]] as const).map(([value, label]) => (
                    <Button key={value} type="button" variant={(values.scheduleType ?? "fixed") === value ? "secondary" : "ghost"}
                      aria-pressed={(values.scheduleType ?? "fixed") === value}
                      onClick={() => { setValues({ ...values, scheduleType: value }); setErrors({}); }}>{label}</Button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <p id="shift-color-label" className="text-sm font-medium">Renk</p>
                <div role="radiogroup" aria-labelledby="shift-color-label" className="flex flex-wrap gap-1">
                  <label className="relative flex min-h-11 cursor-pointer items-center px-1 text-sm sm:min-h-9">
                    <input className="peer sr-only" type="radio" name="shift-color" aria-label="Renksiz" checked={!values.color}
                      onChange={() => setValues({ ...values, color: undefined })} />
                    <span className="rounded px-2 py-1 peer-checked:ring-2 peer-checked:ring-primary peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4">Renksiz</span>
                  </label>
                  {SHIFT_COLOR_KEYS.map(color => (
                    <label key={color} className="relative flex size-11 cursor-pointer items-center justify-center sm:size-9">
                      <input className="peer sr-only" type="radio" name="shift-color" aria-label={SHIFT_COLORS[color].label} checked={values.color === color}
                        onChange={() => setValues({ ...values, color })} />
                      <span aria-hidden="true" className={cn("size-6 rounded-full peer-checked:ring-2 peer-checked:ring-primary peer-checked:ring-offset-2 peer-checked:ring-offset-background peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4", SHIFT_COLORS[color].dot)} />
                    </label>
                  ))}
                </div>
              </div>
              {(values.scheduleType === "flexible" || editingShift?.scheduleType === "flexible") && !flexibleCosmeticEdit && (
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
              <FixedRuleFields values={values} errors={errors} onChange={setValues} />
              </>}
              <label className="flex gap-2 items-start text-sm">
                <input
                  type="checkbox" className="size-6 shrink-0 accent-primary"
                  checked={values.overtimeEnabled}
                  aria-label="Mesai etkin"
                  aria-describedby="shift-overtime-hint"
                  onChange={(e) =>
                    setValues({ ...values, overtimeEnabled: e.target.checked })
                  }
                />
                <span className="min-w-0">
                  <span className="block leading-6">Mesai etkin</span>
                  <span id="shift-overtime-hint" className="block text-xs text-muted-foreground">
                    Kapalıyken bu vardiyaya bağlı kayıtlarda mesai hesaplanmaz
                    (hafta sonu ve tatil dahil).
                  </span>
                </span>
              </label>
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
                {pending ? "Kaydediliyor…" : editingShift && !flexibleCosmeticEdit && (values.scheduleType === "flexible" || editingShift.scheduleType === "flexible") ? "Yeni tanım olarak kaydet" : "Kaydet"}
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

function withoutCosmetic(values: ShiftFormValues) {
  return JSON.stringify({ ...values, name: undefined, color: undefined, isActive: undefined });
}

function FixedRuleFields({ values, errors, onChange }: {
  values: ShiftFormValues;
  errors: Record<string, string>;
  onChange: (values: ShiftFormValues) => void;
}) {
  const window = values.validWindow;
  const numberFields = [
    ["absentAfterLateMinutes", "Devamsızlık için geç kalma eşiği (dk)", "Tolerans düşüldükten sonra geç kalma bu süreyi aşarsa devamsız sayılır."],
    ["minWorkMinutes", "En az net çalışma (dk)", "Mola sonrası çalışma bu sürenin altındaysa devamsız sayılır."],
    ["missingCheckInLateMinutes", "Giriş yoksa geç kalma (dk)", "Çıkış varsa bu kadar dakika geç sayılır; eksik giriş kuralının önüne geçer."],
  ] as const;
  return <details open={errors.validWindow || numberFields.some(([key]) => errors[key]) ? true : undefined}>
    <summary className="cursor-pointer text-sm font-medium">Gelişmiş</summary>
    <div className="space-y-3 pt-3">
      <p className="text-xs text-muted-foreground">Boş bırakılan alan için ek kural uygulanmaz.</p>
      <label className="flex gap-2 items-center text-sm">
        <Switch aria-label="Geçerli giriş/çıkış penceresi" checked={!!window}
          onCheckedChange={checked => onChange({ ...values, validWindow: checked ? {
            checkInStart: values.startTime, checkInEnd: values.startTime,
            checkOutStart: values.endTime, checkOutEnd: values.endTime,
            checkOutEndDayOffset: values.endTime < values.startTime ? 1 : 0,
          } : undefined })} />
        Geçerli giriş/çıkış penceresi
      </label>
      <p className="text-xs text-muted-foreground">Pencere dışındaki okutmalar detayda kalır; gün incelenecek olarak işaretlenir.</p>
      {window && <div className="grid grid-cols-2 gap-3">
        {([
          ["checkInStart", "En erken giriş"], ["checkInEnd", "En geç giriş"],
          ["checkOutStart", "En erken çıkış"], ["checkOutEnd", "En geç çıkış"],
        ] as const).map(([key, label]) => <FormFieldWrapper key={key} htmlFor={`fixed-${key}`} label={label} error={errors.validWindow}>
          <Input id={`fixed-${key}`} type="time" value={window[key]}
            onChange={event => onChange({ ...values, validWindow: { ...window, [key]: event.target.value } })} />
        </FormFieldWrapper>)}
        <FormFieldWrapper htmlFor="fixed-exit-day" label="En geç çıkış günü" hint="Gece vardiyasında ertesi günü seçin.">
          <select id="fixed-exit-day" className="w-full rounded-md border bg-background p-2" value={window.checkOutEndDayOffset}
            onChange={event => onChange({ ...values, validWindow: { ...window, checkOutEndDayOffset: event.target.value === "1" ? 1 : 0 } })}>
            <option value="0">Aynı gün</option><option value="1">Ertesi gün (+1)</option>
          </select>
        </FormFieldWrapper>
      </div>}
      {numberFields.map(([key, label, hint]) => <FormFieldWrapper key={key} htmlFor={`shift-${key}`} label={label} hint={hint} error={errors[key]}>
        <Input id={`shift-${key}`} type="number" min={0} max={1440} step={1} value={values[key] ?? ""}
          onChange={event => onChange({ ...values, [key]: event.target.value === "" ? undefined : Number(event.target.value) })} />
      </FormFieldWrapper>)}
      <label className="flex gap-2 items-center text-sm">
        <Switch aria-label="Resmi tatilde çalışma zorunlu" checked={values.holidayWorkRequired ?? false}
          onCheckedChange={checked => onChange({ ...values, holidayWorkRequired: checked ? true : undefined })} />
        Resmi tatilde çalışma zorunlu
      </label>
      <p className="text-xs text-muted-foreground">Resmi tatil normal iş günü sayılır; tatil mesaisi uygulanmaz. Hafta sonu ayarı korunur.</p>
    </div>
  </details>;
}
