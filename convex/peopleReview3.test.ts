// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { grantStatusForOperation } from "./lib/grantStatus";
import { generateVisitorCard } from "./lib/visitorPass";

const modules = import.meta.glob("./**/*.ts");
beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

async function fixture(legacyTimestamp = false) {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "Review 3" });
    const userId = await ctx.db.insert("users", { role: "project_admin" });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 86400000 });
    await ctx.db.insert("userProjects", { userId, projectId });
    await ctx.db.insert("projectPrivacySettings", { projectId, biometricEnabled: true, updatedAt: "" });
    const employeeId = await ctx.db.insert("employees", { projectId, firstName: "Ada", lastName: "Test", email: "", cardNumber: "123", hikEmployeeNo: "7", isActive: true, updatedAt: new Date(1000).toISOString(), ...(!legacyTimestamp ? { deviceSyncUpdatedAt: 1000 } : {}) });
    const hikId = await ctx.db.insert("devices", { projectId, name: "Hik", brand: "hikvision", hikTransport: "gateway", hikDevIndex: "hik", isActive: true, createdAt: "", updatedAt: "" });
    const ideId = await ctx.db.insert("devices", { projectId, name: "IDE", brand: "ide_smart", ideUuid: "ide", isActive: true, createdAt: "", updatedAt: "" });
    const groupId = await ctx.db.insert("accessRules", { projectId, name: "Rule", isActive: true });
    await ctx.db.insert("groupMembers", { projectId, groupId, employeeId, createdAt: "" });
    for (const deviceId of [hikId, ideId]) {
      await ctx.db.insert("groupDevices", { projectId, groupId, deviceId, createdAt: "" });
      await ctx.db.insert("accessGrantStatus", { projectId, employeeId, deviceId, ruleIds: [groupId], state: "effective", updatedAt: Date.now() });
    }
    return { projectId, userId, sessionId, employeeId, hikId, ideId, groupId };
  });
  const caller = t.withIdentity({ subject: `${ids.userId}|${ids.sessionId}` });
  const matrix = () => caller.query(api.employeeDelivery.getForEmployee, { projectId: ids.projectId, employeeId: ids.employeeId });
  const expectDelivered = async () => {
    expect((await matrix()).devices.map(device => device.state)).toEqual(["delivered", "delivered"]);
    expect((await t.run(ctx => ctx.db.get(ids.employeeId)))?.deviceSyncUpdatedAt).toBe(legacyTimestamp ? undefined : 1000);
  };
  return { t, caller, ...ids, matrix, expectDelivered };
}

it.each(["inactive", "expiry"] as const)("D5b: lifecycle %s revokes a legacy placeholder without an IDE roster mirror", async change => {
  const f = await fixture();
  await f.t.run(ctx => ctx.db.patch(f.employeeId, { hikCardless: true }));
  await f.caller.mutation(api.employees.update, { employeeId: f.employeeId, ...(change === "inactive" ? { isActive: false } : { accessExpiresAt: "2027-01-01T00:00:00Z" }) });
  expect(await f.t.action(internal.actions.ideGatewayDevice.syncEmployeeToIdePanels, { employeeId: f.employeeId })).toMatchObject({ queued: 1 });
  const operations = await f.t.run(ctx => ctx.db.query("idePendingOperations").collect());
  expect(operations).toMatchObject([{ opType: "deleteUser", payload: { employeeId: f.employeeId, ideUserId: 123 } }]);
});

it("D5b: placeholder cleanup preserves another authorized physical card owner", async () => {
  const f = await fixture();
  await f.t.run(async ctx => {
    await ctx.db.patch(f.employeeId, { hikCardless: true });
    const employeeId = await ctx.db.insert("employees", { projectId: f.projectId, firstName: "Owner", lastName: "", email: "", cardNumber: "00123", isActive: true });
    await ctx.db.insert("groupMembers", { projectId: f.projectId, groupId: f.groupId, employeeId, createdAt: "" });
  });
  expect(await f.t.action(internal.actions.ideGatewayDevice.syncEmployeeToIdePanels, { employeeId: f.employeeId })).toMatchObject({ queued: 0 });
  expect(await f.t.run(ctx => ctx.db.query("idePendingOperations").collect())).toEqual([]);
});

it.each([false, true])("N3: old card cleanup needs no roster mirror and preserves the new card grant (imported=%s)", async imported => {
  const f = await fixture();
  await f.t.run(ctx => ctx.db.patch(f.employeeId, { cardNumber: "456", hikEmployeeNo: imported ? "7" : undefined }));
  await f.t.action(internal.actions.ideGatewayDevice.deleteIdeUserFromPanels, { employeeId: f.employeeId, projectId: f.projectId, deviceIds: [f.ideId], cardNumber: "123" });
  expect(await f.t.run(ctx => ctx.db.query("idePendingOperations").collect())).toMatchObject([{ opType: "deleteUser", payload: { employeeId: f.employeeId, ideUserId: 123 } }]);
  expect(await f.t.run(ctx => ctx.db.query("accessGrantStatus").withIndex("by_employee_device", q => q.eq("employeeId", f.employeeId).eq("deviceId", f.ideId)).unique())).toMatchObject({ state: "effective" });
});

it.each([false, true])("D9b: face save/removal preserves Hik and IDE person/card delivery (legacy=%s)", async legacy => {
  const f = await fixture(legacy);
  const storageId = await f.t.run(ctx => ctx.storage.store(new Blob([new Uint8Array([255, 216, 255, 217])], { type: "image/jpeg" })));
  await f.t.mutation(internal.employeeFaces.saveStoredPhoto, { employeeId: f.employeeId, storageId, userId: f.userId });
  await f.expectDelivered();
  await f.t.run(async ctx => {
    for (const op of await ctx.db.query("hikPendingOperations").collect()) await ctx.db.patch(op._id, { status: "done", completedAt: Date.now() });
  });
  await f.caller.mutation(api.employeeFaces.remove, { employeeId: f.employeeId });
  await f.expectDelivered();
});

it("D9b: fingerprint capture, storage, purge and source import preserve person/card delivery", async () => {
  const f = await fixture();
  const target = { employeeId: f.employeeId, deviceId: f.hikId, fingerNo: 2 };
  const attemptId = await f.caller.mutation(api.fingerprintEnrollment.beginEnrollment, target);
  await f.t.mutation(internal.fingerprintEnrollment.upsert, { ...target, attemptId, expectedCardNumber: "7", enrolledBy: f.userId });
  await f.expectDelivered();
  await f.t.mutation(internal.employeeFingerprints.upsertEncrypted, { employeeId: f.employeeId, fingerNo: 2, sourceDeviceId: f.hikId, enrolledBy: f.userId, expectedCardNumber: "7", encData: "encrypted", iv: "iv", keyVersion: "1" });
  await f.expectDelivered();
  await f.caller.mutation(api.fingerprintEnrollment.removeFingerprint, { employeeId: f.employeeId, fingerNo: 2 });
  await f.expectDelivered();
  await f.t.mutation(internal.hikDeviceImport.recordSource, { employeeId: f.employeeId, deviceId: f.hikId, fingerNo: 3, userId: f.userId, expectedCardNumber: "7", encData: "imported", iv: "iv", keyVersion: "1" });
  await f.expectDelivered();
});

it.each(["", "456"])("N4/N5: imported person deletion ACK updates its grant independently of physical card %j", async cardNumber => {
  const f = await fixture();
  await f.t.run(ctx => ctx.db.patch(f.employeeId, { cardNumber, isActive: false }));
  const operationId = await f.t.mutation(internal.hikvisionSync.beginPersonDeletion, { employeeId: f.employeeId, deviceId: f.hikId, projectId: f.projectId, employeeNo: "7", cardNumber });
  expect(await f.t.run(ctx => ctx.db.query("accessGrantStatus").withIndex("by_employee_device", q => q.eq("employeeId", f.employeeId).eq("deviceId", f.hikId)).unique())).toMatchObject({ state: "pending" });
  await f.t.run(async ctx => {
    const op = await ctx.db.get(operationId);
    if (!op) throw new Error("Missing deletion operation");
    await grantStatusForOperation(ctx, op, "removed");
  });
  expect(await f.t.run(ctx => ctx.db.query("accessGrantStatus").withIndex("by_employee_device", q => q.eq("employeeId", f.employeeId).eq("deviceId", f.hikId)).unique())).toMatchObject({ state: "removed" });
});

it("N4/N7: virtual visitor cards skip preserved Hik person identities", async () => {
  const f = await fixture();
  vi.spyOn(crypto, "getRandomValues").mockImplementationOnce(array => {
    if (array instanceof Uint32Array) array[0] = 7;
    return array;
  }).mockImplementationOnce(array => {
    if (array instanceof Uint32Array) array[0] = 456;
    return array;
  });
  expect(await f.t.run(ctx => generateVisitorCard(ctx))).toBe("456");
});
