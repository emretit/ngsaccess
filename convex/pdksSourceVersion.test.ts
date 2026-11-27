// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { trTodayKey } from "./lib/trDate";
import { expect, it } from "vitest";
import schema from "./schema";
import { pdksBatchRefs } from "../src/lib/pdksBatches";
import { DEFAULT_OVERTIME_RATES } from "./lib/pdksHelpers";
import { makeFunctionReference } from "convex/server";

it("daily → weekly settings changes reject the old source instead of silently dropping Monday–Thursday", async () => {
  const t = convexTest(schema, import.meta.glob("./**/*.ts"));
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "Versioned source" });
    const userId = await ctx.db.insert("users", { role: "super_admin", verified: true });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 86400000 });
    const employeeId = await ctx.db.insert("employees", { projectId, firstName: "A", lastName: "B", email: "a@b.local", cardNumber: "1", isActive: true });
    const rateId = await ctx.db.insert("overtimeRates", { ...DEFAULT_OVERTIME_RATES, projectId, overtimeBasis: "dailyShift", updatedAt: "v1" });
    return { projectId, userId, sessionId, employeeId, rateId };
  });
  const user = t.withIdentity({ subject: `${ids.userId}|${ids.sessionId}` });
  const request = { kind: "table" as const, args: { projectId: ids.projectId, date: "2026-06-05" } };
  const roster = [{ employeeId: ids.employeeId, cardNumber: "1" }];
  const version = await user.query(pdksBatchRefs.version, { projectId: ids.projectId });
  const source = await user.query(pdksBatchRefs.dates, { request, roster, cursor: null });
  await t.run(ctx => ctx.db.patch(ids.rateId, { overtimeBasis: "weekly45", updatedAt: "v2" }));
  expect(await user.query(pdksBatchRefs.version, { projectId: ids.projectId })).not.toBe(version);
  await expect(user.query(pdksBatchRefs.calculate, { request, roster, employeeIds: [ids.employeeId], readings: source.readings,
    readingStartISO: source.startISO, readingEndISO: source.endISO, sourceVersion: version, availabilityOnly: true })).rejects.toMatchObject({ data: { code: "PDKS_SOURCE_STALE" } });
  const fresh = await user.query(pdksBatchRefs.dates, { request, roster, cursor: null });
  const nextVersion = await user.query(pdksBatchRefs.version, { projectId: ids.projectId });
  await expect(user.query(pdksBatchRefs.calculate, { request, roster, employeeIds: [ids.employeeId], readings: fresh.readings,
    readingStartISO: fresh.startISO, readingEndISO: fresh.endISO, sourceVersion: nextVersion, availabilityOnly: true })).resolves.toBeDefined();
  // Deletion between roster discovery and calculation removes one row, not the entire report.
  await t.run(ctx => ctx.db.delete(ids.employeeId));
  await expect(user.query(pdksBatchRefs.calculate, { request, roster, employeeIds: [ids.employeeId], readings: [],
    readingStartISO: fresh.startISO, readingEndISO: fresh.endISO, sourceVersion: nextVersion, availabilityOnly: true })).resolves.toMatchObject({ rows: [] });
});

it("unknown badge availability changes for insert/delete, while same-day edits keep its shared value stable", async () => {
  const t = convexTest(schema, import.meta.glob("./**/*.ts"));
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "Live today" });
    const userId = await ctx.db.insert("users", { role: "super_admin", verified: true });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 86400000 });
    return { projectId, userId, sessionId };
  });
  const user = t.withIdentity({ subject: `${ids.userId}|${ids.sessionId}` });
  const ref = makeFunctionReference<"query", { projectId: typeof ids.projectId; roster: []; date: string }, string[]>("pdksBatches:todayAvailability");
  const empty = await user.query(ref, { projectId: ids.projectId, roster: [], date: trTodayKey() });
  const readingId = await t.run(ctx => ctx.db.insert("cardReadings", { projectId: ids.projectId, cardNo: "1", accessTime: new Date().toISOString(), accessStatus: "izin_verildi", direction: "entry" }));
  const inserted = await user.query(ref, { projectId: ids.projectId, roster: [], date: trTodayKey() });
  expect(inserted).not.toEqual(empty);
  await t.run(ctx => ctx.db.patch(readingId, { direction: "exit" }));
  const edited = await user.query(ref, { projectId: ids.projectId, roster: [], date: trTodayKey() });
  expect(edited).toEqual(inserted);
  await t.run(ctx => ctx.db.delete(readingId));
  expect(await user.query(ref, { projectId: ids.projectId, roster: [], date: trTodayKey() })).toEqual(empty);
});

it.each([500, 1000])("today's live range at %i employees stays below 15 MiB without week/history reads", async count => {
  const { getConvexSize } = await import("convex/values");
  const t = convexTest(schema, import.meta.glob("./**/*.ts"));
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "Live scale" });
    const userId = await ctx.db.insert("users", { role: "super_admin", verified: true });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 86400000 });
    let bytes = 0;
    for (let i = 0; i < count; i++) {
      const employeeId = await ctx.db.insert("employees", { projectId, firstName: String(i), lastName: "Test", email: `${i}@test.local`, cardNumber: String(i), isActive: true });
      for (let punch = 0; punch < 4; punch++) {
        const id = await ctx.db.insert("cardReadings", { projectId, employeeId, cardNo: String(i), accessTime: new Date().toISOString(), accessStatus: "izin_verildi", direction: punch % 2 === 0 ? "entry" : "exit", rawData: JSON.stringify({ source: "card", padding: "x".repeat(1600) }) });
        bytes += getConvexSize(await ctx.db.get(id));
      }
    }
    return { projectId, userId, sessionId, bytes };
  });
  const user = t.withIdentity({ subject: `${ids.userId}|${ids.sessionId}` });
  const ref = makeFunctionReference<"query", { projectId: typeof ids.projectId; roster: []; date: string }, string[]>("pdksBatches:todayAvailability");
  expect(await user.query(ref, { projectId: ids.projectId, roster: [], date: trTodayKey() })).toHaveLength(1);
  expect(ids.bytes).toBeLessThan(15 * 1024 * 1024);
}, 30_000);
