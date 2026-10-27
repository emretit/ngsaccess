import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { internalMutation } from "./_generated/server";
import { authedMutation, authedQuery } from "./lib/customFunctions";
import { getCurrentUser } from "./lib/auth";
import { requirePermission } from "./lib/permissions";
import { resolveProjectScope } from "./lib/projectScope";
import { bounded, departmentGrantCandidates, grantEmployees, employeeGrantGraph, grantRuleScope, grantStale, grantState, upsertGrantStatus } from "./lib/grantStatus";
import { createGrantRun, createRunInTransaction } from "./deviceSyncRuns";

async function authorize(ctx: QueryCtx, projectId: Id<"projects">) {
  const user = await getCurrentUser(ctx);
  await requirePermission(ctx, user, projectId, "accessRules.manage");
  await resolveProjectScope(ctx, projectId);
}

type GrantRow = Omit<Doc<"accessGrantStatus">, "_id" | "_creationTime"> & { _id: Id<"accessGrantStatus"> | null; _creationTime: number };
type ScopeCache = Map<Id<"accessRules">, Promise<Awaited<ReturnType<typeof grantRuleScope>>>>;
async function enrich(ctx: QueryCtx, row: GrantRow, scopes: ScopeCache = new Map(), employees?: Awaited<ReturnType<typeof grantEmployees>>) {
  const [rawEmployee, rawDevice] = await Promise.all([
    employees ? employees.get(row.employeeId) : ctx.db.get(row.employeeId), ctx.db.get(row.deviceId),
  ]);
  const rawDepartment = rawEmployee?.projectId === row.projectId && rawEmployee.departmentId ? await ctx.db.get(rawEmployee.departmentId) : null;
  const employee = rawEmployee?.projectId === row.projectId ? rawEmployee : null;
  const device = rawDevice?.projectId === row.projectId ? rawDevice : null;
  const department = rawDepartment?.projectId === row.projectId ? rawDepartment : null;
  const rules = (await Promise.all(row.ruleIds.map(id => ctx.db.get(id))))
    .filter((rule): rule is NonNullable<typeof rule> => rule !== null && rule.projectId === row.projectId);
  const doors = new Map<Id<"doors">, Doc<"doors">>();
  let unresolvedDoor = false;
  for (const rule of rules) {
    let scopePromise = scopes.get(rule._id);
    if (!scopePromise) { scopePromise = grantRuleScope(ctx, rule); scopes.set(rule._id, scopePromise); }
    for (const scope of await scopePromise) if (scope.device._id === row.deviceId) {
      if (scope.errorCode === "door_io_unresolved") unresolvedDoor = true;
      for (const door of scope.doors) doors.set(door._id, door);
    }
  }
  const currentDepartment: { departmentId?: Id<"departments"> } = { departmentId: employee?.departmentId };
  return { ...row, ...currentDepartment, employeeName: employee ? `${employee.firstName} ${employee.lastName}` : "Silinmiş kişi",
    departmentName: department?.name ?? null, deviceName: device?.name ?? "Silinmiş cihaz", brand: device?.brand ?? "other",
    doorIds: [...doors.keys()], doorNames: [...doors.values()].map(door => door.name),
    ruleNames: rules.map(rule => rule.name),
    stale: grantStale(row.appliedAt, rules.map(rule => rule.updatedAt)),
    doorUnresolved: unresolvedDoor,
  };
}

type DepartmentEmployees = Awaited<ReturnType<typeof departmentGrantCandidates>>["employees"];
type UnknownPair = { employee: Doc<"employees">; deviceId: Id<"devices">; ruleIds: Id<"accessRules">[] };
// Rule-graph person×device pairs without a stored grant row ("Bilinmiyor"). Graph
// enumeration has explicit rule/member/pair bounds; capped results are lower bounds.
async function unknownGrantPairs(ctx: QueryCtx, projectId: Id<"projects">, departmentEmployees?: DepartmentEmployees, ruleId?: Id<"accessRules">) {
  const people = new Set<Id<"employees">>();
  const unknown = new Map<string, UnknownPair>();
  let capped = false;
  const visit = async (employee: Doc<"employees">, deviceId: Id<"devices">, ruleIds: Id<"accessRules">[]) => {
    const row = await ctx.db.query("accessGrantStatus").withIndex("by_employee_device", q => q.eq("employeeId", employee._id).eq("deviceId", deviceId)).unique();
    if (!row) unknown.set(`${employee._id}:${deviceId}`, { employee, deviceId, ruleIds });
    people.add(employee._id);
  };
  if (departmentEmployees) {
    let examinedPairs = 0;
    department: for (const employee of departmentEmployees.values()) {
      if (employee.isActive === false) continue;
      let graph: Awaited<ReturnType<typeof employeeGrantGraph>>;
      try { graph = await employeeGrantGraph(ctx, employee); } catch (error) {
        if (!(error instanceof ConvexError)) throw error;
        capped = true; continue;
      }
      for (const [deviceId, scope] of graph) {
        if (++examinedPairs > 1000) { capped = true; break department; }
        await visit(employee, deviceId, scope.ruleIds);
      }
    }
    return { pairs: [...unknown.values()], people, capped };
  }
  // A rule filter spends the whole member/pair budget on that rule only.
  const onlyRule = ruleId ? await ctx.db.get(ruleId) : null;
  const rules = ruleId ? (onlyRule?.projectId === projectId ? [onlyRule] : [])
    : await ctx.db.query("accessRules").withIndex("by_project", q => q.eq("projectId", projectId)).take(101);
  if (rules.length > 100) capped = true;
  const seen = new Set<string>();
  let examinedMembers = 0;
  outer: for (const rule of rules.slice(0, 100)) {
    if (!rule.isActive) continue;
    const members = await ctx.db.query("groupMembers").withIndex("by_project_group", q => q.eq("projectId", projectId).eq("groupId", rule._id)).take(1001);
    if (members.length > 1000) capped = true;
    let scopes: Awaited<ReturnType<typeof grantRuleScope>>;
    try { scopes = await grantRuleScope(ctx, rule); } catch (error) {
      if (!(error instanceof ConvexError)) throw error;
      capped = true; continue;
    }
    for (const member of members.slice(0, 1000)) {
      if (++examinedMembers > 1000) { capped = true; break outer; }
      const employee = await ctx.db.get(member.employeeId);
      if (!employee || employee.projectId !== projectId || employee.isActive === false) continue;
      for (const scope of scopes) {
        const key = `${employee._id}:${scope.device._id}`;
        if (seen.has(key)) { unknown.get(key)?.ruleIds.push(rule._id); continue; }
        if (seen.size >= 1000) { capped = true; break outer; }
        seen.add(key);
        await visit(employee, scope.device._id, [rule._id]);
      }
    }
  }
  return { pairs: [...unknown.values()], people, capped };
}

const SCAN_CURSOR = /^grant-scan:\d+$/;
// Scan paging: matches are collected completely (bounded), then sliced by an offset cursor.
function scanWindow<T>(matched: T[], { cursor, numItems }: { cursor: string | null; numItems: number }) {
  if (cursor !== null && !SCAN_CURSOR.test(cursor)) throw new ConvexError("Geçersiz yetki sayfa imleci");
  const offset = cursor ? Number(cursor.slice("grant-scan:".length)) : 0;
  const end = offset + numItems;
  return { rows: matched.slice(offset, end), isDone: end >= matched.length, continueCursor: `grant-scan:${end}` };
}

export const listByProject = authedQuery({
  args: { projectId: v.id("projects"), state: v.optional(v.union(grantState, v.literal("unknown"))), departmentId: v.optional(v.id("departments")),
    deviceId: v.optional(v.id("devices")), ruleId: v.optional(v.id("accessRules")),
    search: v.optional(v.string()), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await authorize(ctx, args.projectId);
    if (!Number.isInteger(args.paginationOpts.numItems) || args.paginationOpts.numItems < 1 || args.paginationOpts.numItems > 50) throw new ConvexError("Sayfa en fazla 50 satır olabilir");
    const deviceId = args.deviceId;
    const scopes: ScopeCache = new Map();
    const search = args.search?.trim().toLocaleLowerCase("tr");
    // A department filter always takes a scan path (never the indexed fast path below).
    const department = args.departmentId
      ? await departmentGrantCandidates(ctx, args.projectId, args.departmentId, deviceId) : undefined;
    if (department?.capped) throw new ConvexError("Departman yetki okuma sınırı aşıldı (1000); departman ve cihaz seçerek kapsamı daraltın");
    if (args.state === "unknown") {
      // Unknown pairs have no stored row: enumerate the bounded rule graph, filter, then page.
      const { pairs, capped } = await unknownGrantPairs(ctx, args.projectId, department?.employees, args.ruleId);
      // Like the stored scan path: never page a truncated graph as if it were complete.
      if (capped) throw new ConvexError("Bilinmiyor taraması sınırı aşıldı (1000); departman veya kural seçerek kapsamı daraltın");
      const matched = pairs.filter(pair => (!deviceId || pair.deviceId === deviceId) && (!args.ruleId || pair.ruleIds.includes(args.ruleId))
        && (!search || `${pair.employee.firstName} ${pair.employee.lastName}`.toLocaleLowerCase("tr").includes(search)));
      const { rows, ...paging } = scanWindow(matched, args.paginationOpts);
      const page = await Promise.all(rows.map(async pair => ({
        ...await enrich(ctx, { _id: null, _creationTime: 0, projectId: args.projectId, employeeId: pair.employee._id, deviceId: pair.deviceId,
          departmentId: pair.employee.departmentId, state: "pending", ruleIds: pair.ruleIds, updatedAt: 0 }, scopes, new Map([[pair.employee._id, pair.employee]])),
        state: "unknown" as const,
      })));
      return { page, ...paging, boundedScan: true };
    }
    const state = args.state;
    const base = () => deviceId
      ? ctx.db.query("accessGrantStatus").withIndex("by_project_device", q => q.eq("projectId", args.projectId).eq("deviceId", deviceId))
      : ctx.db.query("accessGrantStatus").withIndex("by_project_state", q => state ? q.eq("projectId", args.projectId).eq("state", state) : q.eq("projectId", args.projectId));
    const scanRequired = !!(args.departmentId || args.ruleId || search || (args.deviceId && state));
    if (!scanRequired) {
      const result = await base().paginate(args.paginationOpts);
      const employees = await grantEmployees(ctx, result.page);
      return { ...result, page: await Promise.all(result.page.map(row => enrich(ctx, row, scopes, employees))), boundedScan: false };
    }
    // Non-indexed intersections/search scan the COMPLETE candidate set (max 1000),
    // THEN paginate matches. Never filter only a fetched page or silently truncate.
    const candidates = department?.rows ?? bounded(await base().take(1001));
    const employees = department?.employees ?? await grantEmployees(ctx, candidates);
    const matched = [];
    for (const row of candidates) {
      const employee = employees.get(row.employeeId);
      if (args.departmentId && (employee?.projectId !== args.projectId || employee.departmentId !== args.departmentId)) continue;
      if ((args.deviceId !== undefined && row.deviceId !== args.deviceId) || state && row.state !== state || args.ruleId && !row.ruleIds.includes(args.ruleId)) continue;
      if (search) {
        const name = employee?.projectId === row.projectId ? `${employee.firstName} ${employee.lastName}` : "Silinmiş kişi";
        if (!name.toLocaleLowerCase("tr").includes(search)) continue;
      }
      matched.push(row);
    }
    const { rows, ...paging } = scanWindow(matched, args.paginationOpts);
    return { page: await Promise.all(rows.map(row => enrich(ctx, row, scopes, employees))), ...paging, boundedScan: true };
  },
});

export const counts = authedQuery({
  args: { projectId: v.id("projects"), departmentId: v.optional(v.id("departments")), deviceId: v.optional(v.id("devices")) },
  handler: async (ctx, args) => {
    await authorize(ctx, args.projectId);
    let capped = false;
    const deviceId = args.deviceId;
    let departmentRows: Doc<"accessGrantStatus">[] | undefined;
    let departmentEmployees: Awaited<ReturnType<typeof departmentGrantCandidates>>["employees"] | undefined;
    if (args.departmentId) {
      const department = await departmentGrantCandidates(ctx, args.projectId, args.departmentId, deviceId);
      departmentRows = department.rows;
      departmentEmployees = department.employees;
      capped = department.capped;
    } else if (deviceId) {
      const candidates = await ctx.db.query("accessGrantStatus").withIndex("by_project_device", q => q.eq("projectId", args.projectId).eq("deviceId", deviceId)).take(1001);
      departmentRows = candidates.slice(0, 1000);
      capped = candidates.length > 1000;
    }
    const people = new Set<Id<"employees">>(departmentRows?.map(row => row.employeeId));
    if (deviceId && departmentRows) return { personCount: people.size, all: departmentRows.length, effective: departmentRows.filter(row => row.state === "effective").length,
      pending: departmentRows.filter(row => row.state === "pending").length, failed: departmentRows.filter(row => row.state === "failed").length,
      removed: departmentRows.filter(row => row.state === "removed").length, unknown: 0, capped };
    const count = async (state?: Doc<"accessGrantStatus">["state"]) => {
      if (departmentRows) return departmentRows.filter(row => !state || row.state === state).length;
      const rows = await ctx.db.query("accessGrantStatus").withIndex("by_project_state", q => state ? q.eq("projectId", args.projectId).eq("state", state) : q.eq("projectId", args.projectId)).take(1001);
      if (rows.length > 1000) capped = true;
      if (!state) for (const row of rows.slice(0, 1000)) people.add(row.employeeId);
      return Math.min(rows.length, 1000);
    };
    const all = await count();
    const effective = await count("effective"), pending = await count("pending"), failed = await count("failed"), removed = await count("removed");
    const graph = await unknownGrantPairs(ctx, args.projectId, departmentEmployees);
    for (const id of graph.people) people.add(id);
    const unknown = graph.pairs.length;
    capped ||= graph.capped;
    return { personCount: people.size, all: Math.min(1000, all + unknown), effective, pending, failed, removed, unknown, capped: capped || all + unknown > 1000 };
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
    const employees = new Map([[employee._id, employee]]);
    for (const row of stored) rows.push({ ...await enrich(ctx, row, scopes, employees), authorized: graph.has(row.deviceId), removalRequired: !graph.has(row.deviceId) && row.state !== "removed" });
    for (const [deviceId, scope] of graph) {
      if (stored.some(row => row.deviceId === deviceId)) continue;
      const synthetic = await enrich(ctx, { _id: null, _creationTime: 0, projectId, employeeId: employee._id, deviceId,
        departmentId: employee.departmentId, state: "pending", ruleIds: scope.ruleIds, updatedAt: 0 }, scopes, employees);
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
