// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import type { QueryCtx } from "./_generated/server";
import { api } from "./_generated/api";
import schema from "./schema";
import { getSgkMonthlyReport } from "./reports";
import { buildAphbForMonth } from "./sgkExport";
import { DEFAULT_FLEXIBLE } from "./lib/pdksFlexible";
const modules = import.meta.glob("./**/*.ts");

async function fixture(flexible = false) {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "Rapor" });
    const userId = await ctx.db.insert("users", { role: "project_admin" });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 86400000 });
    await ctx.db.insert("userProjects", { userId, projectId });
    const shiftId = await ctx.db.insert("shifts", { projectId, name: "Vardiya", startTime: "09:00", endTime: "18:00", ...(flexible ? { scheduleType: "flexible" as const, flexible: DEFAULT_FLEXIBLE } : {}), createdAt: "", updatedAt: "" });
    const employeeId = await ctx.db.insert("employees", { projectId, firstName: "Çalışan", lastName: "Test", cardNumber: "1", email: "test@example.com", isActive: true, hourlyRate: 100 });
    await ctx.db.insert("shiftAssignments", { projectId, employeeId, shiftId, startDate: "2026-01-01", endDate: "2026-12-31", createdAt: "", updatedAt: "" });
    for (const [time, direction] of [["09:00", "entry"], ["18:00", "exit"]] as const) await ctx.db.insert("cardReadings", { projectId, employeeId, cardNo: "1", accessTime: `2026-10-01T${time}:00+03:00`, direction, accessStatus: "izin_verildi" });
    return { projectId, employeeId, shiftId, userId, sessionId };
  });
  return { t, ids, caller: t.withIdentity({ subject: `${ids.userId}|${ids.sessionId}` }) };
}

it("N-02: başka projenin 10.001 manuel kaydı esnek yıllık raporu etkilemez", async () => {
  const { t, ids, caller } = await fixture(true);
  const args = { projectId: ids.projectId, year: 2026 };
  await t.run(ctx => ctx.db.insert("holidays", { projectId: ids.projectId, date: "2026-10-01", name: "Tatil", createdAt: "" }));
  const before = await caller.query(api.reports.getOvertimeSummaryReport, args);
  expect(before.totalOvertimeHours).toBe(8);
  expect(before.totalOvertimePayTRY).toBe(1600);
  await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "Yabancı" });
    const employeeId = await ctx.db.insert("employees", { projectId, firstName: "Yabancı", lastName: "Test", email: "foreign@example.com", cardNumber: "2", isActive: true });
    for (let i = 0; i < 10001; i++) await ctx.db.insert("pdksRecords", { projectId, employeeId, employeeFirstName: "Yabancı", employeeLastName: "Test", date: "2026-10-01", manualEntry: true, status: "present", createdAt: "", updatedAt: "" });
  });
  expect(await caller.query(api.reports.getOvertimeSummaryReport, args)).toEqual(before);
});

it.each([false, true])("N-02: SGK/APHB ham dönem okumaları yalnız bir kez (esnek=%s)", async flexible => {
  const { ids, caller } = await fixture(flexible);
  for (const registered of [getSgkMonthlyReport, buildAphbForMonth]) {
    await caller.run(async ctx => {
      const indexes: string[] = [];
      const db = new Proxy(ctx.db, { get(target, key) {
        if (key !== "query") return Reflect.get(target, key);
        return (table: string) => {
          const query: object = Reflect.apply(target.query, target, [table]);
          return new Proxy(query, { get(targetQuery, method) {
            const value: unknown = Reflect.get(targetQuery, method);
            if (method !== "withIndex" || typeof value !== "function") return value;
            return (...args: unknown[]) => {
              indexes.push(`${table}.${String(args[0])}`);
              return Reflect.apply(value, targetQuery, args);
            };
          } });
        };
      } });
      const handler = registered as unknown as { _handler: (ctx: QueryCtx, args: object) => Promise<unknown> };
      await handler._handler({ ...ctx, db }, { projectId: ids.projectId, year: 2026, month: 10 });
      expect(indexes.filter(index => index === "cardReadings.by_project_access_time")).toHaveLength(1);
      expect(indexes).not.toContain("pdksRecords.by_date");
    });
  }
});

it.each(["employee", "card", "manual"] as const)("N-06: aktif ziyaretçi SGK aylık dökümüne girmez (%s)", async source => {
  const { t, ids, caller } = await fixture();
  await t.run(async ctx => {
    await ctx.db.patch(ids.employeeId, { isVisitor: true });
    if (source !== "employee") {
      const readings = await ctx.db.query("cardReadings").withIndex("by_project_access_time", q => q.eq("projectId", ids.projectId)).take(10);
      for (const reading of readings) {
        if (source === "card") await ctx.db.patch(reading._id, { employeeId: undefined });
        else await ctx.db.delete(reading._id);
      }
      if (source === "manual") await ctx.db.insert("pdksRecords", { projectId: ids.projectId, employeeId: ids.employeeId, employeeFirstName: "Çalışan", employeeLastName: "Test", date: "2026-10-01", entryTime: "09:00", exitTime: "18:00", manualEntry: true, status: "present", createdAt: "", updatedAt: "" });
    }
  });
  expect((await caller.query(api.reports.getSgkMonthlyReport, { projectId: ids.projectId, year: 2026, month: 10 })).rows).toEqual([]);
});
