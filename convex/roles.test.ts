// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import rateLimiterTest from "@convex-dev/rate-limiter/test";
import { describe, expect, it } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import type { Doc, Id } from "./_generated/dataModel";
import { getProjectIdsWithPermission, hasPermission } from "./lib/permissions";
import {
  PERMISSIONS,
  ROLE_DEFAULTS,
  isDefaultPermissionSet,
  legacyRoleToProjectRole,
  normalizeRolePermissions,
  type ProjectRole,
} from "./lib/roleCatalog";

const modules = import.meta.glob("./**/*.ts");

type LegacyRole = Doc<"users">["role"];

async function setup() {
  const t = convexTest(schema, modules);
  rateLimiterTest.register(t);
  const ids = await t.run(async (ctx) => ({
    projectId: await ctx.db.insert("projects", { name: "Proje A" }),
    otherProjectId: await ctx.db.insert("projects", { name: "Proje B" }),
  }));
  async function member(name: string, legacyRole: LegacyRole, role?: ProjectRole, projectId: Id<"projects"> = ids.projectId) {
    const userId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("users", { role: legacyRole, name, email: `${name}@example.test`, verified: true });
      if (legacyRole !== "super_admin") await ctx.db.insert("userProjects", { userId: id, projectId, ...(role ? { role } : {}) });
      return id;
    });
    const sessionId = await t.run(async (ctx) => ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 86400000 }));
    return { userId, as: t.withIdentity({ subject: `${userId}|${sessionId}` }) };
  }
  return { t, ...ids, member };
}

describe("roleCatalog", () => {
  it("varsayılan tablo onaylı matrise uyar", () => {
    expect(ROLE_DEFAULTS.admin).toEqual(PERMISSIONS);
    expect(ROLE_DEFAULTS.viewer).toEqual(["employees.view", "reports.view", "doors.open"]);
    for (const role of ["hr", "security", "technician", "viewer"] as const) {
      expect(ROLE_DEFAULTS[role]).not.toContain("admin.manage");
    }
  });

  it("normalize: admin-yalnız anahtarı atar, tekrarları siler, sırayı sabitler", () => {
    expect(normalizeRolePermissions("hr", ["pay.view", "admin.manage", "employees.view", "pay.view"]))
      .toEqual(["employees.view", "pay.view"]);
    expect(normalizeRolePermissions("admin", [])).toEqual([...PERMISSIONS]);
    expect(isDefaultPermissionSet("viewer", ["doors.open", "employees.view", "reports.view"])).toBe(true);
  });

  it("eski rol eşlemesi", () => {
    expect(legacyRoleToProjectRole("project_admin")).toBe("admin");
    expect(legacyRoleToProjectRole("project_user")).toBe("viewer");
    expect(legacyRoleToProjectRole(undefined)).toBe("viewer");
    expect(legacyRoleToProjectRole("hr")).toBe("hr");
  });
});

describe("myPermissions", () => {
  it("rolü boş üyelik eski global rolden türetilir", async () => {
    const { projectId, member } = await setup();
    const admin = await member("admin", "project_admin");
    const viewer = await member("viewer", "project_user");
    expect(await admin.as.query(api.roles.myPermissions, { projectId })).toEqual({ role: "admin", permissions: [...PERMISSIONS] });
    expect(await viewer.as.query(api.roles.myPermissions, { projectId })).toEqual({ role: "viewer", permissions: ROLE_DEFAULTS.viewer });
  });

  it("üye olmadığı projede yetki yok; super_admin her yerde tam", async () => {
    const { otherProjectId, member } = await setup();
    const hr = await member("hr", "project_user", "hr");
    const root = await member("root", "super_admin");
    expect(await hr.as.query(api.roles.myPermissions, { projectId: otherProjectId })).toEqual({ role: null, permissions: [] });
    expect(await root.as.query(api.roles.myPermissions, { projectId: otherProjectId })).toEqual({ role: "super_admin", permissions: [...PERMISSIONS] });
  });
});

describe("setRolePermissions", () => {
  it("Yönetici kutucuğu değiştirir, üyeye yansır, varsayılana dönünce satır silinir", async () => {
    const { t, projectId, member } = await setup();
    const admin = await member("admin", "project_admin", "admin");
    const hr = await member("hr", "project_user", "hr");

    const withoutPay = ROLE_DEFAULTS.hr.filter((p) => p !== "pay.view");
    await admin.as.mutation(api.roles.setRolePermissions, { projectId, role: "hr", permissions: [...withoutPay, "admin.manage"] });
    expect((await hr.as.query(api.roles.myPermissions, { projectId })).permissions).toEqual(withoutPay);

    const roles = await admin.as.query(api.roles.listProjectRoles, { projectId });
    expect(roles.find((r) => r.role === "hr")).toMatchObject({ isDefault: false, locked: false, permissions: withoutPay });
    expect(roles.find((r) => r.role === "admin")).toMatchObject({ locked: true, permissions: [...PERMISSIONS] });

    await admin.as.mutation(api.roles.setRolePermissions, { projectId, role: "hr", permissions: [...ROLE_DEFAULTS.hr] });
    expect(await t.run(async (ctx) => ctx.db.query("projectRolePermissions").collect())).toEqual([]);
    expect((await hr.as.query(api.roles.myPermissions, { projectId })).permissions).toEqual(ROLE_DEFAULTS.hr);

    const audit = await t.run(async (ctx) => ctx.db.query("auditLog").collect());
    expect(audit.filter((a) => a.targetTable === "projectRolePermissions")).toHaveLength(2);
  });

  it("değişiklik yalnız o projeyi etkiler", async () => {
    const { otherProjectId, projectId, member } = await setup();
    const admin = await member("admin", "project_admin", "admin");
    const otherHr = await member("otherHr", "project_user", "hr", otherProjectId);
    await admin.as.mutation(api.roles.setRolePermissions, { projectId, role: "hr", permissions: [] });
    expect((await otherHr.as.query(api.roles.myPermissions, { projectId: otherProjectId })).permissions).toEqual(ROLE_DEFAULTS.hr);
  });

  it("Yönetici rolü kilitli; admin.manage'siz rol düzenleyemez", async () => {
    const { projectId, member } = await setup();
    const admin = await member("admin", "project_admin", "admin");
    const hr = await member("hr", "project_user", "hr");
    await expect(admin.as.mutation(api.roles.setRolePermissions, { projectId, role: "admin", permissions: [] }))
      .rejects.toThrow("Yönetici rolünün yetkileri değiştirilemez");
    await expect(hr.as.mutation(api.roles.setRolePermissions, { projectId, role: "hr", permissions: [...PERMISSIONS] }))
      .rejects.toThrow("Bu işlem için yetkiniz yok");
    await expect(hr.as.query(api.roles.listProjectRoles, { projectId })).rejects.toThrow("Bu işlem için yetkiniz yok");
  });

  it("başka projenin yöneticisi bu projeye dokunamaz", async () => {
    const { otherProjectId, projectId, member } = await setup();
    const foreignAdmin = await member("foreign", "project_admin", "admin", otherProjectId);
    await expect(foreignAdmin.as.mutation(api.roles.setRolePermissions, { projectId, role: "viewer", permissions: [] }))
      .rejects.toThrow("Bu işlem için yetkiniz yok");
  });
});

describe("setMemberRole", () => {
  it("rol değişir, users.role'e dokunulmaz, son yönetici düşürülemez", async () => {
    const { t, projectId, member } = await setup();
    const admin = await member("admin", "project_admin", "admin");
    const viewer = await member("viewer", "project_user", "viewer");

    await expect(admin.as.mutation(api.roles.setMemberRole, { projectId, userId: admin.userId, role: "viewer" }))
      .rejects.toThrow("Projenin son yöneticisinin rolü değiştirilemez");

    await admin.as.mutation(api.roles.setMemberRole, { projectId, userId: viewer.userId, role: "admin" });
    expect(await t.run(async (ctx) => (await ctx.db.get(viewer.userId))?.role)).toBe("project_user");
    expect(await viewer.as.query(api.roles.myPermissions, { projectId })).toMatchObject({ role: "admin" });

    await viewer.as.mutation(api.roles.setMemberRole, { projectId, userId: admin.userId, role: "security" });
    expect(await t.run(async (ctx) => (await ctx.db.get(admin.userId))?.role)).toBe("project_admin");
    const members = await viewer.as.query(api.roles.listProjectMembers, { projectId });
    expect(members.map((m) => [m.name, m.role]).sort()).toEqual([["admin", "security"], ["viewer", "admin"]]);
  });

  it("üye olmayan ve yetkisiz çağrılar reddedilir", async () => {
    const { projectId, otherProjectId, member } = await setup();
    const admin = await member("admin", "project_admin", "admin");
    const hr = await member("hr", "project_user", "hr");
    const outsider = await member("outsider", "project_user", "viewer", otherProjectId);
    await expect(admin.as.mutation(api.roles.setMemberRole, { projectId, userId: outsider.userId, role: "hr" }))
      .rejects.toThrow("Kullanıcı bu projenin üyesi değil");
    await expect(hr.as.mutation(api.roles.setMemberRole, { projectId, userId: hr.userId, role: "admin" }))
      .rejects.toThrow("Bu işlem için yetkiniz yok");
  });
});

describe("lib/permissions", () => {
  it("getProjectIdsWithPermission projeye göre farklı rolü hesaba katar", async () => {
    const { t, projectId, otherProjectId } = await setup();
    const result = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", { role: "project_user", name: "çift", verified: true });
      await ctx.db.insert("userProjects", { userId, projectId, role: "hr" });
      await ctx.db.insert("userProjects", { userId, projectId: otherProjectId, role: "technician" });
      const user = await ctx.db.get(userId);
      if (!user) throw new Error("user");
      return {
        pay: await getProjectIdsWithPermission(ctx, user, "pay.view"),
        devices: await getProjectIdsWithPermission(ctx, user, "devices.manage"),
        doors: await getProjectIdsWithPermission(ctx, user, "doors.open"),
        orphan: await hasPermission(ctx, user, undefined, "employees.view"),
      };
    });
    expect(result.pay).toEqual([projectId]);
    expect(result.devices).toEqual([otherProjectId]);
    expect(result.doors).toEqual([otherProjectId]);
    expect(result.orphan).toBe(false);
  });

  it("internal checkPermission action'lar için aynı kararı verir", async () => {
    const { t, projectId, member } = await setup();
    const security = await member("sec", "project_user", "security");
    expect(await t.query(internal.roles.checkPermission, { userId: security.userId, projectId, permission: "visitors.manage" })).toBe(true);
    expect(await t.query(internal.roles.checkPermission, { userId: security.userId, projectId, permission: "devices.manage" })).toBe(false);
    expect(await t.query(internal.roles.checkPermission, { userId: security.userId, permission: "doors.open" })).toBe(false);
  });
});

describe("backfillMemberRoles", () => {
  it("yalnız boş rolleri doldurur, tekrar güvenli", async () => {
    const { t, member } = await setup();
    await member("admin", "project_admin");
    await member("user", "project_user");
    await member("hr", "project_user", "hr");
    expect(await t.mutation(internal.roles.backfillMemberRoles, {})).toEqual({ updated: 2, remaining: false });
    expect(await t.mutation(internal.roles.backfillMemberRoles, {})).toEqual({ updated: 0, remaining: false });
    const roles = await t.run(async (ctx) => (await ctx.db.query("userProjects").collect()).map((m) => m.role).sort());
    expect(roles).toEqual(["admin", "hr", "viewer"]);
  });
});

describe("invites", () => {
  it("davet yalnız admin.manage ile; rol proje rolü olarak saklanır", async () => {
    const { t, projectId, member } = await setup();
    const admin = await member("admin", "project_admin", "admin");
    const hr = await member("hr", "project_user", "hr");
    await expect(t.mutation(internal.invites.create, { callerId: hr.userId, email: "x@example.test", projectId, role: "viewer" }))
      .rejects.toThrow("Bu projeye davet gönderme yetkin yok");
    await t.mutation(internal.invites.create, { callerId: admin.userId, email: "New@Example.test", projectId, role: "project_user" });
    await t.mutation(internal.invites.create, { callerId: admin.userId, email: "sec@example.test", projectId, role: "security" });
    const invites = await t.run(async (ctx) => ctx.db.query("invites").collect());
    expect(invites.map((i) => [i.email, i.role]).sort()).toEqual([["new@example.test", "viewer"], ["sec@example.test", "security"]]);
  });
});

describe("myPermissionsByProject", () => {
  it("her üyelik için projeye özgü yetkiyi döner", async () => {
    const { t, projectId, otherProjectId, member } = await setup();
    const dual = await member("çift", "project_user", "hr");
    await t.run(async (ctx) => ctx.db.insert("userProjects", { userId: dual.userId, projectId: otherProjectId, role: "technician" }));
    const rows = await dual.as.query(api.roles.myPermissionsByProject, {});
    expect(rows).toEqual([
      { projectId, role: "hr", permissions: ROLE_DEFAULTS.hr },
      { projectId: otherProjectId, role: "technician", permissions: ROLE_DEFAULTS.technician },
    ]);
  });
});
