// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { QueryCtx } from "./_generated/server";
import schema from "./schema";
import { getPdksTableData } from "./cardReadings";
import { getSgkMonthlyReport, getOvertimeSummaryReport, getDepartmentCostReport, getAttendanceSummaryReport } from "./reports";
import { getActivitySummary, getAnnualOvertimeBalance } from "./dashboard";
import { buildAphbForMonth } from "./sgkExport";
import { DEFAULT_FLEXIBLE } from "./lib/pdksFlexible";
const modules = import.meta.glob("./**/*.ts");
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-23T17:00:00.000Z")); });
afterEach(() => vi.useRealTimers());

// The snapshots were captured by running this same real-convex-test fixture against
// 2b67349, before W5-A. No query/auth implementation is mocked. Only the new policy
// metadata queries and additive DTO fields are excluded from the legacy comparison.
// Faz 3A intentionally updates the report/SGK snapshots: bounded manual reads,
// accurate reliability text and explicitly marked APHB draft with overtime.
// Other query outputs and cross-project isolation remain strict.
it("D1: sürüm yokken tablo, dört rapor, dashboard, yıllık mesai ve SGK aynı indeks/aralık/sonuç kümesini kullanır", async () => {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "Legacy" });
    const userId = await ctx.db.insert("users", { role: "project_admin" });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 86400000 });
    await ctx.db.insert("userProjects", { userId, projectId });
    const shiftId = await ctx.db.insert("shifts", { projectId, name: "Gündüz", startTime: "08:00", endTime: "17:00", createdAt: "", updatedAt: "" });
    const employeeId = await ctx.db.insert("employees", { projectId, firstName: "Ada", lastName: "Test", email: "ada@test", cardNumber: "123", isActive: true, shiftId });
    for (const [accessTime, direction] of [["2026-10-23T05:00:00.000Z", "entry"], ["2026-10-23T14:00:00.000Z", "exit"], ["2026-09-30T05:00:00.000Z", "entry"], ["2026-11-01T05:00:00.000Z", "entry"]] as const) {
      await ctx.db.insert("cardReadings", { projectId, employeeId, cardNo: "123", accessStatus: "izin_verildi", direction, accessTime });
    }
    return { projectId, userId, sessionId, shiftId, employeeId };
  });
  const caller = t.withIdentity({ subject: `${ids.userId}|${ids.sessionId}` });
  const omit = new Set(["incompleteDays", "durationMeasured", "punchQuality", "blockedByReview"]);
  function stable(value: unknown): unknown {
    if (typeof value === "string") {
      for (const [key, id] of Object.entries(ids)) value = String(value).split(id).join(key);
      return value;
    }
    if (Array.isArray(value)) return value.map(stable);
    if (value !== null && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([key]) => !omit.has(key)).map(([key, entry]) => [key, stable(entry)]));
    return value;
  }
  const cases = [
    ["table", getPdksTableData, { projectId: ids.projectId, startDate: "2026-10-23", endDate: "2026-10-23", viewMode: "matrix" }],
    ["sgkReport", getSgkMonthlyReport, { projectId: ids.projectId, year: 2026, month: 10 }],
    ["overtimeReport", getOvertimeSummaryReport, { projectId: ids.projectId, year: 2026, month: 10 }],
    ["departmentReport", getDepartmentCostReport, { projectId: ids.projectId, year: 2026, month: 10 }],
    ["attendanceReport", getAttendanceSummaryReport, { projectId: ids.projectId, year: 2026, month: 10 }],
    ["dashboard", getActivitySummary, { projectId: ids.projectId }],
    ["annual", getAnnualOvertimeBalance, { projectId: ids.projectId, year: 2026 }],
    ["sgk", buildAphbForMonth, { projectId: ids.projectId, year: 2026, month: 10 }],
  ] as const;
  const baseline = new Map<string, { reads: string[]; result: unknown }>();
  for (const otherFlexible of [false, true]) {
    if (otherFlexible) await t.run(async ctx => {
      const projectId = await ctx.db.insert("projects", { name: "Başka esnek proje" });
      const shiftId = await ctx.db.insert("shifts", { projectId, name: "Başka esnek", scheduleType: "flexible", flexible: DEFAULT_FLEXIBLE, startTime: "05:00", endTime: "22:00", createdAt: "", updatedAt: "" });
      const employeeId = await ctx.db.insert("employees", { projectId, firstName: "Başka", lastName: "Kişi", email: "other@test", cardNumber: "other", isActive: true });
      await ctx.db.insert("shiftAssignments", { projectId, employeeId, shiftId, startDate: "2026-01-01", endDate: "2026-12-31", createdAt: "", updatedAt: "" });
    });
    for (const [name, registered, args] of cases) {
      const reads: unknown[][] = [];
      await caller.run(async ctx => {
        function trace(target: object, calls: unknown[]): object {
          return new Proxy(target, { get(obj, key) {
            const value: unknown = Reflect.get(obj, key);
            if (typeof value !== "function") return value;
            return (...values: unknown[]) => {
              // Capture actual index bounds, not callback identity.
              calls.push([String(key), ...values.filter(value => typeof value !== "function")]);
              if (key === "withIndex" && typeof values[1] === "function") {
                const callback = values[1];
                values[1] = (query: object) => Reflect.apply(callback, undefined, [trace(query, calls)]);
              }
              const result: unknown = Reflect.apply(value, obj, values);
              return result !== null && typeof result === "object" && ["withIndex", "eq", "gte", "lte", "gt", "lt", "order", "filter"].includes(String(key)) ? trace(result, calls) : result;
            };
          } });
        }
        const db = new Proxy(ctx.db, { get(target, key) {
          if (key !== "query") return Reflect.get(target, key);
          return (table: string) => {
            const calls: unknown[] = [table];
            if (table !== "pdksRuleVersions" && table !== "pdksCheckpointSelections") reads.push(calls);
            return trace(Reflect.apply(target.query, target, [table]) as object, calls);
          };
        } });
        const handler = registered as unknown as { _handler: (ctx: QueryCtx, args: object) => Promise<unknown> };
        const result = await handler._handler({ ...ctx, db }, args);
        if (name === "sgk" && result !== null && typeof result === "object" && "employees" in result) delete result.employees;
        // Coordinator-approved W5.3 metadata gate only; all DTOs and other DB traces remain strict.
        const discovery = reads.filter(read => read[0] === "shifts" && read.some(call => Array.isArray(call) && call[0] === "withIndex" && call[1] === "by_project"));
        for (const read of discovery) {
          const scope: unknown = Array.isArray(read[2]) ? read[2][2] : null;
          expect(scope === undefined || scope === ids.projectId).toBe(true);
          expect(read).toEqual(["shifts", ["withIndex", "by_project"], ["eq", "projectId", scope], ["export"], ["take", 1001]]);
        }
        // yetki meta okuması (docs/roles/PLAN.md), DTO'yu etkilemez
        const permissionMetadata = (read: unknown[]) => read[0] === "projectRolePermissions" || (read[0] === "userProjects" && read.some(call => Array.isArray(call) && call[0] === "withIndex" && call[1] === "by_user") && read.some(call => Array.isArray(call) && call[0] === "take" && call[1] === 1000));
        // Coordinator-approved Paket B existence probes; DTOs and legacy data reads remain strict.
        const planDiscovery = reads.filter(read => read[0] === "shiftPlanRefs" || read[0] === "departmentShiftAssignments");
        for (const read of planDiscovery) {
          if (read[0] === "shiftPlanRefs") {
            expect(read).toEqual(["shiftPlanRefs", ["withIndex", "by_project"], ["eq", "projectId", ids.projectId], ["export"], ["first"]]);
          } else {
            const lowerBound: unknown = Array.isArray(read[3]) ? read[3][2] : undefined;
            expect(typeof lowerBound).toBe("string");
            expect(read).toEqual(["departmentShiftAssignments", ["withIndex", "by_project_end"], ["eq", "projectId", ids.projectId], ["gte", "endDate", lowerBound], ["export"], ["first"]]);
          }
        }
        const normalizedReads = reads.filter(read => !discovery.includes(read) && !planDiscovery.includes(read) && !permissionMetadata(read)).map(read => JSON.stringify(stable(read))).sort();
        const actual = { reads: normalizedReads, result: stable(result) };
        if (otherFlexible) expect(actual, `${name}: başka projedeki esnek atama sabit DTO/DB izini değiştirmez`).toEqual(baseline.get(name));
        else {
          expect(actual, name).toMatchSnapshot(name);
          baseline.set(name, actual);
        }
      });
    }
  }
});
