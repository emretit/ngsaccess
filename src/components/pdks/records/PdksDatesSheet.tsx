import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import type { PdksRecordsView } from "./usePdksRecordsView";
import { PDKSQuickPresets } from "@/components/pdks/dashboard/PDKSQuickPresets";
import { PDKSSavedViews } from "@/components/pdks/dashboard/PDKSSavedViews";
import { DateRangeFields } from "@/components/shared/DateRangeFields";
import { toLocalDateString } from "@/lib/date";
export function PdksDatesSheet({ datesOpen, setDatesOpen, rangeError, setRangeError, filters, setFilters, dateRangeLabel, startDate, endDate }: PdksRecordsView) {
  return (
      <Sheet open={datesOpen} onOpenChange={(open) => {
        setDatesOpen(open);
        if (!open) setRangeError("");
      }}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Tarih ve kayıtlı görünümler</SheetTitle>
            <SheetDescription>Seçili dönem: {dateRangeLabel}</SheetDescription>
          </SheetHeader>
          <div className="mt-5 space-y-5">
            <PDKSQuickPresets values={filters} onChange={setFilters} />
            <PDKSSavedViews filters={filters} onApply={setFilters} />
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">
                Özel tarih aralığı
              </legend>
              <DateRangeFields
                idPrefix="pdks-range"
                required
                constrainOrder
                labels={{ start: "Başlangıç", end: "Bitiş" }}
                value={{
                  start: filters.dateRange.from ? toLocalDateString(filters.dateRange.from) : startDate,
                  end: filters.dateRange.to ? toLocalDateString(filters.dateRange.to) : endDate,
                }}
                errors={{ range: rangeError || undefined }}
                onChange={(next, changed) => {
                  if (!next[changed]) return;
                  const from = changed === "start"
                    ? new Date(`${next.start}T12:00:00`)
                    : filters.dateRange.from ?? new Date(`${startDate}T12:00:00`);
                  const to = changed === "end"
                    ? new Date(`${next.end}T12:00:00`)
                    : filters.dateRange.to ?? new Date(`${endDate}T12:00:00`);
                  if (from > to) {
                    setRangeError(changed === "start" ? "Başlangıç tarihi bitişten sonra olamaz." : "Bitiş tarihi başlangıçtan önce olamaz.");
                    return;
                  }
                  setRangeError("");
                  setFilters({ ...filters, reportType: "custom", dateRange: { from, to } });
                }}
              />
            </fieldset>
          </div>
        </SheetContent>
      </Sheet>
  );
}
