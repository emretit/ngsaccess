import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { authedMutation, authedQuery } from "./lib/customFunctions";
import { requirePermission } from "./lib/permissions";
import { writeAudit } from "./lib/audit";
import { requiresNewPassword, type ProjectSmtpConfig } from "./lib/smtpConfig";

// Proje SMTP hesabı (Ayarlar › E-posta gönderimi). Şifre `smtpPassword` alanında AES-GCM şifreli
// (`v1.<iv>.<data>`, bkz. lib/mailSecret.ts) durur ve istemciye hiçbir yoldan dönmez.
// Kaydetme ve test gönderimi şifreleme/SMTP gerektirdiği için actions/projectMail.ts'te.

async function settingsRow(ctx: QueryCtx, projectId: Id<"projects">) {
  return await ctx.db.query("mailSettings").withIndex("by_project", q => q.eq("projectId", projectId)).first();
}

function toSendConfig(row: Doc<"mailSettings"> | null): ProjectSmtpConfig | null {
  if (!row?.smtpHost || !row.smtpPort || !row.smtpUsername || !row.smtpPassword || !row.fromEmail) return null;
  return {
    host: row.smtpHost, port: row.smtpPort, secure: row.smtpSecure ?? row.smtpPort === 465, username: row.smtpUsername,
    passwordEnc: row.smtpPassword, fromEmail: row.fromEmail, fromName: row.fromName ?? "", isActive: row.isActive ?? false,
  };
}

async function requireCaller(ctx: QueryCtx, callerId: Id<"users">, projectId: Id<"projects">) {
  const user = await ctx.db.get(callerId);
  if (!user) throw new ConvexError("Giriş yapmanız gerekiyor");
  await requirePermission(ctx, user, projectId, "admin.manage");
  return user;
}

export const get = authedQuery({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, ctx.user, args.projectId, "admin.manage");
    const row = await settingsRow(ctx, args.projectId);
    if (!row) return null;
    return {
      host: row.smtpHost ?? "", port: row.smtpPort ?? 465, username: row.smtpUsername ?? "",
      fromEmail: row.fromEmail ?? "", fromName: row.fromName ?? "", isActive: row.isActive ?? false,
      hasPassword: Boolean(row.smtpPassword), updatedAt: row.updatedAt ?? null,
    };
  },
});

export const remove = authedMutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, ctx.user, args.projectId, "admin.manage");
    const row = await settingsRow(ctx, args.projectId);
    if (!row) return null;
    await ctx.db.delete(row._id);
    await writeAudit(ctx, {
      user: ctx.user, projectId: args.projectId, action: "delete", targetTable: "mailSettings", targetId: row._id,
      oldValue: { smtpHost: row.smtpHost, smtpUsername: row.smtpUsername, fromEmail: row.fromEmail },
    });
    return null;
  },
});

/** projectMail.save çağırır; girdi orada normalize edilip şifre şifrelenmiş olarak gelir. */
export const upsertForCaller = internalMutation({
  args: {
    callerId: v.id("users"),
    projectId: v.id("projects"),
    host: v.string(),
    port: v.number(),
    secure: v.boolean(),
    username: v.string(),
    fromEmail: v.string(),
    fromName: v.string(),
    isActive: v.boolean(),
    passwordEnc: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireCaller(ctx, args.callerId, args.projectId);
    const existing = await settingsRow(ctx, args.projectId);
    if (!args.passwordEnc && requiresNewPassword(existing, args)) {
      throw new ConvexError(existing?.smtpPassword ? "Sunucu veya kullanıcı adı değişti; şifreyi yeniden girin." : "SMTP şifresini girin.");
    }
    const now = new Date().toISOString();
    const values = {
      smtpHost: args.host, smtpPort: args.port, smtpSecure: args.secure, smtpUsername: args.username,
      fromEmail: args.fromEmail, fromName: args.fromName, isActive: args.isActive, updatedAt: now,
      ...(args.passwordEnc ? { smtpPassword: args.passwordEnc } : {}),
    };
    const audit = { smtpHost: args.host, smtpPort: args.port, smtpUsername: args.username, fromEmail: args.fromEmail, isActive: args.isActive, passwordChanged: Boolean(args.passwordEnc) };
    if (existing) {
      await ctx.db.patch(existing._id, values);
      await writeAudit(ctx, {
        user, projectId: args.projectId, action: "update", targetTable: "mailSettings", targetId: existing._id,
        oldValue: { smtpHost: existing.smtpHost, smtpPort: existing.smtpPort, smtpUsername: existing.smtpUsername, fromEmail: existing.fromEmail, isActive: existing.isActive },
        newValue: audit,
      });
      return null;
    }
    const id = await ctx.db.insert("mailSettings", { ...values, projectId: args.projectId, createdAt: now });
    await writeAudit(ctx, { user, projectId: args.projectId, action: "create", targetTable: "mailSettings", targetId: id, newValue: audit });
    return null;
  },
});

/** Test gönderimi: hesap pasif olsa da döner (hesabı açmadan önce denemek için). */
export const getForCaller = internalQuery({
  args: { callerId: v.id("users"), projectId: v.id("projects") },
  handler: async (ctx, args): Promise<ProjectSmtpConfig | null> => {
    await requireCaller(ctx, args.callerId, args.projectId);
    return toSendConfig(await settingsRow(ctx, args.projectId));
  },
});

/** Zamanlanmış gönderimler: yalnız aktif ve eksiksiz hesap; yoksa çağıran varsayılan sağlayıcıya düşer. */
export const getForDelivery = internalQuery({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args): Promise<ProjectSmtpConfig | null> => {
    const config = toSendConfig(await settingsRow(ctx, args.projectId));
    return config?.isActive ? config : null;
  },
});
