// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, it, vi } from "vitest";
import schema from "./schema";
import { getAnnualOvertimeBalance } from "./dashboard";
import { loadRuleReportDays } from "./lib/reportAttendance";
import type { QueryCtx } from "./_generated/server";
const modules = import.meta.glob("./**/*.ts");

it("W5-A fix2: yıllık 20002 okuma tek yüklenir, ek sorgular yalnız sınır günleridir ve bakiye aynı kalır", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2027-01-02T12:00:00Z"));
  try {
    const t = convexTest(schema, modules);
    const ids = await t.run(async ctx => {
      const projectId = await ctx.db.insert("projects", { name: "Yıllık" });
      const userId = await ctx.db.insert("users", { role: "project_admin" });
      const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 86400000 });
      await ctx.db.insert("userProjects", { projectId, userId });
      const employeeId = await ctx.db.insert("employees", { projectId, firstName: "Ada", lastName: "Test", email: "ada@test", cardNumber: "123", isActive: true });
      await ctx.db.insert("pdksRuleVersions", { projectId, effectiveFrom: "2026-01-01", punchMode: "requirements", checkpointMode: "all", requireCheckIn: true, requireCheckOut: true, missingRequiredPunch: "review", noPunch: "absent", createdAt: "", createdBy: userId });
      for (const direction of ["entry", "exit"] as const) await ctx.db.insert("cardReadings", { projectId, employeeId, cardNo: "123", direction, accessStatus: "izin_verildi", accessTime: direction === "entry" ? "2026-01-05T05:00:00.000Z" : "2026-01-05T16:00:00.000Z" });
      return { projectId, userId, sessionId };
    });
    const caller = t.withIdentity({ subject: `${ids.userId}|${ids.sessionId}` });
    const handler = getAnnualOvertimeBalance as unknown as { _handler: (ctx: QueryCtx, args: { projectId: typeof ids.projectId; year: number }) => Promise<unknown> };
    const args = { projectId: ids.projectId, year: 2026 };
    const baseline = await caller.run(ctx => handler._handler(ctx, args));
    const queries: unknown[][] = [];
    const result = await caller.run(async ctx => {
      function trace(target: object, calls: unknown[]): object {
        return new Proxy(target, { get(obj, key) {
          const value: unknown = Reflect.get(obj, key);
          if (typeof value !== "function") return value;
          return (...values: unknown[]) => {
            calls.push([String(key), ...values.filter(value => typeof value !== "function")]);
            if (key === "withIndex" && typeof values[1] === "function") {
              const callback = values[1];
              values[1] = (builder: object) => Reflect.apply(callback, undefined, [trace(builder, calls)]);
            }
            const result: unknown = Reflect.apply(value, obj, values);
            // Parametric fixture: expand only the existing annual collect beyond the old 20k cap.
            if (key === "collect") return Promise.resolve(result).then((rows: unknown) => {
              if (!Array.isArray(rows) || rows.length !== 2) return rows;
              return Array.from({ length: 20002 }, (_, index) => rows[index % 2]);
            });
            return result !== null && typeof result === "object" && ["withIndex", "eq", "gte", "lte", "gt", "lt", "order", "filter"].includes(String(key)) ? trace(result, calls) : result;
          };
        } });
      }
      const db = new Proxy(ctx.db, { get(target, key) {
        if (key !== "query") return Reflect.get(target, key);
        return (table: string) => {
          const query = Reflect.apply(target.query, target, [table]) as object;
          if (table !== "cardReadings") return query;
          const calls: unknown[] = []; queries.push(calls);
          return trace(query, calls);
        };
      } });
      return handler._handler({ ...ctx, db }, args);
    });
    expect(result).toEqual(baseline);
    const annual = queries.filter(calls => JSON.stringify(calls).includes("2025-12-31T21:00:00.000Z") && JSON.stringify(calls).includes("2026-12-31T20:59:59.999Z"));
    expect(annual).toHaveLength(1);
    expect(annual[0]).toContainEqual(["collect"]);
    expect(queries.filter(calls => calls.some(call => Array.isArray(call) && call[0] === "take" && call[1] === 20001))).toHaveLength(1);
    expect(queries.some(calls => JSON.stringify(calls).includes('"lte","accessTime","2025-12-31T20:59:59.999Z"'))).toBe(true);
    expect(queries.some(calls => JSON.stringify(calls).includes('"gte","accessTime","2026-12-31T21:00:00.000Z"'))).toBe(true);
    // The adapter produces exactly the same work-day rows with preloaded data.
    await t.run(async ctx => {
      const readings = await ctx.db.query("cardReadings").withIndex("by_project", q => q.eq("projectId", ids.projectId)).collect();
      const direct = await loadRuleReportDays(ctx, [ids.projectId], "2026-01-01", "2026-12-31");
      const reused = await loadRuleReportDays(ctx, [ids.projectId], "2026-01-01", "2026-12-31", { preloadedReadings: { readings, startISO: "2025-12-31T21:00:00.000Z", endISO: "2026-12-31T20:59:59.999Z" } });
      expect(reused.ruleRows).toEqual(direct.ruleRows);
      expect(reused.readings).toEqual(direct.readings);
    });
  } finally { vi.useRealTimers(); }
  // 20002 okumalık yük testi: tam koşuda paralel yük altında 5 sn varsayılanı aşabiliyor (tek başına ~4 sn).
}, 30_000);
