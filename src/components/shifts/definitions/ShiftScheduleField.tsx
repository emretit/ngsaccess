import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldError } from "@/components/shared/FormFieldWrapper";
import {
  DEFAULT_CYCLE_PLAN, DEFAULT_WEEKLY_PLAN, SCHEDULE_DAY_LABELS,
  type ScheduleMode, type ShiftSchedule,
} from "../../../../convex/lib/shiftSchedule";

export function ShiftScheduleField({ value, onChange, error, editing }: {
  value: ShiftSchedule;
  onChange: (value: { scheduleMode: ScheduleMode; dayPlan: boolean[] }) => void;
  error?: string;
  editing: boolean;
}) {
  const mode = value.scheduleMode ?? "daily";
  const days = value.dayPlan ?? [];
  const [lengthDraft, setLengthDraft] = useState<string | null>(null);
  const changeMode = (scheduleMode: ScheduleMode) => {
    setLengthDraft(null);
    onChange({ scheduleMode, dayPlan: scheduleMode === "weekly" ? [...DEFAULT_WEEKLY_PLAN] : scheduleMode === "cycle" ? [...DEFAULT_CYCLE_PLAN] : [] });
  };
  return <section aria-label="Vardiya deseni" className="space-y-2 rounded-lg border p-3">
    <h3 className="text-sm font-medium">Desen</h3>
    <div className="flex flex-wrap items-center gap-2">
      <div role="group" aria-label="Desen" className="flex flex-wrap gap-1">
        {([["daily", "Her gün"], ["weekly", "Haftalık"], ["cycle", "Döngü"]] as const).map(([kind, label]) => (
          <Button key={kind} type="button" size="sm" variant={mode === kind ? "default" : "outline"}
            aria-pressed={mode === kind} onClick={() => changeMode(kind)}>{label}</Button>
        ))}
      </div>
      {mode === "cycle" && <label className="flex items-center gap-2 text-sm">
        Gün sayısı
        <Input type="number" min={2} max={31} className="w-20" value={lengthDraft ?? days.length}
          onChange={event => {
            setLengthDraft(event.target.value);
            const length = Number(event.target.value);
            if (Number.isInteger(length) && length >= 2 && length <= 31) onChange({ scheduleMode: mode, dayPlan: Array.from({ length }, (_, index) => days[index] ?? false) });
          }} onBlur={() => setLengthDraft(null)} />
      </label>}
    </div>
    {mode !== "daily" && <>
      <div role="group" aria-label="Çalışma günleri" className="flex flex-wrap gap-1">
        {days.map((works, index) => <Button key={index} type="button" size="sm" className="min-w-10 px-2"
          variant={works ? "secondary" : "outline"} aria-pressed={works}
          aria-label={`${mode === "weekly" ? SCHEDULE_DAY_LABELS[index] : `${index + 1}. gün`}, ${works ? "Çalışma" : "Hafta tatili"}`}
          onClick={() => onChange({ scheduleMode: mode, dayPlan: days.map((day, position) => position === index ? !day : day) })}>
          {mode === "weekly" ? SCHEDULE_DAY_LABELS[index] : index + 1}
        </Button>)}
      </div>
      <p className="text-xs text-muted-foreground">Seçili günlerde çalışılır, diğer günler hafta tatilidir.{mode === "cycle" && " Döngü atamanın başlangıç tarihinde başlar."}</p>
    </>}
    <FieldError message={error} />
    {editing && <p className="text-xs text-muted-foreground">Desen değişikliği yeni atamalara uygulanır. Mevcut atamalar kayıtlı desenini korur.</p>}
  </section>;
}
