import { isSameDay, isSameMonth, isSameWeek } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  getDateRange,
  PRESET_LABELS,
  type PresetKey,
} from "@/lib/pdksDateRanges";
import type { FilterValues, ReportType } from "./PDKSFilterBar";

const PRESETS: Array<{ key: PresetKey; reportType: ReportType }> = [
  { key: "today", reportType: "daily" },
  { key: "this-week", reportType: "weekly" },
  { key: "this-month", reportType: "monthly" },
  { key: "last-7", reportType: "custom" },
  { key: "last-30", reportType: "custom" },
  { key: "ytd", reportType: "custom" },
];

function isActive(values: FilterValues, reportType: ReportType, range: { from: Date; to: Date }): boolean {
  if (values.reportType !== reportType) return false;
  const anchor = values.anchorDate ?? new Date();
  if (reportType === "daily") return isSameDay(anchor, new Date());
  if (reportType === "weekly") return isSameWeek(anchor, new Date(), { weekStartsOn: 1 });
  if (reportType === "monthly") return isSameMonth(anchor, new Date());
  const { from, to } = values.dateRange;
  return !!from && !!to && isSameDay(from, range.from) && isSameDay(to, range.to);
}

interface PDKSQuickPresetsProps {
  values: FilterValues;
  onChange: (values: FilterValues) => void;
}

export function PDKSQuickPresets({ values, onChange }: PDKSQuickPresetsProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {PRESETS.map((p) => {
        const range = getDateRange(p.key);
        const active = isActive(values, p.reportType, range);
        return (
          <Button
            key={p.key}
            variant={active ? "default" : "outline"}
            size="sm"
            className="h-7 text-xs rounded-full px-3"
            onClick={() =>
              onChange({ ...values, anchorDate: new Date(), dateRange: p.reportType === "custom" ? range : { from: undefined, to: undefined }, reportType: p.reportType })
            }
          >
            {PRESET_LABELS[p.key]}
          </Button>
        );
      })}
    </div>
  );
}
