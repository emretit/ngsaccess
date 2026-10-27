import { useId, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type SearchProps = {
  search: string;
  onSearchChange: (value: string) => void;
} | {
  search?: never;
  onSearchChange?: never;
};

type FilterBarProps = SearchProps & {
  searchLabel?: string;
  placeholder?: string;
  children?: ReactNode;
  onClear?: () => void;
  hasFilters?: boolean;
  end?: ReactNode;
  label?: string;
  layout?: "wrap" | "grid";
};

/** onClear resets local filters only; project/scope belongs to the parent shell. */
export function FilterBar({ search, onSearchChange, searchLabel = "Ara", placeholder = "Ara…", children, onClear, hasFilters = false, end, label = "Liste filtreleri", layout = "wrap" }: FilterBarProps) {
  const id = useId();
  const grid = layout === "grid";
  const searchInput = onSearchChange && <div className={grid ? "min-w-0" : "w-full space-y-1 min-[761px]:w-[260px]"}>
    <Label className={grid ? "sr-only" : undefined} htmlFor={id}>{searchLabel}</Label>
    <Input id={id} type="search" value={search} placeholder={placeholder} onChange={event => onSearchChange(event.target.value)} />
  </div>;
  return <div role="search" aria-label={label} className={grid ? "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2" : "flex flex-wrap items-end gap-3"}>
    {!grid && searchInput}{children}{grid && searchInput}
    {onClear && <Button type="button" variant="ghost" disabled={!hasFilters && !search} onClick={onClear}>Filtreleri temizle</Button>}
    {end && <div className="ml-auto">{end}</div>}
  </div>;
}
