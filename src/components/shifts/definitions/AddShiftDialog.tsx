import type { FixedShiftRules } from "../../../../convex/lib/pdksFixedRules";
import { shortDate } from "../lib/planning";
import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
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
import { ChevronRight } from "lucide-react";
import { FieldError, FormFieldWrapper } from "@/components/shared/FormFieldWrapper";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { useUnsavedChangesGuard } from "@/components/shared/UnsavedChangesDialog";
import { errorMessage } from "@/lib/notify";
import { istanbulToday } from "../lib/planning";
import { shiftPayloadSchema, type ShiftFormPayload, type ShiftFormValues } from "./shiftFormSchema";
import { cn } from "@/lib/utils";
export type { ShiftFormPayload } from "./shiftFormSchema";
export type EditingShift = Pick<Doc<"shifts">, "_id" | "name" | "startTime" | "endTime" | "scheduleType" | "flexible" | "breakStart" | "breakEnd" | "lateToleranceMinutes" | "earlyExitToleranceMinutes" | "overtimeStartToleranceMinutes" | "versionedUntil"> & { overtimeEnabled: boolean; isActive: boolean } & { [K in keyof FixedShiftRules]?: FixedShiftRules[K] | null };
interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (payload: ShiftFormPayload) => Promise<void> | void;
  onUpdate: (
    id: Id<"shifts">,
    payload: ShiftFormPayload,
    effectiveFrom: string,
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
  const [initialStructure] = useState(() => withoutCosmetic(values, breakEnabled));
  // Tür değişirse yeni tanım açılır; hesap alanı değişirse seçilen tarihten itibaren geçerli olur.
  const typeChanged = !!editingShift && (values.scheduleType ?? "fixed") !== (editingShift.scheduleType ?? "fixed");
  const rulesChanged = !!editingShift && !typeChanged && withoutCosmetic(values, breakEnabled) !== initialStructure;
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
  const [effectiveFrom, setEffectiveFrom] = useState(istanbulToday);
  // Önceki bir değişikliğin başlangıcından daha erkene dönülemez (sunucu da reddeder).
  const earliestFrom = editingShift?.versionedUntil ? nextDay(editingShift.versionedUntil) : undefined;
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
    if (rulesChanged && (!effectiveFrom || effectiveFrom > today || (earliestFrom !== undefined && effectiveFrom < earliestFrom))) {
      setErrors({ effectiveFrom: earliestFrom ? `${shortDate(earliestFrom)} ile bugün arasında bir tarih seçin` : "Bugün ya da geçmiş bir tarih seçin" });
      requestAnimationFrame(() => document.getElementById("shift-effectiveFrom")?.focus());
      return;
    }
    setErrors({});
    setServerError("");
    lock.current = true;
    setPending(true);
    const payload: ShiftFormPayload = parsed.data;
    try {
      if (editingShift && !typeChanged) await onUpdate(editingShift._id, payload, effectiveFrom);
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
        <DialogContent className="[&_button]:max-sm:min-h-11 [&_label:has(input[type=checkbox])]:min-h-11 [&_label:has(input[type=checkbox])]:items-center sm:max-w-[520px] max-h-[90dvh] overflow-y-auto min-w-0 gap-3 p-5">
          <DialogHeader>
            <DialogTitle>
              {editingShift ? "Vardiya düzenle" : "Yeni vardiya tanımla"}
            </DialogTitle>
            <DialogDescription>
              Çalışma saati ve mola; tolerans ve ek kurallar Gelişmiş altında.
            </DialogDescription>
          </DialogHeader>
          <form noValidate onSubmit={(e) => void save(e)} className="space-y-3">
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
                  className="rounded-md border px-3 py-2 space-y-1 text-sm"
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
                    {typeChanged
                      ? "Tür değişince yeni tanım oluşturulur; bu tanımın atamaları değişmez."
                      : "Saat ve kural değişiklikleri seçtiğiniz tarihten itibaren geçerlidir; önceki günlerin hesabı değişmez. Pasifleştirme mevcut atamaları silmez."}
                  </p>
                </div>
              ))}
            <fieldset disabled={pending} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-start">
                {textFields(["name"])}
                <div className="space-y-1.5">
                  <p id="shift-type-label" className="text-sm font-medium">Vardiya türü</p>
                  <div role="group" aria-labelledby="shift-type-label" className="flex gap-1">
                    {([["fixed", "Sabit"], ["flexible", "Esnek"]] as const).map(([value, label]) => (
                      <Button key={value} type="button" variant={(values.scheduleType ?? "fixed") === value ? "secondary" : "ghost"}
                        aria-pressed={(values.scheduleType ?? "fixed") === value}
                        onClick={() => { setValues({ ...values, scheduleType: value }); setErrors({}); }}>{label}</Button>
                    ))}
                  </div>
                </div>
              </div>
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
              <div className="flex flex-wrap items-center justify-between gap-x-3">
                <label className="flex gap-2 items-center text-sm">
                  <input
                    type="checkbox" className="size-6 shrink-0 accent-primary"
                    checked={breakEnabled}
                    onChange={(e) => setBreakEnabled(e.target.checked)}
                  />
                  Mola tanımla
                </label>
                {duration && (
                  <p role="status" className="text-xs text-muted-foreground tabular-nums">
                    Brüt {duration.gross} dk · Mola {duration.pause} dk · Net{" "}
                    {duration.net} dk
                  </p>
                )}
              </div>
              {breakEnabled && (
                <div className="grid grid-cols-2 gap-3">
                  {textFields(["breakStart", "breakEnd"])}
                </div>
              )}
              </>}
              <div className="grid gap-x-3 sm:grid-cols-2">
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
                      Kapalıyken mesai hesaplanmaz (hafta sonu ve tatil dahil).
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
              </div>
              <details
                className="group border-t pt-2"
                open={Object.keys(errors).some((key) => ADVANCED_ERROR_KEYS.has(key)) ? true : undefined}
              >
                <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-md py-1.5 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                  <ChevronRight aria-hidden="true" className="size-4 transition-transform group-open:rotate-90" />
                  Gelişmiş
                  <span className="font-normal text-muted-foreground">· tolerans ve devamsızlık kuralları</span>
                </summary>
                <AdvancedFields values={values} errors={errors} onChange={setValues} />
              </details>
              {rulesChanged && (
                <FormFieldWrapper htmlFor="shift-effectiveFrom" label="Değişiklik şu tarihten itibaren geçerli" error={errors.effectiveFrom}
                  hint="Önceki günler eski kuralla hesaplanır. Geçmiş bir tarih seçerseniz o günden sonrası yeni kuralla yeniden hesaplanır."
                  className="rounded-md border bg-muted/40 p-3">
                  <Input id="shift-effectiveFrom" type="date" className="h-9 w-44" min={earliestFrom} max={today}
                    value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
                </FormFieldWrapper>
              )}
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
                {pending ? "Kaydediliyor…" : typeChanged ? "Yeni tanım olarak kaydet" : "Kaydet"}
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

function withoutCosmetic(values: ShiftFormValues, breakEnabled: boolean) {
  return JSON.stringify([{ ...values, name: undefined, isActive: undefined }, breakEnabled]);
}
function nextDay(date: string) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
}

// Kutu boşsa: tolerans genel ayarı kullanır, kural uygulanmaz.
const MINUTE_RULES = {
  lateToleranceMinutes: { title: "Geç kalma toleransı (dk)", hint: "Bu süreye kadar geç sayılmaz", max: 240 },
  absentAfterLateMinutes: { title: "Devamsızlık eşiği (dk)", hint: "Bundan fazla geç kalan devamsız sayılır", max: 1440 },
  missingCheckInLateMinutes: { title: "Giriş okutması yoksa (dk)", hint: "Çıkışı olan kişi bu kadar geç sayılır", max: 1440 },
  earlyExitToleranceMinutes: { title: "Erken çıkış toleransı (dk)", hint: "Bu süreye kadar erken sayılmaz", max: 240 },
  overtimeStartToleranceMinutes: { title: "Mesai başlangıç toleransı (dk)", hint: "İlk bu kadar fazla çalışma mesai sayılmaz", max: 240 },
  minWorkMinutes: { title: "En az net çalışma (dk)", hint: "Altında kalan gün devamsız sayılır", max: 1440 },
} satisfies Record<string, { title: string; hint: string; max: number }>;
type MinuteKey = keyof typeof MINUTE_RULES;
const WINDOW_ROWS = [
  ["Giriş", ["checkInStart", "En erken giriş"], ["checkInEnd", "En geç giriş"]],
  ["Çıkış", ["checkOutStart", "En erken çıkış"], ["checkOutEnd", "En geç çıkış"]],
] as const;
// Bu alanlardan biri hatalıysa Gelişmiş bölümü açık gelir.
const ADVANCED_ERROR_KEYS = new Set<string>([...Object.keys(MINUTE_RULES), "validWindow"]);

function AdvancedFields({ values, errors, onChange }: {
  values: ShiftFormValues;
  errors: Record<string, string>;
  onChange: (values: ShiftFormValues) => void;
}) {
  const flexible = values.scheduleType === "flexible";
  const window = values.validWindow;
  const rule = (key: MinuteKey) => <MinuteRule key={key} id={`shift-${key}`} {...MINUTE_RULES[key]} value={values[key]} error={errors[key]}
    disabled={key === "overtimeStartToleranceMinutes" && !values.overtimeEnabled}
    onChange={next => onChange({ ...values, [key]: next })} />;
  return <div className="space-y-3 pt-1">
    <p className="text-xs text-muted-foreground">Boş tolerans genel ayarı kullanır; boş kural uygulanmaz.</p>
    {!flexible && <RuleGroup title="Giriş">
      {rule("lateToleranceMinutes")}{rule("absentAfterLateMinutes")}{rule("missingCheckInLateMinutes")}
    </RuleGroup>}
    <RuleGroup title={flexible ? "Mesai" : "Çıkış ve mesai"}>
      {!flexible && rule("earlyExitToleranceMinutes")}{rule("overtimeStartToleranceMinutes")}
    </RuleGroup>
    <RuleGroup title="Gün">
      {rule("minWorkMinutes")}
      <SwitchRow hintId="fixed-holiday-hint" label="Resmi tatilde çalışma zorunlu" checked={values.holidayWorkRequired ?? false}
        hint="Tatil normal iş günü sayılır, tatil mesaisi uygulanmaz"
        onCheckedChange={checked => onChange({ ...values, holidayWorkRequired: checked ? true : undefined })} />
      {!flexible && <SwitchRow hintId="fixed-window-hint" label="Giriş/çıkış penceresi" checked={!!window}
        hint="Dışındaki okutmalar detayda kalır, gün incelemeye düşer"
        onCheckedChange={checked => onChange({ ...values, validWindow: checked ? {
          checkInStart: values.startTime, checkInEnd: values.startTime,
          checkOutStart: values.endTime, checkOutEnd: values.endTime,
          checkOutEndDayOffset: values.endTime < values.startTime ? 1 : 0,
        } : undefined })}>
        {window && <div className="mt-2 space-y-2 rounded-md bg-muted/50 p-2 text-sm">
          <div className="grid grid-cols-[3rem_1fr_auto_1fr] items-center gap-2">
            {WINDOW_ROWS.map(([title, [from, fromLabel], [to, toLabel]]) => <Fragment key={title}>
              <span className="text-muted-foreground">{title}</span>
              <Input id={`fixed-${from}`} type="time" aria-label={fromLabel} aria-invalid={!!errors.validWindow} className="h-9 bg-background" value={window[from]}
                onChange={event => onChange({ ...values, validWindow: { ...window, [from]: event.target.value } })} />
              <span aria-hidden="true" className="text-muted-foreground">–</span>
              <Input id={`fixed-${to}`} type="time" aria-label={toLabel} aria-invalid={!!errors.validWindow} className="h-9 bg-background" value={window[to]}
                onChange={event => onChange({ ...values, validWindow: { ...window, [to]: event.target.value } })} />
            </Fragment>)}
          </div>
          <label className="flex items-center gap-2">
            <span className="text-muted-foreground">En geç çıkış</span>
            <select id="fixed-exit-day" className="h-9 rounded-md border bg-background px-2" value={window.checkOutEndDayOffset}
              onChange={event => onChange({ ...values, validWindow: { ...window, checkOutEndDayOffset: event.target.value === "1" ? 1 : 0 } })}>
              <option value="0">aynı gün</option><option value="1">ertesi gün (+1)</option>
            </select>
          </label>
          <FieldError message={errors.validWindow} />
        </div>}
      </SwitchRow>}
    </RuleGroup>
  </div>;
}

function RuleGroup({ title, children }: { title: string; children: ReactNode }) {
  return <section className="space-y-1.5">
    <h3 className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</h3>
    <div className="divide-y rounded-lg border">{children}</div>
  </section>;
}

function MinuteRule({ id, title, hint, max, value, error, disabled, onChange }: {
  id: string;
  title: string;
  hint: string;
  max: number;
  value: number | undefined;
  error?: string;
  disabled: boolean;
  onChange: (value: number | undefined) => void;
}) {
  return <div className={cn("px-3 py-2", disabled && "opacity-60")}>
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <label htmlFor={id} className="block text-sm">{title}</label>
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <Input id={id} type="number" min={0} max={max} step={1} placeholder="—" disabled={disabled}
        aria-invalid={!!error} aria-describedby={error ? `${id}-hint ${id}-error` : `${id}-hint`}
        className="h-9 w-20 shrink-0 text-right tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        value={value ?? ""} onChange={event => onChange(event.target.value === "" ? undefined : Number(event.target.value))} />
    </div>
    <FieldError id={`${id}-error`} message={error} />
  </div>;
}

function SwitchRow({ hintId, label, hint, checked, onCheckedChange, children }: {
  hintId: string;
  label: string;
  hint: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  children?: ReactNode;
}) {
  return <div className="px-3 py-2">
    <label className="flex cursor-pointer items-center justify-between gap-3">
      <span className="min-w-0">
        <span className="block text-sm">{label}</span>
        <span id={hintId} className="block text-xs text-muted-foreground">{hint}</span>
      </span>
      <Switch aria-label={label} aria-describedby={hintId} checked={checked} onCheckedChange={onCheckedChange} />
    </label>
    {children}
  </div>;
}
