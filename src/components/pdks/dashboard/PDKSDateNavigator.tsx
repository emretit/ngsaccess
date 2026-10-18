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
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";
import { Button } from "@/components/ui/button";
import type { FilterValues } from "./PDKSFilterBar";

export function PDKSDateNavigator({
  values,
  onChange,
}: {
  values: FilterValues;
  onChange: (values: FilterValues) => void;
}) {
  const anchor = values.anchorDate ?? new Date();
  const label =
    values.reportType === "custom"
      ? values.dateRange.from && values.dateRange.to
        ? `${format(values.dateRange.from, "d MMM", { locale: tr })} – ${format(values.dateRange.to, "d MMM yyyy", { locale: tr })}`
        : "Tarih aralığı seçin"
      : values.reportType === "monthly"
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
  const nextDisabled = periodStart(shift(1)) > new Date();
  const move = (step: number) =>
    onChange({ ...values, anchorDate: shift(step) });
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1 text-xs">
      {values.reportType !== "custom" && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          aria-label="Önceki dönem"
          onClick={() => move(-1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      )}
      {values.reportType === "custom" ? (
        <span aria-live="polite">{label}</span>
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
            </Button>
          }
        />
      )}
      {values.reportType !== "custom" && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          aria-label="Sonraki dönem"
          disabled={nextDisabled}
          onClick={() => move(1)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      )}
      <Button
        variant="outline"
        size="sm"
        className="h-7 text-xs"
        onClick={() =>
          onChange({
            ...values,
            anchorDate: new Date(),
            reportType:
              values.reportType === "custom" ? "daily" : values.reportType,
            dateRange: { from: undefined, to: undefined },
          })
        }
      >
        Bugün
      </Button>
    </div>
  );
}
