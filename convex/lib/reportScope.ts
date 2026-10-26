import { resolveProjectScope } from "./projectScope";
import { accessBlockReason } from "./accountAccess";
import { getCurrentUser } from "./auth";
import { getProjectIdsWithPermission, requirePermission } from "./permissions";
import { hasVersionedPdksPolicy, loadPdksPolicies, type PdksProjectPolicies } from "./pdksRules";
import { buildBoundedShiftResolver } from "./shiftResolver";
import { buildPdksWorkDateResolver, addWorkDate, isOvernightShift } from "./pdksWorkDay";
import { trDateKey } from "./trDate";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { selectProjectScope } from "./projectScope";
import { filterPdksReadings } from "./pdksSource";

export function reportPeriod(year: number, month?: number) {
  if (!Number.isInteger(year) || year < 1900 || year > 2100 ||
      (month !== undefined && (!Number.isInteger(month) || month < 1 || month > 12))) {
    throw new Error("Geçerli bir yıl ve ay seçin");
  }
  return {
    startDate: `${year}-${String(month ?? 1).padStart(2, "0")}-01`,
    endDate: `${year}-${String(month ?? 12).padStart(2, "0")}-${new Date(Date.UTC(year, month ?? 12, 0)).getUTCDate()}`,
  };
}

export async function reportScopeLabel(ctx: QueryCtx, projectIds: Id<"projects">[], all: boolean) {
  const projects = (await Promise.all(projectIds.map((id) => ctx.db.get(id))))
    .filter((p): p is NonNullable<typeof p> => p !== null);
  return `${all ? "Tüm erişilebilir projeler: " : ""}${projects.map((p) => p.name).join(", ") || "Erişilebilir proje yok"}`;
}

export async function resolveReportScope(ctx: QueryCtx & { user?: Doc<"users"> }, projectId?: Id<"projects">) {
  const user = ctx.user ?? await getCurrentUser(ctx);
  if (!user) throw new Error("Bu işlem için yetkiniz yok");
  await resolveProjectScope(ctx, projectId);
  if (projectId) await requirePermission(ctx, user, projectId, "reports.view");
  const allowed = await getProjectIdsWithPermission(ctx, user, "reports.view");
  const projectIds = selectProjectScope(allowed, projectId);
  return { projectIds, scopeLabel: await reportScopeLabel(ctx, projectIds, projectId === undefined) };
}

export async function readReportReadings(ctx: QueryCtx, projectIds: Id<"projects">[], startISO: string, endISO: string, prepared?: { policies: PdksProjectPolicies; workDate?: (reading: Doc<"cardReadings">) => string; raw?: boolean }) {
  const startDate = addWorkDate(trDateKey(startISO), -1);
  const endDate = trDateKey(endISO);
  const policies = prepared?.policies ?? await loadPdksPolicies(ctx, projectIds, startDate, endDate);
  const activeProjects = projectIds.filter(id => hasVersionedPdksPolicy(policies, id, startDate, endDate));
  const readings = (await Promise.all(projectIds.map(projectId => {
    const query = ctx.db.query("cardReadings").withIndex("by_project_access_time", q => q.eq("projectId", projectId).gte("accessTime", startISO).lte("accessTime", endISO));
    // Preserve the pre-W5 legacy bound/range exactly; only versioned projects use the new cap.
    return (activeProjects.includes(projectId) || prepared?.raw) ? query.take(20001) : query.collect();
  }))).flat();
  if ((prepared?.raw ? readings.length : readings.filter(r => r.projectId && activeProjects.includes(r.projectId)).length) > 20000) throw new Error("Rapor okuma sınırı aşıldı; tarih aralığını daraltın");
  if (prepared?.raw) return readings;
  if (!activeProjects.length) return filterPdksReadings(readings);
  let workDate = prepared?.workDate;
  if (!workDate) {
    const employees = (await Promise.all(activeProjects.map(projectId => ctx.db.query("employees").withIndex("by_project", q => q.eq("projectId", projectId)).take(10001)))).flat();
    if (employees.length > 10000) throw new Error("Rapor personel sınırı aşıldı; proje seçin");
    const shifts = await buildBoundedShiftResolver(ctx, employees);
    const flexible = [...shifts.shifts.values()].some(shift => shift.scheduleType === "flexible");
    const manualLists = flexible ? await Promise.all(employees.map(employee => ctx.db.query("pdksRecords")
      .withIndex("by_employee_date", q => q.eq("employeeId", employee._id).gte("date", startDate).lte("date", endDate)).take(1001))) : [];
    const manual = manualLists.flat();
    if (manualLists.some(list => list.length > 1000) || manual.length > 10000) throw new Error("Rapor manuel kayıt sınırı aşıldı; tarih aralığını daraltın");
    const manualByDate = new Map(manual.filter(record => record.manualEntry && record.projectId !== undefined && projectIds.includes(record.projectId)).map(record => [`${record.employeeId}__${record.date}`, record]));
    workDate = buildPdksWorkDateResolver(employees, shifts.resolve, flexible ? {
      readings, manualEntryFor: (id, date) => manualByDate.get(`${id}__${date}`)?.entryTime,
      eligibleEntry: reading => filterPdksReadings([reading], undefined, r => policies(r.projectId, trDateKey(r.accessTime))).length > 0,
    } : undefined, (reading, date) => policies(reading.projectId, date), shifts.resolveLast);
  }
  const dateFor = workDate;
  return filterPdksReadings(readings, undefined, r => policies(r.projectId, dateFor(r)));
}

export function selectScheduleProjectIds(user: Doc<"users"> | null, allowed: Id<"projects">[], projectId?: Id<"projects">) {
  if (!user || user.verified === false || accessBlockReason(user, Date.now()) !== null) return null;
  if (projectId && !allowed.includes(projectId)) return null;
  const projectIds = selectProjectScope(allowed, projectId);
  return projectIds.length ? projectIds : null;
}

/** Cron'da oturum yoktur: kayıt sahibinin güncel rolü ve üyelikleri DB'den doğrulanır. */
export async function resolveScheduleScope(ctx: QueryCtx, schedule: Doc<"reportScheduleSettings">) {
  const user = await ctx.db.get(schedule.userId);
  if (!user || user.verified === false || accessBlockReason(user, Date.now()) !== null) return null;
  const allowed = await getProjectIdsWithPermission({ ...ctx, user }, user, "reports.view");
  const projectIds = selectScheduleProjectIds(user, allowed, schedule.projectId);
  if (!projectIds) return null;
  return { projectIds, scopeLabel: await reportScopeLabel(ctx, projectIds, schedule.projectId === undefined) };
}

/** Discover actual usage before opening any per-employee assignment queries.
 * Reuse the bounded project employee scan when a managed report is loaded. */
export async function flexibleReportProjects(
  ctx: QueryCtx, projectIds: readonly Id<"projects">[], startDate: string, endDate: string,
  employeesByProject = new Map<Id<"projects">, Doc<"employees">[]>(),
  matchesShift: (shift: Doc<"shifts">) => boolean = shift => shift.scheduleType === "flexible",
) {
  if (!projectIds.length) return new Set<Id<"projects">>();
  const scopes = [...new Set<Id<"projects"> | undefined>([...projectIds, undefined])];
  const definitions = await Promise.all(scopes.map(projectId => ctx.db.query("shifts")
    .withIndex("by_project", q => q.eq("projectId", projectId)).take(1001)));
  if (definitions.some(list => list.length > 1000)) throw new Error("Vardiya tanımı sınırı aşıldı; proje kapsamını daraltın");
  const candidates = definitions.flat().filter(matchesShift);
  const projects = new Set<Id<"projects">>();
  const dayBefore = addWorkDate(startDate, -1);
  const assignmentsByShift = new Map<Id<"shifts">, Doc<"shiftAssignments">[]>();
  for (const projectId of projectIds) {
    // Existence probes only: a hit selects the bounded resolver, which verifies dates and ownership.
    // Refs avoid scanning an arbitrarily large legacy assignment history just to discover plans.
    // Expired refs may select this path indefinitely: only a performance cost; the bounded resolver keeps results correct.
    const [planRef, department] = await Promise.all([
      ctx.db.query("shiftPlanRefs").withIndex("by_project", q => q.eq("projectId", projectId)).first(),
      ctx.db.query("departmentShiftAssignments").withIndex("by_project_end", q => q.eq("projectId", projectId).gte("endDate", dayBefore)).first(),
    ]);
    if (planRef || department) {
      projects.add(projectId);
      continue;
    }
    const relevant = candidates.filter(shift => !shift.projectId || shift.projectId === projectId);
    if (!relevant.length) continue;
    let employees = employeesByProject.get(projectId);
    if (!employees) {
      employees = await ctx.db.query("employees").withIndex("by_project", q => q.eq("projectId", projectId)).take(10001);
      if (employees.length > 10000) throw new Error("Esnek vardiya keşfi personel sınırı aşıldı; proje kapsamını daraltın");
      employeesByProject.set(projectId, employees);
    }
    const shiftIds = new Set(relevant.map(shift => shift._id));
    if (employees.some(employee => employee.shiftId && shiftIds.has(employee.shiftId))) {
      projects.add(projectId);
      continue;
    }
    const employeeIds = new Set(employees.map(employee => employee._id));
    for (const shift of relevant) {
      let assignments = assignmentsByShift.get(shift._id);
      if (!assignments) {
        // Newest first: recent assignments are the ones likely to intersect the period.
        assignments = await ctx.db.query("shiftAssignments").withIndex("by_shift", q => q.eq("shiftId", shift._id)).order("desc").take(1001);
        assignmentsByShift.set(shift._id, assignments);
      }
      // Fail-safe: a truncated assignment list cannot prove non-use, so take the flexible path.
      if (assignments.length > 1000 || assignments.some(assignment => (assignment.projectId === projectId || assignment.projectId === undefined)
          && employeeIds.has(assignment.employeeId) && assignment.startDate <= endDate
          && assignment.endDate >= ((shift.scheduleType === "flexible" ? shift.flexible?.checkOutEndDayOffset === 1 : isOvernightShift(shift)) ? dayBefore : startDate))) {
        projects.add(projectId);
        break;
      }
    }
  }
  return projects;
}
