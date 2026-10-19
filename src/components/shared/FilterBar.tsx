import { useId, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

/** onClear resets local filters only; project/scope belongs to the parent shell. */
export function FilterBar({ search, onSearchChange, searchLabel = "Ara", placeholder = "Ara…", children, onClear, hasFilters = false, end }: {
  search: string; onSearchChange: (value: string) => void; searchLabel?: string; placeholder?: string;
  children?: ReactNode; onClear: () => void; hasFilters?: boolean; end?: ReactNode;
}) {
  const id = useId();
  return <div role="search" aria-label="Liste filtreleri" className="flex flex-wrap items-end gap-3">
    <div className="w-full space-y-1 min-[761px]:w-[260px]"><Label htmlFor={id}>{searchLabel}</Label><Input id={id} type="search" value={search} placeholder={placeholder} onChange={event => onSearchChange(event.target.value)} /></div>
    {children}<Button type="button" variant="ghost" disabled={!hasFilters && !search} onClick={onClear}>Filtreleri temizle</Button>{end && <div className="ml-auto">{end}</div>}
  </div>;
}
