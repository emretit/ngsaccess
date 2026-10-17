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
}
export function clearPdksFilters(values: FilterValues): FilterValues {
  return {
    ...values,
    person: "",
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
  const [advanced, setAdvanced] = useState(false);
  const { departments, companies, positions, shifts } = usePdksFilterOptions();
  const controlClass =
    "h-9 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm";
  return (
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
        <select
          className={`${controlClass} mt-1`}
          value={values.departmentId ?? ""}
          onChange={(e) =>
            onChange({
              ...values,
              departmentId: (e.target.value || undefined) as
                | Id<"departments">
                | undefined,
            })
          }
        >
          <option value="">Tüm departmanlar</option>
          {departments?.map((d) => (
            <option key={d._id} value={d._id}>
              {d.name}
            </option>
          ))}
        </select>
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
              <select
                className={`${controlClass} mt-1`}
                value={values.companyId ?? ""}
                onChange={(e) =>
                  onChange({
                    ...values,
                    companyId: (e.target.value || undefined) as
                      | Id<"companies">
                      | undefined,
                  })
                }
              >
                <option value="">Tüm şirketler</option>
                {companies?.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              Pozisyon
              <select
                className={`${controlClass} mt-1`}
                value={values.positionId ?? ""}
                onChange={(e) =>
                  onChange({
                    ...values,
                    positionId: (e.target.value || undefined) as
                      | Id<"positions">
                      | undefined,
                  })
                }
              >
                <option value="">Tüm pozisyonlar</option>
                {positions?.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              Vardiya
              <select
                className={`${controlClass} mt-1`}
                value={values.shiftId ?? ""}
                onChange={(e) =>
                  onChange({
                    ...values,
                    shiftId: (e.target.value || undefined) as
                      | Id<"shifts">
                      | undefined,
                  })
                }
              >
                <option value="">Tüm vardiyalar</option>
                {shifts?.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name}
                  </option>
                ))}
              </select>
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
  );
}
