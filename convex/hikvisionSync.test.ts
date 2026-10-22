/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";

const wire = vi.hoisted(() => ({ person: vi.fn(async () => ({ ok: true })), week: vi.fn(async () => ({ ok: true })), template: vi.fn(async () => ({ ok: true })), card: vi.fn(async () => ({ ok: true })), remove: vi.fn(async (): Promise<{ ok: boolean; error?: string }> => ({ ok: true })) }));
vi.mock("./lib/hikGateway", async original => ({
  ...await original<typeof import("./lib/hikGateway")>(),
  upsertPersonToDevice: wire.person, setWeekPlanOnDevice: wire.week,
  setPlanTemplate: wire.template, addCardToDevice: wire.card, deletePersonFromDevice: wire.remove,
}));
const modules = import.meta.glob("./**/*.ts");
afterEach(() => { vi.clearAllMocks(); wire.remove.mockResolvedValue({ ok: true }); });

async function fixture(transport: "gateway" | "localBridge" = "gateway") {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "Synthetic" });
    const employeeId = await ctx.db.insert("employees", { projectId, firstName: "Test", lastName: "Person", email: "synthetic@example.test", cardNumber: "123", isActive: true });
    const deviceId = await ctx.db.insert("devices", { projectId, name: "Hik", brand: "hikvision", hikDevIndex: "synthetic", hikTransport: transport, hikDoorCount: 3, isActive: true, createdAt: "2026-01-01", updatedAt: "2026-01-01" });
    const r1 = await ctx.db.insert("accessRules", { projectId, name: "First", isActive: true, hikWeekPlanNo: 4 });
    const r2 = await ctx.db.insert("accessRules", { projectId, name: "Second", isActive: true });
    for (const groupId of [r1, r2]) await ctx.db.insert("groupMembers", { projectId, groupId, employeeId, createdAt: "2026-01-01" });
    const doorId = await ctx.db.insert("doors", { projectId, name: "Selected", deviceId, hikDoorNo: 2 });
    const door2Id = await ctx.db.insert("doors", { projectId, name: "Other", deviceId, hikDoorNo: 3 });
    await ctx.db.insert("groupDoors", { groupId: r1, doorId, createdAt: "2026-01-01" });
    await ctx.db.insert("groupDoors", { groupId: r2, doorId, createdAt: "2026-01-01" });
    await ctx.db.insert("groupDoors", { groupId: r2, doorId: door2Id, createdAt: "2026-01-01" });
    return { projectId, employeeId, deviceId, doorId, door2Id, r1, r2 };
  });
  return { t, ...ids };
}

describe("Hik employee sync complete rule scope", () => {
  it("reads door-only rules, allocates missing plan, pushes every schedule, and merges per door", async () => {
    const { t, employeeId, r2 } = await fixture();
    const result = await t.action(internal.actions.hikvisionSync.syncEmployeeToDevicesInternal, { employeeId });
    expect(result).toEqual({ synced: 1, failed: 0, errors: [] });
    const assigned = (await t.run(ctx => ctx.db.get(r2)))?.hikWeekPlanNo;
    expect(assigned).toBe(5);
    expect(wire.week).toHaveBeenCalledTimes(2);
    expect(wire.template).toHaveBeenCalledTimes(2);
    expect(wire.person).toHaveBeenCalledExactlyOnceWith("synthetic", expect.objectContaining({ doorPlans: [{ doorNo: 2, planTemplateNos: [4, 5] }, { doorNo: 3, planTemplateNos: [5] }] }));
  });
  it("week plan updates preserve all other employee rules", async () => {
    const { t, r1 } = await fixture();
    const result = await t.action(internal.actions.hikvisionSync.syncWeekPlanToDevicesInternal, { accessRuleId: r1 });
    expect(result.employeesSynced).toBe(1);
    expect(wire.person).toHaveBeenCalledExactlyOnceWith("synthetic", expect.objectContaining({ doorPlans: [{ doorNo: 2, planTemplateNos: [4, 5] }, { doorNo: 3, planTemplateNos: [5] }] }));
  });
  it("selected doors narrow an explicit device leg", async () => {
    const { t, employeeId, deviceId, projectId, r1 } = await fixture();
    await t.run(ctx => ctx.db.insert("groupDevices", { projectId, deviceId, groupId: r1, createdAt: "2026-01-01" }));
    await t.action(internal.actions.hikvisionSync.syncEmployeeToDevicesInternal, { employeeId });
    expect(wire.person).toHaveBeenCalledWith("synthetic", expect.objectContaining({ doorPlans: [{ doorNo: 2, planTemplateNos: [4, 5] }, { doorNo: 3, planTemplateNos: [5] }] }));
  });
  it("missing door numbers never fall back to all doors and produce an error", async () => {
    const { t, employeeId, doorId, door2Id } = await fixture();
    await t.run(async ctx => { await ctx.db.patch(doorId, { hikDoorNo: undefined }); await ctx.db.patch(door2Id, { hikDoorNo: undefined }); });
    const result = await t.action(internal.actions.hikvisionSync.syncEmployeeToDevicesInternal, { employeeId });
    expect(result.failed).toBe(1);
    expect(result.errors.join(" ")).toContain("hikDoorNo");
    expect(wire.person).not.toHaveBeenCalled();
    expect(wire.card).not.toHaveBeenCalled();
    expect(wire.remove).toHaveBeenCalledExactlyOnceWith("synthetic", "123");
    expect(await t.run(ctx => ctx.db.query("hikPendingOperations").take(10))).toEqual(expect.arrayContaining([
      expect.objectContaining({ operation: "addPerson", lastError: "Kapsanan kapı yok, kişi cihazdan kaldırıldı" }),
    ]));
  });
  it("refuses lossy multi-plan Windows bridge payloads", async () => {
    const { t, employeeId } = await fixture("localBridge");
    const result = await t.action(internal.actions.hikvisionSync.syncEmployeeToDevicesInternal, { employeeId });
    expect(result.failed).toBe(1);
    expect(result.errors.join(" ")).toContain("Windows köprüsü kapı başına çoklu planı henüz desteklemiyor");
    const ops = await t.run(ctx => ctx.db.query("hikPendingOperations").take(10));
    expect(ops).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: "pending", operation: "deleteCard", payload: expect.objectContaining({ employeeId, cardNumber: "123" }) }),
      expect.objectContaining({ status: "failed", operation: "addPerson", lastError: "Windows köprüsü kapı başına çoklu planı henüz desteklemiyor" }),
    ]));
    expect(ops.some(op => op.operation === "addPerson" && op.status === "pending")).toBe(false);
  });
  it("no selected doors retains all-door legacy behavior", async () => {
    const { t, employeeId, projectId, deviceId, r1 } = await fixture();
    await t.run(async ctx => {
      const links = await ctx.db.query("groupDoors").withIndex("by_group", q => q.eq("groupId", r1)).take(10);
      for (const link of links) await ctx.db.delete(link._id);
      await ctx.db.insert("groupDevices", { projectId, deviceId, groupId: r1, createdAt: "2026-01-01" });
    });
    await t.action(internal.actions.hikvisionSync.syncEmployeeToDevicesInternal, { employeeId });
    expect(wire.person).toHaveBeenCalledWith("synthetic", expect.objectContaining({ doorPlans: [{ doorNo: 1, planTemplateNos: [4] }, { doorNo: 2, planTemplateNos: [4, 5] }, { doorNo: 3, planTemplateNos: [4, 5] }] }));
  });
  it("single-plan Windows bridge receives only covered doors", async () => {
    const { t, employeeId, r2 } = await fixture("localBridge");
    await t.run(ctx => ctx.db.patch(r2, { isActive: false }));
    expect((await t.action(internal.actions.hikvisionSync.syncEmployeeToDevicesInternal, { employeeId })).synced).toBe(1);
    const ops = await t.run(ctx => ctx.db.query("hikPendingOperations").take(10));
    expect(ops.find(op => op.operation === "addPerson")?.payload).toMatchObject({ planTemplateNo: 4, doorRights: [2] });
  });
  it.each(["moved", "foreign", "deleted"] as const)("%s selected door cannot reopen device-leg fallback", async kind => {
    const { t, employeeId, projectId, deviceId, doorId, r1, r2 } = await fixture();
    await t.run(async ctx => {
      await ctx.db.patch(r2, { isActive: false });
      await ctx.db.insert("groupDevices", { projectId, deviceId, groupId: r1, createdAt: "2026-01-01" });
      const links = await ctx.db.query("groupDoors").withIndex("by_group", q => q.eq("groupId", r1)).take(10);
      for (const link of links) await ctx.db.patch(link._id, { deviceId });
      if (kind === "moved") {
        const other = await ctx.db.insert("devices", { projectId, name: "Other", brand: "hikvision", isActive: true, createdAt: "2026-01-01", updatedAt: "2026-01-01" });
        await ctx.db.patch(doorId, { deviceId: other });
      }
      if (kind === "foreign") {
        const foreign = await ctx.db.insert("projects", { name: "Foreign" });
        await ctx.db.patch(doorId, { projectId: foreign });
      }
      if (kind === "deleted") await ctx.db.delete(doorId);
    });
    const result = await t.action(internal.actions.hikvisionSync.syncEmployeeToDevicesInternal, { employeeId, targetDeviceIds: [deviceId] });
    expect(result.failed).toBe(1);
    expect(wire.person).not.toHaveBeenCalled();
  });

  it("pushes R plans once for N employees across batches (N=25, R=2)", async () => {
    const { t, projectId, r1, r2 } = await fixture();
    await t.run(async ctx => {
      for (let index = 1; index < 25; index++) {
        const employeeId = await ctx.db.insert("employees", { projectId, firstName: "Test", lastName: "Person", email: `test${index}@example.test`, cardNumber: `${index + 123}`, isActive: true });
        for (const groupId of [r1, r2]) await ctx.db.insert("groupMembers", { projectId, groupId, employeeId, createdAt: "2026-01-01" });
      }
    });
    const result = await t.action(internal.actions.hikvisionSync.syncWeekPlanToDevicesInternal, { accessRuleId: r1 });
    expect(result).toMatchObject({ employeesSynced: 25, failed: 0 });
    expect(wire.week).toHaveBeenCalledTimes(2);
    expect(wire.template).toHaveBeenCalledTimes(2);
    expect(wire.person).toHaveBeenCalledTimes(25);
    expect(wire.card).toHaveBeenCalledTimes(25);
  });
  it("atomically reuses a rule number and assigns distinct numbers to different rules", async () => {
    const { t, r1, r2 } = await fixture();
    await t.run(ctx => ctx.db.patch(r1, { hikWeekPlanNo: undefined }));
    const values = await Promise.all([r1, r1, r2, r2].map(accessRuleId => t.mutation(internal.hikvisionSync.assignWeekPlanNo, { accessRuleId })));
    expect(values[0]).toBe(values[1]);
    expect(values[2]).toBe(values[3]);
    expect(values[0]).not.toBe(values[2]);
    expect(await t.mutation(internal.hikvisionSync.assignWeekPlanNo, { accessRuleId: r1 })).toBe(values[0]);
  });
  it.each(["manual", "deleted"] as const)("%s door without a device snapshot does not suppress another device leg", async kind => {
    const { t, employeeId, projectId, deviceId, r1, r2 } = await fixture();
    await t.run(async ctx => {
      await ctx.db.patch(r2, { isActive: false });
      const links = await ctx.db.query("groupDoors").withIndex("by_group", q => q.eq("groupId", r1)).take(10);
      for (const link of links) await ctx.db.delete(link._id);
      await ctx.db.insert("groupDevices", { projectId, deviceId, groupId: r1, createdAt: "2026-01-01" });
      const doorId = await ctx.db.insert("doors", { projectId, name: "Manual" });
      await ctx.db.insert("groupDoors", { groupId: r1, doorId, createdAt: "2026-01-01" });
      if (kind === "deleted") await ctx.db.delete(doorId);
    });
    const result = await t.action(internal.actions.hikvisionSync.syncEmployeeToDevicesInternal, { employeeId });
    expect(result.failed).toBe(0);
    expect(wire.person).toHaveBeenCalledWith("synthetic", expect.objectContaining({ doorPlans: [1, 2, 3].map(doorNo => ({ doorNo, planTemplateNos: [4] })) }));
  });
  it("records partial missing-door warnings without resolving them on person success", async () => {
    const { t, employeeId, door2Id, r1 } = await fixture();
    await t.run(ctx => ctx.db.patch(door2Id, { hikDoorNo: undefined }));
    const result = await t.action(internal.actions.hikvisionSync.syncWeekPlanToDevicesInternal, { accessRuleId: r1 });
    expect(result.employeesSynced).toBe(1);
    expect(wire.person).toHaveBeenCalledWith("synthetic", expect.objectContaining({ doorPlans: [{ doorNo: 2, planTemplateNos: [4, 5] }] }));
    expect(await t.run(ctx => ctx.db.query("hikPendingOperations").take(10))).toEqual(expect.arrayContaining([
      expect.objectContaining({ operation: "addPerson", status: "failed", lastError: expect.stringContaining("hikDoorNo"), payload: { employeeId } }),
    ]));
  });
  it("records a failed revocation instead of claiming the old record was removed", async () => {
    const { t, employeeId, doorId, door2Id } = await fixture();
    await t.run(async ctx => { await ctx.db.patch(doorId, { hikDoorNo: undefined }); await ctx.db.patch(door2Id, { hikDoorNo: undefined }); });
    wire.remove.mockResolvedValueOnce({ ok: false, error: "Cihaz çevrimdışı" });
    const result = await t.action(internal.actions.hikvisionSync.syncEmployeeToDevicesInternal, { employeeId });
    expect(result.failed).toBe(1);
    expect(await t.run(ctx => ctx.db.query("hikPendingOperations").take(10))).toEqual(expect.arrayContaining([
      expect.objectContaining({ operation: "deletePerson", status: "failed", lastError: expect.stringContaining("kişi kaldırılamadı: Cihaz çevrimdışı") }),
    ]));
  });

  it("keeps a Windows partial-door warning after enqueueing the person", async () => {
    const { t, employeeId, r1, r2, door2Id } = await fixture("localBridge");
    await t.run(async ctx => {
      await ctx.db.patch(r2, { isActive: false });
      await ctx.db.patch(door2Id, { hikDoorNo: undefined });
      await ctx.db.insert("groupDoors", { groupId: r1, doorId: door2Id, createdAt: "2026-01-01" });
    });
    const result = await t.action(internal.actions.hikvisionSync.syncEmployeeToDevicesInternal, { employeeId });
    expect(result.synced).toBe(1);
    const ops = await t.run(ctx => ctx.db.query("hikPendingOperations").take(10));
    expect(ops).toEqual(expect.arrayContaining([
      expect.objectContaining({ operation: "addPerson", status: "pending", payload: expect.objectContaining({ doorRights: [2] }) }),
      expect.objectContaining({ operation: "addPerson", status: "failed", lastError: expect.stringContaining("hikDoorNo") }),
    ]));
  });
  it("a deleted door with a known device narrows only that device", async () => {
    const { t, employeeId, projectId, deviceId, r1, r2, doorId } = await fixture();
    const otherDeviceId = await t.run(async ctx => {
      await ctx.db.patch(r2, { isActive: false });
      const other = await ctx.db.insert("devices", { projectId, name: "Other", brand: "hikvision", hikDevIndex: "other", isActive: true, createdAt: "2026-01-01", updatedAt: "2026-01-01" });
      for (const id of [deviceId, other]) await ctx.db.insert("groupDevices", { projectId, deviceId: id, groupId: r1, createdAt: "2026-01-01" });
      const links = await ctx.db.query("groupDoors").withIndex("by_group", q => q.eq("groupId", r1)).take(10);
      for (const link of links) await ctx.db.patch(link._id, { deviceId });
      await ctx.db.delete(doorId);
      return other;
    });
    const data = await t.query(internal.hikvisionSync.getEmployeeWithDevices, { employeeId });
    expect(data?.deviceRules.find(scope => scope.device._id === deviceId)?.doorNos).toEqual([]);
    expect(data?.deviceRules.find(scope => scope.device._id === otherDeviceId)).toEqual(expect.not.objectContaining({ doorNos: expect.anything() }));
    expect(data?.deviceRules).toHaveLength(2);
  });

});


describe("central fingerprint sync hook", () => {
  it.each(["gateway", "localBridge"] as const)("%s person/card success replays only gateway fingerprints", async transport => {
    const f = await fixture(transport);
    await f.t.run(async ctx => {
      await ctx.db.patch(f.r2, { isActive: false });
      await ctx.db.insert("employeeFingerprints", { employeeId: f.employeeId, projectId: f.projectId, fingerPrintID: 2, encData: "encrypted", iv: "iv", keyVersion: "v1", addedAt: Date.now() });
    });
    await f.t.action(internal.actions.hikvisionSync.syncEmployeeToDevicesInternal, { employeeId: f.employeeId });
    const jobs = await f.t.run(ctx => ctx.db.system.query("_scheduled_functions").collect());
    const pushes = jobs.filter(job => job.name === "actions/hikFingerprint:pushFingerprintToDevices");
    expect(pushes).toHaveLength(transport === "gateway" ? 1 : 0);
    if (transport === "gateway") expect(pushes[0].args).toEqual([{ employeeId: f.employeeId, deviceIds: [f.deviceId] }]);
  });
});

it.each([false, true])("sync hook uses one employee query across devices; templates present: %s", async hasTemplates => {
  const f = await fixture();
  await f.t.run(async ctx => {
    await ctx.db.patch(f.r2, { isActive: false });
    const deviceId = await ctx.db.insert("devices", { projectId: f.projectId, name: "Second", brand: "hikvision", hikDevIndex: "second", hikTransport: "gateway", hikDoorCount: 1, isActive: true, createdAt: "now", updatedAt: "now" });
    await ctx.db.insert("groupDevices", { projectId: f.projectId, groupId: f.r1, deviceId, createdAt: "now" });
    if (hasTemplates) await ctx.db.insert("employeeFingerprints", { employeeId: f.employeeId, fingerPrintID: 2, encData: "cipher", iv: "iv", keyVersion: "v1", addedAt: 1 });
  });
  const data = await f.t.query(internal.hikvisionSync.getEmployeeWithDevices, { employeeId: f.employeeId });
  expect(data?.hasFingerprintTemplates).toBe(hasTemplates);
  const runQuery = vi.fn(async () => data);
  const runMutation = vi.fn(async () => null);
  const runAfter = vi.fn(async () => null);
  const { syncEmployeeToDevicesInternal } = await import("./actions/hikvisionSync");
  const handler = (syncEmployeeToDevicesInternal as unknown as { _handler: (ctx: unknown, input: object) => Promise<unknown> })._handler;
  await handler({ runQuery, runMutation, scheduler: { runAfter } }, { employeeId: f.employeeId });
  expect(runQuery).toHaveBeenCalledTimes(1);
  expect(runAfter).toHaveBeenCalledTimes(hasTemplates ? 2 : 0);
});
