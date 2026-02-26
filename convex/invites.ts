import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { superAdminMutation } from "./lib/customFunctions";

/**
 * super_admin bir kullanıcıyı projeye davet eder.
 * Dönen token ile /user-setup?token=xxx linki oluşturulur.
 */
export const create = superAdminMutation({
  args: {
    email: v.string(),
    projectId: v.id("projects"),
    role: v.union(v.literal("project_admin"), v.literal("project_user")),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    // Aynı email için kullanılmamış davet varsa önce onu iptal et
    const existing = await ctx.db
      .query("invites")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .filter((q) => q.eq(q.field("used"), false))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { used: true });
    }

    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 gün

    await ctx.db.insert("invites", {
      email: args.email.toLowerCase(),
      token,
      projectId: args.projectId,
      role: args.role,
      createdBy: ctx.user._id,
      expiresAt,
      used: false,
      createdAt: new Date().toISOString(),
    });

    return token;
  },
});

/**
 * Token ile davet bilgisini döner (public - kayıt sayfasında email pre-fill için).
 */
export const verify = query({
  args: { token: v.string() },
  returns: v.union(
    v.object({
      email: v.string(),
      projectId: v.id("projects"),
      role: v.union(v.literal("project_admin"), v.literal("project_user")),
      expiresAt: v.string(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const invite = await ctx.db
      .query("invites")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!invite || invite.used || new Date(invite.expiresAt) < new Date()) {
      return null;
    }

    return {
      email: invite.email,
      projectId: invite.projectId,
      role: invite.role,
      expiresAt: invite.expiresAt,
    };
  },
});

/**
 * Kayıt sonrası daveti kullan: kullanıcıya rol + proje ata.
 * Email + token çifti doğrulandıktan sonra çalışır.
 * Yeni kullanıcı signUp yaptıktan hemen sonra çağrılır.
 */
export const consume = mutation({
  args: {
    token: v.string(),
    email: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const invite = await ctx.db
      .query("invites")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!invite || invite.used || new Date(invite.expiresAt) < new Date()) {
      throw new Error("Davet geçersiz veya süresi dolmuş");
    }

    if (invite.email !== args.email.toLowerCase()) {
      throw new Error("E-posta adresi davete uymuyor");
    }

    // Kullanıcıyı email ile bul
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", args.email.toLowerCase()))
      .first();

    if (!user) {
      throw new Error("Kullanıcı bulunamadı — önce kayıt olun");
    }

    // Rol ata
    await ctx.db.patch(user._id, {
      role: invite.role,
      updatedAt: new Date().toISOString(),
    });

    // Projeye ekle (duplicate kontrolü)
    const existingAssignment = await ctx.db
      .query("userProjects")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .filter((q) => q.eq(q.field("projectId"), invite.projectId))
      .first();

    if (!existingAssignment) {
      await ctx.db.insert("userProjects", {
        userId: user._id,
        projectId: invite.projectId,
        createdAt: new Date().toISOString(),
      });
    }

    // Daveti kullanıldı olarak işaretle
    await ctx.db.patch(invite._id, { used: true });

    return null;
  },
});

/**
 * super_admin tüm davetleri listeler.
 */
export const list = superAdminMutation({
  args: { projectId: v.optional(v.id("projects")) },
  returns: v.array(
    v.object({
      _id: v.id("invites"),
      email: v.string(),
      projectId: v.id("projects"),
      role: v.union(v.literal("project_admin"), v.literal("project_user")),
      expiresAt: v.string(),
      used: v.optional(v.boolean()),
      createdAt: v.string(),
    })
  ),
  handler: async (ctx, args) => {
    if (args.projectId) {
      return await ctx.db
        .query("invites")
        .filter((q) => q.eq(q.field("projectId"), args.projectId))
        .collect();
    }
    return await ctx.db.query("invites").collect();
  },
});
