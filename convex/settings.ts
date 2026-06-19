
import { v } from "convex/values";
import { authedQuery, authedMutation, optionalAuthQuery } from "./lib/customFunctions";
import { getProjectIdsForUser } from "./lib/auth";
import type { Id } from "./_generated/dataModel";

/**
 * Ayar sorguları için tenant-güvenli proje çözümü.
 * - projectId verilmezse kullanıcının ilk izinli projesine düşer.
 * - ASLA tablo geneli `.first()` ile başka tenant'ın kaydını döndürmez
 *   (çapraz-tenant sızıntısının kök nedeni buydu).
 * - İzin yoksa veya hiç proje yoksa null.
 */
function resolveSettingsProjectId(
  allowedProjectIds: Id<"projects">[],
  argProjectId: Id<"projects"> | undefined,
): Id<"projects"> | null {
  const projectId = argProjectId ?? allowedProjectIds[0];
  if (!projectId) return null;
  if (!allowedProjectIds.some((id) => id === projectId)) return null;
  return projectId;
}

// === General Settings ===
export const getGeneral = authedQuery({
  args: {
    projectId: v.optional(v.id("projects")),
  },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    const projectId = resolveSettingsProjectId(allowedProjectIds, args.projectId);
    if (!projectId) return null;
    return await ctx.db
      .query("generalSettings")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .first();
  },
});

export const upsertGeneral = authedMutation({
  args: {
    projectId: v.optional(v.id("projects")),
    companyName: v.string(),
    address: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    website: v.optional(v.string()),
    taxNumber: v.optional(v.string()),
    currency: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    darkMode: v.optional(v.boolean()),
    dateFormat: v.optional(v.string()),
    timezone: v.optional(v.string()),
    systemLanguage: v.optional(v.string()),
    workingDays: v.optional(v.array(v.string())),
    workingHoursStart: v.optional(v.string()),
    workingHoursEnd: v.optional(v.string()),
    notificationsEnabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    const projectId = resolveSettingsProjectId(allowedProjectIds, args.projectId);
    if (!projectId) throw new Error("Bu projeye erişim yetkiniz yok");
    const now = new Date().toISOString();
    const existing = await ctx.db
      .query("generalSettings")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { ...args, projectId, updatedAt: now });
      return existing._id;
    }
    return await ctx.db.insert("generalSettings", {
      ...args,
      projectId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// === Mail Settings ===
export const getMail = authedQuery({
  args: { projectId: v.optional(v.id("projects")) },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    const projectId = resolveSettingsProjectId(allowedProjectIds, args.projectId);
    if (!projectId) return null;
    return await ctx.db
      .query("mailSettings")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .first();
  },
});

export const upsertMail = authedMutation({
  args: {
    projectId: v.optional(v.id("projects")),
    smtpHost: v.optional(v.string()),
    smtpPort: v.optional(v.number()),
    smtpUsername: v.optional(v.string()),
    smtpPassword: v.optional(v.string()),
    smtpSecure: v.optional(v.boolean()),
    fromEmail: v.optional(v.string()),
    fromName: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    const projectId = resolveSettingsProjectId(allowedProjectIds, args.projectId);
    if (!projectId) throw new Error("Bu projeye erişim yetkiniz yok");
    const now = new Date().toISOString();
    const existing = await ctx.db
      .query("mailSettings")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { ...args, projectId, updatedAt: now });
      return existing._id;
    }
    return await ctx.db.insert("mailSettings", {
      ...args,
      projectId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// === Notification Settings ===
export const getNotification = authedQuery({
  args: { projectId: v.optional(v.id("projects")) },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    const projectId = resolveSettingsProjectId(allowedProjectIds, args.projectId);
    if (!projectId) return null;
    return await ctx.db
      .query("notificationSettings")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .first();
  },
});

export const upsertNotification = authedMutation({
  args: {
    projectId: v.optional(v.id("projects")),
    emailNotifications: v.optional(v.boolean()),
    systemNotifications: v.optional(v.boolean()),
    lateNotifications: v.optional(v.boolean()),
    reportNotifications: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    const projectId = resolveSettingsProjectId(allowedProjectIds, args.projectId);
    if (!projectId) throw new Error("Bu projeye erişim yetkiniz yok");
    const now = new Date().toISOString();
    const existing = await ctx.db
      .query("notificationSettings")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { ...args, projectId, updatedAt: now });
      return existing._id;
    }
    return await ctx.db.insert("notificationSettings", {
      ...args,
      projectId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// === Work Settings ===
export const getWork = authedQuery({
  args: { projectId: v.optional(v.id("projects")) },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    const projectId = resolveSettingsProjectId(allowedProjectIds, args.projectId);
    if (!projectId) return null;
    return await ctx.db
      .query("workSettings")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .first();
  },
});

export const upsertWork = authedMutation({
  args: {
    projectId: v.optional(v.id("projects")),
    workStartTime: v.optional(v.string()),
    workEndTime: v.optional(v.string()),
    lunchBreakStart: v.optional(v.string()),
    lunchBreakEnd: v.optional(v.string()),
    maxLateMinutes: v.optional(v.number()),
    earlyExitToleranceMinutes: v.optional(v.number()),
    allowLateEntry: v.optional(v.boolean()),
    annualOvertimeLimitHours: v.optional(v.number()),
    overtimeMultiplier: v.optional(v.number()),
    overtimeStartToleranceMinutes: v.optional(v.number()),
    monthlyHoursBase: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    const projectId = resolveSettingsProjectId(allowedProjectIds, args.projectId);
    if (!projectId) throw new Error("Bu projeye erişim yetkiniz yok");
    const now = new Date().toISOString();
    const existing = await ctx.db
      .query("workSettings")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { ...args, projectId, updatedAt: now });
      return existing._id;
    }
    return await ctx.db.insert("workSettings", { ...args, projectId, updatedAt: now });
  },
});

/** Giriş yoksa false döner (login sayfası vb. hata vermesin diye). */
export const getDarkMode = optionalAuthQuery({
  args: { projectId: v.optional(v.id("projects")) },
  handler: async (ctx, args) => {
    if (!ctx.user) return false;
    // Doğrulanmamış self-signup kullanıcısı (verified=false): henüz erişimi yok.
    // getProjectIdsForUser guard'ı Error fırlatır ve uygulamayı çökertir — burada
    // sessizce false dönüp AuthProvider'ın signOut'una izin ver.
    if (ctx.user.verified === false) return false;
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    const projectId = resolveSettingsProjectId(allowedProjectIds, args.projectId);
    if (!projectId) return false;
    const settings = await ctx.db
      .query("generalSettings")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .first();
    return settings?.darkMode ?? false;
  },
});
