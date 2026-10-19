import { FilterBar } from "@/components/shared/FilterBar";
interface Props {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  status: string;
  statusCounts: { all: number; active: number; inactive: number };
  onStatusChange: (value: string) => void;
  sort: string;
  onSortChange: (value: string) => void;
  onClear: () => void;
  hasFilters: boolean;
}
export function EmployeeFilters(p: Props) {
  const selectClass =
    "h-9 max-w-full rounded-md border border-input bg-background px-2 text-sm";
  return (
    <FilterBar
      search={p.searchQuery}
      onSearchChange={p.onSearchChange}
      searchLabel="Personel ara"
      placeholder="Ad, e-posta, kart veya bordro…"
      onClear={p.onClear}
      hasFilters={p.hasFilters}
    >
      <select
        aria-label="Personel durumu"
        className={selectClass}
        value={p.status}
        onChange={(e) => p.onStatusChange(e.target.value)}
      >
        <option value="all">Tüm durumlar ({p.statusCounts.all})</option>
        <option value="active">Aktif ({p.statusCounts.active})</option>
        <option value="inactive">Pasif ({p.statusCounts.inactive})</option>
      </select>
      <select
        aria-label="Personel sıralaması"
        className={selectClass}
        value={p.sort}
        onChange={(e) => p.onSortChange(e.target.value)}
      >
        {[
          ["name:asc", "Ad (A–Z)"],
          ["name:desc", "Ad (Z–A)"],
          ["department:asc", "Departman (A–Z)"],
          ["department:desc", "Departman (Z–A)"],
          ["email:asc", "E-posta (A–Z)"],
          ["email:desc", "E-posta (Z–A)"],
          ["position:asc", "Pozisyon (A–Z)"],
          ["position:desc", "Pozisyon (Z–A)"],
          ["card:asc", "Kart no (artan)"],
          ["card:desc", "Kart no (azalan)"],
          ["status:asc", "Durum (artan)"],
          ["status:desc", "Durum (azalan)"],
        ].map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </FilterBar>
  );
}
