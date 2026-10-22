import { getProjectIdsWithPermission, requirePermission } from "./lib/permissions";
import { writeAudit } from "./lib/audit";
import { validateSettingsNumbers } from "./lib/settingsUx";
import { resolveProjectScope } from "./lib/projectScope";
import { toPatch } from "./lib/nullablePatch";

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
    const allowedProjectIds = await getProjectIdsWithPermission(ctx, ctx.user, "admin.manage");
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
    companyName: v.optional(v.string()),
    address: v.optional(v.union(v.null(), v.string())),
    email: v.optional(v.union(v.null(), v.string())),
    phone: v.optional(v.union(v.null(), v.string())),
    website: v.optional(v.union(v.null(), v.string())),
    taxNumber: v.optional(v.union(v.null(), v.string())),
    currency: v.optional(v.union(v.null(), v.string())),
    logoUrl: v.optional(v.union(v.null(), v.string())),
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
    if (args.companyName !== undefined) {
      if (!args.companyName.trim()) throw new Error("Şirket adı boş bırakılamaz.");
      args.companyName = args.companyName.trim();
    }
    const allowedProjectIds = await resolveProjectScope(ctx, args.projectId);
    const projectId = resolveSettingsProjectId(allowedProjectIds, args.projectId);
    if (!projectId) throw new Error("Bu projeye erişim yetkiniz yok");
    await requirePermission(ctx, ctx.user, projectId, "admin.manage");
    const now = new Date().toISOString();
    const existing = await ctx.db
      .query("generalSettings")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { ...toPatch(args), projectId, updatedAt: now });
      return existing._id;
    }
    return await ctx.db.insert("generalSettings", {
      ...toPatch(args),
      companyName: args.companyName ?? "NGS Access",
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
    const allowedProjectIds = await getProjectIdsWithPermission(ctx, ctx.user, "admin.manage");
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
    const allowedProjectIds = await resolveProjectScope(ctx, args.projectId);
    const projectId = resolveSettingsProjectId(allowedProjectIds, args.projectId);
    if (!projectId) throw new Error("Bu projeye erişim yetkiniz yok");
    await requirePermission(ctx, ctx.user, projectId, "admin.manage");
    const now = new Date().toISOString();
    const existing = await ctx.db
      .query("notificationSettings")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { ...toPatch(args), projectId, updatedAt: now });
      return existing._id;
    }
    return await ctx.db.insert("notificationSettings", {
      ...toPatch(args),
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
    const allowedProjectIds = await getProjectIdsWithPermission(ctx, ctx.user, "schedule.manage");
    const projectId = resolveSettingsProjectId(allowedProjectIds, args.projectId);
    if (!projectId) return null;
    return await ctx.db
      .query("workSettings")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .first();
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

export const saveOvertime = authedMutation({
  args: {
    projectId: v.id("projects"), annualOvertimeLimitHours: v.number(), overtimeStartToleranceMinutes: v.number(), monthlyHoursBase: v.number(),
    weekdayMultiplier: v.number(), weekendMultiplier: v.number(), holidayMultiplier: v.number(), nightShiftMultiplier: v.number(), nightShiftStart: v.string(), nightShiftEnd: v.string(),
    nightCombineMode: v.optional(v.union(v.literal("max"), v.literal("multiply"), v.literal("additive"))),
    overtimeBasis: v.optional(v.union(v.literal("weekly45"), v.literal("dailyShift"))),
    nightShiftDayMode: v.optional(v.union(v.literal("shiftStart"), v.literal("splitAtMidnight"))),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, ctx.user, args.projectId, "schedule.manage");
    validateSettingsNumbers(args);
    if (args.nightShiftStart === args.nightShiftEnd) throw new Error("Gece başlangıcı ve bitişi farklı olmalı.");
    const { projectId, annualOvertimeLimitHours, overtimeStartToleranceMinutes, monthlyHoursBase, ...rates } = args;
    const updatedAt = new Date().toISOString();
    const work = { projectId, annualOvertimeLimitHours, overtimeStartToleranceMinutes, monthlyHoursBase, updatedAt };
    const { nightCombineMode, overtimeBasis, nightShiftDayMode, ...requiredRates } = rates;
    const rate = { ...requiredRates, projectId, updatedAt,
      ...(nightCombineMode !== undefined ? { nightCombineMode } : {}),
      ...(overtimeBasis !== undefined ? { overtimeBasis } : {}),
      ...(nightShiftDayMode !== undefined ? { nightShiftDayMode } : {}),
    };
    const existingWork = await ctx.db.query("workSettings").withIndex("by_project", q => q.eq("projectId", projectId)).first();
    const existingRates = await ctx.db.query("overtimeRates").withIndex("by_project", q => q.eq("projectId", projectId)).first();
    if (existingWork) await ctx.db.patch(existingWork._id, work);
    else await ctx.db.insert("workSettings", work);
    const rateId = existingRates?._id ?? await ctx.db.insert("overtimeRates", {
      ...rate, nightCombineMode: nightCombineMode ?? "max",
      overtimeBasis: overtimeBasis ?? "weekly45", nightShiftDayMode: nightShiftDayMode ?? "shiftStart",
    });
    if (existingRates) await ctx.db.patch(existingRates._id, rate);
    await writeAudit(ctx, {
      user: ctx.user, projectId, action: existingRates ? "update" : "create",
      targetTable: "overtimeRates", targetId: rateId, oldValue: existingRates ?? undefined, newValue: rate,
    });
  },
});
