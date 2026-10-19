import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
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
import { selectClass } from "./EmployeePicker";
import {
  currentMonth,
  dateLabel,
  leaveTypes,
  monthRange,
  readFilters,
  validDate,
} from "./lib/leaveState";

type Filters = ReturnType<typeof readFilters>;
function PersonOptions({
  projectId,
  search,
  selected,
  onChange,
}: {
  projectId: Id<"projects">;
  search: string;
  selected?: string;
  onChange: (value: string) => void;
}) {
  const data = useQuery(api.leaves.employeeOptions, {
    projectId,
    search: search || undefined,
  });
  return (
    <div className="w-full min-w-0 md:w-[230px]">
      <FormFieldWrapper htmlFor="leave-filter-person" label="Kişi">
        <select
          className={selectClass}
          value={selected ?? ""}
          disabled={data === undefined}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">
            {data === undefined ? "Kişiler yükleniyor…" : "Tüm kişiler"}
          </option>
          {selected && !data?.options.some((item) => item._id === selected) && (
            <option value={selected}>Seçili kişi</option>
          )}
          {data?.options.map((item) => (
            <option key={item._id} value={item._id}>
              {item.employeeName} ·{" "}
              {item.departmentName ?? "Departman belirtilmemiş"}
            </option>
          ))}
        </select>
      </FormFieldWrapper>
      {data?.truncated && (
        <p className="mt-1 text-xs text-muted-foreground">
          Sınırlı seçenek; aramayı daraltın. Tüm kişiler bulunmayabilir.
        </p>
      )}
    </div>
  );
}
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
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [custom, setCustom] = useState(false);
  const [range, setRange] = useState({
    start: filters.rangeStart,
    end: filters.rangeEnd,
  });
  const [error, setError] = useState("");
  return (
    <>
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchLabel="Kişi seçeneklerinde ara"
        placeholder="Kişi adı veya departman ara"
        hasFilters={Boolean(
          filters.employeeId ||
          filters.leaveType ||
          filters.period !== currentMonth(),
        )}
        onClear={() => {
          setSearch("");
          onClear();
        }}
      >
        <QuerySectionBoundary
          title="Kişi seçenekleri yüklenemedi."
          resetKey={`${projectId}:${debouncedSearch}`}
          className="w-full min-w-0 md:w-auto"
        >
          <PersonOptions
            projectId={projectId}
            search={debouncedSearch}
            selected={filters.employeeId}
            onChange={(value) => onChange({ employee: value })}
          />
        </QuerySectionBoundary>
        <div className="grid w-full min-w-0 grid-cols-2 gap-3 md:w-auto">
          <FormFieldWrapper htmlFor="leave-filter-type" label="İzin türü">
            <select
              className={selectClass}
              value={filters.leaveType ?? ""}
              onChange={(event) => onChange({ type: event.target.value })}
            >
              <option value="">Tüm türler</option>
              {Object.entries(leaveTypes).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </FormFieldWrapper>
          <FormFieldWrapper htmlFor="leave-period" label="Dönem">
            <select
              className={selectClass}
              value={filters.period === "custom" ? "custom" : "month"}
              onChange={(event) => {
                if (event.target.value === "custom") {
                  setRange({
                    start: filters.rangeStart,
                    end: filters.rangeEnd,
                  });
                  setError("");
                  setCustom(true);
                } else
                  onChange({
                    period: currentMonth(),
                    from: undefined,
                    to: undefined,
                  });
              }}
            >
              <option value="month">Ay seçimi</option>
              <option value="custom">Özel aralık</option>
            </select>
          </FormFieldWrapper>
        </div>
        {filters.period === "custom" ? (
          <Button
            variant="outline"
            onClick={() => {
              setRange({ start: filters.rangeStart, end: filters.rangeEnd });
              setError("");
              setCustom(true);
            }}
          >
            {dateLabel(filters.rangeStart)} – {dateLabel(filters.rangeEnd)}
          </Button>
        ) : (
          <FormFieldWrapper htmlFor="leave-month" label="Ay">
            <MonthPicker
              className="w-full min-w-0 md:w-[160px]"
              date={parseDateString(`${filters.period}-01`)}
              onSelect={(date) => {
                const period = formatDateString(date).slice(0, 7);
                if (monthRange(period))
                  onChange({ period, from: undefined, to: undefined });
              }}
            />
          </FormFieldWrapper>
        )}
      </FilterBar>
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
                setError("Geçerli bir tarih girin.");
                return;
              }
              if (range.start > range.end) {
                setError("Bitiş tarihi başlangıçtan önce olamaz.");
                return;
              }
              onChange({ period: "custom", from: range.start, to: range.end });
              setCustom(false);
            }}
          >
            <FormFieldWrapper
              htmlFor="leave-range-start"
              label="Başlangıç tarihi"
            >
              <DateInput
                className="min-w-0 max-w-full"
                value={range.start}
                onChange={(start) => setRange((value) => ({ ...value, start }))}
              />
            </FormFieldWrapper>
            <FormFieldWrapper
              htmlFor="leave-range-end"
              label="Bitiş tarihi"
              error={error}
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
