import { CollapsibleFilters } from "@/components/shared/CollapsibleFilters";
import { FilterBar } from "@/components/shared/FilterBar";
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
  value,
  options,
  onChange,
}: {
  label: string;
  value?: string;
  options: { _id: string; name: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="min-w-0">
      <Select
        value={value || "all"}
        onValueChange={(v) => onChange(v === "all" ? "" : v)}
      >
        <SelectTrigger
          aria-label={label}
          className="w-full min-w-0 max-lg:min-h-11 [&>span]:truncate"
        >
          <SelectValue placeholder={label} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{label}: Tümü</SelectItem>
          {options.map((o) => (
            <SelectItem key={o._id} value={o._id}>
              {o.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function StatusFilters({
  filters,
  options,
  search,
  setSearch,
  change,
  clear,
}: {
  filters: Filters;
  options: Options;
  search: string;
  setSearch: (search: string) => void;
  change: (patch: Partial<Filters>) => void;
  clear: () => void;
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
      >
        <CollapsibleFilters collapseOn="all" activeCount={activeCount}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <StatusFilter
              label="Departman"
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
              value={filters.ruleId}
              options={options.rules}
              onChange={(v) =>
                change({ ruleId: options.rules.find((d) => d._id === v)?._id })
              }
            />
          </div>
        </CollapsibleFilters>
      </FilterBar>
    </div>
  );
}
