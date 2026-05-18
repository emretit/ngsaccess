import { v } from "convex/values";
import { authedQuery } from "./lib/customFunctions";
import { getProjectIdsForUser } from "./lib/auth";
import {
  buildAphbXml,
  sgkCodeForLeaveType,
  sgkCodeForAbsence,
  type AphbEmployeeEntry,
} from "./lib/sgkCodes";

export const buildAphbForMonth = authedQuery({
  args: {
    year: v.number(),
    month: v.number(),
    projectId: v.optional(v.id("projects")),
  },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    const monthStr = String(args.month).padStart(2, "0");
    const lastDay = new Date(args.year, args.month, 0).getUTCDate();
    const startDate = `${args.year}-${monthStr}-01`;
    const endDate = `${args.year}-${monthStr}-${String(lastDay).padStart(2, "0")}`;
    const startISO = `${startDate}T00:00:00.000`;
    const endISO = `${endDate}T23:59:59.999`;

    const targetProjectId =
      args.projectId ??
      (ctx.user.role === "super_admin" ? undefined : allowedProjectIds[0]);

    const companies = await ctx.db.query("companies").collect();
    const companyName =
      companies.find((c) => c.projectId === targetProjectId)?.name ??
      "Şirket";

    let employees;
    if (ctx.user.role === "super_admin") {
      employees = await ctx.db
        .query("employees")
        .filter((q) => q.eq(q.field("isActive"), true))
        .collect();
    } else if (allowedProjectIds.length > 0) {
      const results = await Promise.all(
        allowedProjectIds.map((pid) =>
          ctx.db
            .query("employees")
            .withIndex("by_project", (q) => q.eq("projectId", pid))
            .filter((q) => q.eq(q.field("isActive"), true))
            .collect(),
        ),
      );
      employees = results.flat();
    } else {
      return { xml: "", filename: "" };
    }

    const empIds = new Set(employees.map((e) => String(e._id)));

    const allReadings = await ctx.db
      .query("cardReadings")
      .withIndex("by_access_time", (q) =>
        q.gte("accessTime", startISO).lte("accessTime", endISO),
      )
      .collect();
    const readingsByEmpDay = new Map<string, Set<string>>();
    for (const r of allReadings) {
      if (r.accessStatus !== "izin_verildi" || !r.employeeId) continue;
      const key = String(r.employeeId);
      if (!empIds.has(key)) continue;
      const dateKey = r.accessTime.split("T")[0];
      if (!readingsByEmpDay.has(key)) readingsByEmpDay.set(key, new Set());
      readingsByEmpDay.get(key)!.add(dateKey);
    }

    const leaves = await ctx.db
      .query("leaves")
      .filter((q) => q.eq(q.field("status"), "approved"))
      .collect();

    const totalDaysInMonth = lastDay;
    const entries: AphbEmployeeEntry[] = employees.map((emp) => {
      const workedDaySet = readingsByEmpDay.get(String(emp._id)) ?? new Set();
      const empLeaves = leaves.filter(
        (l) =>
          String(l.employeeId) === String(emp._id) &&
          l.startDate <= endDate &&
          l.endDate >= startDate,
      );
      const leaveDaysSet = new Set<string>();
      for (const l of empLeaves) {
        const s = new Date(`${l.startDate < startDate ? startDate : l.startDate}T00:00:00.000Z`);
        const e = new Date(`${l.endDate > endDate ? endDate : l.endDate}T00:00:00.000Z`);
        for (let d = new Date(s); d <= e; d.setUTCDate(d.getUTCDate() + 1)) {
          leaveDaysSet.add(d.toISOString().split("T")[0]);
        }
      }
      const workedDays = workedDaySet.size;
      const leaveDays = leaveDaysSet.size;
      const eksikGun = Math.max(0, totalDaysInMonth - workedDays - leaveDays);

      let eksikGunNedeni = null;
      if (empLeaves.length > 0) {
        eksikGunNedeni = sgkCodeForLeaveType(empLeaves[0].leaveType);
      }
      if (!eksikGunNedeni && eksikGun > 0) {
        eksikGunNedeni = sgkCodeForAbsence();
      }

      return {
        tcKimlikNo: emp.tcNo ?? "",
        adSoyad: `${emp.firstName} ${emp.lastName}`.trim(),
        cumulativeWorkdays: workedDays + leaveDays,
        totalOvertimeHours: 0,
        eksikGunSayisi: eksikGun,
        eksikGunNedeni,
      };
    });

    const xml = buildAphbXml({
      year: args.year,
      month: args.month,
      companyName,
      employees: entries,
    });

    return {
      xml,
      filename: `aphb-${args.year}-${monthStr}.xml`,
    };
  },
});
