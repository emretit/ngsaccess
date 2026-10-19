import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, internalQuery, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { adminMutation, adminQuery } from "./lib/customFunctions";
import { getProjectIdsForUser } from "./lib/auth";
import { getPrivacySettings, upsertPrivacySettings } from "./lib/privacySettings";
import { writeAudit } from "./lib/audit";
import { RETENTION_BATCH_SIZE, retentionBatchPlan, retentionCutoff, validRetentionDays } from "./lib/cardReadingRetention";
import { maskChatNames } from "./lib/chatMasking";
import { filterPdksReadings } from "./lib/pdksSource";

async function requireProject(ctx: QueryCtx | MutationCtx, projectId: Id<"projects">): Promise<void> {
  const allowed = await getProjectIdsForUser(ctx);
  if (!allowed.includes(projectId)) throw new ConvexError({ code: "FORBIDDEN", message: "Bu projeye erişim yetkiniz yok." });
}

export const getRetentionAndAssistant = adminQuery({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    await requireProject(ctx, projectId);
    const { cardReadingRetentionDays, aiMaskNames } = await getPrivacySettings(ctx, projectId);
    return { cardReadingRetentionDays, aiMaskNames };
  },
});

export const setCardReadingRetention = adminMutation({
  args: { projectId: v.id("projects"), days: v.union(v.number(), v.null()) },
  handler: async (ctx, { projectId, days }): Promise<null> => {
    await requireProject(ctx, projectId);
    if (!validRetentionDays(days)) throw new ConvexError({ code: "INVALID_RETENTION", message: "Saklama süresi 1825–3650 arasında tam gün olmalıdır." });
    const oldValue = (await getPrivacySettings(ctx, projectId)).cardReadingRetentionDays;
    await upsertPrivacySettings(ctx, projectId, { cardReadingRetentionDays: days });
    await writeAudit(ctx, { user: ctx.user, projectId, action: "update", targetTable: "projectPrivacySettings", targetId: projectId, oldValue: { cardReadingRetentionDays: oldValue }, newValue: { cardReadingRetentionDays: days } });
    return null;
  },
});

export const setAssistantMasking = adminMutation({
  args: { projectId: v.id("projects"), enabled: v.boolean() },
  handler: async (ctx, { projectId, enabled }): Promise<null> => {
    await requireProject(ctx, projectId);
    const oldValue = (await getPrivacySettings(ctx, projectId)).aiMaskNames;
    await upsertPrivacySettings(ctx, projectId, { aiMaskNames: enabled });
    await writeAudit(ctx, { user: ctx.user, projectId, action: "update", targetTable: "projectPrivacySettings", targetId: projectId, oldValue: { aiMaskNames: oldValue }, newValue: { aiMaskNames: enabled } });
    return null;
  },
});

/** Yalnız sunucu eylemleri için; çağıran kullanıcının proje izni yine doğrulanır. */
export const getAssistantPrivacy = internalQuery({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }): Promise<boolean> => {
    await requireProject(ctx, projectId);
    return (await getPrivacySettings(ctx, projectId)).aiMaskNames;
  },
});

/** OpenAI sınırında istemcinin serbest metin bağlamı yerine sunucudan hazırlanır. */
export const getAssistantContext = internalQuery({
  args: { projectId: v.id("projects"), forceMaskNames: v.optional(v.boolean()) },
  handler: async (ctx, { projectId, forceMaskNames }): Promise<string> => {
    await requireProject(ctx, projectId);
    const aiMaskNames = forceMaskNames === true || (await getPrivacySettings(ctx, projectId)).aiMaskNames;
    const rows = await ctx.db.query("cardReadings").withIndex("by_project_access_time", q => q.eq("projectId", projectId)).order("desc").take(21);
    const readings = filterPdksReadings(rows.slice(0, 20), projectId);
    const sample = maskChatNames(readings.slice(0, 5).map(row => ({ employeeId: row.employeeId, employeeName: row.employeeName, time: row.accessTime, status: row.accessStatus })), aiMaskNames)
      .map(({ employeeName, time, status }) => ({ employeeName, time, status }));
    return `Seçili projenin son ${readings.length} PDKS kaydı incelendi (toplam bilinmiyor)${rows.length > 20 ? ", devamı var" : ""}. Son kayıt örnekleri: ${JSON.stringify(sample)}. ${aiMaskNames ? "Çalışan adları Personel 1, Personel 2 biçiminde maskelidir; yanıtta bu etiketleri koru." : ""} Zamanları TR saatiyle (Europe/Istanbul) göster.`;
  },
});

/** Günlük dağıtıcı: ayar satırlarını sınırlı sayfalarla dolaşır, süresiz projeye dokunmaz. */
export const purgeExpiredCardReadings = internalMutation({
  args: { cursor: v.optional(v.string()), runAt: v.optional(v.number()) },
  handler: async (ctx, args): Promise<null> => {
    const runAt = args.runAt ?? Date.now();
    const page = await ctx.db.query("projectPrivacySettings").paginate({ cursor: args.cursor ?? null, numItems: 50 });
    for (const row of page.page) {
      const days = row.cardReadingRetentionDays ?? null;
      if (days === null || !validRetentionDays(days)) continue;
      await ctx.scheduler.runAfter(0, internal.privacyRetention.purgeProjectBatch, { projectId: row.projectId, runAt, days, batch: 0, deleted: 0 });
    }
    if (!page.isDone) await ctx.scheduler.runAfter(0, internal.privacyRetention.purgeExpiredCardReadings, { cursor: page.continueCursor, runAt });
    return null;
  },
});

export const purgeProjectBatch = internalMutation({
  args: { projectId: v.id("projects"), runAt: v.number(), days: v.number(), batch: v.number(), deleted: v.number() },
  handler: async (ctx, args): Promise<null> => {
    const { projectId } = args;
    const current = (await getPrivacySettings(ctx, projectId)).cardReadingRetentionDays;
    const cutoff = retentionCutoff(args.days, args.runAt);
    // Yönetici süreyi değiştirirse eski silme zinciri durur.
    const unchanged = current === args.days;
    const rows = unchanged && cutoff ? await ctx.db.query("cardReadings").withIndex("by_project_access_time", q => q.eq("projectId", projectId).lt("accessTime", cutoff)).take(RETENTION_BATCH_SIZE) : [];
    for (const row of rows) await ctx.db.delete(row._id);
    const deleted = args.deleted + rows.length;
    const batch = args.batch + 1;
    const plan = retentionBatchPlan(rows.length, batch);
    if (unchanged && plan.continueRun) await ctx.scheduler.runAfter(0, internal.privacyRetention.purgeProjectBatch, { ...args, batch, deleted });
    else await writeAudit(ctx, { user: null, projectId, action: "delete", targetTable: "cardReadings", targetId: projectId, newValue: { deleted, cutoff, projectId, batches: batch, dailyLimitReached: plan.dailyLimitReached, stoppedBySettingsChange: !unchanged }, note: "Kart okuma saklama süresi günlük temizliği" });
    return null;
  },
});
