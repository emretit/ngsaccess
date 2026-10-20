// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const now = "2026-10-19T09:00:00.000Z"; // Monday 12:00 Europe/Istanbul.
const requestId = "synthetic-request-0001";

async function fixture() {
  vi.useFakeTimers();
  vi.stubEnv("MOBILE_IDE_ISOLATION_VERIFIED", "true");
  vi.setSystemTime(new Date(now));
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "Synthetic A", isActive: true });
    const otherProjectId = await ctx.db.insert("projects", { name: "Synthetic B", isActive: true });
    const employeeId = await ctx.db.insert("employees", { projectId, firstName: "Synthetic", lastName: "A", email: "a@example.test", cardNumber: "synthetic-a", isActive: true });
    const otherEmployeeId = await ctx.db.insert("employees", { projectId: otherProjectId, firstName: "Synthetic", lastName: "B", email: "b@example.test", cardNumber: "synthetic-b", isActive: true });
    const authId = await ctx.db.insert("employeeAuth", { employeeId, passwordHash: "synthetic-hash", passwordVersion: 1, createdAt: now, updatedAt: now });
    await ctx.db.insert("employeeAuth", { employeeId: otherEmployeeId, passwordHash: "synthetic-hash-b", passwordVersion: 1, createdAt: now, updatedAt: now });
    const sessionId = await ctx.db.insert("employeeSessions", { employeeId, token: "session-a", passwordVersion: 1, expiresAt: "2030-01-01T00:00:00Z", createdAt: now });
    await ctx.db.insert("employeeSessions", { employeeId: otherEmployeeId, token: "session-b", passwordVersion: 1, expiresAt: "2030-01-01T00:00:00Z", createdAt: now });
    const deviceId = await ctx.db.insert("devices", { projectId, name: "Synthetic panel A", brand: "ide_smart", ideUuid: "synthetic-ide", ideDoorCount: 2, isActive: true, createdAt: now, updatedAt: now });
    const doorId = await ctx.db.insert("doors", { projectId, deviceId, name: "Allowed door", ioId: 0, status: "active" });
    const otherDoorId = await ctx.db.insert("doors", { projectId, deviceId, name: "Other door", ioId: 1, status: "active" });
    const otherDeviceId = await ctx.db.insert("devices", { projectId: otherProjectId, name: "Foreign sensitive metadata", brand: "ide_smart", ideUuid: "synthetic-b", isActive: true, createdAt: now, updatedAt: now });
    const ruleId = await ctx.db.insert("accessRules", { projectId, name: "Monday", isActive: true, days: ["Monday"], startTime: "09:00", endTime: "18:00" });
    await ctx.db.insert("groupMembers", { projectId, groupId: ruleId, employeeId, createdAt: now });
    const deviceLinkId = await ctx.db.insert("groupDevices", { projectId, groupId: ruleId, deviceId, createdAt: now });
    const doorLinkId = await ctx.db.insert("groupDoors", { projectId, groupId: ruleId, deviceId, doorId, createdAt: now });
    // Corrupt cross-tenant link must not expose even the foreign device name.
    await ctx.db.insert("groupDevices", { projectId, groupId: ruleId, deviceId: otherDeviceId, createdAt: now });
    return { projectId, otherProjectId, employeeId, otherEmployeeId, authId, sessionId, deviceId, doorId, otherDoorId, otherDeviceId, ruleId, deviceLinkId, doorLinkId };
  });
  return { t, ...ids };
}

afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

describe("mobile access with real employee authentication and persisted transactions", () => {
  it("lists safe door targets without tenant B metadata; groupDoors narrows blanket device grants", async () => {
    const { t, deviceId, doorId, otherDeviceId } = await fixture();
    const targets = await t.query(api.mobileAccess.listTargets, { sessionToken: "session-a" });
    expect(targets).toHaveLength(1);
    expect(targets[0]).toMatchObject({ deviceId, doorId, canOpen: true, transport: "ide_mqtt", supportsReaderToken: false });
    expect(JSON.stringify(targets)).not.toContain("Foreign sensitive metadata");
    expect(targets.some(target => target.deviceId === otherDeviceId)).toBe(false);
    expect(await t.query(api.devices.listForEmployee, { sessionToken: "session-a" })).toEqual(targets);
    await expect(t.query(api.mobileAccess.listTargets, { sessionToken: "invalid" })).rejects.toThrow("SESSION_INVALID");
  });

  it("supports groupDoors-only authorization and never broadens it to the other actuator", async () => {
    const { t, deviceLinkId, deviceId, doorId, otherDoorId } = await fixture();
    await t.run(ctx => ctx.db.delete(deviceLinkId));
    expect(await t.query(api.mobileAccess.listTargets, { sessionToken: "session-a" })).toEqual([expect.objectContaining({ deviceId, doorId, canOpen: true })]);
    await expect(t.mutation(api.mobileAccess.requestOpen, { sessionToken: "session-a", requestId, deviceId, doorId: otherDoorId })).rejects.toThrow("TARGET_NOT_ALLOWED");
  });

  it("binds ten same-ID requests to one actual IDE command with no card reading", async () => {
    const { t, deviceId, doorId, otherDoorId } = await fixture();
    const args = { sessionToken: "session-a", requestId, deviceId, doorId };
    const results = await Promise.all(Array.from({ length: 10 }, () => t.mutation(api.mobileAccess.requestOpen, args)));
    expect(new Set(results.map(value => value.operationId)).size).toBe(1);
    const commands = await t.run(ctx => ctx.db.query("idePendingOperations").take(20));
    expect(commands).toHaveLength(1);
    expect(commands[0]).toMatchObject({ opType: "openDoor", payload: { ioId: 0, keep: 1 }, attempts: 0, maxAttempts: 1 });
    expect(await t.run(ctx => ctx.db.query("cardReadings").take(20))).toEqual([]);
    expect(await t.query(api.mobileAccess.getRequestOperation, { sessionToken: "session-a", requestId })).toEqual(results[0]);
    await expect(t.mutation(api.mobileAccess.requestOpen, { ...args, doorId: otherDoorId })).rejects.toThrow("REQUEST_TARGET_MISMATCH");
    expect(await t.query(api.mobileAccess.getRequestOperation, { sessionToken: "session-b", requestId })).toBeNull();
    await expect(t.query(api.mobileAccess.getOperation, { sessionToken: "session-b", operationId: results[0].operationId })).rejects.toThrow("OPERATION_NOT_FOUND");
  });

  it("rejects foreign ID and legacy self-check-in without inserting a movement", async () => {
    const { t, otherDeviceId } = await fixture();
    await expect(t.mutation(api.mobileAccess.requestOpen, { sessionToken: "session-a", requestId, deviceId: otherDeviceId })).rejects.toThrow("TARGET_NOT_ALLOWED");
    expect(await t.mutation(api.cardReadings.selfCheckIn, { sessionToken: "session-a", deviceId: otherDeviceId })).toMatchObject({ granted: false, code: "READER_REQUIRED" });
    expect(await t.run(ctx => ctx.db.query("cardReadings").take(20))).toEqual([]);
  });

  it("requires an explicit door on a panel and rejects missing/duplicate actuator mappings", async () => {
    const { t, deviceId, doorId, otherDoorId } = await fixture();
    await expect(t.mutation(api.mobileAccess.requestOpen, { sessionToken: "session-a", requestId, deviceId })).rejects.toThrow("DOOR_REQUIRED");
    await t.run(ctx => ctx.db.patch(otherDoorId, { ioId: 0 }));
    await expect(t.mutation(api.mobileAccess.requestOpen, { sessionToken: "session-a", requestId, deviceId, doorId })).rejects.toThrow("TARGET_UNSUPPORTED");
  });

  it.each(["device", "door", "schedule", "legacyOvernight", "project", "epoch"] as const)("fails closed for disabled/out-of-policy %s", async kind => {
    const { t, deviceId, doorId, ruleId, projectId, employeeId } = await fixture();
    await t.run(async ctx => {
      if (kind === "device") await ctx.db.patch(deviceId, { isActive: false });
      if (kind === "door") await ctx.db.patch(doorId, { status: "inactive" });
      if (kind === "project") await ctx.db.patch(projectId, { isActive: false });
      if (kind === "schedule") await ctx.db.patch(ruleId, { days: ["Tuesday"] });
      if (kind === "legacyOvernight") await ctx.db.patch(ruleId, { startTime: "22:00", endTime: "06:00" });
      if (kind === "epoch") await ctx.db.patch(employeeId, { accessExpiresAt: now });
    });
    await expect(t.mutation(api.mobileAccess.requestOpen, { sessionToken: "session-a", requestId, deviceId, doorId })).rejects.toThrow();
    expect(await t.run(ctx => ctx.db.query("idePendingOperations").take(20))).toEqual([]);
  });

  it("uses Istanbul weekdays and half-open time ranges", async () => {
    const { t, ruleId } = await fixture();
    await t.run(ctx => ctx.db.patch(ruleId, { startTime: "12:00", endTime: "13:00" }));
    expect((await t.query(api.mobileAccess.listTargets, { sessionToken: "session-a" }))[0]?.canOpen).toBe(true);
    vi.setSystemTime(new Date("2026-10-19T10:00:00.000Z"));
    expect((await t.query(api.mobileAccess.listTargets, { sessionToken: "session-a" }))[0]).toMatchObject({ canOpen: false, reason: "SCHEDULE_DENIED" });
  });

  it.each(["logout", "password", "inactive", "expired", "rule", "isolation"] as const)("rechecks %s before irreversible IDE dispatch", async kind => {
    const { t, deviceId, doorId, sessionId, authId, employeeId, ruleId } = await fixture();
    await t.mutation(api.mobileAccess.requestOpen, { sessionToken: "session-a", requestId, deviceId, doorId });
    const op = await t.run(ctx => ctx.db.query("idePendingOperations").first());
    if (!op) throw new Error("Missing queued command");
    await t.run(async ctx => {
      if (kind === "logout") await ctx.db.delete(sessionId);
      if (kind === "password") await ctx.db.patch(authId, { passwordVersion: 2 });
      if (kind === "inactive") await ctx.db.patch(employeeId, { isActive: false });
      if (kind === "rule") await ctx.db.patch(ruleId, { isActive: false });
    });
    if (kind === "expired") vi.advanceTimersByTime(30_000);
    if (kind === "isolation") vi.stubEnv("MOBILE_IDE_ISOLATION_VERIFIED", "false");
    expect((await t.query(internal.ideSync.listPendingForBridge, {})).ops).toEqual([]);
    await expect(t.mutation(internal.ideSync.markSent, { opId: op._id, msxId: 42 })).rejects.toThrow("MOBILE_COMMAND_NOT_DELIVERABLE");
  });

  it("never resends an acknowledged or timed-out command under the same request ID", async () => {
    const { t, deviceId, doorId } = await fixture();
    const args = { sessionToken: "session-a", requestId, deviceId, doorId };
    const result = await t.mutation(api.mobileAccess.requestOpen, args);
    const command = await t.run(ctx => ctx.db.query("idePendingOperations").first());
    if (!command) throw new Error("Missing command");
    await t.mutation(internal.ideSync.markSent, { opId: command._id, msxId: 42 });
    await expect(t.mutation(internal.ideSync.markSent, { opId: command._id, msxId: 43 })).rejects.toThrow();
    await t.mutation(internal.ideSync.markAck, { opId: command._id, msxId: 42, result: "timeout" });
    expect(await t.query(api.mobileAccess.getOperation, { sessionToken: "session-a", operationId: result.operationId })).toMatchObject({ status: "unknown", errorCode: "COMMAND_OUTCOME_UNKNOWN" });
    expect(await t.mutation(api.mobileAccess.requestOpen, args)).toMatchObject({ operationId: result.operationId, status: "unknown" });
    expect(await t.run(ctx => ctx.db.query("idePendingOperations").take(20))).toHaveLength(1);
    expect(await t.run(ctx => ctx.db.query("cardReadings").take(20))).toEqual([]);
  });

  it("treats successful command ACK as confirmed without inventing a passage", async () => {
    const { t, deviceId, doorId } = await fixture();
    const result = await t.mutation(api.mobileAccess.requestOpen, { sessionToken: "session-a", requestId, deviceId, doorId });
    const command = await t.run(ctx => ctx.db.query("idePendingOperations").first());
    if (!command) throw new Error("Missing command");
    await t.mutation(internal.ideSync.markSent, { opId: command._id, msxId: 42 });
    await t.mutation(internal.ideSync.markAck, { opId: command._id, msxId: 42, result: "success" });
    expect(await t.query(api.mobileAccess.getOperation, { sessionToken: "session-a", operationId: result.operationId })).toMatchObject({ status: "confirmed" });
    expect(await t.run(ctx => ctx.db.query("cardReadings").take(20))).toEqual([]);
  });
  it("hides corrupt tenant relationships in employee history enrichment", async () => {
    const { t, employeeId, projectId, otherProjectId, otherDeviceId, deviceId } = await fixture();
    await t.run(async ctx => {
      for (const [project, device] of [[projectId, otherDeviceId], [otherProjectId, otherDeviceId], [projectId, deviceId]] as const) {
        await ctx.db.insert("cardReadings", { projectId: project, employeeId, deviceId: device, cardNo: "synthetic-card", accessTime: now, createdAt: now, updatedAt: now });
      }
    });
    const readings = await t.query(api.cardReadings.listForEmployee, { sessionToken: "session-a" });
    expect(readings).toHaveLength(2);
    expect(readings.find(reading => reading.deviceId === otherDeviceId)?.device).toBeNull();
    expect(JSON.stringify(readings)).not.toContain("Foreign sensitive metadata");
    expect(readings.every(reading => reading.projectId === projectId)).toBe(true);
  });

  it("fails closed for orphan employees, wrong-project rules and corrupt door references", async () => {
    const { t, employeeId, ruleId, otherProjectId, doorLinkId, otherDeviceId } = await fixture();
    await t.run(ctx => ctx.db.patch(ruleId, { projectId: otherProjectId }));
    expect(await t.query(api.mobileAccess.listTargets, { sessionToken: "session-a" })).toEqual([]);
    await t.run(async ctx => {
      const employee = await ctx.db.get(employeeId);
      await ctx.db.patch(ruleId, { projectId: employee?.projectId });
      await ctx.db.patch(doorLinkId, { deviceId: otherDeviceId });
    });
    expect(await t.query(api.mobileAccess.listTargets, { sessionToken: "session-a" })).toEqual([]);
    await t.run(ctx => ctx.db.patch(employeeId, { projectId: undefined }));
    expect(await t.query(api.mobileAccess.listTargets, { sessionToken: "session-a" })).toEqual([]);
  });

  it("gates localBridge mobile opening until a compatible consumer is available", async () => {
    const { t, deviceId, doorId, otherDoorId } = await fixture();
    await t.run(async ctx => {
      await ctx.db.patch(deviceId, { brand: "hikvision", hikTransport: "localBridge", hikDoorCount: 2, deviceIp: "192.0.2.10", apiToken: "synthetic-device-token" });
      await ctx.db.patch(doorId, { hikDoorNo: 1 });
      await ctx.db.patch(otherDoorId, { hikDoorNo: 2 });
    });
    expect((await t.query(api.mobileAccess.listTargets, { sessionToken: "session-a" }))[0]).toMatchObject({ canOpen: false, transport: "unsupported", reason: "TRANSPORT_UNSUPPORTED", supportsReaderToken: false });
    await expect(t.mutation(api.mobileAccess.requestOpen, { sessionToken: "session-a", requestId, deviceId, doorId })).rejects.toThrow("TRANSPORT_UNSUPPORTED");
    expect(await t.run(ctx => ctx.db.query("hikPendingOperations").take(20))).toEqual([]);
    expect(await t.run(ctx => ctx.db.query("cardReadings").take(20))).toEqual([]);
  });

  it("makes persisted poll progress past a full window of revoked IDE commands", async () => {
    const { t, deviceId, doorId, sessionId, employeeId } = await fixture();
    for (let index = 0; index < 10; index++) {
      await t.mutation(api.mobileAccess.requestOpen, { sessionToken: "session-a", requestId: `synthetic-old-${index}-request`, deviceId, doorId });
    }
    await t.run(async ctx => {
      await ctx.db.delete(sessionId);
      await ctx.db.insert("employeeSessions", { employeeId, token: "new-session", passwordVersion: 1, expiresAt: "2030-01-01T00:00:00Z", createdAt: now });
    });
    const fresh = await t.mutation(api.mobileAccess.requestOpen, { sessionToken: "new-session", requestId: "synthetic-new-request", deviceId, doorId });
    const result = await t.mutation(internal.ideSync.pollForBridge, {});
    expect(result.ops).toHaveLength(1);
    expect(result.ops[0]).toMatchObject({ mobileOperationId: fresh.operationId });
    const stored = await t.run(ctx => ctx.db.query("idePendingOperations").take(20));
    expect(stored.filter(command => command.status === "failed")).toHaveLength(10);
    expect(stored.filter(command => command.status === "sent")).toHaveLength(1);
  });

  it("concurrent IDE polls reserve one mobile command and scheduler expires unclaimed work", async () => {
    const { t, deviceId, doorId } = await fixture();
    await t.mutation(api.mobileAccess.requestOpen, { sessionToken: "session-a", requestId, deviceId, doorId });
    const polled = await Promise.all([t.mutation(internal.ideSync.pollForBridge, {}), t.mutation(internal.ideSync.pollForBridge, {})]);
    expect(polled.reduce((sum, result) => sum + result.ops.length, 0)).toBe(1);
    const second = await t.mutation(api.mobileAccess.requestOpen, { sessionToken: "session-a", requestId: "synthetic-unsent-request", deviceId, doorId });
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());
    expect(await t.query(api.mobileAccess.getOperation, { sessionToken: "session-a", operationId: second.operationId })).toMatchObject({ status: "failed", errorCode: "COMMAND_EXPIRED" });
    expect((await t.mutation(internal.ideSync.pollForBridge, {})).ops).toEqual([]);
  });

  it("requires registered matching IDE correlation before accepting a mobile ACK", async () => {
    const { t, deviceId, doorId } = await fixture();
    const queued = await t.mutation(api.mobileAccess.requestOpen, { sessionToken: "session-a", requestId, deviceId, doorId });
    const polled = await t.mutation(internal.ideSync.pollForBridge, {});
    const command = polled.ops[0];
    if (!command) throw new Error("Missing polled command");
    for (const msxId of [undefined, 123]) {
      await t.mutation(internal.ideSync.markAck, { opId: command.opId, result: "success", ...(msxId === undefined ? {} : { msxId }) });
      expect(await t.query(api.mobileAccess.getOperation, { sessionToken: "session-a", operationId: queued.operationId })).toMatchObject({ status: "sent" });
    }
    await t.mutation(internal.ideSync.markSent, { opId: command.opId, msxId: 42 });
    for (const msxId of [undefined, 123]) {
      await t.mutation(internal.ideSync.markAck, { opId: command.opId, result: "success", ...(msxId === undefined ? {} : { msxId }) });
      expect(await t.query(api.mobileAccess.getOperation, { sessionToken: "session-a", operationId: queued.operationId })).toMatchObject({ status: "sent" });
    }
    await t.mutation(internal.ideSync.markAck, { opId: command.opId, msxId: 42, result: "success" });
    expect(await t.query(api.mobileAccess.getOperation, { sessionToken: "session-a", operationId: queued.operationId })).toMatchObject({ status: "confirmed" });
  });

  it("keeps mixed valid and missing-actuator targets readable with nullable unsupported metadata", async () => {
    const { t, doorLinkId, otherDoorId, doorId } = await fixture();
    await t.run(async ctx => {
      await ctx.db.delete(doorLinkId);
      await ctx.db.patch(otherDoorId, { ioId: undefined });
    });
    const targets = await t.query(api.mobileAccess.listTargets, { sessionToken: "session-a" });
    expect(targets).toHaveLength(2);
    expect(targets.find(target => target.doorId === doorId)).toMatchObject({ canOpen: true, actuator: 0 });
    expect(targets.find(target => target.doorId === otherDoorId)).toMatchObject({ canOpen: false, actuator: null, reason: "TARGET_UNSUPPORTED" });
  });

  it.each([undefined, "false", "TRUE", "1"])("gates IDE mobile opening without exact deployment isolation attestation (%s)", async value => {
    const { t, deviceId, doorId } = await fixture();
    vi.stubEnv("MOBILE_IDE_ISOLATION_VERIFIED", value);
    expect((await t.query(api.mobileAccess.listTargets, { sessionToken: "session-a" }))[0]).toMatchObject({ canOpen: false, transport: "unsupported", reason: "TRANSPORT_UNSUPPORTED", supportsReaderToken: false });
    await expect(t.mutation(api.mobileAccess.requestOpen, { sessionToken: "session-a", requestId, deviceId, doorId })).rejects.toThrow("TRANSPORT_UNSUPPORTED");
    expect(await t.run(ctx => ctx.db.query("idePendingOperations").take(20))).toEqual([]);
    expect(await t.run(ctx => ctx.db.query("cardReadings").take(20))).toEqual([]);
  });

});
