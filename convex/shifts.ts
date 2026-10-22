import { assertPeopleProject } from "./lib/peopleScope";
import { resolveProjectScope } from "./lib/projectScope";
import { toPatch } from "./lib/nullablePatch";
import { validateShift, type ScheduleRange } from "./lib/shiftUx";
import { trDateKey } from "./lib/trDate";
import {
  ASSIGNMENT_SCAN_LIMIT, BULK_ASSIGN_LIMIT, assignmentIntersectsRange,
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
    existing.push({ assignmentId: item._id, shiftId: item.shiftId, shiftName: other.name,
      startDate: item.startDate, endDate: item.endDate,
      ...(item.weekPattern === undefined ? {} : { weekPattern: item.weekPattern }), shift: other });
  }
  return evaluateShiftAssignment({ range, shift, existing, leaves, holidays, forceConfirm, calendarConfirmed });
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
  },
  handler: async (ctx, args) => {
    const projectIds = await resolveProjectScope(ctx, args.projectId);
    if (args.employeeIds && args.employeeIds.length > BULK_ASSIGN_LIMIT) throw new ConvexError("En fazla 100 çalışan seçin");
    if ((args.rangeStart === undefined) !== (args.rangeEnd === undefined)) throw new ConvexError("Görünür aralığın başlangıç ve bitişini birlikte verin");
    const matches = (item: Doc<"shiftAssignments">) =>
      (!args.employeeId || item.employeeId === args.employeeId) &&
      (!args.employeeIds || args.employeeIds.includes(item.employeeId)) &&
      (!args.shiftId || item.shiftId === args.shiftId);
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
      if (assignmentIntersectsRange(item, shift, rangeStart, rangeEnd)) result.push(item);
    }
    return result;
  },
});

export const updateAssignment = authedMutation({
  args: {
    assignmentId: v.id("shiftAssignments"),
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
    if (assignment.projectId && !allowedProjectIds.some((id) => id === assignment.projectId)) {
      throw new Error("Bu atamaya erişim yetkiniz yok");
    }
    const nextStart = args.startDate ?? assignment.startDate;
    const nextEnd = args.endDate ?? assignment.endDate;
    const employee = await ctx.db.get(assignment.employeeId);
    const nextShift = await ctx.db.get(args.shiftId ?? assignment.shiftId);
    if (!employee || !nextShift) throw new Error("Çalışan veya vardiya bulunamadı");
    assertPeopleProject(assignment.projectId, employee.projectId, "Atama ve çalışan");
    await validateAssignment(ctx, employee, nextShift, { startDate: nextStart, endDate: nextEnd, weekPattern: args.weekPattern ?? assignment.weekPattern }, args.forceConfirm, assignment._id, args.calendarConfirmed);
    const { assignmentId, forceConfirm: _force, calendarConfirmed: _calendar, ...updates } = args;
    const clean: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    for (const [k, val] of Object.entries(updates)) {
      if (val !== undefined) clean[k] = val;
    }
    await ctx.db.patch(assignmentId, clean);
  },
});

const bulkArgs = {
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
  const state = newReadState();
  state.shifts.set(shift._id, shift);
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
    const decision = await assignmentDecision(ctx, employee, shift, args, state, args.forceConfirm, args.calendarConfirmed);
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
          employeeId: decision.employeeId, shiftId: args.shiftId,
          projectId: shift.projectId,
          startDate: args.startDate, endDate: args.endDate, weekPattern: args.weekPattern,
          createdAt: now, updatedAt: now,
        });
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
    if (assignment.projectId ? !allowedProjectIds.some(id => id === assignment.projectId) : ctx.user.role !== "super_admin") {
      throw new Error("Bu atamaya erişim yetkiniz yok");
    }
    await requireEmployeeAccess(ctx, assignment.employeeId);
    await ctx.db.delete(args.assignmentId);
  },
});

async function readDefinitionAssignments(ctx: ReadCtx, shiftId: Id<"shifts">) {
  const allowed = await getProjectIdsForUser(ctx);
  const shift = await ctx.db.get(shiftId);
  if (!shift?.projectId || !allowed.includes(shift.projectId)) throw new ConvexError("Bu vardiyaya erişim yetkiniz yok");
  const rows = await ctx.db.query("shiftAssignments").withIndex("by_shift", q => q.eq("shiftId", shiftId))
    .take(ASSIGNMENT_SCAN_LIMIT + 1);
  if (rows.some(row => row.projectId !== undefined && row.projectId !== shift.projectId)) throw new ConvexError("Atamaların proje bilgisi doğrulanamadı");
  // A sentinel is counted as an observed row, never presented as the full total.
  return { shift, rows: rows.filter(row => row.projectId !== undefined),
    skippedAssignments: rows.filter(row => row.projectId === undefined).length, truncated: rows.length > ASSIGNMENT_SCAN_LIMIT };
}

/** One subscription and one shared read budget for the entire definitions panel. */
export const definitionImpacts = authedQuery({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    await resolveProjectScope(ctx, args.projectId);
    const definitions = await ctx.db.query("shifts").withIndex("by_project", q => q.eq("projectId", args.projectId)).take(1000);
    let remaining = ASSIGNMENT_SCAN_LIMIT;
    const impacts = [];
    for (const shift of definitions) {
      if (remaining === 0) {
        // A separate indexed existence probe does not pretend to compute a total.
        const first = await ctx.db.query("shiftAssignments").withIndex("by_shift", q => q.eq("shiftId", shift._id)).take(1);
        impacts.push({ shiftId: shift._id, assignmentCount: null, employeeCount: null,
          skippedAssignments: 0, truncated: true, countLabel: "Hesaplanamadı", hasAssignments: first.length > 0 });
        continue;
      }
      const candidates = await ctx.db.query("shiftAssignments").withIndex("by_shift", q => q.eq("shiftId", shift._id)).take(remaining + 1);
      const truncated = remaining === 0 || candidates.length > remaining;
      const scanned = candidates.slice(0, remaining);
      remaining -= scanned.length;
      const rows = scanned.filter(row => row.projectId === args.projectId);
      impacts.push({ shiftId: shift._id, assignmentCount: rows.length,
        skippedAssignments: scanned.length - rows.length,
        employeeCount: new Set(rows.map(row => row.employeeId)).size,
        truncated, countLabel: truncated ? "En az" : "Toplam", hasAssignments: rows.length > 0 });
    }
    return impacts;
  },
});

export const assignmentDeleteImpact = authedQuery({
  args: { shiftId: v.id("shifts") },
  handler: async (ctx, args) => {
    const { rows, truncated, skippedAssignments } = await readDefinitionAssignments(ctx, args.shiftId);
    return {
      assignmentCount: rows.length,
      skippedAssignments,
      employeeCount: new Set(rows.map(row => row.employeeId)).size,
      truncated,
      countLabel: truncated ? "En az" : "Toplam",
    };
  },
});

export const definitionUsage = authedQuery({
  args: { shiftId: v.id("shifts") },
  handler: async (ctx, args) => {
    const { rows, shift, truncated, skippedAssignments } = await readDefinitionAssignments(ctx, args.shiftId);
    const today = trDateKey(new Date().toISOString());
    const activeOrFuture = rows.filter(row => {
      if (row.projectId !== shift.projectId || row.endDate < shiftDateOffset(today, -1)) return false;
      // A weekly pattern either occurs within a week or never occurs. Include
      // today's previous-night tail, even when the series ended yesterday.
      const start = row.startDate > today ? row.startDate : today;
      const end = row.endDate < shiftDateOffset(start, 7) ? row.endDate : shiftDateOffset(start, 7);
      return assignmentIntersectsRange(row, shift, start, end < start ? start : end);
    });
    return {
      assignmentCount: activeOrFuture.length,
      employeeCount: new Set(activeOrFuture.map(row => row.employeeId)).size,
      scannedAssignmentCount: rows.length + skippedAssignments,
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
    if (shift.projectId ? !allowedProjectIds.some(id => id === shift.projectId) : ctx.user.role !== "super_admin") {
      throw new Error("Bu vardiyaya erişim yetkiniz yok");
    }
    const { shiftId, ...updates } = args;
    const patch = toPatch(updates);
    if (shift.scheduleType === "flexible" || patch.scheduleType === "flexible") {
      throw new Error("Esnek vardiya değişikliği için yeni tanım oluşturun ve gelecek tarihli atama yapın; geçmiş hesaplar değiştirilmez");
    }
    validateShift({ ...shift, ...patch });
    await ctx.db.patch(shiftId, { ...patch, updatedAt: new Date().toISOString() });
  },
});

export const remove = authedMutation({
  args: { shiftId: v.id("shifts") },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    const shift = await ctx.db.get(args.shiftId);
    if (!shift) throw new Error("Vardiya bulunamadı");
    if (shift.projectId ? !allowedProjectIds.some(id => id === shift.projectId) : ctx.user.role !== "super_admin") {
      throw new Error("Bu vardiyaya erişim yetkiniz yok");
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
