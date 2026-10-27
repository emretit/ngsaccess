import { SegmentedViewControl } from "@/components/shared/SegmentedViewControl";
import type { FilterValues } from "@/components/pdks/dashboard/PDKSFilterBar";

export function PdksPeriodSwitcher({ filters, setFilters }: { filters: FilterValues; setFilters: (values: FilterValues) => void }) {
  return (
    <SegmentedViewControl
      label="Rapor dönemi"
      value={filters.reportType}
      className="gap-1"
      options={[
        { value: "daily", label: "Günlük" },
        { value: "weekly", label: "Haftalık" },
        { value: "monthly", label: "Aylık" },
      ]}
      onChange={reportType => setFilters({
        ...filters,
        reportType,
        dateRange: { from: undefined, to: undefined },
      })}
    />
  );
}
