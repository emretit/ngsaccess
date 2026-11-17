import { ShiftScheduleField } from "./ShiftScheduleField";
import { NativeSelect } from "@/components/ui/native-select";
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
export type { ShiftFormPayload } from "./shiftFormSchema";
export type EditingShift = Pick<Doc<"shifts">, "_id" | "scheduleMode" | "dayPlan" | "name" | "startTime" | "endTime" | "scheduleType" | "flexible" | "breakStart" | "breakEnd" | "lateToleranceMinutes" | "earlyExitToleranceMinutes" | "overtimeStartToleranceMinutes" | "versionedUntil"> & { overtimeEnabled: boolean; isActive: boolean } & { [K in keyof FixedShiftRules]?: FixedShiftRules[K] | null };
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
    scheduleMode: editingShift?.scheduleMode ?? "daily",
    dayPlan: editingShift?.dayPlan ?? [],
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
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] === "flexible" ? issue.path.join(".") : String(issue.path[0]);
        next[key] = issue.message;
      }
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
  const rule = (key: MinuteKey) => (
    <MinuteRule key={key} id={`shift-${key}`} {...MINUTE_RULES[key]} value={values[key]} error={errors[key]}
      onChange={next => setValues({ ...values, [key]: next })} />
  );
  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) close();
        }}
      >
        <DialogContent className="[&_button]:max-sm:min-h-11 [&_label:has(input[type=checkbox])]:min-h-11 [&_label:has(input[type=checkbox])]:items-center sm:max-w-[960px] max-h-[90dvh] min-w-0 flex flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="shrink-0 px-5 pb-4 pt-5 pr-12">
            <DialogTitle>
              {editingShift ? "Vardiya düzenle" : "Yeni vardiya tanımla"}
            </DialogTitle>
            <DialogDescription>
              Vardiyanın çalışma düzenini, saatlerini ve hesaplama kurallarını belirleyin.
            </DialogDescription>
          </DialogHeader>
          <form noValidate onSubmit={(e) => void save(e)} className="flex min-h-0 flex-col">
            <div className="min-h-0 space-y-3 overflow-y-auto px-5 pb-4">
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
              <fieldset disabled={pending} className="grid min-w-0 gap-5 md:grid-cols-2 md:gap-6">
                <section aria-label="Vardiya bilgileri" className="min-w-0 space-y-4">
                  {textFields(["name"])}
                  <ShiftScheduleField value={values} editing={Boolean(editingShift)} error={errors.dayPlan}
                    onChange={schedule => setValues({ ...values, ...schedule })} />
                  <div className="space-y-3">
                    <label className="flex gap-2 items-start text-sm">
                      <input
                        type="checkbox" className="size-6 shrink-0 accent-primary"
                        checked={values.isActive}
                        aria-label="Yeni atamalarda göster"
                        aria-describedby="shift-active-hint"
                        onChange={(e) =>
                          setValues({ ...values, isActive: e.target.checked })
                        }
                      />
                      <span className="min-w-0">
                        <span className="block leading-6">Yeni atamalarda göster</span>
                        <span id="shift-active-hint" className="block text-xs text-muted-foreground">
                          Kapattığınızda vardiya seçim listesinden gizlenir. Mevcut atamalar devam eder.
                        </span>
                      </span>
                    </label>
                  </div>
                  {rulesChanged && (
                    <FormFieldWrapper htmlFor="shift-effectiveFrom" label="Değişiklik şu tarihten itibaren geçerli" error={errors.effectiveFrom}
                      hint="Önceki günler eski kuralla hesaplanır. Geçmiş bir tarih seçerseniz o günden sonrası yeni kuralla yeniden hesaplanır."
                      className="rounded-md border bg-muted/40 p-3">
                      <Input id="shift-effectiveFrom" type="date" className="h-9 w-44" min={earliestFrom} max={today}
                        value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
                    </FormFieldWrapper>
                  )}
                </section>
                <section aria-labelledby="shift-type-label" className="min-w-0 space-y-4 border-t pt-4 md:border-l md:border-t-0 md:pl-6 md:pt-0">
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
                  {values.scheduleType === "flexible" && errors.flexible && (
                    <p role="alert" className="text-sm text-danger">{errors.flexible}</p>
                  )}
                  <FormSection title="Çalışma saatleri">
                    {values.scheduleType === "flexible" ? (
                      <FlexibleHoursFields value={values.flexible ?? DEFAULT_FLEXIBLE} errors={errors}
                        onChange={flexible => setValues({ ...values, flexible })} />
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
                      {duration && duration.net > 0 && (
                        <p role="status" className="text-sm text-muted-foreground tabular-nums">
                          {breakEnabled ? `Planlanan net çalışma ${duration.net} dk` : `Vardiya süresi ${duration.gross} dk`}
                          <span className="block text-xs">
                            {breakEnabled ? "Saat aralığından tanımlı mola çıkarılarak hesaplanır." : "Mola kesintisi uygulanmadan önceki süre."}
                          </span>
                        </p>
                      )}
                    </>}
                  </FormSection>
                  <FormSection title="Mola">
                    {values.scheduleType === "flexible" ? (
                      <FlexibleBreakFields value={values.flexible ?? DEFAULT_FLEXIBLE} errors={errors}
                        onChange={flexible => setValues({ ...values, flexible })} />
                    ) : <>
                      <div className="flex flex-wrap items-center justify-between gap-x-3">
                        <label className="flex gap-2 items-center text-sm">
                          <input
                            type="checkbox" className="size-6 shrink-0 accent-primary"
                            checked={breakEnabled}
                            onChange={(e) => setBreakEnabled(e.target.checked)}
                          />
                          Mola tanımla
                        </label>
                      </div>
                      {breakEnabled && (
                        <div className="grid grid-cols-2 gap-3">
                          {textFields(["breakStart", "breakEnd"])}
                        </div>
                      )}
                    </>}
                  </FormSection>
                  <FormSection title="Kayıt kabul aralığı" collapsible
                    hasError={values.scheduleType === "flexible"
                      ? Boolean(errors.flexible || ["checkInStart", "checkInEnd", "checkOutStart", "checkOutEnd", "checkOutEndDayOffset", "maxSpanMinutes"].some(key => errors[`flexible.${key}`]))
                      : Boolean(errors.validWindow)}>
                    <p className="text-xs text-muted-foreground">Bu vardiyada değerlendirilecek giriş ve çıkış okutmalarının saat aralığı.</p>
                    {values.scheduleType === "flexible" ? (
                      <FlexibleRecordFields value={values.flexible ?? DEFAULT_FLEXIBLE} errors={errors}
                        onChange={flexible => setValues({ ...values, flexible })} />
                    ) : <FixedRecordFields values={values} errors={errors} onChange={setValues} />}
                  </FormSection>
                  {values.scheduleType !== "flexible" && (
                    <FormSection title="Geç giriş ve erken çıkış" collapsible
                      hasError={Boolean(errors.lateToleranceMinutes || errors.earlyExitToleranceMinutes || errors.missingCheckInLateMinutes)}>
                      {rule("lateToleranceMinutes")}
                      {rule("earlyExitToleranceMinutes")}
                      {rule("missingCheckInLateMinutes")}
                    </FormSection>
                  )}
                  <FormSection title="Fazla mesai" collapsible hasError={Boolean(errors.overtimeStartToleranceMinutes)}>
                    <label className="flex gap-2 items-start text-sm">
                      <input
                        type="checkbox" className="size-6 shrink-0 accent-primary"
                        checked={values.overtimeEnabled}
                        aria-label="Fazla mesaiyi hesapla"
                        aria-describedby="shift-overtime-hint"
                        onChange={(e) =>
                          setValues({ ...values, overtimeEnabled: e.target.checked })
                        }
                      />
                      <span className="min-w-0">
                        <span className="block leading-6">Fazla mesaiyi hesapla</span>
                        <span id="shift-overtime-hint" className="block text-xs text-muted-foreground">
                          Hafta sonu ve resmi tatil dahil, bu vardiyanın fazla mesai sürelerini hesaplar.
                        </span>
                      </span>
                    </label>
                    {values.overtimeEnabled && rule("overtimeStartToleranceMinutes")}
                  </FormSection>
                  <FormSection title="Devamsızlık" collapsible
                    hasError={Boolean(errors.minWorkMinutes || errors.absentAfterLateMinutes)}>
                    {values.scheduleType !== "flexible" && rule("absentAfterLateMinutes")}
                    {rule("minWorkMinutes")}
                  </FormSection>
                  <FormSection title="Resmi tatiller" collapsible>
                    <SwitchRow hintId="fixed-holiday-hint" label="Resmi tatilde çalışma zorunlu"
                      checked={values.holidayWorkRequired ?? false}
                      hint="Resmi tatil normal iş günü olarak değerlendirilir ve tatil mesaisi uygulanmaz."
                      onCheckedChange={checked => setValues({ ...values, holidayWorkRequired: checked ? true : undefined })} />
                  </FormSection>
                </section>
              </fieldset>
            </div>
            <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t bg-surface px-5 py-4">
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

interface FlexibleFieldProps {
  value: NonNullable<ShiftFormValues["flexible"]>;
  errors: Record<string, string>;
  onChange: (value: NonNullable<ShiftFormValues["flexible"]>) => void;
}

function FlexibleHoursFields({ value, errors, onChange }: FlexibleFieldProps) {
  return <FormFieldWrapper htmlFor="flex-requiredNetMinutes" label="Günlük çalışma hedefi (dk)" error={errors["flexible.requiredNetMinutes"]}
    hint="Molalar çıkarıldıktan sonra tamamlanması beklenen çalışma süresi.">
    <Input id="flex-requiredNetMinutes" type="number" min={1} max={1440} step={1}
      value={Number.isNaN(value.requiredNetMinutes) ? "" : value.requiredNetMinutes}
      onChange={event => onChange({ ...value, requiredNetMinutes: event.target.value === "" ? Number.NaN : Number(event.target.value) })} />
  </FormFieldWrapper>;
}

function FlexibleRecordFields({ value, errors, onChange }: FlexibleFieldProps) {
  return <div className="space-y-3">
    <div className="grid grid-cols-2 gap-3">
      {([
        ["checkInStart", "En erken giriş"], ["checkInEnd", "En geç giriş"],
        ["checkOutStart", "En erken çıkış (giriş günü)"], ["checkOutEnd", "En geç çıkış"],
      ] as const).map(([key, label]) => (
        <FormFieldWrapper key={key} htmlFor={`flex-${key}`} label={label} error={errors[`flexible.${key}`]}>
          <Input id={`flex-${key}`} type="time" value={value[key]}
            onChange={event => onChange({ ...value, [key]: event.target.value })} />
        </FormFieldWrapper>
      ))}
    </div>
    <FormFieldWrapper htmlFor="flex-dayOffset" label="En geç çıkış günü" error={errors["flexible.checkOutEndDayOffset"]}>
      <NativeSelect id="flex-dayOffset" value={value.checkOutEndDayOffset}
        onChange={event => onChange({ ...value, checkOutEndDayOffset: event.target.value === "1" ? 1 : 0 })}>
        <option value={0}>Giriş günü</option><option value={1}>Ertesi gün (+1)</option>
      </NativeSelect>
    </FormFieldWrapper>
    <FormFieldWrapper htmlFor="flex-maxSpanMinutes" label="Giriş ve çıkış arasındaki en uzun süre (dk)"
      hint="Tek bir çalışma oturumunun kabul edilebilecek en uzun süresi." error={errors["flexible.maxSpanMinutes"]}>
      <Input id="flex-maxSpanMinutes" type="number" min={1} max={1440} step={1}
        value={Number.isNaN(value.maxSpanMinutes) ? "" : value.maxSpanMinutes}
        onChange={event => onChange({ ...value, maxSpanMinutes: event.target.value === "" ? Number.NaN : Number(event.target.value) })} />
    </FormFieldWrapper>
  </div>;
}

function FlexibleBreakFields({ value, errors, onChange }: FlexibleFieldProps) {
  return <div className="space-y-3">
    <FormFieldWrapper htmlFor="flex-breakMode" label="Mola hesabı" error={errors["flexible.breakMode"]}>
      <NativeSelect id="flex-breakMode" value={value.breakMode}
        onChange={event => onChange({ ...value, breakMode: event.target.value === "duration" ? "duration" : "existingLegal" })}>
        <option value="duration">Belirli bir süre düş</option><option value="existingLegal">Genel otomatik mola kuralını kullan</option>
      </NativeSelect>
    </FormFieldWrapper>
    {value.breakMode === "duration" && (
      <FormFieldWrapper htmlFor="flex-breakMinutes" label="Mola süresi (dk)" error={errors["flexible.breakMinutes"]}>
        <Input id="flex-breakMinutes" type="number" min={0} max={1439} step={1} value={value.breakMinutes ?? ""}
          onChange={event => onChange({ ...value, breakMinutes: event.target.value === "" ? undefined : Number(event.target.value) })} />
      </FormFieldWrapper>
    )}
  </div>;
}

function withoutCosmetic(values: ShiftFormValues, breakEnabled: boolean) {
  return JSON.stringify([{ ...values, name: undefined, isActive: undefined, scheduleMode: undefined, dayPlan: undefined }, breakEnabled]);
}
function nextDay(date: string) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
}

// Kutu boşsa: tolerans genel ayarı kullanır, kural uygulanmaz.
const MINUTE_RULES = {
  lateToleranceMinutes: { title: "Geç giriş toleransı (dk)", hint: "Boş bırakırsanız genel ayardaki tolerans kullanılır", max: 240 },
  absentAfterLateMinutes: { title: "Bu kadar gecikmeden sonra devamsız say (dk)", hint: "Boş bırakırsanız gecikme nedeniyle devamsız sayılmaz", max: 1440 },
  missingCheckInLateMinutes: { title: "Giriş kaydı eksikse gecikme süresi (dk)", hint: "Yalnızca çıkış kaydı olan gün için kullanılır. Boş bırakırsanız uygulanmaz", max: 1440 },
  earlyExitToleranceMinutes: { title: "Erken çıkış toleransı (dk)", hint: "Boş bırakırsanız genel ayardaki tolerans kullanılır", max: 240 },
  overtimeStartToleranceMinutes: { title: "Fazla mesai başlangıç toleransı (dk)", hint: "İlk bu kadar fazla çalışma mesai sayılmaz. Boş bırakırsanız genel ayar kullanılır", max: 240 },
  minWorkMinutes: { title: "Bu sürenin altında devamsız say (dk)", hint: "Günlük çalışma hedefinden ayrı bir alt sınırdır. Boş bırakırsanız uygulanmaz", max: 1440 },
} satisfies Record<string, { title: string; hint: string; max: number }>;
type MinuteKey = keyof typeof MINUTE_RULES;
const WINDOW_ROWS = [
  ["Giriş", ["checkInStart", "En erken giriş"], ["checkInEnd", "En geç giriş"]],
  ["Çıkış", ["checkOutStart", "En erken çıkış"], ["checkOutEnd", "En geç çıkış"]],
] as const;
function FixedRecordFields({ values, errors, onChange }: {
  values: ShiftFormValues;
  errors: Record<string, string>;
  onChange: (values: ShiftFormValues) => void;
}) {
  const window = values.validWindow;
  return <SwitchRow hintId="fixed-window-hint" label="Saat aralığını sınırla" checked={!!window}
    hint="Aralık dışındaki okutmalar ayrıntıda gösterilir ve gün incelemeye alınır."
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
        <NativeSelect id="fixed-exit-day" className="w-auto" aria-invalid={!!errors.validWindow} value={window.checkOutEndDayOffset}
          onChange={event => onChange({ ...values, validWindow: { ...window, checkOutEndDayOffset: event.target.value === "1" ? 1 : 0 } })}>
          <option value="0">aynı gün</option><option value="1">ertesi gün (+1)</option>
        </NativeSelect>
      </label>
      <FieldError message={errors.validWindow} />
    </div>}
  </SwitchRow>;
}

function FormSection({ title, children, collapsible = false, hasError = false }: {
  title: string;
  children: ReactNode;
  collapsible?: boolean;
  hasError?: boolean;
}) {
  if (collapsible) {
    return <details className="group border-t pt-3" open={hasError ? true : undefined}>
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md py-1 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        <ChevronRight aria-hidden="true" className="size-4 transition-transform group-open:rotate-90" />
        {title}
      </summary>
      <div className="space-y-3 pt-3">{children}</div>
    </details>;
  }
  return <section aria-label={title} className="space-y-3 border-t pt-4">
    <h3 className="text-sm font-medium">{title}</h3>
    {children}
  </section>;
}

function MinuteRule({ id, title, hint, max, value, error, onChange }: {
  id: string;
  title: string;
  hint: string;
  max: number;
  value: number | undefined;
  error?: string;
  onChange: (value: number | undefined) => void;
}) {
  return <div className="space-y-1">
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <label htmlFor={id} className="block text-sm">{title}</label>
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <Input id={id} type="number" min={0} max={max} step={1} placeholder="—"
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
  return <div>
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
