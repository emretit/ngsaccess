// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import type { FunctionArgs } from "convex/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const now = "2026-10-22T09:00:00.000Z";
const timestamps = { createdAt: now, updatedAt: now };
const mutations = ["create", "createIdePanel", "createHikDevice", "claimDevice", "reassignDevice", "releaseDevice"] as const;
type Mutation = typeof mutations[number];

async function fixture(role: "admin" | "viewer" | "super_admin" = "admin") {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(now));
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "A" });
    const otherProjectId = await ctx.db.insert("projects", { name: "B" });
    const userId = await ctx.db.insert("users", { name: role, role: role === "super_admin" ? role : "project_user", verified: true });
    if (role !== "super_admin") await ctx.db.insert("userProjects", { userId, projectId, role });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 86400000 });
    return { projectId, otherProjectId, userId, sessionId };
  });
  return { t, ...ids, as: t.withIdentity({ subject: `${ids.userId}|${ids.sessionId}` }) };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
function payload<T extends { _id: unknown; _creationTime: number }>(row: T) {
  const { _id, _creationTime, ...rest } = row;
  void _id; void _creationTime;
  return rest;
}
async function state(f: Fixture) {
  return await f.t.run(async ctx => ({
    devices: await ctx.db.query("devices").collect(),
    adminDevices: await ctx.db.query("adminDevices").collect(),
    zones: await ctx.db.query("zones").collect(),
    doors: await ctx.db.query("doors").collect(),
    readers: await ctx.db.query("readers").collect(),
    groups: await ctx.db.query("groupDevices").collect(),
    groupDoors: await ctx.db.query("groupDoors").collect(),
    readings: await ctx.db.query("cardReadings").collect(),
    operations: await ctx.db.query("hikPendingOperations").collect(),
    audit: await ctx.db.query("auditLog").collect(),
    jobs: await ctx.db.system.query("_scheduled_functions").collect(),
  }));
}
async function noExtraEffects(f: Fixture) {
  const s = await state(f);
  expect(s.audit).toEqual([]);
  expect(s.jobs).toEqual([]);
  expect(s.groups).toEqual([]);
  expect(s.groupDoors).toEqual([]);
  expect(s.readings).toEqual([]);
  expect(s.operations).toEqual([]);
  return s;
}
async function pool(f: Fixture, projectId?: Id<"projects">) {
  return await f.t.run(async ctx => {
    const adminDeviceId = await ctx.db.insert("adminDevices", { name: "Pool", brand: "ide_smart", ideUuid: "123456789012345", ideUser: "user", idePassword: "pass", ideDoorCount: 1, ...timestamps });
    if (!projectId) return { adminDeviceId };
    const deviceId = await ctx.db.insert("devices", { name: "Pool", projectId, adminDeviceId, brand: "ide_smart", isActive: true, status: "active", lastSeen: now, ...timestamps });
    await ctx.db.patch(adminDeviceId, { assignedDeviceId: deviceId, assignedProjectId: projectId });
    return { adminDeviceId, deviceId };
  });
}
async function invoke(f: Fixture, mutation: Mutation, projectId: Id<"projects">) {
  switch (mutation) {
    case "create": return await f.as.mutation(api.devices.create, { name: "New", projectId });
    case "createIdePanel": return await f.as.mutation(api.devices.createIdePanel, { name: "New", projectId });
    case "createHikDevice": return await f.as.mutation(api.devices.createHikDevice, { name: "New", projectId, doorCount: 1, readersPerDoor: 1 });
    case "claimDevice": {
      const { adminDeviceId } = await pool(f);
      return await f.as.mutation(api.devices.claimDevice, { adminDeviceId, projectId });
    }
    case "reassignDevice": {
      const { adminDeviceId } = await pool(f, projectId);
      return await f.as.mutation(api.devices.reassignDevice, { adminDeviceId, projectId, name: "Renamed" });
    }
    case "releaseDevice": {
      const { deviceId } = await pool(f, projectId);
      if (!deviceId) throw new Error("Fixture device missing");
      return await f.as.mutation(api.devices.releaseDevice, { deviceId });
    }
  }
}
async function topology(f: Fixture, result: { deviceId: Id<"devices">; zoneId: Id<"zones">; doorIds: Id<"doors">[] }, projectId: Id<"projects"> | undefined, hik = false) {
  const s = await noExtraEffects(f);
  const scope = projectId ? { projectId } : {};
  expect(s.zones.map(payload)).toEqual([{ name: "Zone", ...scope, ...timestamps }]);
  expect(s.doors.map(payload)).toEqual(result.doorIds.map((_, i) => ({ name: `Kapı ${i + 1}`, ...scope, zoneId: result.zoneId, deviceId: result.deviceId, ...(hik ? { hikDoorNo: i + 1 } : { ioId: i }), status: "active", ...timestamps })));
  expect(s.readers.map(payload)).toEqual(result.doorIds.flatMap((doorId, i) => (hik ? [0, 1] : [0]).map(r => ({ doorId, deviceId: result.deviceId, ...scope, zoneId: result.zoneId, name: `Kapı ${i + 1}${hik ? r === 0 ? " Giriş" : " Çıkış" : ""}`, direction: hik ? r === 0 ? "entry" : "exit" : i === 0 ? "entry" : i === 1 ? "exit" : "both", ...(hik ? { hikReaderNo: i * 2 + r + 1 } : { ioId: i }), status: "active", ...timestamps }))));
  return s;
}

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe("devices mutation HEAD characterization", () => {
  it.each(mutations)("%s rejects viewer with exact permission error", async mutation => {
    const f = await fixture("viewer");
    await expect(invoke(f, mutation, f.projectId)).rejects.toThrow(/^Bu işlem için yetkiniz yok$/);
    const s = await noExtraEffects(f);
    expect(s.zones).toEqual([]);
    expect(s.doors).toEqual([]);
    expect(s.readers).toEqual([]);
  });
  it.each(mutations)("%s rejects foreign project with exact error", async mutation => {
    const f = await fixture();
    await expect(invoke(f, mutation, f.otherProjectId)).rejects.toThrow(/^Bu işlem için yetkiniz yok$/);
    const s = await noExtraEffects(f);
    expect(s.zones).toEqual([]);
    expect(s.doors).toEqual([]);
    expect(s.readers).toEqual([]);
  });
  it.each(["create", "createIdePanel", "createHikDevice"] as const)("%s requires project for non-super-admin", async mutation => {
    const f = await fixture();
    const call = mutation === "create" ? f.as.mutation(api.devices.create, { name: "New" }) : mutation === "createIdePanel" ? f.as.mutation(api.devices.createIdePanel, { name: "New" }) : f.as.mutation(api.devices.createHikDevice, { name: "New", doorCount: 1, readersPerDoor: 1 });
    await expect(call).rejects.toThrow(/^Cihaz oluşturmak için bir proje seçmelisiniz$/);
    expect((await noExtraEffects(f)).devices).toEqual([]);
  });
  it.each([false, true])("generic create full fields, pool=%s", async orphan => {
    const f = await fixture(orphan ? "super_admin" : "admin");
    const scope = orphan ? {} : { projectId: f.projectId };
    const args: FunctionArgs<typeof api.devices.create> = { name: "Generic", ...scope, newZoneName: "Zone", brand: "other", deviceIp: "192.0.2.1", deviceSerial: "serial", deviceUsername: "user", devicePassword: "secret", status: "inactive", isActive: true, description: "desc", doorCount: 3, accessDirection: "both" };
    const deviceId = await f.as.mutation(api.devices.create, args);
    const s = await noExtraEffects(f);
    const admin = s.adminDevices[0];
    expect(deviceId).toEqual(s.devices[0]._id);
    const { newZoneName, ...fields } = args;
    void newZoneName;
    expect(s.devices.map(payload)).toEqual([{ ...fields, zoneId: s.zones[0]._id, isActive: false, status: "inactive", adminDeviceId: admin._id, ...timestamps }]);
    expect(s.adminDevices.map(payload)).toEqual([{ name: "Generic", brand: "other", deviceSerial: "serial", assignedDeviceId: deviceId, ...(orphan ? {} : { assignedProjectId: f.projectId }), createdFromDevice: true, ...timestamps }]);
    expect(s.zones.map(payload)).toEqual([{ name: "Zone", ...scope, description: "desc", ...timestamps }]);
    expect(s.doors).toEqual([]); expect(s.readers).toEqual([]);
  });
  it.each([false, true])("IDE create defaults and full topology, pool=%s", async orphan => {
    const f = await fixture(orphan ? "super_admin" : "admin");
    const scope = orphan ? {} : { projectId: f.projectId };
    const result = await f.as.mutation(api.devices.createIdePanel, { name: "Panel", ...scope, newZoneName: "Zone", ideUuid: "123456789012345", ideDoorCount: 2 });
    const s = await topology(f, result, orphan ? undefined : f.projectId);
    expect(result).toEqual({ deviceId: s.devices[0]._id, zoneId: s.zones[0]._id, doorIds: s.doors.map(d => d._id) });
    expect(s.devices.map(payload)).toEqual([{ name: "Panel", ...scope, brand: "ide_smart", deviceType: "Erişim Paneli", ideUuid: "123456789012345", ideUser: "admin", idePassword: "admin12345", ideHttpPort: 80, ideDoorCount: 2, isActive: true, status: "active", zoneId: result.zoneId, adminDeviceId: s.adminDevices[0]._id, ...timestamps }]);
    expect(s.adminDevices.map(payload)).toEqual([{ name: "Panel", brand: "ide_smart", ideUuid: "123456789012345", ideUser: "admin", idePassword: "admin12345", ideHttpPort: 80, ideDoorCount: 2, assignedDeviceId: result.deviceId, ...(orphan ? {} : { assignedProjectId: f.projectId }), createdFromDevice: true, ...timestamps }]);
  });
  it.each([false, true])("Hik create full fields and topology, pool=%s", async orphan => {
    const f = await fixture(orphan ? "super_admin" : "admin");
    const scope = orphan ? {} : { projectId: f.projectId };
    const args = { name: "Hik", ...scope, newZoneName: "Zone", doorCount: 2, readersPerDoor: 99, hikFamily: "controller" as const, deviceType: "Controller", hikTransport: "localBridge" as const, deviceSerial: "serial", deviceIp: "192.0.2.1", deviceUsername: "user", devicePassword: "pass", ehomeID: "id", ehomeKey: "key", hikPort: 8000, accessDirection: "entry" as const, status: "inactive" };
    const result = await f.as.mutation(api.devices.createHikDevice, args);
    const s = await topology(f, result, orphan ? undefined : f.projectId, true);
    expect(result).toEqual({ deviceId: s.devices[0]._id, zoneId: s.zones[0]._id, doorIds: s.doors.map(d => d._id), readerIds: s.readers.map(r => r._id) });
    expect(s.devices.map(payload)).toEqual([{ name: "Hik", ...scope, brand: "hikvision", deviceType: "Controller", hikTransport: "localBridge", deviceSerial: "serial", deviceIp: "192.0.2.1", deviceUsername: "user", devicePassword: "pass", ehomeID: "id", ehomeKey: "key", hikPort: 8000, accessDirection: "entry", hikDoorCount: 2, isActive: false, status: "inactive", zoneId: result.zoneId, adminDeviceId: s.adminDevices[0]._id, ...timestamps }]);
    expect(s.adminDevices.map(payload)).toEqual([{ name: "Hik", brand: "hikvision", deviceSerial: "serial", assignedDeviceId: result.deviceId, ...(orphan ? {} : { assignedProjectId: f.projectId }), createdFromDevice: true, ...timestamps }]);
  });
  it.each(["admin", "super_admin"] as const)("claim full fields as %s", async role => {
    const f = await fixture(role);
    const { adminDeviceId } = await pool(f);
    const result = await f.as.mutation(api.devices.claimDevice, { adminDeviceId, projectId: f.projectId, expectedAssignedProjectId: null, newZoneName: "Zone", name: " Claimed ", ideUser: " custom ", idePassword: " password " });
    const s = await topology(f, result, f.projectId);
    expect(result).toEqual({ deviceId: s.devices[0]._id, zoneId: s.zones[0]._id, doorIds: s.doors.map(d => d._id) });
    expect(s.devices.map(payload)).toEqual([{ name: "Claimed", projectId: f.projectId, brand: "ide_smart", deviceType: "Erişim Paneli", ideUuid: "123456789012345", ideUser: "custom", idePassword: "password", ideHttpPort: 80, ideDoorCount: 1, isActive: true, status: "active", adminDeviceId, zoneId: result.zoneId, ...timestamps }]);
    expect(s.adminDevices.map(payload)).toEqual([{ name: "Pool", brand: "ide_smart", ideUuid: "123456789012345", ideUser: "custom", idePassword: "password", ideDoorCount: 1, assignedDeviceId: result.deviceId, assignedProjectId: f.projectId, ...timestamps }]);
  });
  it.each(["claimDevice", "reassignDevice"] as const)("%s preserves stale assignment error payload", async mutation => {
    const f = await fixture("super_admin");
    const { adminDeviceId } = await pool(f, f.projectId);
    await expect(f.as.mutation(api.devices[mutation], { adminDeviceId, projectId: f.otherProjectId, expectedAssignedProjectId: null })).rejects.toMatchObject({ data: { code: "DEVICE_ASSIGNMENT_CHANGED", message: "Cihazın ataması başka bir oturumda değişti. Listeyi yenileyip tekrar deneyin." } });
  });
  it("reassign same project synchronizes names and returns null", async () => {
    const f = await fixture();
    const { adminDeviceId, deviceId } = await pool(f, f.projectId);
    const before = await state(f);
    expect(await f.as.mutation(api.devices.reassignDevice, { adminDeviceId, projectId: f.projectId, name: " Renamed " })).toBeNull();
    const after = await noExtraEffects(f);
    expect(after.devices.map(payload)).toEqual(before.devices.map(d => ({ ...payload(d), name: "Renamed" })));
    expect(after.adminDevices.map(payload)).toEqual(before.adminDevices.map(d => ({ ...payload(d), name: "Renamed" })));
    expect(after.devices[0]._id).toEqual(deviceId);
  });
  it("super-admin reassign from pool creates full project topology", async () => {
    const f = await fixture("super_admin");
    const { adminDeviceId } = await pool(f);
    expect(await f.as.mutation(api.devices.reassignDevice, { adminDeviceId, projectId: f.projectId, name: " Renamed " })).toBeNull();
    const s = await noExtraEffects(f);
    const result = { deviceId: s.devices[0]._id, zoneId: s.zones[0]._id, doorIds: s.doors.map(d => d._id) };
    expect(s.zones.map(payload)).toEqual([{ name: "Renamed", projectId: f.projectId, ...timestamps }]);
    expect(s.devices.map(payload)).toEqual([{ name: "Renamed", projectId: f.projectId, adminDeviceId, brand: "ide_smart", deviceType: "Erişim Paneli", ideUuid: "123456789012345", ideUser: "user", idePassword: "pass", ideHttpPort: 80, ideDoorCount: 1, isActive: true, status: "active", zoneId: result.zoneId, ...timestamps }]);
    expect(s.adminDevices.map(payload)).toEqual([{ name: "Renamed", brand: "ide_smart", ideUuid: "123456789012345", ideUser: "user", idePassword: "pass", ideDoorCount: 1, assignedDeviceId: result.deviceId, assignedProjectId: f.projectId, ...timestamps }]);
    expect(s.doors.map(payload)).toEqual([{ name: "Kapı 1", projectId: f.projectId, deviceId: result.deviceId, zoneId: result.zoneId, ioId: 0, status: "active", ...timestamps }]);
    expect(s.readers.map(payload)).toEqual([{ name: "Kapı 1", projectId: f.projectId, deviceId: result.deviceId, zoneId: result.zoneId, doorId: result.doorIds[0], ioId: 0, direction: "entry", status: "active", ...timestamps }]);
  });
  it("super-admin reassign to pool purges device and preserves pool", async () => {
    const f = await fixture("super_admin");
    const { adminDeviceId } = await pool(f, f.projectId);
    expect(await f.as.mutation(api.devices.reassignDevice, { adminDeviceId, name: " Pool again " })).toBeNull();
    const s = await noExtraEffects(f);
    expect(s.devices).toEqual([]); expect(s.zones).toEqual([]); expect(s.doors).toEqual([]); expect(s.readers).toEqual([]);
    expect(s.adminDevices.map(payload)).toEqual([{ name: "Pool again", brand: "ide_smart", ideUuid: "123456789012345", ideUser: "user", idePassword: "pass", ideDoorCount: 1, ...timestamps }]);
  });
  it("super-admin rename unassigned pool entry returns null", async () => {
    const f = await fixture("super_admin");
    const { adminDeviceId } = await pool(f);
    expect(await f.as.mutation(api.devices.reassignDevice, { adminDeviceId, name: " Renamed " })).toBeNull();
    const s = await noExtraEffects(f);
    expect(s.devices).toEqual([]);
    expect(s.adminDevices.map(payload)).toEqual([{ name: "Renamed", brand: "ide_smart", ideUuid: "123456789012345", ideUser: "user", idePassword: "pass", ideDoorCount: 1, ...timestamps }]);
  });
  it.each([false, true])("release exact pool cleanup, createdFromDevice=%s", async createdFromDevice => {
    const f = await fixture();
    const { adminDeviceId, deviceId } = await pool(f, f.projectId);
    if (!deviceId) throw new Error("Fixture device missing");
    await f.t.run(async ctx => {
      if (createdFromDevice) await ctx.db.patch(adminDeviceId, { createdFromDevice: true });
      const zoneId = await ctx.db.insert("zones", { name: "Keep zone", projectId: f.projectId });
      const doorId = await ctx.db.insert("doors", { name: "Delete door", deviceId, zoneId, projectId: f.projectId });
      await ctx.db.insert("readers", { name: "Delete reader", doorId, deviceId, zoneId, projectId: f.projectId, direction: "entry", ...timestamps });
      await ctx.db.insert("hikPendingOperations", { projectId: f.projectId, deviceId, status: "processing", operation: "openDoor", payload: {}, attemptCount: 0, createdAt: Date.now() });
    });
    const before = await state(f);
    expect(await f.as.mutation(api.devices.releaseDevice, { deviceId })).toBeNull();
    const s = await noExtraEffects(f);
    expect(s.devices).toEqual([]); expect(s.doors).toEqual([]);
    expect(s.zones).toEqual(before.zones); expect(s.readers).toEqual([]);
    expect(s.adminDevices.map(payload)).toEqual(createdFromDevice ? [] : [{ name: "Pool", brand: "ide_smart", ideUuid: "123456789012345", ideUser: "user", idePassword: "pass", ideDoorCount: 1, lastSeen: now, ...timestamps }]);
  });
  it("super-admin releases an orphan device with its doors and readers", async () => {
    const f = await fixture("super_admin");
    const deviceId = await f.as.mutation(api.devices.create, { name: "Orphan" });
    await f.t.run(async ctx => {
      const doorId = await ctx.db.insert("doors", { name: "Orphan door", deviceId });
      await ctx.db.insert("readers", { name: "Orphan reader", doorId, deviceId, direction: "entry", ...timestamps });
    });
    expect(await f.as.mutation(api.devices.releaseDevice, { deviceId })).toBeNull();
    const s = await state(f);
    expect(s.devices).toEqual([]); expect(s.doors).toEqual([]); expect(s.readers).toEqual([]);
  });
  it("project admin still cannot release an orphan device", async () => {
    const f = await fixture();
    const deviceId = await f.t.run(ctx => ctx.db.insert("devices", { name: "Orphan", isActive: true, status: "active", ...timestamps }));
    const before = await state(f);
    await expect(f.as.mutation(api.devices.releaseDevice, { deviceId })).rejects.toThrow(/^Bu işlem için yetkiniz yok$/);
    expect(await state(f)).toEqual(before);
  });
});

describe("Hik project move guard", () => {
  it.each(["claimDevice", "reassignDevice"] as const)("%s rejects a move without any writes", async mutation => {
    const f = await fixture("super_admin");
    const { adminDeviceId, deviceId } = await pool(f, f.projectId);
    await f.t.run(async ctx => {
      await ctx.db.patch(adminDeviceId, { brand: "hikvision" });
      if (deviceId) await ctx.db.patch(deviceId, { brand: "hikvision", hikDevIndex: "registered", hikTransport: "gateway" });
    });
    const before = await state(f);
    await expect(f.as.mutation(api.devices[mutation], { adminDeviceId, projectId: f.otherProjectId, name: "Must not write" }))
      .rejects.toThrow(/HIK_DEVICE_MOVE_UNSUPPORTED/);
    expect(await state(f)).toEqual(before);
  });
  it("rejects Hik pool assignment and unassignment", async () => {
    const f = await fixture("super_admin");
    const { adminDeviceId } = await pool(f);
    await f.t.run(ctx => ctx.db.patch(adminDeviceId, { brand: "hikvision" }));
    const before = await state(f);
    await expect(f.as.mutation(api.devices.claimDevice, { adminDeviceId, projectId: f.projectId })).rejects.toThrow(/HIK_DEVICE_MOVE_UNSUPPORTED/);
    expect(await state(f)).toEqual(before);
    await f.t.run(ctx => ctx.db.patch(adminDeviceId, { assignedProjectId: f.projectId }));
    const assigned = await state(f);
    await expect(f.as.mutation(api.devices.reassignDevice, { adminDeviceId })).rejects.toThrow(/HIK_DEVICE_MOVE_UNSUPPORTED/);
    expect(await state(f)).toEqual(assigned);
  });
  it("keeps same-project Hik name editing and registration fields", async () => {
    const f = await fixture("super_admin");
    const { adminDeviceId, deviceId } = await pool(f, f.projectId);
    await f.t.run(async ctx => {
      await ctx.db.patch(adminDeviceId, { brand: "hikvision" });
      if (deviceId) await ctx.db.patch(deviceId, { brand: "hikvision", hikDevIndex: "registered", hikTransport: "gateway", ehomeID: "ehome" });
    });
    await f.as.mutation(api.devices.reassignDevice, { adminDeviceId, projectId: f.projectId, name: "Renamed Hik" });
    const after = await state(f);
    expect(after.devices[0]).toMatchObject({ _id: deviceId, name: "Renamed Hik", hikDevIndex: "registered", ehomeID: "ehome" });
    expect(after.adminDevices[0].name).toBe("Renamed Hik");
  });
});
