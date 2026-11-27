// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import type { Doc, Id } from "./_generated/dataModel";
import { api } from "./_generated/api";
import schema from "./schema";
import { annualOvertimeDayEntries } from "./dashboard";
import { DEFAULT_FLEXIBLE } from "./lib/pdksFlexible";
import { computePdksTableRow } from "./lib/pdksTable";
import { DEFAULT_OVERTIME_RATES, DEFAULT_WORK_SETTINGS } from "./lib/pdksHelpers";
import { LEGACY_PDKS_POLICY, type PdksDayPolicy } from "./lib/pdksRules";
import type { DayPlan, ShiftResolver } from "./lib/shiftResolver";

const date = "2026-06-22";
const employee: Doc<"employees"> = { _id: "employee" as Id<"employees">, _creationTime: 0, firstName: "Ada", lastName: "Test", email: "ada@test", cardNumber: "1", isActive: true };
const shift: Doc<"shifts"> = { _id: "shift" as Id<"shifts">, _creationTime: 0, name: "Gündüz", startTime: "08:00", endTime: "17:00", breakStart: "12:00", breakEnd: "13:00", createdAt: "", updatedAt: "" };
function readings(times: string[]): Doc<"cardReadings">[] {
  return times.map((time, index) => ({ _id: String(index) as Id<"cardReadings">, _creationTime: 0, employeeId: employee._id, cardNo: "1", accessStatus: "izin_verildi", accessTime: new Date(`${date}T${time}:00+03:00`).toISOString(), direction: index % 2 ? "exit" : "entry" }));
}
function compareTable(times: string[], shifts = [shift], policy: PdksDayPolicy = LEGACY_PDKS_POLICY) {
  const plan: DayPlan = { kind: "shifts", source: "employee", calendar: "plan", origin: "weekly", shifts };
  const resolver: ShiftResolver = { resolve: () => shifts[0] ?? null, resolveLast: () => shifts[shifts.length - 1] ?? null, resolvePlan: () => plan, shifts: new Map(shifts.map(s => [s._id, s])) };
  const raw = readings(times);
  const row = computePdksTableRow({ employee, empKey: employee._id, empReadings: raw, availableDateKeys: new Set([date]), departmentName: "", periodDateKeys: [date], startDate: date, isSingleDay: true, viewMode: "matrix", manualPdksByEmpDate: new Map(), allLeaves: [], holidayMap: new Map(), workSettings: DEFAULT_WORK_SETTINGS, overtimeRates: DEFAULT_OVERTIME_RATES, resolveShift: resolver.resolve, resolveLast: resolver.resolveLast, resolvePlan: resolver.resolvePlan, policyFor: () => policy, manualEditedBy: null });
  const entries = annualOvertimeDayEntries({ employeeId: employee._id, readings: raw, shiftResolver: resolver, workSettings: DEFAULT_WORK_SETTINGS, policyFor: () => policy, startDate: date, endDate: date });
  expect(entries[0]?.netMinutes).toBe(row.days[0]?.totalMinutes);
  return { entries, resolver, raw };
}

it("annual dashboard and table keep all 270 minutes after the planned break", () => {
  expect(compareTable(["13:00", "17:30"]).entries[0]?.netMinutes).toBe(270);
});
it("annual dashboard and table deduct the intersecting 12–13 break from 08–17", () => {
  expect(compareTable(["08:00", "17:00"]).entries[0]?.netMinutes).toBe(480);
});
it("annual dashboard follows each-punch policy rather than first/last endpoints", () => {
  expect(compareTable(["08:00", "10:00", "14:00", "17:00"], [shift], { ...LEGACY_PDKS_POLICY, calculationMode: "eachPunch" }).entries[0]?.netMinutes).toBe(300);
});
it("annual dashboard splits multiple shifts with the table engine", () => {
  const pieces = [{ ...shift, endTime: "12:00", breakStart: undefined, breakEnd: undefined }, { ...shift, _id: "second" as Id<"shifts">, startTime: "14:00", endTime: "18:00", breakStart: undefined, breakEnd: undefined }];
  expect(compareTable(["08:00", "12:00", "14:00", "18:00"], pieces).entries[0]?.netMinutes).toBe(450);
});
it("annual dashboard uses flexible net duration rather than the fixed break window", () => {
  const flexible = { ...shift, scheduleType: "flexible" as const, startTime: "05:00", endTime: "22:00", flexible: { ...DEFAULT_FLEXIBLE } };
  expect(compareTable(["12:00", "21:00"], [flexible]).entries[0]?.netMinutes).toBe(480);
});
it("annual dashboard respects a required exit instead of measuring two entries", () => {
  const { resolver, raw } = compareTable(["08:00", "17:00"]);
  const entries = annualOvertimeDayEntries({ employeeId: employee._id, readings: raw.map(reading => ({ ...reading, direction: "entry" })), shiftResolver: resolver, workSettings: DEFAULT_WORK_SETTINGS, policyFor: () => ({ ...LEGACY_PDKS_POLICY, punchMode: "requirements", requireCheckIn: true, requireCheckOut: true, missingRequiredPunch: "review" }), startDate: date, endDate: date });
  expect(entries[0]?.netMinutes).toBe(0);
});
it("managed table dates are excluded from weekly fallback to prevent double counting", () => {
  const { resolver, raw } = compareTable(["08:00", "17:00"]);
  expect(annualOvertimeDayEntries({ employeeId: employee._id, readings: raw, shiftResolver: resolver, workSettings: DEFAULT_WORK_SETTINGS, policyFor: () => LEGACY_PDKS_POLICY, startDate: date, endDate: date, managedDates: new Set([date]) })).toEqual([]);
});

it.each([{ start: "13:00", end: "17:30", expected: 270 }, { start: "08:00", end: "17:00", expected: 480 }])("annual query uses $expected net minutes on a rest day", async ({ start, end, expected }) => {
  const t = convexTest(schema, import.meta.glob("./**/*.ts"));
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "Annual" });
    const userId = await ctx.db.insert("users", { role: "super_admin", verified: true });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 86400000 });
    const shiftId = await ctx.db.insert("shifts", { projectId, name: "Gündüz", startTime: "08:00", endTime: "17:00", breakStart: "12:00", breakEnd: "13:00", createdAt: "", updatedAt: "" });
    const employeeId = await ctx.db.insert("employees", { projectId, shiftId, firstName: "Ada", lastName: "Test", email: "annual@test", cardNumber: "1", isActive: true });
    await ctx.db.insert("shiftAssignments", { projectId, employeeId, shiftId, startDate: "2026-01-01", endDate: "2026-12-31", weekPattern: ["MON", "TUE", "WED", "THU", "FRI"], createdAt: "", updatedAt: "" });
    for (const [time, direction] of [[start, "entry"], [end, "exit"]] as const) await ctx.db.insert("cardReadings", { projectId, employeeId, cardNo: "1", accessStatus: "izin_verildi", accessTime: new Date(`2026-06-28T${time}:00+03:00`).toISOString(), direction });
    return { projectId, employeeId, userId, sessionId };
  });
  const result = await t.withIdentity({ subject: `${ids.userId}|${ids.sessionId}` }).action(api.dashboard.getAnnualOvertimeBalance, { projectId: ids.projectId, year: 2026 });
  expect(result).toHaveLength(1);
  expect(result[0]).toMatchObject({ employeeId: ids.employeeId, totalOvertimeMinutes: expected });
});
