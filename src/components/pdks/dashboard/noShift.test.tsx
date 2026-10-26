import { isValidElement } from "react";
import { NoShiftStatus } from "./PdksRowStatus";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import type { PdksRow } from "../lib/presentation";
import { filterPdksRows, periodTotals } from "../lib/presentation";
import { PDKSTableView } from "./PDKSTableView";
import { PDKSHeatmapView } from "./PDKSHeatmapView";

const mocks = vi.hoisted(() => ({ allowed: true, params: new URLSearchParams("project=abc&status=late") }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ can: (permission: string) => permission === "schedule.manage" && mocks.allowed }) }));
vi.mock("react-router-dom", async importOriginal => ({ ...await importOriginal<typeof import("react-router-dom")>(),
  useSearchParams: () => [mocks.params, (update: (previous: URLSearchParams) => URLSearchParams) => { mocks.params = update(mocks.params); }],
}));
beforeEach(() => { mocks.allowed = true; mocks.params = new URLSearchParams("project=abc&status=late"); });
const row: PdksRow = {
  id: "e", employeeId: "e", name: "Plansız Kişi", department: "Üretim", cardNumber: "1", noShift: true,
  excludedUnknownReadings: 0, payrollCode: "—", payrollEmployeeCode: "", firstEntry: "-", lastExit: "-",
  totalHours: "—", totalMinutes: 0, overtimeMinutes: 0, overtime: "—", overtimeHours: 0, overtimeMultiplier: 0,
  overtimePayTRY: null, hourlyRate: null, yearlyOvertimeLimit: 270, leaveType: "", status: "noData",
  isLate: false, isEarlyExit: false, isManual: false, manualNote: null, manualEditedBy: null, detailedLogs: [],
  days: [{ date: "2026-06-14", noShift: true, firstEntry: null, lastExit: null, totalMinutes: 0,
    overtimeMinutes: 0, status: "noData", leaveType: null, isLate: false, lateMinutes: 0, payrollCode: "—" }],
};

it("keeps unassigned employees gray with an assignment shortcut and blank numeric cells", () => {
  for (const html of [renderToStaticMarkup(<PDKSTableView records={[row]} />), renderToStaticMarkup(<PDKSHeatmapView loading={false} records={[row]} startDate="2026-06-14" endDate="2026-06-14" />)]) {
    expect(html).toContain("Plansız Kişi");
    expect(html).toContain("bg-muted text-muted-foreground");
    expect(html).toContain("Vardiya atanmamış");
    expect(html).toContain('<button type="button" class="underline">Vardiya ata</button>');
    expect(html).not.toContain('href="?plan=1"');
    expect(html).toContain("Vardiya ata");
    expect(html).not.toContain("00 sa 00 dk");
    expect(html).not.toContain("Süre hesaplanamadı");
  }
});

it("partial periods label unassigned cells and exclude them from filters and totals", () => {
  const partial: PdksRow = { ...row, noShift: undefined, days: [...row.days, { ...row.days[0], date: "2026-06-15", noShift: undefined, status: "present", totalMinutes: 480 }] };
  const html = renderToStaticMarkup(<PDKSHeatmapView loading={false} records={[partial]} startDate="2026-06-14" endDate="2026-06-15" />);
  expect(html).toContain("Vardiya yok");
  expect(html).toContain("08 sa 00 dk");
  expect(periodTotals(partial.days).totalMinutes).toBe(480);
  expect(filterPdksRows([row, partial], "noData")).toEqual([]);
  expect(filterPdksRows([row, partial], "absent")).toEqual([]);
  expect(filterPdksRows([row, partial], "present")).toEqual([partial]);
});

it("assignment button keeps search parameters and only appears with schedule.manage", () => {
  const element = NoShiftStatus();
  const button: unknown = element.props.children[1];
  if (!isValidElement<{ onClick: (event: { stopPropagation: () => void }) => void }>(button)) throw new Error("Assignment button missing");
  const stopPropagation = vi.fn();
  button.props.onClick({ stopPropagation });
  expect(stopPropagation).toHaveBeenCalledOnce();
  expect(mocks.params.toString()).toBe("project=abc&status=late&plan=1");
  mocks.allowed = false;
  const html = renderToStaticMarkup(<NoShiftStatus />);
  expect(html).toContain("Vardiya atanmamış");
  expect(html).not.toContain("Vardiya ata</button>");
});
