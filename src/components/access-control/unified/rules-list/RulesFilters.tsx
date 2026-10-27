import { FilterBar } from "@/components/shared/FilterBar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { readRuleFilters } from "./accessRulesListModel";
export function RulesFilters({
  search,
  searchBy,
  status,
  type,
  change,
  clear,
}: ReturnType<typeof readRuleFilters> & {
  change: (key: string, value: string) => void;
  clear: () => void;
}) {
  return (
    <FilterBar
      search={search}
      onSearchChange={(value) => change("q", value)}
      placeholder={
        searchBy === "person"
          ? "Kişi adı ara"
          : searchBy === "door"
            ? "Kapı adı ara"
            : "Kural adı ara"
      }
      hasFilters={status !== "all" || type !== "all" || searchBy !== "rule"}
      onClear={clear}
    >
      {[
        {
          key: "by",
          label: "Arama alanı",
          value: searchBy,
          options: [
            ["rule", "Kural"],
            ["person", "Kişi"],
            ["door", "Kapı"],
          ],
        },
        {
          key: "durum",
          label: "Durum",
          value: status,
          options: [
            ["all", "Tüm durumlar"],
            ["active", "Aktif"],
            ["inactive", "Pasif"],
          ],
        },
        {
          key: "tur",
          label: "Tür",
          value: type,
          options: [
            ["all", "Tüm türler"],
            ["personnel", "Personel yetkisi"],
            ["visitor", "Ziyaretçi şablonu"],
          ],
        },
      ].map((filter) => (
        <Select
          key={filter.key}
          value={filter.value}
          onValueChange={(value) => change(filter.key, value)}
        >
          <SelectTrigger
            aria-label={filter.label}
            className="w-auto min-w-36 max-w-full max-md:min-h-11"
          >
            <span>
              {filter.key === "by" && "Ara: "}
              <SelectValue />
            </span>
          </SelectTrigger>
          <SelectContent>
            {filter.options.map(([value, label]) => (
              <SelectItem key={value} value={value} className="max-md:min-h-11">
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ))}
    </FilterBar>
  );
}
