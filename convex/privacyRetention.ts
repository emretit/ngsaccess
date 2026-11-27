import { hasPermission, requirePermission } from "./lib/permissions";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { internalQuery, type MutationCtx, type QueryCtx } from "./_generated/server";
import { internalMutation } from "./lib/dashboardMutations";
import type { Id } from "./_generated/dataModel";
import { authedMutation, authedQuery } from "./lib/customFunctions";
import { getCurrentUser, getProjectIdsForUser } from "./lib/auth";
import { getPrivacyRow, getPrivacySettings, upsertPrivacySettings } from "./lib/privacySettings";
import { writeAudit } from "./lib/audit";
import { RETENTION_BATCH_SIZE, retentionBatchPlan, retentionCutoff, validRetentionDays } from "./lib/cardReadingRetention";
import { maskChatNames } from "./lib/chatMasking";
import { filterPdksReadings } from "./lib/pdksSource";
import { removeEmployeeRecord } from "./employees";
import { shouldPurgeVisitor, validVisitorRetentionDays, visitorRetentionCutoff, VISITOR_RETENTION_BATCH_SIZE, VISITOR_RETENTION_PREVIEW_LIMIT } from "./lib/visitorRetention";

async function requireProject(ctx: QueryCtx | MutationCtx, projectId: Id<"projects">): Promise<void> {
  const allowed = await getProjectIdsForUser(ctx);
  if (!allowed.includes(projectId)) throw new ConvexError({ code: "FORBIDDEN", message: "Bu projeye erişim yetkiniz yok." });
}

export const getRetentionAndAssistant = authedQuery({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    await requirePermission(ctx, ctx.user, projectId, "admin.manage");
    const { cardReadingRetentionDays, aiMaskNames } = await getPrivacySettings(ctx, projectId);
    return { cardReadingRetentionDays, aiMaskNames };
  },
});

export const setCardReadingRetention = authedMutation({
  args: { projectId: v.id("projects"), days: v.union(v.number(), v.null()) },
  handler: async (ctx, { projectId, days }): Promise<null> => {
    await requirePermission(ctx, ctx.user, projectId, "admin.manage");
    if (!validRetentionDays(days)) throw new ConvexError({ code: "INVALID_RETENTION", message: "Saklama süresi 1825–3650 arasında tam gün olmalıdır." });
    const oldValue = (await getPrivacySettings(ctx, projectId)).cardReadingRetentionDays;
    await upsertPrivacySettings(ctx, projectId, { cardReadingRetentionDays: days });
    await writeAudit(ctx, { user: ctx.user, projectId, action: "update", targetTable: "projectPrivacySettings", targetId: projectId, oldValue: { cardReadingRetentionDays: oldValue }, newValue: { cardReadingRetentionDays: days } });
    return null;
  },
});

export const setAssistantMasking = authedMutation({
  args: { projectId: v.id("projects"), enabled: v.boolean() },
  handler: async (ctx, { projectId, enabled }): Promise<null> => {
    await requirePermission(ctx, ctx.user, projectId, "admin.manage");
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
    const user = await getCurrentUser(ctx);
    await requirePermission(ctx, user, projectId, "reports.view", "Bu projeye erişim yetkiniz yok.");
    const aiMaskNames = forceMaskNames === true || !(await hasPermission(ctx, user, projectId, "employees.view"))
      || (await getPrivacySettings(ctx, projectId)).aiMaskNames;
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


export const getVisitorNotice = authedQuery({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    await requirePermission(ctx, ctx.user, projectId, "admin.manage");
    const row = await getPrivacyRow(ctx, projectId);
    return { visitorKvkkUrl: row?.visitorKvkkUrl ?? "", visitorKvkkVersion: row?.visitorKvkkVersion ?? "" };
  },
});

export const getVisitorRetention = authedQuery({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    await requirePermission(ctx, ctx.user, projectId, "admin.manage");
    return { visitorRetentionDays: (await getPrivacySettings(ctx, projectId)).visitorRetentionDays };
  },
});

export const setVisitorRetention = authedMutation({
  args: { projectId: v.id("projects"), days: v.union(v.number(), v.null()) },
  handler: async (ctx, { projectId, days }): Promise<null> => {
    await requirePermission(ctx, ctx.user, projectId, "admin.manage");
    if (!validVisitorRetentionDays(days)) throw new ConvexError("Saklama süresi 30–3650 arasında tam gün olmalıdır.");
    const oldValue = (await getPrivacySettings(ctx, projectId)).visitorRetentionDays;
    const row = await getPrivacyRow(ctx, projectId);
    const patch = {
      visitorRetentionDays: days ?? undefined,
      visitorRetentionLastProcessedAt: days === null ? undefined : 0,
      visitorRetentionCursor: undefined, visitorRetentionRunAt: undefined, visitorRetentionCursorDays: undefined,
      updatedAt: new Date().toISOString(),
    };
    if (row) await ctx.db.patch(row._id, patch);
    else await ctx.db.insert("projectPrivacySettings", { projectId, ...patch });
    await writeAudit(ctx, { user: ctx.user, projectId, action: "update", targetTable: "projectPrivacySettings", targetId: projectId,
      oldValue: { visitorRetentionDays: oldValue }, newValue: { visitorRetentionDays: days } });
    return null;
  },
});

export const previewVisitorRetention = authedQuery({
  args: { projectId: v.id("projects"), days: v.number() },
  handler: async (ctx, { projectId, days }) => {
    await requirePermission(ctx, ctx.user, projectId, "admin.manage");
    if (!validVisitorRetentionDays(days)) throw new ConvexError("Saklama süresi 30–3650 arasında tam gün olmalıdır.");
    const runAt = Date.now();
    const rows = await ctx.db.query("employees").withIndex("by_project_visitor_active_expiry", q =>
      q.eq("projectId", projectId).eq("isVisitor", true).eq("isActive", false).lt("accessExpiresAt", visitorRetentionCutoff(days, runAt)),
    ).take(VISITOR_RETENTION_PREVIEW_LIMIT + 1);
    return { count: rows.slice(0, VISITOR_RETENTION_PREVIEW_LIMIT).filter(row => shouldPurgeVisitor(row, days, runAt)).length,
      capped: rows.length > VISITOR_RETENTION_PREVIEW_LIMIT };
  },
});

export const setVisitorNotice = authedMutation({
  args: { projectId: v.id("projects"), visitorKvkkUrl: v.string(), visitorKvkkVersion: v.string() },
  handler: async (ctx, { projectId, visitorKvkkUrl, visitorKvkkVersion }): Promise<null> => {
    await requirePermission(ctx, ctx.user, projectId, "admin.manage");
    const url = visitorKvkkUrl.trim();
    const version = visitorKvkkVersion.trim();
    if (url.length > 2048 || version.length > 100 || Boolean(url) !== Boolean(version)) {
      throw new ConvexError("Bağlantı ve sürümü birlikte girin veya ikisini de boş bırakın. Sürüm en fazla 100 karakter olmalıdır.");
    }
    if (url) {
      let parsed: URL;
      try { parsed = new URL(url); } catch { throw new ConvexError("Geçerli bir http veya https bağlantısı girin."); }
      if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) throw new ConvexError("Geçerli bir http veya https bağlantısı girin.");
    }
    const row = await getPrivacyRow(ctx, projectId);
    const patch = { visitorKvkkUrl: url || undefined, visitorKvkkVersion: version || undefined, updatedAt: new Date().toISOString() };
    if (row) await ctx.db.patch(row._id, patch);
    else await ctx.db.insert("projectPrivacySettings", { projectId, ...patch });
    await writeAudit(ctx, { user: ctx.user, projectId, action: "update", targetTable: "projectPrivacySettings", targetId: projectId,
      oldValue: { visitorKvkkUrl: row?.visitorKvkkUrl ?? null, visitorKvkkVersion: row?.visitorKvkkVersion ?? null },
      newValue: { visitorKvkkUrl: url || null, visitorKvkkVersion: version || null } });
    return null;
  },
});

// Operational retention: separate from project-configured card reading retention.
export const DAY_MS = 86_400_000;
export const OPERATION_RETENTION_DAYS = 30;
export const SYNC_RUN_RETENTION_DAYS = 90;
export const DEVICE_EVENT_RETENTION_DAYS = 365;
export const CHECK_IN_RETENTION_DAYS = 7;
export const SESSION_RETENTION_DAYS = 30;
export const MOBILE_OPERATION_RETENTION_DAYS = 30;
export const PURGE_BATCH_SIZE = 200;
export const MAX_CHAIN_LENGTH = 20;

// Audit log intentionally has no purge: its legal retention period needs a decision.
const stages = [
  ["purgeHik", "done"], ["purgeHik", "failed"],
  ["purgeIde", "acked"], ["purgeIde", "failed"],
  ["purgeSyncRuns", "done"], ["purgeSyncRuns", "partial"], ["purgeSyncRuns", "failed"],
  ["purgeDeviceEvents", ""], ["purgeCheckInTokens", "expired"], ["purgeCheckInTokens", "used"],
  ["purgeEmployeeSessions", ""],
  ["purgeMobileOperations", "confirmed"], ["purgeMobileOperations", "failed"], ["purgeMobileOperations", "unknown"],
  ["purgeVisitors", ""],
] as const;
const groups = {
  operations: { first: 0, last: 6 },
  events: { first: 7, last: 7 },
  access: { first: 8, last: 14 },
} as const;
function stageGroup(stage: number) {
  return Object.values(groups).find(group => stage >= group.first && stage <= group.last);
}
type BatchArgs = { stage: number; batch: number; runAt: number; cursor?: string };
const batchArgs = { stage: v.number(), batch: v.number(), runAt: v.number(), cursor: v.optional(v.string()) };
async function advance(ctx: MutationCtx, args: BatchArgs, done: boolean, cursor?: string) {
  const batch = args.batch + 1;
  if (batch >= MAX_CHAIN_LENGTH) return;
  const group = stageGroup(args.stage);
  if (!group) return;
  // Reserve one invocation for each remaining stage within this cron's group.
  const remaining = group.last - args.stage;
  const stage = done || MAX_CHAIN_LENGTH - batch <= remaining ? args.stage + 1 : args.stage;
  if (stage > group.last) return;
  const next = stages[stage];
  if (next) await ctx.scheduler.runAfter(0, internal.privacyRetention[next[0]], {
    stage, batch, runAt: args.runAt, ...(stage === args.stage && cursor ? { cursor } : {}),
  });
}
function valid(args: BatchArgs, name: string) {
  return Number.isInteger(args.stage) && Number.isInteger(args.batch) && args.batch >= 0 &&
    args.batch < MAX_CHAIN_LENGTH && stages[args.stage]?.[0] === name;
}
const cutoff = (args: BatchArgs, days: number) => args.runAt - days * DAY_MS;
const isoCutoff = (args: BatchArgs, days: number) => new Date(cutoff(args, days)).toISOString();
// Retry deadlines and permanent-deferral sentinels are not completed updates.
const elapsedRetryAt = (nextRetryAt: number | undefined, runAt: number) =>
  nextRetryAt !== undefined && nextRetryAt < Number.MAX_SAFE_INTEGER && nextRetryAt <= runAt ? nextRetryAt : 0;
const opts = (args: BatchArgs) => ({ numItems: PURGE_BATCH_SIZE, cursor: args.cursor ?? null });

/** Bounded pages seed pre-release enabled settings without ever touching disabled rows.
 * The pagination cursor is transient scheduler state and is discarded after the final page.
 */
async function bootstrapVisitorQueue(ctx: MutationCtx, runAt: number, cursor?: string): Promise<void> {
  const page = await ctx.db.query("projectPrivacySettings").withIndex("by_project")
    .paginate({ numItems: 50, cursor: cursor ?? null });
  for (const row of page.page) {
    if (row.visitorRetentionDays !== undefined && validVisitorRetentionDays(row.visitorRetentionDays) &&
        row.visitorRetentionLastProcessedAt === undefined) {
      await ctx.db.patch(row._id, { visitorRetentionLastProcessedAt: 0 });
    }
  }
  if (!page.isDone) await ctx.scheduler.runAfter(0, internal.privacyRetention.bootstrapVisitorRetentionQueue, {
    runAt, cursor: page.continueCursor,
  });
  else await ctx.scheduler.runAfter(0, internal.privacyRetention.purgeCheckInTokens, {
    stage: groups.access.first, batch: 0, runAt,
  });
}

export const bootstrapVisitorRetentionQueue = internalMutation({
  args: { runAt: v.number(), cursor: v.optional(v.string()) }, returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    await bootstrapVisitorQueue(ctx, args.runAt, args.cursor);
    return null;
  },
});

export const startDailyPurge = internalMutation({
  args: { group: v.optional(v.union(v.literal("operations"), v.literal("events"), v.literal("access"))) }, returns: v.null(),
  handler: async (ctx, args) => {
    const stage = groups[args.group ?? "operations"].first;
    const runAt = Date.now();
    if (args.group === "access") await bootstrapVisitorQueue(ctx, runAt);
    else await ctx.scheduler.runAfter(0, internal.privacyRetention[stages[stage][0]], { stage, batch: 0, runAt });
    return null;
  },
});

export const purgeHik = internalMutation({
  args: batchArgs, returns: v.null(),
  handler: async (ctx, args) => {
    if (!valid(args, "purgeHik")) return null;
    const status = stages[args.stage][1] === "done" ? "done" : "failed";
    const before = cutoff(args, OPERATION_RETENTION_DAYS);
    const page = await ctx.db.query("hikPendingOperations").withIndex("by_status_created", q => q.eq("status", status).lt("createdAt", before)).paginate(opts(args));
    for (const row of page.page) {
      const lastUpdate = Math.max(row.createdAt, row.completedAt ?? 0, row.dismissedAt ?? 0, row.processingStartedAt ?? 0, elapsedRetryAt(row.nextRetryAt, args.runAt));
      // Failed access changes remain actionable until dismissed or successfully completed.
      const unresolvedRevocation = row.status === "failed" && (row.operation.startsWith("delete") || row.operation === "addPerson" || row.operation === "updatePerson") && row.dismissedAt === undefined;
      if (lastUpdate < before && !unresolvedRevocation) await ctx.db.delete(row._id);
    }
    await advance(ctx, args, page.isDone, page.continueCursor);
    return null;
  },
});
export const purgeIde = internalMutation({
  args: batchArgs, returns: v.null(),
  handler: async (ctx, args) => {
    if (!valid(args, "purgeIde")) return null;
    const status = stages[args.stage][1] === "acked" ? "acked" : "failed";
    const before = cutoff(args, OPERATION_RETENTION_DAYS);
    const page = await ctx.db.query("idePendingOperations").withIndex("by_status_and_createdAt", q => q.eq("status", status).lt("createdAt", before)).paginate(opts(args));
    for (const row of page.page) {
      const lastUpdate = Math.max(row.createdAt, row.ackedAt ?? 0, row.dismissedAt ?? 0, row.sentAt ?? 0, elapsedRetryAt(row.nextRetryAt, args.runAt));
      const unresolvedRevocation = row.status === "failed" && (row.opType.startsWith("delete") || row.opType === "upsertUser") && row.dismissedAt === undefined;
      if (lastUpdate < before && !unresolvedRevocation) await ctx.db.delete(row._id);
    }
    await advance(ctx, args, page.isDone, page.continueCursor);
    return null;
  },
});
export const purgeSyncRuns = internalMutation({
  args: batchArgs, returns: v.null(),
  handler: async (ctx, args) => {
    if (!valid(args, "purgeSyncRuns")) return null;
    const value = stages[args.stage][1];
    const status = value === "done" || value === "partial" ? value : "failed";
    let deleted = 0;
    let done = false;
    while (deleted < PURGE_BATCH_SIZE) {
      const run = await ctx.db.query("deviceSyncRuns").withIndex("by_status_and_finishedAt", q => q.eq("status", status).gt("finishedAt", 0).lt("finishedAt", cutoff(args, SYNC_RUN_RETENTION_DAYS))).first();
      if (!run) { done = true; break; }
      const capacity = PURGE_BATCH_SIZE - deleted;
      const targets = await ctx.db.query("deviceSyncRunTargets").withIndex("by_run", q => q.eq("runId", run._id)).take(capacity);
      for (const target of targets) await ctx.db.delete(target._id);
      deleted += targets.length;
      if (targets.length < capacity) { await ctx.db.delete(run._id); deleted++; }
    }
    await advance(ctx, args, done);
    return null;
  },
});
export const purgeDeviceEvents = internalMutation({
  args: batchArgs, returns: v.null(),
  handler: async (ctx, args) => {
    if (!valid(args, "purgeDeviceEvents")) return null;
    const page = await ctx.db.query("deviceEvents").withIndex("by_eventTime", q => q.lt("eventTime", isoCutoff(args, DEVICE_EVENT_RETENTION_DAYS))).paginate(opts(args));
    for (const row of page.page) await ctx.db.delete(row._id);
    await advance(ctx, args, page.isDone, page.continueCursor);
    return null;
  },
});
export const purgeCheckInTokens = internalMutation({
  args: batchArgs, returns: v.null(),
  handler: async (ctx, args) => {
    if (!valid(args, "purgeCheckInTokens")) return null;
    const before = isoCutoff(args, CHECK_IN_RETENTION_DAYS);
    const query = ctx.db.query("checkInTokens");
    const page = await (stages[args.stage][1] === "used"
      ? query.withIndex("by_usedAt", q => q.gt("usedAt", "").lt("usedAt", before))
      : query.withIndex("by_expiresAt", q => q.lt("expiresAt", before))).paginate(opts(args));
    for (const row of page.page) {
      if (!row.usedAt || row.usedAt < before) await ctx.db.delete(row._id);
    }
    await advance(ctx, args, page.isDone, page.continueCursor);
    return null;
  },
});
export const purgeEmployeeSessions = internalMutation({
  args: batchArgs, returns: v.null(),
  handler: async (ctx, args) => {
    if (!valid(args, "purgeEmployeeSessions")) return null;
    const page = await ctx.db.query("employeeSessions").withIndex("by_expiresAt", q => q.lt("expiresAt", isoCutoff(args, SESSION_RETENTION_DAYS))).paginate(opts(args));
    for (const row of page.page) await ctx.db.delete(row._id);
    await advance(ctx, args, page.isDone, page.continueCursor);
    return null;
  },
});
export const purgeMobileOperations = internalMutation({
  args: batchArgs, returns: v.null(),
  handler: async (ctx, args) => {
    if (!valid(args, "purgeMobileOperations")) return null;
    const value = stages[args.stage][1];
    const status = value === "confirmed" || value === "unknown" ? value : "failed";
    const staleStatus = status === "failed" ? "pending" : status === "unknown" ? "sent" : null;
    const batchSize = staleStatus ? PURGE_BATCH_SIZE / 2 : PURGE_BATCH_SIZE;
    const before = isoCutoff(args, MOBILE_OPERATION_RETENTION_DAYS);
    const page = await ctx.db.query("mobileAccessOperations").withIndex("by_status_and_requestedAt", q => q.eq("status", status).lt("requestedAt", before))
      .paginate({ ...opts(args), numItems: batchSize });
    for (const row of page.page) await ctx.db.delete(row._id);
    // Share the existing stages' batch budget so visitor stage indices and capacity stay stable.
    const stale = staleStatus ? await ctx.db.query("mobileAccessOperations")
      .withIndex("by_status_and_requestedAt", q => q.eq("status", staleStatus).lt("requestedAt", before)).take(batchSize) : [];
    for (const row of stale) await ctx.db.delete(row._id);
    await advance(ctx, args, page.isDone && stale.length < batchSize, page.continueCursor);
    return null;
  },
});

/** One bounded project page per call; shares the access group's 20-call budget. */
export const purgeVisitors = internalMutation({
  args: { ...batchArgs, visitorProjectId: v.optional(v.id("projects")), days: v.optional(v.number()) }, returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    if (!valid(args, "purgeVisitors")) return null;
    // Persist each project's index cursor, and spend only one page before rotating.
    // Even a visitor whose cascade always fails cannot monopolize tomorrow's budget.
    const enabled = await ctx.db.query("projectPrivacySettings")
      .withIndex("by_visitorRetentionLastProcessedAt", q => q.gte("visitorRetentionLastProcessedAt", 0)).first();
    if (!enabled) return null;
    const days = enabled.visitorRetentionDays ?? 0;
    if (!validVisitorRetentionDays(days)) {
      await ctx.db.patch(enabled._id, {
        visitorRetentionLastProcessedAt: undefined,
        visitorRetentionCursor: undefined, visitorRetentionRunAt: undefined, visitorRetentionCursorDays: undefined,
      });
      await advance(ctx, args, false);
      return null;
    }
    // Completed projects have no more work in this daily run. Preserve resumable pages.
    if ((enabled.visitorRetentionLastProcessedAt ?? 0) >= args.runAt &&
        enabled.visitorRetentionCursor === undefined) return null;
    const resume = enabled.visitorRetentionCursor !== undefined &&
      enabled.visitorRetentionCursorDays === days && enabled.visitorRetentionRunAt !== undefined;
    const runAt = resume ? enabled.visitorRetentionRunAt ?? args.runAt : args.runAt;
    const page = await ctx.db.query("employees").withIndex("by_project_visitor_active_expiry", q =>
      q.eq("projectId", enabled.projectId).eq("isVisitor", true).eq("isActive", false)
        .lt("accessExpiresAt", visitorRetentionCutoff(days, runAt)),
    ).paginate({ numItems: VISITOR_RETENTION_BATCH_SIZE, maximumRowsRead: VISITOR_RETENTION_BATCH_SIZE,
      cursor: resume ? enabled.visitorRetentionCursor ?? null : null });
    for (const row of page.page) {
      if (!shouldPurgeVisitor(row, days, runAt)) continue;
      await ctx.scheduler.runAfter(0, internal.privacyRetention.removeRetainedVisitor, {
        visitorId: row._id, projectId: enabled.projectId,
      });
    }
    // Strictly increase the timestamp even if several scheduled calls share a millisecond.
    await ctx.db.patch(enabled._id, {
      visitorRetentionLastProcessedAt: Math.max(Date.now(), (enabled.visitorRetentionLastProcessedAt ?? 0) + 1),
      visitorRetentionCursor: page.isDone ? undefined : page.continueCursor,
      visitorRetentionRunAt: page.isDone ? undefined : runAt,
      visitorRetentionCursorDays: page.isDone ? undefined : days,
    });
    const batch = args.batch + 1;
    if (batch < MAX_CHAIN_LENGTH) await ctx.scheduler.runAfter(0, internal.privacyRetention.purgeVisitors, {
      stage: args.stage, batch, runAt: args.runAt,
    });
    return null;
  },
});

/** A failed cascade rolls back in a subtransaction before its failure is audited. */
export const removeRetainedVisitor = internalMutation({
  args: { visitorId: v.id("employees"), projectId: v.id("projects") }, returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    try {
      await ctx.runMutation(internal.privacyRetention.removeRetainedVisitorRecord, args);
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : "Bilinmeyen hata";
      await writeAudit(ctx, { user: null, projectId: args.projectId, action: "update", targetTable: "employees", targetId: args.visitorId,
        note: `Saklama silmesi atlandı: ${reason.slice(0, 500)}` });
    }
    return null;
  },
});

/** Separate transaction: the manual cascade owns its one allowed paginated query. */
export const removeRetainedVisitorRecord = internalMutation({
  args: { visitorId: v.id("employees"), projectId: v.id("projects") }, returns: v.null(),
  handler: async (ctx, { visitorId, projectId }): Promise<null> => {
    const visitor = await ctx.db.get(visitorId);
    if (!visitor || visitor.projectId !== projectId) return null;
    const days = (await getPrivacySettings(ctx, projectId)).visitorRetentionDays;
    if (!shouldPurgeVisitor(visitor, days, Date.now())) return null;
    await removeEmployeeRecord(ctx, visitor, null);
    await writeAudit(ctx, { user: null, projectId, action: "delete", targetTable: "employees", targetId: visitorId,
      note: "Saklama süresi doldu (sistem)" });
    return null;
  },
});


// Independent daily delivery retention budget; it does not reduce visitor capacity.
export const purgeReportDeliveries = internalMutation({
  args: { runAt: v.optional(v.number()), batch: v.optional(v.number()) }, returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const runAt = args.runAt ?? Date.now();
    const batch = args.batch ?? 0;
    if (!Number.isInteger(batch) || batch < 0 || batch >= MAX_CHAIN_LENGTH) return null;
    const before = new Date(runAt);
    const day = before.getUTCDate();
    before.setUTCDate(1);
    before.setUTCMonth(before.getUTCMonth() - 13);
    const lastDay = new Date(Date.UTC(before.getUTCFullYear(), before.getUTCMonth() + 1, 0)).getUTCDate();
    before.setUTCDate(Math.min(day, lastDay));
    const rows = await ctx.db.query("reportDeliveries")
      .withIndex("by_lastAttemptAt", q => q.lt("lastAttemptAt", before.getTime())).take(PURGE_BATCH_SIZE);
    for (const row of rows) await ctx.db.delete(row._id);
    if (rows.length === PURGE_BATCH_SIZE && batch + 1 < MAX_CHAIN_LENGTH) {
      await ctx.scheduler.runAfter(0, internal.privacyRetention.purgeReportDeliveries, { runAt, batch: batch + 1 });
    }
    return null;
  },
});
