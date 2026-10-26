import { getPasswordError } from "./lib/passwordPolicy";
import { ConvexError, v } from "convex/values";
import { invalidateSessions, modifyAccountCredentials } from "@convex-dev/auth/server";
import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { superAdminQuery } from "./lib/customFunctions";
import { limiter } from "./lib/rateLimit";
import { getValidAuthUserId, verifyUser } from "./lib/auth";
import { hasPermission } from "./lib/permissions";
import { writeAudit } from "./lib/audit";
import { accessBlockReason } from "./lib/accountAccess";
import { inviteRoleValidator, legacyRoleToProjectRole, projectRoleValidator } from "./lib/roleCatalog";

/** Kullanılmamış ve süresi dolmamış davet. */
async function getOpenInvite(ctx: QueryCtx | MutationCtx, token: string) {
  const invite = await ctx.db
    .query("invites")
    .withIndex("by_token", (q) => q.eq("token", token))
    .first();
  if (!invite || invite.used || !(Date.parse(invite.expiresAt) > Date.now())) {
    throw new ConvexError({ code: "INVITE_INVALID" });
  }
  return invite;
}

async function getOpenSetupInvite(ctx: QueryCtx | MutationCtx, token: string) {
  const invite = await getOpenInvite(ctx, token);
  if (invite.type === "reset") throw new ConvexError({ code: "INVITE_WRONG_TYPE" });
  return invite;
}

/** Reset yalnız aynı projenin mevcut, doğrulanmış password hesabına uygulanabilir. */
async function getResetAccount(ctx: QueryCtx | MutationCtx, email: string, projectId: Id<"projects">, creating = false) {
  const resetUnavailable = () => new ConvexError({ code: "INVITE_RESET_UNAVAILABLE", message: "Bu kullanıcıya şifre sıfırlama bağlantısı gönderilemiyor." });
  const account = await ctx.db.query("authAccounts")
    .withIndex("providerAndAccountId", (q) => q.eq("provider", "password").eq("providerAccountId", email))
    .unique();
  const user = account ? await ctx.db.get(account.userId) : null;
  if (!user || user.verified === false || user.role === "super_admin" || user.email?.toLowerCase() !== email) {
    if (creating) throw resetUnavailable();
    throw new ConvexError({ code: "INVITE_ACCOUNT_EXISTS", message: "Bu hesap için şifre sıfırlanamıyor. Yöneticinizle iletişime geçin." });
  }
  let isMember = false;
  for await (const membership of ctx.db.query("userProjects").withIndex("by_user", (q) => q.eq("userId", user._id))) {
    if (membership.projectId === projectId) { isMember = true; break; }
  }
  if (!isMember) {
    if (creating) throw resetUnavailable();
    throw new ConvexError({ code: "INVITE_EMAIL_MISMATCH", message: "Bu hesap davetin projesine ait değil. Yöneticinizden yeni bağlantı isteyin." });
  }
  return user;
}

/**
 * auth.ts signUp profili verified=false ve role=undefined üretir. Önceden rol atanmış
 * veya projeye üyeliği olan hesap asla yeni kurulum hesabı sayılmaz.
 */
async function isFreshSetupAccount(ctx: QueryCtx | MutationCtx, user: Doc<"users">) {
  if (user.verified !== false || user.role !== undefined) return false;
  const membership = await ctx.db
    .query("userProjects")
    .withIndex("by_user", (q) => q.eq("userId", user._id))
    .first();
  return membership === null;
}

/**
 * Yetkili kullanıcı (super_admin / projede `admin.manage` yetkisi olan) bir kullanıcıyı
 * projeye davet eder. Token yalnız e-posta action'ında kalır, istemciye dönmez.
 * Rol proje rolü olarak saklanır; eski project_admin/project_user girdisi dönüştürülür.
 *
 * type === "reset" → yalnız projedeki mevcut password hesabına sıfırlama bağlantısı.
 */
export const create = internalMutation({
  args: {
    callerId: v.id("users"),
    email: v.string(),
    projectId: v.id("projects"),
    role: inviteRoleValidator,
    type: v.optional(v.union(v.literal("invite"), v.literal("reset"))),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    const caller = await ctx.db.get(args.callerId);
    if (!caller || caller.verified === false) {
      throw new Error("Giriş yapmanız gerekiyor");
    }
    // Yetki: super_admin veya projede admin.manage (yalnız Yönetici rolünde; sahiplik tek başına yetmez)
    const project = await ctx.db.get(args.projectId);
    if (!project) throw new Error("Proje bulunamadı");

    if (!(await hasPermission(ctx, caller, args.projectId, "admin.manage"))) {
      throw new Error("Bu projeye davet gönderme yetkin yok");
    }

    if (args.type === "reset") {
      await getResetAccount(ctx, args.email.toLowerCase(), args.projectId, true);
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
      role: legacyRoleToProjectRole(args.role),
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
      role: projectRoleValidator,
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

    if (!invite || invite.used || !(Date.parse(invite.expiresAt) > Date.now())) {
      return null;
    }

    return {
      email: invite.email,
      projectId: invite.projectId,
      role: legacyRoleToProjectRole(invite.role),
      type: invite.type ?? "invite",
      expiresAt: invite.expiresAt,
    };
  },
});

/** Davet token'ı, yalnız davet e-postasına ait temiz bir sign-up hesabını devralabilir. */
export const setupAccountState = internalQuery({
  args: { token: v.string() },
  returns: v.union(
    v.object({ state: v.literal("none"), email: v.string() }),
    v.object({ state: v.literal("claimable"), email: v.string(), userId: v.id("users") }),
    v.object({ state: v.literal("taken") }),
  ),
  handler: async (ctx, args) => {
    const invite = await getOpenSetupInvite(ctx, args.token);

    const account = await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) =>
        q.eq("provider", "password").eq("providerAccountId", invite.email),
      )
      .first();
    if (!account) return { state: "none" as const, email: invite.email };
    const user = await ctx.db.get(account.userId);
    if (user && (await isFreshSetupAccount(ctx, user))) {
      return { state: "claimable" as const, email: invite.email, userId: user._id };
    }
    return { state: "taken" as const };
  },
});

/** Yeniden kontrol ve güvenli profil temizliği; hesabı silmez veya doğrulamaz. */
export const resetClaimedAccount = internalMutation({
  args: { userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || !(await isFreshSetupAccount(ctx, user))) {
      throw new ConvexError({ code: "INVITE_ACCOUNT_EXISTS" });
    }
    await ctx.db.patch(user._id, {
      firstCompanyName: undefined,
      name: undefined,
      setupToken: undefined,
      tokenExpiresAt: undefined,
      updatedAt: new Date().toISOString(),
    });
    return null;
  },
});

export const claimSetupAccount = action({
  args: { token: v.string(), password: v.string() },
  returns: v.object({ flow: v.union(v.literal("signUp"), v.literal("signIn")) }),
  handler: async (ctx, args): Promise<{ flow: "signUp" | "signIn" }> => {
    const state:
      | { state: "none"; email: string }
      | { state: "claimable"; email: string; userId: Id<"users"> }
      | { state: "taken" } = await ctx.runQuery(internal.invites.setupAccountState, { token: args.token });
    const passwordError = getPasswordError(args.password);
    if (passwordError) {
      throw new ConvexError({ code: "INVITE_WEAK_PASSWORD", message: passwordError });
    }
    if (state.state === "none") return { flow: "signUp" };
    if (state.state === "taken") throw new ConvexError({ code: "INVITE_ACCOUNT_EXISTS" });
    // Recheck/cleanup commits before changing credentials. This avoids changing a password
    // if the account became privileged after setupAccountState; cleanup clears stale signup data.
    await ctx.runMutation(internal.invites.resetClaimedAccount, { userId: state.userId });
    await modifyAccountCredentials(ctx, {
      provider: "password",
      account: { id: state.email, secret: args.password },
    });
    await invalidateSessions(ctx, { userId: state.userId });
    return { flow: "signIn" };
  },
});

/**
 * Reset tokenı mevcut password hesabını kurtarır; normal daveti yalnız oturumu
 * davet e-postasıyla eşleşen hesap tüketebilir.
 * Doğrulanmamış yeni hesaba bu dar yolda izin verilir; genel auth guard değişmez.
 * Proje rolü üyeliğe yazılır; mevcut üyeliğin rolü değişmez. Mevcut hesapların users.role'ü korunur
 * (başka projede yükseltme olmasın); yeni kurulum hesabı platformda her zaman normal kalır.
 */
export const consume = mutation({
  args: {
    token: v.string(),
    email: v.string(),
    password: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const invite = await getOpenInvite(ctx, args.token);
    if (invite.type === "reset") {
      // Token is the recovery authority; caller-supplied email never selects an account.
      if (args.email.toLowerCase() !== invite.email) {
        throw new ConvexError({ code: "INVITE_EMAIL_MISMATCH" });
      }
      const user = await getResetAccount(ctx, invite.email, invite.projectId);
      const creator = await ctx.db.get(invite.createdBy);
      if (!creator || creator.verified === false || accessBlockReason(creator, Date.now()) !== null ||
          !(await hasPermission(ctx, creator, invite.projectId, "admin.manage"))) {
        throw new ConvexError({ code: "INVITE_INVALID" });
      }
      const passwordError = getPasswordError(args.password ?? "");
      if (passwordError || args.password === undefined) {
        throw new ConvexError({ code: "INVITE_WEAK_PASSWORD", message: passwordError ?? "Yeni şifrenizi girin." });
      }
      // Auth's modifyAccountCredentials/invalidateSessions helpers dispatch these same
      // store operations. Nested mutations keep hashing, revocation and token consumption
      // in one transaction, including rollback on failure and concurrent token use.
      await ctx.runMutation(internal.auth.store, { args: {
        type: "modifyAccount", provider: "password",
        account: { id: invite.email, secret: args.password },
      } });
      await ctx.runMutation(internal.auth.store, { args: {
        type: "invalidateSessions", userId: user._id,
      } });
      await ctx.db.patch(invite._id, { used: true });
      await writeAudit(ctx, {
        user: null, projectId: invite.projectId, action: "update", targetTable: "users",
        targetId: user._id, newValue: { passwordReset: true, inviteId: invite._id },
        note: "Davet bağlantısıyla şifre sıfırlandı; tüm oturumlar iptal edildi.",
      });
      return null;
    }

    const userId = await getValidAuthUserId(ctx);
    if (!userId) throw new ConvexError({ code: "INVITE_AUTH_REQUIRED" });
    const user = await ctx.db.get(userId);
    if (!user) throw new ConvexError({ code: "INVITE_AUTH_REQUIRED" });

    // args.email eski web sözleşmesi için kalır; kimlik kaynağı değildir.
    if (user.email?.toLowerCase() !== invite.email.toLowerCase() ||
        args.email.toLowerCase() !== invite.email.toLowerCase()) {
      throw new ConvexError({ code: "INVITE_EMAIL_MISMATCH" });
    }

    const projectRole = legacyRoleToProjectRole(invite.role);
    if (await isFreshSetupAccount(ctx, user)) {
      await ctx.db.patch(user._id, {
        role: "project_user",
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
        role: projectRole,
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
      role: inviteRoleValidator,
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

export const list = superAdminQuery({
  args: { projectId: v.optional(v.id("projects")) },
  returns: v.array(
    v.object({
      _id: v.id("invites"),
      email: v.string(),
      projectId: v.id("projects"),
      role: inviteRoleValidator,
      expiresAt: v.string(),
      used: v.optional(v.boolean()),
      createdAt: v.string(),
    })
  ),
  handler: async (ctx, args) => {
    // invites'ta projectId index'i yok: süzme sorguda (take'ten önce), sonuç 500 satırla sınırlı.
    const all = ctx.db.query("invites");
    const rows = await (args.projectId
      ? all.filter((q) => q.eq(q.field("projectId"), args.projectId))
      : all
    ).take(500);
    return rows.map(({ _id, email, projectId, role, expiresAt, used, createdAt }) => ({
      _id, email, projectId, role, expiresAt, used, createdAt,
    }));
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
    role: inviteRoleValidator,
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
