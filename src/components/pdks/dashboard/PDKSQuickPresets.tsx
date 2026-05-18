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
  { key: "last-7", reportType: "weekly" },
  { key: "last-30", reportType: "custom" },
  { key: "ytd", reportType: "custom" },
];

function isActive(
  values: FilterValues,
  range: { from: Date; to: Date }
): boolean {
  const { from, to } = values.dateRange;
  if (!from || !to) return false;
  return (
    Math.abs(from.getTime() - range.from.getTime()) < 60_000 &&
    Math.abs(to.getTime() - range.to.getTime()) < 60_000
  );
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
        const active = isActive(values, range);
        return (
          <Button
            key={p.key}
            variant={active ? "default" : "outline"}
            size="sm"
            className="h-7 text-xs rounded-full px-3"
            onClick={() =>
              onChange({ ...values, dateRange: range, reportType: p.reportType })
            }
          >
            {PRESET_LABELS[p.key]}
          </Button>
        );
      })}
    </div>
  );
}
