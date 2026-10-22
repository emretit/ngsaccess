import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date-picker";
import { ShiftSelect } from "../ShiftSelect";
import { dayLabel, istanbulToday, nextPeriod, type Period, type visibleRange } from "../lib/planning";

export function CalendarNavigation({ day, effectivePeriod, period, compact, range, changeDay, setPeriod, clearSelection }: {
  day: string; effectivePeriod: Period; period: Period; compact: boolean;
  range: ReturnType<typeof visibleRange>; changeDay: (day: string) => void;
  setPeriod: (period: Period) => void; clearSelection: () => void;
}) {
  return (<>
      <div className="flex flex-wrap items-end gap-2">
        <Button
          variant="outline"
          aria-label="Önceki dönem"
          onClick={() => changeDay(nextPeriod(day, effectivePeriod, -1))}
        >
          Önceki
        </Button>
        <Button variant="outline" onClick={() => changeDay(istanbulToday())}>
          Bugün
        </Button>
        <Button
          variant="outline"
          aria-label="Sonraki dönem"
          onClick={() => changeDay(nextPeriod(day, effectivePeriod, 1))}
        >
          Sonraki
        </Button>
        <label className="text-xs flex flex-col gap-1">
          Tarih
          <DateInput
            required
            value={day}
            onChange={changeDay}
            className="w-auto max-w-full"
          />
        </label>
        {!compact && (
          <label className="text-xs flex flex-col gap-1">
            Dönem
            <ShiftSelect label="Dönem" value={period} onChange={(value) => { if (value === "week" || value === "month") { setPeriod(value); clearSelection(); } }} options={[{ value: "week", label: "Hafta" }, { value: "month", label: "Ay" }]} />
          </label>
        )}
      </div>
      <p className="text-sm font-medium">
        {dayLabel(range.rangeStart)}
        {range.rangeStart !== range.rangeEnd
          ? ` – ${dayLabel(range.rangeEnd)}`
          : ""}
      </p>
  </>);
}
