import { writeAudit } from "./lib/audit";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { authedMutation, authedQuery } from "./lib/customFunctions";
import { resolveProjectScope } from "./lib/projectScope";
import { requirePermission } from "./lib/permissions";
import { shiftPlanValidator, slotForDate, type PlanRow } from "./lib/shiftPlan";
import { buildBoundedShiftResolver, departmentChain, readDepartmentPlans } from "./lib/shiftResolver";
import { scheduleIntervals } from "./lib/shiftUx";
import { ASSIGNMENT_SCAN_LIMIT, intervalsOverlap, loadPlanShifts, normalizeAssignmentPlan, shiftDateOffset, syncPlanRefs, validateAssignRange } from "./lib/shiftAssign";

type ReadCtx = QueryCtx | MutationCtx;
const assignmentArgs = {
  projectId: v.id("projects"), departmentId: v.id("departments"), shiftId: v.id("shifts"),
  startDate: v.string(), endDate: v.string(), weekPattern: v.optional(v.array(v.string())), plan: v.optional(shiftPlanValidator),
};
type DepartmentInput = PlanRow & { projectId: Id<"projects">; departmentId: Id<"departments"> };
function bounded<T>(rows: T[], limit = ASSIGNMENT_SCAN_LIMIT): T[] {
  if (rows.length > limit) throw new ConvexError("Departman önizleme okuma sınırı aşıldı; tarih aralığını daraltın");
  return rows;
}
async function prepare(ctx: ReadCtx, args: DepartmentInput, excludeId?: Id<"departmentShiftAssignments">) {
  await resolveProjectScope(ctx, args.projectId);
  validateAssignRange(args);
  const department = await ctx.db.get(args.departmentId);
  if (!department || department.projectId !== args.projectId) throw new ConvexError("Departman seçili projeye ait değil");
  const normalized = await normalizeAssignmentPlan(ctx, args);
  if (normalized.shift.projectId !== args.projectId) throw new ConvexError("Vardiya seçili projeye ait değil");
  if (normalized.shift.isActive === false) throw new ConvexError("Pasif vardiya atanamaz");
  const row = { ...args, shiftId: normalized.shiftId, plan: normalized.plan };
  const intervals = scheduleIntervals(row, normalized.shift, normalized.shifts);
  const departmentData = await readDepartmentPlans(ctx, [args.projectId], { start: args.startDate, end: shiftDateOffset(args.endDate, 1) });
  const sameDepartmentConflicts = [];
  for (const other of departmentData.assignments) {
    if (other.departmentId !== args.departmentId || other._id === excludeId) continue;
    const shifts = await loadPlanShifts(ctx, other);
    const shift = shifts.get(other.shiftId);
    if (!shift) continue;
    const range = { ...other, startDate: other.startDate > shiftDateOffset(args.startDate, -1) ? other.startDate : shiftDateOffset(args.startDate, -1),
      endDate: other.endDate < shiftDateOffset(args.endDate, 1) ? other.endDate : shiftDateOffset(args.endDate, 1) };
    if (intervalsOverlap(intervals, scheduleIntervals(range, shift, shifts))) sameDepartmentConflicts.push({
      departmentAssignmentId: other._id, departmentId: other.departmentId, shiftId: other.shiftId,
      shiftName: shift.name, startDate: other.startDate, endDate: other.endDate, weekPattern: other.weekPattern, plan: other.plan,
    });
  }
  const tree = departmentData.departments.length ? departmentData.departments
    : bounded(await ctx.db.query("departments").withIndex("by_project", q => q.eq("projectId", args.projectId)).take(2001), 2000);
  const departments = new Map(tree.map(item => [String(item._id), item]));
  const employees = bounded(await ctx.db.query("employees").withIndex("by_project", q => q.eq("projectId", args.projectId)).take(ASSIGNMENT_SCAN_LIMIT + 1))
    .filter(employee => departmentChain(employee.departmentId, employee.projectId, departments).includes(args.departmentId));
  const days: string[] = [];
  for (let date = args.startDate; date <= args.endDate; date = shiftDateOffset(date, 1)) if (slotForDate(row, date) !== null) days.push(date);
  const touched = new Set<string>();
  for (const [start, end] of intervals) for (let day = Math.floor(start / 1440); day * 1440 < end; day++) touched.add(new Date(day * 86_400_000).toISOString().slice(0, 10));
  let remaining = ASSIGNMENT_SCAN_LIMIT;
  const consume = <T,>(rows: T[]): T[] => { bounded(rows, remaining); remaining -= rows.length; return rows; };
  let personalOverrideCount = 0;
  let leaveCount = 0;
  const leaveEnd = touched.has(shiftDateOffset(args.endDate, 1)) ? shiftDateOffset(args.endDate, 1) : args.endDate;
  for (const employee of employees) {
    // Bound each indexed read, then charge only overlapping records to the shared preview budget.
    const personal = consume(bounded(await ctx.db.query("shiftAssignments").withIndex("by_employee_end", q => q.eq("employeeId", employee._id).gte("endDate", args.startDate)).take(ASSIGNMENT_SCAN_LIMIT + 1))
      .filter(assignment => assignment.startDate <= args.endDate));
    if (personal.some(assignment => (!assignment.projectId || assignment.projectId === args.projectId) && days.some(date => slotForDate(assignment, date) !== null))) personalOverrideCount++;
    const leaves = consume(bounded(await ctx.db.query("leaves").withIndex("by_employee_start", q => q.eq("employeeId", employee._id).lte("startDate", leaveEnd)).take(ASSIGNMENT_SCAN_LIMIT + 1))
      .filter(leave => leave.endDate >= args.startDate));
    leaveCount += [...touched].filter(date => leaves.some(leave => leave.status === "approved" && leave.startDate <= date && leave.endDate >= date)).length;
  }
  const holidayDates = new Set<string>();
  for (const projectId of [args.projectId, undefined]) {
    const holidays = consume(await ctx.db.query("holidays").withIndex("by_project_date", q => q.eq("projectId", projectId).gte("date", args.startDate).lte("date", shiftDateOffset(args.endDate, 1))).take(remaining + 1));
    for (const holiday of holidays) if (touched.has(holiday.date)) holidayDates.add(holiday.date);
  }
  return { row, summary: { employeeCount: employees.length, personalOverrideCount, sameDepartmentConflicts, leaveCount, holidayCount: holidayDates.size } };
}
export const listDepartmentAssignments = authedQuery({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    await resolveProjectScope(ctx, args.projectId);
    return bounded(await ctx.db.query("departmentShiftAssignments").withIndex("by_project_end", q => q.eq("projectId", args.projectId)).take(2001), 2000);
  },
});
export const previewDepartmentAssign = authedQuery({
  args: assignmentArgs,
  handler: async (ctx, args) => (await prepare(ctx, args)).summary,
});
export const assignDepartment = authedMutation({
  args: { ...assignmentArgs, forceConfirm: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    await requirePermission(ctx, ctx.user, args.projectId, "schedule.manage");
    const { forceConfirm, ...input } = args;
    const { row, summary } = await prepare(ctx, input);
    if (!forceConfirm && summary.sameDepartmentConflicts.length) throw new ConvexError({ code: "SHIFT_OVERLAP", message: "Departmanda çakışan vardiya ataması var; devam etmek için onay verin" });
    const now = new Date().toISOString();
    const departmentAssignmentId = await ctx.db.insert("departmentShiftAssignments", { ...row, createdAt: now, updatedAt: now });
    await syncPlanRefs(ctx, { departmentAssignmentId }, row.projectId, row.plan);
    await writeAudit(ctx, { user: ctx.user, projectId: row.projectId, action: "create", targetTable: "departmentShiftAssignments",
      targetId: departmentAssignmentId, newValue: row, note: "Departman vardiya ataması oluşturuldu" });
    return departmentAssignmentId;
  },
});
export const updateDepartmentAssignment = authedMutation({
  args: {
    departmentAssignmentId: v.id("departmentShiftAssignments"), projectId: v.optional(v.id("projects")), departmentId: v.optional(v.id("departments")),
    shiftId: v.optional(v.id("shifts")), startDate: v.optional(v.string()), endDate: v.optional(v.string()),
    weekPattern: v.optional(v.array(v.string())), plan: v.optional(shiftPlanValidator), forceConfirm: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.departmentAssignmentId);
    if (!existing) throw new ConvexError("Departman ataması bulunamadı");
    await requirePermission(ctx, ctx.user, existing.projectId, "schedule.manage");
    if (existing.plan && args.plan === undefined && args.shiftId !== undefined) {
      throw new ConvexError("Planlı atamada vardiyayı plan üzerinden değiştirin");
    }
    if (args.projectId !== undefined && args.projectId !== existing.projectId) throw new ConvexError("Atamanın projesi değiştirilemez");
    const { row, summary } = await prepare(ctx, {
      projectId: existing.projectId, departmentId: args.departmentId ?? existing.departmentId,
      shiftId: args.shiftId ?? existing.shiftId, startDate: args.startDate ?? existing.startDate, endDate: args.endDate ?? existing.endDate,
      weekPattern: args.weekPattern ?? existing.weekPattern, plan: args.plan ?? existing.plan,
    }, existing._id);
    if (!args.forceConfirm && summary.sameDepartmentConflicts.length) throw new ConvexError({ code: "SHIFT_OVERLAP", message: "Departmanda çakışan vardiya ataması var; devam etmek için onay verin" });
    await ctx.db.patch(existing._id, { ...row, plan: row.plan, updatedAt: new Date().toISOString() });
    await syncPlanRefs(ctx, { departmentAssignmentId: existing._id }, row.projectId, row.plan);
    await writeAudit(ctx, { user: ctx.user, projectId: row.projectId, action: "update", targetTable: "departmentShiftAssignments",
      targetId: existing._id, oldValue: existing, newValue: row, note: "Departman vardiya ataması güncellendi" });
  },
});
export const removeDepartmentAssignment = authedMutation({
  args: { departmentAssignmentId: v.id("departmentShiftAssignments") },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.departmentAssignmentId);
    if (!row) throw new ConvexError("Departman ataması bulunamadı");
    await resolveProjectScope(ctx, row.projectId);
    await requirePermission(ctx, ctx.user, row.projectId, "schedule.manage");
    await syncPlanRefs(ctx, args, row.projectId);
    await ctx.db.delete(row._id);
    await writeAudit(ctx, { user: ctx.user, projectId: row.projectId, action: "delete", targetTable: "departmentShiftAssignments",
      targetId: row._id, oldValue: row, note: "Departman vardiya ataması silindi" });
  },
});
export const planCells = authedQuery({
  args: { projectId: v.id("projects"), employeeIds: v.array(v.id("employees")), rangeStart: v.string(), rangeEnd: v.string() },
  handler: async (ctx, args) => {
    await resolveProjectScope(ctx, args.projectId);
    validateAssignRange({ startDate: args.rangeStart, endDate: args.rangeEnd });
    if (args.employeeIds.length > 50 || new Set(args.employeeIds).size !== args.employeeIds.length) throw new ConvexError("En fazla 50 farklı çalışan seçin");
    if ((Date.parse(args.rangeEnd) - Date.parse(args.rangeStart)) / 86_400_000 >= 42) throw new ConvexError("En fazla 42 günlük aralık seçin");
    const employees: Doc<"employees">[] = [];
    for (const id of args.employeeIds) {
      const employee = await ctx.db.get(id);
      if (!employee || employee.projectId !== args.projectId) throw new ConvexError("Çalışan seçili projeye ait değil");
      employees.push(employee);
    }
    const resolver = await buildBoundedShiftResolver(ctx, employees, { start: args.rangeStart, end: args.rangeEnd });
    const cells = [];
    for (const employee of employees) for (let date = args.rangeStart; date <= args.rangeEnd; date = shiftDateOffset(date, 1)) {
      const plan = resolver.resolvePlan(employee._id, date);
      cells.push({ employeeId: employee._id, date, kind: plan.kind, source: plan.source,
        shiftIds: plan.kind === "shifts" ? plan.shifts.map(shift => shift._id) : [],
        ...(plan.kind === "none" ? {} : {
          ...(plan.assignmentId ? { assignmentId: plan.assignmentId } : {}),
          ...(plan.departmentAssignmentId ? { departmentAssignmentId: plan.departmentAssignmentId } : {}),
          ...(plan.departmentId ? { departmentId: plan.departmentId } : {}),
        }),
      });
    }
    return cells;
  },
});
