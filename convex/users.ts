import { hasOtherActiveAdmin, getProjectIdsWithPermission, membershipRole, requirePermission } from "./lib/permissions";
import { projectRoleValidator, legacyRoleToProjectRole, type ProjectRole } from "./lib/roleCatalog";
import { paginationOptsValidator } from "convex/server";
import { stream } from "convex-helpers/server/stream";
import schema from "./schema";
import { adminPaginationOptions, adminSearch, adminUserRow } from "./lib/adminLists";
import { profileName } from "./lib/settingsUx";
import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery, mutation, query, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { optionalAuthQuery, authedMutation, authedQuery, superAdminMutation } from "./lib/customFunctions";
import { getCurrentUser, getProjectIdsForUser, getValidAuthUserId, verifyUser } from "./lib/auth";
import { activeSuperAdminCount, membershipChanged, userProtectionError } from "./lib/adminGuards";
import { publicUserValidator, toPublicUser } from "./lib/publicUser";

/** Kurulum sayfası için: Sistemde super_admin var mı? (Public - auth gerekmez) */
export const hasSuperAdmin = query({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => {
    const admin = await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", "super_admin"))
      .first();
    return !!admin;
  },
});

export const currentUser = optionalAuthQuery({
  args: {},
  returns: v.union(publicUserValidator, v.null()),
  handler: async (ctx) => {
    if (!ctx.user) return null;
    return toPublicUser(ctx.user);
  },
});

export const requireCurrentUser = internalQuery({
  args: {},
  handler: async (ctx): Promise<Doc<"users">> => getCurrentUser(ctx),
});

/**
 * Action'lardan çağrılabilen internal query — caller'ın eriştiği proje ID'lerini döndürür.
 * Auth context ctx.runQuery üzerinden propagate olur (bkz. customFunctions.ts authedAction).
 */
export const listProjectIdsForCurrentUser = internalQuery({
  args: {},
  handler: async (ctx): Promise<Id<"projects">[]> => {
    return await getProjectIdsForUser(ctx);
  },
});

type LegacyUserRole = "super_admin" | "project_admin" | "project_user";

/**
 * Son müşteri yöneticisi koruması. super_admin üyeliği yönetici sayımına girmez
 * (hasOtherActiveAdmin), bu yüzden onu kaldırmak/düşürmek sayıyı azaltmaz; kontrol
 * ona uygulanırsa müşteri yöneticisi olmayan projede platform yöneticisi çıkarılamaz.
 */
async function removesLastProjectAdmin(ctx: MutationCtx, user: Doc<"users">, row: Doc<"userProjects">) {
  return user.role !== "super_admin" && membershipRole(user, row) === "admin" && !(await hasOtherActiveAdmin(ctx, row.projectId, user._id));
}

/**
 * super_admin'e geçişte rolsüz üyelikleri sabitler; super_admin'den düşüşte TÜM üyelikleri
 * (açıkça admin yazılmış olanlar dahil) yeni rolün proje karşılığına yazar.
 * Terfi kişiyi müşteri yöneticisi sayımından çıkarır: projenin son müşteri yöneticisiyse reddedilir
 * (yoksa terfi → düşürme/silme zinciri son-yönetici korumasını aşar).
 */
async function syncMembershipRoles(ctx: MutationCtx, user: Doc<"users">, rows: Doc<"userProjects">[], nextRole: LegacyUserRole) {
  const demotes = user.role === "super_admin" && nextRole !== "super_admin";
  const promotes = user.role !== "super_admin" && nextRole === "super_admin";
  for (const row of rows) {
    if (promotes && await removesLastProjectAdmin(ctx, user, row)) {
      throw new ConvexError("Projenin son yöneticisi platform yöneticisi yapılamaz; önce başka bir yönetici atayın");
    }
    if (demotes) await ctx.db.patch(row._id, { role: legacyRoleToProjectRole(nextRole) });
    else if (nextRole === "super_admin" && row.role === undefined) await ctx.db.patch(row._id, { role: membershipRole(user, row) });
  }
}

export const updateRole = superAdminMutation({
  args: {
    userId: v.id("users"),
    projectIds: v.optional(v.array(v.id("projects"))),
    expectedProjectIds: v.optional(v.array(v.id("projects"))),
    role: v.union(
      v.literal("super_admin"),
      v.literal("project_admin"),
      v.literal("project_user")
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const target = await ctx.db.get(args.userId);
    if (!target) throw new ConvexError("Kullanıcı bulunamadı");
    const removesSuperAdmin = target.role === "super_admin" && args.role !== "super_admin";
    const adminCount = removesSuperAdmin ? 1 + await activeSuperAdminCount(ctx, { excludeId: args.userId, requireNoExpiry: true }) : 0;
    const protectionError = userProtectionError({
      isSelf: args.userId === ctx.user._id, isSuperAdmin: target.role === "super_admin",
      removesSuperAdmin, adminCount, deleting: false,
    });
    if (protectionError) throw new ConvexError(protectionError);
    const memberships = await ctx.db.query("userProjects").withIndex("by_user", q => q.eq("userId", args.userId)).collect();
    if (membershipChanged(memberships.map(row => row.projectId), args.expectedProjectIds)) {
      throw new ConvexError({
        code: "MEMBERSHIP_CHANGED",
        message: "Kullanıcının proje üyelikleri başka bir oturumda değişti. Formu kapatıp yeniden açın.",
      });
    }
    if (args.projectIds !== undefined) {
      const projectIds = [...new Set(args.projectIds)];
      for (const projectId of projectIds) {
        if (!(await ctx.db.get(projectId))) throw new ConvexError("Proje bulunamadı");
      }
      for (const row of memberships) {
        if (!projectIds.includes(row.projectId)) {
          if (await removesLastProjectAdmin(ctx, target, row)) throw new ConvexError("Projenin son yöneticisi kaldırılamaz");
          await ctx.db.delete(row._id);
        }
      }
      for (const projectId of projectIds) {
        if (!memberships.some(row => row.projectId === projectId)) await ctx.db.insert("userProjects", { userId: args.userId, projectId, role: removesSuperAdmin ? legacyRoleToProjectRole(args.role) : "viewer", createdAt: new Date().toISOString() });
      }
    }
    const retained = memberships.filter(row => args.projectIds === undefined || args.projectIds.includes(row.projectId));
    await syncMembershipRoles(ctx, target, retained, args.role);
    await ctx.db.patch(args.userId, {
      ...(args.role === "super_admin" || target.role === "super_admin" ? { role: args.role } : {}),
      updatedAt: new Date().toISOString(),
    });
    return null;
  },
});

export const updateProfile = authedMutation({
  args: {
    fullName: v.optional(v.string()),
    photoUrl: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (args.fullName !== undefined) updates.fullName = profileName(args.fullName);
    if (args.photoUrl !== undefined) updates.photoUrl = args.photoUrl;
    await ctx.db.patch(ctx.user._id, updates);
    return null;
  },
});

export const list = authedQuery({
  args: { projectId: v.optional(v.id("projects")) },
  returns: v.array(v.object({ ...publicUserValidator.fields,
    role: v.optional(v.union(v.literal("super_admin"), projectRoleValidator)),
    projectId: v.optional(v.id("projects")),
  })),
  handler: async (ctx, args) => {
    if (ctx.user.role === "super_admin" && !args.projectId) {
      return (await ctx.db.query("users").collect()).map(user => ({ ...toPublicUser(user), role: user.role === "super_admin" ? "super_admin" as const : undefined }));
    }
    if (args.projectId) await requirePermission(ctx, ctx.user, args.projectId, "admin.manage");
    const projectIds = args.projectId ? [args.projectId] : await getProjectIdsWithPermission(ctx, ctx.user, "admin.manage");
    const result = [];
    for (const projectId of projectIds) {
      const rows = await ctx.db.query("userProjects").withIndex("by_project", q => q.eq("projectId", projectId)).collect();
      const seen = new Set<Id<"users">>();
      for (const row of rows) {
        if (seen.has(row.userId)) continue;
        seen.add(row.userId);
        const user = await ctx.db.get(row.userId);
        if (user) result.push({ ...toPublicUser(user), role: membershipRole(user, row), projectId });
      }
    }
    return result;
  },
});

/**
 * İlk super_admin kurulumu.
 * Hiç super_admin yokken ve doğru gizli kod girildiğinde çalışır.
 * Sadece bir kez kullanılabilir.
 */
// NOT: authedMutation DEĞİL ham mutation — ilk super_admin signUp anında
// verified=false ile oluşur (auth.ts profile artık her zaman false set eder),
// dolayısıyla getCurrentUser guard'ından geçemez (yumurta-tavuk). Bunun yerine
// auth burada manuel yapılır; güvenlik secret + "henüz admin yok" ile sağlanır.
export const initializeAdmin = mutation({
  args: { secret: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getValidAuthUserId(ctx);
    if (!userId) {
      throw new Error("Giriş yapmanız gerekiyor");
    }
    const expectedSecret = process.env.ADMIN_SETUP_SECRET;
    if (!expectedSecret || args.secret !== expectedSecret) {
      throw new Error("Geçersiz gizli kod");
    }
    const existingAdmin = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("role"), "super_admin"))
      .first();
    if (existingAdmin) {
      throw new Error("Süper admin zaten mevcut");
    }
    // Secret doğrulandı → güvenilir kanal → hesabı super_admin + verified yap.
    await ctx.db.patch(userId, {
      role: "super_admin",
      updatedAt: new Date().toISOString(),
    });
    await verifyUser(ctx, userId);
    return null;
  },
});

/**
 * super_admin UI'dan kullanıcı siler. users + authAccounts + authSessions +
 * userProjects kaldırır. super_admin kendi hesabını silemez.
 */
export const deleteUser = superAdminMutation({
  args: { userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const target = await ctx.db.get(args.userId);
    if (!target) throw new ConvexError("Kullanıcı bulunamadı");
    const adminCount = target.role === "super_admin" ? 1 + await activeSuperAdminCount(ctx, { excludeId: args.userId, requireNoExpiry: true }) : 0;
    const protectionError = userProtectionError({
      isSelf: args.userId === ctx.user._id, isSuperAdmin: target.role === "super_admin",
      removesSuperAdmin: true, adminCount, deleting: true,
    });
    if (protectionError) throw new ConvexError(protectionError);
    const accounts = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) => q.eq("userId", args.userId))
      .collect();
    await Promise.all(accounts.map((a) => ctx.db.delete(a._id)));

    const sessions = await ctx.db
      .query("authSessions")
      .withIndex("userId", (q) => q.eq("userId", args.userId))
      .collect();
    await Promise.all(sessions.map((s) => ctx.db.delete(s._id)));

    const userProjects = await ctx.db
      .query("userProjects")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    for (const row of userProjects) {
      if (await removesLastProjectAdmin(ctx, target, row)) throw new ConvexError("Projenin son yöneticisi kaldırılamaz");
      await ctx.db.delete(row._id);
    }

    await ctx.db.delete(args.userId);
    return null;
  },
});

/**
 * Dev/admin bootstrap: bir email'in rolünü ayarlar (örn. ilk super_admin).
 * Sadece `npx convex run` ile çağrılabilir (internal). Sistemde super_admin
 * varken normal rol değişimi UI'dan `users.updateRole` ile yapılır.
 */
export const setRoleByEmail = internalMutation({
  args: {
    email: v.string(),
    role: v.union(
      v.literal("super_admin"),
      v.literal("project_admin"),
      v.literal("project_user"),
    ),
  },
  returns: v.object({ updated: v.boolean(), email: v.string() }),
  handler: async (ctx, args) => {
    const u = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", args.email.toLowerCase()))
      .first();
    if (!u) return { updated: false, email: args.email };
    if (args.role === "super_admin" || u.role === "super_admin") {
      const memberships = await ctx.db.query("userProjects").withIndex("by_user", q => q.eq("userId", u._id)).collect();
      await syncMembershipRoles(ctx, u, memberships, args.role);
    }
    await ctx.db.patch(u._id, {
      ...(args.role === "super_admin" || u.role === "super_admin" ? { role: args.role } : {}),
      updatedAt: new Date().toISOString(),
    });
    return { updated: true, email: args.email };
  },
});

/**
 * Dev/admin: belirli bir email için users + authAccounts + authSessions kayıtlarını siler.
 * Sadece `npx convex run` ile çağrılabilir (internal).
 */
export const adminDeleteByEmail = internalMutation({
  args: { email: v.string() },
  returns: v.object({
    usersDeleted: v.number(),
    accountsDeleted: v.number(),
    sessionsDeleted: v.number(),
  }),
  handler: async (ctx, args) => {
    const lowered = args.email.toLowerCase();
    const userRows = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", lowered))
      .collect();
    let accountsDeleted = 0;
    let sessionsDeleted = 0;
    for (const user of userRows) {
      const accounts = await ctx.db
        .query("authAccounts")
        .withIndex("userIdAndProvider", (q) => q.eq("userId", user._id))
        .collect();
      for (const a of accounts) {
        await ctx.db.delete(a._id);
        accountsDeleted++;
      }
      const sessions = await ctx.db
        .query("authSessions")
        .withIndex("userId", (q) => q.eq("userId", user._id))
        .collect();
      for (const s of sessions) {
        await ctx.db.delete(s._id);
        sessionsDeleted++;
      }
      const userProjects = await ctx.db
        .query("userProjects")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect();
      for (const up of userProjects) {
        if (await removesLastProjectAdmin(ctx, user, up)) throw new ConvexError("Projenin son yöneticisi kaldırılamaz");
        await ctx.db.delete(up._id);
      }
      await ctx.db.delete(user._id);
    }
    return {
      usersDeleted: userRows.length,
      accountsDeleted,
      sessionsDeleted,
    };
  },
});

export const adminFindByEmail = internalQuery({
  args: { email: v.string() },
  returns: v.union(
    v.object({
      _id: v.id("users"),
      email: v.optional(v.string()),
      role: v.optional(v.union(
        v.literal("super_admin"),
        v.literal("project_admin"),
        v.literal("project_user"),
      )),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const u = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", args.email.toLowerCase()))
      .first();
    if (!u) return null;
    return { _id: u._id, email: u.email, role: u.role };
  },
});

/** Safe admin directory: filtering happens before cursor pagination. */
export const adminList = authedQuery({
  args: {
    search: v.optional(v.string()),
    role: v.optional(v.union(v.literal("super_admin"), projectRoleValidator)),
    project: v.optional(v.union(v.id("projects"), v.literal("none"))),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const pagination = adminPaginationOptions(args.paginationOpts);
    const allowedProjects = ctx.user.role === "super_admin" ? null : await getProjectIdsWithPermission(ctx, ctx.user, "admin.manage");
    if (allowedProjects !== null && args.project && (args.project === "none" || !allowedProjects.includes(args.project))) throw new ConvexError("Bu proje filtresi için yetkiniz yok.");
    const projectCache = new Map<Id<"projects">, Promise<Doc<"projects"> | null>>();
    const membershipCache = new Map<Id<"users">, Promise<{ _id: Id<"projects">; name: string; isActive: boolean; role: ProjectRole }[]>>();
    const memberships = (userId: Id<"users">) => {
      const cached = membershipCache.get(userId);
      if (cached) return cached;
      const loading = (async () => {
        const userRole = (await ctx.db.get(userId))?.role;
        const rows = await ctx.db.query("userProjects").withIndex("by_user", q => q.eq("userId", userId)).collect();
        const projects = await Promise.all([...new Set(rows.map(row => row.projectId))].map(id => {
          let project = projectCache.get(id);
          if (!project) { project = ctx.db.get(id); projectCache.set(id, project); }
          return project;
        }));
        return projects.filter((p): p is NonNullable<typeof p> => p !== null)
          .map(p => {
            const row = rows.find(row => row.projectId === p._id);
            return { _id: p._id, name: p.name, isActive: p.isActive === true,
              role: row?.role ?? legacyRoleToProjectRole(userRole) };
          });
      })();
      membershipCache.set(userId, loading);
      return loading;
    };
    let totalScanned = 0;
    const result = await stream(ctx.db, schema).query("users").order("desc").filterWith(async user => {
      totalScanned++;
      if (allowedProjects !== null) {
        const projects = await memberships(user._id);
        if (!projects.some(project => allowedProjects.includes(project._id))) return false;
      }
      if (args.role) {
        if (args.role === "super_admin") {
          if (allowedProjects !== null || user.role !== "super_admin") return false;
        } else {
          const projects = await memberships(user._id);
          if (!projects.some(project => project.role === args.role &&
            (allowedProjects === null || allowedProjects.includes(project._id)) &&
            (!args.project || project._id === args.project))) return false;
        }
      }
      if (!adminSearch(args.search, user.fullName, user.name, user.email)) return false;
      if (!args.project) return true;
      const projects = await memberships(user._id);
      return args.project === "none" ? projects.length === 0 : projects.some(p => p._id === args.project);
    }).paginate(pagination);
    return {
      ...result, page: await Promise.all(result.page.map(async user => {
        const projects = (await memberships(user._id)).filter(project => allowedProjects === null || allowedProjects.includes(project._id));
        const selected = projects.find(project => project._id === args.project) ?? projects.find(project => project.role === args.role) ?? projects[0];
        return { ...adminUserRow(user, ctx.user._id, projects), projects,
          role: user.role === "super_admin" && allowedProjects === null && !args.project ? "super_admin" as const : selected?.role ?? null };
      })),
      filterScope: "server" as const, totalScanned,
    };
  },
});
