import { ConvexError } from "convex/values";
import { slotForDate, planShiftIds } from "./shiftPlan";
import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { parseHHMM, type EffectiveWorkSettings } from "./pdksHelpers";

type AnyCtx = QueryCtx | MutationCtx;

const WEEKDAY_CODES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

export function weekdayCodeForDate(dateISO: string): string {
  const d = new Date(`${dateISO}T00:00:00.000Z`);
  return WEEKDAY_CODES[d.getUTCDay()];
}

export function assignmentAppliesOnDate(
  assignment: Pick<Doc<"shiftAssignments">, "startDate" | "endDate" | "weekPattern">,
  dateISO: string,
): boolean {
  if (dateISO < assignment.startDate || dateISO > assignment.endDate) return false;
  const pattern = assignment.weekPattern;
  if (!pattern || pattern.length === 0) return true;
  return pattern.includes(weekdayCodeForDate(dateISO));
}

export type DayPlan =
  | { kind: "shifts"; shifts: Doc<"shifts">[]; source: "employee" | "department"; calendar: "project" | "plan";
      assignmentId?: Id<"shiftAssignments">; departmentAssignmentId?: Id<"departmentShiftAssignments">; departmentId?: Id<"departments"> }
  | { kind: "rest"; source: "employee" | "department"; calendar: "plan";
      assignmentId?: Id<"shiftAssignments">; departmentAssignmentId?: Id<"departmentShiftAssignments">; departmentId?: Id<"departments"> }
  | { kind: "none"; source: "project" };
export interface ShiftResolver {
  resolve(employeeId: Id<"employees">, dateISO: string): Doc<"shifts"> | null;
  resolveLast(employeeId: Id<"employees">, dateISO: string): Doc<"shifts"> | null;
  resolvePlan(employeeId: Id<"employees">, dateISO: string): DayPlan;
  shifts: Map<string, Doc<"shifts">>;
}
export interface ResolverRange { start: string; end: string }
export const DEPARTMENT_READ_LIMIT = 2000;
export const DEPARTMENT_CHAIN_LIMIT = 32;

/** Range-index reads order by endDate; keep rows starting by range.end and restore creation order so equal updatedAt ties match the unbounded by_employee/by_project reads. */
function startingByRangeEnd<T extends { startDate: string; _creationTime: number }>(rows: T[], range?: ResolverRange): T[] {
  return rows.filter(row => !range || row.startDate <= range.end).sort((a, b) => a._creationTime - b._creationTime);
}

export async function readDepartmentPlans(ctx: AnyCtx, projectIds: Id<"projects">[], range?: ResolverRange) {
  const departments: Doc<"departments">[] = [];
  const assignments: Doc<"departmentShiftAssignments">[] = [];
  for (const projectId of new Set(projectIds)) {
    const rows = await ctx.db.query("departmentShiftAssignments").withIndex("by_project_end", q => range
      ? q.eq("projectId", projectId).gte("endDate", new Date(Date.parse(range.start) - 86_400_000).toISOString().slice(0, 10))
      : q.eq("projectId", projectId)).take(DEPARTMENT_READ_LIMIT + 1);
    if (rows.length > DEPARTMENT_READ_LIMIT) throw new ConvexError("Departman vardiya okuma sınırı aşıldı; tarih aralığını daraltın");
    const relevant = startingByRangeEnd(rows, range);
    // A project with no applicable department assignments retains the legacy path,
    // irrespective of how large its department tree is.
    if (!relevant.length) continue;
    const depts = await ctx.db.query("departments").withIndex("by_project", q => q.eq("projectId", projectId)).take(DEPARTMENT_READ_LIMIT + 1);
    if (depts.length > DEPARTMENT_READ_LIMIT) throw new ConvexError("Departman vardiya okuma sınırı aşıldı; tarih aralığını daraltın");
    departments.push(...depts);
    assignments.push(...relevant);
  }
  return { departments, assignments };
}
export async function buildShiftResolver(ctx: AnyCtx, employees: Doc<"employees">[], range?: ResolverRange): Promise<ShiftResolver> {
  const [allShifts, assignmentLists, departmentData] = await Promise.all([
    ctx.db.query("shifts").collect(),
    Promise.all(employees.map(employee => ctx.db.query("shiftAssignments").withIndex("by_employee", q => q.eq("employeeId", employee._id)).collect())),
    readDepartmentPlans(ctx, employees.flatMap(employee => employee.projectId && employee.departmentId ? [employee.projectId] : []), range),
  ]);
  return createShiftResolver(employees, allShifts, assignmentLists, departmentData.departments, departmentData.assignments);
}

/** Versioned/mobile paths load only referenced shifts and bounded assignments. */
export async function buildBoundedShiftResolver(ctx: AnyCtx, employees: Doc<"employees">[], range?: ResolverRange): Promise<ShiftResolver> {
  const [assignmentLists, departmentData] = await Promise.all([
    Promise.all(employees.map(employee => (range
      ? ctx.db.query("shiftAssignments").withIndex("by_employee_end", q => q.eq("employeeId", employee._id).gte("endDate", range.start))
      : ctx.db.query("shiftAssignments").withIndex("by_employee", q => q.eq("employeeId", employee._id))).take(1001))),
    readDepartmentPlans(ctx, employees.flatMap(employee => employee.projectId && employee.departmentId ? [employee.projectId] : []), range),
  ]);
  if (assignmentLists.some(list => list.length > 1000) || assignmentLists.flat().length > 10000) throw new ConvexError("Vardiya atama sınırı aşıldı; tarih aralığını daraltın");
  const relevantLists = assignmentLists.map(list => startingByRangeEnd(list, range));
  const rows = [...relevantLists.flat(), ...departmentData.assignments];
  const ids = [...new Set(rows.flatMap(row => [row.shiftId, ...planShiftIds(row.plan)]))];
  const allShifts = (await Promise.all(ids.map(id => ctx.db.get(id)))).filter((shift): shift is NonNullable<typeof shift> => shift !== null);
  return createShiftResolver(employees, allShifts, relevantLists, departmentData.departments, departmentData.assignments);
}

/** Compute once per department; ignore corrupt cycles and cross-project parents. */
export function departmentChain(departmentId: Id<"departments"> | undefined, projectId: Id<"projects"> | undefined, departments: ReadonlyMap<string, Doc<"departments">>): Id<"departments">[] {
  const chain: Id<"departments">[] = [];
  const seen = new Set<string>();
  let current = departmentId;
  while (current && chain.length < DEPARTMENT_CHAIN_LIMIT && !seen.has(current)) {
    seen.add(current);
    const department = departments.get(current);
    if (!department || department.projectId !== projectId) break;
    chain.push(current);
    current = department.parentId;
  }
  return chain;
}
export function createShiftResolver(employees: Doc<"employees">[], allShifts: Doc<"shifts">[], assignmentLists: Doc<"shiftAssignments">[][],
  departments: Doc<"departments">[] = [], departmentAssignments: Doc<"departmentShiftAssignments">[] = []): ShiftResolver {
  const shiftMap = new Map<string, Doc<"shifts">>(allShifts.map(shift => [shift._id, shift]));
  const assignmentsByEmp = new Map<string, Doc<"shiftAssignments">[]>();
  employees.forEach((employee, index) => assignmentsByEmp.set(employee._id, (assignmentLists[index] ?? []).slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))));
  const assignmentsByDepartment = new Map<string, Doc<"departmentShiftAssignments">[]>();
  for (const row of departmentAssignments) {
    const list = assignmentsByDepartment.get(row.departmentId) ?? [];
    list.push(row);
    assignmentsByDepartment.set(row.departmentId, list);
  }
  for (const list of assignmentsByDepartment.values()) list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const departmentMap = new Map(departments.map(department => [String(department._id), department]));
  const chains = new Map<string, Id<"departments">[]>();
  const empById = new Map(employees.map(employee => [String(employee._id), employee]));
  const memo = new Map<string, DayPlan>();
  function rowPlan(row: Doc<"shiftAssignments"> | Doc<"departmentShiftAssignments">, date: string): DayPlan | null {
    const ids = slotForDate(row, date);
    if (ids === null) return null;
    const source = "employeeId" in row ? { source: "employee" as const, assignmentId: row._id }
      : { source: "department" as const, departmentAssignmentId: row._id, departmentId: row.departmentId };
    if (ids.length === 0) return { kind: "rest", ...source, calendar: "plan" };
    const shifts = ids.map(id => shiftMap.get(id));
    if (shifts.some(shift => shift === undefined)) return null;
    return { kind: "shifts", shifts: shifts.filter((shift): shift is Doc<"shifts"> => shift !== undefined), ...source,
      calendar: row.plan && row.plan.kind !== "weekly" ? "plan" : "project" };
  }
  function uncached(employeeId: Id<"employees">, date: string): DayPlan {
    for (const row of assignmentsByEmp.get(employeeId) ?? []) {
      const plan = rowPlan(row, date);
      if (plan) return plan;
    }
    const employee = empById.get(employeeId);
    if (employee?.departmentId) {
      const key = `${employee.projectId}|${employee.departmentId}`;
      let chain = chains.get(key);
      if (!chain) { chain = departmentChain(employee.departmentId, employee.projectId, departmentMap); chains.set(key, chain); }
      for (const departmentId of chain) {
        for (const row of assignmentsByDepartment.get(departmentId) ?? []) {
          if (row.projectId !== employee.projectId) continue;
          const plan = rowPlan(row, date);
          if (plan) return plan;
        }
      }
    }
    return { kind: "none", source: "project" };
  }
  function resolvePlan(employeeId: Id<"employees">, date: string): DayPlan {
    const key = `${employeeId}|${date}`;
    const cached = memo.get(key);
    if (cached) return cached;
    const plan = uncached(employeeId, date);
    memo.set(key, plan);
    return plan;
  }
  return {
    shifts: shiftMap, resolvePlan,
    resolve(employeeId, date) { const plan = resolvePlan(employeeId, date); return plan.kind === "shifts" ? plan.shifts[0] ?? null : null; },
    resolveLast(employeeId, date) { const plan = resolvePlan(employeeId, date); return plan.kind === "shifts" ? plan.shifts[plan.shifts.length - 1] ?? null : null; },
  };
}

export interface ShiftThresholds {
  lateThresholdMin: number;
  earlyThresholdMin: number;
  shiftStartMin: number;
  shiftEndMin: number;
}

export function thresholdsForShift(
  shift: Doc<"shifts"> | null,
  settings: EffectiveWorkSettings,
): ShiftThresholds {
  // Flexible windows are eligibility bounds, never lateness/early-exit hours.
  if (shift?.scheduleType === "flexible") return {
    shiftStartMin: 0, shiftEndMin: 1440, lateThresholdMin: 1440, earlyThresholdMin: 0,
  };
  const startStr = shift?.startTime ?? settings.workStartTime;
  const endStr = shift?.endTime ?? settings.workEndTime;
  const shiftStartMin = parseHHMM(startStr);
  const shiftEndMin = parseHHMM(endStr);
  const lateTolerance = shift?.lateToleranceMinutes ?? settings.maxLateMinutes;
  const earlyTolerance =
    shift?.earlyExitToleranceMinutes ?? settings.earlyExitToleranceMinutes;
  return {
    shiftStartMin,
    shiftEndMin,
    lateThresholdMin: shiftStartMin + lateTolerance,
    earlyThresholdMin: shiftEndMin - earlyTolerance,
  };
}

export function settingsForShift(
  shift: Doc<"shifts"> | null,
  settings: EffectiveWorkSettings,
): EffectiveWorkSettings {
  if (!shift) return settings;
  return {
    ...settings,
    workStartTime: shift.startTime,
    workEndTime: shift.endTime,
    maxLateMinutes: shift.lateToleranceMinutes ?? settings.maxLateMinutes,
    earlyExitToleranceMinutes:
      shift.earlyExitToleranceMinutes ?? settings.earlyExitToleranceMinutes,
  };
}
