import { accessBlockReason } from "./lib/accountAccess";
import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { authedMutation, authedQuery } from "./lib/customFunctions";
import { writeAudit } from "./lib/audit";
import {
  hasOtherActiveAdmin,
  getMembership,
  getRolePermissions,
  hasPermission,
  isSuperAdmin,
  membershipRole,
  requirePermission,
} from "./lib/permissions";
import {
  LOCKED_ROLE,
  PERMISSIONS,
  PROJECT_ROLES,
  isDefaultPermissionSet,
  legacyRoleToProjectRole,
  normalizeRolePermissions,
  permissionValidator,
  projectRoleValidator,
  type Permission,
} from "./lib/roleCatalog";

/**
 * Sabit roller + proje bazlı yetki kutucukları (docs/roles/PLAN.md).
 * Rol ve yetki düzenleme `admin.manage` ister; Yönetici rolü kilitlidir.
 */

/** Yetki kümesini PERMISSIONS sırasıyla diziye çevirir (istemciye giden kanonik biçim). */
const orderedPermissions = (set: ReadonlySet<Permission>): Permission[] => PERMISSIONS.filter((p) => set.has(p));

/** Aktif projede çağıranın rolü ve yetkileri (menü/düğme görünürlüğü için). */
export const myPermissions = authedQuery({
  args: { projectId: v.optional(v.id("projects")) },
  returns: v.object({
    role: v.union(projectRoleValidator, v.literal("super_admin"), v.null()),
    permissions: v.array(permissionValidator),
  }),
  handler: async (ctx, args) => {
    if (isSuperAdmin(ctx.user)) return { role: "super_admin" as const, permissions: [...PERMISSIONS] };
    if (!args.projectId) return { role: null, permissions: [] };
    const membership = await getMembership(ctx, ctx.user._id, args.projectId);
    if (!membership) return { role: null, permissions: [] };
    const role = membershipRole(ctx.user, membership);
    return { role, permissions: orderedPermissions(await getRolePermissions(ctx, args.projectId, role)) };
  },
});

/** Çağıranın üye olduğu her projedeki rol ve yetkiler ("tüm projeler" görünümünde satır bazlı kontrol için). */
export const myPermissionsByProject = authedQuery({
  args: {},
  returns: v.array(v.object({
    projectId: v.id("projects"),
    role: v.union(projectRoleValidator, v.literal("super_admin")),
    permissions: v.array(permissionValidator),
  })),
  handler: async (ctx) => {
    if (isSuperAdmin(ctx.user)) {
      const projects = await ctx.db.query("projects").take(1000);
      return projects.map((p) => ({ projectId: p._id, role: "super_admin" as const, permissions: [...PERMISSIONS] }));
    }
    const memberships = await ctx.db
      .query("userProjects")
      .withIndex("by_user", (q) => q.eq("userId", ctx.user._id))
      .take(1000);
    const out = [];
    for (const membership of memberships) {
      const role = membershipRole(ctx.user, membership);
      const set = await getRolePermissions(ctx, membership.projectId, role);
      out.push({ projectId: membership.projectId, role, permissions: orderedPermissions(set) });
    }
    return out;
  },
});

/** Projedeki 5 rolün etkin yetkileri (Ayarlar › Roller). */
export const listProjectRoles = authedQuery({
  args: { projectId: v.id("projects") },
  returns: v.array(v.object({
    role: projectRoleValidator,
    permissions: v.array(permissionValidator),
    isDefault: v.boolean(),
    locked: v.boolean(),
  })),
  handler: async (ctx, args) => {
    await requirePermission(ctx, ctx.user, args.projectId, "admin.manage");
    const out = [];
    for (const role of PROJECT_ROLES) {
      const set = await getRolePermissions(ctx, args.projectId, role);
      const permissions = orderedPermissions(set);
      out.push({ role, permissions, isDefault: isDefaultPermissionSet(role, permissions), locked: role === LOCKED_ROLE });
    }
    return out;
  },
});

/** Bir rolün yetkilerini değiştirir. Varsayılana eşitse kayıt silinir ("Varsayılana dön" da budur). */
export const setRolePermissions = authedMutation({
  args: {
    projectId: v.id("projects"),
    role: projectRoleValidator,
    permissions: v.array(permissionValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requirePermission(ctx, ctx.user, args.projectId, "admin.manage");
    if (args.role === LOCKED_ROLE) throw new Error("Yönetici rolünün yetkileri değiştirilemez");
    const project = await ctx.db.get(args.projectId);
    if (!project) throw new Error("Proje bulunamadı");

    const next = normalizeRolePermissions(args.role, args.permissions);
    const existing = await ctx.db
      .query("projectRolePermissions")
      .withIndex("by_projectId_and_role", (q) => q.eq("projectId", args.projectId).eq("role", args.role))
      .unique();
    const isDefault = isDefaultPermissionSet(args.role, next);

    if (isDefault) {
      if (!existing) return null;
      await ctx.db.delete(existing._id);
    } else if (existing) {
      await ctx.db.patch(existing._id, { permissions: next, updatedAt: Date.now(), updatedBy: ctx.user._id });
    } else {
      await ctx.db.insert("projectRolePermissions", {
        projectId: args.projectId,
        role: args.role,
        permissions: next,
        updatedAt: Date.now(),
        updatedBy: ctx.user._id,
      });
    }

    await writeAudit(ctx, {
      user: ctx.user,
      projectId: args.projectId,
      action: "update",
      targetTable: "projectRolePermissions",
      targetId: `${args.projectId}:${args.role}`,
      oldValue: existing ? { permissions: existing.permissions } : { default: true },
      newValue: isDefault ? { default: true } : { permissions: next },
    });
    return null;
  },
});

/** Projedeki üyeler ve rolleri (Ayarlar › Kullanıcılar). */
export const listProjectMembers = authedQuery({
  args: { projectId: v.id("projects") },
  returns: v.array(v.object({
    userId: v.id("users"),
    name: v.union(v.string(), v.null()),
    email: v.union(v.string(), v.null()),
    role: projectRoleValidator,
    isSuperAdmin: v.boolean(),
    canResetPassword: v.boolean(),
  })),
  handler: async (ctx, args) => {
    await requirePermission(ctx, ctx.user, args.projectId, "admin.manage");
    const memberships = await ctx.db
      .query("userProjects")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .take(1000);
    const out = [];
    for (const membership of memberships) {
      const member = await ctx.db.get(membership.userId);
      if (!member) continue;
      out.push({
        userId: member._id,
        name: member.fullName ?? member.name ?? null,
        email: member.email ?? null,
        role: membershipRole(member, membership),
        isSuperAdmin: isSuperAdmin(member),
        canResetPassword: member.role !== "super_admin" && member.verified !== false && accessBlockReason(member, Date.now()) === null && Boolean(member.email && (await ctx.db.query("authAccounts")
          .withIndex("providerAndAccountId", q => q.eq("provider", "password").eq("providerAccountId", member.email?.toLowerCase() ?? ""))
          .unique())?.userId === member._id),
      });
    }
    return out;
  },
});

/** Üyenin proje rolünü değiştirir. Projede en az bir etkin Yönetici kalmalı. */
export const setMemberRole = authedMutation({
  args: {
    projectId: v.id("projects"),
    userId: v.id("users"),
    role: projectRoleValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requirePermission(ctx, ctx.user, args.projectId, "admin.manage");
    const target = await ctx.db.get(args.userId);
    if (!target) throw new Error("Kullanıcı bulunamadı");
    if (isSuperAdmin(target)) throw new Error("Süper adminin proje rolü değiştirilemez");
    const membership = await getMembership(ctx, args.userId, args.projectId);
    if (!membership) throw new Error("Kullanıcı bu projenin üyesi değil");

    const before = membershipRole(target, membership);
    if (before === args.role) return null;
    if (before === "admin" && !(await hasOtherActiveAdmin(ctx, args.projectId, args.userId))) {
      throw new Error("Projenin son yöneticisinin rolü değiştirilemez");
    }

    // Platform account role is independent of project roles.
    await ctx.db.patch(membership._id, { role: args.role });
    await writeAudit(ctx, {
      user: ctx.user,
      projectId: args.projectId,
      action: "update",
      targetTable: "userProjects",
      targetId: membership._id,
      oldValue: { role: before },
      newValue: { role: args.role },
    });
    return null;
  },
});

/** Action'lar için yetki kontrolü (ctx.db yok). Çağıran action false'ta kendisi throw eder. */
export const checkPermission = internalQuery({
  args: {
    userId: v.id("users"),
    projectId: v.optional(v.id("projects")),
    permission: permissionValidator,
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return false;
    return await hasPermission(ctx, user, args.projectId, args.permission);
  },
});

/** Bir kez: rolü boş üyeliklere eski global rolden türetilen rolü yazar. Tekrar çalıştırmak güvenli. */
export const backfillMemberRoles = internalMutation({
  args: {},
  returns: v.object({ updated: v.number(), remaining: v.boolean() }),
  handler: async (ctx) => {
    let updated = 0;
    for await (const membership of ctx.db.query("userProjects")) {
      if (membership.role !== undefined) continue;
      if (updated >= 2000) return { updated, remaining: true };
      const user = await ctx.db.get(membership.userId);
      await ctx.db.patch(membership._id, { role: legacyRoleToProjectRole(user?.role) });
      updated++;
    }
    return { updated, remaining: false };
  },
});
