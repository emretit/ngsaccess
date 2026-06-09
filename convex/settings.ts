
import { v } from "convex/values";
import { authedQuery, authedMutation, optionalAuthQuery } from "./lib/customFunctions";
import { getProjectIdsForUser } from "./lib/auth";

// === General Settings ===
export const getGeneral = authedQuery({
  args: {
    projectId: v.optional(v.id("projects")),
  },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    if (args.projectId && !allowedProjectIds.some((id) => id === args.projectId)) {
      return null;
    }
    if (!args.projectId) {
      return await ctx.db.query("generalSettings").first();
    }
    return await ctx.db
      .query("generalSettings")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
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
    if (args.projectId && !allowedProjectIds.some((id) => id === args.projectId)) {
      throw new Error("Bu projeye erişim yetkiniz yok");
    }
    const now = new Date().toISOString();
    const existing = args.projectId
      ? await ctx.db
          .query("generalSettings")
          .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
          .first()
      : await ctx.db.query("generalSettings").first();

    if (existing) {
      await ctx.db.patch(existing._id, { ...args, updatedAt: now });
      return existing._id;
    }
    return await ctx.db.insert("generalSettings", {
      ...args,
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
    if (args.projectId && !allowedProjectIds.some((id) => id === args.projectId)) {
      return null;
    }
    if (!args.projectId) return await ctx.db.query("mailSettings").first();
    return await ctx.db
      .query("mailSettings")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
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
    if (args.projectId && !allowedProjectIds.some((id) => id === args.projectId)) {
      throw new Error("Bu projeye erişim yetkiniz yok");
    }
    const now = new Date().toISOString();
    const existing = args.projectId
      ? await ctx.db
          .query("mailSettings")
          .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
          .first()
      : await ctx.db.query("mailSettings").first();

    if (existing) {
      await ctx.db.patch(existing._id, { ...args, updatedAt: now });
      return existing._id;
    }
    return await ctx.db.insert("mailSettings", {
      ...args,
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
    if (args.projectId && !allowedProjectIds.some((id) => id === args.projectId)) {
      return null;
    }
    if (!args.projectId) return await ctx.db.query("notificationSettings").first();
    return await ctx.db
      .query("notificationSettings")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
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
    if (args.projectId && !allowedProjectIds.some((id) => id === args.projectId)) {
      throw new Error("Bu projeye erişim yetkiniz yok");
    }
    const now = new Date().toISOString();
    const existing = args.projectId
      ? await ctx.db
          .query("notificationSettings")
          .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
          .first()
      : await ctx.db.query("notificationSettings").first();

    if (existing) {
      await ctx.db.patch(existing._id, { ...args, updatedAt: now });
      return existing._id;
    }
    return await ctx.db.insert("notificationSettings", {
      ...args,
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
    if (args.projectId && !allowedProjectIds.some((id) => id === args.projectId)) {
      return null;
    }
    if (!args.projectId) return await ctx.db.query("workSettings").first();
    return await ctx.db
      .query("workSettings")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
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
    const now = new Date().toISOString();
    const existing = args.projectId
      ? await ctx.db
          .query("workSettings")
          .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
          .first()
      : await ctx.db.query("workSettings").first();

    if (existing) {
      await ctx.db.patch(existing._id, { ...args, updatedAt: now });
      return existing._id;
    }
    return await ctx.db.insert("workSettings", { ...args, updatedAt: now });
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
    if (args.projectId && !allowedProjectIds.some((id) => id === args.projectId)) {
      return false;
    }
    const settings = args.projectId
      ? await ctx.db
          .query("generalSettings")
          .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
          .first()
      : await ctx.db.query("generalSettings").first();
    return settings?.darkMode ?? false;
  },
});
