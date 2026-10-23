import { departmentChain } from "./lib/shiftResolver";
import { shiftPlanValidator, planShiftIds } from "./lib/shiftPlan";
import { requirePermission } from "./lib/permissions";
import { writeAudit } from "./lib/audit";
import { assertPeopleProject } from "./lib/peopleScope";
import { resolveProjectScope } from "./lib/projectScope";
import { toPatch } from "./lib/nullablePatch";
import { shiftColorValidator } from "./lib/shiftColors";
import { validateShift, type ScheduleRange } from "./lib/shiftUx";
import { trDateKey } from "./lib/trDate";
import {
  ASSIGNMENT_SCAN_LIMIT, BULK_ASSIGN_LIMIT, assignmentIntersectsRange, normalizeAssignmentPlan, syncPlanRefs,
  evaluateShiftAssignment, shiftDateOffset, validateAssignRange,
  type AssignmentDecision, type ExistingShiftAssignment,
} from "./lib/shiftAssign";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

import { ConvexError, v } from "convex/values";
import { authedQuery, authedMutation } from "./lib/customFunctions";
import { getProjectIdsForUser, requireEmployeeAccess } from "./lib/auth";

type ReadCtx = QueryCtx | MutationCtx;
interface AssignmentReadState {
  remaining: number;
  shifts: Map<Id<"shifts">, Doc<"shifts"> | null>;
  holidays: Map<string, Doc<"holidays">[]>;
}
function newReadState(): AssignmentReadState {
  return { remaining: ASSIGNMENT_SCAN_LIMIT, shifts: new Map(), holidays: new Map() };
}
function scanError(): never {
  throw new ConvexError("Atama kontrolü 5000 kayıt okuma sınırını aşıyor. Daha az çalışan veya daha dar bir tarih aralığı seçin.");
}
function consumeRows<T>(rows: T[], state: AssignmentReadState): T[] {
  state.remaining -= rows.length;
  if (state.remaining < 0) scanError();
  return rows;
}
async function readShift(ctx: ReadCtx, id: Id<"shifts">, state: AssignmentReadState): Promise<Doc<"shifts"> | null> {
  if (state.shifts.has(id)) return state.shifts.get(id) ?? null;
  if (--state.remaining < 0) scanError();
  const shift = await ctx.db.get(id);
  state.shifts.set(id, shift);
  return shift;
}
async function assignmentDecision(ctx: ReadCtx, employee: Doc<"employees">, shift: Doc<"shifts">, range: ScheduleRange,
  state: AssignmentReadState, forceConfirm = false, calendarConfirmed = false, excludeId?: string): Promise<AssignmentDecision> {
  for (const id of planShiftIds(range.plan)) await readShift(ctx, id, state);
  const leaves = consumeRows(await ctx.db.query("leaves")
    .withIndex("by_employee", q => q.eq("employeeId", employee._id)).take(state.remaining + 1), state);
  const holidayKey = String(employee.projectId);
  let holidays = state.holidays.get(holidayKey);
  if (!holidays) {
    holidays = [];
    const scopes = employee.projectId ? [employee.projectId, undefined] : [undefined];
    for (const projectId of scopes) {
      holidays.push(...consumeRows(await ctx.db.query("holidays").withIndex("by_project_date", q =>
        q.eq("projectId", projectId).gte("date", range.startDate).lte("date", shiftDateOffset(range.endDate, 1)),
      ).take(state.remaining + 1), state));
    }
    state.holidays.set(holidayKey, holidays);
  }
  const assignments = consumeRows(await ctx.db.query("shiftAssignments").withIndex("by_employee_end", q =>
    q.eq("employeeId", employee._id).gte("endDate", shiftDateOffset(range.startDate, -1)),
  ).take(state.remaining + 1), state);
  const existing: ExistingShiftAssignment[] = [];
  for (const item of assignments) {
    if (item._id === excludeId || item.startDate > shiftDateOffset(range.endDate, 1)) continue;
    if (!item.projectId) return { status: "skipped", reason: "Eski kayıt proje bilgisi içermiyor", occurrenceCount: 0, conflict: null, leave: null, holiday: null };
    const other = await readShift(ctx, item.shiftId, state);
    if (!other || other.projectId !== employee.projectId || item.projectId !== employee.projectId) {
      throw new ConvexError("Mevcut atamanın vardiya/proje bilgisi doğrulanamadı");
    }
    for (const id of planShiftIds(item.plan)) {
      const plannedShift = await readShift(ctx, id, state);
      if (!plannedShift || plannedShift.projectId !== employee.projectId) throw new ConvexError("Mevcut planın vardiya/proje bilgisi doğrulanamadı");
    }
    existing.push({ plan: item.plan, assignmentId: item._id, shiftId: item.shiftId, shiftName: other.name,
      startDate: item.startDate, endDate: item.endDate,
      ...(item.weekPattern === undefined ? {} : { weekPattern: item.weekPattern }), shift: other });
  }
  return evaluateShiftAssignment({ range, shift, existing, leaves, holidays, forceConfirm, calendarConfirmed,
    shifts: new Map([...state.shifts].filter((entry): entry is [Id<"shifts">, Doc<"shifts">] => entry[1] !== null)) });
}
async function validateAssignment(ctx: MutationCtx, employee: Doc<"employees">, shift: Doc<"shifts">, range: ScheduleRange, force = false, excludeId?: string, calendarConfirmed = false) {
  validateAssignRange(range);
  assertPeopleProject(employee.projectId, shift.projectId, "Çalışan ve vardiya");
  const decision = await assignmentDecision(ctx, employee, shift, range, newReadState(), force, calendarConfirmed, excludeId);
  if (decision.status === "on_leave" || decision.status === "holiday") {
    throw new ConvexError({ code: "SHIFT_CALENDAR_CONFLICT", message: `CALENDAR: ${decision.reason}. İzin/tatil günlerinde atama için açık onay verin.`, status: decision.status });
  }
  if (decision.status === "conflict") throw new ConvexError({ code: "SHIFT_OVERLAP", message: decision.reason });
  if (decision.status !== "will_assign") throw new Error(decision.reason);
}

export const listAssignments = authedQuery({
  args: {
    projectId: v.optional(v.id("projects")),
    employeeId: v.optional(v.id("employees")),
    shiftId: v.optional(v.id("shifts")),
    rangeStart: v.optional(v.string()),
    rangeEnd: v.optional(v.string()),
    employeeIds: v.optional(v.array(v.id("employees"))),
    includePlans: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const projectIds = await resolveProjectScope(ctx, args.projectId);
    if (args.employeeIds && args.employeeIds.length > BULK_ASSIGN_LIMIT) throw new ConvexError("En fazla 100 çalışan seçin");
    if ((args.rangeStart === undefined) !== (args.rangeEnd === undefined)) throw new ConvexError("Görünür aralığın başlangıç ve bitişini birlikte verin");
    const matches = (item: Doc<"shiftAssignments">) =>
      (args.includePlans || item.plan === undefined) &&
      (!args.employeeId || item.employeeId === args.employeeId) &&
      (!args.employeeIds || args.employeeIds.includes(item.employeeId)) &&
      (!args.shiftId || item.shiftId === args.shiftId || planShiftIds(item.plan).includes(args.shiftId));
    if (args.rangeStart === undefined || args.rangeEnd === undefined) {
      // Compatibility: callers without a range still receive their full project series.
      const results = await Promise.all(projectIds.map(projectId => ctx.db.query("shiftAssignments")
        .withIndex("by_project", q => q.eq("projectId", projectId)).collect()));
      return results.flat().filter(matches);
    }
    validateAssignRange({ startDate: args.rangeStart, endDate: args.rangeEnd });
    const { rangeStart, rangeEnd } = args;
    const state = newReadState();
    const candidates: Doc<"shiftAssignments">[] = [];
    if (args.employeeIds !== undefined || args.employeeId !== undefined) {
      const employeeIds = args.employeeIds ?? (args.employeeId ? [args.employeeId] : []);
      for (const id of new Set(employeeIds)) {
        const employee = await ctx.db.get(id);
        if (!employee?.projectId || !projectIds.includes(employee.projectId)) throw new ConvexError("Bu çalışana erişim yetkiniz yok");
        const rows = consumeRows(await ctx.db.query("shiftAssignments").withIndex("by_employee_end", q =>
          q.eq("employeeId", id).gte("endDate", shiftDateOffset(rangeStart, -1)),
        ).take(state.remaining + 1), state);
        candidates.push(...rows.filter(item => item.projectId !== undefined && projectIds.includes(item.projectId)));
      }
    } else {
      for (const projectId of projectIds) {
        candidates.push(...consumeRows(await ctx.db.query("shiftAssignments").withIndex("by_project_end", q =>
          q.eq("projectId", projectId).gte("endDate", shiftDateOffset(rangeStart, -1)),
        ).take(state.remaining + 1), state));
      }
    }
    const result: Doc<"shiftAssignments">[] = [];
    for (const item of candidates) {
      if (!matches(item) || item.startDate > rangeEnd) continue;
      const shift = await readShift(ctx, item.shiftId, state);
      if (!shift || shift.projectId !== item.projectId) throw new ConvexError("Atamanın vardiya bilgisi doğrulanamadı");
      for (const id of planShiftIds(item.plan)) {
        const plannedShift = await readShift(ctx, id, state);
        if (!plannedShift || plannedShift.projectId !== item.projectId) throw new ConvexError("Planın vardiya bilgisi doğrulanamadı");
      }
      const shifts = new Map([...state.shifts].filter((entry): entry is [Id<"shifts">, Doc<"shifts">] => entry[1] !== null));
      if (assignmentIntersectsRange(item, shift, rangeStart, rangeEnd, shifts)) result.push(item);
    }
    return result;
  },
});

export const updateAssignment = authedMutation({
  args: {
    assignmentId: v.id("shiftAssignments"),
    plan: v.optional(shiftPlanValidator),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    shiftId: v.optional(v.id("shifts")),
    weekPattern: v.optional(v.array(v.string())),
    forceConfirm: v.optional(v.boolean()),
    calendarConfirmed: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    const assignment = await ctx.db.get(args.assignmentId);
    if (!assignment) throw new Error("Atama bulunamadı");
    await requirePermission(ctx, ctx.user, assignment.projectId, "schedule.manage");
    if (assignment.projectId && !allowedProjectIds.some((id) => id === assignment.projectId)) {
      throw new Error("Bu atamaya erişim yetkiniz yok");
    }
    if (assignment.plan && args.plan === undefined && args.shiftId !== undefined) {
      throw new ConvexError("Planlı atamada vardiyayı plan üzerinden değiştirin");
    }
    const nextStart = args.startDate ?? assignment.startDate;
    const nextEnd = args.endDate ?? assignment.endDate;
    const employee = await ctx.db.get(assignment.employeeId);
    const normalized = await normalizeAssignmentPlan(ctx, {
      ...assignment, shiftId: args.shiftId ?? assignment.shiftId,
      startDate: nextStart, endDate: nextEnd, weekPattern: args.weekPattern ?? assignment.weekPattern,
      plan: args.plan ?? assignment.plan,
    });
    if (!employee) throw new Error("Çalışan bulunamadı");
    assertPeopleProject(assignment.projectId, employee.projectId, "Atama ve çalışan");
    const range = { startDate: nextStart, endDate: nextEnd, weekPattern: args.weekPattern ?? assignment.weekPattern,
      shiftId: normalized.shiftId, plan: normalized.plan };
    await validateAssignment(ctx, employee, normalized.shift, range, args.forceConfirm, assignment._id, args.calendarConfirmed);
    await ctx.db.patch(assignment._id, { ...range, updatedAt: new Date().toISOString() });
    await syncPlanRefs(ctx, { assignmentId: assignment._id }, assignment.projectId, normalized.plan);
  },
});

const bulkArgs = {
  plan: v.optional(shiftPlanValidator),
  employeeIds: v.array(v.id("employees")),
  shiftId: v.id("shifts"),
  projectId: v.optional(v.id("projects")),
  startDate: v.string(),
  weekPattern: v.optional(v.array(v.string())),
  forceConfirm: v.optional(v.boolean()),
  calendarConfirmed: v.optional(v.boolean()),
};
interface BulkInput extends ScheduleRange {
  employeeIds: Id<"employees">[];
  shiftId: Id<"shifts">;
  projectId?: Id<"projects">;
  forceConfirm?: boolean;
  calendarConfirmed?: boolean;
}
type EmployeeDecision = { employeeId: Id<"employees">; employeeName: string } & AssignmentDecision;
async function prepareBulk(ctx: ReadCtx, args: BulkInput): Promise<EmployeeDecision[]> {
  validateAssignRange(args);
  if (!args.employeeIds.length || args.employeeIds.length > BULK_ASSIGN_LIMIT) throw new ConvexError("1–100 çalışan seçin");
  if (new Set(args.employeeIds).size !== args.employeeIds.length) throw new ConvexError("Aynı çalışan birden fazla seçilemez");
  const allowed = await resolveProjectScope(ctx, args.projectId);
  const shift = await ctx.db.get(args.shiftId);
  if (!shift?.projectId || !allowed.includes(shift.projectId)) throw new ConvexError("Bu vardiyaya erişim yetkiniz yok");
  const normalized = await normalizeAssignmentPlan(ctx, { ...args, projectId: shift.projectId });
  const range = { ...args, shiftId: normalized.shiftId, plan: normalized.plan };
  const state = newReadState();
  for (const value of normalized.shifts.values()) state.shifts.set(value._id, value);
  const results: EmployeeDecision[] = [];
  for (const employeeId of args.employeeIds) {
    const employee = await ctx.db.get(employeeId);
    const permitted = employee?.projectId !== undefined && allowed.includes(employee.projectId);
    const employeeName = employee && permitted ? `${employee.firstName} ${employee.lastName}`.trim() : "";
    const reason = !employee ? "Çalışan bulunamadı" : !permitted ? "Erişim yok" : employee.projectId !== shift.projectId ? "Çalışan ve vardiya aynı projede olmalıdır" : null;
    if (reason || !employee) {
      results.push({ employeeId, employeeName, status: "skipped", reason: reason ?? "Çalışan bulunamadı", occurrenceCount: 0, conflict: null, leave: null, holiday: null });
      continue;
    }
    const decision = await assignmentDecision(ctx, employee, normalized.shift, range, state, args.forceConfirm, args.calendarConfirmed);
    results.push({ employeeId, employeeName, ...decision });
  }
  return results;
}

export const previewBulkAssign = authedQuery({
  args: { ...bulkArgs, endDate: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const results = await prepareBulk(ctx, { ...args, endDate: args.endDate ?? args.startDate });
    const summary = { total: results.length, willAssign: 0, conflict: 0, onLeave: 0, holiday: 0, skipped: 0 };
    for (const result of results) {
      if (result.status === "will_assign") summary.willAssign++;
      else if (result.status === "on_leave") summary.onLeave++;
      else summary[result.status]++;
    }
    return { results, summary };
  },
});

type BulkApplyResult = Omit<EmployeeDecision, "status"> & {
  status: "assigned" | "skipped_conflict" | "skipped_leave" | "failed";
  previewStatus: AssignmentDecision["status"];
  assignmentId: Id<"shiftAssignments"> | null;
};
export const bulkAssignShift = authedMutation({
  args: { ...bulkArgs, endDate: v.string(), resultMode: v.optional(v.literal("detailed")) },
  handler: async (ctx, args) => {
    // Read and revalidate everything in this transaction before its first write.
    const decisions = await prepareBulk(ctx, args);
    const legacyOverlapCount = decisions.filter(decision => decision.status === "conflict").length;
    if (!args.resultMode && !args.forceConfirm && legacyOverlapCount > 0 && !decisions.some(decision => decision.status === "will_assign")) {
      throw new ConvexError({ code: "SHIFT_OVERLAP", message: `OVERLAP:${legacyOverlapCount}`, overlapCount: legacyOverlapCount });
    }
    const shift = await ctx.db.get(args.shiftId);
    if (!shift) throw new ConvexError("Vardiya bulunamadı");
    await requirePermission(ctx, ctx.user, shift.projectId, "schedule.manage");
    const normalized = await normalizeAssignmentPlan(ctx, { ...args, projectId: shift.projectId });
    const now = new Date().toISOString();
    const results: BulkApplyResult[] = [];
    const skipped: { employeeId: string; reason: string }[] = [];
    let insertedCount = 0;
    let overlapCount = 0;
    for (const decision of decisions) {
      let assignmentId: Id<"shiftAssignments"> | null = null;
      let status: BulkApplyResult["status"] = "failed";
      if (decision.status === "will_assign") {
        assignmentId = await ctx.db.insert("shiftAssignments", {
          employeeId: decision.employeeId, shiftId: normalized.shiftId, plan: normalized.plan,
          projectId: shift.projectId,
          startDate: args.startDate, endDate: args.endDate, weekPattern: args.weekPattern,
          createdAt: now, updatedAt: now,
        });
        await syncPlanRefs(ctx, { assignmentId }, shift.projectId, normalized.plan);
        status = "assigned";
        insertedCount++;
      } else {
        if (decision.status === "conflict") { status = "skipped_conflict"; overlapCount++; }
        else if (decision.status === "on_leave") status = "skipped_leave";
        skipped.push({ employeeId: decision.employeeId, reason: decision.reason });
      }
      results.push({ ...decision, reason: status === "assigned" ? "Atandı" : decision.reason, status, previewStatus: decision.status, assignmentId });
    }
    // Detailed clients retain per-person results, including zero successful assignments.
    return { insertedCount, skipped, overlapCount, results };
  },
});

export const removeAssignment = authedMutation({
  args: { assignmentId: v.id("shiftAssignments") },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    const assignment = await ctx.db.get(args.assignmentId);
    if (!assignment) throw new Error("Atama bulunamadı");
    await requirePermission(ctx, ctx.user, assignment.projectId, "schedule.manage");
    if (assignment.projectId ? !allowedProjectIds.some(id => id === assignment.projectId) : ctx.user.role !== "super_admin") {
      throw new Error("Bu atamaya erişim yetkiniz yok");
    }
    await requireEmployeeAccess(ctx, assignment.employeeId);
    await syncPlanRefs(ctx, { assignmentId: args.assignmentId }, assignment.projectId);
    await ctx.db.delete(args.assignmentId);
  },
});

/** Indexed secondary links supplement the legacy primary-shift index without double counting. */
async function definitionPlanLinks(ctx: ReadCtx, shiftId: Id<"shifts">, projectId: Id<"projects">, limit = ASSIGNMENT_SCAN_LIMIT) {
  const refs = await ctx.db.query("shiftPlanRefs").withIndex("by_shift", q => q.eq("shiftId", shiftId)).take(limit + 1);
  const scannedRefs = refs.slice(0, limit);
  const remaining = limit - scannedRefs.length;
  const departments = await ctx.db.query("departmentShiftAssignments").withIndex("by_shift", q => q.eq("shiftId", shiftId)).take(remaining + 1);
  const scannedDepartments = departments.slice(0, remaining);
  const truncated = refs.length > limit || departments.length > remaining;
  const personal = new Map<string, Doc<"shiftAssignments">>();
  const departmentRows = new Map(scannedDepartments.map(row => [String(row._id), row]));
  for (const ref of scannedRefs) {
    if (ref.projectId !== projectId) throw new ConvexError("Plan referansının proje bilgisi doğrulanamadı");
    if (ref.assignmentId) {
      const row = await ctx.db.get(ref.assignmentId);
      if (row) personal.set(row._id, row);
    }
    if (ref.departmentAssignmentId && !departmentRows.has(ref.departmentAssignmentId)) {
      const row = await ctx.db.get(ref.departmentAssignmentId);
      if (row) departmentRows.set(row._id, row);
    }
  }
  if ([...personal.values(), ...departmentRows.values()].some(row => row.projectId !== projectId)) throw new ConvexError("Atamaların proje bilgisi doğrulanamadı");
  return { personal: [...personal.values()], departments: [...departmentRows.values()], reads: scannedRefs.length + scannedDepartments.length,
    truncated, hasAssignments: refs.length > 0 || departments.length > 0 };
}
interface DefinitionEmployeeState { tree?: Doc<"departments">[]; employees?: Doc<"employees">[] }
async function affectedEmployeeCount(ctx: ReadCtx, rows: Doc<"shiftAssignments">[], departments: Doc<"departmentShiftAssignments">[], projectId: Id<"projects"> | undefined, state: DefinitionEmployeeState = {}) {
  const ids = new Set(rows.map(row => row.employeeId));
  if (!departments.length) return ids.size;
  if (!projectId) throw new ConvexError("Departman için proje zorunludur");
  if (!state.tree || !state.employees) {
    const [tree, employees] = await Promise.all([
      ctx.db.query("departments").withIndex("by_project", q => q.eq("projectId", projectId)).take(2001),
      ctx.db.query("employees").withIndex("by_project", q => q.eq("projectId", projectId)).take(ASSIGNMENT_SCAN_LIMIT + 1),
    ]);
    if (tree.length > 2000 || employees.length > ASSIGNMENT_SCAN_LIMIT) throw new ConvexError("Departman etki okuma sınırı aşıldı");
    state.tree = tree;
    state.employees = employees;
  }
  const { tree, employees } = state;
  const map = new Map(tree.map(department => [String(department._id), department]));
  const targets = new Set(departments.map(row => row.departmentId));
  for (const employee of employees) if (departmentChain(employee.departmentId, projectId, map).some(id => targets.has(id))) ids.add(employee._id);
  return ids.size;
}

async function readDefinitionAssignments(ctx: ReadCtx, shiftId: Id<"shifts">) {
  const allowed = await getProjectIdsForUser(ctx);
  const shift = await ctx.db.get(shiftId);
  if (!shift?.projectId || !allowed.includes(shift.projectId)) throw new ConvexError("Bu vardiyaya erişim yetkiniz yok");
  const rows = await ctx.db.query("shiftAssignments").withIndex("by_shift", q => q.eq("shiftId", shiftId))
    .take(ASSIGNMENT_SCAN_LIMIT + 1);
  if (rows.some(row => row.projectId !== undefined && row.projectId !== shift.projectId)) throw new ConvexError("Atamaların proje bilgisi doğrulanamadı");
  const links = await definitionPlanLinks(ctx, shiftId, shift.projectId);
  const merged = new Map([...rows.filter(row => row.projectId !== undefined), ...links.personal].map(row => [String(row._id), row]));
  // A sentinel is counted as an observed row, never presented as the full total.
  return { shift, rows: [...merged.values()], departmentRows: links.departments,
    skippedAssignments: rows.filter(row => row.projectId === undefined).length, truncated: rows.length > ASSIGNMENT_SCAN_LIMIT || links.truncated };
}

/** One subscription and one shared read budget for the entire definitions panel. */
export const definitionImpacts = authedQuery({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    await resolveProjectScope(ctx, args.projectId);
    const definitions = await ctx.db.query("shifts").withIndex("by_project", q => q.eq("projectId", args.projectId)).take(1001);
    if (definitions.length > 1000) throw new ConvexError("Vardiya tanımı okuma sınırı aşıldı");
    let remaining = ASSIGNMENT_SCAN_LIMIT;
    const impacts = [];
    const employeeState: DefinitionEmployeeState = {};
    for (const shift of definitions) {
      if (remaining === 0) {
        // A separate indexed existence probe does not pretend to compute a total.
        const first = await ctx.db.query("shiftAssignments").withIndex("by_shift", q => q.eq("shiftId", shift._id)).take(1);
        const ref = await ctx.db.query("shiftPlanRefs").withIndex("by_shift", q => q.eq("shiftId", shift._id)).take(1);
        const department = await ctx.db.query("departmentShiftAssignments").withIndex("by_shift", q => q.eq("shiftId", shift._id)).take(1);
        impacts.push({ shiftId: shift._id, assignmentCount: null, employeeCount: null,
          skippedAssignments: 0, truncated: true, countLabel: "Hesaplanamadı", hasAssignments: first.length > 0 || ref.length > 0 || department.length > 0 });
        continue;
      }
      const candidates = await ctx.db.query("shiftAssignments").withIndex("by_shift", q => q.eq("shiftId", shift._id)).take(remaining + 1);
      const truncated = remaining === 0 || candidates.length > remaining;
      const scanned = candidates.slice(0, remaining);
      remaining -= scanned.length;
      const legacyRows = scanned.filter(row => row.projectId === args.projectId);
      const links = await definitionPlanLinks(ctx, shift._id, args.projectId, remaining);
      const rows = [...new Map([...legacyRows, ...links.personal].map(row => [String(row._id), row])).values()];
      remaining = Math.max(0, remaining - links.reads);
      const count = rows.length + links.departments.length;
      impacts.push({ shiftId: shift._id, assignmentCount: count,
        skippedAssignments: scanned.length - legacyRows.length,
        employeeCount: await affectedEmployeeCount(ctx, rows, links.departments, args.projectId, employeeState),
        truncated: truncated || links.truncated, countLabel: truncated || links.truncated ? "En az" : "Toplam",
        hasAssignments: count > 0 || links.hasAssignments });
    }
    return impacts;
  },
});

export const assignmentDeleteImpact = authedQuery({
  args: { shiftId: v.id("shifts") },
  handler: async (ctx, args) => {
    const { rows, departmentRows, shift, truncated, skippedAssignments } = await readDefinitionAssignments(ctx, args.shiftId);
    return {
      assignmentCount: rows.length + departmentRows.length,
      skippedAssignments,
      employeeCount: await affectedEmployeeCount(ctx, rows, departmentRows, shift.projectId),
      truncated,
      countLabel: truncated ? "En az" : "Toplam",
    };
  },
});

export const definitionUsage = authedQuery({
  args: { shiftId: v.id("shifts") },
  handler: async (ctx, args) => {
    const { rows, departmentRows, shift, truncated, skippedAssignments } = await readDefinitionAssignments(ctx, args.shiftId);
    const today = trDateKey(new Date().toISOString());
    const activeRows: Doc<"shiftAssignments">[] = [];
    const activeDepartments: Doc<"departmentShiftAssignments">[] = [];
    for (const row of [...rows, ...departmentRows]) {
      if (row.projectId !== shift.projectId || row.endDate < shiftDateOffset(today, -1)) continue;
      const start = row.startDate > today ? row.startDate : today;
      const period = row.plan && row.plan.kind !== "weekly" ? row.plan.slots.length : 7;
      const end = row.endDate < shiftDateOffset(start, period) ? row.endDate : shiftDateOffset(start, period);
      // A referenced definition can occur only in some cycle slots. Count its own
      // future intervals, including its previous-night tail, rather than another slot.
      const plan = row.plan?.kind === "weekly" ? { ...row.plan, shiftIds: row.plan.shiftIds.filter(id => id === shift._id) }
        : row.plan ? { ...row.plan, slots: row.plan.slots.map(slot => slot.filter(id => id === shift._id)) } : undefined;
      if (assignmentIntersectsRange({ ...row, shiftId: shift._id, plan }, shift, start, end < start ? start : end, new Map([[String(shift._id), shift]]))) {
        if ("employeeId" in row) activeRows.push(row); else activeDepartments.push(row);
      }
    }
    return {
      assignmentCount: activeRows.length + activeDepartments.length,
      employeeCount: await affectedEmployeeCount(ctx, activeRows, activeDepartments, shift.projectId),
      scannedAssignmentCount: rows.length + departmentRows.length + skippedAssignments,
      skippedAssignments,
      truncated,
      countLabel: truncated ? "En az" : "Toplam",
      asOfDate: today,
      affectsHistoricalAssignments: true,
    };
  },
});

export const list = authedQuery({
  args: { projectId: v.optional(v.id("projects")) },
  handler: async (ctx, args) => {
    const projectIds = await resolveProjectScope(ctx, args.projectId);
    const results = await Promise.all(projectIds.map(projectId =>
      ctx.db.query("shifts").withIndex("by_project", q => q.eq("projectId", projectId)).collect(),
    ));
    return results.flat();
  },
});

const scheduleArgs = {
  validWindow: v.optional(v.union(v.null(), v.object({
    checkInStart: v.string(), checkInEnd: v.string(),
    checkOutStart: v.string(), checkOutEnd: v.string(),
    checkOutEndDayOffset: v.union(v.literal(0), v.literal(1)),
  }))),
  absentAfterLateMinutes: v.optional(v.union(v.null(), v.number())),
  minWorkMinutes: v.optional(v.union(v.null(), v.number())),
  missingCheckInLateMinutes: v.optional(v.union(v.null(), v.number())),
  holidayWorkRequired: v.optional(v.union(v.null(), v.boolean())),
  scheduleType: v.optional(v.union(v.literal("fixed"), v.literal("flexible"))),
  flexible: v.optional(v.object({
    requiredNetMinutes: v.number(), checkInStart: v.string(), checkInEnd: v.string(),
    checkOutStart: v.string(), checkOutEnd: v.string(),
    checkOutEndDayOffset: v.union(v.literal(0), v.literal(1)), maxSpanMinutes: v.number(),
    breakMode: v.union(v.literal("duration"), v.literal("existingLegal")), breakMinutes: v.optional(v.number()),
  })),
};

export const create = authedMutation({
  args: {
    ...scheduleArgs,
    color: v.optional(shiftColorValidator),
    name: v.string(),
    projectId: v.optional(v.id("projects")),
    startTime: v.string(),
    endTime: v.string(),
    breakStart: v.optional(v.union(v.null(), v.string())),
    breakEnd: v.optional(v.union(v.null(), v.string())),
    lateToleranceMinutes: v.optional(v.union(v.null(), v.number())),
    earlyExitToleranceMinutes: v.optional(v.union(v.null(), v.number())),
    overtimeStartToleranceMinutes: v.optional(v.union(v.null(), v.number())),
    overtimeEnabled: v.optional(v.boolean()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    await requirePermission(ctx, ctx.user, args.projectId, "schedule.manage");
    if (args.projectId ? !allowedProjectIds.some((id) => id === args.projectId) : ctx.user.role !== "super_admin") {
      throw new Error("Bu vardiyayı oluşturma yetkiniz yok");
    }
    const now = new Date().toISOString();
    const fields = { ...toPatch(args), name: args.name, startTime: args.startTime, endTime: args.endTime };
    validateShift(fields);
    if (fields.scheduleType === "flexible" && fields.flexible) {
      fields.startTime = fields.flexible.checkInStart;
      fields.endTime = fields.flexible.checkInEnd;
    }
    return await ctx.db.insert("shifts", {
      ...fields,
      isActive: args.isActive ?? true,
      overtimeEnabled: args.overtimeEnabled ?? true,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = authedMutation({
  args: {
    ...scheduleArgs,
    color: v.optional(v.union(v.null(), shiftColorValidator)),
    shiftId: v.id("shifts"),
    name: v.optional(v.string()),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    breakStart: v.optional(v.union(v.null(), v.string())),
    breakEnd: v.optional(v.union(v.null(), v.string())),
    lateToleranceMinutes: v.optional(v.union(v.null(), v.number())),
    earlyExitToleranceMinutes: v.optional(v.union(v.null(), v.number())),
    overtimeStartToleranceMinutes: v.optional(v.union(v.null(), v.number())),
    overtimeEnabled: v.optional(v.boolean()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    const shift = await ctx.db.get(args.shiftId);
    if (!shift) throw new Error("Vardiya bulunamadı");
    await requirePermission(ctx, ctx.user, shift.projectId, "schedule.manage");
    if (shift.projectId ? !allowedProjectIds.some(id => id === shift.projectId) : ctx.user.role !== "super_admin") {
      throw new Error("Bu vardiyaya erişim yetkiniz yok");
    }
    const { shiftId, ...updates } = args;
    const patch = toPatch(updates);
    // Ad, renk ve aktiflik hesabı değiştirmez; esnek tanımda da yerinde güncellenir.
    const cosmeticOnly = Object.keys(patch).every((key) => key === "name" || key === "color" || key === "isActive");
    if (!cosmeticOnly) validateShift({ ...shift, ...patch });
    if ((shift.scheduleType === "flexible" || patch.scheduleType === "flexible") && !cosmeticOnly) {
      throw new Error("Esnek vardiya değişikliği için yeni tanım oluşturun ve gelecek tarihli atama yapın; geçmiş hesaplar değiştirilmez");
    }
    await ctx.db.patch(shiftId, { ...patch, updatedAt: new Date().toISOString() });
  },
});

export const remove = authedMutation({
  args: { shiftId: v.id("shifts") },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    const shift = await ctx.db.get(args.shiftId);
    if (!shift) throw new Error("Vardiya bulunamadı");
    await requirePermission(ctx, ctx.user, shift.projectId, "schedule.manage");
    if (shift.projectId ? !allowedProjectIds.some(id => id === shift.projectId) : ctx.user.role !== "super_admin") {
      throw new Error("Bu vardiyaya erişim yetkiniz yok");
    }
    const [planRef, departmentAssignment] = await Promise.all([
      ctx.db.query("shiftPlanRefs").withIndex("by_shift", q => q.eq("shiftId", args.shiftId)).take(ASSIGNMENT_SCAN_LIMIT + 1),
      ctx.db.query("departmentShiftAssignments").withIndex("by_shift", q => q.eq("shiftId", args.shiftId)).take(1),
    ]);
    if (planRef.length > ASSIGNMENT_SCAN_LIMIT) throw new ConvexError("5000 üzeri plan referansı tek işlemde temizlenemez");
    if (departmentAssignment.length) throw new ConvexError("Vardiya silinemez: plan veya departman ataması var. Önce atamaları kaldırın.");
    for (const ref of planRef) {
      if (ref.projectId !== shift.projectId) throw new ConvexError("Plan referansının proje bilgisi doğrulanamadı");
      const assignment = ref.assignmentId ? await ctx.db.get(ref.assignmentId) : null;
      const department = ref.departmentAssignmentId ? await ctx.db.get(ref.departmentAssignmentId) : null;
      if (assignment || department) throw new ConvexError("Vardiya silinemez: plan veya departman ataması var. Önce atamaları kaldırın.");
      await ctx.db.delete(ref._id);
    }
    const linkedAssignments = await ctx.db
      .query("shiftAssignments")
      .withIndex("by_shift", (q) => q.eq("shiftId", args.shiftId))
      .take(ASSIGNMENT_SCAN_LIMIT + 1);
    if (linkedAssignments.length > ASSIGNMENT_SCAN_LIMIT) throw new ConvexError("5000 üzeri ataması olan tanım tek işlemde silinemez. Atamaları gruplar halinde kaldırın.");
    if (linkedAssignments.some(row => row.projectId !== undefined && row.projectId !== shift.projectId)) throw new ConvexError("Atamaların proje bilgisi doğrulanamadı");
    const eligible = linkedAssignments.filter(row => row.projectId !== undefined);
    await Promise.all(eligible.map((a) => ctx.db.delete(a._id)));
    await ctx.db.delete(args.shiftId);
    return { removedAssignments: eligible.length, skippedAssignments: linkedAssignments.length - eligible.length };
  },
});

const clearArgs = {
  projectId: v.id("projects"), employeeIds: v.array(v.id("employees")),
  startDate: v.string(), endDate: v.string(),
};
type ClearInput = { projectId: Id<"projects">; employeeIds: Id<"employees">[]; startDate: string; endDate: string };
async function prepareClear(ctx: ReadCtx & { user: Doc<"users"> }, args: ClearInput) {
  await requirePermission(ctx, ctx.user, args.projectId, "schedule.manage");
  validateAssignRange(args);
  if (!args.employeeIds.length || args.employeeIds.length > 500) throw new ConvexError("1–500 çalışan seçin");
  if (new Set(args.employeeIds).size !== args.employeeIds.length) throw new ConvexError("Aynı çalışan birden fazla seçilemez");
  await resolveProjectScope(ctx, args.projectId);
  const state = newReadState();
  const rows: Doc<"shiftAssignments">[] = [];
  for (const employeeId of args.employeeIds) {
    const employee = await ctx.db.get(employeeId);
    if (!employee || employee.projectId !== args.projectId) throw new ConvexError("Çalışan seçili projeye ait değil");
    await requireEmployeeAccess(ctx, employeeId);
    const found = consumeRows(await ctx.db.query("shiftAssignments").withIndex("by_employee_end", q =>
      q.eq("employeeId", employeeId).gte("endDate", args.startDate),
    ).take(state.remaining + 1), state);
    for (const row of found) {
      if (row.startDate > args.endDate) continue;
      if (row.projectId !== args.projectId) throw new ConvexError("Atamanın proje bilgisi doğrulanamadı");
      rows.push(row);
      if (rows.length > 1000) throw new ConvexError("1000 üzeri atama tek işlemde temizlenemez; aralığı daraltın");
    }
  }
  const summary = { deleted: 0, trimmed: 0, split: 0, affectedEmployees: new Set(rows.map(row => row.employeeId)).size,
    affectsPast: rows.some(row => row.startDate < trDateKey(new Date().toISOString()) && args.startDate < trDateKey(new Date().toISOString())) };
  for (const row of rows) {
    if (row.startDate < args.startDate && row.endDate > args.endDate) summary.split++;
    else if (row.startDate < args.startDate || row.endDate > args.endDate) summary.trimmed++;
    else summary.deleted++;
  }
  return { rows, summary };
}
export const previewClearAssignments = authedQuery({
  args: clearArgs,
  handler: async (ctx, args) => (await prepareClear(ctx, args)).summary,
});
export const clearAssignments = authedMutation({
  args: clearArgs,
  handler: async (ctx, args) => {
    const { rows, summary } = await prepareClear(ctx, args);
    const updatedAt = new Date().toISOString();
    for (const row of rows) {
      if (row.startDate < args.startDate && row.endDate > args.endDate) {
        await ctx.db.patch(row._id, { endDate: shiftDateOffset(args.startDate, -1), updatedAt });
        const assignmentId = await ctx.db.insert("shiftAssignments", {
          plan: row.plan, employeeId: row.employeeId, shiftId: row.shiftId, projectId: row.projectId,
          startDate: shiftDateOffset(args.endDate, 1), endDate: row.endDate,
          weekPattern: row.weekPattern, createdAt: row.createdAt, updatedAt,
        });
        await syncPlanRefs(ctx, { assignmentId }, row.projectId, row.plan);
      } else if (row.startDate < args.startDate) {
        await ctx.db.patch(row._id, { endDate: shiftDateOffset(args.startDate, -1), updatedAt });
      } else if (row.endDate > args.endDate) {
        await ctx.db.patch(row._id, { startDate: shiftDateOffset(args.endDate, 1), updatedAt });
      } else {
        await syncPlanRefs(ctx, { assignmentId: row._id }, row.projectId);
        await ctx.db.delete(row._id);
      }
    }
    if (rows.length) await writeAudit(ctx, { user: ctx.user, projectId: args.projectId, action: "delete",
      targetTable: "shiftAssignments", targetId: args.projectId,
      oldValue: { startDate: args.startDate, endDate: args.endDate, employeeIds: args.employeeIds },
      newValue: summary, note: `Vardiya toplu temizle: ${summary.deleted} silindi, ${summary.trimmed} kırpıldı, ${summary.split} bölündü` });
    return summary;
  },
});
