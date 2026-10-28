import { STATUS_FILTER_LABELS } from "../statusMeta";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePdksFilterOptions } from "@/hooks/usePdksFilterOptions";
import { useId, type ReactNode } from "react";
import type { Id } from "../../../../convex/_generated/dataModel";
import type { PdksStatusFilter } from "@/hooks/usePdksTableData";
import { CollapsibleFilters } from "@/components/shared/CollapsibleFilters";
import { FilterBar, FilterField } from "@/components/shared/FilterBar";
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
    statusFilter: "all",
  };
}
// Canlı İzleme filtreleriyle aynı ölçü: küçük etiket üstte, 160px alan, tek sarılan satır.
function FilterSelect({ label, value, onValueChange, children }: { label: string; value: string; onValueChange: (value: string) => void; children: ReactNode }) {
  const id = useId();
  return <FilterField label={label} htmlFor={id}><Select value={value} onValueChange={onValueChange}><SelectTrigger id={id} className="w-full min-w-0"><SelectValue /></SelectTrigger><SelectContent>{children}</SelectContent></Select></FilterField>;
}
type Option = { _id: string; name: string };
/** Yükleniyor ve silinmiş seçili kayıt satırları dahil seçenek listesi. */
function OptionItems({ all, loading, selected, items }: { all: string; loading: string; selected?: string; items: Option[] | undefined }) {
  return <>
    <SelectItem value="all">{all}</SelectItem>
    {items === undefined && <SelectItem value="__loading" disabled>{loading}</SelectItem>}
    {selected && items !== undefined && !items.some(item => item._id === selected) && <SelectItem value={selected}>Kaldırılmış kayıt</SelectItem>}
    {items?.map(item => <SelectItem key={item._id} value={item._id}>{item.name}</SelectItem>)}
  </>;
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
  const { departments, companies, positions } = usePdksFilterOptions();

  return (
    <CollapsibleFilters>
    <FilterBar
      search={values.person}
      onSearchChange={(person) => onChange({ ...values, person })}
      searchLabel="Ad / soyad"
      placeholder="Ad veya soyad ara"
      hasFilters={Boolean(
        values.companyId ||
        values.departmentId ||
        values.positionId ||
        values.statusFilter !== "all",
      )}
      onClear={() => {
        onClear?.();
        onChange(clearPdksFilters(values));
      }}
    >
      <FilterSelect label="Şirket" value={values.companyId ?? "all"} onValueChange={value => onChange({ ...values, companyId: value === "all" ? undefined : value as Id<"companies"> })}>
        <OptionItems all="Tüm şirketler" loading="Şirketler yükleniyor…" selected={values.companyId} items={companies} />
      </FilterSelect>
      <FilterSelect label="Departman" value={values.departmentId ?? "all"} onValueChange={value => onChange({ ...values, departmentId: value === "all" ? undefined : value as Id<"departments"> })}>
        <OptionItems all="Tüm departmanlar" loading="Departmanlar yükleniyor…" selected={values.departmentId} items={departments} />
      </FilterSelect>
      <FilterSelect label="Pozisyon" value={values.positionId ?? "all"} onValueChange={value => onChange({ ...values, positionId: value === "all" ? undefined : value as Id<"positions"> })}>
        <OptionItems all="Tüm pozisyonlar" loading="Pozisyonlar yükleniyor…" selected={values.positionId} items={positions} />
      </FilterSelect>
      <FilterSelect label="Durum" value={values.statusFilter} onValueChange={value => onChange({ ...values, statusFilter: value as StatusFilter })}>
        {Object.entries(STATUS_FILTER_LABELS).map(([key, label]) => <SelectItem key={key} value={key}>{key === "all" ? "Tüm durumlar" : label}</SelectItem>)}
      </FilterSelect>
    </FilterBar>
    </CollapsibleFilters>
  );
}
