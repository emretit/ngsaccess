import { SegmentedViewControl } from "@/components/shared/SegmentedViewControl";
import type { FilterValues } from "@/components/pdks/dashboard/PDKSFilterBar";
import { currentPeriodRange } from "@/components/pdks/lib/calendar";

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
        { value: "custom", label: "Özel" },
      ]}
      onChange={reportType => setFilters({
        ...filters,
        reportType,
        // Özel aralık o an görülen dönemle açılır; kullanıcı yalnız ucu düzeltir.
        dateRange: reportType === "custom" ? currentPeriodRange(filters) : { from: undefined, to: undefined },
      })}
    />
  );
}
