import { templateRules, scheduleRuleDevices, boundedScheduleRows, ideScheduleImpact } from "./accessScheduleTemplates";
import { effectiveSchedule, toHikWeekSchedule } from "./lib/accessSchedule";
import { enqueueLocalBridgeOperationInTransaction } from "./hikvisionSync";
import { allocateIdePermissionNos, ideRuleSegments, ruleIoIdsForPanel, buildIdePermissionRecord, enqueueIdeOpInTransaction, capPermissionNos } from "./ideSync";
import { resolvePanelAuthorizedCards } from "./lib/accessGraph";
import { normalizeIdeCard } from "./ideSync";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { authedAction, authedQuery } from "./lib/customFunctions";
import { requireAdmin } from "./lib/auth";
import { resolveProjectScope } from "./lib/projectScope";
import { refreshDelay, summaryChanged, operationStatus, skippedReason, skipReasons, summarizeRun, targetStatus } from "./lib/deviceSyncRun";

const MAX_DEVICES = 200;
const MAX_RULES = 100;
const MAX_MEMBERS = 500;
const MAX_OPS = 2000;
const RUN_TIMEOUT_MS = 10 * 60 * 1000;

async function updateSummary(ctx: MutationCtx, runId: Id<"deviceSyncRuns">,
  loaded?: { run: Doc<"deviceSyncRuns">; targets: Doc<"deviceSyncRunTargets">[] }) {
  const run = loaded?.run ?? await ctx.db.get(runId);
  if (!run) return;
  const targets = loaded?.targets ?? await ctx.db.query("deviceSyncRunTargets")
    .withIndex("by_run", q => q.eq("runId", runId)).take(MAX_DEVICES + 1);
  const summary = summarizeRun(targets.map(t => t.status), run.dispatchFinished === true);
  const next = { ...summary, finishedAt: summary.status === "running" ? undefined : run.finishedAt ?? Date.now() };
  if (summaryChanged(run, next)) await ctx.db.patch(runId, next);
  return summary.status;
}

/** Shared in-transaction evidence reader; it never creates a per-target timer. */
async function refreshOneTarget(ctx: MutationCtx, target: Doc<"deviceSyncRunTargets">,
  run: Doc<"deviceSyncRuns">, failure = target.reason): Promise<Doc<"deviceSyncRunTargets">> {
  if (target.status !== "queued") return target;
  const timedOut = Date.now() - run.startedAt >= RUN_TIMEOUT_MS;
  if (!target.dispatchFinished) {
    if (!timedOut) return target;
    const patch = { status: "unknown" as const, reason: "Süre doldu; cihaz sonucu doğrulanamadı", updatedAt: Date.now() };
    await ctx.db.patch(target._id, patch);
    return { ...target, ...patch };
  }
  const ops = target.brand === "ide_smart"
    ? await ctx.db.query("idePendingOperations").withIndex("by_run_device", q => q.eq("runId", run._id).eq("deviceId", target.deviceId)).take(MAX_OPS + 1)
    : await ctx.db.query("hikPendingOperations").withIndex("by_run_device", q => q.eq("runId", run._id).eq("deviceId", target.deviceId)).take(MAX_OPS + 1);
  const statuses = ops.map(op => operationStatus(target.brand, op));
  if (failure) statuses.push("failed");
  const status = ops.length > MAX_OPS ? "unknown" : !ops.length && !failure && target.brand === "ide_smart" ? "verified" : targetStatus(statuses, timedOut);
  const reason = (ops.length > MAX_OPS ? "İşlem okuma sınırı aşıldı (2000)"
    : failure ?? ops.find(op => op.status === "failed")?.lastError
      ?? (status === "unknown" ? "Cihaz sonucu doğrulanamadı" : undefined))?.slice(0, 2000);
  if (target.status === status && target.reason === reason) return target;
  const patch = { status, reason, updatedAt: Date.now() };
  await ctx.db.patch(target._id, patch);
  return { ...target, ...patch };
}

async function refreshRun(ctx: MutationCtx, runId: Id<"deviceSyncRuns">) {
  const run = await ctx.db.get(runId);
  if (!run || run.status !== "running") return;
  const targets = await ctx.db.query("deviceSyncRunTargets")
    .withIndex("by_run", q => q.eq("runId", runId)).take(MAX_DEVICES + 1);
  const refreshed = [];
  // Sequential reads share one transaction and one run timer.
  for (const target of targets) refreshed.push(await refreshOneTarget(ctx, target, run));
  return await updateSummary(ctx, runId, { run, targets: refreshed });
}

/** Auth remains inside the transaction; public callers cannot supply startedBy. */
export const createRun = internalMutation({
  args: { projectId: v.optional(v.id("projects")), ruleId: v.optional(v.id("accessRules")) },
  handler: createRunInTransaction,
});
export async function createRunInTransaction(ctx: MutationCtx, args: { projectId?: Id<"projects">; ruleId?: Id<"accessRules"> }): Promise<Id<"deviceSyncRuns">> {
    const user = await requireAdmin(ctx);
    const rule = args.ruleId ? await ctx.db.get(args.ruleId) : null;
    if (args.ruleId && !rule) throw new ConvexError("Kural bulunamadı");
    const projectId = rule?.projectId ?? args.projectId;
    if (!projectId) throw new ConvexError("Önce bir proje seçin");
    await resolveProjectScope(ctx, projectId);
    const devices = await ctx.db.query("devices").withIndex("by_project", q => q.eq("projectId", projectId)).take(MAX_DEVICES + 1);
    const rules = rule ? [rule] : await ctx.db.query("accessRules").withIndex("by_project", q => q.eq("projectId", projectId)).take(MAX_RULES + 1);
    if (devices.length > MAX_DEVICES || rules.length > MAX_RULES) {
      throw new ConvexError("Gönderim sınırı aşıldı: bir çalıştırmada en fazla 200 cihaz ve 100 kural desteklenir.");
    }
    const ruleIds = rules.filter(r => r.isActive !== false).map(r => r._id);
    const startedAt = Date.now();
    const runId = await ctx.db.insert("deviceSyncRuns", {
      projectId, kind: args.ruleId ? "rule_sync" : "project_resync", ruleId: args.ruleId,
      startedBy: user._id, startedAt, status: "running",
      counts: summarizeRun([], false).counts, dispatchFinished: true,
    });
    const ideTargetIds: Id<"deviceSyncRunTargets">[] = [];
    for (const device of devices) {
      const reason = skippedReason(device, Date.now()) ?? (ruleIds.length === 0 ? skipReasons.noRule : undefined);
      const targetId = await ctx.db.insert("deviceSyncRunTargets", {
        runId, deviceId: device._id, deviceName: device.name, brand: device.brand ?? "other",
        status: reason ? "skipped" : "queued", reason, updatedAt: startedAt,
      });
      if (!reason && device.brand === "ide_smart") ideTargetIds.push(targetId);
      else if (!reason) await ctx.scheduler.runAfter(0, internal.deviceSyncRuns.executeTarget, { targetId, ruleIds });
    }
    if (ideTargetIds.length) await ctx.scheduler.runAfter(0, internal.deviceSyncRuns.executeIdeTargets, { targetIds: ideTargetIds, ruleIds });
    // A scheduled watchdog also settles actions that crashed before recording an outcome.
    await ctx.scheduler.runAfter(RUN_TIMEOUT_MS, internal.deviceSyncRuns.expireRun, { runId });
    const status = await updateSummary(ctx, runId);
    if (status === "running") await ctx.scheduler.runAfter(refreshDelay(0), internal.deviceSyncRuns.refreshSummary, { runId, pollAttempt: 1 });
    return runId;
}

export const startProjectResync = authedAction({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args): Promise<{ runId: Id<"deviceSyncRuns"> }> => {
    const runId: Id<"deviceSyncRuns"> = await ctx.runMutation(internal.deviceSyncRuns.createRun, args);
    return { runId };
  },
});
export const startRuleSync = authedAction({
  args: { ruleId: v.id("accessRules") },
  handler: async (ctx, args): Promise<{ runId: Id<"deviceSyncRuns"> }> => {
    const runId: Id<"deviceSyncRuns"> = await ctx.runMutation(internal.deviceSyncRuns.createRun, args);
    return { runId };
  },
});

export const loadTarget = internalQuery({
  args: { targetId: v.id("deviceSyncRunTargets") },
  handler: async (ctx, args) => {
    const target = await ctx.db.get(args.targetId);
    if (!target) return null;
    const run = await ctx.db.get(target.runId);
    const device = await ctx.db.get(target.deviceId);
    return run && device?.projectId === run.projectId ? { target, run, device } : null;
  },
});

type IdeRulePlan = { employeeIds: Id<"employees">[]; deviceIds: Id<"devices">[] };
async function readRuleDispatch(ctx: QueryCtx, args: {
  ruleId: Id<"accessRules">; deviceIds: Id<"devices">[]; projectId: Id<"projects">;
}): Promise<IdeRulePlan | null> {
  const rule = await ctx.db.get(args.ruleId);
  if (!rule || rule.projectId !== args.projectId || rule.isActive === false) return null;
  const devices = await scheduleRuleDevices(ctx, rule);
  if (devices.length > MAX_DEVICES) throw new ConvexError("Kural cihaz sınırı aşıldı (200)");
  const deviceIds = devices.filter(device => args.deviceIds.includes(device._id)).map(device => device._id);
  if (!deviceIds.length) return null;
  const members = await ctx.db.query("groupMembers")
    .withIndex("by_project_group", q => q.eq("projectId", args.projectId).eq("groupId", args.ruleId)).take(MAX_MEMBERS + 1);
  if (members.length > MAX_MEMBERS) throw new ConvexError("Kural 500’den fazla kişi içeriyor; bu çalıştırmada gönderilemedi. Kuralı daha küçük gruplara ayırın.");
  const employees = await Promise.all(members.map(m => ctx.db.get(m.employeeId)));
  if (employees.some(e => e !== null && e.projectId !== args.projectId)) throw new ConvexError("Kural başka projeye ait kişi içeriyor; gönderim durduruldu");
  return { deviceIds, employeeIds: [...new Set(employees.filter((e): e is NonNullable<typeof e> => e !== null)
    .filter(e => e.projectId === args.projectId && e.isActive === true).map(e => e._id))] };
}

/** Fail explicitly before calling the legacy graph readers if a rule exceeds the bound. */
export const prepareRule = internalQuery({
  args: { ruleId: v.id("accessRules"), deviceId: v.id("devices"), projectId: v.id("projects") },
  handler: async (ctx, args): Promise<Id<"employees">[] | null> =>
    (await readRuleDispatch(ctx, { ...args, deviceIds: [args.deviceId] }))?.employeeIds ?? null,
});
export const prepareIdeRule = internalQuery({
  args: { ruleId: v.id("accessRules"), deviceIds: v.array(v.id("devices")), projectId: v.id("projects") },
  handler: async (ctx, args): Promise<IdeRulePlan | null> => await readRuleDispatch(ctx, args),
});

/** IDE employee actions already group every permission by panel. Dispatch each person
 * once per run, with the union of matching devices across all selected rules. */
export const executeIdeTargets = internalAction({
  args: { targetIds: v.array(v.id("deviceSyncRunTargets")), ruleIds: v.array(v.id("accessRules")) },
  handler: async (ctx, args): Promise<void> => {
    type Loaded = { target: Doc<"deviceSyncRunTargets">; run: Doc<"deviceSyncRuns">; device: Doc<"devices"> };
    const loaded: (Loaded | null)[] = await Promise.all(args.targetIds.map(targetId =>
      ctx.runQuery(internal.deviceSyncRuns.loadTarget, { targetId })));
    const targets: Loaded[] = [];
    for (const item of loaded) {
      if (!item || item.target.status !== "queued" || item.device.brand !== "ide_smart") continue;
      const skip = skippedReason(item.device, Date.now());
      if (skip) await ctx.runMutation(internal.deviceSyncRuns.finishTarget, { targetId: item.target._id, skipped: skip });
      else targets.push(item);
    }
    const run = targets[0]?.run;
    if (!run) return;
    const deviceIds = targets.map(item => item.device._id);
    const matched = new Set<Id<"devices">>();
    const failures = new Map<Id<"devices">, string>();
    const employeeDevices = new Map<Id<"employees">, Set<Id<"devices">>>();
    const recordFailure = (ids: Id<"devices">[], message: string) => { for (const id of ids) failures.set(id, message); };
    const checkTimeout = () => { if (Date.now() - run.startedAt >= RUN_TIMEOUT_MS) throw new ConvexError("Gönderim zaman sınırı aşıldı"); };
    try {
      if (targets.some(item => item.run._id !== run._id)) throw new ConvexError("Gönderim hedefleri aynı çalıştırmaya ait olmalı");
      for (const ruleId of args.ruleIds) {
        checkTimeout();
        try {
          const plan: IdeRulePlan | null = await ctx.runQuery(internal.deviceSyncRuns.prepareIdeRule, { ruleId, deviceIds, projectId: run.projectId });
          if (!plan) continue;
          for (const id of plan.deviceIds) matched.add(id);
          for (const employeeId of plan.employeeIds) {
            const ids = employeeDevices.get(employeeId) ?? new Set<Id<"devices">>();
            for (const id of plan.deviceIds) ids.add(id);
            employeeDevices.set(employeeId, ids);
          }
          const result = await ctx.runAction(internal.actions.ideGatewayDevice.syncPermissionToIdePanels, {
            accessRuleId: ruleId, runId: run._id, targetDeviceIds: plan.deviceIds,
          });
          if (!result.ok || result.queued < (result.expectedQueued ?? plan.deviceIds.length) || result.skipped.length) {
            recordFailure(plan.deviceIds, result.error ?? (result.skipped.join("; ") || "İzin gönderilemedi"));
          }
        } catch (error) {
          recordFailure(deviceIds, error instanceof Error ? error.message : "Kural gönderilemedi");
        }
      }
      for (const [employeeId, ids] of employeeDevices) {
        checkTimeout();
        const targetDeviceIds = [...ids];
        try {
          const result = await ctx.runAction(internal.actions.ideGatewayDevice.syncEmployeeToIdePanels, { employeeId, runId: run._id, targetDeviceIds });
          if (!result.ok || result.queued < targetDeviceIds.length || result.skipped.length) {
            recordFailure(targetDeviceIds, result.error ?? (result.skipped.join("; ") || "Kişi gönderilemedi"));
          }
        } catch (error) {
          recordFailure(targetDeviceIds, error instanceof Error ? error.message : "Kişi gönderilemedi");
        }
      }
    } catch (error) {
      recordFailure(deviceIds, error instanceof Error ? error.message : "Cihaza gönderim başlatılamadı");
    }
    for (const { target, device } of targets) {
      const failure = failures.get(device._id);
      await ctx.runMutation(internal.deviceSyncRuns.finishTarget, { targetId: target._id, failure,
        skipped: !matched.has(device._id) && !failure ? skipReasons.noRule : undefined });
    }
  },
});

/** Atomically allocate once even when multiple device workers reach the same rule. */
export const ensureWeekPlan = internalMutation({
  args: { ruleId: v.id("accessRules"), projectId: v.id("projects") },
  handler: async (ctx, args): Promise<number> => {
    const rule = await ctx.db.get(args.ruleId);
    if (!rule || rule.projectId !== args.projectId) throw new ConvexError("Kural bulunamadı");
    if (rule.hikWeekPlanNo) {
      if (!Number.isSafeInteger(rule.hikWeekPlanNo) || rule.hikWeekPlanNo < 1 || rule.hikWeekPlanNo > 65535) {
        throw new ConvexError("Hikvision plan numarası geçersiz (1–65535)");
      }
      return rule.hikWeekPlanNo;
    }
    const last = await ctx.db.query("accessRules").withIndex("by_hikWeekPlanNo").order("desc").first();
    const weekPlanNo = Math.max(1, last?.hikWeekPlanNo ?? 1) + 1;
    if (!Number.isSafeInteger(weekPlanNo) || weekPlanNo > 65535) throw new ConvexError("Hikvision plan numarası sınırı aşıldı (65535)");
    await ctx.db.patch(rule._id, { hikWeekPlanNo: weekPlanNo });
    return weekPlanNo;
  },
});

export const executeTarget = internalAction({
  args: { targetId: v.id("deviceSyncRunTargets"), ruleIds: v.array(v.id("accessRules")) },
  handler: async (ctx, args): Promise<void> => {
    const loaded: { target: Doc<"deviceSyncRunTargets">; run: Doc<"deviceSyncRuns">; device: Doc<"devices"> } | null =
      await ctx.runQuery(internal.deviceSyncRuns.loadTarget, { targetId: args.targetId });
    if (!loaded || loaded.target.status !== "queued") return;
    const { run, target, device } = loaded;
    const syncedEmployees = new Set<Id<"employees">>();
    let matched = false;
    let failure: string | undefined;
    try {
      const skip = skippedReason(device, Date.now());
      if (skip) {
        await ctx.runMutation(internal.deviceSyncRuns.finishTarget, { targetId: target._id, skipped: skip });
        return;
      }
      for (const ruleId of args.ruleIds) {
        if (Date.now() - run.startedAt >= RUN_TIMEOUT_MS) throw new ConvexError("Gönderim zaman sınırı aşıldı");
        const employees: Id<"employees">[] | null = await ctx.runQuery(internal.deviceSyncRuns.prepareRule, {
          ruleId, deviceId: device._id, projectId: run.projectId,
        });
        if (employees === null) continue;
        matched = true;
        if (device.brand === "hikvision") {
          await ctx.runMutation(internal.deviceSyncRuns.ensureWeekPlan, { ruleId, projectId: run.projectId });
          const result = await ctx.runAction(internal.actions.hikvisionSync.syncWeekPlanToDevicesInternal, {
            accessRuleId: ruleId, runId: run._id, targetDeviceIds: [device._id], allowedProjectIds: [run.projectId],
          });
          if (result.failed || result.synced !== 1 || result.employeesSynced < employees.length) {
            failure = result.errors.join("; ") || "Kural veya kişi bilgilerinin tümü gönderilemedi";
          }
        } else {
          const permission = await ctx.runAction(internal.actions.ideGatewayDevice.syncPermissionToIdePanels, {
            accessRuleId: ruleId, runId: run._id, targetDeviceIds: [device._id],
          });
          if (!permission.ok || permission.queued < (permission.expectedQueued ?? 1) || permission.skipped.length) {
            failure = permission.error ?? (permission.skipped.join("; ") || "İzin gönderilemedi");
          }
          for (const employeeId of employees) {
            // The employee action already includes every panel permission for this person.
            if (syncedEmployees.has(employeeId)) continue;
            syncedEmployees.add(employeeId);
            if (Date.now() - run.startedAt >= RUN_TIMEOUT_MS) throw new ConvexError("Gönderim zaman sınırı aşıldı");
            const result = await ctx.runAction(internal.actions.ideGatewayDevice.syncEmployeeToIdePanels, {
              employeeId, runId: run._id, targetDeviceIds: [device._id],
            });
            if (!result.ok || result.queued === 0 || result.skipped.length) {
              failure = result.error ?? (result.skipped.join("; ") || "Kişi gönderilemedi");
            }
          }
        }
      }
    } catch (error) {
      failure = error instanceof Error ? error.message : "Cihaza gönderim başlatılamadı";
    }
    await ctx.runMutation(internal.deviceSyncRuns.finishTarget, {
      targetId: target._id, failure,
      skipped: !matched && !failure ? skipReasons.noRule : undefined,
      directSent: device.brand === "hikvision" && device.hikTransport !== "localBridge",
    });
  },
});

export const finishTarget = internalMutation({
  args: { targetId: v.id("deviceSyncRunTargets"), failure: v.optional(v.string()), skipped: v.optional(v.string()), directSent: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const target = await ctx.db.get(args.targetId);
    if (!target || target.status !== "queued") return;
    const status = args.skipped ? "skipped" : args.failure ? "failed" : args.directSent ? "sent" : "queued";
    const reason = (args.skipped ?? args.failure)?.slice(0, 2000);
    if (target.dispatchFinished === true && target.status === status && target.reason === reason) return;
    await ctx.db.patch(target._id, { dispatchFinished: true, status, reason, updatedAt: Date.now() });
    const run = await ctx.db.get(target.runId);
    if (run?.kind === "template_sync") {
      await refreshRun(ctx, run._id);
    }
  },
});

/** Compatibility for jobs already scheduled by the previous implementation; no re-poll. */
export const refreshTarget = internalMutation({
  args: { targetId: v.id("deviceSyncRunTargets"), failure: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const target = await ctx.db.get(args.targetId);
    if (!target || target.status !== "queued") return;
    const run = await ctx.db.get(target.runId);
    if (run) await refreshOneTarget(ctx, target, run, args.failure ?? target.reason);
  },
});

export const expireRun = internalMutation({
  args: { runId: v.id("deviceSyncRuns") },
  handler: async (ctx, args) => { await refreshRun(ctx, args.runId); },
});

/** One run-wide evidence/summary writer, with no writes when nothing changed. */
export const refreshSummary = internalMutation({
  args: { runId: v.id("deviceSyncRuns"), pollAttempt: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const status = await refreshRun(ctx, args.runId);
    if (status !== "running") return;
    const run = await ctx.db.get(args.runId);
    if (!run) return;
    const remaining = RUN_TIMEOUT_MS - (Date.now() - run.startedAt);
    if (remaining <= 0) return;
    const attempt = args.pollAttempt ?? 0;
    await ctx.scheduler.runAfter(Math.min(refreshDelay(attempt), remaining), internal.deviceSyncRuns.refreshSummary,
      { runId: args.runId, pollAttempt: attempt + 1 });
  },
});

export const listRecent = authedQuery({
  args: { projectId: v.id("projects"), ruleId: v.optional(v.id("accessRules")), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await resolveProjectScope(ctx, args.projectId);
    const limit = args.limit === undefined ? 10 : Math.max(1, Math.min(20, Math.floor(args.limit)));
    if (!Number.isFinite(limit)) throw new ConvexError("Geçersiz liste sınırı");
    if (args.ruleId) {
      const rule = await ctx.db.get(args.ruleId);
      if (!rule?.projectId || rule.projectId !== args.projectId) throw new ConvexError("Kural bu projeye ait değil");
      await resolveProjectScope(ctx, rule.projectId);
    }
    const runs = args.ruleId
      ? await ctx.db.query("deviceSyncRuns").withIndex("by_rule_started", q => q.eq("ruleId", args.ruleId)).order("desc").take(limit)
      : await ctx.db.query("deviceSyncRuns").withIndex("by_project_started", q => q.eq("projectId", args.projectId)).order("desc").take(limit);
    return await Promise.all(runs.filter(run => run.projectId === args.projectId).map(async run => {
      const targets = await ctx.db.query("deviceSyncRunTargets").withIndex("by_run", q => q.eq("runId", run._id)).take(MAX_DEVICES + 1);
      return { ...run, ...summarizeRun(targets.map(t => t.status), run.dispatchFinished === true) };
    }));
  },
});
export const get = authedQuery({
  args: { runId: v.id("deviceSyncRuns") },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run) throw new ConvexError("Gönderim çalıştırması bulunamadı");
    await resolveProjectScope(ctx, run.projectId);
    const targets = await ctx.db.query("deviceSyncRunTargets")
      .withIndex("by_run", q => q.eq("runId", run._id)).take(MAX_DEVICES + 1);
    return { ...run, ...summarizeRun(targets.map(t => t.status), run.dispatchFinished === true), targets };
  },
});

export type RuleDiffDispatch = {
  syncMembers: Id<"employees">[];
  removed: Id<"employees">[];
  syncRule: boolean;
  reconcileRoster: boolean;
};

/** Called inside the save transaction: a committed diff cannot lose its run. */
export async function createRuleDiffRun(ctx: MutationCtx, args: {
  ruleId: Id<"accessRules">; projectId: Id<"projects">; startedBy: Id<"users">;
  beforeDeviceIds: Id<"devices">[]; plan: RuleDiffDispatch;
}): Promise<Id<"deviceSyncRuns"> | null> {
  const { plan } = args;
  if (!plan.syncRule && !plan.syncMembers.length && !plan.removed.length && !plan.reconcileRoster) return null;
  const devices = await ctx.db.query("devices").withIndex("by_project", q => q.eq("projectId", args.projectId)).take(MAX_DEVICES + 1);
  if (devices.length > MAX_DEVICES || new Set([...plan.syncMembers, ...plan.removed]).size > MAX_MEMBERS) {
    throw new ConvexError("Fark gönderim sınırı aşıldı (200 cihaz / 500 değişen kişi); kayıt yapılmadı.");
  }
  const startedAt = Date.now();
  const runId = await ctx.db.insert("deviceSyncRuns", {
    projectId: args.projectId, kind: "rule_sync", ruleId: args.ruleId,
    startedBy: args.startedBy, startedAt, status: "running",
    counts: summarizeRun([], false).counts, dispatchFinished: true,
  });
  for (const device of devices) {
    const reason = skippedReason(device, startedAt);
    const targetId = await ctx.db.insert("deviceSyncRunTargets", {
      runId, deviceId: device._id, deviceName: device.name, brand: device.brand ?? "other",
      status: reason ? "skipped" : "queued", reason, updatedAt: startedAt,
    });
    if (!reason) await ctx.scheduler.runAfter(0, internal.deviceSyncRuns.executeRuleDiffTarget, {
      targetId, ruleId: args.ruleId,
      // The planner may carry additional fields; scheduler args are deliberately explicit.
      syncMembers: plan.syncMembers, removed: plan.removed,
      syncRule: plan.syncRule, reconcileRoster: plan.reconcileRoster,
      wasRuleTarget: args.beforeDeviceIds.includes(device._id),
    });
  }
  await ctx.scheduler.runAfter(RUN_TIMEOUT_MS, internal.deviceSyncRuns.expireRun, { runId });
  if (await updateSummary(ctx, runId) === "running") {
    await ctx.scheduler.runAfter(refreshDelay(0), internal.deviceSyncRuns.refreshSummary, { runId, pollAttempt: 1 });
  }
  return runId;
}

/** Keep the canonical door-leg protection when revoking IDE users. */
export const diffIdeContext = internalQuery({
  args: { deviceId: v.id("devices"), reconcileRoster: v.boolean() },
  handler: async (ctx, args): Promise<{ authorizedCards: string[]; orphanCards: string[] }> => {
    const panel = await ctx.db.get(args.deviceId);
    if (!panel?.ideUuid || panel.brand !== "ide_smart") return { authorizedCards: [], orphanCards: [] };
    const ideUuid = panel.ideUuid;
    const { authorized } = await resolvePanelAuthorizedCards(ctx, args.deviceId);
    const roster = args.reconcileRoster ? await ctx.db.query("idePanelUsers")
      .withIndex("by_uuid", q => q.eq("ideUuid", ideUuid)).take(MAX_OPS + 1) : [];
    if (roster.length > MAX_OPS) throw new ConvexError("Panel kullanıcı sınırı aşıldı (2000); sonuç doğrulanamadı");
    return { authorizedCards: [...authorized], orphanCards: roster.filter(row => !authorized.has(row.cardNumber)).map(row => row.cardNumber) };
  },
});

/** Dispatch only the people selected by the diff, keeping every operation in one run. */
export const executeRuleDiffTarget = internalAction({
  args: {
    targetId: v.id("deviceSyncRunTargets"), ruleId: v.id("accessRules"),
    syncMembers: v.array(v.id("employees")), removed: v.array(v.id("employees")),
    syncRule: v.boolean(), reconcileRoster: v.boolean(), wasRuleTarget: v.boolean(),
  },
  handler: async (ctx, args): Promise<void> => {
    const loaded: { target: Doc<"deviceSyncRunTargets">; run: Doc<"deviceSyncRuns">; device: Doc<"devices"> } | null =
      await ctx.runQuery(internal.deviceSyncRuns.loadTarget, { targetId: args.targetId });
    if (!loaded || loaded.target.status !== "queued") return;
    const { device, run, target } = loaded;
    const failures: string[] = [];
    let worked = false;
    const checkTimeout = () => { if (Date.now() - run.startedAt >= RUN_TIMEOUT_MS) throw new ConvexError("Gönderim zaman sınırı aşıldı"); };
    const context = { runId: run._id, targetDeviceIds: [device._id] };
    try {
      const skip = skippedReason(device, Date.now());
      if (skip) {
        await ctx.runMutation(internal.deviceSyncRuns.finishTarget, { targetId: target._id, skipped: skip });
        return;
      }
      const rule = await ctx.runQuery(internal.hikvisionSync.getAccessRuleWithDevices, { accessRuleId: args.ruleId });
      if (!rule || rule.rule.projectId !== run.projectId) throw new ConvexError("Kural bulunamadı veya proje değişti");
      const currentRuleTarget = rule.devices.some(d => d._id === device._id);
      if (args.syncRule && currentRuleTarget && rule.rule.isActive !== false) {
        worked = true;
        if (device.brand === "hikvision") {
          await ctx.runMutation(internal.deviceSyncRuns.ensureWeekPlan, { ruleId: args.ruleId, projectId: run.projectId });
          const result = await ctx.runAction(internal.actions.hikvisionSync.syncWeekPlanToDevicesInternal, {
            accessRuleId: args.ruleId, ...context, allowedProjectIds: [run.projectId], targetEmployeeIds: [],
          });
          if (result.failed || result.synced !== 1) failures.push(result.errors.join("; ") || "Hafta planı gönderilemedi");
        } else {
          const result = await ctx.runAction(internal.actions.ideGatewayDevice.syncPermissionToIdePanels, { accessRuleId: args.ruleId, ...context });
          if (!result.ok || !result.queued || result.skipped.length) failures.push(result.error ?? (result.skipped.join("; ") || "İzin gönderilemedi"));
        }
      }
      const ideContext: { authorizedCards: string[]; orphanCards: string[] } = device.brand === "ide_smart"
        ? await ctx.runQuery(internal.deviceSyncRuns.diffIdeContext, { deviceId: device._id, reconcileRoster: args.reconcileRoster && (currentRuleTarget || args.wasRuleTarget) })
        : { authorizedCards: [], orphanCards: [] };
      const deleteCards = new Set(ideContext.orphanCards);
      const deleteEmployeesByCard = new Map<string, Id<"employees">>();
      for (const employeeId of new Set([...args.removed, ...args.syncMembers])) {
        checkTimeout();
        try {
          const data = await ctx.runQuery(internal.hikvisionSync.getEmployeeWithDevices, { employeeId });
          if (!data || data.employee.projectId !== run.projectId) throw new ConvexError("Çalışan bulunamadı veya proje değişti");
          const hasAccess = data.deviceRules.some(dr => dr.device._id === device._id);
          if (hasAccess && (device.brand !== "hikvision" || data.employee.isActive !== false)) {
            worked = true;
            if (device.brand === "hikvision") {
              const result = await ctx.runAction(internal.actions.hikvisionSync.syncEmployeeToDevicesInternal, { employeeId, ...context, allowedProjectIds: [run.projectId] });
              if (result.failed || result.synced !== 1) failures.push(result.errors.join("; ") || "Kişi gönderilemedi");
            } else {
              const result = await ctx.runAction(internal.actions.ideGatewayDevice.syncEmployeeToIdePanels, { employeeId, ...context });
              if (!result.ok || !result.queued || result.skipped.length) failures.push(result.error ?? (result.skipped.join("; ") || "Kişi gönderilemedi"));
            }
          } else if (args.wasRuleTarget || hasAccess) {
            if (device.brand === "ide_smart") {
              const card = normalizeIdeCard(data.employee.cardNumber);
              if (!card) throw new ConvexError("Kart numarası IDE için geçersiz");
              if (!ideContext.authorizedCards.includes(card)) {
                deleteCards.add(data.employee.cardNumber);
                deleteEmployeesByCard.set(data.employee.cardNumber, employeeId);
              }
            } else {
              worked = true;
              // Snapshot retains the former target after its membership has been removed.
              const result = await ctx.runAction(internal.actions.hikvisionSync.deleteEmployeeFromDevicesInternal, {
                employeeId, ...context, allowedProjectIds: [run.projectId],
                snapshot: { cardNumber: data.employee.cardNumber, projectId: run.projectId, devices: [{
                  _id: device._id, name: device.name, brand: device.brand, projectId: device.projectId,
                  hikDevIndex: device.hikDevIndex, hikTransport: device.hikTransport, hikDoorCount: device.hikDoorCount,
                }] },
              });
              if (result.failed || result.removed !== 1) failures.push(result.errors.join("; ") || "Kişi cihazdan silinemedi");
            }
          }
        } catch (error) { failures.push(error instanceof Error ? error.message : "Kişi işlemi başarısız"); }
      }
      for (const cardNumber of deleteCards) {
        checkTimeout();
        worked = true;
        const result = await ctx.runAction(internal.actions.ideGatewayDevice.deleteIdeUserFromPanels, {
          employeeId: deleteEmployeesByCard.get(cardNumber), cardNumber, deviceIds: [device._id], projectId: run.projectId, runId: run._id,
        });
        if (!result.ok || result.queued !== 1) failures.push("IDE yetkisiz kişi silinemedi");
      }
    } catch (error) { failures.push(error instanceof Error ? error.message : "Fark gönderimi başarısız"); }
    await ctx.runMutation(internal.deviceSyncRuns.finishTarget, {
      targetId: target._id, failure: failures.length ? failures.join("; ") : undefined,
      skipped: !worked && !failures.length ? "Bu cihaz için değişen yetki yok" : undefined,
      directSent: device.brand === "hikvision" && device.hikTransport !== "localBridge",
    });
  },
});

/** Debounced template changes produce one run and one target per affected device. */
export const createTemplateRun = internalMutation({
  args: { templateId: v.id("accessScheduleTemplates"), startedBy: v.id("users") },
  handler: async (ctx, args): Promise<Id<"deviceSyncRuns"> | null> => {
    const template = await ctx.db.get(args.templateId);
    if (!template) return null;
    const rules = await templateRules(ctx, template._id);
    const byDevice = new Map<Id<"devices">, Doc<"devices">>();
    for (const rule of rules) for (const device of await scheduleRuleDevices(ctx, rule)) byDevice.set(device._id, device);
    if (byDevice.size > MAX_DEVICES) throw new ConvexError("Çok büyük kapsam: 200 cihaz sınırı");
    const now = Date.now();
    const runId = await ctx.db.insert("deviceSyncRuns", {
      projectId: template.projectId, templateId: template._id, kind: "template_sync",
      startedBy: args.startedBy, startedAt: now, status: "running", dispatchFinished: true,
      counts: summarizeRun([], false).counts,
    });
    let maxPlan = (await ctx.db.query("accessRules").withIndex("by_hikWeekPlanNo").order("desc").first())?.hikWeekPlanNo ?? 1;
    const changedRuleIds: Id<"accessRules">[] = [];
    for (const rule of rules) {
      if (rule.projectId !== template.projectId) throw new ConvexError("Şablon başka proje kuralına bağlı");
      const devices = await scheduleRuleDevices(ctx, rule);
      if (devices.some(d => d.brand === "hikvision") && !rule.hikWeekPlanNo) {
        if (++maxPlan > 65535) throw new ConvexError("Hik plan numarası kapasitesi aşıldı");
        await ctx.db.patch(rule._id, { hikWeekPlanNo: maxPlan });
      }
      if (devices.some(d => d.brand === "ide_smart")) {
        const k = ideRuleSegments(rule, template).length;
        if ((await allocateIdePermissionNos(ctx, rule, k, runId)).changed) changedRuleIds.push(rule._id);
      }
    }
    for (const device of byDevice.values()) {
      const reason = skippedReason(device, now);
      const targetId = await ctx.db.insert("deviceSyncRunTargets", {
        runId, deviceId: device._id, deviceName: device.name, brand: device.brand ?? "other",
        status: reason ? "skipped" : "queued", reason, updatedAt: now,
      });
      if (!reason) await ctx.scheduler.runAfter(0, internal.actions.hikvisionSync.executeTemplateTarget, { targetId, ruleIds: rules.map(r => r._id), changedRuleIds });
    }
    await ctx.db.patch(template._id, { pendingSyncJobId: undefined });
    const status = await updateSummary(ctx, runId);
    // Reuse the existing run watchdog/evidence loop; no per-device timer or cron.
    await ctx.scheduler.runAfter(RUN_TIMEOUT_MS, internal.deviceSyncRuns.expireRun, { runId });
    if (status === "running") await ctx.scheduler.runAfter(refreshDelay(0), internal.deviceSyncRuns.refreshSummary, { runId, pollAttempt: 1 });
    return runId;
  },
});

export const loadTemplateTarget = internalQuery({
  args: { targetId: v.id("deviceSyncRunTargets"), ruleIds: v.array(v.id("accessRules")) },
  handler: async (ctx, args) => {
    const target = await ctx.db.get(args.targetId);
    if (!target || target.status !== "queued") return null;
    const run = await ctx.db.get(target.runId);
    const device = await ctx.db.get(target.deviceId);
    if (!run || !device || device.projectId !== run.projectId) return null;
    const plans = [];
    for (const ruleId of args.ruleIds) {
      const rule = await ctx.db.get(ruleId);
      if (!rule || rule.projectId !== run.projectId || rule.scheduleTemplateId !== run.templateId) continue;
      if (!(await scheduleRuleDevices(ctx, rule)).some(d => d._id === device._id)) continue;
      const template = rule.scheduleTemplateId ? await ctx.db.get(rule.scheduleTemplateId) : null;
      plans.push({ rule, schedule: toHikWeekSchedule(effectiveSchedule(rule, template)) });
    }
    return { target, run, device, plans };
  },
});

/** One transaction queues every schedule for this target, and users only when K changes. */
export const enqueueTemplateTarget = internalMutation({
  args: { targetId: v.id("deviceSyncRunTargets"), ruleIds: v.array(v.id("accessRules")), changedRuleIds: v.array(v.id("accessRules")) },
  handler: async (ctx, args): Promise<void> => {
    const target = await ctx.db.get(args.targetId);
    if (!target || target.status !== "queued") return;
    const run = await ctx.db.get(target.runId);
    const device = await ctx.db.get(target.deviceId);
    if (!run || !device || device.projectId !== run.projectId) throw new ConvexError("Gönderim hedefi bulunamadı");
    const overLimit = device.brand === "ide_smart"
      ? await ideScheduleImpact(ctx, run.projectId, undefined, args.ruleIds, device._id) : [];
    const overLimitEmployees = new Set(overLimit.map(entry => entry.employeeId));
    const failures: string[] = [];
    for (const entry of overLimit) {
      const employee = await ctx.db.get(entry.employeeId);
      failures.push(`${employee ? `${employee.firstName} ${employee.lastName}` : entry.employeeId}: IDE 16 izin sınırı aşıldı`);
    }
    const changedEmployees = new Set<Id<"employees">>();
    for (const ruleId of args.ruleIds) {
      const rule = await ctx.db.get(ruleId);
      if (!rule || rule.projectId !== run.projectId || rule.scheduleTemplateId !== run.templateId) continue;
      if (!(await scheduleRuleDevices(ctx, rule)).some(d => d._id === device._id)) continue;
      const template = rule.scheduleTemplateId ? await ctx.db.get(rule.scheduleTemplateId) : null;
      if (device.brand === "hikvision") {
        await enqueueLocalBridgeOperationInTransaction(ctx, {
          deviceId: device._id, projectId: run.projectId, runId: run._id, operation: "syncWeekPlan",
          payload: { accessRuleId: ruleId, weekPlanNo: rule.hikWeekPlanNo, templateName: rule.name, schedule: toHikWeekSchedule(effectiveSchedule(rule, template)) },
        });
        continue;
      }
      const segments = ideRuleSegments(rule, template);
      const allocation = await allocateIdePermissionNos(ctx, rule, segments.length, run._id);
      const io = await ruleIoIdsForPanel(ctx, { ruleId, deviceId: device._id });
      for (const [index, schedule] of segments.entries()) {
        const no = allocation.nos[index];
        if (no === undefined) continue;
        await enqueueIdeOpInTransaction(ctx, { deviceId: device._id, projectId: run.projectId, runId: run._id, opType: "upsertPermission",
          payload: { mode: "create", permissionRecord: { ...buildIdePermissionRecord(no, io, {}), schedule } } });
      }
      if (allocation.changed || args.changedRuleIds.includes(ruleId)) {
        const members = boundedScheduleRows(await ctx.db.query("groupMembers").withIndex("by_project_group", q => q.eq("projectId", run.projectId).eq("groupId", ruleId)).take(MAX_MEMBERS + 1), MAX_MEMBERS);
        for (const member of members) changedEmployees.add(member.employeeId);
      }
    }
    if (changedEmployees.size > MAX_MEMBERS) throw new ConvexError("Çok büyük kapsam: 500 kişi sınırı");
    for (const employeeId of changedEmployees) {
      const employee = await ctx.db.get(employeeId);
      if (!employee || employee.projectId !== run.projectId || !employee.isActive) continue;
      if (overLimitEmployees.has(employeeId)) continue;
      const card = Number(employee.cardNumber);
      if (!Number.isSafeInteger(card) || card < 1) throw new ConvexError("IDE kart numarası sayısal olmalı");
      const memberships = boundedScheduleRows(await ctx.db.query("groupMembers").withIndex("by_project_employee", q => q.eq("projectId", run.projectId).eq("employeeId", employeeId)).take(101), 100);
      const nos: number[] = [];
      const ruleIds: Id<"accessRules">[] = [];
      for (const ruleId of new Set(memberships.map(m => m.groupId))) {
        const rule = await ctx.db.get(ruleId);
        if (!rule || rule.projectId !== run.projectId || rule.isActive === false) continue;
        if (!(await scheduleRuleDevices(ctx, rule)).some(d => d._id === device._id)) continue;
        ruleIds.push(ruleId);
        nos.push(...[rule.idePermissionNo, ...(rule.ideExtraPermissionNos ?? [])].filter((no): no is number => no !== undefined));
      }
      if (new Set(nos).size > 16) {
        failures.push(`${employee.firstName} ${employee.lastName}: IDE 16 izin sınırı aşıldı`);
        continue;
      }
      await enqueueIdeOpInTransaction(ctx, { deviceId: device._id, projectId: run.projectId, runId: run._id, opType: "upsertUser",
        payload: { employeeId, ruleIds, mode: "create", userRecord: { id: card, status: 1, permissions: capPermissionNos(nos) } } });
    }
    if (failures.length) await ctx.db.patch(target._id, { status: "failed", dispatchFinished: true, reason: failures.join("; ").slice(0, 2000), updatedAt: Date.now() });
  },
});

async function assertNoActiveGrantRun(ctx: MutationCtx, projectId: Id<"projects">) {
  const runs = await ctx.db.query("deviceSyncRuns").withIndex("by_project_started", q => q.eq("projectId", projectId).gte("startedAt", Date.now() - RUN_TIMEOUT_MS)).order("desc").take(1001);
  if (runs.some(run => run.status === "running")) throw new ConvexError("Bu projede bir gönderim zaten çalışıyor");
  if (runs.length > 1000) throw new ConvexError("Gönderim geçmişi okuma sınırı aşıldı; çalışan gönderim denetlenemedi");
}

/** Selected pairs share one run, one target per device and the existing watchdog. */
export async function createGrantRun(ctx: MutationCtx, args: {
  projectId: Id<"projects">; startedBy: Id<"users">;
  pairs: { employeeId: Id<"employees">; deviceId: Id<"devices"> }[];
}): Promise<Id<"deviceSyncRuns">> {
  if (args.pairs.length === 0 || args.pairs.length > 100) throw new ConvexError("1–100 kişi×cihaz seçin");
  await assertNoActiveGrantRun(ctx, args.projectId);
  const byDevice = new Map<Id<"devices">, { device: Doc<"devices">; employeeIds: Set<Id<"employees">> }>();
  for (const pair of args.pairs) {
    const [employee, device] = await Promise.all([ctx.db.get(pair.employeeId), ctx.db.get(pair.deviceId)]);
    if (!employee || employee.projectId !== args.projectId || !device || device.projectId !== args.projectId) throw new ConvexError("Kişi ve cihaz aynı projede olmalı");
    const entry = byDevice.get(device._id) ?? { device, employeeIds: new Set<Id<"employees">>() };
    entry.employeeIds.add(employee._id); byDevice.set(device._id, entry);
  }
  const now = Date.now();
  const runId = await ctx.db.insert("deviceSyncRuns", { projectId: args.projectId, startedBy: args.startedBy, kind: "project_resync", status: "running", startedAt: now, counts: summarizeRun([], false).counts, dispatchFinished: true });
  for (const { device, employeeIds } of byDevice.values()) {
    const reason = skippedReason(device, now);
    const targetId = await ctx.db.insert("deviceSyncRunTargets", { runId, deviceId: device._id, deviceName: device.name, brand: device.brand ?? "other", status: reason ? "skipped" : "queued", reason, updatedAt: now });
    if (!reason) await ctx.scheduler.runAfter(0, internal.deviceSyncRuns.executeGrantTarget, { targetId, employeeIds: [...employeeIds] });
  }
  await ctx.scheduler.runAfter(RUN_TIMEOUT_MS, internal.deviceSyncRuns.expireRun, { runId });
  if (await updateSummary(ctx, runId) === "running") await ctx.scheduler.runAfter(refreshDelay(0), internal.deviceSyncRuns.refreshSummary, { runId, pollAttempt: 1 });
  return runId;
}

export const executeGrantTarget = internalAction({
  args: { targetId: v.id("deviceSyncRunTargets"), employeeIds: v.array(v.id("employees")) },
  handler: async (ctx, args): Promise<void> => {
    const loaded = await ctx.runQuery(internal.deviceSyncRuns.loadTarget, { targetId: args.targetId });
    if (!loaded || loaded.target.status !== "queued") return;
    const { run, target, device } = loaded;
    const failures: string[] = [];
    try {
      const skip = skippedReason(device, Date.now());
      if (skip) { await ctx.runMutation(internal.deviceSyncRuns.finishTarget, { targetId: target._id, skipped: skip }); return; }
      for (const employeeId of args.employeeIds) {
        if (Date.now() - run.startedAt >= RUN_TIMEOUT_MS) throw new ConvexError("Gönderim zaman sınırı aşıldı");
        const data = await ctx.runQuery(internal.hikvisionSync.getEmployeeWithDevices, { employeeId });
        if (!data || data.employee.projectId !== run.projectId) throw new ConvexError("Çalışan bulunamadı veya proje değişti");
        const context = { employeeId, runId: run._id, targetDeviceIds: [device._id] };
        if (data.deviceRules.some(dr => dr.device._id === device._id) && data.employee.isActive !== false) {
          if (device.brand === "ide_smart") {
            const result = await ctx.runAction(internal.actions.ideGatewayDevice.syncEmployeeToIdePanels, context);
            if (!result.ok || !result.queued) failures.push(result.error ?? "IDE kişisi gönderilemedi");
          } else {
            const result = await ctx.runAction(internal.actions.hikvisionSync.syncEmployeeToDevicesInternal, { ...context, allowedProjectIds: [run.projectId] });
            if (result.failed || !result.synced) failures.push(result.errors.join("; ") || "Hik kişisi gönderilemedi");
          }
        } else if (device.brand === "ide_smart") {
          const result = await ctx.runAction(internal.actions.ideGatewayDevice.deleteIdeUserFromPanels, { employeeId, runId: run._id, projectId: run.projectId, deviceIds: [device._id], cardNumber: data.employee.cardNumber });
          if (!result.ok || !result.queued) failures.push("IDE kişisi silinemedi");
        } else {
          const result = await ctx.runAction(internal.actions.hikvisionSync.deleteEmployeeFromDevicesInternal, { ...context, allowedProjectIds: [run.projectId], snapshot: { cardNumber: data.employee.cardNumber, projectId: run.projectId, devices: [{ _id: device._id, name: device.name, projectId: device.projectId, brand: device.brand, hikDevIndex: device.hikDevIndex, hikTransport: device.hikTransport, hikDoorCount: device.hikDoorCount }] } });
          if (result.failed || !result.removed) failures.push(result.errors.join("; ") || "Hik kişisi silinemedi");
        }
      }
    } catch (error) { failures.push(error instanceof Error ? error.message : "Yeniden dağıtım başarısız"); }
    await ctx.runMutation(internal.deviceSyncRuns.finishTarget, { targetId: target._id, failure: failures.length ? failures.join("; ") : undefined, directSent: device.brand === "hikvision" && device.hikTransport !== "localBridge" });
  },
});
