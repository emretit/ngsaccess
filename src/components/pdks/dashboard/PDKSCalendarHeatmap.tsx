import { useMemo } from "react";
import {
  addDays,
  eachDayOfInterval,
  endOfMonth,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { tr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { STATUS_META, type DayStatus, isDayStatus } from "../statusMeta";

export interface CalendarDayDatum {
  date: string;
  status: string;
  totalHours?: string;
}

interface PDKSCalendarHeatmapProps {
  startDate: string;
  endDate: string;
  days: CalendarDayDatum[];
  highlightDate?: string;
  onSelectDate?: (date: string) => void;
}

export function PDKSCalendarHeatmap({
  startDate,
  endDate,
  days,
  highlightDate,
  onSelectDate,
}: PDKSCalendarHeatmapProps) {
  const byDate = useMemo(() => {
    const map = new Map<string, CalendarDayDatum>();
    for (const d of days) map.set(d.date, d);
    return map;
  }, [days]);

  const months = useMemo(() => {
    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T00:00:00`);
    const out: Date[] = [];
    let cursor = startOfMonth(start);
    while (cursor <= end) {
      out.push(cursor);
      cursor = startOfMonth(addDays(endOfMonth(cursor), 1));
    }
    return out;
  }, [startDate, endDate]);

  return (
    <div className="space-y-4">
      {months.map((month) => {
        const monthStart = startOfMonth(month);
        const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
        const gridEnd = addDays(gridStart, 41);
        const cells = eachDayOfInterval({ start: gridStart, end: gridEnd });
        return (
          <div key={month.toISOString()}>
            <div className="text-xs font-semibold text-muted-foreground mb-1.5">
              {format(month, "MMMM yyyy", { locale: tr })}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"].map((d) => (
                <div
                  key={d}
                  className="text-[9px] text-muted-foreground text-center"
                >
                  {d}
                </div>
              ))}
              {cells.map((cell) => {
                const inMonth = isSameMonth(cell, month);
                const key = format(cell, "yyyy-MM-dd");
                const data = byDate.get(key);
                const status: DayStatus | null =
                  data && isDayStatus(data.status) ? data.status : null;
                const color = status ? STATUS_META[status].bgClass : "bg-muted/30";
                const isHighlight = highlightDate === key;
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={!data}
                    onClick={() => data && onSelectDate?.(key)}
                    title={
                      data
                        ? `${format(cell, "dd MMM", { locale: tr })} · ${data.status}${data.totalHours ? ` · ${data.totalHours}` : ""}`
                        : format(cell, "dd MMM", { locale: tr })
                    }
                    className={cn(
                      "aspect-square rounded-sm text-[9px] flex items-center justify-center",
                      color,
                      !inMonth && "opacity-30",
                      data && "text-white font-medium cursor-pointer hover:ring-1 hover:ring-foreground/40",
                      isHighlight && "ring-2 ring-foreground"
                    )}
                  >
                    {format(cell, "d")}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
      <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground pt-2 border-t border-border">
        <Legend color={STATUS_META.present.bgClass} label={STATUS_META.present.label} />
        <Legend color={STATUS_META.late.bgClass} label={STATUS_META.late.label} />
        <Legend color={STATUS_META.absent.bgClass} label={STATUS_META.absent.label} />
        <Legend color={STATUS_META.leave.bgClass} label={STATUS_META.leave.label} />
        <Legend color={STATUS_META.weekend.bgClass} label="Hafta sonu / Tatil" />
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className={cn("h-2.5 w-2.5 rounded-sm", color)} />
      <span>{label}</span>
    </div>
  );
}
