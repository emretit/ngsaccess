import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import type { PdksRecordsView } from "./usePdksRecordsView";
import { PDKSQuickPresets } from "@/components/pdks/dashboard/PDKSQuickPresets";
import { PDKSSavedViews } from "@/components/pdks/dashboard/PDKSSavedViews";
import { DateInput } from "@/components/ui/date-picker";
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
              <label className="block text-xs">
                Başlangıç
                <DateInput
                  required
                  className="mt-1"
                  value={
                    filters.dateRange.from
                      ? toLocalDateString(filters.dateRange.from)
                      : startDate
                  }
                  max={
                    filters.dateRange.to
                      ? toLocalDateString(filters.dateRange.to)
                      : undefined
                  }
                  onChange={(value) => {
                    if (!value) return;
                    const from = new Date(`${value}T12:00:00`);
                    const to =
                      filters.dateRange.to ?? new Date(`${endDate}T12:00:00`);
                    if (from > to) {
                      setRangeError("Başlangıç tarihi bitişten sonra olamaz.");
                      return;
                    }
                    setRangeError("");
                    setFilters({
                      ...filters,
                      reportType: "custom",
                      dateRange: { from, to },
                    });
                  }}
                />
              </label>
              <label className="block text-xs">
                Bitiş
                <DateInput
                  required
                  className="mt-1"
                  value={
                    filters.dateRange.to
                      ? toLocalDateString(filters.dateRange.to)
                      : endDate
                  }
                  min={
                    filters.dateRange.from
                      ? toLocalDateString(filters.dateRange.from)
                      : undefined
                  }
                  onChange={(value) => {
                    if (!value) return;
                    const from =
                      filters.dateRange.from ??
                      new Date(`${startDate}T12:00:00`);
                    const to = new Date(`${value}T12:00:00`);
                    if (from > to) {
                      setRangeError("Bitiş tarihi başlangıçtan önce olamaz.");
                      return;
                    }
                    setRangeError("");
                    setFilters({
                      ...filters,
                      reportType: "custom",
                      dateRange: { from, to },
                    });
                  }}
                />
              </label>
              {rangeError && (
                <p role="alert" className="text-xs text-danger">
                  {rangeError}
                </p>
              )}
            </fieldset>
          </div>
        </SheetContent>
      </Sheet>
  );
}
