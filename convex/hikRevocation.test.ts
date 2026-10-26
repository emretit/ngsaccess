// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import * as accessRules from "./accessRules";
import * as hikvisionSync from "./hikvisionSync";
import * as deviceSyncRuns from "./deviceSyncRuns";
import { getFunctionName, type FunctionArgs } from "convex/server";
import type { ActionCtx } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { snapshotEmployeeHikDevices, reconcileRemovedEmployeeHik } from "./lib/peopleHikSnapshot";
import { scheduleEmployeeCardChange } from "./lib/employeeCardChange";

const wire = vi.hoisted(() => ({ remove: vi.fn(async (): Promise<{ ok: boolean; error?: string }> => ({ ok: true })), send: vi.fn(async () => ({ ok: true })) }));
vi.mock("./lib/hikGateway", async original => ({
  ...await original<typeof import("./lib/hikGateway")>(), deletePersonFromDevice: wire.remove,
  upsertPersonToDevice: wire.send, addCardToDevice: wire.send, setWeekPlanOnDevice: wire.send, setPlanTemplate: wire.send,
}));
const modules = import.meta.glob("./**/*.ts");
beforeEach(() => { vi.useFakeTimers(); wire.remove.mockReset().mockResolvedValue({ ok: true }); wire.send.mockClear(); });
afterEach(() => vi.useRealTimers());
async function fixture(transport: "gateway" | "localBridge" = "gateway") {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "Synthetic A" });
    const otherProjectId = await ctx.db.insert("projects", { name: "Synthetic B" });
    const userId = await ctx.db.insert("users", { role: "project_admin" });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 86400000 });
    await ctx.db.insert("userProjects", { userId, projectId });
    const employeeId = await ctx.db.insert("employees", { projectId, firstName: "Test", lastName: "Person", email: "test@example.test", cardNumber: "OLD", isActive: true });
    const base = { name: "Hik", brand: "hikvision" as const, hikTransport: transport, hikDoorCount: 2, isActive: true, status: "online", hikLastSeenAt: Date.now(), createdAt: "", updatedAt: "" };
    const deviceId = await ctx.db.insert("devices", { ...base, projectId, hikDevIndex: "local-index", apiToken: "test-token", deviceIp: "192.0.2.1", deviceUsername: "test", devicePassword: "test" });
    const foreignDeviceId = await ctx.db.insert("devices", { ...base, projectId: otherProjectId, hikDevIndex: "foreign-index" });
    const ruleId = await ctx.db.insert("accessRules", { projectId, name: "Rule", isActive: true, hikWeekPlanNo: 2 });
    const memberId = await ctx.db.insert("groupMembers", { projectId, groupId: ruleId, employeeId, createdAt: "" });
    const doorId = await ctx.db.insert("doors", { projectId, name: "Door only", deviceId, hikDoorNo: 1 });
    await ctx.db.insert("groupDoors", { projectId, groupId: ruleId, deviceId, doorId, createdAt: "" });
    return { projectId, otherProjectId, userId, sessionId, employeeId, deviceId, foreignDeviceId, ruleId, memberId, doorId };
  });
  const admin = t.withIdentity({ subject: `${ids.userId}|${ids.sessionId}` });
  const drain = async () => {
    await vi.advanceTimersByTimeAsync(1);
    await t.finishInProgressScheduledFunctions();
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());
  };
  const operations = () => t.run(ctx => ctx.db.query("hikPendingOperations").take(100));
  const snapshot = () => t.run(async ctx => { const employee = await ctx.db.get(ids.employeeId); if (!employee) throw new Error("fixture employee"); return snapshotEmployeeHikDevices(ctx, employee); });
  return { t, ids, admin, drain, operations, snapshot };
}

describe("Hik revocation lifecycle", () => {
  it.each(["gateway", "localBridge"] as const)("%s: card rotation captures old door-only identity before syncing the new one", async transport => {
    const f = await fixture(transport);
    await f.t.run(async ctx => {
      await ctx.db.patch(f.ids.employeeId, { cardNumber: "NEW" });
      await scheduleEmployeeCardChange(ctx, f.ids.employeeId, f.ids.projectId, "OLD");
    });
    await f.drain();
    expect(await f.operations()).toEqual(expect.arrayContaining([expect.objectContaining({ deviceId: f.ids.deviceId, operation: transport === "gateway" ? "deletePerson" : "deleteCard", payload: expect.objectContaining({ employeeNo: "OLD" }) })]));
    if (transport === "gateway") expect(wire.remove).toHaveBeenCalledWith("local-index", "OLD");
    else expect((await f.operations()).find(op => op.operation === "addPerson")?.payload).toMatchObject({ employeeNo: "NEW" });
  });

  it.each(["gateway", "localBridge"] as const)("%s: person deletion keeps door-only targets and retries without employee", async transport => {
    const f = await fixture(transport);
    wire.remove.mockResolvedValue({ ok: false, error: "offline" });
    await f.admin.mutation(api.employees.remove, { employeeId: f.ids.employeeId });
    await f.drain();
    expect(await f.t.run(ctx => ctx.db.get(f.ids.employeeId))).toBeNull();
    const op = (await f.operations()).find(row => row.operation === (transport === "gateway" ? "deletePerson" : "deleteCard"));
    expect(op).toMatchObject({ deviceId: f.ids.deviceId, payload: expect.objectContaining({ cardNumber: "OLD" }), status: transport === "gateway" ? "failed" : "pending" });
    if (transport === "gateway") {
      wire.remove.mockResolvedValue({ ok: true });
      await f.t.action(internal.actions.hikQueueWorker.processHikQueue, {});
      expect((await f.operations()).find(row => row._id === op?._id)?.status).toBe("done");
      expect(wire.remove).toHaveBeenLastCalledWith("local-index", "OLD");
    } else {
      const claimed = await f.t.mutation(internal.hikvisionSync.claimLocalBridgeOperations, { token: "test-token" });
      const deletion = claimed.operations.find(row => row.operation === "deleteCard");
      expect(deletion).toBeDefined();
      if (!deletion) throw new Error("missing deletion");
      await f.t.mutation(internal.hikvisionSync.ackLocalBridgeOperation, { token: "test-token", opId: deletion.opId, ok: true });
      expect((await f.operations()).find(row => row._id === deletion.opId)?.status).toBe("done");
    }
  });

  it("unions historical devices and filters foreign links and grant rows", async () => {
    const f = await fixture();
    await f.t.run(async ctx => {
      await ctx.db.insert("groupDevices", { projectId: f.ids.projectId, groupId: f.ids.ruleId, deviceId: f.ids.foreignDeviceId, createdAt: "" });
      await ctx.db.insert("accessGrantStatus", { projectId: f.ids.projectId, employeeId: f.ids.employeeId, deviceId: f.ids.foreignDeviceId, state: "effective", ruleIds: [], updatedAt: Date.now() });
    });
    expect((await f.snapshot()).devices.map(device => device._id)).toEqual([f.ids.deviceId]);
    await f.t.run(async ctx => {
      await ctx.db.insert("accessGrantStatus", { projectId: f.ids.projectId, employeeId: f.ids.employeeId, deviceId: f.ids.deviceId, state: "effective", ruleIds: [], updatedAt: Date.now() });
      await ctx.db.delete(f.ids.memberId);
    });
    await f.t.action(internal.actions.hikvisionSync.syncEmployeeToDevicesInternal, { employeeId: f.ids.employeeId });
    expect(wire.remove).toHaveBeenCalledExactlyOnceWith("local-index", "OLD");
    expect((await f.operations()).every(op => op.deviceId === f.ids.deviceId)).toBe(true);
  });

  it.each([false, true])("relationship removal preserves another valid rule: %s", async remaining => {
    const f = await fixture();
    if (remaining) await f.t.run(async ctx => {
      const ruleId = await ctx.db.insert("accessRules", { projectId: f.ids.projectId, name: "Remaining", isActive: true, hikWeekPlanNo: 3 });
      await ctx.db.insert("groupMembers", { projectId: f.ids.projectId, groupId: ruleId, employeeId: f.ids.employeeId, createdAt: "" });
      await ctx.db.insert("groupDoors", { projectId: f.ids.projectId, groupId: ruleId, deviceId: f.ids.deviceId, doorId: f.ids.doorId, createdAt: "" });
    });
    await f.t.run(async ctx => {
      const employee = await ctx.db.get(f.ids.employeeId); if (!employee) throw new Error("employee");
      const before = await snapshotEmployeeHikDevices(ctx, employee);
      await ctx.db.delete(f.ids.memberId);
      await reconcileRemovedEmployeeHik(ctx, f.ids.employeeId, before);
    });
    await f.drain();
    expect(wire.remove).toHaveBeenCalledTimes(remaining ? 0 : 1);
    if (remaining) expect(wire.send).toHaveBeenCalled();
  });

  describe.each(["gateway", "localBridge"] as const)("%s rule mutation revocation", transport => {
    it.each(["rule", "member", "device", "door", "inactive", "diff"] as const)("captures old identity when removing %s", async kind => {
      const f = await fixture(transport);
      if (kind === "device") await f.t.run(ctx => ctx.db.insert("groupDevices", { projectId: f.ids.projectId, groupId: f.ids.ruleId, deviceId: f.ids.deviceId, createdAt: "" }));
      if (kind === "rule") await f.admin.mutation(api.accessRules.remove, { ruleId: f.ids.ruleId });
      else if (kind === "inactive") await f.admin.mutation(api.accessRules.update, { ruleId: f.ids.ruleId, isActive: false });
      else await f.admin.mutation(api.accessRules.updateWithGroups, {
        ruleId: f.ids.ruleId,
        ...(kind === "member" ? { employeeIds: [] } : {}),
        ...(kind === "device" ? { deviceIds: [] } : {}),
        ...(kind === "door" ? { doorIds: [] } : {}),
        ...(kind === "diff" ? { relationDiff: { employees: { added: [], removed: [f.ids.employeeId] }, devices: { added: [], removed: [] }, doors: { added: [], removed: [] } } } : {}),
      });
      await f.drain();
      const deletions = (await f.operations()).filter(op => op.operation === "deletePerson" || op.operation === "deleteCard");
      expect(deletions.length).toBeGreaterThan(0);
      expect(deletions.every(op => op.deviceId === f.ids.deviceId)).toBe(true);
      expect(deletions[0]?.payload).toMatchObject({ cardNumber: "OLD" });
      if (transport === "gateway") expect(wire.remove).toHaveBeenCalledWith("local-index", "OLD");
      else expect(deletions.every(op => op.status === "pending")).toBe(true);
    });
  });

  it("deleting one rule updates the remaining rule instead of deleting the person", async () => {
    const f = await fixture();
    await f.t.run(async ctx => {
      const groupId = await ctx.db.insert("accessRules", { projectId: f.ids.projectId, name: "Remaining", isActive: true, hikWeekPlanNo: 3 });
      await ctx.db.insert("groupMembers", { projectId: f.ids.projectId, groupId, employeeId: f.ids.employeeId, createdAt: "" });
      await ctx.db.insert("groupDoors", { projectId: f.ids.projectId, groupId, deviceId: f.ids.deviceId, doorId: f.ids.doorId, createdAt: "" });
    });
    await f.admin.mutation(api.accessRules.remove, { ruleId: f.ids.ruleId });
    await f.drain();
    expect(wire.remove).not.toHaveBeenCalled();
    expect(wire.send).toHaveBeenCalledWith("local-index", expect.objectContaining({ employeeNo: "OLD", doorPlans: [{ doorNo: 1, planTemplateNos: [3] }] }));
  });

  it("diff revocation queues an offline device even when its tracked dispatch skips it", async () => {
    const f = await fixture();
    await f.t.run(ctx => ctx.db.patch(f.ids.deviceId, { status: "offline" }));
    wire.remove.mockResolvedValue({ ok: false, error: "offline" });
    await f.admin.mutation(api.accessRules.updateWithGroupsTracked, { ruleId: f.ids.ruleId, relationDiff: {
      employees: { added: [], removed: [f.ids.employeeId] }, devices: { added: [], removed: [] }, doors: { added: [], removed: [] },
    } });
    await f.drain();
    expect(await f.operations()).toEqual(expect.arrayContaining([expect.objectContaining({ operation: "deletePerson", status: "failed", deviceId: f.ids.deviceId, payload: expect.objectContaining({ cardNumber: "OLD" }) })]));
  });

  it("failed old-card retry cannot switch to the current card", async () => {
    const f = await fixture();
    const snapshot = await f.snapshot();
    await f.t.run(ctx => ctx.db.patch(f.ids.employeeId, { cardNumber: "NEW" }));
    wire.remove.mockResolvedValue({ ok: false, error: "offline" });
    await f.t.action(internal.actions.hikvisionSync.deleteEmployeeFromDevicesInternal, { employeeId: f.ids.employeeId, snapshot });
    wire.remove.mockResolvedValue({ ok: true });
    await f.t.action(internal.actions.hikQueueWorker.processHikQueue, {});
    expect(wire.remove.mock.calls).toEqual([["local-index", "OLD"], ["local-index", "OLD"]]);
  });

  it("bridge deletion is queued until ack, and different old cards never dedupe together", async () => {
    const f = await fixture("localBridge");
    await f.t.run(ctx => ctx.db.patch(f.ids.employeeId, { isActive: false }));
    const snapshot = await f.snapshot();
    expect(await f.t.action(internal.actions.hikvisionSync.deleteEmployeeFromDevicesInternal, { employeeId: f.ids.employeeId, snapshot })).toMatchObject({ removed: 0, queued: 1 });
    await f.t.action(internal.actions.hikvisionSync.deleteEmployeeFromDevicesInternal, { employeeId: f.ids.employeeId, snapshot: { ...snapshot, cardNumber: "OLDER" } });
    expect((await f.operations()).filter(op => op.operation === "deleteCard")).toHaveLength(2);
    const grant = await f.t.run(ctx => ctx.db.query("accessGrantStatus").first());
    expect(grant?.state).toBe("pending");
  });

  it("five failed attempts remain visible after cleanup and cannot be dismissed", async () => {
    const f = await fixture();
    await f.t.run(ctx => ctx.db.patch(f.ids.employeeId, { isActive: false }));
    wire.remove.mockResolvedValue({ ok: false, error: "offline" });
    await f.t.action(internal.actions.hikvisionSync.deleteEmployeeFromDevicesInternal, { employeeId: f.ids.employeeId, snapshot: await f.snapshot() });
    for (let i = 0; i < 4; i++) await f.t.action(internal.actions.hikQueueWorker.processHikQueue, {});
    const op = (await f.operations())[0]; if (!op) throw new Error("operation");
    await f.t.run(ctx => ctx.db.patch(op._id, { createdAt: Date.now() - 172800000 }));
    await f.t.mutation(internal.hikvisionSync.cleanupStaleSyncIssues, {});
    expect((await f.operations())[0]).toMatchObject({ status: "failed", attemptCount: 5, lastError: expect.stringContaining("cihazda kalmış olabilir") });
    await expect(f.admin.mutation(api.hikvisionSync.dismissSyncIssue, { issueId: op._id })).rejects.toThrow("süper yönetici");
    await f.admin.mutation(api.hikvisionSync.dismissAllSyncIssues, { projectId: f.ids.projectId });
    expect((await f.admin.query(api.hikvisionSync.listSyncIssues, { projectId: f.ids.projectId })).items).toHaveLength(1);
  });

  it("one credential acknowledgement cannot close another old-card failure", async () => {
    const f = await fixture();
    wire.remove.mockResolvedValue({ ok: false, error: "offline" });
    const snapshot = await f.snapshot();
    await f.t.action(internal.actions.hikvisionSync.deleteEmployeeFromDevicesInternal, { employeeId: f.ids.employeeId, snapshot: { ...snapshot, cardNumber: "OLDER" } });
    wire.remove.mockResolvedValue({ ok: true });
    await f.t.action(internal.actions.hikvisionSync.deleteEmployeeFromDevicesInternal, { employeeId: f.ids.employeeId, snapshot });
    expect((await f.operations()).filter(op => op.status === "failed")).toEqual([expect.objectContaining({ payload: expect.objectContaining({ cardNumber: "OLDER" }) })]);
  });

  it.each(["gateway", "localBridge"] as const)("%s acknowledgement resolves old-run warnings but preserves that run's failure evidence", async transport => {
    const f = await fixture(transport);
    await f.t.run(ctx => ctx.db.patch(f.ids.employeeId, { isActive: false }));
    const oldId = await f.t.run(async ctx => {
      const runId = await ctx.db.insert("deviceSyncRuns", { projectId: f.ids.projectId, startedBy: f.ids.userId, kind: "project_resync", status: "failed", startedAt: Date.now(), counts: { queued: 0, sent: 0, verified: 0, failed: 1, skipped: 0, unknown: 0 } });
      return await ctx.db.insert("hikPendingOperations", { projectId: f.ids.projectId, deviceId: f.ids.deviceId, runId, operation: transport === "gateway" ? "deletePerson" : "deleteCard", status: "failed", attemptCount: 5, createdAt: Date.now(), payload: { employeeId: f.ids.employeeId, cardNumber: "OLD" } });
    });
    await f.t.action(internal.actions.hikvisionSync.deleteEmployeeFromDevicesInternal, { employeeId: f.ids.employeeId, snapshot: await f.snapshot() });
    if (transport === "localBridge") {
      const claimed = await f.t.mutation(internal.hikvisionSync.claimLocalBridgeOperations, { token: "test-token" });
      const op = claimed.operations[0]; if (!op) throw new Error("operation");
      await f.t.mutation(internal.hikvisionSync.ackLocalBridgeOperation, { token: "test-token", opId: op.opId, ok: true });
    }
    expect(await f.t.run(ctx => ctx.db.get(oldId))).toMatchObject({ status: "failed", dismissedAt: expect.any(Number) });
    expect((await f.admin.query(api.hikvisionSync.listSyncIssues, { projectId: f.ids.projectId })).items).toHaveLength(0);
  });

  it("gateway queue retry reopens terminal deletion after the employee was removed", async () => {
    const f = await fixture();
    wire.remove.mockResolvedValue({ ok: false, error: "offline" });
    await f.admin.mutation(api.employees.remove, { employeeId: f.ids.employeeId }); await f.drain();
    const op = (await f.operations())[0]; if (!op) throw new Error("operation");
    await f.t.run(ctx => ctx.db.patch(op._id, { attemptCount: 5 }));
    wire.remove.mockResolvedValue({ ok: true });
    await f.admin.mutation(api.hikvisionSync.retrySyncIssue, { issueId: op._id }); await f.drain();
    expect((await f.operations())[0]?.status).toBe("done");
    expect(wire.remove).toHaveBeenLastCalledWith("local-index", "OLD");
  });

  it("five localBridge deletion failures stay visible without falsely acknowledging removal", async () => {
    const f = await fixture("localBridge");
    await f.t.run(ctx => ctx.db.patch(f.ids.employeeId, { isActive: false }));
    await f.t.action(internal.actions.hikvisionSync.deleteEmployeeFromDevicesInternal, { employeeId: f.ids.employeeId, snapshot: await f.snapshot() });
    const op = (await f.operations())[0]; if (!op) throw new Error("operation");
    for (let attempt = 0; attempt < 5; attempt++) {
      if (attempt) await f.admin.mutation(api.hikvisionSync.retrySyncIssue, { issueId: op._id });
      await f.t.mutation(internal.hikvisionSync.claimLocalBridgeOperations, { token: "test-token" });
      await f.t.mutation(internal.hikvisionSync.ackLocalBridgeOperation, { token: "test-token", opId: op._id, ok: false, message: "rejected" });
    }
    await f.t.run(ctx => ctx.db.patch(op._id, { attemptCount: 5, createdAt: Date.now() - 172800000 }));
    await f.t.mutation(internal.hikvisionSync.cleanupStaleSyncIssues, {});
    expect((await f.operations())[0]).toMatchObject({ status: "failed", lastError: expect.stringContaining("cihazda kalmış olabilir") });
    expect(await f.t.run(ctx => ctx.db.query("accessGrantStatus").first())).toMatchObject({ state: "failed" });
  });

  it("grant redistribution accepts a deleted person only with stored same-project deletion identity", async () => {
    const f = await fixture();
    wire.remove.mockResolvedValue({ ok: false, error: "offline" });
    await f.admin.mutation(api.employees.remove, { employeeId: f.ids.employeeId });
    await f.drain();
    wire.remove.mockResolvedValue({ ok: true });
    const result = await f.admin.mutation(api.accessGrantStatus.redistribute, { projectId: f.ids.projectId, pairs: [{ employeeId: f.ids.employeeId, deviceId: f.ids.deviceId }] });
    await f.drain();
    expect((await f.t.run(ctx => ctx.db.get(result.runId)))?.status).toBe("done");
    expect((await f.operations()).filter(op => op.status === "failed")).toHaveLength(0);
    await expect(f.admin.mutation(api.accessGrantStatus.redistribute, { projectId: f.ids.projectId, pairs: [{ employeeId: f.ids.employeeId, deviceId: f.ids.foreignDeviceId }] })).rejects.toThrow();
  });
});

describe("Hik revocation fix regressions", () => {
  it.each(["cron", "manual", "redistribute", "bridge"] as const)("%s protects a reauthorized credential and leaves its grant effective", async path => {
    const f = await fixture(path === "bridge" ? "localBridge" : "gateway");
    const opId = await f.t.run(async ctx => {
      await ctx.db.insert("accessGrantStatus", { projectId: f.ids.projectId, employeeId: f.ids.employeeId, deviceId: f.ids.deviceId, state: "effective", ruleIds: [f.ids.ruleId], updatedAt: Date.now() });
      return ctx.db.insert("hikPendingOperations", { projectId: f.ids.projectId, deviceId: f.ids.deviceId, operation: path === "bridge" ? "deleteCard" : "deletePerson", status: path === "bridge" ? "pending" : "failed", attemptCount: 0, createdAt: Date.now(), payload: { employeeId: f.ids.employeeId, employeeNo: "OLD" } });
    });
    if (path === "cron") await f.t.action(internal.actions.hikQueueWorker.processHikQueue, {});
    if (path === "manual") expect(await f.admin.mutation(api.hikvisionSync.retrySyncIssue, { issueId: opId })).toEqual({ queued: false });
    if (path === "redistribute") {
      await f.admin.mutation(api.accessGrantStatus.redistribute, { projectId: f.ids.projectId, pairs: [{ employeeId: f.ids.employeeId, deviceId: f.ids.deviceId }] });
      await f.drain();
    }
    if (path === "bridge") expect((await f.t.mutation(internal.hikvisionSync.claimLocalBridgeOperations, { token: "test-token" })).operations).toHaveLength(0);
    expect(wire.remove).not.toHaveBeenCalled();
    expect(await f.t.run(ctx => ctx.db.get(opId))).toMatchObject({ status: "done", lastError: expect.stringContaining("Yerine geçildi") });
    expect(await f.t.run(ctx => ctx.db.query("accessGrantStatus").first())).toMatchObject({ state: "effective" });
  });

  it.each([false, true])("card reassignment protects the new owner (successful add: %s)", async sync => {
    const f = await fixture();
    const { employeeId, opId } = await f.t.run(async ctx => {
      await ctx.db.patch(f.ids.employeeId, { cardNumber: "NEW" });
      const employeeId = await ctx.db.insert("employees", { projectId: f.ids.projectId, firstName: "Synthetic", lastName: "New owner", email: "new@example.test", cardNumber: "OLD", isActive: true });
      await ctx.db.insert("groupMembers", { projectId: f.ids.projectId, groupId: f.ids.ruleId, employeeId, createdAt: "" });
      const opId = await ctx.db.insert("hikPendingOperations", { projectId: f.ids.projectId, deviceId: f.ids.deviceId, operation: "deletePerson", status: "failed", attemptCount: 0, createdAt: Date.now(), payload: { employeeId: f.ids.employeeId, employeeNo: "OLD" } });
      return { employeeId, opId };
    });
    if (sync) await f.t.action(internal.actions.hikvisionSync.syncEmployeeToDevicesInternal, { employeeId });
    else await f.t.action(internal.actions.hikQueueWorker.processHikQueue, {});
    expect(wire.remove).not.toHaveBeenCalled();
    expect(await f.t.run(ctx => ctx.db.get(opId))).toMatchObject({ status: "done", lastError: expect.stringContaining("Yerine geçildi") });
  });

  it("a deferred removal still deletes its frozen card after the employee changes cards", async () => {
    const f = await fixture();
    const snapshot = await f.snapshot();
    await f.t.run(async ctx => {
      await ctx.db.patch(f.ids.employeeId, { cardNumber: "NEW" });
      await reconcileRemovedEmployeeHik(ctx, f.ids.employeeId, snapshot);
    });
    await f.drain();
    expect(wire.remove).toHaveBeenCalledExactlyOnceWith("local-index", "OLD");
    expect(wire.send).toHaveBeenCalledWith("local-index", expect.objectContaining({ employeeNo: "NEW" }));
  });

  it("an add acknowledgement cannot supersede a newer revocation with no live rights", async () => {
    const f = await fixture();
    const id = await f.t.run(async ctx => {
      await ctx.db.delete(f.ids.memberId);
      return ctx.db.insert("hikPendingOperations", { projectId: f.ids.projectId, deviceId: f.ids.deviceId, operation: "deletePerson", status: "failed", attemptCount: 0, createdAt: Date.now(), payload: { employeeId: f.ids.employeeId, employeeNo: "OLD" } });
    });
    await f.t.mutation(internal.hikvisionSync.supersedePersonDeletions, { deviceId: f.ids.deviceId, cardNumber: "OLD" });
    expect(await f.t.run(ctx => ctx.db.get(id))).toMatchObject({ status: "failed" });
  });

  it("K-02: card and project change is rejected before old identity or device targets change", async () => {
    const f = await fixture();
    await f.t.run(async ctx => {
      await ctx.db.insert("userProjects", { userId: f.ids.userId, projectId: f.ids.otherProjectId });
      const groupId = await ctx.db.insert("accessRules", { projectId: f.ids.otherProjectId, name: "New project", isActive: true, hikWeekPlanNo: 3 });
      await ctx.db.insert("groupMembers", { projectId: f.ids.otherProjectId, groupId, employeeId: f.ids.employeeId, createdAt: "" });
      await ctx.db.insert("groupDevices", { projectId: f.ids.otherProjectId, groupId, deviceId: f.ids.foreignDeviceId, createdAt: "" });
    });
    const snapshot = await f.snapshot();
    await expect(f.admin.mutation(api.employees.update, { employeeId: f.ids.employeeId, projectId: f.ids.otherProjectId, cardNumber: "NEW" })).rejects.toThrow("EMPLOYEE_PROJECT_MOVE_UNSUPPORTED");
    expect(await f.t.run(ctx => ctx.db.get(f.ids.employeeId))).toMatchObject({ projectId: f.ids.projectId, cardNumber: "OLD" });
    expect(await f.snapshot()).toEqual(snapshot);
    expect(await f.t.run(ctx => ctx.db.system.query("_scheduled_functions").collect())).toHaveLength(0);
    await f.drain();
    expect(wire.remove).not.toHaveBeenCalled();
    expect(wire.send).not.toHaveBeenCalled();
  });

  it.each(["device", "identity", "moved", "gateway"] as const)("unresolvable %s deletion needs super admin, reason and audit", async missing => {
    const f = await fixture();
    const id = await f.t.run(async ctx => {
      if (missing === "device") await ctx.db.delete(f.ids.deviceId);
      if (missing === "moved") {
        await ctx.db.patch(f.ids.deviceId, { projectId: f.ids.otherProjectId });
        await ctx.db.insert("userProjects", { userId: f.ids.userId, projectId: f.ids.otherProjectId });
      }
      if (missing === "gateway") await ctx.db.patch(f.ids.deviceId, { hikDevIndex: undefined });
      return ctx.db.insert("hikPendingOperations", { projectId: f.ids.projectId, deviceId: f.ids.deviceId, operation: "deletePerson", status: "failed", attemptCount: 5, createdAt: Date.now(), payload: { employeeId: f.ids.employeeId, ...(missing !== "identity" ? { employeeNo: "OLD" } : {}) } });
    });
    expect((await f.admin.query(api.hikvisionSync.listSyncIssues, { projectId: f.ids.projectId })).items.find(op => op._id === id)?.canDismiss).toBe(false);
    expect(await f.admin.mutation(api.hikvisionSync.retrySyncIssue, { issueId: id })).toMatchObject({ queued: false, reason: expect.any(String) });
    await expect(f.admin.mutation(api.hikvisionSync.dismissSyncIssue, { issueId: id, reason: "Cihaz envanterden kaldırıldı" })).rejects.toThrow("süper yönetici");
    await f.t.run(ctx => ctx.db.patch(f.ids.userId, { role: "super_admin" }));
    expect((await f.admin.query(api.hikvisionSync.listSyncIssues, { projectId: f.ids.projectId })).items.find(op => op._id === id)?.canDismiss).toBe(true);
    await expect(f.admin.mutation(api.hikvisionSync.dismissSyncIssue, { issueId: id, reason: "  " })).rejects.toThrow("gerekçesi");
    await f.admin.mutation(api.hikvisionSync.dismissSyncIssue, { issueId: id, reason: "Eski kayıt inceleme sonucu kapatıldı" });
    expect(await f.t.run(ctx => ctx.db.get(id))).toMatchObject({ status: "failed", dismissedBy: f.ids.userId, dismissedAt: expect.any(Number) });
    expect(await f.t.run(ctx => ctx.db.query("auditLog").collect())).toEqual(expect.arrayContaining([expect.objectContaining({ targetId: id, note: expect.stringContaining("Eski kayıt inceleme sonucu kapatıldı") })]));
  });

  it.each(["member", "remove", "inactive", "offlineDevice"] as const)("500 members: %s freezes only affected targets with bounded scheduling", async kind => {
    const f = await fixture();
    await f.t.run(async ctx => {
      for (let i = 1; i < 500; i++) {
        const employeeId = await ctx.db.insert("employees", { projectId: f.ids.projectId, firstName: "Synthetic", lastName: String(i), email: `scale-${i}@example.test`, cardNumber: `CARD-${i}`, isActive: true });
        await ctx.db.insert("groupMembers", { projectId: f.ids.projectId, groupId: f.ids.ruleId, employeeId, createdAt: "" });
      }
      if (kind === "offlineDevice") await ctx.db.patch(f.ids.deviceId, { status: "offline" });
    });
    const invoke = async (registered: unknown, args: Record<string, unknown>) => {
      let readCalls = 0;
      await f.admin.run(async ctx => {
        const db = new Proxy(ctx.db, { get(target, key, receiver) {
          const value: unknown = Reflect.get(target, key, receiver);
          if ((key === "get" || key === "query") && typeof value === "function") return (...params: unknown[]) => {
            readCalls++;
            if (readCalls > 3000) throw new Error("Fixture transaction read budget exceeded");
            return Reflect.apply(value, target, params);
          };
          return value;
        } });
        const handler = (registered as { _handler: (ctx: MutationCtx, args: Record<string, unknown>) => Promise<unknown> })._handler;
        await handler({ ...ctx, db }, args);
      });
      expect(readCalls).toBeLessThan(3000);
    };
    if (kind === "remove") await invoke(accessRules.remove, { ruleId: f.ids.ruleId });
    else if (kind === "inactive") await invoke(accessRules.update, { ruleId: f.ids.ruleId, isActive: false });
    else await invoke(accessRules.updateWithGroupsTracked, { ruleId: f.ids.ruleId, relationDiff: {
      employees: { added: [], removed: kind === "member" ? [f.ids.employeeId] : [] }, devices: { added: [], removed: [] }, doors: { added: [], removed: kind === "offlineDevice" ? [f.ids.doorId] : [] },
    } });
    const jobs = await f.t.run(ctx => ctx.db.system.query("_scheduled_functions").collect());
    expect(jobs.length).toBeLessThanOrEqual(6);
    if (kind === "offlineDevice") expect(jobs.filter(job => job.name.includes("deleteOfflineHikBatch"))).toHaveLength(1);
    await f.drain();
    expect(wire.remove).toHaveBeenCalledTimes(kind === "member" ? 1 : 500);
  }, 30000);
});

describe("Hik revocation fix 2 regressions", () => {
  it("bridge delivers P's deletion after adding multi-plan C and revoking door 2 from A", async () => {
    const f = await fixture("localBridge");
    const extra = await f.t.run(async ctx => {
      await ctx.db.patch(f.ids.deviceId, { hikDoorCount: 3 });
      const door2 = await ctx.db.insert("doors", { projectId: f.ids.projectId, name: "Door 2", deviceId: f.ids.deviceId, hikDoorNo: 2 });
      const door3 = await ctx.db.insert("doors", { projectId: f.ids.projectId, name: "Door 3", deviceId: f.ids.deviceId, hikDoorNo: 3 });
      const door2Link = await ctx.db.insert("groupDoors", { projectId: f.ids.projectId, groupId: f.ids.ruleId, deviceId: f.ids.deviceId, doorId: door2, createdAt: "" });
      const ruleC = await ctx.db.insert("accessRules", { projectId: f.ids.projectId, name: "C", isActive: true, hikWeekPlanNo: 3 });
      await ctx.db.insert("groupDoors", { projectId: f.ids.projectId, groupId: ruleC, deviceId: f.ids.deviceId, doorId: door3, createdAt: "" });
      return { ruleC, door2Link };
    });
    await f.t.action(internal.actions.hikvisionSync.syncEmployeeToDevicesInternal, { employeeId: f.ids.employeeId });
    const firstClaim = await f.t.mutation(internal.hikvisionSync.claimLocalBridgeOperations, { token: "test-token" });
    for (const op of firstClaim.operations) await f.t.mutation(internal.hikvisionSync.ackLocalBridgeOperation, { token: "test-token", opId: op.opId, ok: true });
    expect(firstClaim.operations.find(op => op.operation === "addPerson")?.payload).toMatchObject({ doorRights: [1, 2] });
    await f.t.run(ctx => ctx.db.insert("groupMembers", { projectId: f.ids.projectId, groupId: extra.ruleC, employeeId: f.ids.employeeId, createdAt: "" }));
    expect((await f.t.action(internal.actions.hikvisionSync.syncEmployeeToDevicesInternal, { employeeId: f.ids.employeeId })).failed).toBe(1);
    await f.t.run(ctx => ctx.db.delete(extra.door2Link));
    expect((await f.t.action(internal.actions.hikvisionSync.syncEmployeeToDevicesInternal, { employeeId: f.ids.employeeId })).failed).toBe(1);
    const claim = await f.t.mutation(internal.hikvisionSync.claimLocalBridgeOperations, { token: "test-token" });
    const removal = claim.operations.find(op => op.operation === "deleteCard");
    expect(removal?.payload).toMatchObject({ employeeId: f.ids.employeeId, employeeNo: "OLD" });
    if (!removal) throw new Error("missing deletion");
    expect(await f.t.run(ctx => ctx.db.get(removal.opId))).toMatchObject({ status: "processing" });
    await f.t.mutation(internal.hikvisionSync.ackLocalBridgeOperation, { token: "test-token", opId: removal.opId, ok: true });
    expect(await f.t.run(ctx => ctx.db.query("accessGrantStatus").first())).toMatchObject({ state: "removed" });
  });

  it.each(["gateway", "localBridge"] as const)("%s has no protected credential when selected doors are unusable", async transport => {
    const f = await fixture(transport);
    await f.t.run(ctx => ctx.db.patch(f.ids.doorId, { hikDoorNo: 0 }));
    expect(await f.t.mutation(internal.hikvisionSync.protectPersonDeletion, { deviceId: f.ids.deviceId, cardNumber: "OLD" })).toBe(false);
  });

  it.each([
    { change: "moved", batch: "offline" }, { change: "deleted", batch: "offline" },
    { change: "moved", batch: "mutation" }, { change: "deleted", batch: "mutation" },
  ])("$batch: $change device during deferred removal preserves all 60 identities and continuation", async ({ change, batch }) => {
    const f = await fixture();
    const snapshot = await f.snapshot();
    const device = snapshot.devices[0]; if (!device) throw new Error("device");
    const entries = Array.from({ length: 60 }, (_, index) => ({ employeeId: f.ids.employeeId, cardNumber: `OLD-${index}` }));
    const runId = await f.t.run(async ctx => {
      const runId = await ctx.db.insert("deviceSyncRuns", { projectId: f.ids.projectId, kind: "rule_sync", startedBy: f.ids.userId, startedAt: Date.now(), status: "running", counts: { queued: 0, sent: 0, verified: 0, failed: 0, skipped: 0, unknown: 0 } });
      if (batch === "offline") await ctx.scheduler.runAfter(0, internal.deviceSyncRuns.deleteOfflineHikBatch, { projectId: f.ids.projectId, device, runId, entries });
      else await ctx.scheduler.runAfter(0, internal.accessRules.reconcileHikRemovalBatch, { projectId: f.ids.projectId, devices: [device], entries });
      if (change === "moved") await ctx.db.patch(f.ids.deviceId, { projectId: f.ids.otherProjectId });
      else await ctx.db.delete(f.ids.deviceId);
      return runId;
    });
    await f.drain();
    const failures = (await f.operations()).filter(op => op.operation === "deletePerson" && op.status === "failed");
    expect(failures).toHaveLength(60);
    expect(new Set(failures.map(op => (op.payload as { employeeNo: string }).employeeNo)).size).toBe(60);
    expect(wire.remove).not.toHaveBeenCalled();
    expect((await f.admin.query(api.hikvisionSync.listSyncIssues, { projectId: f.ids.projectId })).items.length).toBe(50);
    await f.t.action(internal.deviceSyncRuns.deleteOfflineHikBatch, { projectId: f.ids.projectId, device, runId, entries: [] });
    expect(await f.operations()).toHaveLength(60);
  });

  it("offline batch schedules its continuation before an entry action throws", async () => {
    const f = await fixture();
    const snapshot = await f.snapshot();
    const device = snapshot.devices[0]; if (!device) throw new Error("device");
    const runId = await f.t.run(ctx => ctx.db.insert("deviceSyncRuns", { projectId: f.ids.projectId, kind: "rule_sync", startedBy: f.ids.userId, startedAt: Date.now(), status: "running", counts: { queued: 0, sent: 0, verified: 0, failed: 0, skipped: 0, unknown: 0 } }));
    const events: string[] = [];
    let calls = 0;
    const handler = (deviceSyncRuns.deleteOfflineHikBatch as unknown as { _handler: (ctx: ActionCtx, args: FunctionArgs<typeof internal.deviceSyncRuns.deleteOfflineHikBatch>) => Promise<void> })._handler;
    await f.t.action(async ctx => handler({ ...ctx,
      scheduler: new Proxy(ctx.scheduler, { get(target, key) {
        if (key === "runAfter") return (...args: unknown[]) => { events.push("continuation"); return Reflect.apply(target.runAfter, target, args); };
        return Reflect.get(target, key);
      } }),
      runAction: new Proxy(ctx.runAction, { apply(target, thisArg, args) {
        events.push("entry");
        if (++calls === 1) throw new Error("Synthetic action failure");
        return Reflect.apply(target, thisArg, args);
      } }),
    }, { device, runId, projectId: f.ids.projectId, entries: Array.from({ length: 30 }, (_, index) => ({ employeeId: f.ids.employeeId, cardNumber: `FROZEN-${index}` })) }));
    expect(events[0]).toBe("continuation");
    expect(calls).toBe(25);
    await f.drain();
    expect(wire.remove).toHaveBeenCalledTimes(29);
    expect((await f.operations()).filter(op => op.status === "failed")).toEqual([expect.objectContaining({ payload: expect.objectContaining({ employeeNo: "FROZEN-0" }) })]);
  });

  it("mutation batch isolates an entry failure, carries devices once, and drains the rest", async () => {
    const f = await fixture();
    const snapshot = await f.snapshot();
    await f.t.run(ctx => ctx.db.delete(f.ids.memberId));
    const entries = Array.from({ length: 30 }, (_, index) => ({ employeeId: f.ids.employeeId, cardNumber: `FROZEN-${index}` }));
    let calls = 0;
    const handler = (accessRules.reconcileHikRemovalBatch as unknown as { _handler: (ctx: MutationCtx, args: FunctionArgs<typeof internal.accessRules.reconcileHikRemovalBatch>) => Promise<void> })._handler;
    await f.t.run(async ctx => handler({ ...ctx, runMutation: new Proxy(ctx.runMutation, { apply(target, thisArg, args) {
      if (getFunctionName(args[0]) === "accessRules:reconcileHikRemovalEntry" && ++calls === 1) throw new Error("Synthetic entry failure");
      return Reflect.apply(target, thisArg, args);
    } }) }, { projectId: snapshot.projectId, devices: snapshot.devices, entries }));
    expect(calls).toBe(25);
    const continuation = (await f.t.run(ctx => ctx.db.system.query("_scheduled_functions").collect())).find(job => job.name.includes("reconcileHikRemovalBatch"));
    expect(continuation?.args).toEqual([{ projectId: snapshot.projectId, devices: snapshot.devices, entries: entries.slice(25) }]);
    await f.drain();
    expect(wire.remove).toHaveBeenCalledTimes(29);
    expect((await f.operations()).filter(op => op.status === "failed")).toEqual([expect.objectContaining({ payload: expect.objectContaining({ employeeNo: "FROZEN-0" }) })]);
    const before = await f.t.run(ctx => ctx.db.system.query("_scheduled_functions").collect());
    await f.t.mutation(internal.accessRules.reconcileHikRemovalBatch, { projectId: snapshot.projectId, devices: snapshot.devices, entries: [] });
    expect(await f.t.run(ctx => ctx.db.system.query("_scheduled_functions").collect())).toHaveLength(before.length);
  });

  it("500 bridge add acknowledgements read linearly and still close a failed deletion", async () => {
    const f = await fixture("localBridge");
    const ids = await f.t.run(async ctx => {
      const pending = [];
      for (let index = 0; index < 500; index++) {
        const employeeId = index === 0 ? f.ids.employeeId : await ctx.db.insert("employees", { projectId: f.ids.projectId, firstName: "Synthetic", lastName: String(index), email: `linear-${index}@example.test`, cardNumber: `CARD-${index}`, isActive: true });
        if (index > 0) await ctx.db.insert("groupMembers", { projectId: f.ids.projectId, groupId: f.ids.ruleId, employeeId, createdAt: "" });
        pending.push(await ctx.db.insert("hikPendingOperations", { deviceId: f.ids.deviceId, projectId: f.ids.projectId, operation: "addPerson", status: "pending", attemptCount: 0, createdAt: Date.now(), payload: { employeeId, employeeNo: index === 0 ? "OLD" : `CARD-${index}` } }));
      }
      const failed = await ctx.db.insert("hikPendingOperations", { deviceId: f.ids.deviceId, projectId: f.ids.projectId, operation: "deletePerson", status: "failed", attemptCount: 1, createdAt: Date.now(), payload: { employeeId: f.ids.employeeId, employeeNo: "OLD" } });
      const deletion = await ctx.db.insert("hikPendingOperations", { deviceId: f.ids.deviceId, projectId: f.ids.projectId, operation: "deleteCard", status: "pending", attemptCount: 0, createdAt: Date.now(), payload: { employeeId: f.ids.employeeId, employeeNo: "OLD" } });
      return { pending, failed, deletion };
    });
    let readDocuments = 0;
    const queryProxy = (query: object): object => new Proxy(query, { get(target, key) {
      const value: unknown = Reflect.get(target, key);
      if (typeof value !== "function") return value;
      return (...args: unknown[]) => {
        const result: unknown = Reflect.apply(value, target, args);
        if (["take", "collect", "first", "unique"].includes(String(key))) return Promise.resolve(result).then(rows => {
          readDocuments += Array.isArray(rows) ? rows.length : rows ? 1 : 0;
          return rows;
        });
        return result !== null && typeof result === "object" ? queryProxy(result) : result;
      };
    } });
    const handler = (hikvisionSync.ackLocalBridgeOperation as unknown as { _handler: (ctx: MutationCtx, args: FunctionArgs<typeof internal.hikvisionSync.ackLocalBridgeOperation>) => Promise<unknown> })._handler;
    for (const opId of ids.pending) await f.t.run(async ctx => {
      await ctx.db.patch(opId, { status: "processing" });
      const db = new Proxy(ctx.db, { get(target, key) {
        const value: unknown = Reflect.get(target, key);
        if (key === "get" && typeof value === "function") return async (...args: unknown[]) => { readDocuments++; return Reflect.apply(value, target, args); };
        if (key === "query") return (...args: unknown[]) => queryProxy(Reflect.apply(target.query, target, args));
        return value;
      } });
      await handler({ ...ctx, db }, { token: "test-token", opId, ok: true });
    });
    expect(readDocuments).toBeLessThan(500 * 25);
    expect(await f.t.run(ctx => ctx.db.get(ids.failed))).toMatchObject({ status: "done", lastError: expect.stringContaining("Yerine geçildi") });
    expect(await f.t.run(ctx => ctx.db.get(ids.deletion))).toMatchObject({ status: "pending" });
    expect((await f.t.mutation(internal.hikvisionSync.claimLocalBridgeOperations, { token: "test-token" })).operations).toHaveLength(0);
    expect(await f.t.run(ctx => ctx.db.get(ids.deletion))).toMatchObject({ status: "done" });
  }, 30000);
  it("4097 failed rows do not block bridge claim or acknowledgement", async () => {
    const f = await fixture("localBridge");
    const ids = await f.t.run(async ctx => {
      const base = { deviceId: f.ids.deviceId, projectId: f.ids.projectId, attemptCount: 1, createdAt: Date.now() };
      const failed = await ctx.db.insert("hikPendingOperations", { ...base, operation: "deleteCard", status: "failed", payload: { employeeNo: "OLD" } });
      for (let index = 0; index < 4096; index++) await ctx.db.insert("hikPendingOperations", { ...base, operation: "addPerson", status: "failed", payload: { employeeNo: `OTHER-${index}` } });
      const deletion = await ctx.db.insert("hikPendingOperations", { ...base, operation: "deletePerson", status: "pending", payload: { employeeNo: "OLD" } });
      const add = await ctx.db.insert("hikPendingOperations", { ...base, operation: "addPerson", status: "pending", payload: { employeeId: f.ids.employeeId, employeeNo: "OLD" } });
      return { failed, deletion, add };
    });
    const claimed = await f.t.mutation(internal.hikvisionSync.claimLocalBridgeOperations, { token: "test-token" });
    expect(claimed.operations.map(op => op.opId)).toEqual([ids.add]);
    expect(await f.t.run(ctx => ctx.db.get(ids.deletion))).toMatchObject({ status: "done" });
    await f.t.run(ctx => ctx.db.patch(ids.failed, { status: "failed" }));
    await expect(f.t.mutation(internal.hikvisionSync.ackLocalBridgeOperation, { token: "test-token", opId: ids.add, ok: true })).resolves.toEqual({ ok: true });
    expect(await f.t.run(ctx => ctx.db.get(ids.failed))).toMatchObject({ status: "done" });
    expect(await f.t.run(ctx => ctx.db.get(ids.add))).toMatchObject({ status: "done" });
  }, 30000);

  it("cleanup looks past 500 old failed deletions without closing them and stops at four pages", async () => {
    const f = await fixture();
    const ids = await f.t.run(async ctx => {
      const base = { deviceId: f.ids.deviceId, projectId: f.ids.projectId, status: "failed" as const, attemptCount: 5, payload: {}, createdAt: Date.now() - 172800000 };
      const deletions = [];
      for (let index = 0; index < 500; index++) deletions.push(await ctx.db.insert("hikPendingOperations", { ...base, operation: index % 2 ? "deleteCard" : "deletePerson" }));
      const terminal = await ctx.db.insert("hikPendingOperations", { ...base, operation: "addPerson", createdAt: base.createdAt + 1 });
      for (let index = 0; index < 1499; index++) await ctx.db.insert("hikPendingOperations", { ...base, operation: "deletePerson", createdAt: base.createdAt + 2 });
      const beyondLimit = await ctx.db.insert("hikPendingOperations", { ...base, operation: "addPerson", createdAt: base.createdAt + 3 });
      return { deletions, terminal, beyondLimit };
    });
    expect(await f.t.mutation(internal.hikvisionSync.cleanupStaleSyncIssues, {})).toEqual({ dismissed: 1 });
    expect(await f.t.run(ctx => ctx.db.get(ids.terminal))).toMatchObject({ status: "done", dismissedAt: expect.any(Number) });
    expect(await f.t.run(ctx => ctx.db.get(ids.beyondLimit))).toMatchObject({ status: "failed" });
    const deletions = await f.t.run(ctx => Promise.all(ids.deletions.map(id => ctx.db.get(id))));
    expect(deletions.every(op => op?.status === "failed" && op.dismissedAt === undefined)).toBe(true);
  }, 30000);

  it.each(["ack", "additionCleanup"] as const)("%s reads the access graph only for a matching failed deletion", async path => {
    const f = await fixture("localBridge");
    let graphQueries = 0;
    const run = async () => f.t.run(async ctx => {
      const db = new Proxy(ctx.db, { get(target, key) {
        if (key === "query") return (...args: Parameters<typeof target.query>) => {
          if (["employees", "groupMembers", "groupDevices", "groupDoors", "doors"].includes(args[0])) graphQueries++;
          return target.query(...args);
        };
        return Reflect.get(target, key);
      } });
      if (path === "additionCleanup") {
        const handler = (hikvisionSync.supersedePersonDeletions as unknown as { _handler: (ctx: MutationCtx, args: FunctionArgs<typeof internal.hikvisionSync.supersedePersonDeletions>) => Promise<unknown> })._handler;
        return handler({ ...ctx, db }, { deviceId: f.ids.deviceId, cardNumber: "OLD" });
      }
      const opId = await ctx.db.insert("hikPendingOperations", { deviceId: f.ids.deviceId, projectId: f.ids.projectId, operation: "addPerson", status: "processing", attemptCount: 1, createdAt: Date.now(), payload: { employeeId: f.ids.employeeId, employeeNo: "OLD" } });
      const handler = (hikvisionSync.ackLocalBridgeOperation as unknown as { _handler: (ctx: MutationCtx, args: FunctionArgs<typeof internal.hikvisionSync.ackLocalBridgeOperation>) => Promise<unknown> })._handler;
      return handler({ ...ctx, db }, { token: "test-token", opId, ok: true });
    });
    await f.t.run(async ctx => {
      const base = { deviceId: f.ids.deviceId, projectId: f.ids.projectId, status: "failed" as const, attemptCount: 1, createdAt: Date.now() };
      await ctx.db.insert("hikPendingOperations", { ...base, operation: "deleteCard", payload: { employeeNo: "OTHER" } });
      await ctx.db.insert("hikPendingOperations", { ...base, operation: "addPerson", payload: { employeeNo: "OLD" } });
      await ctx.db.insert("hikPendingOperations", { ...base, deviceId: f.ids.foreignDeviceId, operation: "deletePerson", payload: { employeeNo: "OLD" } });
    });
    await run();
    expect(graphQueries).toBe(0);
    const deletion = await f.t.run(ctx => ctx.db.insert("hikPendingOperations", { deviceId: f.ids.deviceId, projectId: f.ids.projectId, operation: "deletePerson", status: "failed", attemptCount: 1, createdAt: Date.now(), payload: { employeeNo: "OLD" } }));
    await run();
    expect(graphQueries).toBeGreaterThan(0);
    expect(await f.t.run(ctx => ctx.db.get(deletion))).toMatchObject({ status: "done", lastError: expect.stringContaining("Yerine geçildi") });
  });

});
