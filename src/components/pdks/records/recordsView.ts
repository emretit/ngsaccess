import type { Id } from "../../../../convex/_generated/dataModel";
import type { FilterValues } from "@/components/pdks/dashboard/PDKSFilterBar";
import type { SmartPresetSelection } from "@/components/pdks/dashboard/PDKSSmartPresets";
import type { usePdksFilterOptions } from "@/hooks/usePdksFilterOptions";
import type { usePdksTableData } from "@/hooks/usePdksTableData";
import { toLocalDateString } from "@/lib/date";
import { summarizePdksRecords } from "@/lib/pdksSummary";
import { STATUS_FILTER_LABELS, isPdksInProgress } from "@/components/pdks/statusMeta";
export type RecordsSelection = { scope: string; ids: Set<string> };
export type RecordsDrilldown = { scope: string; employeeId: Id<"employees">; date: string } | null;
type RecordsViewInput = ReturnType<typeof usePdksFilterOptions> & {
  projectId: Id<"projects"> | undefined;
  filters: FilterValues;
  smartPreset: SmartPresetSelection | null;
  selection: RecordsSelection;
  drilldown: RecordsDrilldown;
  rawRecords: ReturnType<typeof usePdksTableData>["tableRecords"];
  rawAllRecords: ReturnType<typeof usePdksTableData>["allRecords"];
  selectedDate: Date;
  todayKey: string;
};
export function derivePdksRecordsView({ projectId, filters, smartPreset, selection, drilldown, rawRecords, rawAllRecords, selectedDate, todayKey, departments, companies, positions, shifts }: RecordsViewInput) {
  const selectedDateKey = toLocalDateString(selectedDate);
  const effectiveSmartPreset =
    smartPreset?.date && smartPreset.date !== selectedDateKey
      ? null
      : smartPreset;
  const matchesSmartPreset = (id: string) =>
    !effectiveSmartPreset ||
    effectiveSmartPreset.employeeIds.some((employeeId) => employeeId === id);
  const records = rawRecords.filter((record) => matchesSmartPreset(record.id));
  const allRecords = rawAllRecords.filter((record) =>
    matchesSmartPreset(record.id),
  );
  const scope = `${projectId}:${JSON.stringify(filters)}:${effectiveSmartPreset?.key ?? ""}`;
  const selectedIds =
    selection.scope === scope
      ? new Set(
          [...selection.ids].filter((id) =>
            records.some((record) => record.id === id),
          ),
        )
      : new Set<string>();
  const detail = drilldown?.scope === scope ? drilldown : null;
  const summary = summarizePdksRecords(allRecords.filter(row => !row.noShift), todayKey);
  const exportRows = records.filter(row => !row.noShift && (!selectedIds.size || selectedIds.has(row.id)))
    .map(row => ({ ...row, days: row.days.filter(day => !day.noShift) }));
  const hasFilters = Boolean(
    filters.person || filters.employeeId ||
    filters.companyId ||
    filters.departmentId ||
    filters.positionId ||
    filters.shiftId ||
    filters.statusFilter !== "all" ||
    effectiveSmartPreset,
  );
  const filterSummary =
    [
      effectiveSmartPreset?.label,
      filters.person && `Ad / soyad: ${filters.person}`,
      filters.employeeId && `Kişi: ${rawAllRecords.find(row => row.id === filters.employeeId)?.name ?? "Seçili personel"}`,
      filters.departmentId &&
        `Departman: ${departments?.find((d) => d._id === filters.departmentId)?.name ?? "Seçili"}`,
      filters.companyId &&
        `Şirket: ${companies?.find((c) => c._id === filters.companyId)?.name ?? "Seçili"}`,
      filters.positionId &&
        `Pozisyon: ${positions?.find((p) => p._id === filters.positionId)?.name ?? "Seçili"}`,
      filters.shiftId &&
        `Vardiya: ${shifts?.find((s) => s._id === filters.shiftId)?.name ?? "Seçili"}`,
      filters.statusFilter !== "all" &&
        STATUS_FILTER_LABELS[filters.statusFilter],
    ]
      .filter(Boolean)
      .join(" · ") || "Tüm personel";
  const passive = (status: "weekend" | "holiday" | "noData" | "future") => allRecords.reduce((sum, row) => sum + (row.days.length ? row.days.filter(d => !d.noShift && d.status === status).length : Number(!row.noShift && row.status === status)), 0);
  const inProgress = allRecords.reduce((sum, row) => sum + (row.days.length ? row.days.filter(isPdksInProgress).length : Number(isPdksInProgress(row))), 0);
  const counters = [
    { status: "present", value: summary.present },
    { status: "late", value: summary.late },
    { status: "absent", value: summary.absent },
    { status: "leave", value: summary.leave },
    { status: "weekend", value: passive("weekend") },
    { status: "holiday", value: passive("holiday") },
    { status: "noData", value: passive("noData") },
    { status: "future", value: passive("future") - inProgress },
  ] as const;
  return { selectedDateKey, effectiveSmartPreset, records, allRecords, scope, selectedIds, detail, summary, exportRows, hasFilters, filterSummary, inProgress, counters };
}
