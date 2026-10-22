import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { loadPdksPolicies } from "./pdksRules";
import { employedDuring, employedOn } from "./employment";
import { canSeePay } from "./payVisibility";
import { resolveProjectScope } from "./projectScope";
import { getEffectiveWorkSettings, getEffectiveOvertimeRates, getHolidaysMap } from "./pdksHelpers";
import { buildShiftResolver } from "./shiftResolver";
import { overtimePeriodRange } from "./overtimeCalc";
import { buildPeriodDateKeys } from "./pdksCalc";
import { addWorkDate, buildPdksWorkDateResolver, hasFlexiblePdksShift, pdksWorkDayRange } from "./pdksWorkDay";
import { pdksAvailableDatesByProject, pdksManualDatesByEmployee, pdksLeaveMatchesProject, pdksFirstRecordDate } from "./pdksAvailability";
import { trDateKey, trTodayKey } from "./trDate";
import { countExcludedUnknownPdksReadings, filterPdksReadings } from "./pdksSource";
import { buildPdksEmployeeReadingMap, computePdksTableRow, filterPdksTableRows, type PdksTableStatusFilter } from "./pdksTable";

export type PdksTableQueryArgs = {
  projectId?: Id<"projects">;
  date?: string;
  startDate?: string;
  endDate?: string;
  companyId?: Id<"companies">;
  departmentId?: Id<"departments">;
  positionId?: Id<"positions">;
  shiftId?: Id<"shifts">;
  statusFilter?: PdksTableStatusFilter;
  person?: string;
  employeeId?: Id<"employees">;
  viewMode?: "single" | "matrix";
  includePunches?: boolean;
};

/** Preserve this query's own calculation and database read ordering. */
export async function getPdksTableData(
  ctx: QueryCtx & { user: Doc<"users"> },
  args: PdksTableQueryArgs,
  helpers: {
    scopedPdksShift: (shift: Doc<"shifts"> | null, projectId?: Id<"projects">) => Doc<"shifts"> | null;
    flexiblePreviousReadings: (ctx: QueryCtx, startDate: string, projectIds: readonly Id<"projects">[] | undefined, employee?: Doc<"employees">) => Promise<Doc<"cardReadings">[]>;
  },
) {
  const { scopedPdksShift, flexiblePreviousReadings } = helpers;
  const payVisible = canSeePay(ctx.user);
  const allowedProjectIds = await resolveProjectScope(ctx, args.projectId);

  const today = args.date ?? trTodayKey();
  const startDate = args.startDate ?? today;
  const endDate = args.endDate ?? today;
  const referenceProjectId = args.projectId ?? (
    ctx.user.role === "super_admin" && !args.projectId
      ? undefined
      : allowedProjectIds[0] ?? undefined);
  const overtimeRates = await getEffectiveOvertimeRates(ctx, referenceProjectId);
  const overtimeRange = overtimePeriodRange(startDate, endDate, overtimeRates.overtimeBasis, overtimeRates.nightShiftDayMode);
  const { startISO, endISO } = pdksWorkDayRange(overtimeRange.startDate, overtimeRange.endDate);
  const isSingleDay = startDate === endDate;
  const viewMode = args.viewMode ?? "single";

  let readings;
  let employees: Doc<"employees">[];
  if (ctx.user.role === "super_admin" && !args.projectId) {
    [readings, employees] = await Promise.all([
      ctx.db
        .query("cardReadings")
        .withIndex("by_access_time", (q) =>
          q.gte("accessTime", startISO).lte("accessTime", endISO)
        )
        .collect(),
      ctx.db
        .query("employees")
        .collect(),
    ]);
  } else if (allowedProjectIds.length > 0) {
    const [readingResults, empResults] = await Promise.all([
      Promise.all(
        allowedProjectIds.map((pid) =>
          ctx.db
            .query("cardReadings")
            .withIndex("by_project_access_time", (q) =>
              q.eq("projectId", pid).gte("accessTime", startISO).lte("accessTime", endISO)
            )
            .collect()
        )
      ),
      Promise.all(
        allowedProjectIds.map((pid) =>
          ctx.db
            .query("employees")
            .withIndex("by_project", (q) => q.eq("projectId", pid))
            .collect()
        )
      ),
    ]);
    readings = readingResults.flat();
    employees = empResults.flat();
  } else {
    return [];
  }

  employees = employees.filter(employee => employedDuring(employee, startDate, endDate));
  const availabilityEmployees = employees;
  if (args.employeeId) employees = employees.filter(e => e._id === args.employeeId);

  // Çalışan filtreleri (company/department/position/shift/person)
  if (args.companyId) {
    employees = employees.filter((e) => e.companyId === args.companyId);
  }
  if (args.departmentId) {
    employees = employees.filter((e) => e.departmentId === args.departmentId);
  }
  if (args.positionId) {
    employees = employees.filter((e) => e.positionId === args.positionId);
  }
  if (args.shiftId) {
    employees = employees.filter((e) => e.shiftId === args.shiftId);
  }
  if (args.person && args.person.trim()) {
    const term = args.person.trim().toLocaleLowerCase("tr-TR");
    employees = employees.filter((e) =>
      `${e.firstName} ${e.lastName}`.toLocaleLowerCase("tr-TR").includes(term)
    );
  }

  const tableBoundaryShiftResolver = await buildShiftResolver(ctx, availabilityEmployees);
  const tableHasFlexible = [...tableBoundaryShiftResolver.shifts.values()].some(shift => shift.scheduleType === "flexible") && hasFlexiblePdksShift(availabilityEmployees, (id, date) => scopedPdksShift(tableBoundaryShiftResolver.resolve(id, date), args.projectId), overtimeRange.startDate, overtimeRange.endDate);
  if (tableHasFlexible) readings = [...await flexiblePreviousReadings(ctx, overtimeRange.startDate, ctx.user.role === "super_admin" && !args.projectId ? undefined : allowedProjectIds), ...readings];
  const sourceReadings = readings;
  const earlyTableRecords = tableHasFlexible ? await Promise.all(availabilityEmployees.map(emp => ctx.db.query("pdksRecords")
    .withIndex("by_employee_date", q => q.eq("employeeId", emp._id).gte("date", addWorkDate(overtimeRange.startDate, -1)).lte("date", addWorkDate(overtimeRange.endDate, 1))).take(1001))) : undefined;
  if (earlyTableRecords?.some(records => records.length > 1000)) throw new Error("Manuel kayıt sınırı aşıldı; tarih aralığını daraltın");
  const tableBoundaryManual = new Map((earlyTableRecords ?? []).flat().filter(record => record.manualEntry && (!args.projectId || record.projectId === args.projectId)).map(record => [`${record.employeeId}__${record.date}`, record]));
  const tableBoundaryWorkDate = buildPdksWorkDateResolver(availabilityEmployees, (id, date) => scopedPdksShift(tableBoundaryShiftResolver.resolve(id, date), args.projectId), { readings: sourceReadings, manualEntryFor: (id, date) => tableBoundaryManual.get(`${id}__${date}`)?.entryTime, eligibleEntry: r => filterPdksReadings([r], args.projectId, candidate => policies(candidate.projectId, trDateKey(candidate.accessTime))).length > 0 });
  const policies = await loadPdksPolicies(ctx, availabilityEmployees.map(e => e.projectId), tableHasFlexible ? addWorkDate(overtimeRange.startDate, -1) : overtimeRange.startDate, overtimeRange.endDate);
  readings = filterPdksReadings(readings, args.projectId, r => policies(r.projectId, tableBoundaryWorkDate(r)));

  readings.sort(
    (a, b) => new Date(a.accessTime).getTime() - new Date(b.accessTime).getTime()
  );

  const empById = new Map<string, Doc<"employees">>();
  for (const emp of employees) {
    empById.set(String(emp._id), emp);
  }
  const employeeMap = buildPdksEmployeeReadingMap({ employees, readings });

  // Settings & holidays per project (super_admin için global = undefined)
  const [workSettings, holidayMap, generalSettings, shiftResolver] =
    await Promise.all([
      getEffectiveWorkSettings(ctx, referenceProjectId),
      getHolidaysMap(ctx, referenceProjectId, overtimeRange.startDate, addWorkDate(overtimeRange.endDate, 1)),
      ctx.db
        .query("generalSettings")
        .withIndex("by_project", (q) => q.eq("projectId", referenceProjectId))
        .first(),
      Promise.resolve(tableBoundaryShiftResolver),
    ]);
  const workingDays =
    generalSettings?.workingDays && generalSettings.workingDays.length > 0
      ? generalSettings.workingDays
      : ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma"];

  // pdksRecords manuel override haritası
  const manualPdksByEmpDate = new Map<string, Doc<"pdksRecords">>();
  const periodEmployees = Array.from(employeeMap.keys())
    .map((empKey) => empById.get(empKey))
    .filter((emp): emp is NonNullable<typeof emp> => emp !== undefined);
  const recsByEmployee = earlyTableRecords ?? await Promise.all(
    periodEmployees.map((emp) =>
      ctx.db
        .query("pdksRecords")
        .withIndex("by_employee_date", (q) =>
          q.eq("employeeId", emp._id).gte("date", overtimeRange.startDate).lte("date", overtimeRange.endDate)
        )
        .collect()
    )
  );
  for (const recs of recsByEmployee) {
    for (const r of recs) {
      if (r.manualEntry && (!args.projectId || r.projectId === args.projectId)) {
        manualPdksByEmpDate.set(`${String(r.employeeId)}__${r.date}`, r);
      }
    }
  }

  const allLeaves = (await Promise.all(employees.map(emp => ctx.db.query("leaves")
    .withIndex("by_employee_start", q => q.eq("employeeId", emp._id).lte("startDate", endDate)).collect())))
    .flat().filter(l => l.status === "approved" && l.endDate >= startDate);

  const periodDateKeys = buildPeriodDateKeys(startDate, endDate);

  const tableDepartments = await Promise.all([...new Set(employees.flatMap(e => e.departmentId ? [e.departmentId] : []))].map(id => ctx.db.get(id)));
  const tableDeptById = new Map(tableDepartments.filter((d): d is NonNullable<typeof d> => d !== null).map((d) => [String(d._id), d]));

  const tableWorkDate = [...tableBoundaryShiftResolver.shifts.values()].some(shift => shift.scheduleType === "flexible") ? buildPdksWorkDateResolver(availabilityEmployees, (id, date) => scopedPdksShift(tableBoundaryShiftResolver.resolve(id, date), args.projectId), { readings, manualEntryFor: (id, date) => manualPdksByEmpDate.get(`${id}__${date}`)?.entryTime }) : tableBoundaryWorkDate;
  const tablePeriodDates = new Set(periodDateKeys);
  const sourceReadingsByEmployee = buildPdksEmployeeReadingMap({
    employees,
    readings: sourceReadings.filter(r => tablePeriodDates.has(tableWorkDate(r))),
  });
  const tableAvailableDates = pdksAvailableDatesByProject(readings, tableWorkDate);
  const tableManualDates = pdksManualDatesByEmployee(manualPdksByEmpDate.values());
  const tableData = await Promise.all(
    Array.from(employeeMap.entries()).map(async ([empKey, empReadings]) => {
      const employee = empById.get(empKey) ?? null;
      const department = employee?.departmentId
        ? tableDeptById.get(String(employee.departmentId)) ?? null
        : null;
      const empId = employee?._id;
      const manualToday =
        isSingleDay && empId
          ? manualPdksByEmpDate.get(`${empKey}__${startDate}`)
          : undefined;
      const editor = manualToday?.editedBy
        ? await ctx.db.get(manualToday.editedBy)
        : null;

      const firstRecordDate = employee ? await pdksFirstRecordDate(ctx, employee, empReadings, tableManualDates.get(employee._id) ?? [], tableWorkDate, policies) : null;
      const row = computePdksTableRow({
        policyFor: date => policies(employee?.projectId, date),
        availableDateKeys: tableAvailableDates.get(employee?.projectId) ?? new Set<string>(),
        firstRecordDate,
        empKey,
        empReadings,
        // Stored pay fields are optional numbers; absent inputs resolve to null pay.
        employee: employee ? {
          ...employee,
          hourlyRate: payVisible ? employee.hourlyRate : undefined,
          monthlySalary: payVisible ? employee.monthlySalary : undefined,
        } : null,
        departmentName: department?.projectId === employee?.projectId ? department?.name ?? "" : "",
        periodDateKeys: periodDateKeys.filter(date => !employee || employedOn(employee, date)),
        startDate,
        isSingleDay,
        viewMode,
        includePunches: args.includePunches,
        manualPdksByEmpDate,
        allLeaves: allLeaves.filter(l => l.employeeId === employee?._id && pdksLeaveMatchesProject(l, employee?.projectId)),
        holidayMap,
        workingDays,
        workSettings,
        overtimeRates,
        resolveShift: (employeeId, dateISO) => {
          const shift = shiftResolver.resolve(employeeId, dateISO);
          return scopedPdksShift(shift, args.projectId);
        },
        manualEditedBy: editor?.fullName ?? editor?.name ?? editor?.email ?? null,
      });
      return {
        ...row,
        excludedUnknownReadings: countExcludedUnknownPdksReadings(
          sourceReadingsByEmployee.get(empKey) ?? [],
          employee?.projectId,
        ),
      };
    })
  );

  // Status filtresi (frontend'den önce sunucu tarafında uygula)
  const filtered = filterPdksTableRows(tableData, args.statusFilter);

  return filtered.sort((a, b) => a.name.localeCompare(b.name, "tr"));
}
