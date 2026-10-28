import { NativeSelect } from "@/components/ui/native-select";
import { useState } from "react";
import type { Id } from "../../../convex/_generated/dataModel";
import { CollapsibleFilters } from "@/components/shared/CollapsibleFilters";
import { FilterBar, FilterField } from "@/components/shared/FilterBar";
import { QuerySectionBoundary } from "@/components/shared/QuerySectionBoundary";
import { DateInput, MonthPicker } from "@/components/ui/date-picker";
import { formatDateString, parseDateString } from "@/lib/date";
import { Button } from "@/components/ui/button";
import { EmployeePicker } from "./EmployeePicker";
import { leaveTypes, monthRange, readFilters, validDate } from "./lib/leaveState";

type Filters = ReturnType<typeof readFilters>;
export function LeaveFilters({ projectId, filters, onChange, onClear }: {
  projectId: Id<"projects">;
  filters: Filters;
  onChange: (values: Record<string, string | undefined>) => void;
  onClear: () => void;
}) {
  const [custom, setCustom] = useState(false);
  const source = `${filters.rangeStart}:${filters.rangeEnd}`;
  const [draft, setDraft] = useState({ source, start: filters.rangeStart, end: filters.rangeEnd });
  const range = draft.source === source ? draft : { source, start: filters.rangeStart, end: filters.rangeEnd };
  const showRange = custom || filters.period === "custom";
  const startError = !validDate(range.start) ? "Geçerli bir tarih girin." : undefined;
  const endError = !validDate(range.end) ? "Geçerli bir tarih girin." : undefined;
  const reversed = !startError && !endError && range.start > range.end;
  const changeRange = (next: { start: string; end: string }) => {
    setDraft({ source, ...next });
    if (validDate(next.start) && validDate(next.end) && next.start <= next.end) {
      onChange({ period: "custom", from: next.start, to: next.end });
    }
  };
  return <CollapsibleFilters activeCount={Number(Boolean(filters.employeeId)) + Number(Boolean(filters.leaveType))}>
    <FilterBar label="İzin filtreleri" onClear={() => { setCustom(false); setDraft({ source, start: filters.rangeStart, end: filters.rangeEnd }); onClear(); }} hasFilters>
      <QuerySectionBoundary title="Kişiler yüklenemedi." resetKey={projectId} className="contents">
        <FilterField label="Kişi" htmlFor="leave-filter-person">
          <EmployeePicker projectId={projectId} value={filters.employeeId ?? ""} onChange={value => onChange({ employee: value })} control={{ id: "leave-filter-person", "aria-invalid": false }} allowAll />
        </FilterField>
      </QuerySectionBoundary>
      <FilterField label="İzin türü" htmlFor="leave-filter-type">
        <NativeSelect id="leave-filter-type" className="w-full min-w-0" value={filters.leaveType ?? ""} onChange={event => onChange({ type: event.target.value })}>
          <option value="">Tüm türler</option>
          {Object.entries(leaveTypes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </NativeSelect>
      </FilterField>
      <FilterField label="Dönem" htmlFor="leave-month">
        <MonthPicker id="leave-month" className="w-full min-w-0" date={parseDateString(`${filters.period === "custom" ? filters.rangeStart.slice(0, 7) : filters.period}-01`)} onSelect={date => {
          const period = formatDateString(date).slice(0, 7);
          if (monthRange(period)) { setCustom(false); onChange({ period, from: undefined, to: undefined }); }
        }} />
      </FilterField>
      <FilterField label="Özel aralık" htmlFor="leave-custom-range"><Button id="leave-custom-range" variant="outline" onClick={() => { setDraft({ source, start: filters.rangeStart, end: filters.rangeEnd }); setCustom(true); }} aria-pressed={showRange}>Aralık seç</Button></FilterField>
      {showRange && <>
        <FilterField label="Başlangıç" htmlFor="leave-range-start">
          <DateInput id="leave-range-start" className="w-full min-w-0" value={range.start} aria-invalid={Boolean(startError || reversed)} aria-describedby={startError ? "leave-start-error" : reversed ? "leave-range-error" : undefined} onChange={start => changeRange({ ...range, start })} />
          {startError && <p id="leave-start-error" role="alert" className="text-destructive">{startError}</p>}
        </FilterField>
        <FilterField label="Bitiş" htmlFor="leave-range-end">
          <DateInput id="leave-range-end" className="w-full min-w-0" value={range.end} aria-invalid={Boolean(endError || reversed)} aria-describedby={endError ? "leave-end-error" : reversed ? "leave-range-error" : undefined} onChange={end => changeRange({ ...range, end })} />
          {endError && <p id="leave-end-error" role="alert" className="text-destructive">{endError}</p>}
          {reversed && <p id="leave-range-error" role="alert" className="text-destructive">Bitiş tarihi başlangıçtan önce olamaz.</p>}
        </FilterField>
      </>}
    </FilterBar>
    {showRange && <p className="mt-2 text-xs text-muted-foreground">Seçilen dönemle kesişen izinler gösterilir; izin süresi değişmez.</p>}
  </CollapsibleFilters>;
}
