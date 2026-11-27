// @vitest-environment edge-runtime
import { writeFileSync } from "node:fs";
/// <reference types="vite/client" />
import { expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import { getConvexSize, type Value } from "convex/values";
import { getFunctionName, type FunctionReference } from "convex/server";
import { api } from "./_generated/api";
import schema from "./schema";
import type { QueryCtx } from "./_generated/server";
import * as batchFunctions from "./pdksBatches";
import * as annualFunctions from "./pdksAnnual";
import * as dashboardFunctions from "./dashboard";
import { convexTestClient } from "../src/test-utils/convexClient";
import { loadAnnualOvertime } from "../src/lib/pdksAnnual";
import { loadPdksTable, loadPdksPayroll, pdksBatchRefs, pdksMapConcurrent } from "../src/lib/pdksBatches";
import { DEFAULT_FLEXIBLE } from "./lib/pdksFlexible";

const modules = import.meta.glob("./**/*.ts");
const rawDeviceBody = JSON.stringify({ source: "card", padding: "x".repeat(1600) });
const punchTimes = [["05:00", "entry"], ["09:00", "exit"], ["10:00", "entry"], ["14:00", "exit"]] as const;
type PageState = { rows: Map<string, Record<string, unknown>[]> };
function proxyQuery<Q extends object>(query: Q, dates: readonly string[], state: PageState, bounds: { start?: string; end?: string } = {}): Q {
  const expand = (row: Record<string, unknown>) => {
    const result: Record<string, unknown>[] = [];
    for (const date of dates) {
      if (bounds.start && date < bounds.start.slice(0, 10) || bounds.end && date > bounds.end.slice(0, 10)) continue;
      for (const [time, direction] of punchTimes) {
        const accessTime = `${date}T${time}:00.000Z`;
        if (bounds.start && accessTime < bounds.start || bounds.end && accessTime > bounds.end) continue;
        result.push({ ...row, _id: `${String(row._id)}-${date}-${time}`, accessTime, direction, rawData: rawDeviceBody });
      }
    }
    return result;
  };
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
              // The stored row is an indexed badge template; apply time bounds only
              // after expanding it into actual per-month events.
              return trace(range);
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
  const loaderClient = convexTestClient(client);
  const tableArgs = { projectId: ids.projectId, startDate: "2026-06-01", endDate: "2026-06-30", viewMode: "matrix" as const };
  expect(await loadPdksTable(loaderClient, tableArgs)).toEqual(await client.query(api.cardReadings.getPdksTableData, tableArgs));
  const payrollArgs = { projectId: ids.projectId, year: 2026, month: 6 };
  expect(await loadPdksPayroll(loaderClient, payrollArgs)).toEqual(await client.query(api.cardReadings.getMonthlyPayrollSheet, payrollArgs));
  const filtered = { ...tableArgs, companyId: ids.companyId };
  expect(await loadPdksTable(loaderClient, filtered)).toEqual(await client.query(api.cardReadings.getPdksTableData, filtered));
  const filteredPayroll = { ...payrollArgs, companyId: ids.companyId };
  expect(await loadPdksPayroll(loaderClient, filteredPayroll)).toEqual(await client.query(api.cardReadings.getMonthlyPayrollSheet, filteredPayroll));
}, 30_000);

async function scaleFixture(count: number, annualYear = false) {
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
  const dates = annualYear ? Array.from({ length: 12 }, (_, m) => Array.from({ length: new Date(Date.UTC(2026, m + 1, 0)).getUTCDate() }, (_, i) => `2026-${String(m + 1).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`).filter(date => ![0, 6].includes(new Date(date).getUTCDay()))).flat() : Array.from({ length: 30 }, (_, i) => `2026-06-${String(i + 1).padStart(2, "0")}`).filter(date => ![0, 6].includes(new Date(date).getUTCDay()));
  const io: IoMeter = { bytes: 0, baselineBytes: 0, transactions: 0, current: 0, peak: 0 };
  const pageState: PageState = { rows: new Map() };
  // The real 500-person fixture's indexed badge is expanded before each transaction's
  // budget sees it; 44,000 readings with realistic 1.6 KB raw device bodies.
  const query = async (ref: FunctionReference<"query">, args: Record<string, unknown>) => {
    io.transactions++;
    io.current++; io.peak = Math.max(io.peak, io.current);
    const [module, name] = getFunctionName(ref).split(":");
    const functions = module === "pdksAnnual" ? annualFunctions : module === "dashboard" ? dashboardFunctions : batchFunctions;
    const registered = Reflect.get(functions, name) as unknown as { _handler: (ctx: QueryCtx, args: Record<string, unknown>) => Promise<unknown> };
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
it.each([500, 1000])("today at %i employees: bounded live group queries equal the full snapshot", async count => {
  vi.setSystemTime(new Date("2026-06-05T17:00:00Z"));
  try {
    const { client, ids } = await scaleFixture(count);
    const args = { projectId: ids.projectId, date: "2026-06-05", viewMode: "matrix" as const };
    const expected = await loadPdksTable(client, args);
    const roster = await client.query(pdksBatchRefs.todayRoster, { projectId: ids.projectId, date: "2026-06-05" });
    const available = new Set(await client.query(pdksBatchRefs.todayAvailability, { projectId: ids.projectId, date: "2026-06-05", roster }));
    const deviceAvailability = await client.query(pdksBatchRefs.todayDeviceAvailability, { projectId: ids.projectId });
    const groups = Array.from({ length: Math.ceil(roster.length / 64) }, (_, i) => roster.slice(i * 64, (i + 1) * 64).map(employee => employee.employeeId));
    const request = { kind: "table" as const, args };
    const discovery = await pdksMapConcurrent(groups, employeeIds => client.query(pdksBatchRefs.calculate, { request, roster, employeeIds, availabilityOnly: true }));
    discovery.forEach(result => result.availableDates.forEach(date => available.add(date)));
    const calculated = await pdksMapConcurrent(groups, employeeIds => client.query(pdksBatchRefs.calculate, { request, roster, employeeIds, availabilityOnly: false,
      deviceAvailability, availableDates: [...available].sort(), forceFlexible: discovery.some(result => result.hasFlexible) }));
    const actual = calculated.flatMap(result => result.kind === "table" ? result.rows : []).sort((a, b) => a.name.localeCompare(b.name, "tr"));
    expect(actual).toHaveLength(count);
    expect(actual).toEqual(expected);
  } finally { vi.useRealTimers(); }
}, 360_000);

it("post-rollout live groups equal snapshots with completed and overlapping pending gateway scans", async () => {
  vi.setSystemTime(new Date("2026-11-26T12:00:00Z"));
  const date = "2026-11-27";
  try {
    const t = convexTest(schema, modules);
    const ids = await t.run(async ctx => {
      const projectId = await ctx.db.insert("projects", { name: "Completeness equivalence" });
      const userId = await ctx.db.insert("users", { role: "super_admin", verified: true });
      const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 3 * 86400000 });
      const shiftId = await ctx.db.insert("shifts", { projectId, name: "Day", startTime: "08:00", endTime: "17:00", createdAt: "", updatedAt: "" });
      const complete = { projectId, brand: "hikvision" as const, hikTransport: "gateway" as const, isActive: true, createdAt: "", updatedAt: "", hikLastBackfillAt: Date.parse(`${date}T20:00:00Z`) };
      const deviceId = await ctx.db.insert("devices", { ...complete, name: "Complete" });
      const pendingId = await ctx.db.insert("devices", { ...complete, name: "Pending", hikBackfillPending: {
        devIndex: "pending", searchID: "scan", position: 0, maxPages: 10, startedAt: Date.parse(`${date}T08:00:00Z`), startTime: `${date}T05:00:00Z`,
      } });
      const employeeIds = [];
      for (let i = 0; i < 2; i++) {
        const employeeId = await ctx.db.insert("employees", { projectId, shiftId, firstName: `Person ${i}`, lastName: "Test", email: `${i}@complete.test`, cardNumber: String(i), isActive: true });
        employeeIds.push(employeeId);
        await ctx.db.insert("shiftAssignments", { projectId, employeeId, shiftId, startDate: "2026-11-01", endDate: "2026-11-30", createdAt: "", updatedAt: "" });
        for (const day of i === 0 ? ["2026-11-26", date] : ["2026-11-26"]) {
          for (const [time, direction] of [["05:00", "entry"], ["14:00", "exit"]] as const) await ctx.db.insert("cardReadings", { projectId, employeeId, deviceId, cardNo: String(i), accessTime: `${day}T${time}:00Z`, accessStatus: "izin_verildi", direction });
        }
      }
      return { projectId, userId, sessionId, pendingId, employeeIds };
    });
    vi.setSystemTime(new Date(`${date}T20:00:00Z`));
    const user = t.withIdentity({ subject: `${ids.userId}|${ids.sessionId}` });
    const client = convexTestClient(user);
    const args = { projectId: ids.projectId, date, viewMode: "matrix" as const };
    for (const pending of [true, false]) {
      if (!pending) await t.run(ctx => ctx.db.patch(ids.pendingId, { hikBackfillPending: undefined }));
      const expected = await loadPdksTable(client, args);
      const roster = await user.query(pdksBatchRefs.todayRoster, { projectId: ids.projectId, date });
      const deviceAvailability = await user.query(pdksBatchRefs.todayDeviceAvailability, { projectId: ids.projectId });
      expect(deviceAvailability.every(device => device.brand === "hikvision" && device.hikTransport === "gateway")).toBe(true);
      const request = { kind: "table" as const, args };
      const discovery = await Promise.all(roster.map(employee => user.query(pdksBatchRefs.calculate, { request, roster, employeeIds: [employee.employeeId], availabilityOnly: true })));
      const availableDates = [...new Set(discovery.flatMap(result => result.availableDates))];
      const live = await Promise.all(roster.map(employee => user.query(pdksBatchRefs.calculate, { request, roster, employeeIds: [employee.employeeId], availabilityOnly: false, deviceAvailability, availableDates })));
      const rows = live.flatMap(result => result.kind === "table" ? result.rows : []).sort((a, b) => a.name.localeCompare(b.name, "tr"));
      expect(rows).toEqual(expected);
      expect(rows.find(row => row.id === ids.employeeIds[1])?.days[0].status).toBe(pending ? "awaitingData" : "absent");
      expect(rows.find(row => row.id === ids.employeeIds[0])?.days[0].status).toBe("present");
    }
  } finally { vi.useRealTimers(); }
});

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
  await expect(user.query(pdksBatchRefs.todayDeviceAvailability, { projectId: ids.projectId })).rejects.toThrow("erişim");
  await expect(user.query(pdksBatchRefs.todayRoster, { projectId: ids.projectId, date: "2026-06-01" })).rejects.toThrow("erişim");
  await expect(user.query(pdksBatchRefs.todayAvailability, { projectId: ids.projectId, date: "2026-06-01", roster: [] })).rejects.toThrow("erişim");
  await expect(user.query(pdksBatchRefs.roster, { request, cursor: null })).rejects.toThrow("erişim");
  await expect(user.query(pdksBatchRefs.dates, { request, roster: [], cursor: null })).rejects.toThrow("erişim");
  await expect(user.query(pdksBatchRefs.calculate, { request, roster: [], employeeIds: [], availabilityOnly: true })).rejects.toThrow("erişim");
  await expect(user.query(pdksBatchRefs.closed, { args: { projectId: ids.projectId, year: 2026, month: 6 }, cursor: null })).rejects.toThrow("erişim");
});

it("500 annual employees, a full year of realistic device bodies: no more than 120 bounded calls", async () => {
  const { client, ids, io } = await scaleFixture(500, true);
  const rows = await loadAnnualOvertime(client, { projectId: ids.projectId, year: 2026 });
  expect(rows).toHaveLength(500);
  expect(io.transactions).toBeLessThanOrEqual(120);
  expect(io.bytes).toBeGreaterThan(500 * 250 * 4 * 1600);
  expect(io.peak).toBe(4);
  writeFileSync("/tmp/ngsaccess-pdks-annual-calls.json", JSON.stringify({ employees: 500, transactions: io.transactions, peak: io.peak, bytes: io.bytes }));
}, 360_000);
