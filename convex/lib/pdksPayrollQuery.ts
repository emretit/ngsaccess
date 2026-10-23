import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { loadPdksPolicies } from "./pdksRules";
import { employedDuring, employedOn } from "./employment";
import { canSeePayInProject } from "./payVisibility";
import { resolveProjectScope } from "./projectScope";
import { getEffectiveWorkSettings, getEffectiveOvertimeRates, getHolidaysMap, resolveHourlyRate } from "./pdksHelpers";
import { buildShiftResolver } from "./shiftResolver";
import { overtimePeriodRange, calculatePeriodOvertime } from "./overtimeCalc";
import { buildPeriodDateKeys } from "./pdksCalc";
import { addWorkDate, buildPdksWorkDateResolver, hasFlexiblePdksShift, pdksWorkDayRange, groupPdksWorkDays } from "./pdksWorkDay";
import { pdksAvailableDatesByProject, pdksManualDatesByEmployee, pdksLeaveMatchesProject, pdksFirstRecordDate } from "./pdksAvailability";
import { trDateKey } from "./trDate";
import { filterPdksReadings } from "./pdksSource";
import { buildPdksEmployeeReadingMap } from "./pdksTable";
import { computePayrollCell } from "./pdksPayroll";

export type PdksPayrollQueryArgs = {
  projectId?: Id<"projects">;
  year: number;
  month: number;
};

/** Preserve this query's own calculation and database read ordering. */
export async function getMonthlyPayrollSheet(
  ctx: QueryCtx & { user: Doc<"users"> },
  args: PdksPayrollQueryArgs,
  helpers: {
    scopedPdksShift: (shift: Doc<"shifts"> | null, projectId?: Id<"projects">) => Doc<"shifts"> | null;
    flexiblePreviousReadings: (ctx: QueryCtx, startDate: string, projectIds: readonly Id<"projects">[] | undefined, employee?: Doc<"employees">) => Promise<Doc<"cardReadings">[]>;
  },
) {
  const { scopedPdksShift, flexiblePreviousReadings } = helpers;
  const allowedProjectIds = await resolveProjectScope(ctx, args.projectId);

  if (!Number.isInteger(args.year) || args.year < 1000 || args.year > 9999 || !Number.isInteger(args.month) || args.month < 1 || args.month > 12) {
    throw new Error("Geçerli bir yıl ve ay seçin");
  }
  const monthStr = String(args.month).padStart(2, "0");
  const lastDay = new Date(Date.UTC(args.year, args.month, 0)).getUTCDate();
  const startDate = `${args.year}-${monthStr}-01`;
  const endDate = `${args.year}-${monthStr}-${String(lastDay).padStart(2, "0")}`;
  const referenceProjectId = args.projectId ?? (
    ctx.user.role === "super_admin" && !args.projectId
      ? undefined
      : allowedProjectIds[0] ?? undefined);
  const overtimeRates = await getEffectiveOvertimeRates(ctx, referenceProjectId);
  const overtimeRange = overtimePeriodRange(startDate, endDate, overtimeRates.overtimeBasis, overtimeRates.nightShiftDayMode);
  const { startISO, endISO } = pdksWorkDayRange(overtimeRange.startDate, overtimeRange.endDate);

  let readings;
  let employees: Doc<"employees">[];
  if (ctx.user.role === "super_admin" && !args.projectId) {
    [readings, employees] = await Promise.all([
      ctx.db
        .query("cardReadings")
        .withIndex("by_access_time", q => q.gte("accessTime", startISO).lte("accessTime", endISO))
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
            .withIndex("by_project_access_time", q => q.eq("projectId", pid).gte("accessTime", startISO).lte("accessTime", endISO))
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
    return { days: [], rows: [], year: args.year, month: args.month };
  }

  employees = employees.filter(employee => employedDuring(employee, startDate, endDate));
  const payrollBoundaryShiftResolver = await buildShiftResolver(ctx, employees);
  const payrollHasFlexible = [...payrollBoundaryShiftResolver.shifts.values()].some(shift => shift.scheduleType === "flexible") && hasFlexiblePdksShift(employees, (id, date) => scopedPdksShift(payrollBoundaryShiftResolver.resolve(id, date), args.projectId), overtimeRange.startDate, overtimeRange.endDate);
  if (payrollHasFlexible) readings = [...await flexiblePreviousReadings(ctx, overtimeRange.startDate, ctx.user.role === "super_admin" && !args.projectId ? undefined : allowedProjectIds), ...readings];
  const earlyPayrollRecords = payrollHasFlexible ? await ctx.db.query("pdksRecords")
    .withIndex("by_date", q => q.gte("date", addWorkDate(overtimeRange.startDate, -1)).lte("date", addWorkDate(overtimeRange.endDate, 1))).take(10001) : undefined;
  if (earlyPayrollRecords && earlyPayrollRecords.length > 10000) throw new Error("Manuel kayıt sınırı aşıldı; proje veya tarih aralığını daraltın");
  const payrollEmployeeIds = new Set(employees.map(employee => employee._id));
  const payrollBoundaryManual = new Map((earlyPayrollRecords ?? []).filter(record => payrollEmployeeIds.has(record.employeeId) && record.manualEntry && (!args.projectId || record.projectId === args.projectId)).map(record => [`${record.employeeId}__${record.date}`, record]));
  const payrollBoundaryWorkDate = buildPdksWorkDateResolver(employees, (id, date) => scopedPdksShift(payrollBoundaryShiftResolver.resolve(id, date), args.projectId), { readings: readings, manualEntryFor: (id, date) => payrollBoundaryManual.get(`${id}__${date}`)?.entryTime, eligibleEntry: r => filterPdksReadings([r], args.projectId, candidate => policies(candidate.projectId, trDateKey(candidate.accessTime))).length > 0 }, (reading, date) => policies(reading.projectId, date));
  const policies = await loadPdksPolicies(ctx, employees.map(e => e.projectId), payrollHasFlexible ? addWorkDate(overtimeRange.startDate, -1) : overtimeRange.startDate, overtimeRange.endDate);
  readings = filterPdksReadings(readings, args.projectId, r => policies(r.projectId, payrollBoundaryWorkDate(r)));

  const [workSettings, holidayMap, generalSettings, payrollShiftResolver] =
    await Promise.all([
      getEffectiveWorkSettings(ctx, referenceProjectId),
      getHolidaysMap(ctx, referenceProjectId, overtimeRange.startDate, addWorkDate(overtimeRange.endDate, 1)),
      ctx.db
        .query("generalSettings")
        .withIndex("by_project", (q) => q.eq("projectId", referenceProjectId))
        .first(),
      Promise.resolve(payrollBoundaryShiftResolver),
    ]);
  const workingDays =
    generalSettings?.workingDays && generalSettings.workingDays.length > 0
      ? generalSettings.workingDays
      : ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma"];

  // Liste tüm günler için
  const days: string[] = [];
  for (let d = 1; d <= lastDay; d++) {
    days.push(`${args.year}-${monthStr}-${String(d).padStart(2, "0")}`);
  }

  const approvedLeaves = (await Promise.all(employees.map(emp => ctx.db.query("leaves")
    .withIndex("by_employee_start", q => q.eq("employeeId", emp._id).lte("startDate", endDate)).collect())))
    .flat().filter(l => l.status === "approved" && l.endDate >= startDate);

  // Manuel pdksRecords her çalışan için ay aralığı (batch: tek query, in-memory filter)
  const empIds = employees.map((e) => e._id);
  const empIdSet = new Set<string>(empIds.map((id) => String(id)));
  const manualByEmpDate = new Map<string, Doc<"pdksRecords">>();
  const allRecs = earlyPayrollRecords ?? await ctx.db
    .query("pdksRecords")
    .withIndex("by_date", (q) => q.gte("date", overtimeRange.startDate).lte("date", overtimeRange.endDate))
    .collect();
  const recs = allRecs.filter((r) => empIdSet.has(String(r.employeeId)));
  {
    for (const r of recs) {
      if (r.manualEntry && (!args.projectId || r.projectId === args.projectId)) manualByEmpDate.set(`${String(r.employeeId)}__${r.date}`, r);
    }
  }

  const payrollEmployeesById = new Map(employees.map(e => [String(e._id), e]));
  const payrollEmployeeReadings = buildPdksEmployeeReadingMap({ employees, readings });
  const payrollWorkDate = [...payrollShiftResolver.shifts.values()].some(shift => shift.scheduleType === "flexible") ? buildPdksWorkDateResolver(employees, (id, date) => scopedPdksShift(payrollShiftResolver.resolve(id, date), args.projectId), { readings, manualEntryFor: (id, date) => manualByEmpDate.get(`${id}__${date}`)?.entryTime }) : payrollBoundaryWorkDate;
  const payrollAvailableDates = pdksAvailableDatesByProject(readings, payrollWorkDate);
  const payrollManualDates = pdksManualDatesByEmployee(manualByEmpDate.values());
  const empDayReadings = new Map<string, Doc<"cardReadings">[]>();
  for (const [empId, employeeReadings] of payrollEmployeeReadings) {
    const employee = payrollEmployeesById.get(empId);
    if (!employee) continue;
    const byDay = groupPdksWorkDays(employeeReadings, employee._id, (id, date) => scopedPdksShift(payrollShiftResolver.resolve(id, date), args.projectId), (id, date) => manualByEmpDate.get(`${id}__${date}`)?.entryTime);
    for (const [date, dayReadings] of byDay) empDayReadings.set(`${empId}__${date}`, dayReadings);
  }

  const allDepartments = (await Promise.all([...new Set(employees.flatMap(e => e.departmentId ? [e.departmentId] : []))].map(id => ctx.db.get(id)))).filter((d): d is NonNullable<typeof d> => d !== null);
  const deptById = new Map(allDepartments.map((d) => [String(d._id), d]));

  const rows = await Promise.all(
    employees.map(async (emp) => {
      const payVisible = await canSeePayInProject(ctx, ctx.user, emp.projectId);
      const department = emp.departmentId
        ? deptById.get(String(emp.departmentId)) ?? null
        : null;

      const empHourlyRate = payVisible ? resolveHourlyRate({
        hourlyRate: emp.hourlyRate,
        monthlySalary: emp.monthlySalary,
        monthlyHoursBase: workSettings.monthlyHoursBase,
      }) : null;

      const firstRecordDate = await pdksFirstRecordDate(ctx, emp, payrollEmployeeReadings.get(String(emp._id)) ?? [], payrollManualDates.get(emp._id) ?? [], payrollWorkDate, policies);
      const availableDateKeys = payrollAvailableDates.get(emp.projectId) ?? new Set<string>();
      const allCells = buildPeriodDateKeys(overtimeRange.startDate, overtimeRange.endDate).filter(date => employedOn(emp, date)).map((d) =>
        computePayrollCell({
          policyFor: date => policies(emp.projectId, date),
          availableDateKeys,
          firstRecordDate,
          date: d,
          manual: manualByEmpDate.get(`${emp._id}__${d}`),
          dayReadings: empDayReadings.get(`${emp._id}__${d}`) ?? [],
          hasLeave: approvedLeaves.some(
            (l) =>
              l.employeeId === emp._id &&
              pdksLeaveMatchesProject(l, emp.projectId) &&
              d >= l.startDate &&
              d <= l.endDate
          ),
          holiday: holidayMap.get(d),
          holidayMap,
          workingDays,
          dayShift: scopedPdksShift(payrollShiftResolver.resolve(emp._id, d), args.projectId),
          workSettings,
          overtimeRates,
          empHourlyRate,
        })
      );

      const periodOvertime = calculatePeriodOvertime(allCells, {
        startDate, endDate, overtimeBasis: overtimeRates.overtimeBasis,
        hourlyRate: empHourlyRate,
      });
      const cells = allCells.filter((c) => c.date >= startDate && c.date <= endDate)
        .map(({ overtimeSegments: _segments, ...cell }) => {
          const overtime = periodOvertime.overtimeByDate[cell.date];
          return { ...cell, overtimeMinutes: overtime?.overtimeMinutes ?? 0,
            overtimePayTRY: overtime?.overtimePayTRY ?? null,
            multiplier: overtime?.overtimeMultiplier ?? 0 };
        });

      const totals = cells.reduce(
        (acc, c) => {
          acc.totalMinutes += c.totalMinutes;
          if (c.payrollCode === "İZN") acc.leaveDays += 1;
          if (c.status === "incomplete") acc.incompleteDays += 1;
          if (c.payrollCode === "DV") acc.absentDays += 1;
          if (c.isLate && c.status !== "incomplete") acc.lateDays += 1;
          return acc;
        },
        {
          totalMinutes: 0,
          leaveDays: 0,
          incompleteDays: 0,
          absentDays: 0,
          lateDays: 0,
        }
      );

      const { incompleteDays, ...legacyTotals } = totals;
      return {
        employeeId: emp._id,
        payrollCode: emp.payrollCode ?? "",
        name: `${emp.firstName} ${emp.lastName}`.trim(),
        cardNumber: emp.cardNumber,
        department: department?.projectId === emp.projectId ? department?.name ?? "Departmansız" : "Departmansız",
        hourlyRate: empHourlyRate,
        cells,
        totals: {
          ...legacyTotals,
          ...(cells.some(c => c.durationMeasured !== undefined) ? { incompleteDays } : {}),
          overtimeMinutes: periodOvertime.overtimeMinutes,
          overtimePayTRY: periodOvertime.overtimePayTRY,
          exceedsDaily11h: periodOvertime.exceedsDaily11h,
        },
      };
    })
  );

  return {
    days,
    rows: rows.sort((a, b) => a.name.localeCompare(b.name, "tr")),
    year: args.year,
    month: args.month,
  };
}
