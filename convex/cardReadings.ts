import { query, mutation, internalMutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  authedQuery,
  employeeAuthedQuery,
  employeeAuthedMutation,
} from "./lib/customFunctions";
import { getProjectIdsForUser } from "./lib/auth";
import { Doc, Id } from "./_generated/dataModel";
import {
  getEffectiveWorkSettings,
  getEffectiveOvertimeRates,
  getHolidaysMap,
  parseHHMM,
  classifyDay,
  multiplierForClassification,
  payrollCodeForDay,
  evaluateLateEarly,
  dailyOvertimeForShift,
  isoTimeToTRMinutes,
  resolveHourlyRate,
  overtimePayTRY,
} from "./lib/pdksHelpers";
import {
  buildShiftResolver,
  settingsForShift,
  thresholdsForShift,
} from "./lib/shiftResolver";
import { netWorkMinutes } from "./lib/breakDeduction";
import { bucketWeeklyOvertime, type DayEntry } from "./lib/overtimeCalc";
import { inferAccessStatus, inferDenialReason } from "./lib/hikEventCodes";
import { ideResultGranted } from "./lib/cardReaderParse";
import { canEmployeeAccessDevice } from "./lib/accessDecision";
import {
  buildPeriodDateKeys,
  manualOverrideMinutes,
  minutesBetweenISO,
  computeLateMinutes,
  resolveDayStatus,
  matchEmployeeKey,
  formatIstanbulTime,
  formatHoursLabel,
} from "./lib/pdksCalc";
import {
  enrichReadingsForList,
  enrichWithDeviceName,
  enrichWithDeviceInfo,
} from "./lib/cardReadingAudit";

/**
 * Ziyaretçi kayıt ekranı için: seçilen okuyucuda (device) okutulan en son BİLİNMEYEN
 * (atanmamış = `employeeId` yok) kartı döner. Reaktif — kart bastırılınca `useQuery`
 * anında günceller. `sinceTime` (kayıt ekranının açıldığı an) eski okumaları eler.
 */
export const getLastUnknownByDevice = authedQuery({
  args: {
    deviceId: v.id("devices"),
    sinceTime: v.optional(v.string()),
  },
  returns: v.union(
    v.object({ cardNo: v.string(), accessTime: v.string() }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const device = await ctx.db.get(args.deviceId);
    if (!device) return null;
    if (device.projectId && ctx.user.role !== "super_admin") {
      const allowed = await getProjectIdsForUser(ctx);
      if (!allowed.some((id) => id === device.projectId)) return null;
    }
    const since = args.sinceTime;
    const reading = await ctx.db
      .query("cardReadings")
      .withIndex("by_device", (q) => q.eq("deviceId", args.deviceId))
      .order("desc")
      .filter((q) =>
        since
          ? q.and(
              q.eq(q.field("employeeId"), undefined),
              q.gt(q.field("accessTime"), since),
            )
          : q.eq(q.field("employeeId"), undefined),
      )
      .first();
    if (!reading) return null;
    return { cardNo: reading.cardNo, accessTime: reading.accessTime };
  },
});

export const list = authedQuery({
  args: {
    projectIds: v.optional(v.array(v.id("projects"))),
    isSuperAdmin: v.optional(v.boolean()),
    page: v.optional(v.number()),
    pageSize: v.optional(v.number()),
    searchTerm: v.optional(v.string()),
    dateFilter: v.optional(v.string()),
    accessFilter: v.optional(
      v.union(v.literal("all"), v.literal("granted"), v.literal("denied"))
    ),
  },
  handler: async (ctx, args) => {
    const pageSize = args.pageSize ?? 100;
    const page = args.page ?? 1;

    const allowedProjectIds = await getProjectIdsForUser(ctx);

    let readings;
    if (args.isSuperAdmin && ctx.user.role === "super_admin") {
      readings = await ctx.db
        .query("cardReadings")
        .withIndex("by_access_time")
        .order("desc")
        .collect();
    } else if (allowedProjectIds.length > 0) {
      const results = await Promise.all(
        allowedProjectIds.map((pid) =>
          ctx.db
            .query("cardReadings")
            .withIndex("by_project", (q) => q.eq("projectId", pid))
            .order("desc")
            .collect()
        )
      );
      readings = results.flat().sort(
        (a, b) => new Date(b.accessTime).getTime() - new Date(a.accessTime).getTime()
      );
    } else {
      return { readings: [], totalCount: 0 };
    }

    // Filters
    if (args.searchTerm) {
      const term = args.searchTerm.toLowerCase();
      readings = readings.filter(
        (r) =>
          r.employeeName?.toLowerCase().includes(term) ||
          r.cardNo.toLowerCase().includes(term)
      );
    }

    if (args.dateFilter) {
      const start = new Date(args.dateFilter);
      start.setHours(0, 0, 0, 0);
      const end = new Date(args.dateFilter);
      end.setHours(23, 59, 59, 999);
      readings = readings.filter((r) => {
        const t = new Date(r.accessTime).getTime();
        return t >= start.getTime() && t <= end.getTime();
      });
    }

    if (args.accessFilter && args.accessFilter !== "all") {
      const status = args.accessFilter === "granted" ? "izin_verildi" : "reddedildi";
      readings = readings.filter((r) => r.accessStatus === status);
    }

    const totalCount = readings.length;
    const from = (page - 1) * pageSize;
    const paginated = readings.slice(from, from + pageSize);

    const enriched = await enrichReadingsForList(ctx, paginated);

    return { readings: enriched, totalCount };
  },
});

export const getRecentByProjects = query({
  args: {
    projectIds: v.optional(v.array(v.id("projects"))),
    isSuperAdmin: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 10;
    let readings;

    if (args.isSuperAdmin) {
      readings = await ctx.db
        .query("cardReadings")
        .withIndex("by_access_time")
        .order("desc")
        .take(limit);
    } else if (args.projectIds && args.projectIds.length > 0) {
      const results = await Promise.all(
        args.projectIds.map((pid) =>
          ctx.db
            .query("cardReadings")
            .withIndex("by_project", (q) => q.eq("projectId", pid))
            .order("desc")
            .take(limit)
        )
      );
      readings = results
        .flat()
        .sort((a, b) => new Date(b.accessTime).getTime() - new Date(a.accessTime).getTime())
        .slice(0, limit);
    } else {
      return [];
    }

    return await enrichWithDeviceName(ctx, readings);
  },
});

export const getPdksTableData = authedQuery({
  args: {
    date: v.optional(v.string()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    companyId: v.optional(v.id("companies")),
    departmentId: v.optional(v.id("departments")),
    positionId: v.optional(v.id("positions")),
    shiftId: v.optional(v.id("shifts")),
    statusFilter: v.optional(
      v.union(
        v.literal("all"),
        v.literal("present"),
        v.literal("late"),
        v.literal("absent"),
        v.literal("leave"),
        v.literal("overtime")
      )
    ),
    person: v.optional(v.string()),
    viewMode: v.optional(v.union(v.literal("single"), v.literal("matrix"))),
  },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);

    const today = args.date ?? new Date().toISOString().split("T")[0];
    const startDate = args.startDate ?? today;
    const endDate = args.endDate ?? today;
    const startISO = `${startDate}T00:00:00.000`;
    const endISO = `${endDate}T23:59:59.999`;
    const isSingleDay = startDate === endDate;
    const viewMode = args.viewMode ?? "single";

    let readings;
    let employees: Doc<"employees">[];
    if (ctx.user.role === "super_admin") {
      [readings, employees] = await Promise.all([
        ctx.db
          .query("cardReadings")
          .withIndex("by_access_time")
          .filter((q) =>
            q.and(q.gte(q.field("accessTime"), startISO), q.lte(q.field("accessTime"), endISO))
          )
          .collect(),
        ctx.db
          .query("employees")
          .filter((q) => q.eq(q.field("isActive"), true))
          .collect(),
      ]);
    } else if (allowedProjectIds.length > 0) {
      const [readingResults, empResults] = await Promise.all([
        Promise.all(
          allowedProjectIds.map((pid) =>
            ctx.db
              .query("cardReadings")
              .withIndex("by_project", (q) => q.eq("projectId", pid))
              .filter((q) =>
                q.and(
                  q.gte(q.field("accessTime"), startISO),
                  q.lte(q.field("accessTime"), endISO)
                )
              )
              .collect()
          )
        ),
        Promise.all(
          allowedProjectIds.map((pid) =>
            ctx.db
              .query("employees")
              .withIndex("by_project", (q) => q.eq("projectId", pid))
              .filter((q) => q.eq(q.field("isActive"), true))
              .collect()
          )
        ),
      ]);
      readings = readingResults.flat();
      employees = empResults.flat();
    } else {
      return [];
    }

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
      const term = args.person.trim().toLowerCase();
      employees = employees.filter((e) =>
        `${e.firstName} ${e.lastName}`.toLowerCase().includes(term)
      );
    }

    readings.sort(
      (a, b) => new Date(a.accessTime).getTime() - new Date(b.accessTime).getTime()
    );

    const empById = new Map<string, Doc<"employees">>();
    const empIdByCard = new Map<string, string>();
    for (const emp of employees) {
      empById.set(String(emp._id), emp);
      if (emp.cardNumber) empIdByCard.set(emp.cardNumber, String(emp._id));
    }
    const validEmpIds = new Set(empById.keys());

    const employeeMap = new Map<string, typeof readings>();
    for (const emp of employees) {
      employeeMap.set(String(emp._id), []);
    }

    for (const r of readings) {
      const empKey = matchEmployeeKey(
        { employeeId: r.employeeId, cardNo: r.cardNo },
        validEmpIds,
        empIdByCard,
      );
      if (!empKey) continue;
      employeeMap.get(empKey)!.push(r);
    }

    // Settings & holidays per project (super_admin için global = undefined)
    const referenceProjectId =
      ctx.user.role === "super_admin"
        ? undefined
        : allowedProjectIds[0] ?? undefined;
    const [workSettings, holidayMap, generalSettings, shiftResolver, overtimeRates] =
      await Promise.all([
        getEffectiveWorkSettings(ctx, referenceProjectId),
        getHolidaysMap(ctx, referenceProjectId, startDate, endDate),
        ctx.db
          .query("generalSettings")
          .withIndex("by_project", (q) => q.eq("projectId", referenceProjectId))
          .first(),
        buildShiftResolver(ctx, employees),
        getEffectiveOvertimeRates(ctx, referenceProjectId),
      ]);
    const workingDays =
      generalSettings?.workingDays && generalSettings.workingDays.length > 0
        ? generalSettings.workingDays
        : ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma"];

    // pdksRecords manuel override haritası
    const manualPdksByEmpDate = new Map<string, Doc<"pdksRecords">>();
    for (const empKey of employeeMap.keys()) {
      const emp = empById.get(empKey);
      if (!emp) continue;
      const recs = await ctx.db
        .query("pdksRecords")
        .withIndex("by_employee_date", (q) => q.eq("employeeId", emp._id))
        .filter((q) =>
          q.and(
            q.gte(q.field("date"), startDate),
            q.lte(q.field("date"), endDate)
          )
        )
        .collect();
      for (const r of recs) {
        if (r.manualEntry) {
          manualPdksByEmpDate.set(`${empKey}__${r.date}`, r);
        }
      }
    }

    const allLeaves = await ctx.db
      .query("leaves")
      .filter((q) => q.eq(q.field("status"), "approved"))
      .collect();

    const leaveTypeLabels: Record<string, string> = {
      annual: "Yıllık",
      sick: "Hastalık",
      excuse: "Mazeret",
      unpaid: "Ücretsiz",
      parental: "Doğum/Ebeveyn",
      marriage: "Evlilik",
      bereavement: "Vefat",
      paternity: "Babalık",
      lactation: "Süt izni",
      compensatory: "Telafi",
    };

    const periodDateKeys = buildPeriodDateKeys(startDate, endDate);

    const tableDepartments = await ctx.db.query("departments").collect();
    const tableDeptById = new Map(tableDepartments.map((d) => [String(d._id), d]));

    const tableData = await Promise.all(
      Array.from(employeeMap.entries()).map(async ([empKey, empReadings]) => {
        const employee = empById.get(empKey) ?? null;
        const department = employee?.departmentId
          ? tableDeptById.get(String(employee.departmentId)) ?? null
          : null;

        const empId = employee?._id;
        const hasLeave = empId
          ? allLeaves.some((l) => {
              if (l.employeeId !== empId) return false;
              return periodDateKeys.some((dk) => dk >= l.startDate && dk <= l.endDate);
            })
          : false;
        const leaveRecord = empId
          ? allLeaves.find((l) => {
              if (l.employeeId !== empId) return false;
              return periodDateKeys.some((dk) => dk >= l.startDate && dk <= l.endDate);
            })
          : null;
        const leaveType = leaveRecord
          ? leaveTypeLabels[leaveRecord.leaveType] ?? leaveRecord.leaveType
          : "-";

        const granted = empReadings.filter((r) => r.accessStatus === "izin_verildi");

        // Tek gün modunda manuel override öncelikli
        const manualToday =
          isSingleDay && empId
            ? manualPdksByEmpDate.get(`${empKey}__${startDate}`)
            : undefined;

        const firstEntryISO = manualToday?.entryTime
          ? `${startDate}T${manualToday.entryTime}:00.000+03:00`
          : granted[0]?.accessTime;
        const lastExitISO = manualToday?.exitTime
          ? `${startDate}T${manualToday.exitTime}:00.000+03:00`
          : granted[granted.length - 1]?.accessTime;

        const refDateISO = isSingleDay
          ? startDate
          : (firstEntryISO?.split("T")[0] ?? startDate);
        const refShift = employee
          ? shiftResolver.resolve(employee._id, refDateISO)
          : null;
        const refSettings = settingsForShift(refShift, workSettings);
        const { isLate, isEarlyExit } = evaluateLateEarly(
          firstEntryISO,
          lastExitISO !== firstEntryISO ? lastExitISO : undefined,
          refSettings,
        );

        const status = resolveDayStatus({
          mode: "summary",
          classification: "workday",
          hasAttendance: !!firstEntryISO,
          hasLeave,
          isLate,
        });

        const dayReadingsMap = new Map<string, typeof granted>();
        for (const r of granted) {
          const dateKey = r.accessTime.split("T")[0];
          if (!dayReadingsMap.has(dateKey)) dayReadingsMap.set(dateKey, []);
          dayReadingsMap.get(dateKey)!.push(r);
        }

        let totalMinutes = 0;
        for (const dayReadings of dayReadingsMap.values()) {
          dayReadings.sort(
            (a, b) =>
              new Date(a.accessTime).getTime() - new Date(b.accessTime).getTime()
          );
          const firstOfDay = dayReadings[0];
          const lastOfDay = dayReadings[dayReadings.length - 1];
          if (firstOfDay._id !== lastOfDay._id) {
            totalMinutes += minutesBetweenISO(
              firstOfDay.accessTime,
              lastOfDay.accessTime,
            );
          }
        }

        // Manuel override total minutes hesabı (tek gün)
        if (isSingleDay && manualToday?.entryTime && manualToday?.exitTime) {
          totalMinutes = manualOverrideMinutes(
            manualToday.entryTime,
            manualToday.exitTime,
          );
        }

        const totalHours = formatHoursLabel(totalMinutes);

        // Mesai hesabı: gün gün "vardiya bitişinden sonra geçen süre" (hafta sonu/tatil tüm gün)
        let overtimeMinutes = 0;
        let overtimePayMultiplier = 0;

        if (isSingleDay) {
          const cls = classifyDay(startDate, workingDays, holidayMap.get(startDate));
          let lastExitMin: number | undefined;
          if (manualToday?.exitTime) {
            lastExitMin = parseHHMM(manualToday.exitTime);
          } else if (granted.length > 1) {
            const sortedGranted = [...granted].sort(
              (a, b) =>
                new Date(a.accessTime).getTime() - new Date(b.accessTime).getTime()
            );
            lastExitMin = isoTimeToTRMinutes(
              sortedGranted[sortedGranted.length - 1].accessTime
            );
          }
          overtimeMinutes = dailyOvertimeForShift({
            classification: cls,
            netMinutes: totalMinutes,
            lastExitMinutes: lastExitMin,
            shift: refShift,
            workSettings,
          });
          if (overtimeMinutes > 0) {
            overtimePayMultiplier = multiplierForClassification(cls, overtimeRates);
          }
        } else {
          for (const [dk, dayReadings] of dayReadingsMap.entries()) {
            if (dayReadings.length < 2) continue;
            const dayFirstISO = dayReadings[0].accessTime;
            const dayLastISO = dayReadings[dayReadings.length - 1].accessTime;
            const dayNetMin = Math.floor(
              (new Date(dayLastISO).getTime() - new Date(dayFirstISO).getTime()) / 60000
            );
            const dayCls = classifyDay(dk, workingDays, holidayMap.get(dk));
            const dayShift = employee ? shiftResolver.resolve(employee._id, dk) : null;
            overtimeMinutes += dailyOvertimeForShift({
              classification: dayCls,
              netMinutes: dayNetMin,
              lastExitMinutes: isoTimeToTRMinutes(dayLastISO),
              shift: dayShift,
              workSettings,
            });
          }
          if (overtimeMinutes > 0) {
            overtimePayMultiplier = workSettings.overtimeMultiplier;
          }
        }
        const overtime = overtimeMinutes > 0 ? `${overtimeMinutes}m` : "0m";
        const overtimeHours = overtimeMinutes / 60;

        const hourlyRate = resolveHourlyRate({
          hourlyRate: employee?.hourlyRate,
          monthlySalary: employee?.monthlySalary,
          monthlyHoursBase: workSettings.monthlyHoursBase,
        });
        const overtimePayAmountTRY = overtimePayTRY({
          overtimeMinutes,
          multiplier: overtimePayMultiplier,
          hourlyRate,
        });

        // payrollCode (tek gün için anlamlı; periodda günleri karıştırır)
        const payrollCode = isSingleDay
          ? payrollCodeForDay({
              classification: classifyDay(
                startDate,
                workingDays,
                holidayMap.get(startDate)
              ),
              hasLeave,
              hasAttendance: !!firstEntryISO,
            })
          : "—";

        const editor = manualToday?.editedBy
          ? await ctx.db.get(manualToday.editedBy)
          : null;

        // Matrix mode: gün gün özet
        type DayCell = {
          date: string;
          firstEntry: string | null;
          lastExit: string | null;
          totalMinutes: number;
          status: "present" | "late" | "absent" | "leave" | "weekend" | "holiday";
          isLate: boolean;
          lateMinutes: number;
          payrollCode: string;
          overtimeMinutes: number;
        };
        const days: DayCell[] = [];
        if (viewMode === "matrix") {
          for (const dk of periodDateKeys) {
            const dayReadings = (dayReadingsMap.get(dk) ?? []).slice().sort(
              (a, b) =>
                new Date(a.accessTime).getTime() -
                new Date(b.accessTime).getTime()
            );
            const manualDay =
              empId
                ? manualPdksByEmpDate.get(`${empKey}__${dk}`)
                : undefined;
            const firstISO = manualDay?.entryTime
              ? `${dk}T${manualDay.entryTime}:00.000+03:00`
              : dayReadings[0]?.accessTime ?? null;
            const lastISO = manualDay?.exitTime
              ? `${dk}T${manualDay.exitTime}:00.000+03:00`
              : dayReadings.length > 1
                ? dayReadings[dayReadings.length - 1].accessTime
                : null;

            let dayMinutes = 0;
            if (manualDay?.entryTime && manualDay?.exitTime) {
              dayMinutes = manualOverrideMinutes(
                manualDay.entryTime,
                manualDay.exitTime,
              );
            } else if (firstISO && lastISO) {
              dayMinutes = Math.max(0, minutesBetweenISO(firstISO, lastISO));
            }

            const cls = classifyDay(dk, workingDays, holidayMap.get(dk));
            const dayHasLeave = empId
              ? allLeaves.some(
                  (l) =>
                    l.employeeId === empId && dk >= l.startDate && dk <= l.endDate
                )
              : false;
            const dayCode = payrollCodeForDay({
              classification: cls,
              hasLeave: dayHasLeave,
              hasAttendance: !!firstISO,
            });
            const dayShift = employee
              ? shiftResolver.resolve(employee._id, dk)
              : null;
            const daySettings = settingsForShift(dayShift, workSettings);
            const { isLate: dayLate } = evaluateLateEarly(
              firstISO ?? undefined,
              lastISO ?? undefined,
              daySettings,
            );
            // late minutes
            const lateMinutes = computeLateMinutes(firstISO, dayLate, daySettings);

            const dayStatus = resolveDayStatus({
              mode: "calendar",
              classification: cls,
              hasAttendance: !!firstISO,
              hasLeave: dayHasLeave,
              isLate: dayLate,
            });

            const dayLastExitMin = lastISO ? isoTimeToTRMinutes(lastISO) : undefined;
            const dayOvertime = dailyOvertimeForShift({
              classification: cls,
              netMinutes: dayMinutes,
              lastExitMinutes: dayLastExitMin,
              shift: dayShift,
              workSettings,
            });

            days.push({
              date: dk,
              firstEntry: firstISO ? formatIstanbulTime(firstISO) : null,
              lastExit: lastISO ? formatIstanbulTime(lastISO) : null,
              totalMinutes: dayMinutes,
              status: dayStatus,
              isLate: dayLate,
              lateMinutes,
              payrollCode: dayCode,
              overtimeMinutes: dayOvertime,
            });
          }
        }

        return {
          id: empKey,
          name: employee
            ? `${employee.firstName} ${employee.lastName}`.trim()
            : "Bilinmiyor",
          employeeId: employee?.cardNumber ?? empKey,
          payrollCode,
          payrollEmployeeCode: employee?.payrollCode ?? "",
          department: department?.name ?? "-",
          firstEntry: firstEntryISO ? formatIstanbulTime(firstEntryISO) : "-",
          lastExit:
            lastExitISO && lastExitISO !== firstEntryISO
              ? formatIstanbulTime(lastExitISO)
              : "-",
          totalHours,
          overtime,
          overtimeHours,
          overtimeMultiplier: overtimePayMultiplier,
          overtimePayTRY: overtimePayAmountTRY,
          hourlyRate,
          yearlyOvertimeLimit: workSettings.annualOvertimeLimitHours,
          leaveType,
          status,
          isLate,
          isEarlyExit,
          isManual: !!manualToday,
          manualNote: manualToday?.manualNote ?? null,
          manualEditedBy:
            editor?.fullName ?? editor?.name ?? editor?.email ?? null,
          detailedLogs: empReadings.map((r) => ({
            time: formatIstanbulTime(r.accessTime),
            action: r.accessStatus === "izin_verildi" ? "Giriş" : "Reddedildi",
            location: "Bilinmiyor",
          })),
          days,
        };
      })
    );

    // Status filtresi (frontend'den önce sunucu tarafında uygula)
    const filtered =
      args.statusFilter && args.statusFilter !== "all"
        ? tableData.filter((row) => {
            if (args.statusFilter === "overtime") return row.overtimeHours > 0;
            return row.status === args.statusFilter;
          })
        : tableData;

    return filtered.sort((a, b) => a.name.localeCompare(b.name, "tr"));
  },
});

/**
 * PDKS grafik verileri - devam oranı, departman devamsızlık, geç kalma dağılımı
 */
export const getPdksChartData = authedQuery({
  args: {
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    const startISO = `${args.startDate}T00:00:00.000`;
    const endISO = `${args.endDate}T23:59:59.999`;

    let readings;
    if (ctx.user.role === "super_admin") {
      readings = await ctx.db
        .query("cardReadings")
        .withIndex("by_access_time")
        .filter((q) =>
          q.and(q.gte(q.field("accessTime"), startISO), q.lte(q.field("accessTime"), endISO))
        )
        .collect();
    } else if (allowedProjectIds.length > 0) {
      const results = await Promise.all(
        allowedProjectIds.map((pid) =>
          ctx.db
            .query("cardReadings")
            .withIndex("by_project", (q) => q.eq("projectId", pid))
            .filter((q) =>
              q.and(
                q.gte(q.field("accessTime"), startISO),
                q.lte(q.field("accessTime"), endISO)
              )
            )
            .collect()
        )
      );
      readings = results.flat();
    } else {
      return {
        dailyAttendance: [],
        departmentAbsence: [],
        lateDistribution: [],
        hourlyTrend: [],
        lateMinutesSamples: [],
      };
    }

    readings.sort(
      (a, b) => new Date(a.accessTime).getTime() - new Date(b.accessTime).getTime()
    );

    const chartProjectId =
      ctx.user.role === "super_admin"
        ? undefined
        : allowedProjectIds[0] ?? undefined;
    const chartSettings = await getEffectiveWorkSettings(ctx, chartProjectId);
    const fallbackLateThresholdMin =
      parseHHMM(chartSettings.workStartTime) + chartSettings.maxLateMinutes;

    const chartEmployees =
      ctx.user.role === "super_admin"
        ? await ctx.db.query("employees").collect()
        : (
            await Promise.all(
              allowedProjectIds.map((pid) =>
                ctx.db
                  .query("employees")
                  .withIndex("by_project", (q) => q.eq("projectId", pid))
                  .collect(),
              ),
            )
          ).flat();
    const chartShiftResolver = await buildShiftResolver(ctx, chartEmployees);

    const dayNames = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];

    const dailyMap = new Map<
      string,
      { present: Set<string>; late: Set<string>; absent: Set<string>; total: Set<string> }
    >();
    const departmentAbsenceMap = new Map<string, number>();
    const lateByHourMap = new Map<number, number>();
    const hourlyCheckinMap = new Map<string, number>();

    const allEmployeeIds = new Set<string>();
    for (const r of readings) {
      const empKey = r.employeeId ?? r.cardNo;
      allEmployeeIds.add(empKey);
    }

    const start = new Date(args.startDate);
    const end = new Date(args.endDate);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateKey = d.toISOString().split("T")[0];
      dailyMap.set(dateKey, {
        present: new Set(),
        late: new Set(),
        absent: new Set(),
        total: new Set(allEmployeeIds),
      });
    }

    const employeeDayMap = new Map<string, Map<string, { firstEntry?: string; hasLate: boolean; lateMinutes: number }>>();
    const lateMinutesSamples: number[] = [];

    for (const r of readings) {
      const empKey = r.employeeId ?? r.cardNo;
      const dateKey = r.accessTime.split("T")[0];
      const dayData = dailyMap.get(dateKey);
      if (!dayData) continue;

      if (r.accessStatus === "izin_verildi") {
        if (!employeeDayMap.has(empKey)) employeeDayMap.set(empKey, new Map());
        const empDay = employeeDayMap.get(empKey)!;
        if (!empDay.has(dateKey)) {
          empDay.set(dateKey, { hasLate: false, lateMinutes: 0 });
        }
        const rec = empDay.get(dateKey)!;
        if (!rec.firstEntry) {
          rec.firstEntry = r.accessTime;
          const arrivalMin = isoTimeToTRMinutes(r.accessTime);
          const shift = r.employeeId
            ? chartShiftResolver.resolve(r.employeeId, dateKey)
            : null;
          const lateThresholdMin = shift
            ? thresholdsForShift(shift, chartSettings).lateThresholdMin
            : fallbackLateThresholdMin;
          rec.hasLate = arrivalMin > lateThresholdMin;
          rec.lateMinutes = Math.max(0, arrivalMin - lateThresholdMin);
        }
      }
    }

    for (const [empKey, days] of employeeDayMap) {
      for (const [dateKey, rec] of days) {
        const dayData = dailyMap.get(dateKey);
        if (!dayData) continue;
        dayData.present.add(empKey);
        if (rec.hasLate) {
          dayData.late.add(empKey);
          if (rec.lateMinutes > 0) lateMinutesSamples.push(rec.lateMinutes);
          const firstReading = readings.find((r) => (r.employeeId ?? r.cardNo) === empKey);
          if (firstReading?.employeeId && rec.firstEntry) {
            const h = new Date(rec.firstEntry).getHours();
            lateByHourMap.set(h, (lateByHourMap.get(h) ?? 0) + 1);
          }
        }
      }
    }

    for (const dayData of dailyMap.values()) {
      for (const empKey of allEmployeeIds) {
        if (!dayData.present.has(empKey)) {
          dayData.absent.add(empKey);
        }
      }
    }

    const empToDept = new Map<string, string>();
    for (const r of readings) {
      const empKey = r.employeeId ?? r.cardNo;
      if (empToDept.has(empKey)) continue;
      const emp = r.employeeId ? await ctx.db.get(r.employeeId) as Doc<"employees"> | null : null;
      if (emp?.departmentId) {
        const dept = await ctx.db.get(emp.departmentId) as Doc<"departments"> | null;
        empToDept.set(empKey, dept?.name ?? "Bilinmiyor");
      } else {
        empToDept.set(empKey, "Bilinmiyor");
      }
    }

    for (const [, dayData] of dailyMap) {
      for (const empKey of dayData.absent) {
        const deptName = empToDept.get(empKey) ?? "Bilinmiyor";
        departmentAbsenceMap.set(deptName, (departmentAbsenceMap.get(deptName) ?? 0) + 1);
      }
    }

    const dailyAttendance = Array.from(dailyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dateKey, data]) => {
        const d = new Date(dateKey);
        return {
          name: dayNames[d.getDay()],
          date: dateKey,
          present: data.present.size,
          late: data.late.size,
          absent: data.absent.size,
          rate: data.total.size > 0 ? Math.round((data.present.size / data.total.size) * 100) : 0,
        };
      });

    const departmentAbsence = Array.from(departmentAbsenceMap.entries()).map(([name, value]) => ({
      name,
      absences: value,
    }));

    const lateDistribution = Array.from(lateByHourMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([hour, count]) => ({
        hour: `${hour}:00`,
        count,
      }));

    for (const r of readings) {
      if (r.accessStatus !== "izin_verildi") continue;
      const hourKey = r.accessTime.slice(11, 13);
      hourlyCheckinMap.set(hourKey, (hourlyCheckinMap.get(hourKey) ?? 0) + 1);
    }

    const hourlyTrend = Array.from(hourlyCheckinMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([hour, checkins]) => ({
        hour: `${hour}:00`,
        checkins,
      }));

    return {
      dailyAttendance,
      departmentAbsence,
      lateDistribution,
      hourlyTrend,
      lateMinutesSamples,
    };
  },
});

/**
 * Aylık bordro cetveli - çalışan × gün matrisi.
 * Her gün için: payrollCode (N/RT/HT/İZN/DV), çalışılan dakika, geç kalma flag,
 * fazla mesai dakikası ve günün çarpanı.
 */
export const getMonthlyPayrollSheet = authedQuery({
  args: {
    year: v.number(),
    month: v.number(), // 1-12
  },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);

    const monthStr = String(args.month).padStart(2, "0");
    const lastDay = new Date(args.year, args.month, 0).getUTCDate();
    const startDate = `${args.year}-${monthStr}-01`;
    const endDate = `${args.year}-${monthStr}-${String(lastDay).padStart(2, "0")}`;
    const startISO = `${startDate}T00:00:00.000`;
    const endISO = `${endDate}T23:59:59.999`;

    let readings;
    let employees: Doc<"employees">[];
    if (ctx.user.role === "super_admin") {
      [readings, employees] = await Promise.all([
        ctx.db
          .query("cardReadings")
          .withIndex("by_access_time")
          .filter((q) =>
            q.and(
              q.gte(q.field("accessTime"), startISO),
              q.lte(q.field("accessTime"), endISO)
            )
          )
          .collect(),
        ctx.db
          .query("employees")
          .filter((q) => q.eq(q.field("isActive"), true))
          .collect(),
      ]);
    } else if (allowedProjectIds.length > 0) {
      const [readingResults, empResults] = await Promise.all([
        Promise.all(
          allowedProjectIds.map((pid) =>
            ctx.db
              .query("cardReadings")
              .withIndex("by_project", (q) => q.eq("projectId", pid))
              .filter((q) =>
                q.and(
                  q.gte(q.field("accessTime"), startISO),
                  q.lte(q.field("accessTime"), endISO)
                )
              )
              .collect()
          )
        ),
        Promise.all(
          allowedProjectIds.map((pid) =>
            ctx.db
              .query("employees")
              .withIndex("by_project", (q) => q.eq("projectId", pid))
              .filter((q) => q.eq(q.field("isActive"), true))
              .collect()
          )
        ),
      ]);
      readings = readingResults.flat();
      employees = empResults.flat();
    } else {
      return { days: [], rows: [], year: args.year, month: args.month };
    }

    const referenceProjectId =
      ctx.user.role === "super_admin"
        ? undefined
        : allowedProjectIds[0] ?? undefined;
    const [workSettings, holidayMap, generalSettings, overtimeRates, payrollShiftResolver] =
      await Promise.all([
        getEffectiveWorkSettings(ctx, referenceProjectId),
        getHolidaysMap(ctx, referenceProjectId, startDate, endDate),
        ctx.db
          .query("generalSettings")
          .withIndex("by_project", (q) => q.eq("projectId", referenceProjectId))
          .first(),
        getEffectiveOvertimeRates(ctx, referenceProjectId),
        buildShiftResolver(ctx, employees),
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

    // Onaylı izinler
    const approvedLeaves = await ctx.db
      .query("leaves")
      .filter((q) => q.eq(q.field("status"), "approved"))
      .collect();

    // Manuel pdksRecords her çalışan için ay aralığı (batch: tek query, in-memory filter)
    const empIds = employees.map((e) => e._id);
    const empIdSet = new Set<string>(empIds.map((id) => String(id)));
    const manualByEmpDate = new Map<string, Doc<"pdksRecords">>();
    const allRecs = await ctx.db
      .query("pdksRecords")
      .withIndex("by_date", (q) => q.gte("date", startDate).lte("date", endDate))
      .collect();
    const recs = allRecs.filter((r) => empIdSet.has(String(r.employeeId)));
    {
      for (const r of recs) {
        if (r.manualEntry) manualByEmpDate.set(`${String(r.employeeId)}__${r.date}`, r);
      }
    }

    // readings'i çalışan × gün'e grupla
    const empIdByCard = new Map<string, string>();
    for (const e of employees) {
      if (e.cardNumber) empIdByCard.set(e.cardNumber, String(e._id));
    }

    const empDayReadings = new Map<string, Doc<"cardReadings">[]>();
    for (const r of readings) {
      const empId = matchEmployeeKey(
        { employeeId: r.employeeId, cardNo: r.cardNo },
        empIdSet,
        empIdByCard,
      );
      if (!empId) continue;
      const dateKey = r.accessTime.split("T")[0];
      const key = `${empId}__${dateKey}`;
      if (!empDayReadings.has(key)) empDayReadings.set(key, []);
      empDayReadings.get(key)!.push(r);
    }

    const allDepartments = await ctx.db.query("departments").collect();
    const deptById = new Map(allDepartments.map((d) => [String(d._id), d]));

    const rows = await Promise.all(
      employees.map(async (emp) => {
        const department = emp.departmentId
          ? deptById.get(String(emp.departmentId)) ?? null
          : null;

        const empHourlyRate = resolveHourlyRate({
          hourlyRate: emp.hourlyRate,
          monthlySalary: emp.monthlySalary,
          monthlyHoursBase: workSettings.monthlyHoursBase,
        });

        const cells = days.map((d) => {
          const manual = manualByEmpDate.get(`${emp._id}__${d}`);
          const dayReadings = (empDayReadings.get(`${emp._id}__${d}`) ?? [])
            .filter((r) => r.accessStatus === "izin_verildi")
            .sort(
              (a, b) =>
                new Date(a.accessTime).getTime() -
                new Date(b.accessTime).getTime()
            );

          const hasLeave = approvedLeaves.some(
            (l) =>
              l.employeeId === emp._id &&
              d >= l.startDate &&
              d <= l.endDate
          );
          const cls = classifyDay(d, workingDays, holidayMap.get(d));
          const hasAttendance =
            (manual?.entryTime != null && manual?.exitTime != null) ||
            dayReadings.length >= 2;
          const code = payrollCodeForDay({
            classification: cls,
            hasLeave,
            hasAttendance,
          });

          let rawTotalMin = 0;
          let entryMin: number | undefined;
          let exitMin: number | undefined;
          if (manual?.entryTime && manual?.exitTime) {
            entryMin = parseHHMM(manual.entryTime);
            exitMin = parseHHMM(manual.exitTime);
            rawTotalMin = Math.max(0, exitMin - entryMin);
          } else if (dayReadings.length >= 2) {
            const first = dayReadings[0];
            const last = dayReadings[dayReadings.length - 1];
            rawTotalMin = minutesBetweenISO(first.accessTime, last.accessTime);
            entryMin = isoTimeToTRMinutes(first.accessTime);
            exitMin = isoTimeToTRMinutes(last.accessTime);
          }

          const entryISO = manual?.entryTime
            ? `${d}T${manual.entryTime}:00.000`
            : dayReadings[0]?.accessTime;
          const exitISO = manual?.exitTime
            ? `${d}T${manual.exitTime}:00.000`
            : dayReadings[dayReadings.length - 1]?.accessTime;
          const dayShift = payrollShiftResolver.resolve(emp._id, d);
          const daySettings = settingsForShift(dayShift, workSettings);
          const { isLate, isEarlyExit } = evaluateLateEarly(
            entryISO,
            exitISO !== entryISO ? exitISO : undefined,
            daySettings
          );

          const totalMin = netWorkMinutes(rawTotalMin, dayShift, {
            entryMinutes: entryMin,
            exitMinutes: exitMin,
          });

          const overtimeMin = dailyOvertimeForShift({
            classification: cls,
            netMinutes: totalMin,
            lastExitMinutes: exitMin,
            shift: dayShift,
            workSettings,
          });
          const multiplier =
            overtimeMin > 0
              ? multiplierForClassification(cls, overtimeRates)
              : 0;
          const overtimePayAmount = overtimePayTRY({
            overtimeMinutes: overtimeMin,
            multiplier,
            hourlyRate: empHourlyRate,
          });

          return {
            date: d,
            payrollCode: code,
            totalMinutes: totalMin,
            overtimeMinutes: overtimeMin,
            multiplier,
            overtimePayTRY: overtimePayAmount,
            isLate,
            isEarlyExit,
            isManual: !!manual,
            classification: cls,
          };
        });

        const dayEntries: DayEntry[] = cells.map((c) => ({
          date: c.date,
          netMinutes: c.totalMinutes,
          classification: c.classification,
        }));
        const buckets = bucketWeeklyOvertime(dayEntries);
        const weeklyOvertimeMin = buckets.reduce(
          (s, b) => s + b.overtimeMinutes + b.premiumMinutes,
          0,
        );
        const exceedsDaily11h = buckets.flatMap((b) => b.exceedsDaily11h);

        const totals = cells.reduce(
          (acc, c) => {
            acc.totalMinutes += c.totalMinutes;
            acc.overtimePayTRY += c.overtimePayTRY ?? 0;
            if (c.payrollCode === "İZN") acc.leaveDays += 1;
            if (c.payrollCode === "DV") acc.absentDays += 1;
            if (c.isLate) acc.lateDays += 1;
            return acc;
          },
          {
            totalMinutes: 0,
            overtimePayTRY: 0,
            leaveDays: 0,
            absentDays: 0,
            lateDays: 0,
          }
        );

        return {
          employeeId: emp._id,
          payrollCode: emp.payrollCode ?? "",
          name: `${emp.firstName} ${emp.lastName}`.trim(),
          cardNumber: emp.cardNumber,
          department: department?.name ?? "-",
          hourlyRate: empHourlyRate,
          cells,
          totals: {
            ...totals,
            overtimeMinutes: weeklyOvertimeMin,
            overtimePayTRY: empHourlyRate !== null ? totals.overtimePayTRY : null,
            exceedsDaily11h,
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
  },
});

export const insert = mutation({
  args: {
    projectId: v.optional(v.id("projects")),
    deviceId: v.optional(v.id("devices")),
    employeeId: v.optional(v.id("employees")),
    cardNo: v.string(),
    employeeName: v.optional(v.string()),
    accessTime: v.string(),
    accessStatus: v.optional(
      v.union(v.literal("izin_verildi"), v.literal("reddedildi"))
    ),
    rawData: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    return await ctx.db.insert("cardReadings", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });
  },
});

type AccessDirection = "entry" | "exit";

// IDE Smart panel olay zamanı ("YYYY-MM-DD HH:MM:SS", panel TZ = UTC+3) → UTC ISO.
// Geçersiz/boş ise undefined döner (çağıran sunucu alış anına düşer).
function ideTimeToISO(ideTime: string | undefined): string | undefined {
  if (!ideTime) return undefined;
  const m = ideTime.trim().match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/,
  );
  if (!m) return undefined;
  // Panel saatini UTC+3 kabul edip ISO offset'li string olarak ver; Date doğrular.
  const iso = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}+03:00`;
  const t = new Date(iso);
  return Number.isNaN(t.getTime()) ? undefined : t.toISOString();
}

// Türkiye saatiyle (UTC+3, DST yok) verilen ISO timestamp'inin günü başlangıcının
// UTC ISO karşılığını döndürür. Toggle'ı günlük resetlemek için kullanılır.
function startOfTurkeyDayISO(nowISO: string): string {
  const tr = new Date(new Date(nowISO).getTime() + 3 * 60 * 60 * 1000);
  const y = tr.getUTCFullYear();
  const m = String(tr.getUTCMonth() + 1).padStart(2, "0");
  const d = String(tr.getUTCDate()).padStart(2, "0");
  // TR günü 00:00 = UTC önceki günün 21:00
  return `${y}-${m}-${d}T00:00:00.000+03:00`;
}

// Cihazın yön ayarına ve toggle state'ine göre okumanın yönünü çözer.
async function resolveDirection(
  ctx: MutationCtx,
  params: {
    device: Doc<"devices"> | null;
    employeeId: Id<"employees"> | null;
    nowISO: string;
    /** IDE Smart panel: hangi aktüatör/kapıdan geçildi (io_id). */
    ideIoId?: number;
  }
): Promise<AccessDirection> {
  // IDE Smart paneli: yön kapı (io_id) düzeyinde. Varsayılan adlandırma io 0=Giriş, 1=Çıkış.
  if (params.device?.brand === "ide_smart" && params.ideIoId !== undefined) {
    if (params.ideIoId === 0) return "entry";
    if (params.ideIoId === 1) return "exit";
    // Diğer kapılar için cihaz/çalışan toggle'ına düş.
  }

  const cfg = params.device?.accessDirection ?? "both";
  if (cfg === "entry") return "entry";
  if (cfg === "exit") return "exit";

  // both → çalışan + cihaz çiftine göre toggle
  if (!params.employeeId || !params.device) return "entry";

  const startOfDay = startOfTurkeyDayISO(params.nowISO);
  const last = await ctx.db
    .query("cardReadings")
    .withIndex("by_employee_device_time", (q) =>
      q.eq("employeeId", params.employeeId!).eq("deviceId", params.device!._id)
    )
    .filter((q) => q.eq(q.field("accessStatus"), "izin_verildi"))
    .order("desc")
    .first();

  if (!last || last.accessTime < startOfDay) return "entry";
  return last.direction === "entry" ? "exit" : "entry";
}

/**
 * Cihaz ∩ çalışan kesişimindeki kurallardan AKTİF olanların id kümesini çözer.
 * Saf karar (`canEmployeeAccessDevice`) için gereken tek DB-bağımlı adım: yalnız
 * kesişimdeki kuralları okur (tüm kuralları değil) — küçük küme, ucuz.
 */
async function resolveActiveMatchingRuleIds(
  ctx: MutationCtx,
  deviceGroupIds: Id<"accessRules">[],
  employeeGroupIds: Id<"accessRules">[],
): Promise<Set<Id<"accessRules">>> {
  const employeeSet = new Set(employeeGroupIds);
  const matching = deviceGroupIds.filter((gid) => employeeSet.has(gid));
  const rules = await Promise.all(matching.map((gid) => ctx.db.get(gid)));
  return new Set(
    rules
      .filter((r): r is NonNullable<typeof r> => r?.isActive === true)
      .map((r) => r._id),
  );
}

/**
 * Kart okuyucu cihazlarından gelen istekleri işler (internal - HTTP action'dan çağrılır).
 * Erişim kontrolü yapar ve card_readings kaydı oluşturur.
 */
export const processCardReading = internalMutation({
  args: {
    cardNo: v.string(),
    deviceSerial: v.string(),
    deviceIp: v.optional(v.string()),
    /**
     * Token doğrulanmış istekte (per-device apiToken) cihaz buradan SABİTLENİR;
     * body serial/IP'ye güvenilmez (cross-tenant forge önlenir). Yoksa eski lookup.
     */
    authedDeviceId: v.optional(v.id("devices")),
    rawBody: v.optional(v.string()),
    hikDevIndex: v.optional(v.string()),
    hikEhomeID: v.optional(v.string()),
    hikMajorEventType: v.optional(v.number()),
    hikSubEventType: v.optional(v.number()),
    hikCurrentVerifyMode: v.optional(v.string()),
    hikSerialNo: v.optional(v.number()),
    hikFrontSerialNo: v.optional(v.number()),
    hikDateTime: v.optional(v.string()),
    hikPictureURL: v.optional(v.string()),
    hikMask: v.optional(v.string()),
    hikHelmet: v.optional(v.string()),
    hikTemperature: v.optional(v.number()),
    hikEventState: v.optional(v.string()),
    // IDE Smart panel event alanları
    ideUuid: v.optional(v.string()),
    ideIoId: v.optional(v.number()),
    /** Panel erişim kararı (payload.result). Kod anlamları: lib/cardReaderParse ideResultGranted. */
    ideResult: v.optional(v.number()),
    /** Panel olay zamanı ("YYYY-MM-DD HH:MM:SS", panel TZ = UTC+3). */
    ideTime: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const accessTime = new Date().toISOString();
    const firstProjectId = (await ctx.db.query("projects").first())?._id;
    const projectForRow = (
      employeeProject: typeof firstProjectId,
      deviceProject: typeof firstProjectId
    ) => employeeProject ?? deviceProject ?? firstProjectId;

    // Tüm cardReadings insert'lerine spread edilecek Hikvision metadata
    const hikFields = {
      hikDevIndex: args.hikDevIndex,
      hikMajorEventType: args.hikMajorEventType,
      hikSubEventType: args.hikSubEventType,
      hikCurrentVerifyMode: args.hikCurrentVerifyMode,
      hikSerialNo: args.hikSerialNo,
      hikFrontSerialNo: args.hikFrontSerialNo,
      hikDateTime: args.hikDateTime,
      hikPictureURL: args.hikPictureURL,
      hikMask: args.hikMask,
      hikHelmet: args.hikHelmet,
      hikTemperature: args.hikTemperature,
      hikEventState: args.hikEventState,
    } as const;

    // 1. Cihazı bul. Token doğrulanmış istekte (authedDeviceId) attribution o cihaza
    //    SABİTLENİR — body'deki serial/IP/uuid'ye GÜVENİLMEZ. Bu, /card-reader'daki
    //    localBridge guard-skip + IP-global lookup ile bir token sahibinin BAŞKA tenant'ın
    //    cihazına forged kart/audit satırı yazmasını engeller. Token yoksa (deprecated
    //    unauth yol) eski serial→devIndex→ehome→uuid→IP zincirine düşülür.
    let device = null;
    if (args.authedDeviceId) {
      device = await ctx.db.get(args.authedDeviceId);
    } else {
      if (args.deviceSerial?.trim()) {
        device = await ctx.db
          .query("devices")
          .withIndex("by_device_serial", (q) =>
            q.eq("deviceSerial", args.deviceSerial!.trim())
          )
          .first();
      }
      // Gateway-passthrough event'inde serial yerine devIndex gelir → indexli lookup
      if (!device && args.hikDevIndex?.trim()) {
        device = await ctx.db
          .query("devices")
          .withIndex("by_hik_dev_index", (q) =>
            q.eq("hikDevIndex", args.hikDevIndex!.trim())
          )
          .first();
      }
      // Cihaz event'i `deviceID` field'ında ehomeID gönderir (gateway register'da atadığımız)
      if (!device && args.hikEhomeID?.trim()) {
        device = await ctx.db
          .query("devices")
          .withIndex("by_ehome_id", (q) =>
            q.eq("ehomeID", args.hikEhomeID!.trim())
          )
          .first();
      }
      // IDE Smart panel event'i: serial yerine panel UUID gelebilir.
      if (!device && args.ideUuid?.trim()) {
        device = await ctx.db
          .query("devices")
          .withIndex("by_ide_uuid", (q) => q.eq("ideUuid", args.ideUuid!.trim()))
          .first();
      }
      if (!device && args.deviceIp?.trim()) {
        device = await ctx.db
          .query("devices")
          .withIndex("by_device_ip", (q) =>
            q.eq("deviceIp", args.deviceIp!.trim())
          )
          .first();
      }
    }

    // Hikvision brand-dispatch: karar cihazda verilir, biz sadece audit yazarız.
    // QR vs. cihazlar aşağıdaki mevcut akışa düşer (Convex DB lookup → granted hesapla).
    if (device?.brand === "hikvision") {
      const inferred = inferAccessStatus(
        args.hikMajorEventType,
        args.hikSubEventType,
      );
      const accessStatus: "izin_verildi" | "reddedildi" =
        inferred ?? "reddedildi";
      const granted = accessStatus === "izin_verildi";
      const denialReason = granted
        ? undefined
        : inferDenialReason(args.hikSubEventType);

      const employee = await ctx.db
        .query("employees")
        .withIndex("by_card", (q) => q.eq("cardNumber", args.cardNo))
        .first();

      const direction = employee
        ? await resolveDirection(ctx, {
            device,
            employeeId: employee._id,
            nowISO: accessTime,
          })
        : undefined;

      // serialNo gap detection — event ardışıklığı bozulduysa AcsEvent backfill için işaretle.
      // Şimdilik sadece warn log; Phase 5.2'de history backfill kuyruğu eklenecek.
      if (
        args.hikSerialNo !== undefined &&
        args.hikFrontSerialNo !== undefined &&
        device.hikLastSerialNo !== undefined &&
        args.hikFrontSerialNo !== device.hikLastSerialNo
      ) {
        console.warn(
          `[hik-event-gap] device=${device.name} expected front=${device.hikLastSerialNo} got=${args.hikFrontSerialNo} current=${args.hikSerialNo}`,
        );
      }
      if (
        args.hikSerialNo !== undefined &&
        args.hikSerialNo !== device.hikLastSerialNo
      ) {
        await ctx.db.patch(device._id, { hikLastSerialNo: args.hikSerialNo });
      }

      await ctx.db.insert("cardReadings", {
        projectId: projectForRow(employee?.projectId, device.projectId),
        deviceId: device._id,
        employeeId: employee?._id,
        cardNo: args.cardNo,
        employeeName: employee
          ? `${employee.firstName} ${employee.lastName}`
          : undefined,
        accessTime,
        accessStatus,
        direction,
        rawData: args.rawBody,
        ...hikFields,
        hikDenialReason: denialReason,
        createdAt: accessTime,
        updatedAt: accessTime,
      });
      return { granted };
    }

    // IDE Smart brand-dispatch: erişim kararını PANEL verir (payload.result).
    // Hikvision gibi: biz sadece audit yazarız, kartı ekrana düşürürüz.
    // Kayıtlı olmayan kart da yazılır (employee yoksa isim boş, accessStatus panel kararı).
    if (device?.brand === "ide_smart") {
      // Erişim kararını PANEL verir; result kodu (1/2/3 = grant, kapı açılır) → ideResultGranted.
      const granted = ideResultGranted(args.ideResult);
      const accessStatus: "izin_verildi" | "reddedildi" = granted
        ? "izin_verildi"
        : "reddedildi";

      // Panel olay zamanı (payload.time, panel TZ = UTC+3) → UTC ISO. Offline kuyruktan
      // toplu push edilen event'lerde gerçek okutma anı korunur (sunucu alış anı değil).
      const ideAccessTime = ideTimeToISO(args.ideTime) ?? accessTime;

      const employee = await ctx.db
        .query("employees")
        .withIndex("by_card", (q) => q.eq("cardNumber", args.cardNo))
        .first();

      const direction = await resolveDirection(ctx, {
        device,
        employeeId: employee?._id ?? null,
        nowISO: ideAccessTime,
        ideIoId: args.ideIoId,
      });

      await ctx.db.insert("cardReadings", {
        projectId: projectForRow(employee?.projectId, device.projectId),
        deviceId: device._id,
        employeeId: employee?._id,
        cardNo: args.cardNo,
        employeeName: employee
          ? `${employee.firstName} ${employee.lastName}`
          : undefined,
        accessTime: ideAccessTime,
        accessStatus,
        direction,
        ideIoId: args.ideIoId,
        rawData: args.rawBody,
        createdAt: accessTime,
        updatedAt: accessTime,
      });
      return { granted };
    }

    // Mobil dinamik QR token branch'i: cihaz QR'ı kart gibi POST'lar.
    // UUID v4 formatı gerçek kart numaralarıyla çakışmaz (kartlar tiresiz).
    const isToken = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(args.cardNo);
    if (isToken) {
      const tokenRow = await ctx.db
        .query("checkInTokens")
        .withIndex("by_token", (q) => q.eq("token", args.cardNo))
        .first();

      if (!tokenRow) {
        await ctx.db.insert("cardReadings", {
          projectId: projectForRow(undefined, device?.projectId),
          deviceId: device?._id,
          cardNo: args.cardNo,
          accessTime,
          accessStatus: "reddedildi",
          rawData: args.rawBody,
          ...hikFields,
          createdAt: accessTime,
          updatedAt: accessTime,
        });
        return { granted: false };
      }

      if (tokenRow.usedAt) {
        await ctx.db.insert("cardReadings", {
          projectId: projectForRow(undefined, device?.projectId),
          deviceId: device?._id,
          employeeId: tokenRow.employeeId,
          cardNo: args.cardNo,
          accessTime,
          accessStatus: "reddedildi",
          rawData: args.rawBody,
          ...hikFields,
          createdAt: accessTime,
          updatedAt: accessTime,
        });
        return { granted: false };
      }

      if (new Date(accessTime) > new Date(tokenRow.expiresAt)) {
        await ctx.db.insert("cardReadings", {
          projectId: projectForRow(undefined, device?.projectId),
          deviceId: device?._id,
          employeeId: tokenRow.employeeId,
          cardNo: args.cardNo,
          accessTime,
          accessStatus: "reddedildi",
          rawData: args.rawBody,
          ...hikFields,
          createdAt: accessTime,
          updatedAt: accessTime,
        });
        return { granted: false };
      }

      const tokenEmployee = await ctx.db.get(tokenRow.employeeId);
      if (!tokenEmployee || !tokenEmployee.isActive) {
        await ctx.db.insert("cardReadings", {
          projectId: projectForRow(tokenEmployee?.projectId, device?.projectId),
          deviceId: device?._id,
          employeeId: tokenRow.employeeId,
          cardNo: args.cardNo,
          accessTime,
          accessStatus: "reddedildi",
          rawData: args.rawBody,
          ...hikFields,
          createdAt: accessTime,
          updatedAt: accessTime,
        });
        return { granted: false };
      }

      // Cihaz + grup erişim kontrolü (kart akışıyla aynı kural)
      let tokenHasAccess = false;
      if (device) {
        const deviceGroups = await ctx.db
          .query("groupDevices")
          .withIndex("by_project_device", (q) =>
            q.eq("projectId", device.projectId).eq("deviceId", device._id),
          )
          .collect();
        const deviceGroupIds = deviceGroups.map((gd) => gd.groupId);
        const employeeAccessGroups = await ctx.db
          .query("groupMembers")
          .withIndex("by_project_employee", (q) =>
            q.eq("projectId", tokenEmployee.projectId).eq("employeeId", tokenEmployee._id),
          )
          .collect();
        const employeeGroupIds = employeeAccessGroups.map((gm) => gm.groupId);
        const activeRuleIds = await resolveActiveMatchingRuleIds(
          ctx,
          deviceGroupIds,
          employeeGroupIds,
        );
        tokenHasAccess = canEmployeeAccessDevice({
          deviceGroupIds,
          employeeGroupIds,
          activeRuleIds,
        });
      }

      await ctx.db.patch(tokenRow._id, { usedAt: accessTime });
      const tokenDirection = await resolveDirection(ctx, {
        device,
        employeeId: tokenEmployee._id,
        nowISO: accessTime,
      });
      await ctx.db.insert("cardReadings", {
        projectId: projectForRow(tokenEmployee.projectId, device?.projectId),
        deviceId: device?._id,
        employeeId: tokenEmployee._id,
        cardNo: tokenEmployee.cardNumber,
        employeeName: `${tokenEmployee.firstName} ${tokenEmployee.lastName}`,
        accessTime,
        accessStatus: tokenHasAccess ? "izin_verildi" : "reddedildi",
        direction: tokenDirection,
        rawData: args.rawBody,
        ...hikFields,
        createdAt: accessTime,
        updatedAt: accessTime,
      });
      return { granted: tokenHasAccess };
    }

    // 2. Çalışanı kart numarasına göre bul
    const employee = await ctx.db
      .query("employees")
      .withIndex("by_card", (q) => q.eq("cardNumber", args.cardNo))
      .first();

    if (!employee) {
      await ctx.db.insert("cardReadings", {
        projectId: projectForRow(undefined, device?.projectId),
        deviceId: device?._id,
        cardNo: args.cardNo,
        accessTime,
        accessStatus: "reddedildi",
        rawData: args.rawBody,
        ...hikFields,
        createdAt: accessTime,
        updatedAt: accessTime,
      });
      return { granted: false };
    }

    if (!employee.isActive) {
      await ctx.db.insert("cardReadings", {
        projectId: projectForRow(employee.projectId, device?.projectId),
        deviceId: device?._id,
        employeeId: employee._id,
        cardNo: args.cardNo,
        employeeName: `${employee.firstName} ${employee.lastName}`,
        accessTime,
        accessStatus: "reddedildi",
        rawData: args.rawBody,
        ...hikFields,
        createdAt: accessTime,
        updatedAt: accessTime,
      });
      return { granted: false };
    }

    if (!device) {
      await ctx.db.insert("cardReadings", {
        projectId: projectForRow(employee.projectId, undefined),
        employeeId: employee._id,
        cardNo: args.cardNo,
        employeeName: `${employee.firstName} ${employee.lastName}`,
        accessTime,
        accessStatus: "reddedildi",
        rawData: args.rawBody,
        ...hikFields,
        createdAt: accessTime,
        updatedAt: accessTime,
      });
      return { granted: false };
    }

    // 3. Cihazın hiçbir grupta olup olmadığını kontrol et
    const deviceGroups = await ctx.db
      .query("groupDevices")
      .withIndex("by_project_device", (q) =>
        q.eq("projectId", device.projectId).eq("deviceId", device._id),
      )
      .collect();

    if (deviceGroups.length === 0) {
      const noGroupDirection = await resolveDirection(ctx, {
        device,
        employeeId: employee._id,
        nowISO: accessTime,
      });
      await ctx.db.insert("cardReadings", {
        projectId: projectForRow(employee.projectId, device.projectId),
        deviceId: device._id,
        employeeId: employee._id,
        cardNo: args.cardNo,
        employeeName: `${employee.firstName} ${employee.lastName}`,
        accessTime,
        accessStatus: "reddedildi",
        direction: noGroupDirection,
        rawData: args.rawBody,
        ...hikFields,
        createdAt: accessTime,
        updatedAt: accessTime,
      });
      return { granted: false };
    }

    // 4. Çalışanın bu cihaza erişimi var mı? (groupMembers + accessRules)
    const deviceGroupIds = deviceGroups.map((gd) => gd.groupId);
    const employeeAccessGroups = await ctx.db
      .query("groupMembers")
      .withIndex("by_project_employee", (q) =>
        q.eq("projectId", employee.projectId).eq("employeeId", employee._id),
      )
      .collect();
    const employeeGroupIds = employeeAccessGroups.map((gm) => gm.groupId);
    const activeRuleIds = await resolveActiveMatchingRuleIds(
      ctx,
      deviceGroupIds,
      employeeGroupIds,
    );
    const hasAccess = canEmployeeAccessDevice({
      deviceGroupIds,
      employeeGroupIds,
      activeRuleIds,
    });

    // 5. Kayıt oluştur
    const cardDirection = await resolveDirection(ctx, {
      device,
      employeeId: employee._id,
      nowISO: accessTime,
    });
    await ctx.db.insert("cardReadings", {
      projectId: projectForRow(employee.projectId, device.projectId),
      deviceId: device._id,
      employeeId: employee._id,
      cardNo: args.cardNo,
      employeeName: `${employee.firstName} ${employee.lastName}`,
      accessTime,
      accessStatus: hasAccess ? "izin_verildi" : "reddedildi",
      direction: cardDirection,
      rawData: args.rawBody,
      ...hikFields,
      createdAt: accessTime,
      updatedAt: accessTime,
    });

    // 6. Geç kalma bildirimi (hasAccess + geç giriş)
    if (hasAccess) {
      const settings = await getEffectiveWorkSettings(ctx, employee.projectId);
      const dayShiftResolver = await buildShiftResolver(ctx, [employee]);
      const dayShift = dayShiftResolver.resolve(employee._id, accessTime.split("T")[0]);
      const { lateThresholdMin } = thresholdsForShift(dayShift, settings);
      const tr = new Date(new Date(accessTime).getTime() + 3 * 60 * 60 * 1000);
      const h = tr.getUTCHours();
      const m = tr.getUTCMinutes();
      const isLate = h * 60 + m > lateThresholdMin;
      if (isLate && employee.projectId) {
        const notifSettings = await ctx.db
          .query("notificationSettings")
          .withIndex("by_project", (q) => q.eq("projectId", employee.projectId!))
          .first();
        const generalSettings = await ctx.db
          .query("generalSettings")
          .withIndex("by_project", (q) => q.eq("projectId", employee.projectId!))
          .first();
        const notifyEmail = generalSettings?.email ?? process.env.NOTIFICATION_EMAIL;
        if (
          notifSettings?.lateNotifications !== false &&
          notifyEmail
        ) {
          ctx.scheduler.runAfter(0, internal.actions.sendEmail.sendLateNotification, {
            to: notifyEmail,
            employeeName: `${employee.firstName} ${employee.lastName}`,
            lateTime: new Date(accessTime).toLocaleTimeString("tr-TR", {
              hour: "2-digit",
              minute: "2-digit",
            }),
            projectId: employee.projectId,
          });
        }
      }
    }

    return { granted: hasAccess };
  },
});

/**
 * Mobile uygulama için: oturum açmış çalışanın kendi son kart okumalarını döner.
 * `employeeAuthedQuery` `sessionToken` arg'ını otomatik ekler ve
 * `ctx.employee`'yi enjekte eder — `users` tablosuyla ilişki yok.
 */
export const listForEmployee = employeeAuthedQuery({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    const employee = ctx.employee;

    const readings = await ctx.db
      .query("cardReadings")
      .withIndex("by_employee", (q) => q.eq("employeeId", employee._id))
      .order("desc")
      .take(limit);

    return await enrichWithDeviceInfo(ctx, readings);
  },
});

/**
 * Mobile QR check-in. `employeeAuthedMutation` üzerinden çalışana doğrudan
 * `ctx.employee` ile erişir; QR'dan gelen `deviceId` / `deviceSerial` ile
 * cihazı bulur, erişim kuralını değerlendirir ve kayıt atar.
 */
export const selfCheckIn = employeeAuthedMutation({
  args: {
    deviceId: v.optional(v.id("devices")),
    deviceSerial: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const employee = ctx.employee;

    let device: Doc<"devices"> | null = null;
    if (args.deviceId) {
      device = (await ctx.db.get(args.deviceId)) as Doc<"devices"> | null;
    }
    if (!device && args.deviceSerial?.trim()) {
      device = await ctx.db
        .query("devices")
        .withIndex("by_device_serial", (q) =>
          q.eq("deviceSerial", args.deviceSerial!.trim())
        )
        .first();
    }
    if (!device) {
      throw new Error("Cihaz bulunamadı");
    }

    const deviceGroups = await ctx.db
      .query("groupDevices")
      .withIndex("by_project_device", (q) =>
        q.eq("projectId", device.projectId).eq("deviceId", device._id),
      )
      .collect();
    const groupIds = deviceGroups.map((g) => g.groupId);

    const employeeGroups = await ctx.db
      .query("groupMembers")
      .withIndex("by_project_employee", (q) =>
        q.eq("projectId", employee.projectId).eq("employeeId", employee._id),
      )
      .collect();
    const employeeGroupIds = new Set(employeeGroups.map((g) => g.groupId));
    const matching = groupIds.filter((g) => employeeGroupIds.has(g));

    let hasAccess = false;
    for (const groupId of matching) {
      const rule = await ctx.db.get(groupId);
      if (rule?.isActive) {
        hasAccess = true;
        break;
      }
    }

    const accessTime = new Date().toISOString();
    const direction = await resolveDirection(ctx, {
      device,
      employeeId: employee._id,
      nowISO: accessTime,
    });
    const readingId = await ctx.db.insert("cardReadings", {
      projectId: employee.projectId ?? device.projectId,
      deviceId: device._id,
      employeeId: employee._id,
      cardNo: employee.cardNumber,
      employeeName: `${employee.firstName} ${employee.lastName}`,
      accessTime,
      accessStatus: hasAccess ? "izin_verildi" : "reddedildi",
      direction,
      rawData: JSON.stringify({ source: "mobile_qr" }),
      createdAt: accessTime,
      updatedAt: accessTime,
    });

    return { granted: hasAccess, readingId };
  },
});

/**
 * Tek çalışanın belirli aralıktaki gün gün katılım detayı.
 * Drill-down panel için: özet + her gün için ham kart okuma izleri.
 */
export const getEmployeeAttendanceDetail = authedQuery({
  args: {
    employeeId: v.id("employees"),
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);

    const employee = await ctx.db.get(args.employeeId);
    if (!employee) return null;

    if (
      ctx.user.role !== "super_admin" &&
      employee.projectId &&
      !allowedProjectIds.includes(employee.projectId)
    ) {
      return null;
    }

    const startISO = `${args.startDate}T00:00:00.000`;
    const endISO = `${args.endDate}T23:59:59.999`;

    const readings = await ctx.db
      .query("cardReadings")
      .withIndex("by_employee_device_time", (q) =>
        q.eq("employeeId", args.employeeId)
      )
      .filter((q) =>
        q.and(
          q.gte(q.field("accessTime"), startISO),
          q.lte(q.field("accessTime"), endISO)
        )
      )
      .collect();

    readings.sort(
      (a, b) =>
        new Date(a.accessTime).getTime() - new Date(b.accessTime).getTime()
    );

    const referenceProjectId =
      ctx.user.role === "super_admin" ? undefined : employee.projectId;
    const [workSettings, holidayMap, generalSettings, manualRecords, leaves, department, company, position, shift, detailShiftResolver] =
      await Promise.all([
        getEffectiveWorkSettings(ctx, referenceProjectId),
        getHolidaysMap(ctx, referenceProjectId, args.startDate, args.endDate),
        ctx.db
          .query("generalSettings")
          .withIndex("by_project", (q) => q.eq("projectId", referenceProjectId))
          .first(),
        ctx.db
          .query("pdksRecords")
          .withIndex("by_employee_date", (q) => q.eq("employeeId", args.employeeId))
          .filter((q) =>
            q.and(
              q.gte(q.field("date"), args.startDate),
              q.lte(q.field("date"), args.endDate)
            )
          )
          .collect(),
        ctx.db
          .query("leaves")
          .withIndex("by_employee", (q) => q.eq("employeeId", args.employeeId))
          .filter((q) => q.eq(q.field("status"), "approved"))
          .collect(),
        employee.departmentId ? ctx.db.get(employee.departmentId) : Promise.resolve(null),
        employee.companyId ? ctx.db.get(employee.companyId) : Promise.resolve(null),
        employee.positionId ? ctx.db.get(employee.positionId) : Promise.resolve(null),
        employee.shiftId ? ctx.db.get(employee.shiftId) : Promise.resolve(null),
        buildShiftResolver(ctx, [employee]),
      ]);

    const workingDays =
      generalSettings?.workingDays && generalSettings.workingDays.length > 0
        ? generalSettings.workingDays
        : ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma"];

    const manualByDate = new Map<string, Doc<"pdksRecords">>();
    for (const m of manualRecords) {
      if (m.manualEntry) manualByDate.set(m.date, m);
    }

    const periodDateKeys = buildPeriodDateKeys(args.startDate, args.endDate);

    const readingsByDate = new Map<string, typeof readings>();
    for (const r of readings) {
      const dk = r.accessTime.split("T")[0];
      if (!readingsByDate.has(dk)) readingsByDate.set(dk, []);
      readingsByDate.get(dk)!.push(r);
    }

    const days = await Promise.all(
      periodDateKeys.map(async (dk) => {
        const dayReadings = readingsByDate.get(dk) ?? [];
        const granted = dayReadings.filter(
          (r) => r.accessStatus === "izin_verildi"
        );
        const manualDay = manualByDate.get(dk);
        const firstISO = manualDay?.entryTime
          ? `${dk}T${manualDay.entryTime}:00.000+03:00`
          : granted[0]?.accessTime ?? null;
        const lastISO = manualDay?.exitTime
          ? `${dk}T${manualDay.exitTime}:00.000+03:00`
          : granted.length > 1 ? granted[granted.length - 1].accessTime : null;

        let totalMinutes = 0;
        if (manualDay?.entryTime && manualDay?.exitTime) {
          totalMinutes = manualOverrideMinutes(
            manualDay.entryTime,
            manualDay.exitTime,
          );
        } else if (firstISO && lastISO) {
          totalMinutes = Math.max(0, minutesBetweenISO(firstISO, lastISO));
        }

        const cls = classifyDay(dk, workingDays, holidayMap.get(dk));
        const hasLeave = leaves.some(
          (l) => dk >= l.startDate && dk <= l.endDate
        );
        const leaveOnDay = leaves.find(
          (l) => dk >= l.startDate && dk <= l.endDate
        );
        const code = payrollCodeForDay({
          classification: cls,
          hasLeave,
          hasAttendance: !!firstISO,
        });
        const dayShift = detailShiftResolver.resolve(employee._id, dk);
        const daySettingsForLate = settingsForShift(dayShift, workSettings);
        const { isLate, isEarlyExit } = evaluateLateEarly(
          firstISO ?? undefined,
          lastISO ?? undefined,
          daySettingsForLate
        );

        const status = resolveDayStatus({
          mode: "calendar",
          classification: cls,
          hasAttendance: !!firstISO,
          hasLeave,
          isLate,
        });

        const netMinutes = netWorkMinutes(totalMinutes, dayShift);
        const overtimeMinutes = Math.max(0, netMinutes - 8 * 60);
        totalMinutes = netMinutes;

        return {
          date: dk,
          firstEntry: firstISO ? formatIstanbulTime(firstISO) : null,
          lastExit: lastISO ? formatIstanbulTime(lastISO) : null,
          totalMinutes,
          totalHours: formatHoursLabel(totalMinutes),
          status,
          isLate,
          isEarlyExit,
          payrollCode: code,
          overtimeMinutes,
          isManual: !!manualDay,
          manualNote: manualDay?.manualNote ?? null,
          leaveType: leaveOnDay?.leaveType ?? null,
          rawReadings: dayReadings.map((r) => ({
            id: String(r._id),
            time: formatIstanbulTime(r.accessTime, true),
            accessStatus: r.accessStatus,
            direction: r.direction,
            deviceId: r.deviceId ? String(r.deviceId) : null,
          })),
        };
      })
    );

    const summary = days.reduce(
      (acc, d) => {
        acc.totalMinutes += d.totalMinutes;
        if (d.status === "present" || d.status === "late") acc.workedDays += 1;
        if (d.status === "late") acc.lateDays += 1;
        if (d.status === "absent") acc.absentDays += 1;
        if (d.status === "leave") acc.leaveDays += 1;
        acc.overtimeMinutes += d.overtimeMinutes;
        return acc;
      },
      { totalMinutes: 0, workedDays: 0, lateDays: 0, absentDays: 0, leaveDays: 0, overtimeMinutes: 0 }
    );

    return {
      employee: {
        id: String(employee._id),
        firstName: employee.firstName,
        lastName: employee.lastName,
        cardNumber: employee.cardNumber,
        photoUrl: employee.photoUrl ?? null,
        payrollCode: employee.payrollCode ?? null,
        department: department?.name ?? null,
        company: company?.name ?? null,
        position: position?.name ?? null,
        shift: shift?.name ?? null,
      },
      summary: {
        totalMinutes: summary.totalMinutes,
        totalHours: formatHoursLabel(summary.totalMinutes),
        workedDays: summary.workedDays,
        lateDays: summary.lateDays,
        absentDays: summary.absentDays,
        leaveDays: summary.leaveDays,
        overtimeMinutes: summary.overtimeMinutes,
        overtimeHours: Math.round((summary.overtimeMinutes / 60) * 10) / 10,
      },
      days,
    };
  },
});

// ---------------------------------------------------------------------------
// AcsEvent backfill — tek event satırı yazar, dedup kontrolü yapar.
// ---------------------------------------------------------------------------

/**
 * Cihazdan tarihsel olarak çekilen tek bir AcsEvent satırını cardReadings'e yazar.
 * Dedup: by_device_hik_serial index ile (deviceId, hikSerialNo) çifti daha önce
 * yazılmışsa insert atlanır.
 * NOT: hikLastSerialNo (canlı cursor) PATCH'lenmez — backfill yalnız hikBackfillCursor'u kullanır.
 */
export const backfillHikEventRow = internalMutation({
  args: {
    deviceId: v.id("devices"),
    event: v.object({
      time: v.string(),
      cardNo: v.string(),
      cardType: v.optional(v.string()),
      name: v.optional(v.string()),
      employeeNoString: v.optional(v.string()),
      major: v.number(),
      minor: v.number(),
      doorNo: v.optional(v.number()),
      currentVerifyMode: v.optional(v.string()),
      serialNo: v.number(),
      pictureURL: v.optional(v.string()),
      attendanceStatus: v.optional(v.string()),
    }),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ inserted: boolean; reason?: string }> => {
    // Dedup: (deviceId, serialNo) çifti zaten kayıtlıysa atla.
    const existing = await ctx.db
      .query("cardReadings")
      .withIndex("by_device_hik_serial", (q) =>
        q.eq("deviceId", args.deviceId).eq("hikSerialNo", args.event.serialNo),
      )
      .first();
    if (existing) {
      return { inserted: false, reason: "duplicate" };
    }

    // Device'ı al (projectId için).
    const device = await ctx.db.get(args.deviceId);
    if (!device) {
      return { inserted: false, reason: "device-not-found" };
    }

    const accessStatus: "izin_verildi" | "reddedildi" =
      inferAccessStatus(args.event.major, args.event.minor) ?? "reddedildi";
    const granted = accessStatus === "izin_verildi";
    const denialReason = granted
      ? undefined
      : inferDenialReason(args.event.minor);

    // cardNo'dan çalışan ara (by_card index — canlı branch ile aynı yol)
    const employee = await ctx.db
      .query("employees")
      .withIndex("by_card", (q) => q.eq("cardNumber", args.event.cardNo))
      .first();

    // projectId: employee'nin projesi > cihazın projesi
    const projectId = employee?.projectId ?? device.projectId;

    const employeeName = employee
      ? `${employee.firstName} ${employee.lastName}`
      : (args.event.name?.trim() || undefined);

    await ctx.db.insert("cardReadings", {
      projectId,
      deviceId: args.deviceId,
      employeeId: employee?._id,
      cardNo: args.event.cardNo,
      employeeName,
      // accessTime = event'in cihaz zamanı (Date.now() DEĞİL — backfill)
      accessTime: args.event.time,
      accessStatus,
      hikMajorEventType: args.event.major,
      hikSubEventType: args.event.minor,
      hikCurrentVerifyMode: args.event.currentVerifyMode,
      hikSerialNo: args.event.serialNo,
      hikDevIndex: device.hikDevIndex,
      hikPictureURL: args.event.pictureURL,
      hikDateTime: args.event.time,
      hikDenialReason: denialReason,
      createdAt: args.event.time,
      updatedAt: args.event.time,
    });

    return { inserted: true };
  },
});
