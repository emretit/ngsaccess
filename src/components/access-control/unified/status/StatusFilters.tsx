import { useId, type ReactNode } from "react";
import { CollapsibleFilters } from "@/components/shared/CollapsibleFilters";
import { FilterBar, FilterField } from "@/components/shared/FilterBar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Filters } from "./model";
import type { Options } from "./useStatusData";


export function StatusFilter({
  label,
  allLabel,
  value,
  options,
  onChange,
}: {
  label: string;
  allLabel: string;
  value?: string;
  options: { _id: string; name: string }[];
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <FilterField label={label} htmlFor={id}>
      <Select
        value={value || "all"}
        onValueChange={(v) => onChange(v === "all" ? "" : v)}
      >
        <SelectTrigger
          id={id}
          className="w-full min-w-0 max-lg:min-h-11 [&>span]:truncate"
        >
          <SelectValue placeholder={label} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{allLabel}</SelectItem>
          {options.map((o) => (
            <SelectItem key={o._id} value={o._id}>
              {o.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FilterField>
  );
}

export function StatusFilters({
  filters,
  options,
  search,
  setSearch,
  change,
  clear,
  actions,
}: {
  filters: Filters;
  options: Options;
  search: string;
  setSearch: (search: string) => void;
  change: (patch: Partial<Filters>) => void;
  clear: () => void;
  actions?: ReactNode;
}) {
  const activeCount = Object.entries(filters).filter(
    ([key, value]) => key !== "search" && key !== "state" && Boolean(value),
  ).length;
  return (
    <div className="min-w-0 max-lg:[&_input]:min-h-11 max-lg:[&_button]:min-h-11">
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchLabel="Ad ara"
        placeholder="Ad ara"
        onClear={clear}
        hasFilters={activeCount > 0 || Boolean(filters.state)}
        end={actions}
      >
        <CollapsibleFilters desktopDisplay="contents" activeCount={activeCount}>

          <StatusFilter
            label="Departman"
            allLabel="Tüm departmanlar"
            value={filters.departmentId}
            options={options.departments}
            onChange={(v) =>
              change({
                departmentId: options.departments.find((d) => d._id === v)
                  ?._id,
              })
            }
          />
          <StatusFilter
            label="Cihaz"
            allLabel="Tüm cihazlar"
            value={filters.deviceId}
            options={options.devices}
            onChange={(v) =>
              change({
                deviceId: options.devices.find((d) => d._id === v)?._id,
              })
            }
          />
          <StatusFilter
            label="Kural"
            allLabel="Tüm kurallar"
            value={filters.ruleId}
            options={options.rules}
            onChange={(v) =>
              change({ ruleId: options.rules.find((d) => d._id === v)?._id })
            }
          />
        </CollapsibleFilters>
      </FilterBar>
    </div>
  );
}
