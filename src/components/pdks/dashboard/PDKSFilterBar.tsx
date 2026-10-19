import { STATUS_FILTER_LABELS } from "../statusMeta";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePdksFilterOptions } from "@/hooks/usePdksFilterOptions";
import { useState } from "react";
import type { Id } from "../../../../convex/_generated/dataModel";
import type { PdksStatusFilter } from "@/hooks/usePdksTableData";
import { Button } from "@/components/ui/button";
import { FilterBar } from "@/components/shared/FilterBar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
export type ReportType = "daily" | "weekly" | "monthly" | "custom";
export type StatusFilter = PdksStatusFilter;
export interface FilterValues {
  anchorDate?: Date;
  dateRange: { from: Date | undefined; to: Date | undefined };
  reportType: ReportType;
  companyId?: Id<"companies">;
  departmentId?: Id<"departments">;
  positionId?: Id<"positions">;
  shiftId?: Id<"shifts">;
  statusFilter: StatusFilter;
  person: string;
  employeeId?: Id<"employees">;
}
export function clearPdksFilters(values: FilterValues): FilterValues {
  return {
    ...values,
    person: "",
    employeeId: undefined,
    companyId: undefined,
    departmentId: undefined,
    positionId: undefined,
    shiftId: undefined,
    statusFilter: "all",
  };
}
export function PDKSFilterBar({
  values,
  onChange,
  onClear,
}: {
  values: FilterValues;
  onChange: (values: FilterValues) => void;
  onClear?: () => void;
}) {
  const [mobileFilters, setMobileFilters] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const { departments, companies, positions, shifts } = usePdksFilterOptions();

  return (
    <>
    <Button className="sm:hidden" variant="outline" aria-expanded={mobileFilters} onClick={() => setMobileFilters(v => !v)}>Filtreler</Button>
    <div className={mobileFilters ? "block" : "hidden sm:block"}>
    <FilterBar
      search={values.person}
      onSearchChange={(person) => onChange({ ...values, person })}
      searchLabel="Ad / soyad"
      placeholder="Ad veya soyad ara"
      hasFilters={Boolean(
        values.companyId ||
        values.departmentId ||
        values.positionId ||
        values.shiftId ||
        values.statusFilter !== "all",
      )}
      onClear={() => {
        onClear?.();
        onChange(clearPdksFilters(values));
      }}
    >
      <label className="text-xs sm:w-48">
        Departman
        <Select value={values.departmentId ?? "all"} onValueChange={value => onChange({ ...values, departmentId: value === "all" ? undefined : value as Id<"departments"> })}>
                <SelectTrigger className="mt-1" aria-label="Tüm departmanlar"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">Tüm departmanlar</SelectItem>
                  {departments?.map(d => <SelectItem key={d._id} value={d._id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
      </label>
      <label className="text-xs sm:w-48">Durum
        <Select value={values.statusFilter} onValueChange={value => onChange({ ...values, statusFilter: value as StatusFilter })}>
          <SelectTrigger className="mt-1" aria-label="Durum"><SelectValue /></SelectTrigger>
          <SelectContent>{Object.entries(STATUS_FILTER_LABELS).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent>
        </Select>
      </label>
      <Button variant="outline" onClick={() => setAdvanced(true)}>
        Diğer filtreler
        {[values.companyId, values.positionId, values.shiftId].filter(Boolean)
          .length > 0 &&
          ` (${[values.companyId, values.positionId, values.shiftId].filter(Boolean).length})`}
      </Button>
      <Sheet open={advanced} onOpenChange={setAdvanced}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Diğer filtreler</SheetTitle>
            <SheetDescription>
              Tarih ve proje seçiminiz korunur.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-5">
            <label className="block text-sm">
              Şirket
              <Select value={values.companyId ?? "all"} onValueChange={value => onChange({ ...values, companyId: value === "all" ? undefined : value as Id<"companies"> })}>
                <SelectTrigger className="mt-1" aria-label="Tüm şirketler"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">Tüm şirketler</SelectItem>
                  {companies?.map(c => <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </label>
            <label className="block text-sm">
              Pozisyon
              <Select value={values.positionId ?? "all"} onValueChange={value => onChange({ ...values, positionId: value === "all" ? undefined : value as Id<"positions"> })}>
                <SelectTrigger className="mt-1" aria-label="Tüm pozisyonlar"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">Tüm pozisyonlar</SelectItem>
                  {positions?.map(p => <SelectItem key={p._id} value={p._id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </label>
            <label className="block text-sm">
              Vardiya
              <Select value={values.shiftId ?? "all"} onValueChange={value => onChange({ ...values, shiftId: value === "all" ? undefined : value as Id<"shifts"> })}>
                <SelectTrigger className="mt-1" aria-label="Tüm vardiyalar"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">Tüm vardiyalar</SelectItem>
                  {shifts?.map(s => <SelectItem key={s._id} value={s._id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </label>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setAdvanced(false)}
            >
              Tamam
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </FilterBar>
    </div>
    </>
  );
}
