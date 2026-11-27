import { ConvexError, getConvexSize, type Value } from "convex/values";
import { scopedPdksPlan } from "./pdksMultiShift";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { loadPdksPolicies } from "./pdksRules";
import { employedDuring, employedOn } from "./employment";
import { canSeePayInProject } from "./payVisibility";
import { resolveReadingScope, REPORT_READING_PERMISSIONS } from "./readingAccess";
import { getEffectiveWorkSettings, getEffectiveOvertimeRates, getHolidaysMap } from "./pdksHelpers";
import { buildBoundedShiftResolver } from "./shiftResolver";
import { overtimePeriodRange } from "./overtimeCalc";
import { buildPeriodDateKeys } from "./pdksCalc";
import { addWorkDate, buildPdksWorkDateResolver, hasFlexiblePdksShift, pdksWorkDayRange } from "./pdksWorkDay";
import { type PdksDeviceAvailability, setPdksHistoryReadings, withPdksDeviceAvailability, pdksAvailableDatesByProject, pdksManualDatesByEmployee, pdksLeaveMatchesProject, pdksFirstRecordDate } from "./pdksAvailability";
import { trDateKey, trTodayKey } from "./trDate";
import { countExcludedUnknownPdksReadings, filterPdksReadings } from "./pdksSource";
import { buildPdksEmployeeReadingMap, computePdksTableRow, filterPdksTableRows, type PdksTableStatusFilter } from "./pdksTable";

export type PdksTableQueryArgs = {
  projectId: Id<"projects">;
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
  batch?: PdksBatchScope,
) {
  ctx = withPdksReadBudget(ctx);
  if (batch?.preloadedReadings && batch.readingEndISO) setPdksHistoryReadings(ctx, batch.preloadedReadings, batch.readingEndISO);
  const { scopedPdksShift, flexiblePreviousReadings } = helpers;
  const allowedProjectIds = await resolveReadingScope(ctx, args.projectId, REPORT_READING_PERMISSIONS);

  const today = args.date ?? trTodayKey();
  const startDate = args.startDate ?? today;
  const endDate = args.endDate ?? today;
  const referenceProjectId = args.projectId;
  const overtimeRates = await getEffectiveOvertimeRates(ctx, referenceProjectId);
  const overtimeRange = overtimePeriodRange(startDate, endDate, overtimeRates.overtimeBasis, overtimeRates.nightShiftDayMode);
  const { startISO, endISO } = pdksWorkDayRange(overtimeRange.startDate, overtimeRange.endDate);
  const isSingleDay = startDate === endDate;
  const viewMode = args.viewMode ?? "single";

  let readings: Doc<"cardReadings">[] = [];
  let employees: Doc<"employees">[] = [];
  const budget = pdksReadBudget();
  if (!allowedProjectIds.length) return [];
  if (batch) {
    employees = [...batch.employees];
    readings = await readPdksBatchReadings(ctx, batch, startISO, endISO);
  } else {
  for (const pid of allowedProjectIds) {
    readings.push(...await readBoundedPdks(ctx.db.query("cardReadings")
      .withIndex("by_project_access_time", q => q.eq("projectId", pid).gte("accessTime", startISO).lte("accessTime", endISO)), budget));
    employees.push(...await readBoundedPdks(ctx.db.query("employees")
      .withIndex("by_project", q => q.eq("projectId", pid)), budget));
  }

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
  if (args.person && args.person.trim()) {
    const term = args.person.trim().toLocaleLowerCase("tr-TR");
    employees = employees.filter((e) =>
      `${e.firstName} ${e.lastName}`.toLocaleLowerCase("tr-TR").includes(term)
    );
  }

  const tableBoundaryShiftResolver = await buildBoundedShiftResolver(ctx, availabilityEmployees, { start: addWorkDate(overtimeRange.startDate, -1), end: addWorkDate(overtimeRange.endDate, 1) });
  if (args.shiftId) {
    // Shift filters match resolved shifts during the period, including overrides of employee defaults.
    const filterDates = buildPeriodDateKeys(startDate, endDate);
    employees = employees.filter(employee => filterDates.some(date => {
      const plan = scopedPdksPlan(tableBoundaryShiftResolver.resolvePlan(employee._id, date), args.projectId);
      return plan.kind !== "none" && plan.shifts.some(shift => shift._id === args.shiftId);
    }));
  }
  const tableHasFlexible = batch?.forceFlexible || [...tableBoundaryShiftResolver.shifts.values()].some(shift => shift.scheduleType === "flexible") && hasFlexiblePdksShift(availabilityEmployees, (id, date) => scopedPdksShift(tableBoundaryShiftResolver.resolve(id, date), args.projectId), overtimeRange.startDate, overtimeRange.endDate);
  if (tableHasFlexible) {
    const previous = pdksWorkDayRange(addWorkDate(overtimeRange.startDate, -1), addWorkDate(overtimeRange.startDate, -1));
    readings = [...await (batch ? readPdksBatchReadings(ctx, batch, previous.startISO, new Date(Date.parse(startISO) - 1).toISOString()) : flexiblePreviousReadings(ctx, overtimeRange.startDate, allowedProjectIds)), ...readings];
  }
  const sourceReadings = readings;
  const earlyTableRecords = tableHasFlexible ? await readPdksManualRecords(ctx, availabilityEmployees,
    addWorkDate(overtimeRange.startDate, -1), addWorkDate(overtimeRange.endDate, 1), budget) : undefined;
  const tableBoundaryManual = new Map((earlyTableRecords ?? []).flat().filter(record => record.manualEntry && (!args.projectId || record.projectId === args.projectId)).map(record => [`${record.employeeId}__${record.date}`, record]));
  const tableBoundaryWorkDate = buildPdksWorkDateResolver(availabilityEmployees, (id, date) => scopedPdksShift(tableBoundaryShiftResolver.resolve(id, date), args.projectId), { readings: sourceReadings, manualEntryFor: (id, date) => tableBoundaryManual.get(`${id}__${date}`)?.entryTime, eligibleEntry: (r, date) => filterPdksReadings([r], args.projectId, candidate => policies(candidate.projectId, date ?? trDateKey(candidate.accessTime))).length > 0 }, (reading, date) => policies(reading.projectId, date), (id, date) => scopedPdksShift(tableBoundaryShiftResolver.resolveLast(id, date), args.projectId));
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

  // Ayarlar ve tatiller seçili projeden (projectId zorunlu; global geri dönüş yok)
  const [workSettings, holidayMap, shiftResolver] =
    await Promise.all([
      getEffectiveWorkSettings(ctx, referenceProjectId),
      getHolidaysMap(ctx, referenceProjectId, overtimeRange.startDate, addWorkDate(overtimeRange.endDate, 1)),
      Promise.resolve(tableBoundaryShiftResolver),
    ]);

  // pdksRecords manuel override haritası
  const manualPdksByEmpDate = new Map<string, Doc<"pdksRecords">>();
  const periodEmployees = Array.from(employeeMap.keys())
    .map((empKey) => empById.get(empKey))
    .filter((emp): emp is NonNullable<typeof emp> => emp !== undefined);
  const recsByEmployee = earlyTableRecords ?? await readPdksManualRecords(ctx, periodEmployees, overtimeRange.startDate, overtimeRange.endDate, budget);
  for (const recs of recsByEmployee) {
    for (const r of recs) {
      if (r.manualEntry && (!args.projectId || r.projectId === args.projectId)) {
        manualPdksByEmpDate.set(`${String(r.employeeId)}__${r.date}`, r);
      }
    }
  }

  const periodDateKeys = buildPeriodDateKeys(startDate, endDate);

  const tableWorkDate = [...tableBoundaryShiftResolver.shifts.values()].some(shift => shift.scheduleType === "flexible") ? buildPdksWorkDateResolver(availabilityEmployees, (id, date) => scopedPdksShift(tableBoundaryShiftResolver.resolve(id, date), args.projectId), { readings, manualEntryFor: (id, date) => manualPdksByEmpDate.get(`${id}__${date}`)?.entryTime }, (reading, date) => policies(reading.projectId, date), (id, date) => scopedPdksShift(tableBoundaryShiftResolver.resolveLast(id, date), args.projectId)) : tableBoundaryWorkDate;
  const tablePeriodDates = new Set(periodDateKeys);
  const sourceReadingsByEmployee = buildPdksEmployeeReadingMap({
    employees,
    readings: sourceReadings.filter(r => tablePeriodDates.has(tableWorkDate(r))),
  });
  const tableAvailableDates = pdksAvailableDatesByProject(readings, tableWorkDate);
  batch?.onAvailability?.([...(tableAvailableDates.get(args.projectId) ?? [])], !!tableHasFlexible, employees.map(employee => employee._id));
  if (batch?.availabilityOnly) return [];
  if (batch?.availableDates) tableAvailableDates.set(args.projectId, new Set(batch.availableDates));
  const allLeaves = await readPdksLeaves(ctx, employees, startDate, endDate, budget);
  const tableDepartments = await Promise.all([...new Set(employees.flatMap(e => e.departmentId ? [e.departmentId] : []))].map(id => ctx.db.get(id)));
  const tableDeptById = new Map(tableDepartments.filter((d): d is NonNullable<typeof d> => d !== null).map((d) => [String(d._id), d]));


  await Promise.all([...new Set(availabilityEmployees.map(employee => employee.projectId))].map(async projectId => {
    tableAvailableDates.set(projectId, await withPdksDeviceAvailability(ctx, projectId, tableAvailableDates.get(projectId) ?? new Set(), policies, overtimeRange.endDate, batch?.deviceAvailability));
  }));
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
          hourlyRate: await canSeePayInProject(ctx, ctx.user, employee.projectId) ? employee.hourlyRate : undefined,
          monthlySalary: await canSeePayInProject(ctx, ctx.user, employee.projectId) ? employee.monthlySalary : undefined,
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
        workSettings,
        overtimeRates,
        resolvePlan: (id, date) => scopedPdksPlan(shiftResolver.resolvePlan(id, date), args.projectId),
        resolveLast: (id, date) => scopedPdksShift(shiftResolver.resolveLast(id, date), args.projectId),
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

/** Shared transaction budget; index iteration stops before growth reaches Convex limits.
 * Size accounting uses the SDK binary format, including UTF-8, bytes and bigint.
 * One extra document (Convex maximum 1 MiB) may be read to detect overflow.
 */
export function pdksReadBudget() {
  return { rows: 31_000, bytes: 15 * 1024 * 1024 };
}
// Query proxies already account for every row in the shared transaction budget.
const budgetedQueries = new WeakSet<object>();
const budgetedDatabases = new WeakSet<object>();

export async function readBoundedPdks<T>(query: AsyncIterable<T>, budget = pdksReadBudget()): Promise<T[]> {
  const rows: T[] = [];
  for await (const row of query) {
    if (!budgetedQueries.has(query)) {
      budget.rows--;
      // Only trusted database values reach this reader.
      budget.bytes -= getConvexSize(row as Value);
      if (budget.rows < 0 || budget.bytes < 0) throw new ConvexError({ code: "PDKS_READ_BUDGET", message: "Okuma sınırı aşıldı; daha dar tarih aralığı veya kişi filtresi seçin" });
    }
    rows.push(row);
  }
  return rows;
}

export async function readPdksManualRecords(ctx: QueryCtx, employees: readonly Doc<"employees">[], start: string, end: string, budget: ReturnType<typeof pdksReadBudget>) {
  const lists: Doc<"pdksRecords">[][] = [];
  for (const employee of employees) lists.push(await readBoundedPdks(ctx.db.query("pdksRecords")
    .withIndex("by_employee_date", q => q.eq("employeeId", employee._id).gte("date", start).lte("date", end)), budget));
  return lists;
}
export async function readPdksLeaves(ctx: QueryCtx, employees: readonly Doc<"employees">[], start: string, end: string, budget: ReturnType<typeof pdksReadBudget>) {
  const leaves: Doc<"leaves">[] = [];
  for (const employee of employees) leaves.push(...(await readBoundedPdks(ctx.db.query("leaves")
    .withIndex("by_employee_start", q => q.eq("employeeId", employee._id).lte("startDate", end)), budget))
    .filter(leave => leave.status === "approved" && leave.endDate >= start));
  return leaves;
}

/** Carry the same budget into existing attendance/shift helpers as well. */
export function withPdksReadBudget<T extends QueryCtx>(ctx: T): T {
  if (budgetedDatabases.has(ctx.db)) return ctx;
  const budget = pdksReadBudget();
  let ranges = 0;
  const consume = (row: unknown) => {
    budget.rows--;
    budget.bytes -= getConvexSize(row as Value);
    if (budget.rows < 0 || budget.bytes < 0) throw new ConvexError({ code: "PDKS_READ_BUDGET", message: "Okuma sınırı aşıldı; daha dar tarih aralığı veya kişi filtresi seçin" });
  };
  const range = () => {
    if (++ranges > 4090) throw new ConvexError({ code: "PDKS_READ_BUDGET", message: "Sorgu aralığı sınırı aşıldı; daha az çalışan veya proje seçin" });
  };
  const wrap = <Q extends object>(query: Q): Q => {
    const proxy = new Proxy(query, {
      get(target, key) {
        const value: unknown = Reflect.get(target, key);
        if (key === Symbol.asyncIterator) return async function* () {
          const iterator = Reflect.apply(value as () => AsyncIterator<unknown>, target, []);
          // Use the original iterator; Convex closes it on return/break.
          try {
            for (;;) {
              const next = await iterator.next();
              if (next.done) break;
              consume(next.value);
              yield next.value;
            }
          } finally { await iterator.return?.(); }
        };
        if (key === "collect" || key === "take") return async (count?: number) => {
          const rows: unknown[] = [];
          if (count === 0) return rows;
          for await (const row of wrap(target) as unknown as AsyncIterable<unknown>) {
            rows.push(row);
            if (count !== undefined && rows.length >= count) break;
          }
          return rows;
        };
        if (typeof value !== "function") return value;
        if (key === "paginate") return async (opts: Record<string, unknown>) => {
          const result: unknown = await Reflect.apply(value, target, [{ ...opts,
            maximumRowsRead: Math.min(typeof opts.maximumRowsRead === "number" ? opts.maximumRowsRead : budget.rows, budget.rows),
            maximumBytesRead: Math.min(typeof opts.maximumBytesRead === "number" ? opts.maximumBytesRead : budget.bytes, budget.bytes),
          }]);
          if (result !== null && typeof result === "object" && "page" in result && Array.isArray(result.page)) {
            for (const row of result.page) consume(row);
          }
          return result;
        };
        if (key === "first" || key === "unique") return async (...args: unknown[]) => {
          const row: unknown = await Reflect.apply(value, target, args);
          if (row !== null) consume(row);
          return row;
        };
        return (...args: unknown[]) => {
          const result: unknown = Reflect.apply(value, target, args);
          return result !== null && typeof result === "object" && !(result instanceof Promise) ? wrap(result) : result;
        };
      },
    });
    budgetedQueries.add(proxy);
    return proxy;
  };
  const db = new Proxy(ctx.db, {
    get(target, key) {
      const value: unknown = Reflect.get(target, key);
      if (typeof value !== "function") return value;
      return (...args: unknown[]) => {
        if (key === "query" || key === "get") range();
        const result: unknown = Reflect.apply(value, target, args);
        if (key === "query" && result !== null && typeof result === "object") return wrap(result);
        if (key === "get") return Promise.resolve(result).then(row => { if (row !== null) consume(row); return row; });
        return result;
      };
    },
  });
  budgetedDatabases.add(db);
  return { ...ctx, db };
}


export interface PdksBatchScope {
  deviceAvailability?: readonly PdksDeviceAvailability[];
  preloadedReadings?: readonly Doc<"cardReadings">[];
  readingEndISO?: string;
  employees: Doc<"employees">[];
  allEmployeeIds: readonly Id<"employees">[];
  cardOwners: readonly { cardNumber: string; employeeId: Id<"employees"> }[];
  availableDates?: readonly string[];
  forceFlexible?: boolean;
  availabilityOnly?: boolean;
  onAvailability?: (dates: string[], hasFlexible: boolean, eligibleEmployeeIds: Id<"employees">[]) => void;
}

/** Complete employee ranges preserve weekly settlement and overnight/flexible pairing. */
export async function readPdksBatchReadings(ctx: QueryCtx, scope: PdksBatchScope, startISO: string, endISO: string) {
  const allIds = new Set(scope.allEmployeeIds);
  const owners = new Map(scope.cardOwners.map(owner => [owner.cardNumber, owner.employeeId]));
  const rows = new Map<string, Doc<"cardReadings">>();
  if (scope.preloadedReadings) {
    const ids = new Set(scope.employees.map(employee => employee._id));
    const ownCards = new Set(scope.employees.filter(employee => employee.cardNumber && owners.get(employee.cardNumber) === employee._id).map(employee => employee.cardNumber));
    return scope.preloadedReadings.filter(reading => reading.accessTime >= startISO && reading.accessTime <= endISO &&
      (reading.employeeId && ids.has(reading.employeeId) || (!reading.employeeId || !allIds.has(reading.employeeId)) && ownCards.has(reading.cardNo)));
  }
  for (const employee of scope.employees) {
    for await (const reading of ctx.db.query("cardReadings").withIndex("by_project_employee_time", q =>
      q.eq("projectId", employee.projectId).eq("employeeId", employee._id).gte("accessTime", startISO).lte("accessTime", endISO))) rows.set(reading._id, reading);
    if (employee.cardNumber && owners.get(employee.cardNumber) === employee._id) {
      for await (const reading of ctx.db.query("cardReadings").withIndex("by_project_card_time", q =>
        q.eq("projectId", employee.projectId).eq("cardNo", employee.cardNumber).gte("accessTime", startISO).lte("accessTime", endISO))) {
        if (!reading.employeeId || !allIds.has(reading.employeeId)) rows.set(reading._id, reading);
      }
    }
  }
  return [...rows.values()].sort((a, b) => a.accessTime.localeCompare(b.accessTime) || a._creationTime - b._creationTime);
}
