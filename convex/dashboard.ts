import { query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { authedQuery } from "./lib/customFunctions";
import { getProjectIdsForUser } from "./lib/auth";

export const getStats = authedQuery({
  args: {
    projectIds: v.optional(v.array(v.id("projects"))),
    isSuperAdmin: v.optional(v.boolean()),
  },
  handler: async (ctx) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();
    const tomorrowISO = new Date(today.getTime() + 86400000).toISOString();

    let employees: unknown[] = [];
    let devices: unknown[] = [];
    let todayReadings: unknown[] = [];
    let pendingRules: unknown[] = [];

    if (ctx.user.role === "super_admin") {
      [employees, devices, todayReadings, pendingRules] = await Promise.all([
        ctx.db.query("employees").collect(),
        ctx.db.query("devices").filter((q) => q.eq(q.field("isActive"), true)).collect(),
        ctx.db
          .query("cardReadings")
          .withIndex("by_access_time")
          .filter((q) =>
            q.and(
              q.gte(q.field("accessTime"), todayISO),
              q.lt(q.field("accessTime"), tomorrowISO)
            )
          )
          .collect(),
        ctx.db.query("accessRules").filter((q) => q.eq(q.field("isActive"), false)).collect(),
      ]);
    } else if (allowedProjectIds.length > 0) {
      const [empResults, devResults, readingResults, ruleResults] = await Promise.all([
        Promise.all(
          allowedProjectIds.map((pid) =>
            ctx.db
              .query("employees")
              .withIndex("by_project", (q) => q.eq("projectId", pid))
              .collect()
          )
        ),
        Promise.all(
          allowedProjectIds.map((pid) =>
            ctx.db
              .query("devices")
              .withIndex("by_project", (q) => q.eq("projectId", pid))
              .filter((q) => q.eq(q.field("isActive"), true))
              .collect()
          )
        ),
        Promise.all(
          allowedProjectIds.map((pid) =>
            ctx.db
              .query("cardReadings")
              .withIndex("by_project", (q) => q.eq("projectId", pid))
              .filter((q) =>
                q.and(
                  q.gte(q.field("accessTime"), todayISO),
                  q.lt(q.field("accessTime"), tomorrowISO)
                )
              )
              .collect()
          )
        ),
        Promise.all(
          allowedProjectIds.map((pid) =>
            ctx.db
              .query("accessRules")
              .withIndex("by_project", (q) => q.eq("projectId", pid))
              .filter((q) => q.eq(q.field("isActive"), false))
              .collect()
          )
        ),
      ]);
      employees = empResults.flat();
      devices = devResults.flat();
      todayReadings = readingResults.flat();
      pendingRules = ruleResults.flat();
    }

    return {
      employees: employees.length,
      devices: devices.length,
      cardReadings: todayReadings.length,
      pendingRequests: pendingRules.length,
    };
  },
});

export const getPdksStats = authedQuery({
  args: {},
  handler: async (ctx) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    const today = new Date().toISOString().split("T")[0];
    const startISO = `${today}T00:00:00.000`;
    const endISO = `${today}T23:59:59.999`;

    let employees: unknown[] = [];
    let todayReadings: { employeeId?: unknown; accessTime: string; accessStatus?: string }[] = [];

    if (ctx.user.role === "super_admin") {
      employees = await ctx.db.query("employees").filter((q) => q.eq(q.field("isActive"), true)).collect();
      todayReadings = await ctx.db
        .query("cardReadings")
        .withIndex("by_access_time")
        .filter((q) =>
          q.and(
            q.gte(q.field("accessTime"), startISO),
            q.lte(q.field("accessTime"), endISO)
          )
        )
        .collect();
    } else if (allowedProjectIds.length > 0) {
      const [empResults, readingResults] = await Promise.all([
        Promise.all(
          allowedProjectIds.map((pid) =>
            ctx.db
              .query("employees")
              .withIndex("by_project", (q) => q.eq("projectId", pid))
              .filter((q) => q.eq(q.field("isActive"), true))
              .collect()
          )
        ),
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
      ]);
      employees = empResults.flat();
      todayReadings = readingResults.flat();
    }

    const empIdsWithEntry = new Set(
      todayReadings
        .filter((r) => r.accessStatus === "izin_verildi")
        .map((r) => r.employeeId ?? r)
    );
    const presentSet = new Set<string>();
    const lateSet = new Set<string>();
    const empFirstEntry = new Map<string, string>();

    for (const r of todayReadings) {
      if (r.accessStatus !== "izin_verildi") continue;
      const key = String(r.employeeId ?? "");
      if (!empFirstEntry.has(key)) {
        empFirstEntry.set(key, r.accessTime);
        presentSet.add(key);
        const h = new Date(r.accessTime).getHours();
        const m = new Date(r.accessTime).getMinutes();
        if (h > 9 || (h === 9 && m > 15)) lateSet.add(key);
      }
    }

    const approvedLeaves = await ctx.db
      .query("leaves")
      .filter((q) => q.eq(q.field("status"), "approved"))
      .collect();
    const leaveToday = approvedLeaves.filter(
      (l) => today >= l.startDate && today <= l.endDate
    ).length;

    let totalOvertimeMinutes = 0;
    const empDayReadings = new Map<string, typeof todayReadings>();
    for (const r of todayReadings) {
      if (r.accessStatus !== "izin_verildi") continue;
      const key = String(r.employeeId ?? "");
      if (!empDayReadings.has(key)) empDayReadings.set(key, []);
      empDayReadings.get(key)!.push(r);
    }
    for (const dayReadings of empDayReadings.values()) {
      dayReadings.sort(
        (a, b) => new Date(a.accessTime).getTime() - new Date(b.accessTime).getTime()
      );
      const first = dayReadings[0];
      const last = dayReadings[dayReadings.length - 1];
      if (first !== last) {
        const diff = new Date(last.accessTime).getTime() - new Date(first.accessTime).getTime();
        totalOvertimeMinutes += Math.max(0, Math.floor(diff / 60000) - 8 * 60);
      }
    }

    const totalEmployees = employees.length;
    const presentToday = presentSet.size;
    const devamOrani = totalEmployees > 0 ? Math.round((presentToday / totalEmployees) * 100) : 0;

    const lateByDept = new Map<string, number>();
    for (const empId of lateSet) {
      const emp = (employees as { _id: string; departmentId?: string }[]).find(
        (e) => String(e._id) === empId
      );
      if (emp?.departmentId) {
        const dept = await ctx.db.get(emp.departmentId as Id<"departments">);
        const name = (dept && "name" in dept ? dept.name : null) ?? "Bilinmiyor";
        lateByDept.set(name, (lateByDept.get(name) ?? 0) + 1);
      }
    }
    const topLateDept = [...lateByDept.entries()]
      .sort(([, a], [, b]) => b - a)[0];

    return {
      totalEmployees,
      presentToday,
      lateArrivals: lateSet.size,
      overtimeHours: Math.round((totalOvertimeMinutes / 60) * 10) / 10,
      insideBuilding: presentSet.size,
      leaveToday,
      devamOrani,
      topLateDepartment: topLateDept?.[0] ?? "-",
      topLateDepartmentCount: topLateDept?.[1] ?? 0,
    };
  },
});

export const getPdksDashboardWidgets = authedQuery({
  args: {},
  handler: async (ctx) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    let pendingLeaves: { _id: string; employeeId: string; leaveType: string; startDate: string; endDate: string }[] = [];
    let upcomingShifts: { _id: string; employeeId: string; shiftId: string; startDate: string; endDate: string }[] = [];

    if (ctx.user.role === "super_admin") {
      pendingLeaves = await ctx.db
        .query("leaves")
        .filter((q) => q.eq(q.field("status"), "pending"))
        .collect();
      upcomingShifts = await ctx.db
        .query("shiftAssignments")
        .collect()
        .then((assignments) =>
          assignments
            .filter((a) => a.endDate >= new Date().toISOString().split("T")[0])
            .slice(0, 5)
        );
    } else if (allowedProjectIds.length > 0) {
      const [leaveResults, shiftResults] = await Promise.all([
        Promise.all(
          allowedProjectIds.map((pid) =>
            ctx.db
              .query("leaves")
              .withIndex("by_project", (q) => q.eq("projectId", pid))
              .filter((q) => q.eq(q.field("status"), "pending"))
              .collect()
          )
        ),
        Promise.all(
          allowedProjectIds.map((pid) =>
            ctx.db
              .query("shiftAssignments")
              .withIndex("by_project", (q) => q.eq("projectId", pid))
              .collect()
          )
        ),
      ]);
      pendingLeaves = leaveResults.flat();
      const allShifts = shiftResults.flat();
      const today = new Date().toISOString().split("T")[0];
      upcomingShifts = allShifts
        .filter((a) => a.endDate >= today)
        .sort((a, b) => a.startDate.localeCompare(b.startDate))
        .slice(0, 5);
    }

    return {
      pendingLeavesCount: pendingLeaves.length,
      pendingLeaves: pendingLeaves.slice(0, 3),
      upcomingShiftsCount: upcomingShifts.length,
      upcomingShifts,
    };
  },
});

/**
 * Şu an binada olan çalışanlar (bugün giriş yapmış, çıkış yapmamış)
 */
export const getCurrentlyInside = authedQuery({
  args: {},
  handler: async (ctx) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    const today = new Date().toISOString().split("T")[0];
    const startISO = `${today}T00:00:00.000`;
    const endISO = `${today}T23:59:59.999`;

    let readings;
    if (ctx.user.role === "super_admin") {
      readings = await ctx.db
        .query("cardReadings")
        .withIndex("by_access_time")
        .filter((q) =>
          q.and(
            q.gte(q.field("accessTime"), startISO),
            q.lte(q.field("accessTime"), endISO)
          )
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
      return [];
    }

    const granted = readings.filter((r) => r.accessStatus === "izin_verildi");
    const byEmployee = new Map<string, typeof granted>();
    for (const r of granted) {
      const key = r.employeeId ?? r.cardNo;
      if (!byEmployee.has(key)) byEmployee.set(key, []);
      byEmployee.get(key)!.push(r);
    }

    const inside: { employeeId: string; name: string; department: string; zone?: string; lastSeen: string }[] = [];

    for (const [empKey, empReadings] of byEmployee) {
      empReadings.sort(
        (a, b) => new Date(a.accessTime).getTime() - new Date(b.accessTime).getTime()
      );
      if (empReadings.length % 2 === 1) {
        const last = empReadings[empReadings.length - 1];
        const employee = last.employeeId
          ? await ctx.db.get(last.employeeId as Id<"employees">)
          : null;
        const department =
          employee && "departmentId" in employee && employee.departmentId
            ? await ctx.db.get(employee.departmentId)
            : null;
        const device = last.deviceId
          ? await ctx.db.get(last.deviceId as Id<"devices">)
          : null;
        const zone =
          device && "zoneId" in device && device.zoneId
            ? await ctx.db.get(device.zoneId)
            : undefined;

        const empDoc = employee as { firstName?: string; lastName?: string } | null;
        const deptDoc = department as { name?: string } | null;
        const zoneDoc = zone as { name?: string } | undefined;

        inside.push({
          employeeId: empKey,
          name:
            last.employeeName ??
            (empDoc ? `${empDoc.firstName ?? ""} ${empDoc.lastName ?? ""}`.trim() || "Bilinmiyor" : "Bilinmiyor"),
          department: deptDoc?.name ?? "Bilinmiyor",
          zone: zoneDoc?.name,
          lastSeen: last.accessTime,
        });
      }
    }

    return inside.sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const getRecentReadings = authedQuery({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    const limit = args.limit ?? 10;

    let readings;
    if (ctx.user.role === "super_admin") {
      readings = await ctx.db
        .query("cardReadings")
        .withIndex("by_access_time")
        .order("desc")
        .take(limit);
    } else if (allowedProjectIds.length > 0) {
      const results = await Promise.all(
        allowedProjectIds.map((pid) =>
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

    return await Promise.all(
      readings.map(async (r) => {
        const device = r.deviceId ? await ctx.db.get(r.deviceId) : null;
        return {
          id: r._id,
          access_time: r.accessTime,
          access_granted: r.accessStatus === "izin_verildi",
          card_no: r.cardNo,
          employee_id: r.employeeId ?? null,
          employee_name: r.employeeName ?? null,
          device_id: r.deviceId?.toString() ?? "",
          device_name: device?.name ?? "Bilinmeyen Cihaz",
          device_location: "-",
          device_ip: "-",
          device_serial: "-",
          status: r.accessStatus === "izin_verildi" ? "success" : r.accessStatus === "reddedildi" ? "denied" : "unknown",
        };
      })
    );
  },
});
