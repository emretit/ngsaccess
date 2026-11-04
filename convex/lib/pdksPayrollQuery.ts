import { scopedPdksPlan } from "./pdksMultiShift";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { loadPdksPolicies } from "./pdksRules";
import { employedDuring, employedOn } from "./employment";
import { canSeePayInProject } from "./payVisibility";
import { resolveReadingScope, REPORT_READING_PERMISSIONS } from "./readingAccess";
import { getEffectiveWorkSettings, getEffectiveOvertimeRates, getHolidaysMap, resolveHourlyRate } from "./pdksHelpers";
import { buildBoundedShiftResolver, type ShiftResolver } from "./shiftResolver";
import { overtimePeriodRange, calculatePeriodOvertime } from "./overtimeCalc";
import { buildPeriodDateKeys } from "./pdksCalc";
import { addWorkDate, buildPdksWorkDateResolver, hasFlexiblePdksShift, pdksWorkDayRange, groupPdksWorkDays } from "./pdksWorkDay";
import { pdksAvailableDatesByProject, pdksManualDatesByEmployee, pdksLeaveMatchesProject, pdksFirstRecordDate } from "./pdksAvailability";
import { trDayRangeISO, trDateKey } from "./trDate";
import { filterPdksReadings } from "./pdksSource";
import { buildPdksEmployeeReadingMap } from "./pdksTable";
import { computePayrollCell } from "./pdksPayroll";

export type PdksPayrollQueryArgs = {
  projectId: Id<"projects">;
  year: number;
  month: number;
  companyId?: Id<"companies">;
};

export type PayrollReadings = {
  readings: readonly Doc<"cardReadings">[];
  startISO: string;
  endISO: string;
};

type PayrollHelpers = {
  scopedPdksShift: (shift: Doc<"shifts"> | null, projectId?: Id<"projects">) => Doc<"shifts"> | null;
  flexiblePreviousReadings: (ctx: QueryCtx, startDate: string, projectIds: readonly Id<"projects">[] | undefined, employee?: Doc<"employees">) => Promise<Doc<"cardReadings">[]>;
};

const reportHelpers: PayrollHelpers = {
  scopedPdksShift: (shift, projectId) => projectId && shift?.projectId !== projectId && !(shift?.scheduleType === "flexible" && !shift.projectId) ? null : shift,
  flexiblePreviousReadings: async (ctx, startDate, projectIds) => {
    const date = addWorkDate(startDate, -1);
    const { startISO, endISO } = trDayRangeISO(date, date);
    const lists = await Promise.all((projectIds ?? []).map(projectId => ctx.db.query("cardReadings")
      .withIndex("by_project_access_time", q => q.eq("projectId", projectId).gte("accessTime", startISO).lte("accessTime", endISO)).take(20001)));
    if (lists.flat().length > 20000) throw new Error("Esnek vardiya önceki gün okuma sınırı aşıldı; proje kapsamını daraltın");
    return lists.flat();
  },
};

export async function getMonthlyPayrollSheet(
  ctx: QueryCtx & { user: Doc<"users"> }, args: PdksPayrollQueryArgs, helpers: PayrollHelpers,
) {
  if (!Number.isInteger(args.year) || args.year < 1000 || args.year > 9999 || !Number.isInteger(args.month) || args.month < 1 || args.month > 12) {
    throw new Error("Geçerli bir yıl ve ay seçin");
  }
  const monthStr = String(args.month).padStart(2, "0");
  const lastDay = new Date(Date.UTC(args.year, args.month, 0)).getUTCDate();
  const startDate = `${args.year}-${monthStr}-01`;
  const endDate = `${args.year}-${monthStr}-${String(lastDay).padStart(2, "0")}`;
  const result = await loadPayrollPeriod(ctx, { ...args, startDate, endDate }, helpers);
  return { ...result, year: args.year, month: args.month };
}

/** Reports and payroll settle the same net day segments, including preceding week context. */
export async function loadPayrollPeriod(
  ctx: QueryCtx & { user: Doc<"users"> },
  args: { projectId: Id<"projects">; startDate: string; endDate: string; companyId?: Id<"companies"> },
  helpers: PayrollHelpers = reportHelpers,
  preloaded: { employees?: Doc<"employees">[]; shiftResolver?: ShiftResolver; readings?: PayrollReadings } = {},
) {
  const { scopedPdksShift, flexiblePreviousReadings } = helpers;
  const allowedProjectIds = await resolveReadingScope(ctx, args.projectId, REPORT_READING_PERMISSIONS);
  const { startDate, endDate } = args;
  const referenceProjectId = args.projectId;
  const overtimeRates = await getEffectiveOvertimeRates(ctx, referenceProjectId);
  const overtimeRange = overtimePeriodRange(startDate, endDate, overtimeRates.overtimeBasis, overtimeRates.nightShiftDayMode);
  const { startISO, endISO } = pdksWorkDayRange(overtimeRange.startDate, overtimeRange.endDate);

  const cachedReadings = preloaded.readings;
  const useCachedReadings = cachedReadings && cachedReadings.startISO <= startISO && cachedReadings.endISO >= endISO;
  let readings;
  let employees: Doc<"employees">[];
  if (allowedProjectIds.length > 0) {
    const [readingResults, empResults] = await Promise.all([
      useCachedReadings ? Promise.resolve([cachedReadings.readings.filter(reading =>
        reading.projectId !== undefined && allowedProjectIds.includes(reading.projectId) && reading.accessTime >= startISO && reading.accessTime <= endISO)]) : Promise.all(
        allowedProjectIds.map((pid) =>
          ctx.db
            .query("cardReadings")
            .withIndex("by_project_access_time", q => q.eq("projectId", pid).gte("accessTime", startISO).lte("accessTime", endISO))
            .collect()
        )
      ),
      preloaded.employees ? Promise.resolve([preloaded.employees]) : Promise.all(
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
    return { days: [], rows: [] };
  }

  employees = employees.filter(employee => employee.isVisitor !== true && employedDuring(employee, startDate, endDate)
    && (!args.companyId || employee.companyId === args.companyId));
  const payrollBoundaryShiftResolver = preloaded.shiftResolver ?? await buildBoundedShiftResolver(ctx, employees, { start: addWorkDate(overtimeRange.startDate, -1), end: addWorkDate(overtimeRange.endDate, 1) });
  const payrollHasFlexible = [...payrollBoundaryShiftResolver.shifts.values()].some(shift => shift.scheduleType === "flexible") && hasFlexiblePdksShift(employees, (id, date) => scopedPdksShift(payrollBoundaryShiftResolver.resolve(id, date), args.projectId), overtimeRange.startDate, overtimeRange.endDate);
  if (payrollHasFlexible) {
    const previousRange = trDayRangeISO(addWorkDate(overtimeRange.startDate, -1), addWorkDate(overtimeRange.startDate, -1));
    const previous = cachedReadings && cachedReadings.startISO <= previousRange.startISO && cachedReadings.endISO >= previousRange.endISO
      ? cachedReadings.readings.filter(reading => reading.projectId !== undefined && allowedProjectIds.includes(reading.projectId)
        && reading.accessTime >= previousRange.startISO && reading.accessTime <= previousRange.endISO)
      : await flexiblePreviousReadings(ctx, overtimeRange.startDate, allowedProjectIds);
    readings = [...previous, ...readings];
  }
  // Scope before reading: another project's records must never consume this limit.
  // The same bounded employee records feed both flexible boundaries and payroll cells.
  const manualStart = payrollHasFlexible ? addWorkDate(overtimeRange.startDate, -1) : overtimeRange.startDate;
  const manualEnd = payrollHasFlexible ? addWorkDate(overtimeRange.endDate, 1) : overtimeRange.endDate;
  const recordLists = await Promise.all(employees.map(employee => ctx.db.query("pdksRecords")
    .withIndex("by_employee_date", q => q.eq("employeeId", employee._id).gte("date", manualStart).lte("date", manualEnd)).take(1001)));
  if (recordLists.some(records => records.length > 1000)) throw new Error("Manuel kayıt sınırı aşıldı; tarih aralığını daraltın");
  const manualByEmpDate = new Map(recordLists.flat()
    .filter(record => record.manualEntry && record.projectId === args.projectId)
    .map(record => [`${record.employeeId}__${record.date}`, record]));
  const payrollBoundaryManual = manualByEmpDate;
  const payrollBoundaryWorkDate = buildPdksWorkDateResolver(employees, (id, date) => scopedPdksShift(payrollBoundaryShiftResolver.resolve(id, date), args.projectId), { readings: readings, manualEntryFor: (id, date) => payrollBoundaryManual.get(`${id}__${date}`)?.entryTime, eligibleEntry: r => filterPdksReadings([r], args.projectId, candidate => policies(candidate.projectId, trDateKey(candidate.accessTime))).length > 0 }, (reading, date) => policies(reading.projectId, date), (id, date) => scopedPdksShift(payrollBoundaryShiftResolver.resolveLast(id, date), args.projectId));
  const policies = await loadPdksPolicies(ctx, employees.map(e => e.projectId), payrollHasFlexible ? addWorkDate(overtimeRange.startDate, -1) : overtimeRange.startDate, overtimeRange.endDate);
  readings = filterPdksReadings(readings, args.projectId, r => policies(r.projectId, payrollBoundaryWorkDate(r)));

  const [workSettings, holidayMap, payrollShiftResolver] =
    await Promise.all([
      getEffectiveWorkSettings(ctx, referenceProjectId),
      getHolidaysMap(ctx, referenceProjectId, overtimeRange.startDate, addWorkDate(overtimeRange.endDate, 1)),
      Promise.resolve(payrollBoundaryShiftResolver),
    ]);

  const days = buildPeriodDateKeys(startDate, endDate);

  const approvedLeaves = (await Promise.all(employees.map(emp => ctx.db.query("leaves")
    .withIndex("by_employee_start", q => q.eq("employeeId", emp._id).lte("startDate", endDate)).collect())))
    .flat().filter(l => l.status === "approved" && l.endDate >= startDate);

  const payrollEmployeesById = new Map(employees.map(e => [String(e._id), e]));
  const payrollEmployeeReadings = buildPdksEmployeeReadingMap({ employees, readings });
  const payrollWorkDate = [...payrollShiftResolver.shifts.values()].some(shift => shift.scheduleType === "flexible") ? buildPdksWorkDateResolver(employees, (id, date) => scopedPdksShift(payrollShiftResolver.resolve(id, date), args.projectId), { readings, manualEntryFor: (id, date) => manualByEmpDate.get(`${id}__${date}`)?.entryTime }, undefined, (id, date) => scopedPdksShift(payrollShiftResolver.resolveLast(id, date), args.projectId)) : payrollBoundaryWorkDate;
  const payrollAvailableDates = pdksAvailableDatesByProject(readings, payrollWorkDate);
  const payrollManualDates = pdksManualDatesByEmployee(manualByEmpDate.values());
  const empDayReadings = new Map<string, Doc<"cardReadings">[]>();
  for (const [empId, employeeReadings] of payrollEmployeeReadings) {
    const employee = payrollEmployeesById.get(empId);
    if (!employee) continue;
    const byDay = groupPdksWorkDays(employeeReadings, employee._id, (id, date) => scopedPdksShift(payrollShiftResolver.resolve(id, date), args.projectId), (id, date) => manualByEmpDate.get(`${id}__${date}`)?.entryTime, undefined, (id, date) => scopedPdksShift(payrollShiftResolver.resolveLast(id, date), args.projectId));
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
          nextDayKind: payrollShiftResolver.resolvePlan(emp._id, addWorkDate(d, 1)).kind === "rest" ? "rest" : "work",
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
          dayShift: scopedPdksShift(payrollShiftResolver.resolve(emp._id, d), args.projectId),
          dayPlan: scopedPdksPlan(payrollShiftResolver.resolvePlan(emp._id, d), args.projectId),
          workSettings,
          overtimeRates,
          empHourlyRate,
        })
      );

      const periodOvertime = calculatePeriodOvertime(allCells.filter(cell => !cell.noShift), {
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
          if (c.noShift) return acc;
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
    rows: rows.filter(row => row.cells.some(cell => !cell.noShift)).sort((a, b) => a.name.localeCompare(b.name, "tr")),
  };
}
