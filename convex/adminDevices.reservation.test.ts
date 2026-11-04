// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const timestamps = { createdAt: "2026-11-04T09:00:00Z", updatedAt: "2026-11-04T09:00:00Z" };
async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "A" });
    const otherProjectId = await ctx.db.insert("projects", { name: "B" });
    const adminId = await ctx.db.insert("users", { role: "project_admin", verified: true });
    const superId = await ctx.db.insert("users", { role: "super_admin", verified: true });
    await ctx.db.insert("userProjects", { userId: adminId, projectId, role: "admin" });
    const poolId = await ctx.db.insert("adminDevices", { name: "Pool", brand: "ide_smart", ideUuid: "123456789012345", ideUser: "admin", idePassword: "secret", ...timestamps });
    const adminSession = await ctx.db.insert("authSessions", { userId: adminId, expirationTime: Date.now() + 86400000 });
    const superSession = await ctx.db.insert("authSessions", { userId: superId, expirationTime: Date.now() + 86400000 });
    return { projectId, otherProjectId, adminId, superId, poolId, adminSession, superSession };
  });
  const admin = t.withIdentity({ subject: `${ids.adminId}|${ids.adminSession}` });
  const root = t.withIdentity({ subject: `${ids.superId}|${ids.superSession}` });
  const snapshot = () => t.run(async ctx => ({
    pool: await ctx.db.query("adminDevices").collect(), devices: await ctx.db.query("devices").collect(),
    zones: await ctx.db.query("zones").collect(), doors: await ctx.db.query("doors").collect(),
    readers: await ctx.db.query("readers").collect(),
  }));
  return { t, ...ids, admin, root, snapshot };
}
it.each([false, true])("CIH-02: admin cannot claim unreserved or foreign reserved pool (foreign=%s), with no writes", async foreign => {
  const f = await fixture();
  if (foreign) await f.t.run(ctx => ctx.db.patch(f.poolId, { assignedProjectId: f.otherProjectId }));
  const before = await f.snapshot();
  await expect(f.admin.mutation(api.devices.claimDevice, { adminDeviceId: f.poolId, projectId: f.projectId })).rejects.toMatchObject({ data: {
    code: "DEVICE_NOT_RESERVED", message: "Bu cihaz projenize ayrılmamış. Cihazı projenize ayırması için sistem yöneticisiyle iletişime geçin.",
  } });
  expect(await f.snapshot()).toEqual(before);
});
it.each(["ide_smart", "hikvision", "other"] as const)("CIH-02: super admin reserves %s without claiming, and only the project's admin sees it", async brand => {
  const f = await fixture();
  await f.t.run(ctx => ctx.db.patch(f.poolId, { brand }));
  expect(await f.admin.query(api.adminDevices.listForClaim, {})).toEqual([]);
  await expect(f.admin.mutation(api.adminDevices.reserve, { adminDeviceId: f.poolId, projectId: f.projectId, expectedAssignedProjectId: null })).rejects.toThrow();
  await f.root.mutation(api.adminDevices.reserve, { adminDeviceId: f.poolId, projectId: f.otherProjectId, expectedAssignedProjectId: null });
  expect(await f.admin.query(api.adminDevices.listForClaim, {})).toEqual([]);
  await f.root.mutation(api.adminDevices.reserve, { adminDeviceId: f.poolId, projectId: f.projectId, expectedAssignedProjectId: f.otherProjectId });
  const reserved = await f.snapshot();
  expect(reserved.pool[0]).toMatchObject({ assignedProjectId: f.projectId });
  expect(reserved.pool[0].assignedDeviceId).toBeUndefined();
  expect(reserved.devices).toEqual([]);
  expect(await f.admin.query(api.adminDevices.listForClaim, {})).toMatchObject([{ _id: f.poolId }]);
  const { deviceId } = await f.admin.mutation(api.devices.claimDevice, { adminDeviceId: f.poolId, projectId: f.projectId });
  expect(await f.t.run(ctx => ctx.db.get(deviceId))).toMatchObject({ projectId: f.projectId });
  expect(await f.admin.query(api.adminDevices.listForClaim, {})).toEqual([]);
});
it.each([false, true])("CIH-02: super admin claims IDE regardless of reservation (foreign=%s)", async foreign => {
  const f = await fixture();
  if (foreign) await f.t.run(ctx => ctx.db.patch(f.poolId, { assignedProjectId: f.otherProjectId }));
  expect(await f.root.query(api.adminDevices.listForClaim, {})).toHaveLength(1);
  await expect(f.root.mutation(api.devices.claimDevice, { adminDeviceId: f.poolId, projectId: f.projectId })).resolves.toHaveProperty("deviceId");
});
it("CIH-02: stale reservation and already claimed device cannot be reserved", async () => {
  const f = await fixture();
  await f.root.mutation(api.adminDevices.reserve, { adminDeviceId: f.poolId, projectId: f.projectId, expectedAssignedProjectId: null });
  const before = await f.snapshot();
  await expect(f.root.mutation(api.adminDevices.reserve, { adminDeviceId: f.poolId, projectId: f.otherProjectId, expectedAssignedProjectId: null })).rejects.toMatchObject({ data: { code: "DEVICE_ASSIGNMENT_CHANGED" } });
  expect(await f.snapshot()).toEqual(before);
  await f.admin.mutation(api.devices.claimDevice, { adminDeviceId: f.poolId, projectId: f.projectId });
  const claimed = await f.snapshot();
  await expect(f.root.mutation(api.adminDevices.reserve, { adminDeviceId: f.poolId, projectId: f.otherProjectId, expectedAssignedProjectId: f.projectId })).rejects.toThrow("zaten");
  expect(await f.snapshot()).toEqual(claimed);
});

it("CIH-02: membership without devices.manage does not expose that project's reserved UUID", async () => {
  const f = await fixture();
  await f.t.run(async ctx => {
    await ctx.db.insert("userProjects", { userId: f.adminId, projectId: f.otherProjectId, role: "viewer" });
    await ctx.db.patch(f.poolId, { assignedProjectId: f.otherProjectId });
  });
  expect(await f.admin.query(api.adminDevices.listForClaim, {})).toEqual([]);
});
it("CIH-02: removing a reservation leaves the device in the pool and hides it from project admins", async () => {
  const f = await fixture();
  await f.root.mutation(api.adminDevices.reserve, { adminDeviceId: f.poolId, projectId: f.projectId, expectedAssignedProjectId: null });
  await f.root.mutation(api.adminDevices.reserve, { adminDeviceId: f.poolId, expectedAssignedProjectId: f.projectId });
  expect(await f.admin.query(api.adminDevices.listForClaim, {})).toEqual([]);
  expect((await f.snapshot()).pool[0].assignedProjectId).toBeUndefined();
  expect((await f.snapshot()).devices).toEqual([]);
});
