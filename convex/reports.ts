import { canSeePayInProject, maskPay } from "./lib/payVisibility";
import { v } from "convex/values";
import { internalQuery, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { authedQuery, authedMutation } from "./lib/customFunctions";
import { resolveReportScope, reportPeriod, resolveScheduleScope } from "./lib/reportScope";
import { loadAttendanceReport, loadRuleReportDays } from "./lib/reportAttendance";
import { buildPeriodDateKeys } from "./lib/pdksCalc";
import { legacyAttendanceDays, loadPayrollReportReadings, loadPayrollReport, payrollOvertimeCost } from "./lib/legacyOvertime";

const LEGACY_REPORT_RELIABILITY_NOTE = "Güvenilirlik sınırı: Süre ve fazla mesai, bordroyla aynı mola ve dönem hesabından üretilir. Eksik veya inceleme bekleyen kayıtlar bildirimden önce doğrulanmalıdır; bu özet resmi SGK bildirimi değildir.";

/**
 * SGK aylık döküm raporu - çalışan başına toplam gün, saat, fazla mesai, izin
 * Muhasebe kontrolü için özet; resmi SGK formatı değildir
 */
export const getSgkMonthlyReport = authedQuery({
  args: {
    projectId: v.optional(v.id("projects")),
    year: v.number(),
    month: v.number(),
  },
  handler: async (ctx, args) => {
    reportPeriod(args.year, args.month);
    const year = args.year;
    const month = args.month;
    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;


    const { projectIds, scopeLabel } = await resolveReportScope(ctx, args.projectId);
    const sharedReadings = await loadPayrollReportReadings(ctx, projectIds, startDate, endDate);
    const ruleReport = await loadRuleReportDays(ctx, projectIds, startDate, endDate, { preloadedReadings: sharedReadings });
    const payrollRows = await loadPayrollReport(ctx, projectIds, startDate, endDate, { employees: ruleReport.employees, planResolvers: ruleReport.planResolvers, readings: sharedReadings });
    const readings = ruleReport.readings;

    readings.sort(
      (a, b) => new Date(a.accessTime).getTime() - new Date(b.accessTime).getTime()
    );

    const employeesById = new Map(ruleReport.employees.map(employee => [employee._id, employee]));
    const employeesByCard = new Map(ruleReport.employees.map(employee => [`${employee.projectId}:${employee.cardNumber}`, employee]));
    const employeeMap = new Map<string, typeof readings>();
    for (const r of readings) {
      const employee = r.employeeId ? employeesById.get(r.employeeId) : employeesByCard.get(`${r.projectId}:${r.cardNo}`);
      if (employee?.isVisitor === true) continue;
      const key = `${r.projectId}:${r.employeeId ?? r.cardNo}`;
      if (!employeeMap.has(key)) employeeMap.set(key, []);
      employeeMap.get(key)?.push(r);
    }

    for (const [id, employee] of ruleReport.reportEmployees) {
      if (employee.isVisitor === true) continue;
      const key = `${employee.projectId}:${id}`;
      if (!employeeMap.has(key)) employeeMap.set(key, []);
    }

    const allLeaves = (await Promise.all(projectIds.map((projectId) => ctx.db.query("leaves").withIndex("by_project", (q) => q.eq("projectId", projectId)).collect()))).flat().filter((l) => l.status === "approved");

    const reportRows = await Promise.all(
      Array.from(employeeMap.entries()).map(async ([empKey, empReadings]) => {
        const fallback = [...ruleReport.reportEmployees.values()].find(e => `${e.projectId}:${e._id}` === empKey);
        const first = empReadings[0] ?? { employeeId: fallback?._id, projectId: fallback?.projectId, cardNo: fallback?.cardNumber ?? "", employeeName: undefined };
        const foundEmployee = first.employeeId ? await ctx.db.get(first.employeeId) : null;
        const employee = foundEmployee?.projectId === first.projectId ? foundEmployee : null;
        if (employee?.isVisitor === true) return null;
        const foundDepartment = employee?.departmentId
          ? await ctx.db.get(employee.departmentId)
          : null;
        const department = foundDepartment?.projectId === first.projectId ? foundDepartment : null;

        const empId = employee?._id;

        const leaveDaysInMonth = empId
          ? allLeaves
              .filter((l) => {
                if (l.employeeId !== empId || l.projectId !== first.projectId) return false;
                const leaveStart = new Date(l.startDate);
                const leaveEnd = new Date(l.endDate);
                const monthStart = new Date(startDate);
                const monthEnd = new Date(endDate);
                return leaveStart <= monthEnd && leaveEnd >= monthStart;
              })
              .reduce((sum, l) => {
                const overlapStart = l.startDate < startDate ? startDate : l.startDate;
                const overlapEnd = l.endDate > endDate ? endDate : l.endDate;
                return sum + buildPeriodDateKeys(overlapStart, overlapEnd)
                  .filter(date => employee && ruleReport.hasPlan(employee, date)).length;
              }, 0)
          : 0;

        const granted = empReadings.filter((r) => r.accessStatus === "izin_verildi" && !ruleReport.managesReading(r));

        const payroll = empId ? payrollRows.get(empId) : undefined;
        const attendanceDates = new Set([
          ...granted.map(ruleReport.workDate),
          ...(empId ? ruleReport.legacyManualRecords.get(empId) ?? [] : [])
            .filter(record => record.entryTime || record.exitTime).map(record => record.date),
        ]);
        const dayReadingsMap = legacyAttendanceDays(payroll?.cells ?? [], attendanceDates);
        const ruleDays = empId ? ruleReport.ruleRows.get(empId)?.days ?? [] : [];
        const totalMinutes = payroll?.totals.totalMinutes ?? 0;
        const incompleteDays = ruleDays.filter(day => day.status === "incomplete").length;
        const workDays = dayReadingsMap.size + ruleDays.filter(day => day.status === "present" || day.status === "late").length;
        const overtimeMinutes = payroll?.totals.overtimeMinutes ?? 0;

        const totalHours = Math.round((totalMinutes / 60) * 10) / 10;
        const overtimeHours = Math.round((overtimeMinutes / 60) * 10) / 10;

        return {
          tcNo: employee?.tcNo ?? "-",
          adSoyad: first.employeeName ?? (employee ? `${employee.firstName} ${employee.lastName}` : "Bilinmiyor"),
          sicilNo: employee?.cardNumber ?? first.cardNo ?? "-",
          departman: department?.name ?? "Bilinmiyor",
          incompleteDays,
          calismaGunu: workDays,
          toplamSaat: totalHours,
          fazlaMesaiSaat: overtimeHours,
          izinGunu: leaveDaysInMonth,
        };
      })
    );

    return {
      scopeLabel,
      reliabilityNote: LEGACY_REPORT_RELIABILITY_NOTE,
      year,
      month,
      startDate,
      endDate,
      rows: reportRows.filter((row): row is NonNullable<typeof row> => row !== null).sort((a, b) => a.adSoyad.localeCompare(b.adSoyad)),
    };
  },
});

/**
 * Fazla mesai özet raporu - aylık veya yıllık toplam
 */
export const getOvertimeSummaryReport = authedQuery({
  args: {
    projectId: v.optional(v.id("projects")),
    year: v.number(),
    month: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { projectIds, scopeLabel } = await resolveReportScope(ctx, args.projectId);
    const payVisible = (await Promise.all(projectIds.map(id => canSeePayInProject(ctx, ctx.user, id)))).every(Boolean);
    reportPeriod(args.year, args.month);
    const year = args.year;
    const month = args.month;

    const startDate = month
      ? `${year}-${String(month).padStart(2, "0")}-01`
      : `${year}-01-01`;
    const endDate = month
      ? `${year}-${String(month).padStart(2, "0")}-${String(new Date(year, month, 0).getDate()).padStart(2, "0")}`
      : `${year}-12-31`;


    const payrollRows = await loadPayrollReport(ctx, projectIds, startDate, endDate);
    let totalOvertimeHours = 0;
    let totalOvertimePayTRY = 0;
    const rows = [...payrollRows.values()].map(row => {
      const overtimeHours = Math.round(row.totals.overtimeMinutes / 60 * 10) / 10;
      const pay = row.totals.overtimePayTRY;
      const payRounded = pay === null ? null : Math.round(pay * 100) / 100;
      totalOvertimeHours += overtimeHours;
      totalOvertimePayTRY += payRounded ?? 0;
      return {
        employeeId: `${row.projectId}:${row.employeeId}`,
        name: row.name,
        department: row.department,
        overtimeHours,
        overtimePayTRY: payRounded,
      };
    });

    return {
      scopeLabel,
      reliabilityNote: LEGACY_REPORT_RELIABILITY_NOTE,
      year,
      month,
      startDate,
      endDate,
      totalOvertimeHours: Math.round(totalOvertimeHours * 10) / 10,
      totalOvertimePayTRY: maskPay(Math.round(totalOvertimePayTRY * 100) / 100, payVisible),
      overtimeMultiplier: null,
      rows: rows.filter((r) => r.overtimeHours > 0).sort((a, b) => b.overtimeHours - a.overtimeHours),
    };
  },
});

/**
 * Devam ve devamsızlık özet tablosu
 */
export const getAttendanceSummaryReport = authedQuery({
  args: {
    projectId: v.optional(v.id("projects")),
    year: v.number(),
    month: v.number(),
  },
  handler: async (ctx, args) => {
    const scope = await resolveReportScope(ctx, args.projectId);
    return { ...await loadAttendanceReport(ctx, scope.projectIds, args.year, args.month), scopeLabel: scope.scopeLabel };
  },
});

/**
 * Departman maliyet analizi raporu (fazla mesai saat * sabit oran)
 */
export const getDepartmentCostReport = authedQuery({
  args: {
    projectId: v.optional(v.id("projects")),
    year: v.number(),
    month: v.number(),
    hourlyRate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { projectIds, scopeLabel } = await resolveReportScope(ctx, args.projectId);
    const payVisible = (await Promise.all(projectIds.map(id => canSeePayInProject(ctx, ctx.user, id)))).every(Boolean);
    reportPeriod(args.year, args.month);
    const startDate = `${args.year}-${String(args.month).padStart(2, "0")}-01`;
    const endDate = `${args.year}-${String(args.month).padStart(2, "0")}-${String(new Date(args.year, args.month, 0).getDate()).padStart(2, "0")}`;

    const payrollRows = await loadPayrollReport(ctx, projectIds, startDate, endDate);
    const fallbackRate = args.hourlyRate;
    const byDept = new Map<
      string,
      { overtimeHours: number; cost: number; employeeCount: number; payVisible: boolean }
    >();
    for (const row of payrollRows.values()) {
      const overtimeHours = Math.round(row.totals.overtimeMinutes / 60 * 10) / 10;
      if (overtimeHours <= 0) continue;
      const rowPayVisible = await canSeePayInProject(ctx, ctx.user, row.projectId);
      const empRate = rowPayVisible ? row.hourlyRate ?? fallbackRate ?? null : null;
      const payTRY = payrollOvertimeCost(row, empRate);
      const existing = byDept.get(row.department) ?? { overtimeHours: 0, cost: 0, employeeCount: 0, payVisible: true };
      existing.payVisible = existing.payVisible && rowPayVisible;
      existing.overtimeHours += overtimeHours;
      existing.cost += payTRY ?? 0;
      existing.employeeCount += 1;
      byDept.set(row.department, existing);
    }

    const rows = Array.from(byDept.entries()).map(([name, data]) => ({
      department: name,
      overtimeHours: Math.round(data.overtimeHours * 10) / 10,
      employeeCount: data.employeeCount,
      cost: Math.round(data.cost * 100) / 100,
      payVisible: data.payVisible,
    }));

    return {
      scopeLabel,
      reliabilityNote: LEGACY_REPORT_RELIABILITY_NOTE,
      year: args.year,
      month: args.month,
      hourlyRate: maskPay(fallbackRate ?? null, payVisible),
      overtimeMultiplier: null,
      rows: rows
        .sort((a, b) => payVisible ? b.cost - a.cost : a.department.localeCompare(b.department, "tr"))
        .map(({ payVisible: rowPayVisible, ...row }) => ({ ...row, cost: maskPay(row.cost, rowPayVisible) })),
    };
  },
});

/**
 * Kullanıcının zamanlanmış rapor ayarını getirir
 */
export const getReportSchedule = authedQuery({
  args: { projectId: v.optional(v.id("projects")) },
  handler: async (ctx, args) => {
    await resolveReportScope(ctx, args.projectId);
    return await ctx.db.query("reportScheduleSettings")
      .withIndex("by_user_project", (q) => q.eq("userId", ctx.user._id).eq("projectId", args.projectId)).first();
  },
});

export const saveReportSchedule = authedMutation({
  args: {
    projectId: v.optional(v.id("projects")),
    reportType: v.union(v.literal("sgk"), v.literal("overtime"), v.literal("attendance"), v.literal("department")),
    email: v.string(),
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const scope = await resolveReportScope(ctx, args.projectId);
    if (!scope.projectIds.length) throw new Error("Erişilebilir proje bulunamadı");
    const email = args.email.trim();
    if (args.enabled && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Geçerli bir e-posta adresi girin");
    const now = new Date().toISOString();
    const existing = await ctx.db.query("reportScheduleSettings")
      .withIndex("by_user_project", (q) => q.eq("userId", ctx.user._id).eq("projectId", args.projectId)).first();
    const values = { ...args, email, updatedAt: now };
    if (existing) await ctx.db.patch(existing._id, values);
    else await ctx.db.insert("reportScheduleSettings", { ...values, userId: ctx.user._id, createdAt: now });
  },
});

export const getEnabledSchedules = internalQuery({
  args: {},
  handler: async (ctx) => {
    const schedules = [];
    for await (const schedule of ctx.db.query("reportScheduleSettings")) {
      if (schedule.enabled && await resolveScheduleScope(ctx, schedule)) schedules.push(schedule);
    }
    return schedules;
  },
});

export const getReportSummaryForEmail = internalQuery({
  args: { scheduleId: v.id("reportScheduleSettings"), year: v.number(), month: v.number() },
  handler: async (ctx, args) => {
    reportPeriod(args.year, args.month);
    const schedule = await ctx.db.get(args.scheduleId);
    if (!schedule?.enabled) return null;
    const scope = await resolveScheduleScope(ctx, schedule);
    if (!scope) return null;
    const labels: Record<string, string> = {
      sgk: "SGK Aylık Döküm Raporu", overtime: "Fazla Mesai Özet Raporu",
      attendance: "Devam ve Devamsızlık Özet Raporu", department: "Departman Maliyet Analizi Raporu",
    };
    const attendance = schedule.reportType === "attendance"
      ? await loadAttendanceReport(ctx, scope.projectIds, args.year, args.month) : null;
    const detail = attendance
      ? `${attendance.rows.length} aktif personel; ${attendance.rows.filter((row) => row.absentDays === null).length} personelin takvimi doğrulanamadı. ${attendance.reliabilityNote}`
      : "Raporu seçilen kapsam ve dönemle Ayarlar → Raporlar bölümünden oluşturabilirsiniz; bu e-posta rapor dosyası içermez.";
    return {
      title: `${labels[schedule.reportType] ?? "Aylık Rapor"} — ${scope.scopeLabel}`,
      summary: `${args.year}/${String(args.month).padStart(2, "0")} dönemi. Kapsam: ${scope.scopeLabel}. ${detail}`,
    };
  },
});

export const markReportSent = internalMutation({
  args: { scheduleId: v.id("reportScheduleSettings") },
  handler: async (ctx, args) => {
    const schedule = await ctx.db.get(args.scheduleId);
    if (!schedule?.enabled || !await resolveScheduleScope(ctx, schedule)) return;
    await ctx.db.patch(schedule._id, { lastSentAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  },
});

export const triggerScheduledReports = internalMutation({
  args: {},
  handler: async (ctx) => {
    await ctx.scheduler.runAfter(0, internal.actions.sendScheduledReports.sendMonthlyReports, {});
  },
});
