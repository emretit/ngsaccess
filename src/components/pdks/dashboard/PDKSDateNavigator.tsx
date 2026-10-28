import { currentPeriodRange, pdksToday } from "@/components/pdks/lib/calendar";
import {
  addDays,
  addMonths,
  addWeeks,
  endOfWeek,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { tr } from "date-fns/locale";
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";
import { Button } from "@/components/ui/button";
import type { FilterValues } from "./PDKSFilterBar";

function RangeEndPicker({ label, date, minDate, maxDate, onSelect }: {
  label: string;
  date: Date;
  minDate?: Date;
  maxDate?: Date;
  onSelect: (date: Date) => void;
}) {
  const text = format(date, "d MMM yyyy", { locale: tr });
  return (
    <DatePicker
      date={date}
      required
      minDate={minDate}
      maxDate={maxDate}
      onSelect={(next) => {
        if (next) onSelect(next);
      }}
      trigger={
        <Button variant="outline" size="sm" className="h-9 text-xs" aria-label={`${label}: ${text}`}>
          {text}
          <CalendarIcon className="h-4 w-4 opacity-50" aria-hidden="true" />
        </Button>
      }
    />
  );
}

export function PDKSDateNavigator({
  values,
  onChange,
}: {
  values: FilterValues;
  onChange: (values: FilterValues) => void;
}) {
  const anchor = values.anchorDate ?? pdksToday();
  const label =
    values.reportType === "monthly"
        ? format(anchor, "MMMM yyyy", { locale: tr })
        : values.reportType === "weekly"
          ? `${format(startOfWeek(anchor, { weekStartsOn: 1 }), "d MMM", { locale: tr })} – ${format(endOfWeek(anchor, { weekStartsOn: 1 }), "d MMM yyyy", { locale: tr })}`
          : format(anchor, "d MMMM yyyy", { locale: tr });
  const shift = (step: number) =>
    values.reportType === "monthly"
      ? addMonths(anchor, step)
      : values.reportType === "weekly"
        ? addWeeks(anchor, step)
        : addDays(anchor, step);
  const periodStart = (d: Date) =>
    values.reportType === "monthly"
      ? startOfMonth(d)
      : values.reportType === "weekly"
        ? startOfWeek(d, { weekStartsOn: 1 })
        : startOfDay(d);
  // Gelecek dönemde kayıt olmaz; herkes "devamsız" görünmesin.
  const nextDisabled = periodStart(shift(1)) > pdksToday();
  const move = (step: number) =>
    onChange({ ...values, anchorDate: shift(step) });
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1 text-xs">
      {values.reportType !== "custom" && (
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          aria-label="Önceki dönem"
          onClick={() => move(-1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      )}
      {values.reportType === "custom" ? (
        <CustomRange values={values} onChange={onChange} />
      ) : (
        <DatePicker
          date={anchor}
          required
          onSelect={(date) => {
            if (date) onChange({ ...values, anchorDate: date });
          }}
          trigger={
            <Button
              variant="outline"
              size="sm"
              className="h-9 text-xs"
              aria-label={`Tarih seç: ${label}`}
            >
              {label}
              <CalendarIcon className="h-4 w-4 opacity-50" aria-hidden="true" />
            </Button>
          }
        />
      )}
      {values.reportType !== "custom" && (
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          aria-label="Sonraki dönem"
          disabled={nextDisabled}
          onClick={() => move(1)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

function CustomRange({ values, onChange }: { values: FilterValues; onChange: (values: FilterValues) => void }) {
  const { from, to } = currentPeriodRange(values);
  const setRange = (next: { from: Date; to: Date }) =>
    onChange({ ...values, reportType: "custom", dateRange: next });
  return (
    <>
      <RangeEndPicker label="Başlangıç" date={from} maxDate={to} onSelect={(date) => setRange({ from: date, to })} />
      <span className="px-0.5 text-muted-foreground" aria-hidden="true">–</span>
      <RangeEndPicker label="Bitiş" date={to} minDate={from} maxDate={pdksToday()} onSelect={(date) => setRange({ from, to: date })} />
    </>
  );
}
