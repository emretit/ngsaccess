import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { internalMutation } from "./_generated/server";
import { authedMutation, authedQuery } from "./lib/customFunctions";
import { getCurrentUser } from "./lib/auth";
import { requirePermission } from "./lib/permissions";
import { resolveProjectScope } from "./lib/projectScope";
import { bounded, employeeGrantGraph, grantRuleScope, grantStale, grantState, upsertGrantStatus } from "./lib/grantStatus";
import { createGrantRun, createRunInTransaction } from "./deviceSyncRuns";

async function authorize(ctx: QueryCtx, projectId: Id<"projects">) {
  const user = await getCurrentUser(ctx);
  await requirePermission(ctx, user, projectId, "accessRules.manage");
  await resolveProjectScope(ctx, projectId);
}

type GrantRow = Omit<Doc<"accessGrantStatus">, "_id" | "_creationTime"> & { _id: Id<"accessGrantStatus"> | null; _creationTime: number };
type ScopeCache = Map<Id<"accessRules">, Promise<Awaited<ReturnType<typeof grantRuleScope>>>>;
async function enrich(ctx: QueryCtx, row: GrantRow, scopes: ScopeCache = new Map()) {
  const [rawEmployee, rawDevice, rawDepartment] = await Promise.all([
    ctx.db.get(row.employeeId), ctx.db.get(row.deviceId), row.departmentId ? ctx.db.get(row.departmentId) : null,
  ]);
  const employee = rawEmployee?.projectId === row.projectId ? rawEmployee : null;
  const device = rawDevice?.projectId === row.projectId ? rawDevice : null;
  const department = rawDepartment?.projectId === row.projectId ? rawDepartment : null;
  const rules = (await Promise.all(row.ruleIds.map(id => ctx.db.get(id))))
    .filter((rule): rule is NonNullable<typeof rule> => rule !== null && rule.projectId === row.projectId);
  const templates = (await Promise.all(rules.map(rule => rule.scheduleTemplateId ? ctx.db.get(rule.scheduleTemplateId) : null)))
    .filter((template): template is NonNullable<typeof template> => template !== null && template.projectId === row.projectId);
  const doors = new Map<Id<"doors">, Doc<"doors">>();
  for (const rule of rules) {
    let scopePromise = scopes.get(rule._id);
    if (!scopePromise) { scopePromise = grantRuleScope(ctx, rule); scopes.set(rule._id, scopePromise); }
    for (const scope of await scopePromise) if (scope.device._id === row.deviceId) for (const door of scope.doors) doors.set(door._id, door);
  }
  return { ...row, employeeName: employee ? `${employee.firstName} ${employee.lastName}` : "Silinmiş kişi",
    departmentName: department?.name ?? null, deviceName: device?.name ?? "Silinmiş cihaz", brand: device?.brand ?? "other",
    doorIds: [...doors.keys()], doorNames: [...doors.values()].map(door => door.name),
    ruleNames: rules.map(rule => rule.name), templateIds: [...new Set(templates.map(template => template._id))],
    templateNames: [...new Map(templates.map(template => [template._id, template.name])).values()],
    stale: grantStale(row.appliedAt, [...rules.map(rule => rule.updatedAt), ...templates.map(template => template.updatedAt)]),
  };
}

export const listByProject = authedQuery({
  args: { projectId: v.id("projects"), state: v.optional(grantState), departmentId: v.optional(v.id("departments")),
    deviceId: v.optional(v.id("devices")), ruleId: v.optional(v.id("accessRules")), templateId: v.optional(v.id("accessScheduleTemplates")),
    search: v.optional(v.string()), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await authorize(ctx, args.projectId);
    if (!Number.isInteger(args.paginationOpts.numItems) || args.paginationOpts.numItems < 1 || args.paginationOpts.numItems > 50) throw new ConvexError("Sayfa en fazla 50 satır olabilir");
    const deviceId = args.deviceId;
    const scopes: ScopeCache = new Map();
    const base = () => args.departmentId
      ? ctx.db.query("accessGrantStatus").withIndex("by_project_department_state", q => args.state ? q.eq("projectId", args.projectId).eq("departmentId", args.departmentId).eq("state", args.state) : q.eq("projectId", args.projectId).eq("departmentId", args.departmentId))
      : deviceId ? ctx.db.query("accessGrantStatus").withIndex("by_project_device", q => q.eq("projectId", args.projectId).eq("deviceId", deviceId))
      : ctx.db.query("accessGrantStatus").withIndex("by_project_state", q => args.state ? q.eq("projectId", args.projectId).eq("state", args.state) : q.eq("projectId", args.projectId));
    const scanRequired = !!(args.ruleId || args.templateId || args.search?.trim() || (args.departmentId && args.deviceId) || (args.deviceId && args.state && !args.departmentId));
    if (!scanRequired) {
      const result = await base().paginate(args.paginationOpts);
      return { ...result, page: await Promise.all(result.page.map(row => enrich(ctx, row, scopes))), boundedScan: false };
    }
    // Non-indexed intersections/search scan the COMPLETE candidate set (max 1000),
    // THEN paginate matches. Never filter only a fetched page or silently truncate.
    const candidates = bounded(await base().take(1001));
    const matched = [];
    const search = args.search?.trim().toLocaleLowerCase("tr");
    for (const row of candidates) {
      if ((args.deviceId !== undefined && row.deviceId !== args.deviceId) || args.state && row.state !== args.state || args.ruleId && !row.ruleIds.includes(args.ruleId)) continue;
      if (args.templateId) {
        const rules = await Promise.all(row.ruleIds.map(id => ctx.db.get(id)));
        if (!rules.some(rule => rule?.projectId === args.projectId && rule.scheduleTemplateId === args.templateId)) continue;
      }
      if (search) {
        const employee = await ctx.db.get(row.employeeId);
        const name = employee?.projectId === row.projectId ? `${employee.firstName} ${employee.lastName}` : "Silinmiş kişi";
        if (!name.toLocaleLowerCase("tr").includes(search)) continue;
      }
      matched.push(row);
    }
    const cursor = args.paginationOpts.cursor;
    if (cursor !== null && !/^grant-scan:\d+$/.test(cursor)) throw new ConvexError("Geçersiz yetki sayfa imleci");
    const offset = cursor ? Number(cursor.slice("grant-scan:".length)) : 0;
    const end = offset + args.paginationOpts.numItems;
    return { page: await Promise.all(matched.slice(offset, end).map(row => enrich(ctx, row, scopes))), isDone: end >= matched.length, continueCursor: `grant-scan:${end}`, boundedScan: true };
  },
});

export const counts = authedQuery({
  args: { projectId: v.id("projects"), departmentId: v.optional(v.id("departments")), deviceId: v.optional(v.id("devices")) },
  handler: async (ctx, args) => {
    await authorize(ctx, args.projectId);
    let capped = false;
    const deviceId = args.deviceId;
    if (deviceId) {
      // Bound reads before applying department/state filters in memory.
      const candidates = await ctx.db.query("accessGrantStatus").withIndex("by_project_device", q => q.eq("projectId", args.projectId).eq("deviceId", deviceId)).take(1001);
      const rows = candidates.slice(0, 1000).filter(row => !args.departmentId || row.departmentId === args.departmentId);
      return { all: rows.length, effective: rows.filter(row => row.state === "effective").length,
        pending: rows.filter(row => row.state === "pending").length, failed: rows.filter(row => row.state === "failed").length,
        removed: rows.filter(row => row.state === "removed").length, unknown: 0, capped: candidates.length > 1000 };
    }
    const count = async (state?: Doc<"accessGrantStatus">["state"]) => {
      const rows = await (args.departmentId
        ? ctx.db.query("accessGrantStatus").withIndex("by_project_department_state", q => state ? q.eq("projectId", args.projectId).eq("departmentId", args.departmentId).eq("state", state) : q.eq("projectId", args.projectId).eq("departmentId", args.departmentId))
        : ctx.db.query("accessGrantStatus").withIndex("by_project_state", q => state ? q.eq("projectId", args.projectId).eq("state", state) : q.eq("projectId", args.projectId))).take(1001);
      if (rows.length > 1000) capped = true;
      return Math.min(rows.length, 1000);
    };
    const all = await count();
    const effective = await count("effective"), pending = await count("pending"), failed = await count("failed"), removed = await count("removed");
    // Graph enumeration has explicit rule/member/pair bounds. Unknown counts are
    // lower bounds when capped, never asserted complete after a truncated scan.
    const rules = await ctx.db.query("accessRules").withIndex("by_project", q => q.eq("projectId", args.projectId)).take(101);
    if (rules.length > 100) capped = true;
    const seen = new Set<string>();
    let unknown = 0;
    let examinedMembers = 0;
    outer: for (const rule of rules.slice(0, 100)) {
      if (!rule.isActive) continue;
      const members = await ctx.db.query("groupMembers").withIndex("by_project_group", q => q.eq("projectId", args.projectId).eq("groupId", rule._id)).take(1001);
      if (members.length > 1000) capped = true;
      let scopes: Awaited<ReturnType<typeof grantRuleScope>>;
      try { scopes = await grantRuleScope(ctx, rule); } catch (error) {
        if (!(error instanceof ConvexError)) throw error;
        capped = true; continue;
      }
      for (const member of members.slice(0, 1000)) {
        if (++examinedMembers > 1000) { capped = true; break outer; }
        const employee = await ctx.db.get(member.employeeId);
        if (!employee || employee.projectId !== args.projectId || employee.isActive === false || args.departmentId && employee.departmentId !== args.departmentId) continue;
        for (const scope of scopes) {
          const key = `${employee._id}:${scope.device._id}`;
          if (seen.has(key)) continue;
          if (seen.size >= 1000) { capped = true; break outer; }
          seen.add(key);
          const row = await ctx.db.query("accessGrantStatus").withIndex("by_employee_device", q => q.eq("employeeId", employee._id).eq("deviceId", scope.device._id)).unique();
          if (!row) unknown++;
        }
      }
    }
    return { all: Math.min(1000, all + unknown), effective, pending, failed, removed, unknown, capped: capped || all + unknown > 1000 };
  },
});

export const byEmployee = authedQuery({
  args: { employeeId: v.id("employees") },
  handler: async (ctx, args) => {
    const employee = await ctx.db.get(args.employeeId);
    if (!employee?.projectId) throw new ConvexError("Çalışan veya projesi bulunamadı");
    const projectId = employee.projectId;
    await requirePermission(ctx, ctx.user, projectId, "accessRules.manage");
    await resolveProjectScope(ctx, projectId);
    const graph = await employeeGrantGraph(ctx, employee);
    const stored = bounded(await ctx.db.query("accessGrantStatus").withIndex("by_project_employee", q => q.eq("projectId", projectId).eq("employeeId", args.employeeId)).take(201), 200);
    const rows = [];
    const scopes: ScopeCache = new Map();
    for (const row of stored) rows.push({ ...await enrich(ctx, row, scopes), authorized: graph.has(row.deviceId), removalRequired: !graph.has(row.deviceId) && row.state !== "removed" });
    for (const [deviceId, scope] of graph) {
      if (stored.some(row => row.deviceId === deviceId)) continue;
      const synthetic = await enrich(ctx, { _id: null, _creationTime: 0, projectId, employeeId: employee._id, deviceId,
        departmentId: employee.departmentId, state: "pending", ruleIds: scope.ruleIds, updatedAt: 0 }, scopes);
      rows.push({ ...synthetic, _id: null, state: "unknown" as const, authorized: true, removalRequired: false });
    }
    const allowedDoors = new Set([...graph.values()].flatMap(scope => scope.doors.map(door => door._id)));
    const doors = bounded(await ctx.db.query("doors").withIndex("by_project", q => q.eq("projectId", projectId)).take(1001));
    return { rows, unauthorizedDoors: doors.filter(door => door.deviceId && !allowedDoors.has(door._id)).map(door => ({ doorId: door._id, doorName: door.name, deviceId: door.deviceId ?? null, state: "unauthorized" as const })) };
  },
});

export const recordGrantResults = internalMutation({
  args: { results: v.array(v.object({ projectId: v.id("projects"), employeeId: v.id("employees"), deviceId: v.id("devices"), state: grantState,
    ruleIds: v.optional(v.array(v.id("accessRules"))), lastError: v.optional(v.string()), lastRunId: v.optional(v.id("deviceSyncRuns")) })) },
  handler: async (ctx, args) => {
    if (args.results.length > 1000) throw new ConvexError("Toplu yetki sonucu sınırı aşıldı (1000)");
    for (const result of args.results) await upsertGrantStatus(ctx, result);
  },
});

export const redistribute = authedMutation({
  args: { projectId: v.id("projects"), pairs: v.optional(v.array(v.object({ employeeId: v.id("employees"), deviceId: v.id("devices") }))), onlyFailed: v.optional(v.boolean()) },
  handler: async (ctx, args): Promise<{ runId: Id<"deviceSyncRuns">; pairCount?: number; remainingFailed: number; remainingCapped: boolean }> => {
    const permission = args.pairs !== undefined || args.onlyFailed ? "accessRules.manage" : "devices.manage";
    await requirePermission(ctx, ctx.user, args.projectId, permission);
    await resolveProjectScope(ctx, args.projectId);
    if (args.pairs && args.pairs.length > 100) throw new ConvexError("En fazla 100 kişi×cihaz yeniden dağıtılabilir");
    if (args.pairs && args.onlyFailed) throw new ConvexError("Seçili çiftler ile yalnız hatalılar birlikte kullanılamaz");
    let pairs = args.pairs;
    let remainingFailed = 0;
    let remainingCapped = false;
    if (args.onlyFailed) {
      const failed = await ctx.db.query("accessGrantStatus").withIndex("by_project_state", q => q.eq("projectId", args.projectId).eq("state", "failed")).take(101);
      // Coordinator-approved order: first 100 in index (_creationTime) order,
      // not global updatedAt order; the 101st row proves a remaining lower bound.
      remainingFailed = Math.max(0, failed.length - 100);
      remainingCapped = failed.length > 100;
      pairs = failed.slice(0, 100).map(row => ({ employeeId: row.employeeId, deviceId: row.deviceId }));
    }
    const pairCount = pairs ? new Set(pairs.map(pair => `${pair.employeeId}:${pair.deviceId}`)).size : undefined;
    return { pairCount, remainingFailed, remainingCapped, runId: pairs ? await createGrantRun(ctx, { projectId: args.projectId, pairs, startedBy: ctx.user._id }) : await createRunInTransaction(ctx, { projectId: args.projectId }, "devices.manage") };
  },
});
