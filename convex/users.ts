import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";
import { optionalAuthQuery, authedMutation, adminQuery, superAdminMutation } from "./lib/customFunctions";
import { getProjectIdsForUser } from "./lib/auth";

/** Kurulum sayfası için: Sistemde super_admin var mı? (Public - auth gerekmez) */
export const hasSuperAdmin = query({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => {
    const admin = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("role"), "super_admin"))
      .first();
    return !!admin;
  },
});

export const currentUser = optionalAuthQuery({
  args: {},
  handler: async (ctx) => {
    if (!ctx.user) return null;
    return ctx.user;
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
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
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
    role: v.union(
      v.literal("super_admin"),
      v.literal("project_admin"),
      v.literal("project_user")
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
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
    if (args.fullName !== undefined) updates.fullName = args.fullName;
    if (args.photoUrl !== undefined) updates.photoUrl = args.photoUrl;
    await ctx.db.patch(ctx.user._id, updates);
    return null;
  },
});

export const list = adminQuery({
  args: {},
  handler: async (ctx) => {
    if (ctx.user.role === "super_admin") {
      return await ctx.db.query("users").collect();
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
    return users.filter((u): u is NonNullable<typeof u> => u !== null);
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
      verified: true,
      updatedAt: new Date().toISOString(),
    });
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
