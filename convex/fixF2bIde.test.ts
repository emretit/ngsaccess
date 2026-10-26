// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import schema from "./schema";
import { ideUserAccessWindow, ideUserEndFromAccessEnd } from "./ideSync";
import { grantRuleScope, upsertGrantStatus } from "./lib/grantStatus";

const modules = import.meta.glob("./**/*.ts");
const now = "2026-10-26T10:00:00Z";
const timestamps = { createdAt: now, updatedAt: now };
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(now)); });
afterEach(() => vi.useRealTimers());

async function fixture(role: "admin" | "viewer" = "admin") {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "A", isActive: true });
    const otherProjectId = await ctx.db.insert("projects", { name: "B", isActive: true });
    const userId = await ctx.db.insert("users", { role: "project_user", verified: true });
    await ctx.db.insert("userProjects", { userId, projectId, role });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 86400000 });
    const deviceId = await ctx.db.insert("devices", { projectId, name: "IDE", brand: "ide_smart", ideUuid: "9001", isActive: true, ...timestamps });
    const doorId = await ctx.db.insert("doors", { projectId, deviceId, name: "Door", ioId: 0, ...timestamps });
    const ruleId = await ctx.db.insert("accessRules", { projectId, name: "Visitor", targetType: "visitor", isActive: true, idePermissionNo: 1 });
    await ctx.db.insert("groupDevices", { projectId, groupId: ruleId, deviceId, createdAt: now });
    const employeeId = await ctx.db.insert("employees", { projectId, firstName: "Old", lastName: "Owner", email: "old@example.test", cardNumber: "123", isActive: true,
      isVisitor: true, visitorStatus: "checkedIn", accessRuleId: ruleId, accessExpiresAt: "2030-01-01T00:00:00Z" });
    await ctx.db.insert("groupMembers", { projectId, groupId: ruleId, employeeId, createdAt: now });
    return { projectId, otherProjectId, userId, sessionId, deviceId, doorId, ruleId, employeeId };
  });
  const caller = t.withIdentity({ subject: `${ids.userId}|${ids.sessionId}` });
  const jobs = () => t.run(ctx => ctx.db.system.query("_scheduled_functions").collect());
  const newOwner = (cardNumber = "00123", overrides: Partial<Doc<"employees">> = {}, linked = true) => t.run(async ctx => {
    const employeeId = await ctx.db.insert("employees", { projectId: ids.projectId, firstName: "New", lastName: "Owner", email: "new@example.test", cardNumber, isActive: true, ...overrides });
    if (linked) await ctx.db.insert("groupMembers", { projectId: overrides.projectId ?? ids.projectId, groupId: ids.ruleId, employeeId, createdAt: now });
    return employeeId;
  });
  const deletion = async () => {
    await t.run(ctx => ctx.db.patch(ids.employeeId, { isActive: false }));
    return t.mutation(internal.ideSync.enqueueIdeOp, { deviceId: ids.deviceId, projectId: ids.projectId,
      opType: "deleteUser", payload: { employeeId: ids.employeeId, ideUserId: 123 } });
  };
  return { t, caller, jobs, newOwner, deletion, ...ids };
}

describe("IDE user access end", () => {
  it("floors UTC milliseconds and preserves past expiry; missing expiry clears end", () => {
    expect(ideUserEndFromAccessEnd(undefined)).toBe(0);
    expect(ideUserEndFromAccessEnd(Date.parse("2026-10-25T10:00:00.999Z"))).toBe(Date.parse("2026-10-25T10:00:00Z") / 1000);
  });

  it.each([
    [{}, 0, 0],
    [{ accessExpiresAt: "2026-10-27T12:34:56.999Z" }, 0, Date.parse("2026-10-27T12:34:56Z") / 1000],
    [{ employmentEndDate: "2026-10-31" }, 0, Date.parse("2026-10-31T20:59:59Z") / 1000],
    [{ accessStartsAt: "2026-10-28T10:00:00Z", accessExpiresAt: "2026-10-27T10:00:00Z" }, 0, Date.parse("2026-10-27T10:00:00Z") / 1000],
    [{ accessStartsAt: "2026-10-27T10:00:00Z", accessExpiresAt: "2026-10-27T10:00:00Z" }, 0, Date.parse("2026-10-27T10:00:00Z") / 1000],
    [{ accessStartsAt: "2026-10-27T10:00:00Z", accessExpiresAt: "2026-10-28T10:00:00Z" }, Date.parse("2026-10-27T10:00:00Z") / 1000, Date.parse("2026-10-28T10:00:00Z") / 1000],
  ])("employee sync writes the full access window %j", async (window, start, end) => {
    const f = await fixture();
    await f.t.run(ctx => ctx.db.patch(f.employeeId, { accessExpiresAt: undefined, ...window }));
    expect(await f.t.action(internal.actions.ideGatewayDevice.syncEmployeeToIdePanels, { employeeId: f.employeeId })).toMatchObject({ ok: true });
    const ops = await f.t.run(ctx => ctx.db.query("idePendingOperations").collect());
    expect(ops.find(op => op.opType === "upsertUser")).toMatchObject({ payload: { userRecord: { id: 123, start, end } } });
    expect(ideUserAccessWindow(window, Date.now())).toEqual({ start, end });
  });

  it("template dispatch also writes expiry and fixes start >= end", async () => {
    const f = await fixture();
    const targetId = await f.t.run(async ctx => {
      const templateId = await ctx.db.insert("accessScheduleTemplates", { projectId: f.projectId, name: "Day", version: 1, ...timestamps,
        week: { Monday: [{ start: "08:00", end: "17:00" }], Tuesday: [], Wednesday: [], Thursday: [], Friday: [], Saturday: [], Sunday: [] } });
      await ctx.db.patch(f.ruleId, { scheduleTemplateId: templateId });
      await ctx.db.patch(f.employeeId, { accessStartsAt: "2026-11-02T00:00:00Z", employmentEndDate: "2026-10-31", accessExpiresAt: undefined });
      const runId = await ctx.db.insert("deviceSyncRuns", { projectId: f.projectId, templateId, kind: "template_sync", startedBy: f.userId, startedAt: Date.now(), status: "running",
        counts: { queued: 1, sent: 0, verified: 0, failed: 0, skipped: 0, unknown: 0 } });
      return ctx.db.insert("deviceSyncRunTargets", { runId, deviceId: f.deviceId, deviceName: "IDE", brand: "ide_smart", status: "queued", updatedAt: Date.now() });
    });
    await f.t.mutation(internal.deviceSyncRuns.enqueueTemplateTarget, { targetId, ruleIds: [f.ruleId], changedRuleIds: [f.ruleId] });
    expect((await f.t.run(ctx => ctx.db.query("idePendingOperations").collect())).find(op => op.opType === "upsertUser"))
      .toMatchObject({ payload: { userRecord: { start: 0, end: Date.parse("2026-10-31T20:59:59Z") / 1000 } } });
  });
});

describe("IDE delayed deletion protects the current credential", () => {
  it.each(["123", "00123"])("supersedes deletion before poll for active owner %s", async card => {
    const f = await fixture();
    const opId = await f.deletion();
    await f.newOwner(card);
    expect((await f.t.query(internal.ideSync.listPendingForBridge, {})).ops).toEqual([]);
    expect((await f.t.mutation(internal.ideSync.pollForBridge, {})).ops).toEqual([]);
    expect(await f.t.run(ctx => ctx.db.get(opId))).toMatchObject({ status: "acked", attempts: 0, responseMessage: expect.stringContaining("superseded") });
    expect(await f.t.mutation(internal.ideSync.markSent, { opId, msxId: 1 })).toBe(false);
  });

  it.each(["absent", "inactive", "otherProject", "unlinked", "expired", "differentCard", "otherPanel", "emptySchedule"])("delivers deletion when the new owner is %s", async state => {
    const f = await fixture();
    if (state !== "absent") await f.newOwner(state === "differentCard" ? "124" : "00123", {
      ...(state === "inactive" ? { isActive: false } : {}),
      ...(state === "otherProject" ? { projectId: f.otherProjectId } : {}),
      ...(state === "expired" ? { accessExpiresAt: "2026-10-25T00:00:00Z" } : {}),
    }, state !== "unlinked");
    if (state === "otherPanel") await f.t.run(async ctx => {
      const otherDeviceId = await ctx.db.insert("devices", { projectId: f.projectId, name: "Other", brand: "ide_smart", ideUuid: "9002", isActive: true, ...timestamps });
      const link = await ctx.db.query("groupDevices").first();
      if (link) await ctx.db.patch(link._id, { deviceId: otherDeviceId });
      await ctx.db.insert("doors", { projectId: f.projectId, deviceId: otherDeviceId, name: "Other", ioId: 0, ...timestamps });
    });
    if (state === "emptySchedule") await f.t.run(async ctx => {
      const templateId = await ctx.db.insert("accessScheduleTemplates", { projectId: f.projectId, name: "Closed", version: 1, ...timestamps,
        week: { Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [], Saturday: [], Sunday: [] } });
      await ctx.db.patch(f.ruleId, { scheduleTemplateId: templateId });
    });
    const opId = await f.deletion();
    await f.t.mutation(internal.ideSync.seedPanelUsers, { deviceId: f.deviceId, rawCards: [123] });
    expect((await f.t.mutation(internal.ideSync.pollForBridge, {})).ops).toMatchObject([{ opId }]);
    expect(await f.t.mutation(internal.ideSync.markSent, { opId, msxId: 1 })).toBe(true);
    await f.t.mutation(internal.ideSync.markAck, { opId, msxId: 1, result: "success" });
    const completed = await f.t.run(ctx => ctx.db.get(opId));
    expect(completed?.status).toBe("acked");
    expect(completed?.responseMessage).toBeUndefined();
    expect(await f.t.run(ctx => ctx.db.query("idePanelUsers").collect())).toEqual([]);
  });

  it("does not protect an owner with one writable and one unresolved rule", async () => {
    const f = await fixture();
    const opId = await f.deletion();
    const employeeId = await f.newOwner();
    await f.t.run(async ctx => {
      const ruleId = await ctx.db.insert("accessRules", { projectId: f.projectId, name: "Broken", targetType: "visitor", isActive: true, idePermissionNo: 2 });
      await ctx.db.insert("groupDevices", { projectId: f.projectId, groupId: ruleId, deviceId: f.deviceId, createdAt: now });
      await ctx.db.insert("groupMembers", { projectId: f.projectId, groupId: ruleId, employeeId, createdAt: now });
      const doorId = await ctx.db.insert("doors", { projectId: f.projectId, deviceId: f.deviceId, name: "Broken", ...timestamps });
      await ctx.db.insert("groupDoors", { groupId: ruleId, doorId, deviceId: f.deviceId, createdAt: now });
    });
    await f.t.action(internal.actions.ideGatewayDevice.syncEmployeeToIdePanels, { employeeId });
    expect((await f.t.mutation(internal.ideSync.pollForBridge, {})).ops.map(op => op.opId)).toContain(opId);
    expect(await f.t.mutation(internal.ideSync.markSent, { opId, msxId: 1 })).toBe(true);
  });

  it.each(["failed", "pending", "acked"] as const)("latest upsert %s controls protection when all rules resolve", async status => {
    const f = await fixture();
    const opId = await f.deletion();
    const employeeId = await f.newOwner();
    await f.t.run(async ctx => {
      const ruleId = await ctx.db.insert("accessRules", { projectId: f.projectId, name: "Second writable", targetType: "visitor", isActive: true, idePermissionNo: 2 });
      await ctx.db.insert("groupDevices", { projectId: f.projectId, groupId: ruleId, deviceId: f.deviceId, createdAt: now });
      await ctx.db.insert("groupMembers", { projectId: f.projectId, groupId: ruleId, employeeId, createdAt: now });
    });
    await f.t.action(internal.actions.ideGatewayDevice.syncEmployeeToIdePanels, { employeeId });
    await f.t.run(async ctx => {
      const op = (await ctx.db.query("idePendingOperations").collect()).find(row => row.opType === "upsertUser");
      if (!op) throw new Error("Upsert missing");
      await ctx.db.patch(op._id, { status });
    });
    const ops = (await f.t.mutation(internal.ideSync.pollForBridge, {})).ops;
    expect(ops.some(op => op.opId === opId)).toBe(status === "failed");
    expect(await f.t.mutation(internal.ideSync.markSent, { opId, msxId: 1 })).toBe(status === "failed");
  });

  it("a newer failed template-run upsert also prevents protection", async () => {
    const f = await fixture();
    const opId = await f.deletion();
    const employeeId = await f.newOwner();
    const firstId = await f.t.mutation(internal.ideSync.enqueueIdeOp, { deviceId: f.deviceId, opType: "upsertUser", payload: { employeeId, userRecord: { id: 123 } } });
    await f.t.run(async ctx => {
      const first = await ctx.db.get(firstId);
      if (!first) throw new Error("Upsert missing");
      const { _id, _creationTime, ...value } = first;
      await ctx.db.insert("idePendingOperations", { ...value, status: "failed", idempotencyKey: `${value.idempotencyKey}:template-run` });
    });
    expect((await f.t.mutation(internal.ideSync.pollForBridge, {})).ops.map(op => op.opId)).toContain(opId);
  });

  it("protects the same owner's current card after access is restored", async () => {
    const f = await fixture();
    const opId = await f.deletion();
    await f.t.run(ctx => ctx.db.patch(f.employeeId, { isActive: true }));
    expect((await f.t.mutation(internal.ideSync.pollForBridge, {})).ops).toEqual([]);
    expect(await f.t.run(ctx => ctx.db.get(opId))).toMatchObject({ responseMessage: expect.stringContaining("superseded") });
  });

  it("rechecks ownership between poll and markSent", async () => {
    const f = await fixture();
    const opId = await f.deletion();
    expect((await f.t.mutation(internal.ideSync.pollForBridge, {})).ops).toHaveLength(1);
    await f.newOwner();
    expect(await f.t.mutation(internal.ideSync.markSent, { opId, msxId: 1 })).toBe(false);
    expect(await f.t.run(ctx => ctx.db.get(opId))).toMatchObject({ responseMessage: expect.stringContaining("superseded") });
  });

  it.each(["success", "fail", "timeout"] as const)("ACK %s after reassignment preserves roster and the new grant", async result => {
    const f = await fixture();
    const opId = await f.deletion();
    await f.t.mutation(internal.ideSync.markSent, { opId, msxId: 1 });
    const employeeId = await f.newOwner();
    await f.t.mutation(internal.ideSync.seedPanelUsers, { deviceId: f.deviceId, rawCards: [123] });
    await f.t.run(ctx => upsertGrantStatus(ctx, { projectId: f.projectId, employeeId, deviceId: f.deviceId, state: "effective" }));
    const before = await f.t.run(ctx => ctx.db.query("accessGrantStatus").collect());
    await f.t.mutation(internal.ideSync.markAck, { opId, msxId: 1, result, ...(result === "fail" ? { errorCode: "not_found" } : {}) });
    expect(await f.t.run(ctx => ctx.db.query("idePanelUsers").collect())).toMatchObject([{ cardNumber: "123" }]);
    expect(await f.t.run(ctx => ctx.db.query("accessGrantStatus").collect())).toEqual(before);
    expect(await f.t.run(ctx => ctx.db.get(opId))).toMatchObject({ status: "acked", responseMessage: expect.stringContaining("superseded") });
  });
});

describe("IDE grant projection", () => {
  it.each([undefined, 1.5, 8])("does not widen selected invalid IO %s; exposes the error before dispatch", async ioId => {
    const f = await fixture();
    await f.t.run(async ctx => {
      const doorId = await ctx.db.insert("doors", { projectId: f.projectId, deviceId: f.deviceId, name: "Broken", ioId, ...timestamps });
      await ctx.db.insert("groupDoors", { groupId: f.ruleId, doorId, deviceId: f.deviceId, createdAt: now });
      const rule = await ctx.db.get(f.ruleId);
      if (!rule) throw new Error("Rule missing");
      expect(await grantRuleScope(ctx, rule)).toMatchObject([{ doors: [], errorCode: "door_io_unresolved" }]);
    });
    const projection = await f.caller.query(api.accessGrantStatus.byEmployee, { employeeId: f.employeeId });
    expect(projection.rows).toMatchObject([{ doorIds: [], state: "failed", lastError: expect.stringContaining("door_io_unresolved") }]);
    expect(projection.unauthorizedDoors.map(door => door.doorId)).toContain(f.doorId);
    await f.t.action(internal.actions.ideGatewayDevice.syncEmployeeToIdePanels, { employeeId: f.employeeId });
    expect((await f.caller.query(api.accessGrantStatus.listByProject, { projectId: f.projectId, paginationOpts: { cursor: null, numItems: 10 } })).page)
      .toMatchObject([{ doorIds: [], state: "failed", lastError: expect.stringContaining("door_io_unresolved") }]);
  });

  it("empty schedules do not report unresolved IO", async () => {
    const f = await fixture();
    await f.t.run(async ctx => {
      await ctx.db.patch(f.doorId, { ioId: undefined });
      const templateId = await ctx.db.insert("accessScheduleTemplates", { projectId: f.projectId, name: "Closed", version: 1, ...timestamps,
        week: { Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [], Saturday: [], Sunday: [] } });
      await ctx.db.patch(f.ruleId, { scheduleTemplateId: templateId });
      const rule = await ctx.db.get(f.ruleId);
      if (!rule) throw new Error("Rule missing");
      expect(await grantRuleScope(ctx, rule)).toMatchObject([{ doors: [], errorCode: undefined }]);
    });
    expect((await f.caller.query(api.accessGrantStatus.byEmployee, { employeeId: f.employeeId })).rows)
      .toMatchObject([{ state: "unknown" }]);
  });

  it("no selection keeps all valid panel doors", async () => {
    const f = await fixture();
    expect((await f.caller.query(api.accessGrantStatus.byEmployee, { employeeId: f.employeeId })).rows)
      .toMatchObject([{ doorIds: [f.doorId], state: "unknown" }]);
  });

  it("valid selection only projects its resolved IO", async () => {
    const f = await fixture();
    const selectedDoorId = await f.t.run(async ctx => {
      const doorId = await ctx.db.insert("doors", { projectId: f.projectId, deviceId: f.deviceId, name: "Selected", ioId: 1, ...timestamps });
      await ctx.db.insert("groupDoors", { groupId: f.ruleId, doorId, deviceId: f.deviceId, createdAt: now });
      return doorId;
    });
    expect((await f.caller.query(api.accessGrantStatus.byEmployee, { employeeId: f.employeeId })).rows)
      .toMatchObject([{ doorIds: [selectedDoorId], state: "unknown" }]);
  });

  it.each([true, false])("deleted selected door never widens scope (device snapshot=%s)", async snapshot => {
    const f = await fixture();
    await f.t.run(async ctx => {
      const doorId = await ctx.db.insert("doors", { projectId: f.projectId, deviceId: f.deviceId, name: "Deleted", ioId: 1, ...timestamps });
      await ctx.db.insert("groupDoors", { groupId: f.ruleId, doorId, ...(snapshot ? { deviceId: f.deviceId } : {}), createdAt: now });
      await ctx.db.delete(doorId);
    });
    expect((await f.t.query(internal.ideSync.getRuleIoIdsForPanel, { ruleId: f.ruleId, deviceId: f.deviceId }))).toEqual([]);
    expect((await f.caller.query(api.accessGrantStatus.byEmployee, { employeeId: f.employeeId })).rows)
      .toMatchObject([{ doorIds: [], state: "failed", lastError: expect.stringContaining("door_io_unresolved") }]);
  });

  it("projection respects role and project boundaries", async () => {
    const f = await fixture("viewer");
    await expect(f.caller.query(api.accessGrantStatus.byEmployee, { employeeId: f.employeeId })).rejects.toThrow("yetkiniz");
    await expect(f.caller.query(api.accessGrantStatus.listByProject, { projectId: f.otherProjectId, paginationOpts: { cursor: null, numItems: 10 } })).rejects.toThrow();
  });
});

describe("visitor removal and expiry-only sync", () => {
  it("checkout without Hik targets schedules only IDE removal; release and reclaim do not duplicate it", async () => {
    const f = await fixture();
    await f.caller.mutation(api.visitors.checkOut, { visitorId: f.employeeId });
    await f.deletion(); // Materialize the checkout removal before card reuse.
    await f.caller.mutation(api.visitors.create, { projectId: f.projectId, firstName: "New", lastName: "Visitor", cardNumber: "123", presetRuleId: f.ruleId, accessExpiresAt: "2030-01-01T00:00:00Z" });
    const jobs = await f.jobs();
    expect(jobs.filter(job => job.name === "actions/hikvisionSync:deleteEmployeeFromDevicesInternal")).toEqual([]);
    expect(jobs.filter(job => job.name === "actions/ideGatewayDevice:deleteIdeUserFromPanels")).toHaveLength(1);
    await f.caller.mutation(api.visitors.releaseCard, { visitorId: f.employeeId });
    expect((await f.jobs()).filter(job => job.name === "actions/ideGatewayDevice:deleteIdeUserFromPanels")).toHaveLength(1);
  });

  it("expiry-only edit schedules both sync paths, with no deletion", async () => {
    const f = await fixture();
    await f.caller.mutation(api.visitors.update, { visitorId: f.employeeId, accessExpiresAt: "2026-10-27T12:00:00Z" });
    expect((await f.jobs()).map(job => job.name).sort()).toEqual(["actions/hikvisionSync:syncEmployeeToDevicesInternal", "actions/ideGatewayDevice:syncEmployeeToIdePanels"].sort());
    expect(await f.t.run(ctx => ctx.db.get(f.employeeId))).toMatchObject({ accessExpiresAt: "2026-10-27T12:00:00.000Z" });
  });

  it.each(["checkedOut", "expired"] as const)("release after %s does not duplicate IDE deletion", async visitorStatus => {
    const f = await fixture();
    await f.t.run(ctx => ctx.db.patch(f.employeeId, { isActive: false, visitorStatus }));
    await f.deletion();
    await f.caller.mutation(api.visitors.releaseCard, { visitorId: f.employeeId });
    expect(await f.jobs()).toEqual([]);
  });

  it.each(["missing", "failed", "superseded"])("release retries ended visitor removal when prior delete is %s", async state => {
    const f = await fixture();
    await f.t.run(ctx => ctx.db.patch(f.employeeId, { isActive: false, visitorStatus: "expired" }));
    if (state !== "missing") {
      const opId = await f.deletion();
      await f.t.run(ctx => ctx.db.patch(opId, state === "failed" ? { status: "failed" } : { status: "acked", responseMessage: "superseded: cleanup skipped" }));
    }
    await f.caller.mutation(api.visitors.releaseCard, { visitorId: f.employeeId });
    expect((await f.jobs()).filter(job => job.name === "actions/ideGatewayDevice:deleteIdeUserFromPanels"))
      .toMatchObject([{ args: [{ cardNumber: "123", deviceIds: [f.deviceId] }] }]);
  });

  it.each(["pending", "sent", "acked"] as const)("release skips matching %s deletion but retries the uncovered panel", async status => {
    const f = await fixture();
    const opId = await f.deletion();
    const otherDeviceId = await f.t.run(async ctx => {
      await ctx.db.patch(f.employeeId, { visitorStatus: "checkedOut" });
      await ctx.db.patch(opId, { status, payload: { ideUserId: "00123" } });
      const deviceId = await ctx.db.insert("devices", { projectId: f.projectId, name: "Other", brand: "ide_smart", ideUuid: "9002", isActive: true, ...timestamps });
      await ctx.db.insert("groupDevices", { projectId: f.projectId, groupId: f.ruleId, deviceId, createdAt: now });
      return deviceId;
    });
    await f.caller.mutation(api.visitors.releaseCard, { visitorId: f.employeeId });
    expect((await f.jobs()).filter(job => job.name === "actions/ideGatewayDevice:deleteIdeUserFromPanels"))
      .toMatchObject([{ args: [{ deviceIds: [otherDeviceId] }] }]);
  });

  it("reclaim retries a failed checkout deletion", async () => {
    const f = await fixture();
    const opId = await f.deletion();
    await f.t.run(async ctx => {
      await ctx.db.patch(f.employeeId, { visitorStatus: "checkedOut" });
      await ctx.db.patch(opId, { status: "failed" });
    });
    await f.caller.mutation(api.visitors.create, { projectId: f.projectId, firstName: "Next", lastName: "Visitor", cardNumber: "123", presetRuleId: f.ruleId, accessExpiresAt: "2030-01-01T00:00:00Z" });
    expect((await f.jobs()).filter(job => job.name === "actions/ideGatewayDevice:deleteIdeUserFromPanels")).toHaveLength(1);
  });

  it("expiry-only edit does not resurrect a checked-out visitor", async () => {
    const f = await fixture();
    await f.t.run(ctx => ctx.db.patch(f.employeeId, { isActive: false, visitorStatus: "checkedOut" }));
    await f.caller.mutation(api.visitors.update, { visitorId: f.employeeId, accessExpiresAt: "2026-10-27T12:00:00Z" });
    expect(await f.jobs()).toEqual([]);
  });

  it("visitor edit rejects missing write permission and foreign project", async () => {
    const f = await fixture("viewer");
    await expect(f.caller.mutation(api.visitors.update, { visitorId: f.employeeId, accessExpiresAt: "2026-10-27T12:00:00Z" })).rejects.toThrow("yetkiniz");
    const admin = await fixture();
    await expect(admin.caller.mutation(api.visitors.update, { visitorId: admin.employeeId, projectId: admin.otherProjectId, accessExpiresAt: "2026-10-27T12:00:00Z" })).rejects.toThrow();
    expect(await admin.jobs()).toEqual([]);
  });
});
