import { trDateKey, trDayRangeISO } from "./lib/trDate";
import { v } from "convex/values";
import { internalQuery, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { authedQuery, authedMutation } from "./lib/customFunctions";
import { requireAdmin } from "./lib/auth";
import { resolveReportScope, readReportReadings, reportPeriod, resolveScheduleScope } from "./lib/reportScope";
import { loadAttendanceReport } from "./lib/reportAttendance";
import {
  getEffectiveWorkSettings,
  resolveHourlyRate,
  overtimePayTRY,
} from "./lib/pdksHelpers";

const STANDARD_DAY_MINUTES = 8 * 60;
const STANDARD_WEEK_MINUTES = 45 * 60;

/**
 * SGK aylık döküm raporu - çalışan başına toplam gün, saat, fazla mesai, izin
 * Türkiye SGK formatına uygun çıktı için kullanılır
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

    const { startISO, endISO } = trDayRangeISO(startDate, endDate);

    const { projectIds, scopeLabel } = await resolveReportScope(ctx, args.projectId);
    const readings = await readReportReadings(ctx, projectIds, startISO, endISO);

    readings.sort(
      (a, b) => new Date(a.accessTime).getTime() - new Date(b.accessTime).getTime()
    );

    const employeeMap = new Map<string, typeof readings>();
    for (const r of readings) {
      const key = `${r.projectId}:${r.employeeId ?? r.cardNo}`;
      if (!employeeMap.has(key)) employeeMap.set(key, []);
      employeeMap.get(key)?.push(r);
    }

    const allLeaves = (await Promise.all(projectIds.map((projectId) => ctx.db.query("leaves").withIndex("by_project", (q) => q.eq("projectId", projectId)).collect()))).flat().filter((l) => l.status === "approved");

    const reportRows = await Promise.all(
      Array.from(employeeMap.entries()).map(async ([, empReadings]) => {
        const first = empReadings[0];
        const foundEmployee = first.employeeId ? await ctx.db.get(first.employeeId) : null;
        const employee = foundEmployee?.projectId === first.projectId ? foundEmployee : null;
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
                const start = new Date(overlapStart);
                const end = new Date(overlapEnd);
                return sum + Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1;
              }, 0)
          : 0;

        const granted = empReadings.filter((r) => r.accessStatus === "izin_verildi");

        const dayReadingsMap = new Map<string, typeof granted>();
        for (const r of granted) {
          const dateKey = trDateKey(r.accessTime);
          if (!dayReadingsMap.has(dateKey)) dayReadingsMap.set(dateKey, []);
          dayReadingsMap.get(dateKey)?.push(r);
        }

        let totalMinutes = 0;
        for (const dayReadings of dayReadingsMap.values()) {
          dayReadings.sort(
            (a, b) => new Date(a.accessTime).getTime() - new Date(b.accessTime).getTime()
          );
          const firstOfDay = dayReadings[0];
          const lastOfDay = dayReadings[dayReadings.length - 1];
          if (firstOfDay._id !== lastOfDay._id) {
            const diff =
              new Date(lastOfDay.accessTime).getTime() - new Date(firstOfDay.accessTime).getTime();
            totalMinutes += Math.floor(diff / 60000);
          }
        }

        const workDays = dayReadingsMap.size;
        const overtimeMinutes = workDays <= 1
          ? Math.max(0, totalMinutes - STANDARD_DAY_MINUTES)
          : Math.max(0, totalMinutes - STANDARD_WEEK_MINUTES);

        const totalHours = Math.round((totalMinutes / 60) * 10) / 10;
        const overtimeHours = Math.round((overtimeMinutes / 60) * 10) / 10;

        return {
          tcNo: employee?.tcNo ?? "-",
          adSoyad: first.employeeName ?? (employee ? `${employee.firstName} ${employee.lastName}` : "Bilinmiyor"),
          sicilNo: employee?.cardNumber ?? first.cardNo ?? "-",
          departman: department?.name ?? "Bilinmiyor",
          calismaGunu: workDays,
          toplamSaat: totalHours,
          fazlaMesaiSaat: overtimeHours,
          izinGunu: leaveDaysInMonth,
        };
      })
    );

    return {
      scopeLabel,
      reliabilityNote: "Güvenilirlik sınırı: Bu rapor okuma kayıtlarından üretilir; sıfır okumalı personel ve PDKS vardiya/haftalık mesai hesabı bu eski özet hesabına dahil değildir. Bordro doğrulaması yerine kullanılmamalıdır.",
      year,
      month,
      startDate,
      endDate,
      rows: reportRows.sort((a, b) => a.adSoyad.localeCompare(b.adSoyad)),
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
    reportPeriod(args.year, args.month);
    const year = args.year;
    const month = args.month;

    const startDate = month
      ? `${year}-${String(month).padStart(2, "0")}-01`
      : `${year}-01-01`;
    const endDate = month
      ? `${year}-${String(month).padStart(2, "0")}-${String(new Date(year, month, 0).getDate()).padStart(2, "0")}`
      : `${year}-12-31`;

    const { startISO, endISO } = trDayRangeISO(startDate, endDate);

    const readings = await readReportReadings(ctx, projectIds, startISO, endISO);

    const employeeMap = new Map<string, typeof readings>();
    for (const r of readings) {
      const key = `${r.projectId}:${r.employeeId ?? r.cardNo}`;
      if (!employeeMap.has(key)) employeeMap.set(key, []);
      employeeMap.get(key)?.push(r);
    }


    let totalOvertimeHours = 0;
    let totalOvertimePayTRY = 0;
    const rows: {
      employeeId: string;
      name: string;
      department: string;
      overtimeHours: number;
      overtimePayTRY: number | null;
    }[] = [];

    for (const [empKey, empReadings] of employeeMap) {
      const first = empReadings[0];
      const foundEmployee = first.employeeId ? await ctx.db.get(first.employeeId) : null;
      const employee = foundEmployee?.projectId === first.projectId ? foundEmployee : null;
      const foundDepartment = employee?.departmentId
        ? await ctx.db.get(employee.departmentId)
        : null;
      const department = foundDepartment?.projectId === first.projectId ? foundDepartment : null;
      const workSettings = await getEffectiveWorkSettings(ctx, first.projectId);

      const granted = empReadings.filter((r) => r.accessStatus === "izin_verildi");
      const dayReadingsMap = new Map<string, typeof granted>();
      for (const r of granted) {
        const dateKey = trDateKey(r.accessTime);
        if (!dayReadingsMap.has(dateKey)) dayReadingsMap.set(dateKey, []);
        dayReadingsMap.get(dateKey)?.push(r);
      }

      let totalMinutes = 0;
      for (const dayReadings of dayReadingsMap.values()) {
        dayReadings.sort(
          (a, b) => new Date(a.accessTime).getTime() - new Date(b.accessTime).getTime()
        );
        const firstOfDay = dayReadings[0];
        const lastOfDay = dayReadings[dayReadings.length - 1];
        if (firstOfDay._id !== lastOfDay._id) {
          const diff =
            new Date(lastOfDay.accessTime).getTime() - new Date(firstOfDay.accessTime).getTime();
          totalMinutes += Math.floor(diff / 60000);
        }
      }

      const workDays = dayReadingsMap.size;
      const overtimeMinutes = workDays <= 1
        ? Math.max(0, totalMinutes - STANDARD_DAY_MINUTES)
        : Math.max(0, totalMinutes - STANDARD_WEEK_MINUTES);
      const overtimeHours = Math.round((overtimeMinutes / 60) * 10) / 10;
      totalOvertimeHours += overtimeHours;

      const empHourlyRate = employee
        ? resolveHourlyRate({
            hourlyRate: employee.hourlyRate,
            monthlySalary: employee.monthlySalary,
            monthlyHoursBase: workSettings.monthlyHoursBase,
          })
        : null;
      const payTRY = overtimePayTRY({
        overtimeMinutes,
        multiplier: workSettings.overtimeMultiplier,
        hourlyRate: empHourlyRate,
      });
      const payRounded = payTRY !== null ? Math.round(payTRY * 100) / 100 : null;
      if (payRounded !== null) totalOvertimePayTRY += payRounded;

      rows.push({
        employeeId: empKey,
        name: first.employeeName ?? (employee ? `${employee.firstName} ${employee.lastName}` : "Bilinmiyor"),
        department: department?.name ?? "Bilinmiyor",
        overtimeHours,
        overtimePayTRY: payRounded,
      });
    }

    return {
      scopeLabel,
      reliabilityNote: "Güvenilirlik sınırı: Bu rapor okuma kayıtlarından üretilir; sıfır okumalı personel ve PDKS vardiya/haftalık mesai hesabı bu eski özet hesabına dahil değildir. Bordro doğrulaması yerine kullanılmamalıdır.",
      year,
      month,
      startDate,
      endDate,
      totalOvertimeHours: Math.round(totalOvertimeHours * 10) / 10,
      totalOvertimePayTRY: Math.round(totalOvertimePayTRY * 100) / 100,
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
    reportPeriod(args.year, args.month);
    const startDate = `${args.year}-${String(args.month).padStart(2, "0")}-01`;
    const endDate = `${args.year}-${String(args.month).padStart(2, "0")}-${String(new Date(args.year, args.month, 0).getDate()).padStart(2, "0")}`;
    const { startISO, endISO } = trDayRangeISO(startDate, endDate);

    const readings = await readReportReadings(ctx, projectIds, startISO, endISO);

    const employeeMap = new Map<string, typeof readings>();
    for (const r of readings) {
      const key = `${r.projectId}:${r.employeeId ?? r.cardNo}`;
      if (!employeeMap.has(key)) employeeMap.set(key, []);
      employeeMap.get(key)?.push(r);
    }

    const fallbackRate = args.hourlyRate;
    const byDept = new Map<
      string,
      { overtimeHours: number; cost: number; employeeCount: number }
    >();

    for (const empReadings of employeeMap.values()) {
      const first = empReadings[0];
      const foundEmployee = first.employeeId ? await ctx.db.get(first.employeeId) : null;
      const employee = foundEmployee?.projectId === first.projectId ? foundEmployee : null;
      const foundDepartment = employee?.departmentId
        ? await ctx.db.get(employee.departmentId)
        : null;
      const department = foundDepartment?.projectId === first.projectId ? foundDepartment : null;
      const workSettings = await getEffectiveWorkSettings(ctx, first.projectId);
      const deptName = department?.name ?? "Belirtilmemiş";

      const granted = empReadings.filter((r) => r.accessStatus === "izin_verildi");
      const dayReadingsMap = new Map<string, typeof granted>();
      for (const r of granted) {
        const dateKey = trDateKey(r.accessTime);
        if (!dayReadingsMap.has(dateKey)) dayReadingsMap.set(dateKey, []);
        dayReadingsMap.get(dateKey)?.push(r);
      }

      let totalMinutes = 0;
      for (const dayReadings of dayReadingsMap.values()) {
        dayReadings.sort(
          (a, b) => new Date(a.accessTime).getTime() - new Date(b.accessTime).getTime()
        );
        const firstOfDay = dayReadings[0];
        const lastOfDay = dayReadings[dayReadings.length - 1];
        if (firstOfDay._id !== lastOfDay._id) {
          const diff =
            new Date(lastOfDay.accessTime).getTime() - new Date(firstOfDay.accessTime).getTime();
          totalMinutes += Math.floor(diff / 60000);
        }
      }

      const workDays = dayReadingsMap.size;
      const overtimeMinutes = workDays <= 1
        ? Math.max(0, totalMinutes - STANDARD_DAY_MINUTES)
        : Math.max(0, totalMinutes - STANDARD_WEEK_MINUTES);
      const overtimeHours = Math.round((overtimeMinutes / 60) * 10) / 10;

      if (overtimeHours > 0) {
        const empRate =
          (employee
            ? resolveHourlyRate({
                hourlyRate: employee.hourlyRate,
                monthlySalary: employee.monthlySalary,
                monthlyHoursBase: workSettings.monthlyHoursBase,
              })
            : null) ?? fallbackRate ?? null;
        const payTRY = overtimePayTRY({
          overtimeMinutes,
          multiplier: workSettings.overtimeMultiplier,
          hourlyRate: empRate,
        });

        const existing =
          byDept.get(deptName) ?? { overtimeHours: 0, cost: 0, employeeCount: 0 };
        existing.overtimeHours += overtimeHours;
        existing.cost += payTRY ?? 0;
        existing.employeeCount += 1;
        byDept.set(deptName, existing);
      }
    }

    const rows = Array.from(byDept.entries()).map(([name, data]) => ({
      department: name,
      overtimeHours: Math.round(data.overtimeHours * 10) / 10,
      employeeCount: data.employeeCount,
      cost: Math.round(data.cost * 100) / 100,
    }));

    return {
      scopeLabel,
      reliabilityNote: "Güvenilirlik sınırı: Bu rapor okuma kayıtlarından üretilir; sıfır okumalı personel ve PDKS vardiya/haftalık mesai hesabı bu eski özet hesabına dahil değildir. Bordro doğrulaması yerine kullanılmamalıdır.",
      year: args.year,
      month: args.month,
      hourlyRate: fallbackRate ?? null,
      overtimeMultiplier: null,
      rows: rows.sort((a, b) => b.cost - a.cost),
    };
  },
});

/**
 * Kullanıcının zamanlanmış rapor ayarını getirir
 */
export const getReportSchedule = authedQuery({
  args: { projectId: v.optional(v.id("projects")) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
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
    await requireAdmin(ctx);
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
