// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, expect, it, vi } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";
import { initialDestructionState } from "./lib/biometricDestruction";
afterEach(() => vi.unstubAllEnvs());
const confirmHost = "site.example";
function unlockTarget() { vi.stubEnv("SELF_HOST_TARGET", "1"); vi.stubEnv("CONVEX_SITE_URL", "https://site.example"); }
const modules = import.meta.glob("./**/*.ts");

it.each([true, false])("backfill retains events after a serial reset and deduplicates retries (card=%s)", async card => {
  const t = convexTest(schema, modules);
  const deviceId = await t.run(ctx => ctx.db.insert("devices", { name: "Hik", createdAt: "", updatedAt: "", brand: "hikvision" }));
  const event = { cardNo: card ? "123" : "", major: card ? 5 : 3, minor: card ? 1 : 9999, serialNo: 7, time: "2026-11-27T10:00:00+03:00" };
  expect((await t.mutation(internal.cardReadings.backfillHikEventRow, { deviceId, event })).inserted).toBe(true);
  const reset = { ...event, time: "2026-11-28T10:00:00+03:00" };
  expect((await t.mutation(internal.cardReadings.backfillHikEventRow, { deviceId, event: reset })).inserted).toBe(true);
  expect((await t.mutation(internal.cardReadings.backfillHikEventRow, { deviceId, event: reset })).reason).toBe("duplicate");
  if (card) {
    await t.mutation(internal.cardReadings.processCardReading, { cardNo: "123", deviceSerial: "", authedDeviceId: deviceId, hikSerialNo: reset.serialNo, hikDateTime: reset.time, hikMajorEventType: 5, hikSubEventType: 1 });
  } else {
    expect((await t.mutation(internal.deviceEvents.recordHikDeviceEvent, { deviceId, cardNo: "", eventTime: "2026-11-28T07:00:00Z", hikSerialNo: reset.serialNo, major: 3, minor: 9999 })).reason).toBe("duplicate");
  }
  expect(await t.run(ctx => ctx.db.query(card ? "cardReadings" : "deviceEvents").collect())).toHaveLength(2);
});

it("cleanup preserves a photo by storageId despite a stale imported URL, and protects legacy owners", async () => {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const ids = [];
    for (const legacy of [true, false]) {
      const storageId = await ctx.storage.store(new Blob(["photo"]));
      const userId = await ctx.db.insert("users", { photoUrl: "https://old.example/photo", ...(legacy ? {} : { photoStorageId: storageId }) });
      await ctx.db.insert("pendingUploads", { storageId, userId, createdAt: Date.now() - 25 * 3600000 });
      ids.push(storageId);
    }
    return ids;
  });
  await t.mutation(internal.files.cleanupPendingUploads, {});
  for (const id of ids) expect(await t.run(async ctx => (await ctx.storage.get(id)) !== null)).toBe(true);
});

it("reconciliation dryRun has no effects; apply restores expiry and closes interrupted work without sending", async () => {
  unlockTarget();
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "P" });
    const userId = await ctx.db.insert("users", { accessExpiresAt: Date.now() + 86400000 });
    const oldJob = await ctx.scheduler.runAfter(86400000, internal.accountAccess.expireAccess, { userId, expectedExpiresAt: 0 });
    await ctx.scheduler.cancel(oldJob);
    await ctx.db.patch(userId, { accessExpiryJobId: oldJob });
    const runId = await ctx.db.insert("deviceSyncRuns", { projectId, startedBy: userId, kind: "project_resync", startedAt: 0, status: "running", counts: { queued: 1, sent: 0, verified: 0, failed: 0, skipped: 0, unknown: 0 } });
    const auditId = await ctx.db.insert("auditLog", { action: "update", targetTable: "biometricDestructionRun", targetId: projectId, projectId, timestamp: 0, newValue: initialDestructionState("P", ["face"], "test", 0) });
    const scheduleId = await ctx.db.insert("reportScheduleSettings", { userId, enabled: true, email: "x@test", reportType: "attendance", createdAt: "", updatedAt: "" });
    const reportId = await ctx.db.insert("reportDeliveries", { scheduleId, year: 2026, month: 11, scheduleUpdatedAt: "", email: "x@test", reportType: "attendance", status: "sending", attempts: 1, lastAttemptAt: 0 });
    return { userId, oldJob, runId, auditId, reportId };
  });
  for (const table of ["users", "deviceSyncRuns", "auditLog", "reportDeliveries"] as const) {
    expect((await t.mutation(internal.selfHostReconcile.reconcile, { dryRun: true, table })).affected).toBe(1);
  }
  expect((await t.run(ctx => ctx.db.get(ids.userId)))?.accessExpiryJobId).toBe(ids.oldJob);
  expect((await t.run(ctx => ctx.db.get(ids.runId)))?.status).toBe("running");
  for (const table of ["users", "deviceSyncRuns", "auditLog", "reportDeliveries"] as const) await t.mutation(internal.selfHostReconcile.reconcile, { dryRun: false, confirmHost, table });
  expect((await t.run(ctx => ctx.db.get(ids.userId)))?.accessExpiryJobId).not.toBe(ids.oldJob);
  expect((await t.run(ctx => ctx.db.get(ids.runId)))?.status).toBe("failed");
  expect((await t.run(ctx => ctx.db.get(ids.reportId)))?.status).toBe("failed");
  expect((await t.run(ctx => ctx.db.get(ids.auditId)))?.newValue).toMatchObject({ status: "failed" });
});

it("reconciliation paginates and closes alarm retries without scheduling mail", async () => {
  unlockTarget();
  const t = convexTest(schema, modules);
  await t.run(async ctx => {
    for (let i = 0; i < 51; i++) await ctx.db.insert("deviceEvents", { source: "system", eventTime: "", category: "operation", severity: "info", label: "alarm", createdAt: "", updatedAt: "", alarmEmailStatus: "retryScheduled" });
  });
  const first = await t.mutation(internal.selfHostReconcile.reconcile, { table: "deviceEvents", dryRun: true });
  expect(first).toMatchObject({ scanned: 50, affected: 50, isDone: false });
  const second = await t.mutation(internal.selfHostReconcile.reconcile, { table: "deviceEvents", dryRun: true, cursor: first.continueCursor });
  expect(second).toMatchObject({ scanned: 1, affected: 1, isDone: true });
  const applied = await t.mutation(internal.selfHostReconcile.reconcile, { table: "deviceEvents", dryRun: false, confirmHost });
  await t.mutation(internal.selfHostReconcile.reconcile, { table: "deviceEvents", dryRun: false, confirmHost, cursor: applied.continueCursor });
  expect(await t.run(async ctx => (await ctx.db.query("deviceEvents").collect()).every(row => row.alarmEmailStatus === "failed"))).toBe(true);
  expect(await t.run(ctx => ctx.db.system.query("_scheduled_functions").collect())).toHaveLength(0);
});
