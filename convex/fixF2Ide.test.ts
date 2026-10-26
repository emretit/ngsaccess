// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { afterEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import rateLimiterTest from "@convex-dev/rate-limiter/test";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { purgeDeviceCascade } from "./lib/deviceHelpers";
import { enqueueIdeOpInTransaction } from "./ideSync";

const modules = import.meta.glob("./**/*.ts");
const timestamps = { createdAt: "2026-10-26T09:00:00Z", updatedAt: "2026-10-26T09:00:00Z" };
afterEach(() => vi.useRealTimers());
async function fixture() {
  const t = convexTest(schema, modules);
  rateLimiterTest.register(t);
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "A" });
    const otherProjectId = await ctx.db.insert("projects", { name: "B" });
    const userId = await ctx.db.insert("users", { role: "project_user", verified: true });
    await ctx.db.insert("userProjects", { userId, projectId, role: "admin" });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 86400000 });
    const deviceId = await ctx.db.insert("devices", { name: "Panel", projectId, brand: "ide_smart", ideUuid: "9001", isActive: true, ...timestamps });
    const otherDeviceId = await ctx.db.insert("devices", { name: "Other", projectId: otherProjectId, brand: "ide_smart", ideUuid: "9002", ...timestamps });
    const doorId = await ctx.db.insert("doors", { name: "Door", deviceId, projectId, ioId: 0, ...timestamps });
    return { projectId, otherProjectId, userId, sessionId, deviceId, otherDeviceId, doorId };
  });
  return { t, ...ids, as: t.withIdentity({ subject: `${ids.userId}|${ids.sessionId}` }) };
}

describe("F2 IDE delivery", () => {
  it("web door action reaches bridge delivery and successful ACK through the real queue validator", async () => {
    vi.useFakeTimers();
    const f = await fixture();
    const now = Date.now();
    expect(await f.as.action(api.actions.ideGatewayDevice.openIdeDoor, { deviceId: f.deviceId, doorId: f.doorId }))
      .toEqual({ ok: true, queued: true });
    const { ops } = await f.t.mutation(internal.ideSync.pollForBridge, {});
    expect(ops).toHaveLength(1);
    const op = ops[0];
    expect(op).toMatchObject({ opType: "openDoor", dstId: "9001", ioId: 0, keep: 1, expiresAt: now + 30_000 });
    expect(await f.t.mutation(internal.ideSync.markSent, { opId: op.opId, msxId: 42 })).toBe(true);
    await f.t.mutation(internal.ideSync.markAck, { opId: op.opId, msxId: 42, result: "success" });
    expect(await f.t.run(ctx => ctx.db.get(op.opId))).toMatchObject({ status: "acked", attempts: 1, maxAttempts: 1 });
    expect((await f.t.mutation(internal.ideSync.pollForBridge, {})).ops).toEqual([]);
  });

  it("terminalizes orphan/non-IDE operations and advances the healthy operation behind them", async () => {
    const f = await fixture();
    const badIds = await f.t.run(async ctx => {
      const orphanId = await ctx.db.insert("devices", { name: "gone", brand: "ide_smart", ...timestamps });
      await ctx.db.delete(orphanId);
      await ctx.db.patch(f.otherDeviceId, { brand: "hikvision" });
      const ids = [];
      for (let index = 0; index < 12; index++) ids.push(await ctx.db.insert("idePendingOperations", {
        deviceId: index === 11 ? f.otherDeviceId : orphanId, opType: "triggerSync", payload: {}, status: "pending",
        idempotencyKey: `bad-${index}`, attempts: 0, nextRetryAt: 0, createdAt: 0,
      }));
      return ids;
    });
    const good = await f.t.mutation(internal.ideSync.enqueueIdeOp, { deviceId: f.deviceId, opType: "triggerSync", payload: {} });
    const result = await f.t.mutation(internal.ideSync.pollForBridge, { max: 10 });
    expect(result.ops.map(op => op.opId)).toEqual([good]);
    for (const id of badIds) expect(await f.t.run(ctx => ctx.db.get(id))).toMatchObject({ status: "failed", lastError: "Cihaz bulunamadı" });
  });

  it("device cascade removes IDE operations in bounded scheduled pages, preserves other devices", async () => {
    vi.useFakeTimers();
    const f = await fixture();
    await f.t.run(async ctx => {
      for (let i = 0; i < 205; i++) await ctx.db.insert("idePendingOperations", {
        deviceId: f.deviceId, opType: "triggerSync", payload: {}, status: i % 2 ? "pending" : "acked",
        idempotencyKey: `remove-${i}`, attempts: 0, createdAt: 0,
      });
    });
    const kept = await f.t.mutation(internal.ideSync.enqueueIdeOp, { deviceId: f.otherDeviceId, opType: "triggerSync", payload: {} });
    await f.t.run(ctx => purgeDeviceCascade(ctx, f.deviceId, f.projectId));
    expect(await f.t.run(ctx => ctx.db.get(f.deviceId))).toBeNull();
    await f.t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await f.t.run(ctx => ctx.db.query("idePendingOperations").collect())).toMatchObject([{ _id: kept }]);
  });

  it("web door action stamps 30-second expiry and one attempt; expired operation never leaves poll", async () => {
    vi.useFakeTimers();
    const f = await fixture();
    const now = Date.now();
    expect(await f.as.action(api.actions.ideGatewayDevice.openIdeDoor, { deviceId: f.deviceId, doorId: f.doorId })).toMatchObject({ ok: true });
    const ops = await f.t.run(ctx => ctx.db.query("idePendingOperations").collect());
    expect(ops).toMatchObject([{ maxAttempts: 1, payload: { ioId: 0, expiresAt: now + 30_000 } }]);
    vi.setSystemTime(now + 30_001);
    expect((await f.t.mutation(internal.ideSync.pollForBridge, {})).ops).toEqual([]);
    expect(await f.t.run(ctx => ctx.db.get(ops[0]._id))).toMatchObject({ status: "failed", attempts: 0, lastError: "Komut süresi doldu" });
  });

  it("web door action rejects foreign projects and users lacking the door permission", async () => {
    const f = await fixture();
    expect(await f.as.action(api.actions.ideGatewayDevice.openIdeDoor, { deviceId: f.otherDeviceId, doorId: f.doorId })).toMatchObject({ ok: false });
    await f.t.run(async ctx => {
      const link = await ctx.db.query("userProjects").withIndex("by_user", q => q.eq("userId", f.userId)).first();
      if (link) await ctx.db.patch(link._id, { role: "hr" });
    });
    await expect(f.as.action(api.actions.ideGatewayDevice.openIdeDoor, { deviceId: f.deviceId, doorId: f.doorId })).rejects.toThrow("yetkiniz yok");
    expect(await f.t.run(ctx => ctx.db.query("idePendingOperations").collect())).toEqual([]);
  });

  it("web commands are reserved once and cannot publish after expiring between poll and sent", async () => {
    vi.useFakeTimers();
    const f = await fixture();
    const now = Date.now();
    const id = await f.t.mutation(internal.ideSync.enqueueIdeOp, { deviceId: f.deviceId, opType: "openDoor", payload: { ioId: 0, expiresAt: now + 30_000 }, maxAttempts: 1 });
    expect((await f.t.mutation(internal.ideSync.pollForBridge, {})).ops.map(op => op.opId)).toEqual([id]);
    expect((await f.t.mutation(internal.ideSync.pollForBridge, {})).ops).toEqual([]);
    vi.setSystemTime(now + 30_001);
    expect(await f.t.mutation(internal.ideSync.markSent, { opId: id, msxId: 42 })).toBe(false);
    expect(await f.t.run(ctx => ctx.db.get(id))).toMatchObject({ status: "failed", attempts: 1, lastError: "Komut süresi doldu" });
    expect(await f.as.mutation(api.ideSync.retrySyncIssue, { opId: id })).toEqual({ queued: false });
  });

  it("login_failed increments once per sent attempt, duplicate ACK is inert, maxAttempts is terminal", async () => {
    const f = await fixture();
    const opId = await f.t.mutation(internal.ideSync.enqueueIdeOp, { deviceId: f.deviceId, opType: "triggerSync", payload: {}, maxAttempts: 2 });
    const ack = { opId, msxId: 42, result: "fail" as const, errorCode: "login_failed", message: "Panel oturumu açılamadı" };
    await f.t.mutation(internal.ideSync.markSent, { opId, msxId: 42 });
    await f.t.mutation(internal.ideSync.markAck, ack);
    const first = await f.t.run(ctx => ctx.db.get(opId));
    expect(first).toMatchObject({ status: "pending", attempts: 1 });
    expect(first?.nextRetryAt).toBeGreaterThan(Date.now());
    await f.t.mutation(internal.ideSync.markAck, ack);
    expect(await f.t.run(ctx => ctx.db.get(opId))).toEqual(first);
    await f.t.mutation(internal.ideSync.markSent, { opId, msxId: 43 });
    await f.t.mutation(internal.ideSync.markAck, ack);
    expect(await f.t.run(ctx => ctx.db.get(opId))).toMatchObject({ status: "sent", attempts: 2 });
    await f.t.mutation(internal.ideSync.markAck, { ...ack, msxId: 43 });
    expect(await f.t.run(ctx => ctx.db.get(opId))).toMatchObject({ status: "failed", attempts: 2 });
  });

  it("successful ACK replay does not alter terminal result or timestamp", async () => {
    const f = await fixture();
    const opId = await f.t.mutation(internal.ideSync.enqueueIdeOp, { deviceId: f.deviceId, opType: "triggerSync", payload: {} });
    await f.t.mutation(internal.ideSync.markSent, { opId, msxId: 42 });
    const ack = { opId, msxId: 42, result: "success" as const };
    await f.t.mutation(internal.ideSync.markAck, ack);
    const first = await f.t.run(ctx => ctx.db.get(opId));
    await f.t.mutation(internal.ideSync.markAck, ack);
    expect(await f.t.run(ctx => ctx.db.get(opId))).toEqual(first);
  });

  it("timeout processes due sent operations only; retries sync, fails one-shot door, leaves fresh sent", async () => {
    vi.useFakeTimers();
    const f = await fixture();
    const now = Date.now();
    const sync = await f.t.mutation(internal.ideSync.enqueueIdeOp, { deviceId: f.deviceId, opType: "triggerSync", payload: {} });
    const door = await f.t.mutation(internal.ideSync.enqueueIdeOp, { deviceId: f.deviceId, opType: "openDoor", payload: { ioId: 0 }, maxAttempts: 1 });
    await f.t.mutation(internal.ideSync.markSent, { opId: sync, msxId: 1 });
    await f.t.mutation(internal.ideSync.markSent, { opId: door, msxId: 2 });
    vi.setSystemTime(now + 90_001);
    const fresh = await f.t.mutation(internal.ideSync.enqueueIdeOp, { deviceId: f.deviceId, opType: "parameterWrite", payload: {} });
    await f.t.mutation(internal.ideSync.markSent, { opId: fresh, msxId: 3 });
    expect(await f.t.mutation(internal.ideSync.requeueTimedOut, {})).toBe(2);
    expect(await f.t.run(ctx => ctx.db.get(sync))).toMatchObject({ status: "pending" });
    expect(await f.t.run(ctx => ctx.db.get(door))).toMatchObject({ status: "failed" });
    expect(await f.t.run(ctx => ctx.db.get(fresh))).toMatchObject({ status: "sent" });
    expect(await f.t.mutation(internal.ideSync.requeueTimedOut, {})).toBe(0);
  });
});

it("A2-5 explicit unresolved selection grants no IO; permission and user operations fail closed", async () => {
  const f = await fixture();
  const { ruleId, linkId, employeeId, brokenDoorId } = await f.t.run(async ctx => {
    const ruleId = await ctx.db.insert("accessRules", { projectId: f.projectId, name: "Selected", isActive: true });
    const brokenDoorId = await ctx.db.insert("doors", { projectId: f.projectId, deviceId: f.deviceId, name: "Missing IO", ...timestamps });
    const linkId = await ctx.db.insert("groupDoors", { groupId: ruleId, doorId: brokenDoorId, deviceId: f.deviceId, projectId: f.projectId, createdAt: timestamps.createdAt });
    const employeeId = await ctx.db.insert("employees", { projectId: f.projectId, firstName: "A", lastName: "B", email: "a@example.test", cardNumber: "12345", isActive: true });
    await ctx.db.insert("groupMembers", { projectId: f.projectId, groupId: ruleId, employeeId, createdAt: timestamps.createdAt });
    await ctx.db.insert("groupDevices", { projectId: f.projectId, groupId: ruleId, deviceId: f.deviceId, createdAt: timestamps.createdAt });
    return { ruleId, linkId, employeeId, brokenDoorId };
  });
  expect(await f.t.query(internal.ideSync.getRuleIoIdsForPanel, { ruleId, deviceId: f.deviceId })).toEqual([]);
  const result = await f.t.action(internal.actions.ideGatewayDevice.syncEmployeeToIdePanels, { employeeId });
  expect(result.ok).toBe(false);
  expect(result.error).toContain("door_io_unresolved");
  const ops = await f.t.run(ctx => ctx.db.query("idePendingOperations").collect());
  expect(ops.length).toBeGreaterThan(1);
  for (const op of ops) expect(op).toMatchObject({ status: "failed", payload: { errorCode: "door_io_unresolved" } });
  expect((await f.t.mutation(internal.ideSync.pollForBridge, {})).ops).toEqual([]);
  await f.t.run(ctx => ctx.db.delete(brokenDoorId));
  expect(await f.t.query(internal.ideSync.getRuleIoIdsForPanel, { ruleId, deviceId: f.deviceId })).toEqual([]);
  await f.t.run(ctx => ctx.db.delete(linkId));
  expect(await f.t.query(internal.ideSync.getRuleIoIdsForPanel, { ruleId, deviceId: f.deviceId })).toEqual([0]);
  await expect(f.as.mutation(api.ideSync.retrySyncIssue, { opId: ops[0]._id })).rejects.toThrow("kuralı yeniden gönderin");
  const repaired = await f.t.action(internal.actions.ideGatewayDevice.syncEmployeeToIdePanels, { employeeId });
  expect(repaired.ok).toBe(true);
  expect((await f.t.mutation(internal.ideSync.pollForBridge, {})).ops).toHaveLength(2);
});


it("sent HTTP rejects an expired command and rejects unauthenticated callers", async () => {
  const f = await fixture();
  const opId = await f.t.mutation(internal.ideSync.enqueueIdeOp, { deviceId: f.deviceId, opType: "openDoor", payload: { ioId: 0, expiresAt: Date.now() - 1 }, maxAttempts: 1 });
  vi.stubEnv("IDE_BRIDGE_SECRET", "synthetic-bridge-secret");
  try {
    const body = JSON.stringify({ opId, msxId: 42 });
    expect((await f.t.fetch("/ide-bridge/sent", { method: "POST", headers: { Authorization: "Bearer synthetic-bridge-secret", "Content-Type": "application/json" }, body })).status).toBe(409);
    expect((await f.t.fetch("/ide-bridge/sent", { method: "POST", headers: { "Content-Type": "application/json" }, body })).status).toBe(401);
    expect(await f.t.run(ctx => ctx.db.get(opId))).toMatchObject({ status: "failed", attempts: 0 });
  } finally { vi.unstubAllEnvs(); }
});

it("unresolved doors never block disabling a user or removing all permissions", async () => {
  const f = await fixture();
  const ruleId = await f.t.run(async ctx => {
    const id = await ctx.db.insert("accessRules", { projectId: f.projectId, name: "Broken", idePermissionNo: 7 });
    await ctx.db.patch(f.doorId, { ioId: undefined });
    await ctx.db.insert("groupDoors", { groupId: id, doorId: f.doorId, deviceId: f.deviceId, createdAt: timestamps.createdAt });
    return id;
  });
  for (const userRecord of [{ id: 1, status: 0, permissions: [7] }, { id: 2, status: 1, permissions: [] }]) {
    const opId = await f.t.mutation(internal.ideSync.enqueueIdeOp, { deviceId: f.deviceId, projectId: f.projectId,
      opType: "upsertUser", payload: { ruleIds: [ruleId], userRecord } });
    expect(await f.t.run(ctx => ctx.db.get(opId))).toMatchObject({ status: "pending" });
  }
  expect((await f.t.mutation(internal.ideSync.pollForBridge, {})).ops).toHaveLength(2);
});

it("bulk enqueue reuses rule/panel IO reads only within the current mutation, including empty IO", async () => {
  const f = await fixture();
  const ruleId = await f.t.run(async ctx => {
    const id = await ctx.db.insert("accessRules", { projectId: f.projectId, name: "Selected", idePermissionNo: 7 });
    await ctx.db.insert("groupDoors", { groupId: id, doorId: f.doorId, deviceId: f.deviceId, createdAt: timestamps.createdAt });
    return id;
  });
  const enqueue = (ctx: Parameters<typeof enqueueIdeOpInTransaction>[0], deviceId: typeof f.deviceId, id: number) =>
    enqueueIdeOpInTransaction(ctx, { deviceId, opType: "upsertUser",
      payload: { ruleIds: [ruleId, ruleId], userRecord: { id, status: 1, permissions: [7] } } });
  const opIds = await f.t.run(async ctx => {
    const query = vi.spyOn(ctx.db, "query");
    try {
      const ids = [await enqueue(ctx, f.deviceId, 1), await enqueue(ctx, f.deviceId, 2),
        await enqueue(ctx, f.otherDeviceId, 3), await enqueue(ctx, f.otherDeviceId, 4)];
      expect(query.mock.calls.filter(([table]) => table === "groupDoors")).toHaveLength(2);
      return ids;
    } finally { query.mockRestore(); }
  });
  for (const id of opIds.slice(0, 2)) expect(await f.t.run(ctx => ctx.db.get(id))).toMatchObject({ status: "pending" });
  for (const id of opIds.slice(2)) expect(await f.t.run(ctx => ctx.db.get(id))).toMatchObject({ status: "failed", payload: { errorCode: "door_io_unresolved" } });
  await f.t.run(ctx => ctx.db.patch(f.doorId, { ioId: undefined }));
  const failedId = await f.t.run(ctx => enqueue(ctx, f.deviceId, 5));
  expect(await f.t.run(ctx => ctx.db.get(failedId))).toMatchObject({ status: "failed", payload: { errorCode: "door_io_unresolved" } });
  await f.t.run(ctx => ctx.db.patch(f.doorId, { ioId: 1 }));
  const repairedId = await f.t.run(ctx => enqueue(ctx, f.deviceId, 6));
  expect(await f.t.run(ctx => ctx.db.get(repairedId))).toMatchObject({ status: "pending" });
});
