// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, expect, it, vi } from "vitest";
import rateLimiterTest from "@convex-dev/rate-limiter/test";
import { VIRTUAL_READER_TYPE } from "./lib/virtualReader";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import { withDashboardSummary, initializeDashboardCounts, readDashboardEvidence, decodeEvidence, dashboardShard, DASHBOARD_SHARDS } from "./lib/dashboardSummary";
import type { Doc, Id } from "./_generated/dataModel";
const modules = import.meta.glob("./**/*.ts");
afterEach(() => vi.useRealTimers());
async function fixture() {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-06-22T14:00:00Z"));
  const t = convexTest(schema, modules);
  const ids = await t.run(async raw => {
    const ctx = withDashboardSummary(raw);
    const projectId = await ctx.db.insert("projects", { name: "Dashboard" });
    const userId = await ctx.db.insert("users", { role: "super_admin", verified: true });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 86400000 });
    const shiftId = await ctx.db.insert("shifts", { projectId, name: "Day", startTime: "08:00", endTime: "17:00", createdAt: "", updatedAt: "" });
    const deviceId = await ctx.db.insert("devices", { projectId, name: "Door", deviceSerial: "SERIAL", brand: "hikvision", isActive: true, accessDirection: "entry", createdAt: "", updatedAt: "" });
    const employeeId = await ctx.db.insert("employees", { projectId, shiftId, firstName: "Ada", lastName: "Test", cardNumber: "1", email: "ada@test", isActive: true });
    await ctx.db.insert("shiftAssignments", { projectId, employeeId, shiftId, startDate: "2026-01-01", endDate: "2026-12-31", createdAt: "", updatedAt: "" });
    await initializeDashboardCounts(ctx, projectId);
    return { projectId, userId, sessionId, employeeId, deviceId, shiftId };
  });
  const user = t.withIdentity({ subject: `${ids.userId}|${ids.sessionId}` });
  const add = (patch: Partial<Doc<"cardReadings">> = {}) => t.run(raw => withDashboardSummary(raw).db.insert("cardReadings", {
    projectId: ids.projectId, employeeId: ids.employeeId, deviceId: ids.deviceId, cardNo: "1", accessTime: "2026-06-22T05:00:00.000Z", accessStatus: "izin_verildi", direction: "entry", rawData: JSON.stringify({ source: "card" }), ...patch,
  }));
  const compare = async () => {
    const args = { projectId: ids.projectId };
    const optimized = await Promise.all([user.query(api.dashboard.getActivitySummary, args), user.query(api.dashboard.getTodayTimeline, args), user.query(api.dashboard.getStats, { ...args, includeTodayReadings: false }), user.query(api.dashboard.getStats, args)]);
    const saved = await t.run(async ctx => {
      const days = await ctx.db.query("dashboardDays").collect();
      for (const day of days) await ctx.db.patch(day._id, { complete: false });
      const counts = await ctx.db.query("dashboardCounts").collect();
      for (const count of counts) await ctx.db.delete(count._id);
      return { days, counts };
    });
    const legacy = await Promise.all([user.query(api.dashboard.getActivitySummary, args), user.query(api.dashboard.getTodayTimeline, args), user.query(api.dashboard.getStats, { ...args, includeTodayReadings: false }), user.query(api.dashboard.getStats, args)]);
    expect(optimized).toEqual(legacy);
    await t.run(async ctx => {
      for (const day of saved.days) await ctx.db.patch(day._id, { complete: day.complete });
      for (const { _id, _creationTime, ...count } of saved.counts) { void _id; void _creationTime; await ctx.db.insert("dashboardCounts", count); }
    });
    return optimized;
  };
  return { t, ids, user, add, compare };
}
it("preserves midnight, denied/unknown, out-of-order backfill, multiple devices and edits/deletes", async () => {
  const f = await fixture();
  await f.add({ accessTime: "2026-06-21T20:59:59.999Z" });
  await f.add({ accessTime: "2026-06-21T21:00:00.000Z", direction: "exit" });
  await f.add({ accessTime: "2026-06-22T13:00:00.000Z", direction: "exit" });
  const id = await f.add({ accessTime: "2026-06-22T06:00:00.000Z" });
  await f.add({ employeeId: undefined, cardNo: "unknown", accessStatus: "reddedildi", deviceId: undefined });
  await f.add({ accessStatus: undefined, direction: undefined });
  expect((await f.compare())[1].total).toBe(5);
  await f.t.run(raw => withDashboardSummary(raw).db.patch(id, { direction: "exit", accessTime: "2026-06-22T10:00:00.000Z" }));
  await f.compare();
  await f.t.run(raw => withDashboardSummary(raw).db.delete(id));
  await f.compare();
});
it("reflects leave, shift, inactive/deleted employee and moved employee without stale snapshots", async () => {
  const f = await fixture(); await f.add(); await f.compare();
  await f.t.run(async ctx => {
    await ctx.db.insert("leaves", { projectId: f.ids.projectId, employeeId: f.ids.employeeId, leaveType: "annual", startDate: "2026-06-22", endDate: "2026-06-22", status: "approved", createdAt: "", updatedAt: "" });
    await ctx.db.patch(f.ids.shiftId, { startTime: "06:00" });
  });
  await f.compare();
  await f.t.run(raw => withDashboardSummary(raw).db.patch(f.ids.employeeId, { isActive: false })); await f.compare();
  await f.t.run(raw => withDashboardSummary(raw).db.delete(f.ids.employeeId)); await f.compare();
});
it("never switches a pre-release day to a partial summary", async () => {
  const f = await fixture();
  await f.t.run(ctx => ctx.db.insert("cardReadings", { projectId: f.ids.projectId, cardNo: "old", accessTime: "2026-06-22T01:00:00.000Z" }));
  await f.add();
  expect(await f.t.run(ctx => readDashboardEvidence(ctx, f.ids.projectId, "2026-06-22"))).toBeNull();
  await f.compare();
});
it("live Hik duplicates and backfill duplicates do not increment counters", async () => {
  const f = await fixture();
  const live = { deviceSerial: "SERIAL", cardNo: "1", authedDeviceId: f.ids.deviceId, hikSerialNo: 7, hikDateTime: "2026-06-22T14:00:00Z", hikMajorEventType: 5, hikSubEventType: 1 };
  await f.t.mutation(internal.cardReadings.processCardReading, live);
  await f.t.mutation(internal.cardReadings.processCardReading, live);
  expect((await f.compare())[1].total).toBe(1);
  const backfill = { deviceId: f.ids.deviceId, event: { serialNo: 8, time: "2026-06-22T12:00:00+03:00", major: 5, minor: 1, cardNo: "1" } };
  await f.t.mutation(internal.cardReadings.backfillHikEventRow, backfill);
  await f.t.mutation(internal.cardReadings.backfillHikEventRow, backfill);
  expect((await f.compare())[1].total).toBe(2);
});
it("counts project moves and active devices and keeps recent payload free of device secrets", async () => {
  const f = await fixture(); await f.add();
  await f.t.run(async raw => {
    const ctx = withDashboardSummary(raw);
    const other = await ctx.db.insert("projects", { name: "Other" });
    await ctx.db.patch(f.ids.employeeId, { projectId: other });
    await ctx.db.patch(f.ids.deviceId, { isActive: false, lastSeen: "now" });
  });
  await f.compare();
  const recent = await f.user.query(api.dashboard.getRecentReadings, { projectId: f.ids.projectId });
  expect(recent[0]).not.toHaveProperty("rawData"); expect(recent[0]?.devices?.name).toBe("Door");
});

it.each(["other", "ide_smart"] as const)("%s writer preserves the original dashboard with repeated events", async brand => {
  const f = await fixture();
  await f.t.run(raw => withDashboardSummary(raw).db.patch(f.ids.deviceId, { brand }));
  const input = { cardNo: "1", deviceSerial: "SERIAL", authedDeviceId: f.ids.deviceId,
    ideIoId: 0, ideResult: 1, ideTime: "2026-06-22 12:00:00" };
  await f.t.mutation(internal.cardReadings.processCardReading, input);
  await f.compare();
  await f.t.mutation(internal.cardReadings.processCardReading, input);
  expect((await f.compare())[1].total).toBe(brand === "ide_smart" ? 1 : 2);
});
it("rolls back reading, hourly totals and evidence together on failure", async () => {
  const f = await fixture();
  await expect(f.t.run(async raw => {
    await withDashboardSummary(raw).db.insert("cardReadings", { projectId: f.ids.projectId, cardNo: "rollback", accessTime: "2026-06-22T14:00:00.000Z" });
    throw new Error("rollback");
  })).rejects.toThrow("rollback");
  expect(await f.t.run(ctx => ctx.db.query("dashboardDays").collect())).toEqual([]);
  expect(await f.t.run(ctx => ctx.db.query("cardReadings").collect())).toEqual([]);
});

it("the projected feed matches legacy order including identical timestamps, backfills and edits", async () => {
  const f = await fixture();
  const ids: Id<"cardReadings">[] = [];
  for (let i = 0; i < 15; i++) ids.push(await f.add({ employeeName: `Person ${i}` }));
  await f.t.run(raw => withDashboardSummary(raw).db.patch(ids[0], { employeeName: "Renamed" }));
  const args = { projectId: f.ids.projectId, limit: 10 };
  const optimized = await f.user.query(api.dashboard.getRecentReadings, args);
  await f.t.run(async ctx => { for (const day of await ctx.db.query("dashboardDays").collect()) await ctx.db.patch(day._id, { complete: false }); });
  expect(optimized).toEqual(await f.user.query(api.dashboard.getRecentReadings, args));
});

it("the seed writer and its idempotent retry preserve dashboard equality", async () => {
  const f = await fixture();
  await f.t.mutation(internal.seedCardReaderTest.run, {});
  expect((await f.compare())[1].total).toBe(2);
  await f.t.mutation(internal.seedCardReaderTest.run, {});
  expect((await f.compare())[1].total).toBe(2);
});
it("visitor QR/PIN success and denial writers preserve dashboard equality", async () => {
  const f = await fixture(); rateLimiterTest.register(f.t);
  const readerToken = crypto.randomUUID();
  await f.t.run(async raw => {
    const ctx = withDashboardSummary(raw);
    await ctx.db.patch(f.ids.employeeId, { isVisitor: true, visitorCredential: "pass", accessStartsAt: "2026-06-22T01:00:00Z", accessExpiresAt: "2026-06-22T20:00:00Z" });
    await ctx.db.patch(f.ids.deviceId, { brand: "other", deviceType: VIRTUAL_READER_TYPE, apiToken: readerToken });
  });
  const pass = await f.user.mutation(api.visitorPasses.issue, { visitorId: f.ids.employeeId });
  await f.t.mutation(api.virtualReaders.scan, { readerToken, code: pass.token }); await f.compare();
  await f.t.mutation(api.virtualReaders.scanPin, { readerToken, pin: pass.pin }); await f.compare();
  await f.t.mutation(api.virtualReaders.scan, { readerToken, code: "NGSV1.invalidinvalidinvalid1" }); await f.compare();
});
it("one-use employee reader token keeps its original projection on replay", async () => {
  const f = await fixture(); const token = crypto.randomUUID();
  await f.t.run(async ctx => {
    await ctx.db.patch(f.ids.deviceId, { brand: "other", deviceType: VIRTUAL_READER_TYPE });
    await ctx.db.insert("employeeAuth", { employeeId: f.ids.employeeId, passwordHash: "hash", passwordVersion: 1, createdAt: "", updatedAt: "" });
    const sessionId = await ctx.db.insert("employeeSessions", { employeeId: f.ids.employeeId, token: "session", passwordVersion: 1, expiresAt: "2030-01-01T00:00:00Z", createdAt: "" });
    const groupId = await ctx.db.insert("accessRules", { projectId: f.ids.projectId, name: "All", isActive: true, startTime: "00:00", endTime: "23:59" });
    await ctx.db.insert("groupMembers", { projectId: f.ids.projectId, groupId, employeeId: f.ids.employeeId, createdAt: "" });
    await ctx.db.insert("groupDevices", { projectId: f.ids.projectId, groupId, deviceId: f.ids.deviceId, createdAt: "" });
    await ctx.db.insert("checkInTokens", { employeeId: f.ids.employeeId, projectId: f.ids.projectId, sessionId, token, purpose: "reader", authVersion: 1, expiresAt: "2030-01-01T00:00:00Z", createdAt: "" });
  });
  const input = { cardNo: token, deviceSerial: "SERIAL", authedDeviceId: f.ids.deviceId };
  expect(await f.t.mutation(internal.cardReadings.processCardReading, input)).toEqual({ granted: true });
  await f.compare();
  await f.t.mutation(internal.cardReadings.processCardReading, input);
  expect((await f.compare())[1].total).toBe(1);
});

it("separate device labels stay tenant scoped", async () => {
  const f = await fixture();
  const other = await f.t.run(ctx => ctx.db.insert("projects", { name: "Other" }));
  expect(await f.user.query(api.dashboard.getReadingDevices, { projectId: other, deviceIds: [f.ids.deviceId] })).toEqual([null]);
});
it("distinct devices and generic grant/denial branches preserve dashboard equality", async () => {
  const f = await fixture();
  const second = await f.t.run(raw => withDashboardSummary(raw).db.insert("devices", { projectId: f.ids.projectId, name: "Exit", brand: "other", isActive: true, createdAt: "", updatedAt: "" }));
  await f.add({ deviceId: second, direction: "exit" }); await f.compare();
  await f.t.run(async raw => {
    const ctx = withDashboardSummary(raw);
    await ctx.db.patch(f.ids.deviceId, { brand: "other" });
    const groupId = await ctx.db.insert("accessRules", { projectId: f.ids.projectId, name: "All", isActive: true, startTime: "00:00", endTime: "23:59" });
    await ctx.db.insert("groupMembers", { projectId: f.ids.projectId, groupId, employeeId: f.ids.employeeId, createdAt: "" });
    await ctx.db.insert("groupDevices", { projectId: f.ids.projectId, groupId, deviceId: f.ids.deviceId, createdAt: "" });
  });
  const input = { deviceSerial: "SERIAL", authedDeviceId: f.ids.deviceId };
  expect(await f.t.mutation(internal.cardReadings.processCardReading, { ...input, cardNo: "1" })).toEqual({ granted: true }); await f.compare();
  expect(await f.t.mutation(internal.cardReadings.processCardReading, { ...input, cardNo: "unknown" })).toEqual({ granted: false }); await f.compare();
  await f.t.run(raw => withDashboardSummary(raw).db.patch(f.ids.employeeId, { isActive: false }));
  await f.t.mutation(internal.cardReadings.processCardReading, { ...input, cardNo: "1" }); await f.compare();
});

it.each([true, false])("real employee deletion scrubs all 251 projections through scheduled continuations (complete=%s)", async complete => {
  const f = await fixture();
  await f.t.run(async raw => {
    const ctx = withDashboardSummary(raw);
    for (let i = 0; i < 251; i++) await ctx.db.insert("cardReadings", { projectId: f.ids.projectId, employeeId: f.ids.employeeId, deviceId: f.ids.deviceId,
      cardNo: "SECRET-CARD-PII", employeeName: "Private Person", accessTime: "2026-06-22T05:00:00.000Z", accessStatus: "izin_verildi" });
    if (!complete) for (const day of await ctx.db.query("dashboardDays").collect()) await ctx.db.patch(day._id, { complete: false });
  });
  await f.user.mutation(api.employees.remove, { employeeId: f.ids.employeeId });
  await f.t.finishAllScheduledFunctions(() => vi.runAllTimers());
  await f.t.run(async ctx => {
    expect(await ctx.db.get(f.ids.employeeId)).toBeNull();
    const feed = await ctx.db.query("dashboardReadingFeed").collect();
    expect(feed).toHaveLength(251);
    expect(feed.every(row => row.employeeName === "[silindi]" && row.cardNo.startsWith("anon-"))).toBe(true);
    const evidence = (await ctx.db.query("dashboardEvidence").collect()).flatMap(page => decodeEvidence(page.payload, page.projectId));
    expect(evidence.every(row => row.cardNo !== "SECRET-CARD-PII")).toBe(true);
    expect(JSON.stringify(feed)).not.toContain("Private Person");
    expect(JSON.stringify(evidence)).not.toContain("SECRET-CARD-PII");
  });
});
it("scheduled card retention removes the corresponding feed and encoded evidence", async () => {
  const f = await fixture();
  await f.add({ accessTime: "2020-01-01T05:00:00.000Z", employeeName: "Retained Secret", cardNo: "RETENTION-CARD" });
  await f.t.run(ctx => ctx.db.insert("projectPrivacySettings", { projectId: f.ids.projectId, cardReadingRetentionDays: 1825, updatedAt: "" }));
  await f.t.mutation(internal.privacyRetention.purgeExpiredCardReadings, {});
  await f.t.finishAllScheduledFunctions(() => vi.runAllTimers());
  await f.t.run(async ctx => {
    expect(await ctx.db.query("cardReadings").collect()).toEqual([]);
    expect(await ctx.db.query("dashboardReadingFeed").collect()).toEqual([]);
    expect(await ctx.db.query("dashboardEvidence").collect()).toEqual([]);
  });
});
it("legacy summary pages are scrubbed when privacy anonymization runs after a summary upgrade", async () => {
  const f = await fixture(); await f.add({ cardNo: "LEGACY-PII", employeeName: "Old Secret" });
  await f.t.run(async ctx => {
    for (const day of await ctx.db.query("dashboardDays").collect()) await ctx.db.patch(day._id, { formatVersion: undefined });
    for (const page of await ctx.db.query("dashboardEvidence").collect()) await ctx.db.patch(page._id, { shard: undefined });
  });
  await f.t.mutation(internal.lib.employeeCascade.anonymizeReadings, { employeeId: f.ids.employeeId, cursor: null });
  await f.t.run(async ctx => {
    const feed = await ctx.db.query("dashboardReadingFeed").collect();
    expect(feed[0]).toMatchObject({ employeeName: "[silindi]" });
    expect(feed[0]?.cardNo).not.toBe("LEGACY-PII");
    expect(await ctx.db.query("dashboardEvidence").collect()).toEqual([]);
  });
});
it("overflow is remembered: a >1000-person project scans once and later writes stay constant cost", async () => {
  const f = await fixture();
  await f.t.run(async ctx => {
    for (const row of await ctx.db.query("dashboardCounts").collect()) if (row.kind === "employees") await ctx.db.delete(row._id);
    for (let i = 0; i < 1000; i++) await ctx.db.insert("employees", { projectId: f.ids.projectId, firstName: "Large", lastName: String(i), email: "", cardNumber: String(i) });
  });
  let employeeScans = 0;
  await f.t.run(async raw => {
    const db = new Proxy(raw.db, { get(target, key) {
      if (key === "query") return (table: Parameters<typeof raw.db.query>[0]) => { if (table === "employees") employeeScans++; return target.query(table); };
      const value = Reflect.get(target, key); return typeof value === "function" ? value.bind(target) : value;
    } });
    const ctx = withDashboardSummary({ ...raw, db });
    await initializeDashboardCounts(ctx, f.ids.projectId);
    for (let i = 0; i < 5; i++) await ctx.db.insert("employees", { projectId: f.ids.projectId, firstName: "New", lastName: String(i), email: "", cardNumber: "" });
    expect(employeeScans).toBe(1);
    expect((await ctx.db.query("dashboardCounts").withIndex("by_projectId_and_kind", q => q.eq("projectId", f.ids.projectId).eq("kind", "employees")).unique())?.count).toBe(-1);
  });
  expect((await f.user.query(api.dashboard.getStats, { projectId: f.ids.projectId, includeTodayReadings: false })).employees).toBe(1006);
});
it("same-hour writes distribute across all eight device shards and sum to the legacy result", async () => {
  const f = await fixture();
  const devices = await f.t.run(async raw => {
    const ctx = withDashboardSummary(raw); const ids = [];
    for (let i = 0; i < 100; i++) ids.push(await ctx.db.insert("devices", { projectId: f.ids.projectId, name: `Device ${i}`, isActive: true, createdAt: "", updatedAt: "" }));
    return ids;
  });
  await Promise.all(devices.map(deviceId => f.add({ deviceId })));
  await f.compare();
  await f.t.run(async ctx => {
    const hours = await ctx.db.query("dashboardHours").collect();
    expect(new Set(devices.map(id => dashboardShard(id, ""))).size).toBe(DASHBOARD_SHARDS);
    expect(new Set(hours.map(row => row.shard)).size).toBe(DASHBOARD_SHARDS);
    expect(hours.reduce((total, hour) => total + hour.total, 0)).toBe(100);
    expect(new Set((await ctx.db.query("dashboardEvidence").collect()).map(row => row.shard)).size).toBe(DASHBOARD_SHARDS);
  });
});
it("old web requests receive device names while the new bundle explicitly requests the slim path", async () => {
  const f = await fixture(); for (let i = 0; i < 10; i++) await f.add();
  expect((await f.user.query(api.dashboard.getRecentReadings, { projectId: f.ids.projectId }))[0]?.devices).toEqual({ name: "Door", deviceSerial: "SERIAL" });
  const slim = await f.user.query(api.dashboard.getRecentReadings, { projectId: f.ids.projectId, includeDevices: false });
  expect(slim.every(row => row.devices === null)).toBe(true);
});

it("pre-shard evidence binary fixtures stay readable for privacy cleanup", () => {
  const payload = Uint8Array.from(atob("CAJpZANlbXAGZGV2aWNlBlNFQ1JFVBgyMDI2LTA2LTIyVDA1OjAwOjAwLjAwMFoMaXppbl92ZXJpbGRpBWVudHJ5BGNhcmQCQF7AAAAAAAAAAAAAAAAAAAEBAgMEBQYHCAECAA=="), char => char.charCodeAt(0)).buffer;
  expect(decodeEvidence(payload)).toEqual([{ _id: "id", _creationTime: 123, employeeId: "emp", deviceId: "device", projectId: undefined, cardNo: "SECRET", accessTime: "2026-06-22T05:00:00.000Z", accessStatus: "izin_verildi", direction: "entry", pdksSource: "card", ideIoId: 0, hikCardReaderNo: undefined }]);
});

it("manual reset recovers permanent negative counters without touching another project", async () => {
  const f = await fixture();
  const otherId = await f.t.run(async ctx => {
    for (const row of await ctx.db.query("dashboardCounts").collect()) await ctx.db.patch(row._id, { count: -1 });
    const projectId = await ctx.db.insert("projects", { name: "Other" });
    return await ctx.db.insert("dashboardCounts", { projectId, kind: "employees", count: -1 });
  });
  // Lazy initialization deliberately leaves the -1 fallback permanent until reset.
  await f.t.run(async ctx => {
    await initializeDashboardCounts(ctx, f.ids.projectId);
    expect((await ctx.db.query("dashboardCounts").withIndex("by_projectId_and_kind", q => q.eq("projectId", f.ids.projectId).eq("kind", "employees")).unique())?.count).toBe(-1);
  });
  await f.t.mutation(internal.dataMigrations.resetDashboardCounts, { projectId: f.ids.projectId });
  await f.t.run(async ctx => {
    const rows = await ctx.db.query("dashboardCounts").withIndex("by_projectId_and_kind", q => q.eq("projectId", f.ids.projectId)).collect();
    expect(Object.fromEntries(rows.map(row => [row.kind, row.count]))).toEqual({ employees: 1, devices: 1, accessRules: 0 });
    expect((await ctx.db.get(otherId))?.count).toBe(-1);
  });
});
