// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { expect, it } from "vitest";
import { convexTest } from "convex-test";
import { getConvexSize } from "convex/values";
import { api } from "./_generated/api";
import type { QueryCtx } from "./_generated/server";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { getPdksTableData as tableQuery, getMonthlyPayrollSheet as payrollQuery } from "./cardReadings";
import schema from "./schema";
import { withPdksReadBudget } from "./lib/pdksTableQuery";

it("monthly table and payroll return all 200 people with 22 days × 4 punches (17,600 readings)", async () => {
  const t = convexTest(schema, import.meta.glob("./**/*.ts"));
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "Monthly capacity" });
    const userId = await ctx.db.insert("users", { role: "super_admin", verified: true });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 86400000 });
    const shiftId = await ctx.db.insert("shifts", { projectId, name: "Day", startTime: "08:00", endTime: "17:00", createdAt: "", updatedAt: "" });
    const employeeIds = [];
    for (let person = 0; person < 200; person++) {
      const employeeId = await ctx.db.insert("employees", { projectId, shiftId, firstName: `Person ${person}`, lastName: "Test", email: `person${person}@example.test`, cardNumber: String(person), isActive: true });
      employeeIds.push(employeeId);
      await ctx.db.insert("shiftAssignments", { projectId, employeeId, shiftId, startDate: "2026-01-01", endDate: "2026-12-31", createdAt: "", updatedAt: "" });
    }
    return { projectId, userId, sessionId, employeeIds };
  });
  await t.run(async ctx => {
    for (const [person, employeeId] of ids.employeeIds.entries()) {
      for (const [time, direction] of [["05:00", "entry"], ["09:00", "exit"], ["10:00", "entry"], ["14:00", "exit"]] as const) {
        await ctx.db.insert("cardReadings", { projectId: ids.projectId, employeeId, cardNo: String(person), accessTime: `2026-06-01T${time}:00.000Z`, accessStatus: "izin_verildi", direction, rawData: "x".repeat(192) });
      }
    }
  });
  const dates = Array.from({ length: 30 }, (_, index) => `2026-06-${String(index + 1).padStart(2, "0")}`)
    .filter(date => ![0, 6].includes(new Date(date).getUTCDay()));
  expect(dates).toHaveLength(22);
  // Parametric database fixture: the real indexed day is expanded to 22 weekdays
  // BEFORE the budget and calculation see it; metadata and auth use real Convex queries.
  // Avoid quadratic storage/index fixture setup in convex-test for 17,600 inserts.
  let periodReads = 0;
  const expand = <Q extends object>(query: Q, period = false): Q => new Proxy(query, {
    get(target, key) {
      const value: unknown = Reflect.get(target, key);
      if (key === Symbol.asyncIterator) return async function* () {
        for await (const row of target as unknown as AsyncIterable<Record<string, unknown>>) {
          if (!period || typeof row.accessTime !== "string") { yield row; continue; }
          for (const date of dates) {
            periodReads++;
            yield { ...row, _id: `${String(row._id)}-${date}`, accessTime: `${date}${row.accessTime.slice(10)}` };
          }
        }
      };
      if (typeof value !== "function") return value;
      return (...args: unknown[]) => {
        const result: unknown = Reflect.apply(value, target, args);
        return result !== null && typeof result === "object" && !(result instanceof Promise)
          ? expand(result, key === "withIndex" ? args[0] === "by_project_access_time" : period) : result;
      };
    },
  });
  const user = t.withIdentity({ subject: `${ids.userId}|${ids.sessionId}` });
  const run = <A, R>(registered: unknown, args: A) => user.run(async ctx => {
    const db = new Proxy(ctx.db, {
      get(target, key) {
        if (key !== "query") return Reflect.get(target, key);
        return (...params: unknown[]) => {
          const query: object = Reflect.apply(target.query, target, params);
          return params[0] === "cardReadings" ? expand(query) : query;
        };
      },
    });
    const handler = registered as { _handler: (ctx: QueryCtx, args: A) => Promise<R> };
    return handler._handler({ ...ctx, db }, args);
  });
  const table = await run<FunctionArgs<typeof api.cardReadings.getPdksTableData>, FunctionReturnType<typeof api.cardReadings.getPdksTableData>>(tableQuery,
    { projectId: ids.projectId, startDate: "2026-06-01", endDate: "2026-06-30", viewMode: "matrix" });
  expect(periodReads).toBe(17600);
  expect(table).toHaveLength(200);
  expect(table.every(row => row.days.filter(day => day.status === "present" || day.status === "late").length === 22)).toBe(true);
  periodReads = 0;
  const payroll = await run<FunctionArgs<typeof api.cardReadings.getMonthlyPayrollSheet>, FunctionReturnType<typeof api.cardReadings.getMonthlyPayrollSheet>>(payrollQuery,
    { projectId: ids.projectId, year: 2026, month: 6 });
  expect(periodReads).toBe(17600);
  expect(payroll.rows).toHaveLength(200);
}, 60_000);

it("250 employees and 25 allowed projects have no additional fixed caps", async () => {
  const t = convexTest(schema, import.meta.glob("./**/*.ts"));
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "250 people" });
    for (let i = 0; i < 24; i++) await ctx.db.insert("projects", { name: `Empty ${i}` });
    const userId = await ctx.db.insert("users", { role: "super_admin", verified: true });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 86400000 });
    const shiftId = await ctx.db.insert("shifts", { projectId, name: "Day", startTime: "08:00", endTime: "17:00", createdAt: "", updatedAt: "" });
    for (let i = 0; i < 250; i++) {
      const employeeId = await ctx.db.insert("employees", { projectId, shiftId, firstName: `Person ${i}`, lastName: "Test", email: `${i}@example.test`, cardNumber: String(i), isActive: true });
      await ctx.db.insert("shiftAssignments", { projectId, employeeId, shiftId, startDate: "2026-01-01", endDate: "2026-12-31", createdAt: "", updatedAt: "" });
    }
    return { projectId, userId, sessionId };
  });
  const user = t.withIdentity({ subject: `${ids.userId}|${ids.sessionId}` });
  expect(await user.query(api.cardReadings.getPdksTableData, { projectId: ids.projectId, date: "2026-06-22" })).toHaveLength(250);
  expect((await user.query(api.cardReadings.getMonthlyPayrollSheet, { projectId: ids.projectId, year: 2026, month: 6 })).rows).toHaveLength(250);
  await expect(user.query(api.dashboard.getActivitySummary, {})).resolves.toBeDefined();
  await expect(user.query(api.shifts.listAssignments, {})).resolves.toHaveLength(250);
}, 30_000);

it("db.get, first and iterated documents share one budget across nested helpers", async () => {
  const t = convexTest(schema, import.meta.glob("./**/*.ts"));
  await t.run(async ctx => {
    const id = await ctx.db.insert("projects", { name: "x".repeat(512 * 1024) });
    const bounded = withPdksReadBudget(ctx);
    expect(withPdksReadBudget(bounded).db).toBe(bounded.db);
    for (let i = 0; i < 10; i++) await bounded.db.get(id);
    for (let i = 0; i < 10; i++) await bounded.db.query("projects").first();
    for (let i = 0; i < 9; i++) await bounded.db.query("projects").take(1);
    await expect(bounded.db.get(id)).rejects.toThrow("Okuma sınırı");
  });
});
it("index/get ranges stop before Convex's 4,096 range limit", async () => {
  const t = convexTest(schema, import.meta.glob("./**/*.ts"));
  await t.run(async ctx => {
    const bounded = withPdksReadBudget(ctx);
    for (let i = 0; i < 4090; i++) await bounded.db.query("projects").first();
    expect(() => bounded.db.query("projects")).toThrow("Sorgu aralığı sınırı");
  });
});
it("measure 30,000-document accounting CPU without serializing JSON", () => {
  const doc = { _id: "reading", _creationTime: 1790000000000, accessTime: "2026-06-22T08:00:00Z", rawData: "x".repeat(350), employeeName: "İpek Çağrı 😀" };
  let jsonBytes = 0;
  const encoder = new TextEncoder();
  const jsonStart = performance.now();
  for (let i = 0; i < 30000; i++) jsonBytes += encoder.encode(JSON.stringify(doc)).byteLength;
  const jsonElapsed = performance.now() - jsonStart;
  let bytes = 0;
  const start = performance.now();
  for (let i = 0; i < 30000; i++) bytes += getConvexSize(doc);
  const elapsed = performance.now() - start;
  console.info(`30,000 documents: JSON+UTF8 ${jsonElapsed.toFixed(1)} ms / SDK ${elapsed.toFixed(1)} ms; ${jsonBytes} JSON bytes / ${bytes} Convex bytes`);
  expect(bytes).toBe(getConvexSize(doc) * 30000);
});

it("binary-size accounting accepts valid readings with JSON escape inflation", async () => {
  const { readBoundedPdks } = await import("./lib/pdksTableQuery");
  async function* rows() {
    for (let i = 0; i < 30; i++) yield { rawData: "\n".repeat(300 * 1024) };
  }
  expect(await readBoundedPdks(rows())).toHaveLength(30);
});
