import { describe, expect, it } from "vitest";
import type { PdksCell, PdksRow } from "@/components/pdks/lib/presentation";
import type { FilterValues } from "@/components/pdks/dashboard/PDKSFilterBar";
import type { Id } from "../../../../convex/_generated/dataModel";
import type { SmartPresetSelection } from "@/components/pdks/dashboard/PDKSSmartPresets";
import { derivePdksRecordsView } from "./recordsView";

const filters: FilterValues = {
  dateRange: { from: undefined, to: undefined },
  reportType: "daily", statusFilter: "all", person: "",
};
const rows: PdksRow[] = ["ada", "efe"].map(id => ({
  id, name: id, status: "future", firstEntry: "", overtimeHours: 0, days: [],
  excludedUnknownReadings: 0, employeeId: id, cardNumber: "", payrollCode: "",
  payrollEmployeeCode: "", department: "", lastExit: "", totalHours: "",
  totalMinutes: 0, overtimeMinutes: 0, overtime: "", overtimeMultiplier: 1,
  overtimePayTRY: null, hourlyRate: null, yearlyOvertimeLimit: 270,
  leaveType: "", isLate: false, isEarlyExit: false, isManual: false,
  manualNote: null, manualEditedBy: null, detailedLogs: [],
}));
const input: Parameters<typeof derivePdksRecordsView>[0] = {
  projectId: undefined, filters, smartPreset: null,
  selection: { scope: "", ids: new Set() }, drilldown: null,
  rawRecords: rows, rawAllRecords: rows,
  selectedDate: new Date("2026-10-22T12:00:00"), todayKey: "2026-10-22",
  departments: [], companies: [], positions: [], shifts: [],
};

describe("PDKS kayıt görünümü hesapları", () => {
  it("aynı kapsamda yalnız görünen seçimler dışa aktarılır; kapsam değişince seçim boşalır", () => {
    const { scope } = derivePdksRecordsView(input);
    const selected = { ...input, selection: { scope, ids: new Set(["ada", "removed"]) } };
    const view = derivePdksRecordsView(selected);
    expect([...view.selectedIds]).toEqual(["ada"]);
    expect(view.exportRows.map(row => row.id)).toEqual(["ada"]);
    const changed = derivePdksRecordsView({ ...selected, filters: { ...filters, person: "efe" } });
    expect(changed.selectedIds.size).toBe(0);
    expect(changed.exportRows).toEqual(rows);
  });

  it("başka güne ait akıllı uyarı filtresi uygulanmaz", () => {
    const smartPreset: SmartPresetSelection = { key: "repeat-late", label: "Geç", employeeIds: ["ada" as Id<"employees">], date: "2026-10-21" };
    expect(derivePdksRecordsView({ ...input, smartPreset }).records).toEqual(rows);
    const view = derivePdksRecordsView({ ...input, smartPreset: { ...smartPreset, date: "2026-10-22" } });
    expect(view.records.map(row => row.id)).toEqual(["ada"]);
    expect(view.hasFilters).toBe(true);
    expect(view.filterSummary).toBe("Geç");
  });

  it.each([true, false])("devam edenler future sayacından düşülür (gün hücreleri: %s)", matrix => {
    const cells = ["08:00", null].map(firstEntry => ({
      date: "2026-10-22", status: "future", firstEntry, overtimeMinutes: 0,
    })) as PdksCell[];
    const records = matrix
      ? [{ ...rows[0], days: cells }] as PdksRow[]
      : cells.map((cell, i) => ({ ...rows[i], firstEntry: cell.firstEntry ?? "" })) as PdksRow[];
    const view = derivePdksRecordsView({ ...input, rawRecords: records, rawAllRecords: records });
    expect(view.inProgress).toBe(1);
    expect(view.counters.find(counter => counter.status === "future")?.value).toBe(1);
  });
});
