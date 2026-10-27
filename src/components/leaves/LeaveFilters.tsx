import { NativeSelect } from "@/components/ui/native-select";
import { useState } from "react";
import type { Id } from "../../../convex/_generated/dataModel";
import { CollapsibleFilters } from "@/components/shared/CollapsibleFilters";
import { FilterBar } from "@/components/shared/FilterBar";
import { FormFieldWrapper } from "@/components/shared/FormFieldWrapper";
import { QuerySectionBoundary } from "@/components/shared/QuerySectionBoundary";
import { DateInput, MonthPicker } from "@/components/ui/date-picker";
import { formatDateString, parseDateString } from "@/lib/date";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { EmployeePicker } from "./EmployeePicker";
import {
  dateLabel,
  leaveTypes,
  monthRange,
  readFilters,
  validDate,
} from "./lib/leaveState";

type Filters = ReturnType<typeof readFilters>;
export function LeaveFilters({
  projectId,
  filters,
  onChange,
  onClear,
}: {
  projectId: Id<"projects">;
  filters: Filters;
  onChange: (values: Record<string, string | undefined>) => void;
  onClear: () => void;
}) {
  const [custom, setCustom] = useState(false);
  const [range, setRange] = useState({
    start: filters.rangeStart,
    end: filters.rangeEnd,
  });
  const [errors, setErrors] = useState<{ start?: string; end?: string; range?: boolean }>({});
  return (
    <>
      <CollapsibleFilters activeCount={Number(Boolean(filters.employeeId)) + Number(Boolean(filters.leaveType))}>
      <FilterBar label="İzin filtreleri" onClear={onClear} hasFilters>
        <QuerySectionBoundary title="Kişiler yüklenemedi." resetKey={projectId} className="w-full min-w-0 md:w-[230px]">
          <FormFieldWrapper htmlFor="leave-filter-person" label="Kişi">
            {control => <EmployeePicker projectId={projectId} value={filters.employeeId ?? ""} onChange={value => onChange({ employee: value })} control={control} allowAll />}
          </FormFieldWrapper>
        </QuerySectionBoundary>
        <div className="w-full min-w-0 md:w-[180px]">
          <FormFieldWrapper htmlFor="leave-filter-type" label="İzin türü">
            <NativeSelect
              className="min-w-0"
              value={filters.leaveType ?? ""}
              onChange={(event) => onChange({ type: event.target.value })}
            >
              <option value="">Tüm türler</option>
              {Object.entries(leaveTypes).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </NativeSelect>
          </FormFieldWrapper>
        </div>
        <div className="w-full min-w-0 space-y-1.5 md:w-auto">
          <span aria-hidden="true" className="block text-sm font-medium">Dönem</span>
          <label htmlFor="leave-month" className="sr-only">Dönem ayı: {new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric", timeZone: "Europe/Istanbul" }).format(new Date(`${filters.rangeStart}T12:00:00Z`))}</label>
          <div className="flex flex-wrap gap-2">
            <MonthPicker id="leave-month" className="min-w-0 w-[180px]" date={parseDateString(`${filters.period === "custom" ? filters.rangeStart.slice(0, 7) : filters.period}-01`)} onSelect={date => {
              const period = formatDateString(date).slice(0, 7);
              if (monthRange(period)) onChange({ period, from: undefined, to: undefined });
            }} />
            <Button variant="outline" onClick={() => { setRange({ start: filters.rangeStart, end: filters.rangeEnd }); setErrors({}); setCustom(true); }}>
              {filters.period === "custom" ? `${dateLabel(filters.rangeStart)} – ${dateLabel(filters.rangeEnd)}` : "Özel aralık…"}
            </Button>
          </div>
        </div>
      </FilterBar>
      </CollapsibleFilters>
      <Dialog open={custom} onOpenChange={setCustom}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Özel tarih aralığı</DialogTitle>
            <DialogDescription>
              Seçilen dönemle kesişen izinler gösterilir; izin süresi değişmez.
            </DialogDescription>
          </DialogHeader>
          <form
            className="min-w-0 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!validDate(range.start) || !validDate(range.end)) {
                setErrors({
                  start: !validDate(range.start) ? "Geçerli bir tarih girin." : undefined,
                  end: !validDate(range.end) ? "Geçerli bir tarih girin." : undefined,
                });
                return;
              }
              if (range.start > range.end) {
                setErrors({ end: "Bitiş tarihi başlangıçtan önce olamaz.", range: true });
                return;
              }
              onChange({ period: "custom", from: range.start, to: range.end });
              setCustom(false);
            }}
          >
            <FormFieldWrapper
              htmlFor="leave-range-start"
              label="Başlangıç tarihi"
              error={errors.start}
            >
              <DateInput
                className="min-w-0 max-w-full"
                aria-invalid={errors.range}
                value={range.start}
                onChange={(start) => setRange((value) => ({ ...value, start }))}
              />
            </FormFieldWrapper>
            <FormFieldWrapper
              htmlFor="leave-range-end"
              label="Bitiş tarihi"
              error={errors.end}
            >
              <DateInput
                className="min-w-0 max-w-full"
                value={range.end}
                onChange={(end) => setRange((value) => ({ ...value, end }))}
              />
            </FormFieldWrapper>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCustom(false)}
              >
                İptal
              </Button>
              <Button type="submit">Uygula</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
