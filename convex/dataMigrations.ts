import { Migrations } from "@convex-dev/migrations";
import type { DataModel, Id } from "./_generated/dataModel";
import { components } from "./_generated/api";
import { seedDepartmentHistory } from "./lib/employeeDepartmentHistory";
import { employeeAuditValues } from "./lib/auditPrivacy";
import { auditSearchText } from "./lib/auditSearch";
import { internalMutation, internalQuery, type QueryCtx, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { initializeHeartbeatMonitoring } from "./lib/deviceConnection";

import { LEGACY_PDKS_POLICY } from "./lib/pdksRules";
import { writePdksRuleVersion } from "./lib/pdksRuleWrite";

const migrations = new Migrations<DataModel>(components.migrations);

export const previewEmployeeDepartments = internalQuery({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  handler: async (ctx, args) => {
    const page = await ctx.db.query("employees").paginate({ numItems: 100, cursor: args.cursor ?? null });
    let missing = 0;
    for (const employee of page.page) {
      if (!employee.projectId || employee.isVisitor) continue;
      const [history] = await ctx.db.query("employeeDepartmentHistory").withIndex("by_employee_validFrom", q => q.eq("employeeId", employee._id)).take(1);
      if (!history) missing++;
    }
    return { scanned: page.page.length, missing, isDone: page.isDone, continueCursor: page.continueCursor };
  },
});

/** Read-only dry run for audit cleanup: never print the old personal data in component logs. */
export const previewEmployeeAuditMinimization = internalQuery({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  handler: async (ctx, args) => {
    const page = await ctx.db.query("auditLog").paginate({ numItems: 100, cursor: args.cursor ?? null });
    let affected = 0;
    for (const row of page.page) if (row.targetTable === "employees") {
      const values = employeeAuditValues(row.oldValue, row.newValue, row.action);
      if (JSON.stringify(values.oldValue) !== JSON.stringify(row.oldValue) || JSON.stringify(values.newValue) !== JSON.stringify(row.newValue)) affected++;
    }
    return { scanned: page.page.length, affected, isDone: page.isDone, continueCursor: page.continueCursor };
  },
});

/** Explicit dryRun first. Baselines preserve the legacy fallback, never infer old moves. */
export const backfillEmployeeDepartments = migrations.define({
  table: "employees",
  migrateOne: async (ctx, employee) => { await seedDepartmentHistory(ctx, employee); },
});

export const removeShiftColors = migrations.define({
  table: "shifts",
  migrateOne: (_ctx, shift) => shift.color === undefined ? undefined : { color: undefined },
});

export const initializeDeviceHeartbeatChecks = migrations.define({
  table: "devices",
  migrateOne: async (ctx, device) => { await initializeHeartbeatMonitoring(ctx, device); },
});

export const minimizeEmployeeAudit = migrations.define({
  table: "auditLog",
  migrateOne: async (ctx, row) => {
    if (row.targetTable !== "employees") return;
    const values = employeeAuditValues(row.oldValue, row.newValue, row.action);
    const employeeId = ctx.db.normalizeId("employees", row.targetId);
    const removed = employeeId !== null && !(await ctx.db.get(employeeId));
    return { ...values, ...(removed ? { note: "Kişi kaydı silindi; geçmiş kişisel veri kopyası kaldırıldı" } : {}),
      searchText: auditSearchText({ ...row, ...values }) };
  },
});


// Intentionally fixed: running this tool later must never move the historical boundary.
const PDKS_REQUIREMENTS_EFFECTIVE_FROM = "2026-11-18";

async function pdksRequirementsSwitchState(ctx: QueryCtx | MutationCtx, projectId: Id<"projects">) {
  const [sourceVersion, atSwitchDate, futureVersions] = await Promise.all([
    ctx.db.query("pdksRuleVersions").withIndex("by_projectId_and_effectiveFrom", q => q.eq("projectId", projectId).lte("effectiveFrom", PDKS_REQUIREMENTS_EFFECTIVE_FROM)).order("desc").first(),
    ctx.db.query("pdksRuleVersions").withIndex("by_projectId_and_effectiveFrom", q => q.eq("projectId", projectId).eq("effectiveFrom", PDKS_REQUIREMENTS_EFFECTIVE_FROM)).first(),
    ctx.db.query("pdksRuleVersions").withIndex("by_projectId_and_effectiveFrom", q => q.eq("projectId", projectId).gt("effectiveFrom", PDKS_REQUIREMENTS_EFFECTIVE_FROM)).take(65),
  ]);
  if (futureVersions.length > 64) throw new Error("64’ten fazla gelecek PDKS sürümü var; migration öncesi sürümleri inceleyin");
  const skipReason = atSwitchDate ? "versionAtSwitchDate" : sourceVersion?.punchMode === "requirements" ? "alreadyRequirements" : null;
  return { sourceVersion, futureVersions, skipReason };
}

/** Read-only, paginated inventory. Follow continueCursor until isDone before approval. */
export const previewPdksRequirementsSwitch = internalQuery({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  handler: async (ctx, args) => {
    const page = await ctx.db.query("projects").paginate({ numItems: 10, cursor: args.cursor ?? null });
    const projects = await Promise.all(page.page.map(async project => ({
      projectId: project._id, projectName: project.name,
      ...await pdksRequirementsSwitchState(ctx, project._id),
    })));
    return { effectiveFrom: PDKS_REQUIREMENTS_EFFECTIVE_FROM, projects, isDone: page.isDone, continueCursor: page.continueCursor };
  },
});

/** Manual-only migration: preview first; no scheduler, deployment or automatic runner.
 * Each page commits atomically and may safely be replayed with the same cursor.
 * Copy the policy effective on the boundary; normalize only later legacy policies.
 * An existing boundary version is never replaced, even if it is legacy. */
export const switchProjectsToRequirements = internalMutation({
  args: { actorUserId: v.id("users"), cursor: v.optional(v.union(v.string(), v.null())) },
  handler: async (ctx, args) => {
    if (!await ctx.db.get(args.actorUserId)) throw new Error("Migration kullanıcısı bulunamadı");
    const page = await ctx.db.query("projects").paginate({ numItems: 10, cursor: args.cursor ?? null });
    const created = [];
    const skipped = [];
    const updated = [];
    const requirements = {
      punchMode: "requirements" as const, requireCheckIn: true, requireCheckOut: true,
      missingRequiredPunch: "review" as const, noPunch: "review" as const,
    };
    for (const project of page.page) {
      const { sourceVersion, futureVersions, skipReason } = await pdksRequirementsSwitchState(ctx, project._id);
      // Patch only requirement fields: addresses, settings and creation metadata stay intact.
      // This also applies when no new boundary version is needed for this project.
      for (const version of futureVersions) {
        if (version.punchMode !== "legacy") continue;
        await ctx.db.patch(version._id, requirements);
        updated.push({ projectId: project._id, ruleVersionId: version._id });
      }
      if (skipReason) { skipped.push({ projectId: project._id, reason: skipReason }); continue; }
      const targets = sourceVersion ? await ctx.db.query("pdksCheckpointSelections")
        .withIndex("by_ruleVersionId", q => q.eq("ruleVersionId", sourceVersion._id)).take(501) : [];
      if (targets.length > 500) throw new Error("PDKS kural sürümü en fazla 500 hedef içerebilir");
      // Copy stored snapshots verbatim: never resolve them from today's devices/readers.
      const snapshots = targets.map(({ _id, _creationTime, projectId, ruleVersionId, ...snapshot }) => snapshot);
      const fields = sourceVersion ? (({ _id, _creationTime, ...value }) => value)(sourceVersion)
        : { projectId: project._id, checkpointMode: LEGACY_PDKS_POLICY.checkpointMode };
      const ruleVersionId = await writePdksRuleVersion(ctx, {
        ...fields, effectiveFrom: PDKS_REQUIREMENTS_EFFECTIVE_FROM,
        ...requirements,
        createdAt: new Date().toISOString(), createdBy: args.actorUserId,
      }, snapshots);
      created.push({ projectId: project._id, ruleVersionId });
    }
    return { effectiveFrom: PDKS_REQUIREMENTS_EFFECTIVE_FROM, created, skipped, updated, isDone: page.isDone, continueCursor: page.continueCursor };
  },
});
