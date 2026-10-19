import { useState } from "react";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { RowActions } from "@/components/shared/RowActions";
import {
  compareRows,
  displayTime,
  displayDuration,
  type PdksRow,
  type SortKey,
} from "../lib/presentation";
import { PdksRowStatus } from "./PdksRowStatus";
import { PDKSMobileCardList } from "./PDKSMobileCardList";
interface Props {
  records: PdksRow[];
  loading?: boolean;
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
  onShowDetail?: (employeeId: Id<"employees">) => void;
}
const columns: { key: SortKey; label: string }[] = [
  { key: "name", label: "Çalışan" },
  { key: "department", label: "Departman" },
  { key: "firstEntry", label: "İlk giriş" },
  { key: "lastExit", label: "Son çıkış" },
  { key: "totalMinutes", label: "Toplam süre" },
  { key: "overtimeMinutes", label: "Fazla mesai" },
  { key: "status", label: "Durum / izin türü" },
];
export function PDKSTableView({
  records,
  loading,
  selectedIds = new Set(),
  onSelectionChange,
  onShowDetail,
}: Props) {
  const [sort, setSort] = useState<{ key: SortKey; direction: "asc" | "desc" }>(
    { key: "name", direction: "asc" },
  );
  const rows = [...records].sort((a, b) =>
    compareRows(a, b, sort.key, sort.direction),
  );
  const toggle = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange?.(next);
  };
  if (loading)
    return (
      <div role="status" className="py-10">
        PDKS kayıtları yükleniyor.
      </div>
    );
  return (
    <>
      <div className="md:hidden">
        <PDKSMobileCardList
          records={rows}
          selectedIds={selectedIds}
          onToggleSelect={toggle}
          onShowDetail={onShowDetail}
        />
      </div>
      <div className="hidden md:block">
        <table className="w-full table-fixed border-collapse text-xs">
          <caption className="sr-only">
            Günlük PDKS kayıtları. Saatler İstanbul saatidir. Toplam süreden mola düşülmüştür.
          </caption>
          <thead className="sticky top-0 bg-muted">
            <tr className="h-9 border-b">
              <th className="w-9 px-2">
                <Checkbox
                  aria-label="Görünen tüm çalışanları seç"
                  checked={
                    rows.length > 0 && rows.every((r) => selectedIds.has(r.id))
                  }
                  onCheckedChange={(checked) =>
                    onSelectionChange?.(
                      checked ? new Set(rows.map((r) => r.id)) : new Set(),
                    )
                  }
                />
              </th>
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={`px-2 text-left font-medium ${c.key === "name" ? "w-[21%]" : c.key === "status" ? "w-[20%]" : ""}`}
                  aria-sort={
                    sort.key === c.key
                      ? sort.direction === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                >
                  <button
                    className="min-h-9 text-left"
                    onClick={() =>
                      setSort({
                        key: c.key,
                        direction:
                          sort.key === c.key && sort.direction === "asc"
                            ? "desc"
                            : "asc",
                      })
                    }
                  >
                    {c.label}
                    {sort.key === c.key &&
                      (sort.direction === "asc" ? " ↑" : " ↓")}
                  </button>
                </th>
              ))}
              <th className="w-11">
                <span className="sr-only">İşlemler</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                className={`h-[42px] border-b hover:bg-muted/50 ${selectedIds.has(r.id) ? "bg-selected" : ""}`}
              >
                <td className="px-2">
                  <Checkbox
                    checked={selectedIds.has(r.id)}
                    aria-label={`${r.name} seç`}
                    onCheckedChange={() => toggle(r.id)}
                  />
                </td>
                <td className="px-2 py-1">
                  <button
                    className="text-left font-medium break-words hover:underline"
                    onClick={() => onShowDetail?.(r.id as Id<"employees">)}
                  >
                    {r.name}
                  </button>
                </td>
                <td className="break-words px-2">{r.department || "—"}</td>
                <td className="px-2 tabular-nums">
                  {displayTime(r.firstEntry)}
                </td>
                <td className="px-2 tabular-nums">{displayTime(r.lastExit)}</td>
                <td className="px-2 tabular-nums">
                  {displayDuration(r.totalMinutes, r.status)}
                  {(r.nightMinutes ?? 0) > 0 && <span className="block text-muted-foreground">Gece: {displayDuration(r.nightMinutes ?? 0, r.status)}</span>}
                </td>
                <td className="px-2 tabular-nums">
                  {displayDuration(r.overtimeMinutes, r.status)}
                </td>
                <td className="px-2 py-1">
                  <PdksRowStatus record={r} />
                </td>
                <td>
                  <RowActions label={`${r.name} işlemleri`}>
                    <DropdownMenuItem
                      onClick={() => onShowDetail?.(r.id as Id<"employees">)}
                    >
                      Gün detayını aç
                    </DropdownMenuItem>
                  </RowActions>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
