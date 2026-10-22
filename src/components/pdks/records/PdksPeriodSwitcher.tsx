import { Button } from "@/components/ui/button";
import type { FilterValues, ReportType } from "@/components/pdks/dashboard/PDKSFilterBar";
export function PdksPeriodSwitcher({ filters, setFilters }: { filters: FilterValues; setFilters: (values: FilterValues) => void }) {
  return (
        <div
          className="flex flex-wrap gap-1"
          role="group"
          aria-label="Rapor dönemi"
        >
          {(
            [
              ["daily", "Günlük"],
              ["weekly", "Haftalık"],
              ["monthly", "Aylık"],
            ] as const
          ).map(([value, label]) => (
            <Button
              key={value}
              variant={filters.reportType === value ? "secondary" : "ghost"}
              aria-pressed={filters.reportType === value}
              onClick={() =>
                setFilters({
                  ...filters,
                  reportType: value as ReportType,
                  dateRange: { from: undefined, to: undefined },
                })
              }
            >
              {label}
            </Button>
          ))}
        </div>
  );
}
