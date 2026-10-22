// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import rateLimiterTest from "@convex-dev/rate-limiter/test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import type { ProjectRole, Permission } from "./lib/roleCatalog";
import { ROLE_DEFAULTS } from "./lib/roleCatalog";

const modules = import.meta.glob("./**/*.ts");
async function setup() {
  const t = convexTest(schema, modules);
  rateLimiterTest.register(t);
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "Cihaz projesi" });
    const otherProjectId = await ctx.db.insert("projects", { name: "Diğer proje" });
    const deviceId = await ctx.db.insert("devices", { projectId, name: "Köprü", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), brand: "hikvision", hikTransport: "localBridge", devicePassword: "secret", idePassword: "mqtt-secret", ehomeKey: "key", apiToken: "token" });
    const eventId = await ctx.db.insert("deviceEvents", { projectId, deviceId, source: "hikvision", eventTime: new Date().toISOString(), category: "alarm", severity: "warning", label: "Alarm", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    return { projectId, otherProjectId, deviceId, eventId };
  });
  async function member(role: ProjectRole) {
    const { userId, sessionId } = await t.run(async ctx => {
      // Deliberately misleading legacy role: the membership must decide access.
      const userId = await ctx.db.insert("users", { role: role === "admin" ? "project_user" : "project_admin", verified: true });
      await ctx.db.insert("userProjects", { userId, projectId: ids.projectId, role });
      const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 86400000 });
      return { userId, sessionId };
    });
    return { userId, as: t.withIdentity({ subject: `${userId}|${sessionId}` }) };
  }
  const snapshot = () => t.run(async ctx => ({
    zones: await ctx.db.query("zones").collect(), templates: await ctx.db.query("accessScheduleTemplates").collect(),
    events: await ctx.db.query("deviceEvents").collect(), queue: await ctx.db.query("hikPendingOperations").collect(),
    settings: await ctx.db.query("alarmSettings").collect(),
  }));
  return { t, ...ids, member, snapshot };
}

type Fixture = Awaited<ReturnType<typeof setup>>;
type Member = Awaited<ReturnType<Fixture["member"]>>;
const cases: { permission: Permission; allowed: Exclude<ProjectRole, "admin">; denied: ProjectRole; run: (f: Fixture, m: Member) => Promise<unknown> }[] = [
  { permission: "devices.manage", allowed: "technician", denied: "viewer", run: (f, m) => m.as.mutation(api.zones.create, { projectId: f.projectId, name: "Bölge" }) },
  { permission: "accessRules.manage", allowed: "technician", denied: "security", run: (f, m) => m.as.mutation(api.accessScheduleTemplates.create, { projectId: f.projectId, name: "Mesai", week: { Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [], Saturday: [], Sunday: [] } }) },
  { permission: "doors.open", allowed: "viewer", denied: "hr", run: (f, m) => m.as.action(api.actions.hikGatewayDevice.remoteOpenDoor, { deviceId: f.deviceId }) },
  { permission: "alarms.ack", allowed: "security", denied: "viewer", run: (f, m) => m.as.mutation(api.alarms.acknowledge, { ids: [f.eventId] }) },
  { permission: "employees.manage", allowed: "hr", denied: "technician", run: (f, m) => m.as.action(api.actions.hikGatewayDevice.captureCardFromDevice, { deviceId: f.deviceId }) },
  { permission: "biometrics.manage", allowed: "hr", denied: "technician", run: (f, m) => m.as.action(api.actions.hikGatewayDevice.captureFaceFromDevice, { deviceId: f.deviceId }) },
];

describe("device permissions follow project roles and current overrides", () => {
  it.each(cases)("$permission allows $allowed, rejects $denied, respects removal", async testCase => {
    const f = await setup();
    const allowed = await f.member(testCase.allowed);
    const denied = await f.member(testCase.denied);
    const admin = await f.member("admin");
    const before = await f.snapshot();
    await expect(testCase.run(f, denied)).rejects.toThrow("Bu işlem için yetkiniz yok");
    expect(await f.snapshot()).toEqual(before);
    await expect(testCase.run(f, allowed)).resolves.toBeDefined();
    await admin.as.mutation(api.roles.setRolePermissions, { projectId: f.projectId, role: testCase.allowed, permissions: ROLE_DEFAULTS[testCase.allowed].filter(p => p !== testCase.permission) });
    const revoked = await f.snapshot();
    await expect(testCase.run(f, allowed)).rejects.toThrow("Bu işlem için yetkiniz yok");
    expect(await f.snapshot()).toEqual(revoked);
  });

  it.each(["viewer", "security", "technician"] as const)("%s can open a door by default", async role => {
    const f = await setup();
    const caller = await f.member(role);
    await expect(caller.as.action(api.actions.hikGatewayDevice.remoteOpenDoor, { deviceId: f.deviceId })).resolves.toMatchObject({ ok: true, queued: true });
  });

  it("device secrets use the same project permission for list, detail and update", async () => {
    const f = await setup();
    const technician = await f.member("technician");
    const admin = await f.member("admin");
    await expect(technician.as.query(api.devices.getById, { deviceId: f.deviceId })).resolves.toMatchObject({ devicePassword: "secret", idePassword: "mqtt-secret", ehomeKey: "key", apiToken: "token" });
    await technician.as.mutation(api.devices.update, { deviceId: f.deviceId, devicePassword: "new" });
    await admin.as.mutation(api.roles.setRolePermissions, { projectId: f.projectId, role: "technician", permissions: ROLE_DEFAULTS.technician.filter(p => p !== "devices.manage") });
    const detail = await technician.as.query(api.devices.getById, { deviceId: f.deviceId });
    const list = await technician.as.query(api.devices.list, { projectId: f.projectId });
    for (const row of [detail, ...list]) for (const key of ["devicePassword", "idePassword", "ehomeKey", "apiToken"] as const) expect(row?.[key]).toBeUndefined();
    await expect(technician.as.mutation(api.devices.update, { deviceId: f.deviceId, devicePassword: "" })).rejects.toThrow("Bu işlem için yetkiniz yok");
    expect(await f.t.run(ctx => ctx.db.get(f.deviceId))).toMatchObject({ devicePassword: "new" });
    await f.t.run(ctx => ctx.db.insert("userProjects", { userId: technician.userId, projectId: f.otherProjectId, role: "admin" }));
    expect((await technician.as.query(api.devices.list, {}))[0]?.devicePassword).toBeUndefined();
  });

  it("claim pool secrets require devices.manage in at least one project", async () => {
    const f = await setup();
    const technician = await f.member("technician");
    const viewer = await f.member("viewer");
    const admin = await f.member("admin");
    await f.t.run(ctx => ctx.db.insert("adminDevices", { name: "Havuz paneli", idePassword: "pool-secret", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }));
    await expect(viewer.as.query(api.adminDevices.listForClaim, {})).rejects.toThrow("Bu işlem için yetkiniz yok");
    expect(await technician.as.query(api.adminDevices.listForClaim, {})).toMatchObject([{ idePassword: "pool-secret" }]);
    await admin.as.mutation(api.roles.setRolePermissions, { projectId: f.projectId, role: "technician", permissions: ROLE_DEFAULTS.technician.filter(p => p !== "devices.manage") });
    await expect(technician.as.query(api.adminDevices.listForClaim, {})).rejects.toThrow("Bu işlem için yetkiniz yok");
    await expect(admin.as.query(api.ideDefaults.get, {})).rejects.toThrow("süper admin");
  });

  it("grant diagnostics follow accessRules.manage independently from devices.manage", async () => {
    const f = await setup();
    const technician = await f.member("technician");
    const admin = await f.member("admin");
    await admin.as.mutation(api.roles.setRolePermissions, { projectId: f.projectId, role: "technician", permissions: ["accessRules.manage"] });
    await expect(technician.as.query(api.accessGrantStatus.counts, { projectId: f.projectId })).resolves.toMatchObject({ all: 0 });
    await admin.as.mutation(api.roles.setRolePermissions, { projectId: f.projectId, role: "technician", permissions: ["devices.manage"] });
    await expect(technician.as.query(api.accessGrantStatus.counts, { projectId: f.projectId })).rejects.toThrow("Bu işlem için yetkiniz yok");
  });

  it("alarm mail settings require the locked admin.manage permission", async () => {
    const f = await setup();
    const admin = await f.member("admin");
    for (const role of ["hr", "security", "technician", "viewer"] as const) {
      const caller = await f.member(role);
      const before = await f.snapshot();
      await expect(caller.as.mutation(api.alarms.saveSettings, { projectId: f.projectId, emailEnabled: false, recipients: [], minSeverity: "warning" })).rejects.toThrow("Bu işlem için yetkiniz yok");
      expect(await f.snapshot()).toEqual(before);
    }
    await expect(admin.as.mutation(api.alarms.saveSettings, { projectId: f.projectId, emailEnabled: false, recipients: [], minSeverity: "warning" })).resolves.toMatchObject({ success: true });
  });
});
