import { useId, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export const FILTER_FIELD_CLASS = "grid w-full min-w-0 gap-1 text-xs min-[761px]:w-40";

export function FilterField({ label, htmlFor, children }: { label: string; htmlFor?: string; children: ReactNode }) {
  return <div className={FILTER_FIELD_CLASS}>{htmlFor ? <label htmlFor={htmlFor}>{label}</label> : <span>{label}</span>}{children}</div>;
}

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
  /** Sayfa aksiyonları (içe/dışa aktar, şablon, ayarlar): filtrelerle aynı satırda sağa yaslanır. */
  end?: ReactNode;
  label?: string;
  layout?: "wrap" | "grid";
};

/** onClear resets local filters only; project/scope belongs to the parent shell. */
export function FilterBar({ search, onSearchChange, searchLabel = "Ara", placeholder = "Ara…", children, onClear, hasFilters = false, end, label = "Liste filtreleri", layout = "wrap" }: FilterBarProps) {
  const id = useId();
  const grid = layout === "grid";
  const searchInput = onSearchChange && <div className={grid ? "min-w-0" : "grid w-full min-w-0 gap-1 text-xs min-[761px]:w-auto min-[761px]:flex-[1_1_200px] min-[761px]:max-w-[260px]"}>
    {grid ? <Label className="sr-only" htmlFor={id}>{searchLabel}</Label> : <label htmlFor={id}>{searchLabel}</label>}
    <Input id={id} type="search" value={search} placeholder={placeholder} onChange={event => onSearchChange(event.target.value)} />
  </div>;
  return <div role="search" aria-label={label} className={grid ? "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2" : "flex flex-wrap items-end gap-3"}>
    {!grid && searchInput}{children}{grid && searchInput}
    {onClear && <Button type="button" variant="ghost" disabled={!hasFilters && !search} onClick={onClear}>Filtreleri temizle</Button>}
    {end && <div className="ml-auto flex flex-wrap items-center gap-2">{end}</div>}
  </div>;
}
