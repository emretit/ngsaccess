import { ConvexError, v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internalMutation, mutation, query } from "./_generated/server";
import { superAdminMutation, superAdminQuery } from "./lib/customFunctions";
import { limiter } from "./lib/rateLimit";
import { verifyUser } from "./lib/auth";

/**
 * Yetkili kullanıcı (super_admin / proje sahibi / proje admin) bir kullanıcıyı
 * projeye davet eder. Token yalnız e-posta action'ında kalır, istemciye dönmez.
 *
 * type === "reset" → mevcut kullanıcıya şifre sıfırlama maili (henüz Convex
 * Auth password reset entegrasyonu yok; bu field gelecek PR için hazırlık).
 */
export const create = internalMutation({
  args: {
    callerId: v.id("users"),
    email: v.string(),
    projectId: v.id("projects"),
    role: v.union(v.literal("project_admin"), v.literal("project_user")),
    type: v.optional(v.union(v.literal("invite"), v.literal("reset"))),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    const caller = await ctx.db.get(args.callerId);
    if (!caller || caller.verified === false) {
      throw new Error("Giriş yapmanız gerekiyor");
    }
    // Yetki: super_admin veya projenin owner'ı veya o projeye admin olarak atanmış
    const project = await ctx.db.get(args.projectId);
    if (!project) throw new Error("Proje bulunamadı");

    const isSuperAdmin = caller.role === "super_admin";
    const isOwner = project.ownerId === caller._id;
    let isProjectAdmin = false;
    if (!isSuperAdmin && !isOwner && caller.role === "project_admin") {
      const membership = await ctx.db
        .query("userProjects")
        .withIndex("by_user", (q) => q.eq("userId", caller._id))
        .filter((q) => q.eq(q.field("projectId"), args.projectId))
        .first();
      isProjectAdmin = membership !== null;
    }
    if (!isSuperAdmin && !isOwner && !isProjectAdmin) {
      throw new Error("Bu projeye davet gönderme yetkin yok");
    }

    await limiter.limit(ctx, "inviteCreate", {
      key: args.callerId,
      throws: true,
    });

    // Aynı email için kullanılmamış TÜM davetleri iptal et (kayıtlar küçük harfle tutulur)
    const email = args.email.toLowerCase();
    for await (const existing of ctx.db.query("invites").withIndex("by_email", (q) => q.eq("email", email))) {
      if (existing.used !== true) await ctx.db.patch(existing._id, { used: true });
    }

    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 gün

    await ctx.db.insert("invites", {
      email: args.email.toLowerCase(),
      token,
      projectId: args.projectId,
      role: args.role,
      type: args.type ?? "invite",
      createdBy: args.callerId,
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
      type: v.union(v.literal("invite"), v.literal("reset")),
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
      type: invite.type ?? "invite",
      expiresAt: invite.expiresAt,
    };
  },
});

/**
 * Daveti yalnız oturumu davet e-postasıyla eşleşen hesap tüketebilir.
 * Doğrulanmamış yeni hesaba bu dar yolda izin verilir; genel auth guard değişmez.
 * Mevcut hesapların global rolü korunur, yalnız proje üyeliği eklenir.
 */
export const consume = mutation({
  args: {
    token: v.string(),
    email: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError({ code: "INVITE_AUTH_REQUIRED" });
    const user = await ctx.db.get(userId);
    if (!user) throw new ConvexError({ code: "INVITE_AUTH_REQUIRED" });

    const invite = await ctx.db
      .query("invites")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!invite || invite.used || !(Date.parse(invite.expiresAt) > Date.now())) {
      throw new ConvexError({ code: "INVITE_INVALID" });
    }

    if (invite.type === "reset") {
      throw new ConvexError({ code: "INVITE_WRONG_TYPE" });
    }

    // args.email eski web sözleşmesi için kalır; kimlik kaynağı değildir.
    if (user.email?.toLowerCase() !== invite.email.toLowerCase() ||
        args.email.toLowerCase() !== invite.email.toLowerCase()) {
      throw new ConvexError({ code: "INVITE_EMAIL_MISMATCH" });
    }

    const firstMembership = await ctx.db
      .query("userProjects")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();
    // auth.ts signUp profili verified=false ve role=undefined üretir.
    // Önceden rol atanmış veya üyeliği olan hesap asla yeni kurulum sayılmaz.
    const isNewSetupAccount = user.verified === false &&
      user.role === undefined && firstMembership === null;
    if (isNewSetupAccount) {
      await ctx.db.patch(user._id, {
        role: invite.role,
        updatedAt: new Date().toISOString(),
      });
    }
    await verifyUser(ctx, user._id);

    // Projeye ekle (duplicate kontrolü)
    let existingAssignment = false;
    for await (const membership of ctx.db
      .query("userProjects")
      .withIndex("by_user", (q) => q.eq("userId", user._id))) {
      if (membership.projectId === invite.projectId) {
        existingAssignment = true;
        break;
      }
    }

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
/** Süresi dolmuş (ve henüz kullanılmamış) davetleri listeler. */
export const listExpired = superAdminQuery({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("invites"),
      email: v.string(),
      projectId: v.id("projects"),
      role: v.union(v.literal("project_admin"), v.literal("project_user")),
      expiresAt: v.string(),
    })
  ),
  handler: async (ctx) => {
    const now = new Date().toISOString();
    const rows = await ctx.db
      .query("invites")
      .filter((q) =>
        q.and(
          q.neq(q.field("used"), true),
          q.lt(q.field("expiresAt"), now),
        )
      )
      .order("desc")
      .take(50);
    return rows.map((r) => ({
      _id: r._id,
      email: r.email,
      projectId: r.projectId,
      role: r.role,
      expiresAt: r.expiresAt,
    }));
  },
});

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

/**
 * Dev/admin: belirli bir email için davet kayıtlarını listeler.
 */
export const adminListByEmail = internalMutation({
  args: { email: v.string() },
  returns: v.array(v.object({
    _id: v.id("invites"),
    email: v.string(),
    projectId: v.id("projects"),
    role: v.union(v.literal("project_admin"), v.literal("project_user")),
    type: v.union(v.literal("invite"), v.literal("reset")),
    expiresAt: v.string(),
    used: v.boolean(),
    token: v.string(),
  })),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("invites")
      .withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase()))
      .collect();
    return rows.map((r) => ({
      _id: r._id,
      email: r.email,
      projectId: r.projectId,
      role: r.role,
      type: r.type ?? "invite",
      expiresAt: r.expiresAt,
      used: r.used ?? false,
      token: r.token,
    }));
  },
});

/**
 * Dev/admin: belirli bir email için tüm davet kayıtlarını siler.
 * Sadece `npx convex run` ile çağrılabilir (internal).
 */
export const adminDeleteByEmail = internalMutation({
  args: { email: v.string() },
  returns: v.number(),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("invites")
      .withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase()))
      .collect();
    for (const r of rows) {
      await ctx.db.delete(r._id);
    }
    return rows.length;
  },
});
