import { useState } from "react";
import { z } from "zod";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { useActiveProjectScope } from "@/hooks/useActiveProjectScope";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { FormFieldWrapper } from "@/components/shared/FormFieldWrapper";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const nonnegative = z.number({ error: "Geçerli bir sayı girin." }).min(0, "Negatif olamaz.");
const multiplier = z.number({ error: "Geçerli bir sayı girin." }).min(1, "Çarpan en az 1 olmalıdır.");
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Geçerli bir saat girin.");
const schema = z.object({
  annualOvertimeLimitHours: nonnegative,
  overtimeStartToleranceMinutes: nonnegative,
  monthlyHoursBase: z.number({ error: "Geçerli bir sayı girin." }).positive("Saat tabanı sıfırdan büyük olmalıdır."),
  weekdayMultiplier: multiplier, weekendMultiplier: multiplier, holidayMultiplier: multiplier, nightShiftMultiplier: multiplier,
  nightShiftStart: time, nightShiftEnd: time,
});
type Values = z.infer<typeof schema>;
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
  const [draft, setDraft] = useState<{ projectId: string; fields: Partial<Values> } | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof Values, string>>>({});
  const values: Values = {
    annualOvertimeLimitHours: work?.annualOvertimeLimitHours ?? 270,
    overtimeStartToleranceMinutes: work?.overtimeStartToleranceMinutes ?? 15, monthlyHoursBase: work?.monthlyHoursBase ?? 225,
    weekdayMultiplier: rates?.weekdayMultiplier ?? 1.5, weekendMultiplier: rates?.weekendMultiplier ?? 2,
    holidayMultiplier: rates?.holidayMultiplier ?? 2, nightShiftMultiplier: rates?.nightShiftMultiplier ?? 1.5,
    nightShiftStart: rates?.nightShiftStart ?? "22:00", nightShiftEnd: rates?.nightShiftEnd ?? "06:00",
    ...(draft && draft.projectId === projectId ? draft.fields : {}),
  };
  const change = (fields: Partial<Values>) => {
    if (projectId) setDraft(previous => ({ projectId, fields: { ...(previous?.projectId === projectId ? previous.fields : {}), ...fields } }));
  };
  const { run, pending } = useAsyncAction(async (payload: Values) => {
    if (!projectId || loading || !isAdmin || work === undefined || rates === undefined) throw new Error("Ayarlar yüklenmeden kaydedilemez.");
    await save({ projectId, ...payload });
    setDraft(null);
  }, { success: "Mesai ayarları ve çarpanlar kaydedildi" });
  if (loading || work === undefined || rates === undefined) return <SectionSkeleton label="Mesai ayarları yükleniyor" />;
  return <Card><CardHeader><CardTitle>Mesai Ayarları</CardTitle></CardHeader><CardContent>
    <form noValidate className="space-y-4" onSubmit={async event => {
      event.preventDefault();
      const result = schema.safeParse(values);
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
      await run(result.data);
    }}>
      <fieldset disabled={pending} className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {numbers.map(([key, label, min]) => <FormFieldWrapper key={key} htmlFor={key} label={label} error={errors[key]}>
          <Input id={key} type="number" min={min} step="any" value={Number.isNaN(values[key]) ? "" : values[key]} onChange={event => change({ [key]: event.target.value === "" ? NaN : Number(event.target.value) })} />
        </FormFieldWrapper>)}
        {(["nightShiftStart", "nightShiftEnd"] as const).map(key => <FormFieldWrapper key={key} htmlFor={key} label={key === "nightShiftStart" ? "Gece başlangıcı" : "Gece bitişi"} error={errors[key]}>
          <Input id={key} type="time" value={values[key]} onChange={event => change({ [key]: event.target.value })} />
        </FormFieldWrapper>)}
      </fieldset>
      <Button type="submit" disabled={pending || !projectId}>{pending ? "Kaydediliyor…" : "Değişiklikleri Kaydet"}</Button>
    </form>
  </CardContent></Card>;
}
