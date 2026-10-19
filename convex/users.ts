import { paginationOptsValidator } from "convex/server";
import { stream } from "convex-helpers/server/stream";
import schema from "./schema";
import { adminPaginationOptions, adminSearch, adminUserRow } from "./lib/adminLists";
import { profileName } from "./lib/settingsUx";
import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";
import { optionalAuthQuery, authedMutation, adminQuery, superAdminQuery, superAdminMutation } from "./lib/customFunctions";
import { getProjectIdsForUser, verifyUser } from "./lib/auth";
import { membershipChanged, userProtectionError } from "./lib/adminGuards";
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

export const getProfile = adminQuery({
  args: { userId: v.id("users") },
  returns: v.union(publicUserValidator, v.null()),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return null;
    if (ctx.user.role !== "super_admin") {
      const projectIds = await getProjectIdsForUser(ctx);
      if (projectIds.length === 0) return null;
      const memberships = await ctx.db.query("userProjects")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect();
      if (!memberships.some((membership) => projectIds.includes(membership.projectId))) return null;
    }
    return toPublicUser(user);
  },
});

export const isSuperAdmin = optionalAuthQuery({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => {
    if (!ctx.user) return false;
    return ctx.user.role === "super_admin";
  },
});

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
    const admins = removesSuperAdmin ? await ctx.db.query("users")
      .withIndex("by_role", (q) => q.eq("role", "super_admin"))
      .take(2) : [];
    const protectionError = userProtectionError({
      isSelf: args.userId === ctx.user._id, isSuperAdmin: target.role === "super_admin",
      removesSuperAdmin, adminCount: admins.length, deleting: false,
    });
    if (protectionError) throw new ConvexError(protectionError);
    const memberships = args.projectIds !== undefined || args.expectedProjectIds !== undefined
      ? await ctx.db.query("userProjects").withIndex("by_user", q => q.eq("userId", args.userId)).collect()
      : [];
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
        if (!projectIds.includes(row.projectId)) await ctx.db.delete(row._id);
      }
      for (const projectId of projectIds) {
        if (!memberships.some(row => row.projectId === projectId)) await ctx.db.insert("userProjects", { userId: args.userId, projectId, createdAt: new Date().toISOString() });
      }
    }
    await ctx.db.patch(args.userId, {
      role: args.role,
      updatedAt: new Date().toISOString(),
    });
    return null;
  },
});

export const updatePhoto = authedMutation({
  args: {
    photoUrl: v.string(),
    photoStorageId: v.optional(v.id("_storage")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(ctx.user._id, {
      photoUrl: args.photoUrl,
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

export const list = adminQuery({
  args: {},
  returns: v.array(publicUserValidator),
  handler: async (ctx) => {
    if (ctx.user.role === "super_admin") {
      return (await ctx.db.query("users").collect()).map(toPublicUser);
    }
    const projectIds = await getProjectIdsForUser(ctx);
    if (projectIds.length === 0) return [];
    const rows = await Promise.all(
      projectIds.map((pid) =>
        ctx.db
          .query("userProjects")
          .withIndex("by_project", (q) => q.eq("projectId", pid))
          .collect()
      )
    );
    const uniqueIds = [...new Set(rows.flat().map((r) => r.userId))];
    const users = await Promise.all(uniqueIds.map((id) => ctx.db.get(id)));
    return users.filter((u): u is NonNullable<typeof u> => u !== null).map(toPublicUser);
  },
});

export const setupUser = superAdminMutation({
  args: {
    userId: v.id("users"),
    role: v.union(
      v.literal("super_admin"),
      v.literal("project_admin"),
      v.literal("project_user")
    ),
    fullName: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      role: args.role,
      fullName: args.fullName,
      updatedAt: new Date().toISOString(),
    });
    return null;
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
    const userId = await getAuthUserId(ctx);
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
    const admins = target.role === "super_admin" ? await ctx.db.query("users")
      .withIndex("by_role", (q) => q.eq("role", "super_admin"))
      .take(2) : [];
    const protectionError = userProtectionError({
      isSelf: args.userId === ctx.user._id, isSuperAdmin: target.role === "super_admin",
      removesSuperAdmin: true, adminCount: admins.length, deleting: true,
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
    await Promise.all(userProjects.map((up) => ctx.db.delete(up._id)));

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
    await ctx.db.patch(u._id, {
      role: args.role,
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
export const adminList = superAdminQuery({
  args: {
    search: v.optional(v.string()),
    role: v.optional(v.union(v.literal("super_admin"), v.literal("project_admin"), v.literal("project_user"))),
    project: v.optional(v.union(v.id("projects"), v.literal("none"))),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const pagination = adminPaginationOptions(args.paginationOpts);
    const projectCache = new Map<Id<"projects">, Promise<Doc<"projects"> | null>>();
    const membershipCache = new Map<Id<"users">, Promise<{ _id: Id<"projects">; name: string; isActive: boolean }[]>>();
    const memberships = (userId: Id<"users">) => {
      const cached = membershipCache.get(userId);
      if (cached) return cached;
      const loading = (async () => {
        const rows = await ctx.db.query("userProjects").withIndex("by_user", q => q.eq("userId", userId)).collect();
        const projects = await Promise.all([...new Set(rows.map(row => row.projectId))].map(id => {
          let project = projectCache.get(id);
          if (!project) { project = ctx.db.get(id); projectCache.set(id, project); }
          return project;
        }));
        return projects.filter((p): p is NonNullable<typeof p> => p !== null)
          .map(p => ({ _id: p._id, name: p.name, isActive: p.isActive === true }));
      })();
      membershipCache.set(userId, loading);
      return loading;
    };
    let totalScanned = 0;
    const result = await stream(ctx.db, schema).query("users").order("desc").filterWith(async user => {
      totalScanned++;
      if (args.role && user.role !== args.role) return false;
      if (!adminSearch(args.search, user.fullName, user.name, user.email)) return false;
      if (!args.project) return true;
      const projects = await memberships(user._id);
      return args.project === "none" ? projects.length === 0 : projects.some(p => p._id === args.project);
    }).paginate(pagination);
    return {
      ...result, page: await Promise.all(result.page.map(async user => adminUserRow(user, ctx.user._id, await memberships(user._id)))),
      filterScope: "server" as const, totalScanned,
    };
  },
});
