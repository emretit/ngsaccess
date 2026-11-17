import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date-picker";
import { SegmentedViewControl } from "@/components/shared/SegmentedViewControl";
import { dayLabel, istanbulToday, nextPeriod, type Period, type visibleRange } from "../lib/planning";

export function calendarRangeLabel(start: string, end: string, period: Period) {
  const date = (value: string) => new Date(`${value}T12:00:00Z`);
  const format = (value: string, options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("tr-TR", { ...options, timeZone: "Europe/Istanbul" }).format(date(value));
  if (period === "day") return dayLabel(start);
  if (period === "month") return format(start, { month: "long", year: "numeric" });
  if (start.slice(0, 7) === end.slice(0, 7))
    return `${Number(start.slice(8))}–${format(end, { day: "numeric", month: "long", year: "numeric" })}`;
  const sameYear = start.slice(0, 4) === end.slice(0, 4);
  return `${format(start, { day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }) })} – ${format(end, { day: "numeric", month: "short", year: "numeric" })}`;
}

export function CalendarNavigation({ day, effectivePeriod, period, compact, range, changeDay, setPeriod, clearSelection }: {
  day: string; effectivePeriod: Period; period: Period; compact: boolean;
  range: ReturnType<typeof visibleRange>; changeDay: (day: string) => void;
  setPeriod: (period: Period) => void; clearSelection: () => void;
}) {
  return <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
    <div className="flex items-center gap-0.5">
      <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Önceki dönem" onClick={() => changeDay(nextPeriod(day, effectivePeriod, -1))}>
        <ChevronLeft className="size-4" aria-hidden="true" />
      </Button>
      <Button variant="outline" className="h-8 px-3 text-xs" onClick={() => changeDay(istanbulToday())}>Bugün</Button>
      <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Sonraki dönem" onClick={() => changeDay(nextPeriod(day, effectivePeriod, 1))}>
        <ChevronRight className="size-4" aria-hidden="true" />
      </Button>
    </div>
    <div className="flex flex-wrap items-center gap-x-1">
      <DateInput required value={day} onChange={changeDay}
        trigger={<Button variant="ghost" className="h-8 px-1 text-sm font-semibold" title="İstanbul saati" aria-label="Tarih seç">
          {calendarRangeLabel(range.rangeStart, range.rangeEnd, effectivePeriod)}
          <CalendarIcon className="h-4 w-4 opacity-50" aria-hidden="true" />
        </Button>} />
      <span className="sr-only">İstanbul saati</span>
    </div>
    {!compact && <SegmentedViewControl label="Dönem" className="gap-0.5 rounded-md border bg-background p-0.5 [&_button]:h-7 [&_button]:px-3 [&_button]:text-xs" value={period}
      options={[{ value: "week", label: "Hafta" }, { value: "month", label: "Ay" }]}
      onChange={(value) => { setPeriod(value); clearSelection(); }} />}
  </div>;
}
