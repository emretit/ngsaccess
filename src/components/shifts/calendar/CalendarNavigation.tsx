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
    <div className="flex items-center gap-1">
      <Button variant="outline" size="icon" aria-label="Önceki dönem" onClick={() => changeDay(nextPeriod(day, effectivePeriod, -1))}>
        <ChevronLeft className="size-4" aria-hidden="true" />
      </Button>
      <Button variant="outline" className="px-2" onClick={() => changeDay(istanbulToday())}>Bugün</Button>
      <Button variant="outline" size="icon" aria-label="Sonraki dönem" onClick={() => changeDay(nextPeriod(day, effectivePeriod, 1))}>
        <ChevronRight className="size-4" aria-hidden="true" />
      </Button>
    </div>
    <div className="flex flex-wrap items-center gap-x-1">
      <DateInput required value={day} onChange={changeDay}
        trigger={<Button variant="ghost" className="px-2 text-xs" aria-label="Tarih seç">
          {calendarRangeLabel(range.rangeStart, range.rangeEnd, effectivePeriod)}
          <CalendarIcon className="h-4 w-4 opacity-50" aria-hidden="true" />
        </Button>} />
      <span className="whitespace-nowrap text-[11px] text-muted-foreground">İstanbul saati</span>
    </div>
    {!compact && <SegmentedViewControl label="Dönem" className="gap-1" value={period}
      options={[{ value: "week", label: "Hafta" }, { value: "month", label: "Ay" }]}
      onChange={(value) => { setPeriod(value); clearSelection(); }} />}
  </div>;
}
