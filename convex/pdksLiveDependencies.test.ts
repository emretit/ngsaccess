// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import { getFunctionName, type FunctionArgs, type FunctionReference, type FunctionReturnType } from "convex/server";
import schema from "./schema";
import * as batches from "./pdksBatches";
import { pdksBatchRefs } from "../src/lib/pdksBatches";
import type { QueryCtx } from "./_generated/server";

type Range = { table: string; equal: Record<string, unknown>; minimum: Record<string, string>; maximum: Record<string, string> };
type Reads = { ranges: Range[]; gets: Set<string> };
const emptyReads = (): Reads => ({ ranges: [], gets: new Set() });
const matches = (range: Range, table: string, row: object) => range.table === table
  && Object.entries(range.equal).every(([field, value]) => Reflect.get(row, field) === value)
  && Object.entries(range.minimum).every(([field, value]) => Reflect.get(row, field) >= value)
  && Object.entries(range.maximum).every(([field, value]) => Reflect.get(row, field) <= value);
function trackedDb(ctx: QueryCtx, reads: Reads): QueryCtx["db"] {
  return new Proxy(ctx.db, { get(target, key) {
    if (key === "get") return (...args: unknown[]) => {
      reads.gets.add(String(args[args.length - 1]));
      return Reflect.apply(target.get, target, args);
    };
    if (key === "query") return (table: string) => trace(Reflect.apply(target.query, target, [table]) as object, reads.ranges,
      { table, equal: {}, minimum: {}, maximum: {} });
    const value: unknown = Reflect.get(target, key);
    return typeof value === "function" ? value.bind(target) : value;
  } });
}
// convex-test has no reactive subscriptions. Record the real query index ranges,
// then match actual writes against them, rather than mock useQueries results.
function trace<Q extends object>(target: Q, ranges: Range[], range: Range): Q {
  return new Proxy(target, { get(object, key) {
    const value: unknown = Reflect.get(object, key);
    if (key === "withIndex") return (name: string, callback?: (q: object) => object) => {
      const next = { table: range.table, equal: { ...range.equal }, minimum: { ...range.minimum }, maximum: { ...range.maximum } };
      const tracedCallback = callback ? (builder: object) => {
        const wrap = (q: object): object => new Proxy(q, { get(inner, method) {
          const fn: unknown = Reflect.get(inner, method);
          if (typeof fn !== "function") return fn;
          return (...args: unknown[]) => {
            if (method === "eq" && typeof args[0] === "string") next.equal[args[0]] = args[1];
            if (method === "gte" && typeof args[0] === "string" && typeof args[1] === "string") next.minimum[args[0]] = args[1];
            if (method === "lte" && typeof args[0] === "string" && typeof args[1] === "string") next.maximum[args[0]] = args[1];
            return wrap(Reflect.apply(fn, inner, args) as object);
          };
        } });
        return callback(wrap(builder));
      } : undefined;
      const result = Reflect.apply(value as (...args: unknown[]) => object, object, [name, tracedCallback]);
      ranges.push(next);
      return trace(result, ranges, next);
    };
    return typeof value === "function" ? value.bind(object) : value;
  } });
}

it.each([500, 1000])("%i staff: device patch touches zero calculation groups, badge touches only its group", async count => {
  const t = convexTest(schema, import.meta.glob("./**/*.ts"));
  const date = "2026-11-27";
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "Live dependency acceptance" });
    const userId = await ctx.db.insert("users", { role: "super_admin", verified: true });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 86400000 });
    const deviceId = await ctx.db.insert("devices", { projectId, name: "Gateway", createdAt: "2026-11-01", updatedAt: "2026-11-01", brand: "hikvision", hikTransport: "gateway", isActive: true });
    const formerEmployee = await ctx.db.insert("employees", { projectId, firstName: "Former", lastName: "Worker", email: "former@local.test", cardNumber: "former", isActive: false, employmentEndDate: "2026-11-26" });
    await ctx.db.insert("cardReadings", { projectId, employeeId: formerEmployee, cardNo: "former", accessTime: "2026-11-26T08:00:00Z", accessStatus: "izin_verildi", direction: "entry" });
    const roster = [];
    for (let i = 0; i < count; i++) {
      const employeeId = await ctx.db.insert("employees", { projectId, firstName: String(i), lastName: "Test", email: `${i}@local.test`, cardNumber: String(i), isActive: true });
      roster.push({ employeeId, cardNumber: String(i) });
      if (i % 64 === 0) await ctx.db.insert("cardReadings", { projectId, deviceId, employeeId, cardNo: String(i), accessTime: `${date}T07:00:00Z`, accessStatus: "izin_verildi", direction: "entry" });
    }
    return { projectId, userId, sessionId, deviceId, roster };
  });
  const user = t.withIdentity({ subject: `${ids.userId}|${ids.sessionId}` });
  async function record<Q extends FunctionReference<"query">>(ref: Q, args: FunctionArgs<Q>) {
    const reads = emptyReads();
    const registered = Reflect.get(batches, getFunctionName(ref).split(":")[1]) as unknown as { _handler: (ctx: QueryCtx, args: FunctionArgs<Q>) => Promise<FunctionReturnType<Q>> };
    const value = await user.run(ctx => registered._handler({ ...ctx, db: trackedDb(ctx, reads) }, args));
    return { reads, value };
  }
  const devices = await user.query(pdksBatchRefs.todayDeviceAvailability, { projectId: ids.projectId });
  const groups = Array.from({ length: Math.ceil(count / 64) }, (_, i) => ids.roster.slice(i * 64, (i + 1) * 64));
  const dependencies: Reads[] = [], discoveryDependencies: Reads[] = [];
  for (const group of groups) {
    const args: FunctionArgs<typeof pdksBatchRefs.calculate> = { request: { kind: "table", args: { projectId: ids.projectId, date } }, roster: ids.roster,
      employeeIds: group.map(employee => employee.employeeId), availabilityOnly: false, availableDates: [date], deviceAvailability: devices };
    dependencies.push((await record(pdksBatchRefs.calculate, args)).reads);
    discoveryDependencies.push((await record(pdksBatchRefs.calculate, { ...args, availabilityOnly: true })).reads);
  }
  const availability = await record(pdksBatchRefs.todayAvailability, { projectId: ids.projectId, date, roster: ids.roster });
  const roster = await record(pdksBatchRefs.todayRoster, { projectId: ids.projectId, date });
  expect(availability.value).toEqual([]);
  // Negative controls demonstrate that both range reads and direct gets are visible.
  const fallback = await record(pdksBatchRefs.calculate, { request: { kind: "table", args: { projectId: ids.projectId, date } }, roster: ids.roster,
    employeeIds: [ids.roster[0].employeeId], availabilityOnly: false, availableDates: [date] });
  expect(fallback.reads.ranges.some(range => range.table === "devices")).toBe(true);
  const direct = emptyReads();
  await user.run(ctx => trackedDb(ctx, direct).get(ids.deviceId));
  expect(direct.gets.has(ids.deviceId)).toBe(true);
  await t.run(ctx => ctx.db.patch(ids.deviceId, { lastSeen: "now", hikLastSerialNo: 42 }));
  expect(await user.query(pdksBatchRefs.todayDeviceAvailability, { projectId: ids.projectId })).toEqual(devices);
  const deviceDependent = (reads: Reads) => reads.gets.has(ids.deviceId) || reads.ranges.some(range => range.table === "devices");
  expect([...dependencies, ...discoveryDependencies, availability.reads, roster.reads].filter(deviceDependent)).toHaveLength(0);
  const owner = ids.roster[70];
  const reading = { projectId: ids.projectId, deviceId: ids.deviceId, employeeId: owner.employeeId, cardNo: owner.cardNumber, accessTime: `${date}T08:00:00Z`, accessStatus: "izin_verildi" as const, direction: "entry" as const };
  const readingId = await t.run(ctx => ctx.db.insert("cardReadings", reading));
  const dependsOnReading = (reads: Reads) => reads.gets.has(readingId) || reads.ranges.some(range => matches(range, "cardReadings", reading));
  expect(dependencies.flatMap((reads, index) => dependsOnReading(reads) ? [index] : [])).toEqual([1]);
  expect(discoveryDependencies.flatMap((reads, index) => dependsOnReading(reads) ? [index] : [])).toEqual([1]);
  expect(dependsOnReading(availability.reads)).toBe(false);
  expect(dependsOnReading(roster.reads)).toBe(false);
  expect(availability.reads.ranges.filter(range => range.table === "cardReadings").every(range => !ids.roster.some(employee => employee.employeeId === range.equal.employeeId))).toBe(true);
  expect(availability.reads.ranges.some(range => range.table === "cardReadings" && range.equal.employeeId !== undefined)).toBe(true);
  await t.run(ctx => ctx.db.patch(ids.deviceId, { hikLastBackfillAt: Date.parse(`${date}T20:00:00Z`) }));
  expect(await user.query(pdksBatchRefs.todayDeviceAvailability, { projectId: ids.projectId })).not.toEqual(devices);
  await expect(user.query(pdksBatchRefs.calculate, { request: { kind: "table", args: { projectId: ids.projectId, date } }, roster: ids.roster, employeeIds: [owner.employeeId], availabilityOnly: false,
    deviceAvailability: [{ ...devices[0], projectId: undefined }] })).rejects.toThrow("Cihaz seçili projeye ait değil");
}, 60_000);

it("the selected date changes roster and unknown availability across midnight", async () => {
  const t = convexTest(schema, import.meta.glob("./**/*.ts"));
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "Midnight" });
    const userId = await ctx.db.insert("users", { role: "super_admin", verified: true });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 86400000 });
    await ctx.db.insert("employees", { projectId, firstName: "Last", lastName: "Day", email: "last@local.test", cardNumber: "old", isActive: false, employmentEndDate: "2026-11-26" });
    await ctx.db.insert("cardReadings", { projectId, cardNo: "unknown", accessTime: "2026-11-26T12:00:00Z", accessStatus: "izin_verildi", direction: "entry" });
    return { projectId, userId, sessionId };
  });
  const user = t.withIdentity({ subject: `${ids.userId}|${ids.sessionId}` });
  expect(await user.query(pdksBatchRefs.todayRoster, { projectId: ids.projectId, date: "2026-11-26" })).toHaveLength(1);
  expect(await user.query(pdksBatchRefs.todayRoster, { projectId: ids.projectId, date: "2026-11-27" })).toHaveLength(0);
  expect(await user.query(pdksBatchRefs.todayAvailability, { projectId: ids.projectId, date: "2026-11-26", roster: [] })).toEqual(["2026-11-26"]);
  expect(await user.query(pdksBatchRefs.todayAvailability, { projectId: ids.projectId, date: "2026-11-27", roster: [] })).toEqual([]);
});
