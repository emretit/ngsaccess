import { v } from "convex/values";
import { internalQuery, internalMutation } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { authedQuery, authedMutation } from "./lib/customFunctions";
import { getProjectIdsForUser } from "./lib/auth";
import { Doc } from "./_generated/dataModel";

const STANDARD_DAY_MINUTES = 8 * 60;
const STANDARD_WEEK_MINUTES = 45 * 60;

/**
 * SGK aylık döküm raporu - çalışan başına toplam gün, saat, fazla mesai, izin
 * Türkiye SGK formatına uygun çıktı için kullanılır
 */
export const getSgkMonthlyReport = authedQuery({
  args: {
    projectIds: v.optional(v.array(v.id("projects"))),
    isSuperAdmin: v.optional(v.boolean()),
    year: v.number(),
    month: v.number(),
  },
  handler: async (ctx, args) => {
    const year = args.year;
    const month = args.month;
    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    const startISO = `${startDate}T00:00:00.000`;
    const endISO = `${endDate}T23:59:59.999`;

    let readings;
    const allowedProjectIds = await getProjectIdsForUser(ctx);

    if (args.isSuperAdmin) {
      readings = await ctx.db
        .query("cardReadings")
        .withIndex("by_access_time")
        .filter((q) =>
          q.and(q.gte(q.field("accessTime"), startISO), q.lte(q.field("accessTime"), endISO))
        )
        .collect();
    } else if (args.projectIds && args.projectIds.length > 0) {
      const results = await Promise.all(
        args.projectIds.map((pid) =>
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
      return [];
    }

    readings.sort(
      (a, b) => new Date(a.accessTime).getTime() - new Date(b.accessTime).getTime()
    );

    const employeeMap = new Map<string, typeof readings>();
    for (const r of readings) {
      const key = r.employeeId ?? r.cardNo;
      if (!employeeMap.has(key)) employeeMap.set(key, []);
      employeeMap.get(key)!.push(r);
    }

    const allLeaves = await ctx.db
      .query("leaves")
      .filter((q) => q.eq(q.field("status"), "approved"))
      .collect();

    const reportRows = await Promise.all(
      Array.from(employeeMap.entries()).map(async ([empKey, empReadings]) => {
        const first = empReadings[0];
        const employee = first.employeeId ? await ctx.db.get(first.employeeId) as Doc<"employees"> | null : null;
        const department = employee?.departmentId
          ? await ctx.db.get(employee.departmentId) as Doc<"departments"> | null
          : null;

        const empId = first.employeeId;
        const dateKeys = [...new Set(empReadings.map((r) => r.accessTime.split("T")[0]))];

        const leaveDaysInMonth = empId
          ? allLeaves
              .filter((l) => {
                if (l.employeeId !== empId) return false;
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
          const dateKey = r.accessTime.split("T")[0];
          if (!dayReadingsMap.has(dateKey)) dayReadingsMap.set(dateKey, []);
          dayReadingsMap.get(dateKey)!.push(r);
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
        let overtimeMinutes = 0;
        if (workDays <= 1) {
          overtimeMinutes = Math.max(0, totalMinutes - STANDARD_DAY_MINUTES);
        } else {
          overtimeMinutes = Math.max(0, totalMinutes - STANDARD_WEEK_MINUTES);
        }

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
    projectIds: v.optional(v.array(v.id("projects"))),
    isSuperAdmin: v.optional(v.boolean()),
    year: v.number(),
    month: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    const year = args.year;
    const month = args.month;

    const startDate = month
      ? `${year}-${String(month).padStart(2, "0")}-01`
      : `${year}-01-01`;
    const endDate = month
      ? `${year}-${String(month).padStart(2, "0")}-${String(new Date(year, month, 0).getDate()).padStart(2, "0")}`
      : `${year}-12-31`;

    const startISO = `${startDate}T00:00:00.000`;
    const endISO = `${endDate}T23:59:59.999`;

    let readings;
    if (args.isSuperAdmin) {
      readings = await ctx.db
        .query("cardReadings")
        .withIndex("by_access_time")
        .filter((q) =>
          q.and(q.gte(q.field("accessTime"), startISO), q.lte(q.field("accessTime"), endISO))
        )
        .collect();
    } else {
      const pids = args.projectIds?.length ? args.projectIds : allowedProjectIds;
      const results = await Promise.all(
        pids.map((pid) =>
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
    }

    const employeeMap = new Map<string, typeof readings>();
    for (const r of readings) {
      const key = r.employeeId ?? r.cardNo;
      if (!employeeMap.has(key)) employeeMap.set(key, []);
      employeeMap.get(key)!.push(r);
    }

    let totalOvertimeHours = 0;
    const rows: { employeeId: string; name: string; department: string; overtimeHours: number }[] = [];

    for (const [empKey, empReadings] of employeeMap) {
      const first = empReadings[0];
      const employee = first.employeeId ? await ctx.db.get(first.employeeId) as Doc<"employees"> | null : null;
      const department = employee?.departmentId
        ? await ctx.db.get(employee.departmentId) as Doc<"departments"> | null
        : null;

      const granted = empReadings.filter((r) => r.accessStatus === "izin_verildi");
      const dayReadingsMap = new Map<string, typeof granted>();
      for (const r of granted) {
        const dateKey = r.accessTime.split("T")[0];
        if (!dayReadingsMap.has(dateKey)) dayReadingsMap.set(dateKey, []);
        dayReadingsMap.get(dateKey)!.push(r);
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
      let overtimeMinutes = 0;
      if (workDays <= 1) {
        overtimeMinutes = Math.max(0, totalMinutes - STANDARD_DAY_MINUTES);
      } else {
        overtimeMinutes = Math.max(0, totalMinutes - STANDARD_WEEK_MINUTES);
      }
      const overtimeHours = Math.round((overtimeMinutes / 60) * 10) / 10;
      totalOvertimeHours += overtimeHours;

      rows.push({
        employeeId: empKey,
        name: first.employeeName ?? (employee ? `${employee.firstName} ${employee.lastName}` : "Bilinmiyor"),
        department: department?.name ?? "Bilinmiyor",
        overtimeHours,
      });
    }

    return {
      year,
      month,
      startDate,
      endDate,
      totalOvertimeHours: Math.round(totalOvertimeHours * 10) / 10,
      rows: rows.filter((r) => r.overtimeHours > 0).sort((a, b) => b.overtimeHours - a.overtimeHours),
    };
  },
});

/**
 * Devam ve devamsızlık özet tablosu
 */
export const getAttendanceSummaryReport = authedQuery({
  args: {
    projectIds: v.optional(v.array(v.id("projects"))),
    isSuperAdmin: v.optional(v.boolean()),
    year: v.number(),
    month: v.number(),
  },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    const startDate = `${args.year}-${String(args.month).padStart(2, "0")}-01`;
    const lastDay = new Date(args.year, args.month, 0).getDate();
    const endDate = `${args.year}-${String(args.month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    const startISO = `${startDate}T00:00:00.000`;
    const endISO = `${endDate}T23:59:59.999`;

    let readings;
    if (args.isSuperAdmin) {
      readings = await ctx.db
        .query("cardReadings")
        .withIndex("by_access_time")
        .filter((q) =>
          q.and(q.gte(q.field("accessTime"), startISO), q.lte(q.field("accessTime"), endISO))
        )
        .collect();
    } else {
      const pids = args.projectIds?.length ? args.projectIds : allowedProjectIds;
      const results = await Promise.all(
        pids.map((pid) =>
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
    }

    const allLeaves = await ctx.db
      .query("leaves")
      .filter((q) => q.eq(q.field("status"), "approved"))
      .collect();

    const employeeMap = new Map<string, typeof readings>();
    for (const r of readings) {
      const key = r.employeeId ?? r.cardNo;
      if (!employeeMap.has(key)) employeeMap.set(key, []);
      employeeMap.get(key)!.push(r);
    }

    const workDaysInMonth = lastDay;
    const rows = await Promise.all(
      Array.from(employeeMap.entries()).map(async ([empKey, empReadings]) => {
        const first = empReadings[0];
        const employee = first.employeeId ? await ctx.db.get(first.employeeId) : null;
        const department = employee?.departmentId
          ? await ctx.db.get(employee.departmentId)
          : null;

        const granted = empReadings.filter((r) => r.accessStatus === "izin_verildi");
        const presentDays = new Set(granted.map((r) => r.accessTime.split("T")[0])).size;

        const leaveDays = first.employeeId
          ? allLeaves
              .filter((l) => {
                if (l.employeeId !== first.employeeId) return false;
                return l.startDate <= endDate && l.endDate >= startDate;
              })
              .reduce((sum, l) => {
                const overlapStart = l.startDate < startDate ? startDate : l.startDate;
                const overlapEnd = l.endDate > endDate ? endDate : l.endDate;
                return sum + Math.ceil((new Date(overlapEnd).getTime() - new Date(overlapStart).getTime()) / 86400000) + 1;
              }, 0)
          : 0;

        const absentDays = Math.max(0, workDaysInMonth - presentDays - leaveDays);

        return {
          employeeId: empKey,
          name: first.employeeName ?? (employee ? `${employee.firstName} ${employee.lastName}` : "Bilinmiyor"),
          department: department?.name ?? "Bilinmiyor",
          presentDays,
          leaveDays,
          absentDays,
          devamOrani: workDaysInMonth > 0 ? Math.round((presentDays / workDaysInMonth) * 100) : 0,
        };
      })
    );

    return {
      year: args.year,
      month: args.month,
      startDate,
      endDate,
      workDaysInMonth,
      rows: rows.sort((a, b) => a.name.localeCompare(b.name)),
    };
  },
});

/**
 * Departman maliyet analizi raporu (fazla mesai saat * sabit oran)
 */
export const getDepartmentCostReport = authedQuery({
  args: {
    projectIds: v.optional(v.array(v.id("projects"))),
    isSuperAdmin: v.optional(v.boolean()),
    year: v.number(),
    month: v.number(),
    hourlyRate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    const startDate = `${args.year}-${String(args.month).padStart(2, "0")}-01`;
    const endDate = `${args.year}-${String(args.month).padStart(2, "0")}-${String(new Date(args.year, args.month, 0).getDate()).padStart(2, "0")}`;
    const startISO = `${startDate}T00:00:00.000`;
    const endISO = `${endDate}T23:59:59.999`;

    let readings;
    if (args.isSuperAdmin) {
      readings = await ctx.db
        .query("cardReadings")
        .withIndex("by_access_time")
        .filter((q) =>
          q.and(q.gte(q.field("accessTime"), startISO), q.lte(q.field("accessTime"), endISO))
        )
        .collect();
    } else {
      const pids = args.projectIds?.length ? args.projectIds : allowedProjectIds;
      const results = await Promise.all(
        pids.map((pid) =>
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
    }

    const employeeMap = new Map<string, typeof readings>();
    for (const r of readings) {
      const key = r.employeeId ?? r.cardNo;
      if (!employeeMap.has(key)) employeeMap.set(key, []);
      employeeMap.get(key)!.push(r);
    }

    const rate = args.hourlyRate ?? 100;
    const byDept = new Map<string, { overtimeHours: number; employeeCount: number }>();

    for (const [_, empReadings] of employeeMap) {
      const first = empReadings[0];
      const employee = first.employeeId ? await ctx.db.get(first.employeeId) : null;
      const department = employee?.departmentId
        ? await ctx.db.get(employee.departmentId)
        : null;
      const deptName = department?.name ?? "Belirtilmemiş";

      const granted = empReadings.filter((r) => r.accessStatus === "izin_verildi");
      const dayReadingsMap = new Map<string, typeof granted>();
      for (const r of granted) {
        const dateKey = r.accessTime.split("T")[0];
        if (!dayReadingsMap.has(dateKey)) dayReadingsMap.set(dateKey, []);
        dayReadingsMap.get(dateKey)!.push(r);
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
      let overtimeMinutes = 0;
      if (workDays <= 1) {
        overtimeMinutes = Math.max(0, totalMinutes - STANDARD_DAY_MINUTES);
      } else {
        overtimeMinutes = Math.max(0, totalMinutes - STANDARD_WEEK_MINUTES);
      }
      const overtimeHours = Math.round((overtimeMinutes / 60) * 10) / 10;

      if (overtimeHours > 0) {
        const existing = byDept.get(deptName) ?? { overtimeHours: 0, employeeCount: 0 };
        existing.overtimeHours += overtimeHours;
        existing.employeeCount += 1;
        byDept.set(deptName, existing);
      }
    }

    const rows = Array.from(byDept.entries()).map(([name, data]) => ({
      department: name,
      overtimeHours: Math.round(data.overtimeHours * 10) / 10,
      employeeCount: data.employeeCount,
      cost: Math.round(data.overtimeHours * rate * 1.5 * 100) / 100,
    }));

    return {
      year: args.year,
      month: args.month,
      hourlyRate: rate,
      overtimeMultiplier: 1.5,
      rows: rows.sort((a, b) => b.cost - a.cost),
    };
  },
});

/**
 * Kullanıcının zamanlanmış rapor ayarını getirir
 */
export const getReportSchedule = authedQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("reportScheduleSettings")
      .withIndex("by_user", (q) => q.eq("userId", ctx.user._id))
      .first();
  },
});

/**
 * Zamanlanmış rapor ayarlarını kaydeder
 */
export const saveReportSchedule = authedMutation({
  args: {
    reportType: v.string(),
    email: v.string(),
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    const existing = await ctx.db
      .query("reportScheduleSettings")
      .withIndex("by_user", (q) => q.eq("userId", ctx.user._id))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        reportType: args.reportType,
        email: args.email,
        enabled: args.enabled,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("reportScheduleSettings", {
        userId: ctx.user._id,
        reportType: args.reportType,
        email: args.email,
        enabled: args.enabled,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

/** Internal: Aktif zamanlanmış rapor ayarları */
export const getEnabledSchedules = internalQuery({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("reportScheduleSettings").collect();
    return all.filter((s) => s.enabled);
  },
});

/** Internal: E-posta için rapor özeti */
export const getReportSummaryForEmail = internalQuery({
  args: {
    reportType: v.string(),
    year: v.number(),
    month: v.number(),
    userId: v.id("users"),
  },
  handler: async (_ctx, args) => {
    const labels: Record<string, string> = {
      sgk: "SGK Aylık Döküm Raporu",
      overtime: "Fazla Mesai Özet Raporu",
      attendance: "Devam ve Devamsızlık Özet Raporu",
      department: "Departman Maliyet Analizi Raporu",
    };
    return {
      title: labels[args.reportType] ?? "Aylık Rapor",
      summary: `${args.year}/${String(args.month).padStart(2, "0")} dönemi raporu hazır. Ayarlar → Raporlar bölümünden indirebilirsiniz.`,
    };
  },
});

/** Internal: Rapor gönderildi olarak işaretle */
export const markReportSent = internalMutation({
  args: { scheduleId: v.id("reportScheduleSettings") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.scheduleId, {
      lastSentAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  },
});

/** Internal: Cron tarafından çağrılır, aylık rapor action'ını tetikler */
export const triggerScheduledReports = internalMutation({
  args: {},
  handler: async (ctx) => {
    await ctx.scheduler.runAfter(
      0,
      internal.actions.sendScheduledReports.sendMonthlyReports,
      {}
    );
  },
});
