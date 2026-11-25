import { expect, it, vi } from "vitest";
import type { QueryCtx } from "./_generated/server";

const data = vi.hoisted(() => ({ cardNumber: "" }));
vi.mock("./lib/customFunctions", () => ({ authedQuery: (definition: unknown) => definition, authedMutation: (definition: unknown) => definition }));
vi.mock("./lib/reportScope", () => ({ reportPeriod: vi.fn(), resolveReportScope: async () => ({ projectIds: ["project-a"], scopeLabel: "Test" }) }));
vi.mock("./lib/legacyOvertime", () => ({ loadPayrollReportReadings: async () => [], loadPayrollReport: async () => new Map(), legacyAttendanceDays: () => new Map() }));
vi.mock("./lib/reportAttendance", () => ({
  loadRuleReportDays: async () => ({
    employees: [{ _id: "visitor-a", projectId: "project-a", cardNumber: data.cardNumber, isVisitor: true }],
    readings: [{ projectId: "project-a", cardNo: data.cardNumber, employeeName: "Unidentified", accessTime: "2026-06-01T09:00:00+03:00", accessStatus: "izin_verildi" }],
    planResolvers: new Map(), reportEmployees: new Map(), legacyManualRecords: new Map(), ruleRows: new Map(),
    managesReading: () => false, workDate: () => "2026-06-01",
  }),
}));
import { getSgkMonthlyReport } from "./reports";

// Isolate the visitor-skip map: upstream report loading already filters most
// unidentified events, so seed an eligible reading at that boundary explicitly.
it.each(["", "   ", "00123"])("SGK visitor exclusion requires a nonblank card (%j)", async cardNumber => {
  data.cardNumber = cardNumber;
  const ctx = { db: { query: () => ({ withIndex: () => ({ collect: async () => [] }) }) } } as unknown as QueryCtx;
  const run = (getSgkMonthlyReport as unknown as { handler: (ctx: QueryCtx, args: { year: number; month: number }) => Promise<{ rows: unknown[] }> }).handler;
  const report = await run(ctx, { year: 2026, month: 6 });
  expect(report.rows).toHaveLength(cardNumber.trim() ? 0 : 1);
});
