import { requirePermission } from "./lib/permissions";
import { employedDuring, employedOn } from "./lib/employment";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { authedQuery } from "./lib/customFunctions";
import { resolveProjectScope } from "./lib/projectScope";
import { loadRuleReportDays } from "./lib/reportAttendance";
import { APHB_DRAFT_WARNING, buildAphbXml, sgkCodeForLeaveType } from "./lib/sgkCodes";
import { calculateSgkEksikGun } from "./lib/sgkEksikGun";
import { legacyAttendanceDays, legacyOvertimeMinutes } from "./lib/legacyOvertime";

export const buildAphbForMonth = authedQuery({
  args: {
    year: v.number(),
    month: v.number(),
    projectId: v.optional(v.id("projects")),
  },
  handler: async (ctx, args) => {
    if (!Number.isInteger(args.year) || args.year < 1000 || args.year > 9999 ||
        !Number.isInteger(args.month) || args.month < 1 || args.month > 12) {
      throw new Error("Geçerli bir yıl ve ay seçin");
    }
    const allowedProjectIds = await resolveProjectScope(ctx, args.projectId);
    const targetProjectId = args.projectId ??
      (ctx.user.role === "super_admin" ? undefined : allowedProjectIds[0]);
    if (!targetProjectId) throw new Error("Proje seçin");
    await requirePermission(ctx, ctx.user, targetProjectId, "reports.view");
    if (!allowedProjectIds.includes(targetProjectId)) {
      throw new Error("Bu projeye erişim yetkiniz yok");
    }

    const monthStr = String(args.month).padStart(2, "0");
    const lastDay = new Date(Date.UTC(args.year, args.month, 0)).getUTCDate();
    const startDate = `${args.year}-${monthStr}-01`;
    const endDate = `${args.year}-${monthStr}-${String(lastDay).padStart(2, "0")}`;
    const monthDays = Array.from({ length: lastDay }, (_, i) =>
      `${args.year}-${monthStr}-${String(i + 1).padStart(2, "0")}`,
    );

    // Aylık bildirimin tüm kayıtları gerekir; sorgular seçili proje/ay ile sınırlıdır.
    const [projectEmployees, generalSettings, projectHolidays, globalHolidays] =
      await Promise.all([
        ctx.db.query("employees")
          .withIndex("by_project", (q) => q.eq("projectId", targetProjectId)).collect(),
        ctx.db.query("generalSettings")
          .withIndex("by_project", (q) => q.eq("projectId", targetProjectId)).first(),
        ctx.db.query("holidays")
          .withIndex("by_project_date", (q) =>
            q.eq("projectId", targetProjectId).gte("date", startDate).lte("date", endDate),
          ).collect(),
        ctx.db.query("holidays")
          .withIndex("by_project_date", (q) =>
            q.eq("projectId", undefined).gte("date", startDate).lte("date", endDate),
          ).collect(),
      ]);
    const holidayMap = new Map(
      [...globalHolidays, ...projectHolidays].map((holiday) => [holiday.date, holiday]),
    );
    const ruleReport = await loadRuleReportDays(ctx, [targetProjectId], startDate, endDate, { preloadedEmployees: projectEmployees });
    const empIds = new Set(projectEmployees.map((employee) => employee._id));
    const employeesWithReadings = new Set<Id<"employees">>();
    const readingsByEmployee = new Map<Id<"employees">, typeof ruleReport.readings>();
    for (const reading of ruleReport.readings) {
      if (!reading.employeeId || !empIds.has(reading.employeeId)) continue;
      employeesWithReadings.add(reading.employeeId);
      if (reading.accessStatus !== "izin_verildi" || ruleReport.managesReading(reading)) continue;
      const readings = readingsByEmployee.get(reading.employeeId) ?? [];
      readings.push(reading);
      readingsByEmployee.set(reading.employeeId, readings);
    }
    const employedDates = (employee: typeof projectEmployees[number]) => monthDays.filter(date => !employee.employmentEndDate || employedOn(employee, date));
    const plannedDates = (employee: typeof projectEmployees[number]) => employedDates(employee).filter(date => ruleReport.hasPlan(employee, date));
    // SGK bildirimi istihdama bağlıdır: vardiyasız gün devamsızlık sayılmaz, prim gününden düşülmez.
    const employees = projectEmployees.filter(
      (employee) => employedDuring(employee, startDate, endDate) || employeesWithReadings.has(employee._id),
    );
    const warnings: string[] = [APHB_DRAFT_WARNING];
    for (const employee of employees) {
      const unplannedDays = employedDates(employee).length - plannedDates(employee).length;
      if (unplannedDays > 0) warnings.push(plannedDates(employee).length === 0
        ? `${employee.firstName} ${employee.lastName}: vardiya atanmamış; PDKS verisi yok, prim günü devamsızlık düşülmeden istihdam günlerinden hesaplandı, bildirimden önce kontrol edin.`
        : `${employee.firstName} ${employee.lastName}: ${unplannedDays} gün vardiya atanmamış; bu günler devamsızlık sayılmadan prim gününe dahil edildi, bildirimden önce kontrol edin.`);
    }
    const entries = await Promise.all(employees.map(async (employee) => {
      // Çalışana bağlı eski (projectId'siz) izinler de korunur.
      const employeeLeaves = await ctx.db.query("leaves")
        .withIndex("by_employee", (q) => q.eq("employeeId", employee._id)).collect();
      const approvedLeaves = employeeLeaves.filter((leave) =>
        leave.status === "approved" &&
        (leave.projectId === undefined || leave.projectId === targetProjectId) &&
        leave.startDate <= endDate && leave.endDate >= startDate,
      );
      const ruleDays = ruleReport.ruleRows.get(employee._id)?.days ?? [];
      const reviewDays = ruleDays.filter(day => day.status === "incomplete" || day.status === "noData").map(day => day.date);
      const legacyDays = legacyAttendanceDays(readingsByEmployee.get(employee._id) ?? [], ruleReport.legacyManualRecords.get(employee._id), ruleReport.workDate);
      for (const date of legacyDays.keys()) {
        if (employee.employmentEndDate && !employedOn(employee, date)) legacyDays.delete(date);
      }
      const workedDays = new Set(legacyDays.keys());
      for (const day of ruleDays) {
        workedDays.delete(day.date);
        if (day.status === "present" || day.status === "late") workedDays.add(day.date);
      }
      // Vardiyasız gün çalışılmış sayılır; yalnız ücretsiz izin (SGK kodlu) o günü eksik güne çevirir.
      const planned = new Set(plannedDates(employee));
      for (const date of employedDates(employee)) {
        if (planned.has(date)) continue;
        const unpaidLeave = approvedLeaves.some(leave => leave.startDate <= date && leave.endDate >= date && sgkCodeForLeaveType(leave.leaveType) !== null);
        if (!unpaidLeave) workedDays.add(date);
      }
      const result = calculateSgkEksikGun({
        monthDays: employedDates(employee),
        workingDays: generalSettings?.workingDays,
        holidayMap,
        workedDays,
        approvedLeaves,
      });
      return {
        employeeId: employee._id,
        reviewDays,
        tcKimlikNo: employee.tcNo?.trim() ?? "",
        adSoyad: `${employee.firstName} ${employee.lastName}`.trim(),
        cumulativeWorkdays: employee.employmentEndDate && employee.employmentEndDate < endDate
          ? Math.max(0, Math.min(30, employedDates(employee).length) - result.eksikGunSayisi)
          : result.primGunu,
        totalOvertimeHours: (legacyOvertimeMinutes(legacyDays) + ruleDays.reduce((sum, day) => sum + day.overtimeMinutes, 0)) / 60,
        eksikGunSayisi: result.eksikGunSayisi,
        eksikGunNedeni: result.eksikGunNedeni,
      };
    }));
    for (const entry of entries) {
      if (entry.reviewDays.length) warnings.push(`${entry.adSoyad}: ${entry.reviewDays.length} gün inceleme bekliyor; APHB XML üretimi engellendi, bildirimden önce düzeltin.`);
      if (!entry.tcKimlikNo) {
        warnings.push(`${entry.adSoyad}: T.C. kimlik numarası eksik; bildirimden önce tamamlayın.`);
      }
    }

    const blockedByReview = entries.some(entry => entry.reviewDays.length > 0);
    return {
      blockedByReview,
      xml: blockedByReview ? "" : buildAphbXml({
        year: args.year,
        month: args.month,
        // Şirketler şube olarak kullanılır; işveren adı Genel Ayarlar'dan gelir.
        companyName: generalSettings?.companyName || "Şirket",
        employees: entries,
      }),
      filename: `aphb-taslak-resmi-sgk-formati-degildir-${args.year}-${monthStr}.xml`,
      warnings,
      employees: entries.map(entry => ({ employeeId: entry.employeeId, reviewDays: entry.reviewDays })),
    };
  },
});
