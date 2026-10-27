import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { FilterBar } from "@/components/shared/FilterBar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { labels, type Filters } from "./model";
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
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const activeCount = Object.entries(filters).filter(([key, value]) => key !== "search" && Boolean(value)).length;
  return (
    <div className="min-w-0 max-lg:[&_input]:min-h-11 max-lg:[&_button]:min-h-11 [&>[role=search]>div:last-of-type]:order-first lg:[&>[role=search]>div:last-of-type]:order-none">
      <FilterBar layout="grid" search={search} onSearchChange={setSearch} searchLabel="Ad ara" placeholder="Ad ara" onClear={clear} hasFilters={activeCount > 0}>
        <Button variant="outline" className="min-h-11 w-full lg:hidden" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(!open)}>Filtreler ({activeCount})</Button>
        <div id={panelId} className={open ? "contents" : "hidden lg:contents"}>
          <StatusFilter
            label="Departman"
            value={filters.departmentId}
            options={options.departments}
            onChange={(v) =>
              change({
                departmentId: options.departments.find((d) => d._id === v)?._id,
              })
            }
          />
          <StatusFilter
            label="Cihaz"
            value={filters.deviceId}
            options={options.devices}
            onChange={(v) =>
              change({ deviceId: options.devices.find((d) => d._id === v)?._id })
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
          <StatusFilter
            label="Şablon"
            value={filters.templateId}
            options={options.templates}
            onChange={(v) =>
              change({
                templateId: options.templates.find((d) => d._id === v)?._id,
              })
            }
          />
          <StatusFilter
            label="Durum"
            value={filters.state}
            options={["effective", "pending", "failed", "removed"].map((s) => ({
              _id: s,
              name: labels[s as keyof typeof labels],
            }))}
            onChange={(v) =>
              change({
                state:
                  v === "effective" ||
                  v === "pending" ||
                  v === "failed" ||
                  v === "removed"
                    ? v
                    : undefined,
              })
            }
          />
        </div>
      </FilterBar>
    </div>
  );
}
