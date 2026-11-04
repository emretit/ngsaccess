// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import type { FunctionArgs } from "convex/server";

const wire = vi.hoisted(() => ({ send: vi.fn(async () => ({ ok: true })), remove: vi.fn(), clear: vi.fn(async () => ({ ok: true })) }));
vi.mock("./lib/hikGateway", async original => ({ ...await original<typeof import("./lib/hikGateway")>(), upsertPersonToDevice: wire.send, addCardToDevice: wire.send, setWeekPlanOnDevice: wire.send, setPlanTemplate: wire.send, deletePersonFromDevice: wire.remove }));
vi.mock("./lib/gateway/core", async original => ({ ...await original<typeof import("./lib/gateway/core")>(), gatewayApiCallChecked: wire.clear }));
beforeEach(() => { vi.useFakeTimers(); wire.send.mockClear(); wire.remove.mockClear(); wire.clear.mockClear(); });
afterEach(() => vi.useRealTimers());

const modules = import.meta.glob("./**/*.ts");
async function setup(brand: "hikvision" | "ide_smart" = "hikvision") {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "Test" });
    const userId = await ctx.db.insert("users", { role: "super_admin", verified: true });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 86400000 });
    const deviceId = await ctx.db.insert("devices", { projectId, name: "Panel", brand, isActive: true, hikDoorCount: 4, ideDoorCount: 4, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    const doorId = await ctx.db.insert("doors", { projectId, deviceId, name: "İlk kapı", hikDoorNo: 1, ioId: 0 });
    return { projectId, deviceId, doorId, userId, sessionId };
  });
  return { ...ids, t, caller: t.withIdentity({ subject: `${ids.userId}|${ids.sessionId}` }) };
}

describe("physical door targets", () => {
  it.each(["hikvision", "ide_smart"] as const)("rejects duplicate %s targets on create and update", async brand => {
    const f = await setup(brand);
    const slot = brand === "hikvision" ? { hikDoorNo: 1 } : { ioId: 0 };
    await expect(f.caller.mutation(api.doors.create, { projectId: f.projectId, deviceId: f.deviceId, name: "Yeni", ...slot })).rejects.toThrow("Bu cihazda aynı kapı numarası zaten kullanılıyor");
    const otherDoorId = await f.t.run(ctx => ctx.db.insert("doors", { projectId: f.projectId, deviceId: f.deviceId, name: "Diğer", hikDoorNo: 2, ioId: 1 }));
    await expect(f.caller.mutation(api.doors.update, { doorId: otherDoorId, ...slot })).rejects.toThrow("Bu cihazda aynı kapı numarası zaten kullanılıyor");
    await f.caller.mutation(api.doors.update, { doorId: f.doorId, name: "Yeni ad", ...slot });
  });
  it.each([0, 1.5, 5, NaN, Infinity])("rejects invalid Hik slot %s", async hikDoorNo => {
    const f = await setup();
    await expect(f.caller.mutation(api.doors.update, { doorId: f.doorId, hikDoorNo })).rejects.toThrow("Kapı numarası");
    await expect(f.caller.mutation(api.doors.create, { projectId: f.projectId, deviceId: f.deviceId, name: "Yeni", hikDoorNo })).rejects.toThrow("Kapı numarası");
  });
  it.each([-1, 0.5, 4, NaN, Infinity])("rejects invalid IDE slot %s", async ioId => {
    const f = await setup("ide_smart");
    await expect(f.caller.mutation(api.doors.update, { doorId: f.doorId, ioId })).rejects.toThrow("Kapı numarası");
    await expect(f.caller.mutation(api.doors.create, { projectId: f.projectId, deviceId: f.deviceId, name: "Yeni", ioId })).rejects.toThrow("Kapı numarası");
  });
});

async function assigned(brand: "hikvision" | "ide_smart" = "hikvision") {
  const f = await setup(brand);
  const ids = await f.t.run(async ctx => {
    await ctx.db.patch(f.deviceId, { hikDevIndex: "old-panel", hikTransport: "gateway", ideUuid: "panel-uuid", ideUser: "test", idePassword: "test", status: "online", hikLastSeenAt: Date.now() });
    const employeeId = await ctx.db.insert("employees", { projectId: f.projectId, firstName: "Ada", lastName: "Test", email: "test@example.test", cardNumber: "42", isActive: true });
    const ruleId = await ctx.db.insert("accessRules", { projectId: f.projectId, name: "Rule", isActive: true, days: ["Monday"], startTime: "09:00", endTime: "18:00", hikWeekPlanNo: 2, idePermissionNo: 10 });
    await ctx.db.insert("groupMembers", { projectId: f.projectId, groupId: ruleId, employeeId, createdAt: "" });
    await ctx.db.insert("groupDevices", { projectId: f.projectId, groupId: ruleId, deviceId: f.deviceId, createdAt: "" });
    const linkId = await ctx.db.insert("groupDoors", { projectId: f.projectId, groupId: ruleId, doorId: f.doorId, deviceId: f.deviceId, createdAt: "" });
    const grantId = await ctx.db.insert("accessGrantStatus", { projectId: f.projectId, employeeId, deviceId: f.deviceId, state: "effective", ruleIds: [ruleId], updatedAt: 1, appliedAt: 1 });
    return { employeeId, ruleId, linkId, grantId };
  });
  return { ...f, ...ids };
}

describe("door target rights synchronization", () => {
  it("Hik 1→2 snapshots the old target and queues a tracked replacement without person deletion", async () => {
    const f = await assigned();
    await f.caller.mutation(api.doors.update, { doorId: f.doorId, hikDoorNo: 2 });
    const ops = await f.t.run(ctx => ctx.db.query("hikPendingOperations").collect());
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({ operation: "updatePerson", payload: { rightsOnly: true, previousDoorNo: 1, nextDoorNo: 2, employeeId: f.employeeId } });
    expect(ops[0].runId).toBeDefined();
    expect(await f.t.run(ctx => ctx.db.get(f.grantId))).toMatchObject({ state: "pending", lastOperationId: ops[0]._id });
    await f.t.action(internal.actions.hikvisionSync.syncDoorRightsOperation, { operationId: ops[0]._id });
    expect(wire.send).toHaveBeenCalledWith("old-panel", expect.objectContaining({ employeeNo: "42", doorPlans: [{ doorNo: 2, planTemplateNos: [2] }] }));
    expect(wire.remove).not.toHaveBeenCalled();
    expect(await f.t.run(ctx => ctx.db.get(f.employeeId))).not.toBeNull();
    expect(await f.t.run(ctx => ctx.db.get(f.grantId))).toMatchObject({ state: "effective" });
  });
  it("moving panels clears old rights, distributes new rights and repairs link snapshots", async () => {
    const f = await assigned();
    const nextDeviceId = await f.t.run(ctx => ctx.db.insert("devices", { name: "New", projectId: f.projectId, brand: "hikvision", hikDevIndex: "new-panel", hikDoorCount: 4, isActive: true, createdAt: "", updatedAt: "" }));
    await f.caller.mutation(api.doors.update, { doorId: f.doorId, deviceId: nextDeviceId, hikDoorNo: 2 });
    const ops = await f.t.run(ctx => ctx.db.query("hikPendingOperations").collect());
    expect(ops).toHaveLength(2);
    expect(ops.every(op => op.operation === "updatePerson")).toBe(true);
    for (const op of ops) await f.t.action(internal.actions.hikvisionSync.syncDoorRightsOperation, { operationId: op._id });
    expect(wire.clear).toHaveBeenCalledWith("/ISAPI/AccessControl/UserInfo/SetUp", "PUT", { UserInfo: { employeeNo: "42", doorRight: "", RightPlan: [] } }, "old-panel");
    expect(wire.send).toHaveBeenCalledWith("new-panel", expect.objectContaining({ doorPlans: [{ doorNo: 2, planTemplateNos: [2] }] }));
    expect(wire.remove).not.toHaveBeenCalled();
    expect(await f.t.run(ctx => ctx.db.get(f.linkId))).toMatchObject({ deviceId: nextDeviceId });
    expect(await f.t.run(ctx => ctx.db.get(f.grantId))).toMatchObject({ state: "removed" });
  });
  it("IDE actuator edits enqueue permission replacement without user removal", async () => {
    const f = await assigned("ide_smart");
    await f.caller.mutation(api.doors.update, { doorId: f.doorId, ioId: 2 });
    const ops = await f.t.run(ctx => ctx.db.query("idePendingOperations").collect());
    expect(ops).toEqual(expect.arrayContaining([expect.objectContaining({ opType: "upsertPermission", payload: expect.objectContaining({ permissionRecord: expect.objectContaining({ io: [2] }) }) })]));
    expect(ops.some(op => op.opType === "deleteUser")).toBe(false);
    expect(await f.t.run(ctx => ctx.db.get(f.grantId))).toMatchObject({ state: "pending" });
    const target = await f.t.run(ctx => ctx.db.query("deviceSyncRunTargets").first());
    if (!target) throw new Error("missing target");
    expect(target.dispatchFinished).toBe(false);
    await f.t.action(internal.doors.syncDoorIdeTarget, { employeeIds: [f.employeeId], deviceId: f.deviceId, targetId: target._id, runId: target.runId });
    expect(await f.t.run(ctx => ctx.db.get(target._id))).toMatchObject({ dispatchFinished: true, status: "queued" });
    const delivered = await f.t.run(ctx => ctx.db.query("idePendingOperations").collect());
    expect(delivered.some(op => op.opType === "upsertUser")).toBe(true);
    expect(delivered.some(op => op.opType === "deleteUser")).toBe(false);
  });
});

it("keeps another rule's door rights when replacing the moved door", async () => {
  const f = await assigned();
  await f.t.run(async ctx => {
    const other = await ctx.db.insert("doors", { projectId: f.projectId, deviceId: f.deviceId, name: "Başka", hikDoorNo: 3 });
    const rule = await ctx.db.insert("accessRules", { projectId: f.projectId, name: "Another", isActive: true, hikWeekPlanNo: 3 });
    await ctx.db.insert("groupMembers", { projectId: f.projectId, groupId: rule, employeeId: f.employeeId, createdAt: "" });
    await ctx.db.insert("groupDoors", { projectId: f.projectId, groupId: rule, deviceId: f.deviceId, doorId: other, createdAt: "" });
  });
  await f.caller.mutation(api.doors.update, { doorId: f.doorId, hikDoorNo: 2 });
  const op = await f.t.run(ctx => ctx.db.query("hikPendingOperations").first());
  if (!op) throw new Error("missing operation");
  await f.t.action(internal.actions.hikvisionSync.syncDoorRightsOperation, { operationId: op._id });
  expect(wire.send).toHaveBeenCalledWith("old-panel", expect.objectContaining({ doorPlans: [{ doorNo: 2, planTemplateNos: [2] }, { doorNo: 3, planTemplateNos: [3] }] }));
  expect(wire.remove).not.toHaveBeenCalled();
});

it("IDE panel moves clear old permission io, preserve users and move the reader target", async () => {
  const f = await assigned("ide_smart");
  const { nextDeviceId, readerId } = await f.t.run(async ctx => ({
    nextDeviceId: await ctx.db.insert("devices", { projectId: f.projectId, name: "New IDE", brand: "ide_smart", ideUuid: "new-uuid", ideUser: "test", idePassword: "test", ideDoorCount: 4, isActive: true, createdAt: "", updatedAt: "" }),
    readerId: await ctx.db.insert("readers", { projectId: f.projectId, doorId: f.doorId, deviceId: f.deviceId, name: "Reader", ioId: 0, direction: "entry", createdAt: "", updatedAt: "" }),
  }));
  await f.caller.mutation(api.doors.update, { doorId: f.doorId, deviceId: nextDeviceId, ioId: 2 });
  const ops = await f.t.run(ctx => ctx.db.query("idePendingOperations").collect());
  expect(ops).toEqual(expect.arrayContaining([
    expect.objectContaining({ deviceId: f.deviceId, opType: "upsertPermission", payload: expect.objectContaining({ permissionRecord: expect.objectContaining({ io: [] }) }) }),
    expect.objectContaining({ deviceId: nextDeviceId, opType: "upsertPermission", payload: expect.objectContaining({ permissionRecord: expect.objectContaining({ io: [2] }) }) }),
  ]));
  expect(ops.some(op => op.opType === "deleteUser")).toBe(false);
  expect(await f.t.run(ctx => ctx.db.get(readerId))).toMatchObject({ deviceId: nextDeviceId, ioId: 2 });
});

it("updates IDE blanket rules when their actuator list changes", async () => {
  const f = await assigned("ide_smart");
  await f.t.run(ctx => ctx.db.delete(f.linkId));
  await f.caller.mutation(api.doors.update, { doorId: f.doorId, ioId: 2 });
  const ops = await f.t.run(ctx => ctx.db.query("idePendingOperations").collect());
  expect(ops).toEqual(expect.arrayContaining([expect.objectContaining({ opType: "upsertPermission", payload: expect.objectContaining({ permissionRecord: expect.objectContaining({ io: [2] }) }) })]));
});

it("keeps failures traceable and retries without deleting people", async () => {
  const f = await assigned();
  await f.caller.mutation(api.doors.update, { doorId: f.doorId, hikDoorNo: 2 });
  const op = await f.t.run(ctx => ctx.db.query("hikPendingOperations").first());
  if (!op) throw new Error("missing operation");
  wire.send.mockResolvedValueOnce({ ok: false });
  await f.t.action(internal.actions.hikvisionSync.syncDoorRightsOperation, { operationId: op._id });
  expect(await f.t.run(ctx => ctx.db.get(op._id))).toMatchObject({ status: "failed" });
  expect(await f.t.action(internal.actions.hikQueueWorker.processHikOperation, { issueId: op._id })).toMatchObject({ retried: 1, ok: 1 });
  expect(await f.t.run(ctx => ctx.db.get(op._id))).toMatchObject({ status: "done" });
  expect(wire.remove).not.toHaveBeenCalled();
});

it("does not invent a one-door capacity before the device reports its capacity", async () => {
  const f = await setup();
  await f.t.run(ctx => ctx.db.patch(f.deviceId, { hikDoorCount: undefined }));
  await f.caller.mutation(api.doors.update, { doorId: f.doorId, hikDoorNo: 3 });
  expect(await f.t.run(ctx => ctx.db.get(f.doorId))).toMatchObject({ hikDoorNo: 3 });
});

it.each(["previous", "next"] as const)("blocks unsafe localBridge rights changes on the %s target atomically", async side => {
  const f = await assigned();
  const targetId = await f.t.run(async ctx => {
    if (side === "previous") {
      await ctx.db.patch(f.deviceId, { hikTransport: "localBridge" });
      return f.deviceId;
    }
    return ctx.db.insert("devices", { projectId: f.projectId, name: "Bridge", brand: "hikvision", hikTransport: "localBridge", hikDoorCount: 4, createdAt: "", updatedAt: "" });
  });
  await expect(f.caller.mutation(api.doors.update, { doorId: f.doorId, deviceId: targetId, hikDoorNo: 2 })).rejects.toThrow("Windows köprüsü");
  expect(await f.t.run(ctx => ctx.db.get(f.doorId))).toMatchObject({ deviceId: f.deviceId, hikDoorNo: 1 });
  expect(await f.t.run(ctx => ctx.db.query("hikPendingOperations").collect())).toEqual([]);
  expect(await f.t.run(ctx => ctx.db.get(f.grantId))).toMatchObject({ state: "effective" });
  await f.caller.mutation(api.doors.update, { doorId: f.doorId, name: "Yeni ad" });
});

it.each(["hikvision", "ide_smart"] as const)("Y-05: legacy %s collisions and capacity errors do not block renaming", async brand => {
  const f = await setup(brand);
  await f.t.run(async ctx => {
    await ctx.db.insert("doors", { projectId: f.projectId, deviceId: f.deviceId, name: "Çakışan kapı", hikDoorNo: 1, ioId: 0 });
    await ctx.db.patch(f.deviceId, { hikDoorCount: 1, ideDoorCount: 1 });
  });
  await f.caller.mutation(api.doors.update, { doorId: f.doorId, name: "Yeni ad", hikDoorNo: 1, ioId: 0 });
  await f.t.run(ctx => ctx.db.patch(f.doorId, { hikDoorNo: 4, ioId: 3 }));
  await f.caller.mutation(api.doors.update, { doorId: f.doorId, name: "Son ad" });
  expect(await f.t.run(ctx => ctx.db.get(f.doorId))).toMatchObject({ name: "Son ad" });
});

it.each(["hikvision", "ide_smart"] as const)("Y-07: a 600-member blanket %s rule does not fan out during door edits", async brand => {
  const f = await assigned(brand);
  await f.t.run(async ctx => {
    await ctx.db.delete(f.linkId);
    for (let i = 1; i < 600; i++) {
      const employeeId = await ctx.db.insert("employees", { projectId: f.projectId, firstName: "Üye", lastName: String(i), email: `${i}@test.example`, cardNumber: String(1000 + i), isActive: true });
      await ctx.db.insert("groupMembers", { projectId: f.projectId, groupId: f.ruleId, employeeId, createdAt: "" });
    }
  });
  await f.caller.mutation(api.doors.update, { doorId: f.doorId, ...(brand === "ide_smart" ? { ioId: 2 } : { hikDoorNo: 2 }) });
  const jobs = await f.t.run(ctx => ctx.db.system.query("_scheduled_functions").collect());
  expect(jobs.filter(job => job.name === "doors:syncDoorBlanketRule")).toHaveLength(1);
  expect(jobs.filter(job => /syncDoorRightsOperation|syncDoorIdeTarget/.test(job.name))).toHaveLength(0);
  expect(await f.t.run(ctx => ctx.db.query("hikPendingOperations").collect())).toEqual([]);
  const job = jobs.find(job => job.name === "doors:syncDoorBlanketRule");
  if (!job) throw new Error("missing rule job");
  await f.t.action(internal.doors.syncDoorBlanketRule, job.args[0] as FunctionArgs<typeof internal.doors.syncDoorBlanketRule>);
  expect(await f.t.run(ctx => ctx.db.query("deviceSyncRunTargets").first())).toMatchObject({ dispatchFinished: true, status: brand === "hikvision" ? "sent" : "queued" });
  if (brand === "hikvision") expect(wire.send.mock.calls.filter(call => JSON.stringify(call).includes('"doorPlans"'))).toHaveLength(600);
  else expect((await f.t.run(ctx => ctx.db.query("idePendingOperations").collect())).every(op => op.opType === "upsertPermission")).toBe(true);
  expect(wire.remove).not.toHaveBeenCalled();
}, 20_000);

it("Y-11: the former IDE panel closes immediately with removed grants", async () => {
  const f = await assigned("ide_smart");
  const nextDeviceId = await f.t.run(ctx => ctx.db.insert("devices", { projectId: f.projectId, name: "Yeni", brand: "ide_smart", ideUuid: "new", ideDoorCount: 4, isActive: true, createdAt: "", updatedAt: "" }));
  await f.caller.mutation(api.doors.update, { doorId: f.doorId, deviceId: nextDeviceId, ioId: 2 });
  const targets = await f.t.run(ctx => ctx.db.query("deviceSyncRunTargets").collect());
  expect(targets.find(target => target.deviceId === f.deviceId)).toMatchObject({ status: "skipped", reason: "Panelde kalan kapı hakkı yok", dispatchFinished: true });
  expect(await f.t.run(ctx => ctx.db.get(f.grantId))).toMatchObject({ state: "removed" });
  expect((await f.t.run(ctx => ctx.db.query("idePendingOperations").collect())).some(op => op.opType === "deleteUser")).toBe(false);
});

it("Y-11: an IDE rule with no active employees closes immediately", async () => {
  const f = await assigned("ide_smart");
  await f.t.run(ctx => ctx.db.patch(f.employeeId, { isActive: false }));
  await f.caller.mutation(api.doors.update, { doorId: f.doorId, ioId: 2 });
  expect(await f.t.run(ctx => ctx.db.query("deviceSyncRunTargets").first())).toMatchObject({ status: "skipped", reason: "Panelde kalan kapı hakkı yok" });
  expect(await f.t.run(ctx => ctx.db.get(f.grantId))).toMatchObject({ state: "removed" });
});

it("Y-11: an empty blanket IDE rule also closes without a pending target", async () => {
  const f = await assigned("ide_smart");
  await f.t.run(async ctx => {
    await ctx.db.delete(f.linkId);
    const member = await ctx.db.query("groupMembers").first();
    if (member) await ctx.db.delete(member._id);
  });
  await f.caller.mutation(api.doors.update, { doorId: f.doorId, ioId: 2 });
  expect(await f.t.run(ctx => ctx.db.query("deviceSyncRunTargets").first())).toMatchObject({ status: "skipped", reason: "Panelde kalan kapı hakkı yok" });
});

it("Y-07: selected-door rules retain the 200-member transaction bound", async () => {
  const f = await assigned("ide_smart");
  await f.t.run(async ctx => {
    for (let i = 1; i < 201; i++) {
      const employeeId = await ctx.db.insert("employees", { projectId: f.projectId, firstName: "Üye", lastName: String(i), email: `${i}@test.example`, cardNumber: String(1000 + i), isActive: true });
      await ctx.db.insert("groupMembers", { projectId: f.projectId, groupId: f.ruleId, employeeId, createdAt: "" });
    }
  });
  await expect(f.caller.mutation(api.doors.update, { doorId: f.doorId, ioId: 2 })).rejects.toThrow("200 kişi");
  expect(await f.t.run(ctx => ctx.db.get(f.doorId))).toMatchObject({ ioId: 0 });
});


it.each(["hikvision", "ide_smart"] as const)("N3-04: unrelated %s slot collisions do not block a healthy door", async brand => {
  const f = await setup(brand);
  await f.t.run(async ctx => {
    for (const name of ["X", "Y"]) await ctx.db.insert("doors", { projectId: f.projectId, deviceId: f.deviceId, name, hikDoorNo: 2, ioId: 1 });
  });
  expect(await f.t.query(internal.doors.getByIdInternal, { id: f.doorId })).toMatchObject({ name: "İlk kapı" });
  const conflict = await f.t.run(ctx => ctx.db.query("doors").withIndex("by_device", q => q.eq("deviceId", f.deviceId)).collect());
  const other = conflict.find(door => door.name === "X");
  if (!other) throw new Error("Kapı bulunamadı");
  await expect(f.t.query(internal.doors.getByIdInternal, { id: other._id })).rejects.toThrow("Aynı kapı numarasını");
});
