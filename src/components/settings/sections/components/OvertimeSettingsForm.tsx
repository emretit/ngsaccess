import { useState } from "react";
import { z } from "zod";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { useActiveProjectScope } from "@/hooks/useActiveProjectScope";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { FormFieldWrapper } from "@/components/shared/FormFieldWrapper";
import { SettingsSaveBar } from "../../SettingsSaveBar";
import { DraftNotice, useSettingsDraft, useSettingsFormState } from "../../SettingsFormState";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";


const nonnegative = z.number({ error: "Geçerli bir sayı girin." }).min(0, "Negatif olamaz.");
const multiplier = z.number({ error: "Geçerli bir sayı girin." }).min(1, "Çarpan en az 1 olmalıdır.");
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Geçerli bir saat girin.");
export const overtimeSettingsSchema = z.object({
  annualOvertimeLimitHours: nonnegative,
  overtimeStartToleranceMinutes: nonnegative,
  monthlyHoursBase: z.number({ error: "Geçerli bir sayı girin." }).positive("Saat tabanı sıfırdan büyük olmalıdır."),
  weekdayMultiplier: multiplier, weekendMultiplier: multiplier, holidayMultiplier: multiplier, nightShiftMultiplier: multiplier,
  nightShiftStart: time, nightShiftEnd: time,
  nightCombineMode: z.enum(["max", "multiply", "additive"]),
  overtimeBasis: z.enum(["weekly45", "dailyShift"]),
  nightShiftDayMode: z.enum(["shiftStart", "splitAtMidnight"]),
}).refine(value => value.nightShiftStart !== value.nightShiftEnd, { message: "Gece başlangıcı ve bitişi farklı olmalı.", path: ["nightShiftEnd"] });
type Values = z.infer<typeof overtimeSettingsSchema>;
export const overtimeHints: Partial<Record<keyof Values, string>> = {
  overtimeBasis: "Örneğin haftalık esasta pazartesi–cuma günde 10 saat çalışılırsa 45 saati aşan 5 saat aşıldığı güne (cuma) yazılır; günlük esasta vardiya bitişini aşan süreler sayılır.",
  nightShiftDayMode: "Örneğin cuma 22.00–cumartesi 06.00 vardiyası bölünürse 00.00 sonrası cumartesinin gün türü ve çarpanıyla hesaplanır.",
  annualOvertimeLimitHours: "Yıllık fazla mesai toplamı bu sınırla karşılaştırılır; aşım çalışma kaydını engellemez.",
  overtimeStartToleranceMinutes: "Planlanan mesai bitiminden sonraki bu süre fazla mesai başlangıç toleransıdır.",
  monthlyHoursBase: "Aylık ücret bu saat tabanına bölünerek saatlik ücret hesaplanır.",
  weekdayMultiplier: "Hafta içi fazla mesai saatlik ücretine uygulanır.",
  weekendMultiplier: "Hafta tatiline düşen çalışma saatlik ücretine uygulanır.",
  holidayMultiplier: "Resmi tatile düşen çalışma saatlik ücretine uygulanır.",
  nightShiftMultiplier: "Yalnız gece penceresindeki fazla mesaiye uygulanır. Normal gece çalışmasına ek prim verilmez.",
};
const numbers = [
  ["annualOvertimeLimitHours", "Yıllık sınır (saat)", 0], ["overtimeStartToleranceMinutes", "Başlangıç toleransı (dk)", 0],
  ["monthlyHoursBase", "Aylık saat tabanı", 0.1], ["weekdayMultiplier", "Hafta içi çarpanı", 1],
  ["weekendMultiplier", "Hafta tatili çarpanı", 1], ["holidayMultiplier", "Resmi tatil çarpanı", 1], ["nightShiftMultiplier", "Gece çarpanı", 1],
] as const;
export function OvertimeSettingsForm() {
  const { projectId, loading, isAdmin } = useActiveProjectScope();
  const work = useQuery(api.settings.getWork, !loading && projectId && isAdmin ? { projectId } : "skip");
  const rates = useQuery(api.holidays.getOvertimeRates, !loading && projectId && isAdmin ? { projectId } : "skip");
  const save = useMutation(api.settings.saveOvertime);
  const [failed, setFailed] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof Values, string>>>({});
  const draft = useSettingsDraft<Values>({
    annualOvertimeLimitHours: work?.annualOvertimeLimitHours ?? 270,
    overtimeStartToleranceMinutes: work?.overtimeStartToleranceMinutes ?? 15, monthlyHoursBase: work?.monthlyHoursBase ?? 225,
    weekdayMultiplier: rates?.weekdayMultiplier ?? 1.5, weekendMultiplier: rates?.weekendMultiplier ?? 2,
    holidayMultiplier: rates?.holidayMultiplier ?? 2, nightShiftMultiplier: rates?.nightShiftMultiplier ?? 1.5,
    nightCombineMode: rates && "nightCombineMode" in rates ? rates.nightCombineMode ?? "max" : "max",
    overtimeBasis: rates?.overtimeBasis ?? "weekly45",
    nightShiftDayMode: rates?.nightShiftDayMode ?? "shiftStart",
    nightShiftStart: rates?.nightShiftStart ?? "22:00", nightShiftEnd: rates?.nightShiftEnd ?? "06:00",
  });
  const { values, change } = draft;
  const { run, pending } = useAsyncAction(async (payload: Values) => {
    if (!projectId || loading || !isAdmin || work === undefined || rates === undefined) throw new Error("Ayarlar yüklenmeden kaydedilemez.");
    await save({ projectId, ...payload });
    draft.reset();
  }, { success: "Mesai ayarları ve çarpanlar kaydedildi" });
  useSettingsFormState("overtime", draft.dirty, pending);
  const parsed = overtimeSettingsSchema.safeParse(values);
  const visibleErrors: Partial<Record<keyof Values, string>> = {};
  if ((draft.dirty || Object.keys(errors).length > 0) && !parsed.success) for (const issue of parsed.error.issues) visibleErrors[issue.path[0] as keyof Values] = issue.message;
  if (loading || work === undefined || rates === undefined) return <SectionSkeleton label="Mesai ayarları yükleniyor" />;
  return <section className="space-y-4"><h3 className="text-base font-semibold">Mesai politikası</h3>
    <DraftNotice remoteChanged={draft.remoteChanged} failed={failed} />
    <form noValidate className="space-y-4" onSubmit={async event => {
      event.preventDefault();
      const result = overtimeSettingsSchema.safeParse(values);
      if (!result.success) {
        const next: Partial<Record<keyof Values, string>> = {};
        for (const issue of result.error.issues) {
          const key = issue.path[0];
          if (typeof key === "string" && key in values) next[key as keyof Values] = issue.message;
        }
        setErrors(next);
        document.getElementById(String(result.error.issues[0]?.path[0]))?.focus();
        return;
      }
      setErrors({});
      setFailed(!await run(result.data));
    }}>
      <fieldset disabled={pending} className="grid grid-cols-1 gap-4 min-[761px]:grid-cols-2">
        <FormFieldWrapper htmlFor="overtimeBasis" label="Fazla mesai esası" hint={overtimeHints.overtimeBasis} error={visibleErrors.overtimeBasis}>
          <Select disabled={pending} value={values.overtimeBasis} onValueChange={basis => {
            if (basis === "weekly45" || basis === "dailyShift") change({ overtimeBasis: basis });
          }}>
            <SelectTrigger id="overtimeBasis"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="weekly45">Haftalık 45 saat (İş Kanunu)</SelectItem>
              <SelectItem value="dailyShift">Günlük vardiya aşımı</SelectItem>
            </SelectContent>
          </Select>
        </FormFieldWrapper>
        <FormFieldWrapper htmlFor="nightShiftDayMode" label="Gece yarısını geçen vardiya" hint={overtimeHints.nightShiftDayMode} error={visibleErrors.nightShiftDayMode}>
          <Select disabled={pending} value={values.nightShiftDayMode} onValueChange={mode => {
            if (mode === "shiftStart" || mode === "splitAtMidnight") change({ nightShiftDayMode: mode });
          }}>
            <SelectTrigger id="nightShiftDayMode"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="shiftStart">Başladığı günün ücreti</SelectItem>
              <SelectItem value="splitAtMidnight">Gece yarısında böl</SelectItem>
            </SelectContent>
          </Select>
        </FormFieldWrapper>
        {numbers.map(([key, label, min]) => <FormFieldWrapper key={key} htmlFor={key} label={label} hint={overtimeHints[key]} error={visibleErrors[key]}>
          <Input id={key} type="number" min={min} step="any" value={Number.isNaN(values[key]) ? "" : values[key]} onChange={event => change({ [key]: event.target.value === "" ? NaN : Number(event.target.value) })} />
        </FormFieldWrapper>)}
        <FormFieldWrapper htmlFor="nightCombineMode" label="Gece fazla mesaisinde çarpan" hint="Gün türü çarpanı 2, gece çarpanı 1,5 ise: büyük olan 2; çarpım 3; ek prim 2,5 olur." error={visibleErrors.nightCombineMode}>
          <Select disabled={pending} value={values.nightCombineMode} onValueChange={mode => {
            if (mode === "max" || mode === "multiply" || mode === "additive") change({ nightCombineMode: mode });
          }}>
            <SelectTrigger id="nightCombineMode"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="max">Büyük olan</SelectItem>
              <SelectItem value="multiply">Çarpım</SelectItem>
              <SelectItem value="additive">Ek prim</SelectItem>
            </SelectContent>
          </Select>
        </FormFieldWrapper>
        {(["nightShiftStart", "nightShiftEnd"] as const).map(key => <FormFieldWrapper key={key} htmlFor={key} label={key === "nightShiftStart" ? "Gece başlangıcı" : "Gece bitişi"} error={visibleErrors[key]}>
          <Input id={key} type="time" value={values[key]} onChange={event => change({ [key]: event.target.value })} />
        </FormFieldWrapper>)}
      </fieldset>
      <SettingsSaveBar dirty={draft.dirty} saving={pending} valid={parsed.success} label="Mesai ayarlarını kaydet" onCancel={() => { draft.reset(); setErrors({}); setFailed(false); }} />
    </form>
  </section>;
}
