// @vitest-environment edge-runtime
import { writeFileSync } from "node:fs";
/// <reference types="vite/client" />
import { expect, it } from "vitest";
import { convexTest } from "convex-test";
import { getConvexSize, type Value } from "convex/values";
import { getFunctionName, type FunctionReference } from "convex/server";
import { api } from "./_generated/api";
import schema from "./schema";
import type { QueryCtx } from "./_generated/server";
import * as batchFunctions from "./pdksBatches";
import { loadPdksTable, loadPdksPayroll } from "../src/lib/pdksBatches";
import { DEFAULT_FLEXIBLE } from "./lib/pdksFlexible";

const modules = import.meta.glob("./**/*.ts");
const rawDeviceBody = JSON.stringify({ source: "card", padding: "x".repeat(1600) });
const punchTimes = [["05:00", "entry"], ["09:00", "exit"], ["10:00", "entry"], ["14:00", "exit"]] as const;
type PageState = { rows: Map<string, Record<string, unknown>[]> };
function proxyQuery<Q extends object>(query: Q, dates: readonly string[], state: PageState, bounds: { start?: string; end?: string } = {}): Q {
  const expand = (row: Record<string, unknown>) => dates.flatMap(date => punchTimes.map(([time, direction]) => ({ ...row,
    _id: `${String(row._id)}-${date}-${time}`, accessTime: `${date}T${time}:00.000Z`, direction, rawData: rawDeviceBody,
  }))).filter(reading => (!bounds.start || reading.accessTime >= bounds.start) && (!bounds.end || reading.accessTime <= bounds.end));
  return new Proxy(query, { get(target, key) {
    const value: unknown = Reflect.get(target, key);
    if (key === Symbol.asyncIterator) return async function* () {
      for await (const row of target as unknown as AsyncIterable<Record<string, unknown>>) for (const reading of expand(row)) yield reading;
    };
    if (key === "first") return async () => {
      for await (const row of proxyQuery(target, dates, state, bounds) as unknown as AsyncIterable<unknown>) return row;
      return null;
    };
    if (key === "paginate") return async (opts: { cursor: string | null; numItems: number; maximumBytesRead: number }) => {
      const key = `${bounds.start}/${bounds.end}`;
      let rows = state.rows.get(key);
      if (!rows) {
        const collect = Reflect.get(target, "collect") as () => Promise<Record<string, unknown>[]>;
        rows = (await Reflect.apply(collect, target, [])).flatMap(expand);
        state.rows.set(key, rows);
      }
      const start = Number(opts.cursor ?? 0);
      let end = start, bytes = 0;
      while (end < rows.length && end - start < opts.numItems) {
        const size = getConvexSize(rows[end] as Value);
        if (bytes + size > opts.maximumBytesRead && end > start) break;
        bytes += size;
        end++;
      }
      return { page: rows.slice(start, end), isDone: end === rows.length, continueCursor: String(end) };
    };
    if (typeof value !== "function") return value;
    return (...args: unknown[]) => {
      const nextBounds = { ...bounds };
      if (key === "withIndex" && typeof args[1] === "function") {
        const callback = args[1];
        const trace = (builder: object): object => new Proxy(builder, { get(range, method) {
          const fn: unknown = Reflect.get(range, method);
          if (typeof fn !== "function") return fn;
          return (...values: unknown[]) => {
            if (values[0] === "accessTime" && typeof values[1] === "string") {
              if (method === "gte") nextBounds.start = values[1];
              if (method === "lte") nextBounds.end = values[1];
            }
            const result: unknown = Reflect.apply(fn, range, values);
            return result && typeof result === "object" ? trace(result) : result;
          };
        } });
        args[1] = (builder: object) => Reflect.apply(callback, undefined, [trace(builder)]);
      }
      const result: unknown = Reflect.apply(value, target, args);
      return result !== null && typeof result === "object" && !(result instanceof Promise) ? proxyQuery(result, dates, state, nextBounds) : result;
    };
  } });
}
interface IoMeter { bytes: number; baselineBytes: number; transactions: number; current: number; peak: number }
function metered<Q extends object>(query: Q, table: string, io: IoMeter): Q {
  const count = (row: unknown) => { if (row !== null && row !== undefined) io.bytes += getConvexSize(row as Value); };
  return new Proxy(query, { get(target, key) {
    const value: unknown = Reflect.get(target, key);
    if (key === Symbol.asyncIterator) return async function* () {
      for await (const row of target as unknown as AsyncIterable<unknown>) { count(row); yield row; }
    };
    if (typeof value !== "function") return value;
    if (["collect", "take", "first", "unique", "paginate"].includes(String(key))) return async (...args: unknown[]) => {
      const result: unknown = await Reflect.apply(value, target, args);
      if (Array.isArray(result)) result.forEach(count);
      else if (result && typeof result === "object" && "page" in result && Array.isArray(result.page)) {
        result.page.forEach(count);
        if (table === "cardReadings") for (const row of result.page) io.baselineBytes += getConvexSize(row as Value);
      } else count(result);
      return result;
    };
    return (...args: unknown[]) => {
      const result: unknown = Reflect.apply(value, target, args);
      return result && typeof result === "object" && !(result instanceof Promise) ? metered(result, table, io) : result;
    };
  } });
}

it("batched table and payroll equal existing complete calculations, including global availability, flex and night work", async () => {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "Exact" });
    const userId = await ctx.db.insert("users", { role: "super_admin", verified: true });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 86400000 });
    const companyId = await ctx.db.insert("companies", { projectId, name: "Visible" });
    const otherCompanyId = await ctx.db.insert("companies", { projectId, name: "Other" });
    const fixed = await ctx.db.insert("shifts", { projectId, name: "Day", startTime: "08:00", endTime: "17:00", createdAt: "", updatedAt: "" });
    const flexible = await ctx.db.insert("shifts", { projectId, name: "Flexible", startTime: "05:00", endTime: "22:00", scheduleType: "flexible", flexible: DEFAULT_FLEXIBLE, createdAt: "", updatedAt: "" });
    const night = await ctx.db.insert("shifts", { projectId, name: "Night", startTime: "22:00", endTime: "06:00", createdAt: "", updatedAt: "" });
    for (let i = 0; i < 21; i++) {
      const shiftId = i === 19 ? flexible : i === 20 ? night : fixed;
      const employeeId = await ctx.db.insert("employees", { projectId, shiftId, firstName: `Person ${i}`, lastName: "Test", companyId: i === 20 ? otherCompanyId : companyId, email: `${i}@example.test`, cardNumber: i === 20 ? "0" : String(i), isActive: true });
      await ctx.db.insert("shiftAssignments", { projectId, employeeId, shiftId, startDate: "2026-01-01", endDate: "2026-12-31", createdAt: "", updatedAt: "" });
      await ctx.db.insert("cardReadings", { projectId, employeeId, cardNo: String(i), accessTime: "2026-05-01T05:00:00Z", direction: "entry", accessStatus: "izin_verildi" });
      if (i === 0 || i === 19 || i === 20) for (const [accessTime, direction] of i === 20 ? [["2026-06-02T19:00:00Z", "entry"], ["2026-06-03T03:00:00Z", "exit"]] : [["2026-06-01T09:00:00Z", "entry"], ["2026-06-01T18:00:00Z", "exit"]]) {
        await ctx.db.insert("cardReadings", { projectId, employeeId, cardNo: String(i), accessTime, direction: direction === "entry" ? "entry" : "exit", accessStatus: "izin_verildi" });
      }
    }
    for (const [accessTime, direction] of [["2026-06-05T19:00:00Z", "entry"], ["2026-06-06T03:00:00Z", "exit"]] as const) await ctx.db.insert("cardReadings", { projectId, cardNo: "0", accessTime, direction, accessStatus: "izin_verildi" });
    await ctx.db.insert("cardReadings", { projectId, cardNo: "unassigned", accessTime: "2026-06-04T06:00:00Z", direction: "entry", accessStatus: "izin_verildi" });
    return { projectId, userId, sessionId, companyId };
  });
  const client = t.withIdentity({ subject: `${ids.userId}|${ids.sessionId}` });
  const tableArgs = { projectId: ids.projectId, startDate: "2026-06-01", endDate: "2026-06-30", viewMode: "matrix" as const };
  expect(await loadPdksTable(client, tableArgs)).toEqual(await client.query(api.cardReadings.getPdksTableData, tableArgs));
  const payrollArgs = { projectId: ids.projectId, year: 2026, month: 6 };
  expect(await loadPdksPayroll(client, payrollArgs)).toEqual(await client.query(api.cardReadings.getMonthlyPayrollSheet, payrollArgs));
  const filtered = { ...tableArgs, companyId: ids.companyId };
  expect(await loadPdksTable(client, filtered)).toEqual(await client.query(api.cardReadings.getPdksTableData, filtered));
  const filteredPayroll = { ...payrollArgs, companyId: ids.companyId };
  expect(await loadPdksPayroll(client, filteredPayroll)).toEqual(await client.query(api.cardReadings.getMonthlyPayrollSheet, filteredPayroll));
}, 30_000);

async function scaleFixture(count: number) {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: `${count} people` });
    const userId = await ctx.db.insert("users", { role: "super_admin", verified: true });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 86400000 });
    const shiftId = await ctx.db.insert("shifts", { projectId, name: "Day", startTime: "08:00", endTime: "17:00", createdAt: "", updatedAt: "" });
    const devices = [];
    for (let i = 0; i < 10; i++) devices.push(await ctx.db.insert("devices", { projectId, name: `Device ${i}`, createdAt: "", updatedAt: "" }));
    for (let i = 0; i < count; i++) {
      const employeeId = await ctx.db.insert("employees", { projectId, shiftId, firstName: `Person ${String(i).padStart(3, "0")}`, lastName: "Test", email: `${i}@example.test`, cardNumber: String(i), isActive: true });
      await ctx.db.insert("shiftAssignments", { projectId, employeeId, shiftId, startDate: "2026-01-01", endDate: "2026-12-31", createdAt: "", updatedAt: "" });
      await ctx.db.insert("cardReadings", { projectId, employeeId, deviceId: devices[i % 10], cardNo: String(i), accessTime: "2026-06-01T05:00:00.000Z", direction: "entry", accessStatus: "izin_verildi" });
    }
    return { projectId, userId, sessionId };
  });
  const user = t.withIdentity({ subject: `${ids.userId}|${ids.sessionId}` });
  const dates = Array.from({ length: 30 }, (_, i) => `2026-06-${String(i + 1).padStart(2, "0")}`).filter(date => ![0, 6].includes(new Date(date).getUTCDay()));
  const io: IoMeter = { bytes: 0, baselineBytes: 0, transactions: 0, current: 0, peak: 0 };
  const pageState: PageState = { rows: new Map() };
  // The real 500-person fixture's indexed badge is expanded before each transaction's
  // budget sees it; 44,000 readings with realistic 1.6 KB raw device bodies.
  const query = async (ref: FunctionReference<"query">, args: Record<string, unknown>) => {
    io.transactions++;
    io.current++; io.peak = Math.max(io.peak, io.current);
    const name = getFunctionName(ref).split(":")[1] as keyof typeof batchFunctions;
    const registered = batchFunctions[name] as unknown as { _handler: (ctx: QueryCtx, args: Record<string, unknown>) => Promise<unknown> };
    try { return await user.run(ctx => {
      const db = new Proxy(ctx.db, { get(target, key) {
        if (key === "get") return async (...params: unknown[]) => {
          const row: unknown = await Reflect.apply(target.get, target, params);
          if (row !== null) io.bytes += getConvexSize(row as Value);
          return row;
        };
        if (key !== "query") return Reflect.get(target, key);
        return (...params: unknown[]) => {
          const source: object = Reflect.apply(target.query, target, params);
          return metered(params[0] === "cardReadings" ? proxyQuery(source, dates, pageState) : source, String(params[0]), io);
        };
      } });
      return registered._handler({ ...ctx, db }, args);
    }); } finally { io.current--; }
  };
  const client = { query } as unknown as Parameters<typeof loadPdksTable>[0];

  return { client, ids, io };
}
it("500 employees / 44,000 monthly readings: table AND payroll opening reads at most 1.2x source bytes", async () => {
  const { client, ids, io } = await scaleFixture(500);
  const rows = await loadPdksTable(client, { projectId: ids.projectId, startDate: "2026-06-01", endDate: "2026-06-30", viewMode: "matrix" });
  expect(rows).toHaveLength(500);
  expect(rows.every(row => row.days.filter(day => day.status === "present" || day.status === "late").length === 22)).toBe(true);
  const afterTable = io.bytes;
  const sheet = await loadPdksPayroll(client, { projectId: ids.projectId, year: 2026, month: 6 });
  expect(sheet.rows).toHaveLength(500);
  const metrics = { sourceBytes: io.baselineBytes, tableBytes: afterTable, tableAndPayrollBytes: io.bytes, ratio: io.bytes / io.baselineBytes, transactions: io.transactions, peak: io.peak };
  writeFileSync("/tmp/ngsaccess-pdks-io.json", JSON.stringify(metrics));
  expect(io.bytes / io.baselineBytes).toBeLessThanOrEqual(1.2);
  expect(io.peak).toBe(4);
}, 360_000);
it.each([500, 1000])("Friday daily view at %i employees returns every row without a monolithic read", async count => {
  const { client, ids } = await scaleFixture(count);
  const rows = await loadPdksTable(client, { projectId: ids.projectId, date: "2026-06-05", viewMode: "matrix" });
  expect(rows).toHaveLength(count);
  expect(rows.every(row => row.days[0]?.status === "present" || row.days[0]?.status === "late")).toBe(true);
}, 360_000);

it("every batch endpoint checks project/report access before reading data", async () => {
  const { pdksBatchRefs } = await import("../src/lib/pdksBatches");
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "Private" });
    const userId = await ctx.db.insert("users", { role: "project_user", verified: true });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 86400000 });
    return { projectId, userId, sessionId };
  });
  const user = t.withIdentity({ subject: `${ids.userId}|${ids.sessionId}` });
  const request = { kind: "table" as const, args: { projectId: ids.projectId, date: "2026-06-01" } };
  await expect(user.query(pdksBatchRefs.roster, { request, cursor: null })).rejects.toThrow("erişim");
  await expect(user.query(pdksBatchRefs.dates, { request, roster: [], cursor: null })).rejects.toThrow("erişim");
  await expect(user.query(pdksBatchRefs.calculate, { request, roster: [], employeeIds: [], availabilityOnly: true })).rejects.toThrow("erişim");
  await expect(user.query(pdksBatchRefs.closed, { args: { projectId: ids.projectId, year: 2026, month: 6 }, cursor: null })).rejects.toThrow("erişim");
});
