// @vitest-environment edge-runtime
import { DEFAULT_OVERTIME_RATES } from "./lib/pdksHelpers";
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import schema from "./schema";
import { internal } from "./_generated/api";
import { loadAnnualOvertime } from "../src/lib/pdksAnnual";

it.each([false, true])("Sunday→Monday night, rule-managed=%s, splitAtMidnight: cached batches equal the complete original-year calculation", async managed => {
  const t = convexTest(schema, import.meta.glob("./**/*.ts"));
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "Night annual" });
    const userId = await ctx.db.insert("users", { role: "super_admin", verified: true });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 86400000 });
    const shiftId = await ctx.db.insert("shifts", { projectId, name: "Night", startTime: "22:00", endTime: "06:00", createdAt: "", updatedAt: "" });
    const employeeId = await ctx.db.insert("employees", { projectId, shiftId, firstName: "Ada", lastName: "Night", email: "night@test", cardNumber: "1", isActive: true });
    await ctx.db.insert("shiftAssignments", { projectId, employeeId, shiftId, weekPattern: ["MON", "TUE", "WED", "THU", "FRI"], startDate: "2026-01-01", endDate: "2026-12-31", createdAt: "", updatedAt: "" });
    if (managed) await ctx.db.insert("pdksRuleVersions", { projectId, effectiveFrom: "2026-01-01", calculationMode: "eachPunch", punchMode: "requirements", checkpointMode: "all", requireCheckIn: true, requireCheckOut: true, missingRequiredPunch: "review", noPunch: "absent", createdAt: "", createdBy: userId });
    await ctx.db.insert("overtimeRates", { ...DEFAULT_OVERTIME_RATES, projectId, overtimeBasis: "weekly45", nightShiftDayMode: "splitAtMidnight", updatedAt: "" });
    for (const [accessTime, direction] of [["2026-06-28T19:00:00Z", "entry"], ["2026-06-29T03:00:00Z", "exit"], ["2026-06-29T19:00:00Z", "entry"], ["2026-06-30T03:00:00Z", "exit"]] as const) await ctx.db.insert("cardReadings", { projectId, employeeId, cardNo: "1", accessTime, direction, accessStatus: "izin_verildi" });
    return { projectId, userId, sessionId };
  });
  const user = t.withIdentity({ subject: `${ids.userId}|${ids.sessionId}` });
  const reference = await user.query(internal.dashboard.annualOvertimePart, { projectId: ids.projectId, year: 2026, startDate: "2026-01-01", endDate: "2026-12-31" });
  const actual = await loadAnnualOvertime(user, { projectId: ids.projectId, year: 2026 });
  expect(actual).toEqual(reference);
  expect(actual).toHaveLength(1);
  expect(actual[0]?.totalOvertimeMinutes).toBeGreaterThan(0);
}, 30_000);
