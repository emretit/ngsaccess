import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { authedQuery } from "./lib/customFunctions";
import { getProjectIdsForUser } from "./lib/auth";
import { buildAphbXml, type AphbEmployeeEntry } from "./lib/sgkCodes";
import { calculateSgkEksikGun } from "./lib/sgkEksikGun";
import { trDateKey, trDayRangeISO } from "./lib/trDate";

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
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    const targetProjectId = args.projectId ??
      (ctx.user.role === "super_admin" ? undefined : allowedProjectIds[0]);
    if (!targetProjectId) throw new Error("Proje seçin");
    if (!allowedProjectIds.includes(targetProjectId)) {
      throw new Error("Bu projeye erişim yetkiniz yok");
    }

    const monthStr = String(args.month).padStart(2, "0");
    const lastDay = new Date(Date.UTC(args.year, args.month, 0)).getUTCDate();
    const startDate = `${args.year}-${monthStr}-01`;
    const endDate = `${args.year}-${monthStr}-${String(lastDay).padStart(2, "0")}`;
    const { startISO, endISO } = trDayRangeISO(startDate, endDate);
    const monthDays = Array.from({ length: lastDay }, (_, i) =>
      `${args.year}-${monthStr}-${String(i + 1).padStart(2, "0")}`,
    );

    // Aylık bildirimin tüm kayıtları gerekir; sorgular seçili proje/ay ile sınırlıdır.
    const [company, projectEmployees, readings, generalSettings, projectHolidays, globalHolidays] =
      await Promise.all([
        ctx.db.query("companies")
          .withIndex("by_project", (q) => q.eq("projectId", targetProjectId)).first(),
        ctx.db.query("employees")
          .withIndex("by_project", (q) => q.eq("projectId", targetProjectId)).collect(),
        ctx.db.query("cardReadings")
          .withIndex("by_project_access_time", (q) =>
            q.eq("projectId", targetProjectId).gte("accessTime", startISO).lte("accessTime", endISO),
          ).collect(),
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
    const empIds = new Set(projectEmployees.map((employee) => employee._id));
    const employeesWithReadings = new Set<Id<"employees">>();
    const readingsByEmpDay = new Map<Id<"employees">, Set<string>>();
    for (const reading of readings) {
      if (!reading.employeeId || !empIds.has(reading.employeeId)) continue;
      employeesWithReadings.add(reading.employeeId);
      if (reading.accessStatus !== "izin_verildi") continue;
      const workedDays = readingsByEmpDay.get(reading.employeeId) ?? new Set<string>();
      workedDays.add(trDateKey(reading.accessTime));
      readingsByEmpDay.set(reading.employeeId, workedDays);
    }
    const employees = projectEmployees.filter(
      (employee) => employee.isActive === true || employeesWithReadings.has(employee._id),
    );
    const warnings: string[] = [];
    const entries: AphbEmployeeEntry[] = await Promise.all(employees.map(async (employee) => {
      // Çalışana bağlı eski (projectId'siz) izinler de korunur.
      const employeeLeaves = await ctx.db.query("leaves")
        .withIndex("by_employee", (q) => q.eq("employeeId", employee._id)).collect();
      const approvedLeaves = employeeLeaves.filter((leave) =>
        leave.status === "approved" &&
        (leave.projectId === undefined || leave.projectId === targetProjectId) &&
        leave.startDate <= endDate && leave.endDate >= startDate,
      );
      const result = calculateSgkEksikGun({
        monthDays,
        workingDays: generalSettings?.workingDays,
        holidayMap,
        workedDays: readingsByEmpDay.get(employee._id) ?? new Set<string>(),
        approvedLeaves,
      });
      return {
        tcKimlikNo: employee.tcNo?.trim() ?? "",
        adSoyad: `${employee.firstName} ${employee.lastName}`.trim(),
        cumulativeWorkdays: result.primGunu,
        totalOvertimeHours: 0,
        eksikGunSayisi: result.eksikGunSayisi,
        eksikGunNedeni: result.eksikGunNedeni,
      };
    }));
    for (const entry of entries) {
      if (!entry.tcKimlikNo) {
        warnings.push(`${entry.adSoyad}: T.C. kimlik numarası eksik; bildirimden önce tamamlayın.`);
      }
    }

    return {
      xml: buildAphbXml({
        year: args.year,
        month: args.month,
        companyName: company?.name ?? "Şirket",
        employees: entries,
      }),
      filename: `aphb-${args.year}-${monthStr}.xml`,
      warnings,
    };
  },
});
