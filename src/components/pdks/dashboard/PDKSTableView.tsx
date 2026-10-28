import type { ReactNode } from "react";
import { TableStateRow } from "@/components/shared/TableStateRow";
import { EmptyState } from "@/components/shared/EmptyState";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { useListSelection } from "@/hooks/useListSelection";
import { ListSelectAll } from "@/components/shared/ListSelectAll";
import { ResponsiveResults } from "@/components/shared/ResponsiveResults";
import { PdksPlanSummary } from "./PdksPlanSummary";
import { singleRowDay } from "../lib/presentation";
import { PdksFlexibleTarget } from "./PdksFlexibleTarget";
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
import { onRowActivate, ROW_CLICK_CLASS } from "@/lib/tableRowClick";
/** Dar sütunda uzun "Süre hesaplanamadı" yan sütuna taşar; nedeni Durum sütununda yazdığı için kısa gösterilir. */
function DurationCell({
  minutes,
  status,
  measured,
}: {
  minutes: number;
  status: PdksRow["status"];
  measured?: boolean;
}) {
  if (measured === false)
    return (
      <span title="Süre hesaplanamadı">
        —<span className="sr-only">Süre hesaplanamadı</span>
      </span>
    );
  return <>{displayDuration(minutes, status)}</>;
}
interface Props {
  records: PdksRow[];
  loading?: boolean;
  emptyState?: ReactNode;
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
  emptyState,
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
  const { toggle, selectAll, checked } = useListSelection({
    visibleIds: rows.map((row) => row.id),
    selected: selectedIds,
    onChange: (next) => onSelectionChange?.(next),
  });
  return (
    <ResponsiveResults
      label="Günlük PDKS kayıtları"
      mobile={
        loading ? (
          <SectionSkeleton rows={6} label="PDKS kayıtları yükleniyor." />
        ) : rows.length === 0 ? (
          (emptyState ?? <EmptyState title="Bu projede personel bulunamadı." />)
        ) : (
          <PDKSMobileCardList
            records={rows}
            selectedIds={selectedIds}
            onToggleSelect={toggle}
            onShowDetail={onShowDetail}
          />
        )
      }
      desktop={
        <table className="w-full table-fixed border-collapse text-xs">
          <caption className="sr-only">
            Günlük PDKS kayıtları. Saatler İstanbul saatidir. Toplam süreden
            mola düşülmüştür.
          </caption>
          <thead className="sticky top-0 bg-muted">
            <tr className="h-9 border-b">
              <th className="w-9 px-2">
                <ListSelectAll
                  label="Görünen tüm çalışanları seç"
                  checked={checked}
                  onChange={selectAll}
                  disabled={loading || records.length === 0}
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
            {loading ? (
              <TableStateRow
                colSpan={columns.length + 2}
                state="loading"
                label="PDKS kayıtları yükleniyor."
              />
            ) : rows.length === 0 ? (
              <TableStateRow colSpan={columns.length + 2} state="custom">
                {emptyState ?? (
                  <EmptyState title="Bu projede personel bulunamadı." />
                )}
              </TableStateRow>
            ) : (
              rows.map((r) => (
                <tr
                  key={r.id}
                  className={`h-[42px] ${r.noShift ? "bg-muted text-muted-foreground hover:bg-muted" : "hover:bg-muted/50"} border-b ${onShowDetail ? ROW_CLICK_CLASS : ""} ${selectedIds.has(r.id) ? "bg-selected" : ""}`}
                  onClick={
                    onShowDetail
                      ? onRowActivate(() =>
                          onShowDetail(r.id as Id<"employees">),
                        )
                      : undefined
                  }
                >
                  <td className="px-2" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds.has(r.id)}
                      aria-label={`${r.name} seç`}
                      onCheckedChange={() => toggle(r.id)}
                    />
                  </td>
                  <td className="px-2 py-1">
                    <button
                      className="text-left font-medium break-words"
                      onClick={() => onShowDetail?.(r.id as Id<"employees">)}
                    >
                      {r.name}
                    </button>
                    <PdksPlanSummary day={singleRowDay(r)} />
                  </td>
                  <td className="break-words px-2">{r.department || "—"}</td>
                  <td className="px-2 tabular-nums">
                    {displayTime(r.firstEntry)}
                  </td>
                  <td className="px-2 tabular-nums">
                    {displayTime(r.lastExit)}
                  </td>
                  <td className="px-2 tabular-nums">
                    {r.noShift ? (
                      "—"
                    ) : (
                      <DurationCell
                        minutes={r.totalMinutes}
                        status={r.status}
                        measured={r.durationMeasured}
                      />
                    )}
                    {!r.noShift && <PdksFlexibleTarget day={r} />}
                    {(r.nightMinutes ?? 0) > 0 && (
                      <span className="block text-muted-foreground">
                        Gece: {displayDuration(r.nightMinutes ?? 0, r.status)}
                      </span>
                    )}
                  </td>
                  <td className="px-2 tabular-nums">
                    {r.noShift ? (
                      "—"
                    ) : (
                      <DurationCell
                        minutes={r.overtimeMinutes}
                        status={r.status}
                        measured={r.durationMeasured}
                      />
                    )}
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
              ))
            )}
          </tbody>
        </table>
      }
    />
  );
}
