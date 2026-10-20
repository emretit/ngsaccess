import { stream } from "convex-helpers/server/stream";
import schema from "./schema";
import { resolveProjectScope } from "./lib/projectScope";
import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { authedQuery, adminMutation } from "./lib/customFunctions";
import { approvedLeaveFields, canManageLeaves } from "./lib/leaveRules";
import { toPatch } from "./lib/nullablePatch";
import { calendarDays, LEAVE_ERRORS, leaveError, overlaps, validateLeaveRange } from "./lib/leaveValidation";

const leaveTypeValidator = v.union(
  v.literal("annual"), v.literal("sick"), v.literal("excuse"), v.literal("unpaid"),
  v.literal("parental"), v.literal("marriage"), v.literal("bereavement"),
  v.literal("paternity"), v.literal("lactation"), v.literal("compensatory"),
);
const statusValidator = v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected"));
const LEAVE_SCAN_LIMIT = 5000;

async function requireLeaveEmployee(ctx: QueryCtx | MutationCtx, employeeId: Id<"employees">, projectId?: Id<"projects">) {
  const employee = await ctx.db.get(employeeId);
  if (!employee?.projectId) return leaveError("LEAVE_EMPLOYEE_UNAVAILABLE");
  await resolveProjectScope(ctx, employee.projectId);
  if (projectId !== undefined && employee.projectId !== projectId) {
    return leaveError("LEAVE_PROJECT_MISMATCH");
  }
  return employee;
}

/** Shared by create/update. Legacy pending/rejected are read-only history, not reservations. */
export async function assertNoLeaveOverlap(
  ctx: MutationCtx,
  employeeId: Id<"employees">,
  startDate: string,
  endDate: string,
  excludeLeaveId?: Id<"leaves">,
) {
  const candidates = await ctx.db.query("leaves")
    .withIndex("by_employee_start", q => q.eq("employeeId", employeeId).lte("startDate", endDate))
    .order("desc").take(LEAVE_SCAN_LIMIT + 1);
  const conflict = candidates.find(leave => leave._id !== excludeLeaveId && leave.status === "approved"
    && overlaps(startDate, endDate, leave.startDate, leave.endDate));
  if (conflict) {
    throw new ConvexError({
      code: "LEAVE_OVERLAP", message: LEAVE_ERRORS.LEAVE_OVERLAP,
      conflictLeaveId: conflict._id, conflictStartDate: conflict.startDate, conflictEndDate: conflict.endDate,
      conflictLeaveType: conflict.leaveType,
    });
  }
  // Do not approve a write if the scan cannot establish that it is conflict-free.
  if (candidates.length > LEAVE_SCAN_LIMIT) leaveError("LEAVE_SCAN_LIMIT");
}

async function loadDepartments(ctx: QueryCtx, employees: Doc<"employees">[], projectId: Id<"projects">) {
  const ids = [...new Set(employees.flatMap(employee => employee.departmentId ? [employee.departmentId] : []))];
  const departments = (await Promise.all(ids.map(id => ctx.db.get(id))))
    .filter((department): department is NonNullable<typeof department> => department !== null);
  return new Map(departments.filter(department => department.projectId === projectId).map(department => [department._id, department.name]));
}

async function enrichLeavePage(ctx: QueryCtx, leaves: Doc<"leaves">[], projectId: Id<"projects">, notesHidden: boolean) {
  const employees = (await Promise.all([...new Set(leaves.map(leave => leave.employeeId))].map(id => ctx.db.get(id))))
    .filter((employee): employee is NonNullable<typeof employee> => employee !== null)
    .filter(employee => employee.projectId === projectId);
  const employeeMap = new Map(employees.map(employee => [employee._id, employee]));
  const departments = await loadDepartments(ctx, employees, projectId);
  return leaves.map(leave => {
    const employee = employeeMap.get(leave.employeeId);
    let days: number | null = null;
    try {
      days = calendarDays(leave.startDate, leave.endDate);
    } catch (error) {
      // Old writes accepted arbitrary strings: keep the historical row visible.
      if (!(error instanceof ConvexError)) throw error;
    }
    return {
      _id: leave._id, employeeId: leave.employeeId,
      employeeName: employee ? `${employee.firstName} ${employee.lastName}`.trim() : "Personel bulunamadı",
      departmentName: employee?.departmentId ? departments.get(employee.departmentId) : undefined,
      employeeMissing: employee === undefined,
      leaveType: leave.leaveType, startDate: leave.startDate, endDate: leave.endDate,
      calendarDays: days, status: leave.status, notes: notesHidden ? undefined : leave.notes, notesHidden,
      createdAt: leave.createdAt, updatedAt: leave.updatedAt,
    };
  });
}

const leaveFilterArgs = {
  projectId: v.id("projects"), rangeStart: v.string(), rangeEnd: v.string(),
  leaveType: v.optional(leaveTypeValidator), employeeId: v.optional(v.id("employees")),
  status: v.optional(statusValidator),
};
type LeaveFilters = {
  projectId: Id<"projects">; rangeStart: string; rangeEnd: string;
  leaveType?: Doc<"leaves">["leaveType"]; employeeId?: Id<"employees">; status?: Doc<"leaves">["status"];
};
function matchesLeaveFilters(leave: Doc<"leaves">, filters: LeaveFilters) {
  return leave.projectId === filters.projectId
    && overlaps(leave.startDate, leave.endDate, filters.rangeStart, filters.rangeEnd)
    && (filters.leaveType === undefined || leave.leaveType === filters.leaveType)
    && (filters.employeeId === undefined || leave.employeeId === filters.employeeId)
    && (filters.status === undefined || leave.status === filters.status);
}

/** Equality filters precede the end-date lower bound; overlap keeps legacy long leaves. */
export function filteredLeaves(ctx: QueryCtx, args: LeaveFilters) {
  const { employeeId, leaveType } = args;
  const source = stream(ctx.db, schema).query("leaves");
  const indexed = employeeId && leaveType
    ? source.withIndex("by_project_employee_type_end", q => q.eq("projectId", args.projectId).eq("employeeId", employeeId).eq("leaveType", leaveType).gte("endDate", args.rangeStart))
    : employeeId
      ? source.withIndex("by_project_employee_end", q => q.eq("projectId", args.projectId).eq("employeeId", employeeId).gte("endDate", args.rangeStart))
      : leaveType
        ? source.withIndex("by_project_type_end", q => q.eq("projectId", args.projectId).eq("leaveType", leaveType).gte("endDate", args.rangeStart))
        : source.withIndex("by_project_end", q => q.eq("projectId", args.projectId).gte("endDate", args.rangeStart));
  return indexed.order("desc").filterWith(async leave => matchesLeaveFilters(leave, args));
}
export const listPage = authedQuery({
  args: { ...leaveFilterArgs, paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await resolveProjectScope(ctx, args.projectId);
    calendarDays(args.rangeStart, args.rangeEnd);
    if (!Number.isInteger(args.paginationOpts.numItems) || args.paginationOpts.numItems < 1 || args.paginationOpts.numItems > 200) return leaveError("LEAVE_INVALID_PAGE_SIZE");
    const result = await filteredLeaves(ctx, args).paginate(args.paginationOpts);
    return { ...result, page: await enrichLeavePage(ctx, result.page, args.projectId, !canManageLeaves(ctx.user.role)) };
  },
});

// One bounded summary subscription, resumed by cursor; no 5000-row truncation.
export const summary = authedQuery({
  args: { ...leaveFilterArgs, paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await resolveProjectScope(ctx, args.projectId);
    calendarDays(args.rangeStart, args.rangeEnd);
    const result = await filteredLeaves(ctx, args).paginate({ ...args.paginationOpts, numItems: Math.min(500, args.paginationOpts.numItems) });
    const projectRecord = await ctx.db.query("leaves").withIndex("by_project", q => q.eq("projectId", args.projectId)).first();
    return { ...result, page: [{ _id: "summary:" + (args.paginationOpts.cursor ?? "first"), employeeIds: result.page.map(leave => leave.employeeId), recordCount: result.page.length, projectHasRecords: projectRecord !== null }] };
  },
});

export const conflictFor = authedQuery({
  args: { projectId: v.id("projects"), employeeId: v.id("employees"), startDate: v.string(), endDate: v.string(), excludeLeaveId: v.optional(v.id("leaves")) },
  handler: async (ctx, args) => {
    await requireLeaveEmployee(ctx, args.employeeId, args.projectId);
    validateLeaveRange(args.startDate, args.endDate);
    const conflict = await stream(ctx.db, schema).query("leaves")
      .withIndex("by_employee_start", q => q.eq("employeeId", args.employeeId).lte("startDate", args.endDate))
      .filterWith(async leave => leave._id !== args.excludeLeaveId && leave.status === "approved" && overlaps(args.startDate, args.endDate, leave.startDate, leave.endDate)).first();
    return conflict ? { id: conflict._id, start: conflict.startDate, end: conflict.endDate } : null;
  },
});

export const employeeOptions = authedQuery({
  args: { projectId: v.id("projects"), search: v.optional(v.string()), selectedId: v.optional(v.id("employees")) },
  handler: async (ctx, args) => {
    await resolveProjectScope(ctx, args.projectId);
    const selectedEmployee = args.selectedId ? await ctx.db.get(args.selectedId) : null;
    const selected = selectedEmployee?.projectId === args.projectId ? { _id: selectedEmployee._id, employeeName: `${selectedEmployee.firstName} ${selectedEmployee.lastName}`.trim() } : null;
    const search = args.search?.trim().toLocaleLowerCase("tr-TR") ?? "";
    const employees = await stream(ctx.db, schema).query("employees")
      .withIndex("by_project", q => q.eq("projectId", args.projectId))
      .filterWith(async employee => {
        if (employee.isActive === false || employee.isVisitor === true) return false;
        if (!search) return true;
        const department = employee.departmentId ? await ctx.db.get(employee.departmentId) : null;
        return `${employee.firstName} ${employee.lastName} ${department?.projectId === args.projectId ? department.name : ""}`.toLocaleLowerCase("tr-TR").includes(search);
      }).take(51);
    const departments = await loadDepartments(ctx, employees, args.projectId);
    const options = employees.slice(0, 50).map(employee => ({
      _id: employee._id, employeeName: `${employee.firstName} ${employee.lastName}`.trim(),
      departmentName: employee.departmentId ? departments.get(employee.departmentId) : undefined,
    })).sort((a, b) => a.employeeName.localeCompare(b.employeeName, "tr-TR") || a._id.localeCompare(b._id));
    return { selected, options, truncated: employees.length > 50 };
  },
});

export const create = adminMutation({
  args: {
    employeeId: v.id("employees"),
    projectId: v.optional(v.id("projects")),
    leaveType: leaveTypeValidator,
    startDate: v.string(),
    endDate: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const emp = await requireLeaveEmployee(ctx, args.employeeId, args.projectId);
    validateLeaveRange(args.startDate, args.endDate);
    await assertNoLeaveOverlap(ctx, args.employeeId, args.startDate, args.endDate);
    const now = new Date().toISOString();
    return await ctx.db.insert("leaves", {
      ...args,
      projectId: emp.projectId,
      ...approvedLeaveFields(ctx.user),
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = adminMutation({
  args: {
    leaveId: v.id("leaves"),
    leaveType: v.optional(leaveTypeValidator),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    notes: v.optional(v.union(v.string(), v.null())),
    expectedUpdatedAt: v.string(),
  },
  handler: async (ctx, args) => {
    const leave = await ctx.db.get(args.leaveId);
    if (!leave) return leaveError("LEAVE_NOT_FOUND");
    if (!leave.projectId) return leaveError("LEAVE_PROJECT_MISMATCH");
    await resolveProjectScope(ctx, leave.projectId);
    await requireLeaveEmployee(ctx, leave.employeeId, leave.projectId);
    if (leave.status !== "approved") return leaveError("LEAVE_READ_ONLY");
    if (leave.updatedAt !== args.expectedUpdatedAt) return leaveError("LEAVE_STALE");
    const startDate = args.startDate ?? leave.startDate;
    const endDate = args.endDate ?? leave.endDate;
    const datesChanged = (args.startDate !== undefined && args.startDate !== leave.startDate)
      || (args.endDate !== undefined && args.endDate !== leave.endDate);
    if (datesChanged) {
      validateLeaveRange(startDate, endDate);
      await assertNoLeaveOverlap(ctx, leave.employeeId, startDate, endDate, leave._id);
    }
    // Guarantee a new version even for two successful saves within one millisecond.
    const previous = Date.parse(leave.updatedAt);
    const updatedAt = new Date(Math.max(Date.now(), Number.isFinite(previous) ? previous + 1 : 0)).toISOString();
    await ctx.db.patch(leave._id, {
      ...toPatch({ leaveType: args.leaveType, startDate: args.startDate, endDate: args.endDate, notes: args.notes }),
      updatedAt,
    });
    return { leaveId: leave._id, updatedAt };
  },
});

export const listForRange = authedQuery({
  args: { startDate: v.string(), endDate: v.string(), projectId: v.optional(v.id("projects")) },
  handler: async (ctx, args) => {
    const projectIds = await resolveProjectScope(ctx, args.projectId);
    calendarDays(args.startDate, args.endDate);
    const results: Doc<"leaves">[] = [];
    for (const projectId of projectIds) {
      const candidates = await ctx.db.query("leaves")
        .withIndex("by_project_end", q => q.eq("projectId", projectId).gte("endDate", args.startDate))
        .take(LEAVE_SCAN_LIMIT + 1);
      if (candidates.length > LEAVE_SCAN_LIMIT) return leaveError("LEAVE_SCAN_LIMIT");
      results.push(...candidates.filter(leave => leave.status === "approved" && overlaps(leave.startDate, leave.endDate, args.startDate, args.endDate)));
    }
    return results;
  },
});
