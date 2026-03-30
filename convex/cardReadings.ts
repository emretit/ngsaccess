import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { authedQuery } from "./lib/customFunctions";
import { getProjectIdsForUser } from "./lib/auth";
import { Doc } from "./_generated/dataModel";

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

    const enriched = await Promise.all(
      paginated.map(async (r) => {
        const device = r.deviceId ? await ctx.db.get(r.deviceId) : null;
        const employee = r.employeeId ? await ctx.db.get(r.employeeId) : null;
        let department = null;
        if (employee?.departmentId) {
          department = await ctx.db.get(employee.departmentId);
        }
        return {
          ...r,
          id: r._id,
          employee_name: r.employeeName ?? null,
          card_no: r.cardNo,
          access_time: r.accessTime,
          access_granted: r.accessStatus === "izin_verildi",
          status: r.accessStatus === "izin_verildi" ? "success" : "denied",
          device_name: device?.name ?? "Bilinmeyen Cihaz",
          device_serial: device?.deviceSerial ?? "-",
          device_location: "-",
          device_ip: device?.deviceIp ?? "-",
          devices: device
            ? { name: device.name, device_serial: device.deviceSerial }
            : null,
          employees: employee
            ? {
                departments: department ? { name: department.name } : null,
              }
            : null,
        };
      })
    );

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

    return await Promise.all(
      readings.map(async (r) => {
        const device = r.deviceId ? await ctx.db.get(r.deviceId) : null;
        return {
          ...r,
          access_granted: r.accessStatus === "izin_verildi",
          device_name: device?.name ?? "Bilinmeyen Cihaz",
        };
      })
    );
  },
});

export const getPdksTableData = authedQuery({
  args: {
    date: v.optional(v.string()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    let startISO: string;
    let endISO: string;

    if (args.startDate && args.endDate) {
      startISO = `${args.startDate}T00:00:00.000`;
      endISO = `${args.endDate}T23:59:59.999`;
    } else {
      const today = args.date ?? new Date().toISOString().split("T")[0];
      startISO = `${today}T00:00:00.000`;
      endISO = `${today}T23:59:59.999`;
    }

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

    const STANDARD_DAY_MINUTES = 8 * 60;
    const STANDARD_WEEK_MINUTES = 45 * 60;

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
    };

    const tableData = await Promise.all(
      Array.from(employeeMap.entries()).map(async ([empKey, empReadings]) => {
        const first = empReadings[0];
        const employee = first.employeeId ? await ctx.db.get(first.employeeId) : null;
        const department = employee?.departmentId
          ? await ctx.db.get(employee.departmentId)
          : null;

        const empId = first.employeeId;
        const dateKeys = [...new Set(empReadings.map((r) => r.accessTime.split("T")[0]))];
        const hasLeave = empId
          ? allLeaves.some((l) => {
              if (l.employeeId !== empId) return false;
              return dateKeys.some((dk) => dk >= l.startDate && dk <= l.endDate);
            })
          : false;
        const leaveRecord = empId
          ? allLeaves.find((l) => {
              if (l.employeeId !== empId) return false;
              return dateKeys.some((dk) => dk >= l.startDate && dk <= l.endDate);
            })
          : null;
        const leaveType = leaveRecord ? leaveTypeLabels[leaveRecord.leaveType] ?? leaveRecord.leaveType : "-";

        const granted = empReadings.filter((r) => r.accessStatus === "izin_verildi");
        const firstEntry = granted[0];
        const lastExit = granted[granted.length - 1];

        let status: "present" | "late" | "absent" | "leave" = "present";
        if (hasLeave && !firstEntry) {
          status = "leave";
        } else if (firstEntry) {
          const h = new Date(firstEntry.accessTime).getHours();
          const m = new Date(firstEntry.accessTime).getMinutes();
          if (h > 9 || (h === 9 && m > 15)) status = "late";
        } else {
          status = "absent";
        }

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

        const totalHours = `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`;

        const workDays = dayReadingsMap.size;
        let overtimeMinutes = 0;
        if (workDays <= 1) {
          overtimeMinutes = Math.max(0, totalMinutes - STANDARD_DAY_MINUTES);
        } else {
          overtimeMinutes = Math.max(0, totalMinutes - STANDARD_WEEK_MINUTES);
        }
        const overtime = overtimeMinutes > 0 ? `${overtimeMinutes}m` : "0m";
        const overtimeHours = overtimeMinutes / 60;
        const OVERTIME_MULTIPLIER = 1.5;
        const overtimePayMultiplier = overtimeMinutes > 0 ? OVERTIME_MULTIPLIER : 0;

        return {
          id: empKey,
          name: first.employeeName ?? (employee ? `${employee.firstName} ${employee.lastName}` : "Bilinmiyor"),
          employeeId: empKey,
          department: department?.name ?? "Bilinmiyor",
          firstEntry: firstEntry
            ? new Date(firstEntry.accessTime).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })
            : "-",
          lastExit:
            lastExit && lastExit._id !== firstEntry?._id
              ? new Date(lastExit.accessTime).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })
              : "-",
          totalHours,
          overtime,
          overtimeHours,
          overtimeMultiplier: overtimePayMultiplier,
          yearlyOvertimeLimit: 270,
          leaveType,
          status,
          detailedLogs: empReadings.map((r) => ({
            time: new Date(r.accessTime).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }),
            action: r.accessStatus === "izin_verildi" ? "Giriş" : "Reddedildi",
            location: "Bilinmiyor",
          })),
        };
      })
    );

    return tableData;
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
      };
    }

    readings.sort(
      (a, b) => new Date(a.accessTime).getTime() - new Date(b.accessTime).getTime()
    );

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

    const employeeDayMap = new Map<string, Map<string, { firstEntry?: string; hasLate: boolean }>>();

    for (const r of readings) {
      const empKey = r.employeeId ?? r.cardNo;
      const dateKey = r.accessTime.split("T")[0];
      const dayData = dailyMap.get(dateKey);
      if (!dayData) continue;

      if (r.accessStatus === "izin_verildi") {
        if (!employeeDayMap.has(empKey)) employeeDayMap.set(empKey, new Map());
        const empDay = employeeDayMap.get(empKey)!;
        if (!empDay.has(dateKey)) {
          empDay.set(dateKey, { hasLate: false });
        }
        const rec = empDay.get(dateKey)!;
        if (!rec.firstEntry) {
          rec.firstEntry = r.accessTime;
          const h = new Date(r.accessTime).getHours();
          const m = new Date(r.accessTime).getMinutes();
          rec.hasLate = h > 9 || (h === 9 && m > 15);
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
          const firstReading = readings.find((r) => (r.employeeId ?? r.cardNo) === empKey);
          if (firstReading?.employeeId && rec.firstEntry) {
            const h = new Date(rec.firstEntry).getHours();
            lateByHourMap.set(h, (lateByHourMap.get(h) ?? 0) + 1);
          }
        }
      }
    }

    for (const [dateKey, dayData] of dailyMap) {
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
      const emp = r.employeeId ? await ctx.db.get(r.employeeId) : null;
      if (emp?.departmentId) {
        const dept = await ctx.db.get(emp.departmentId);
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
      devamsızlık: value,
    }));

    const lateDistribution = Array.from(lateByHourMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([hour, count]) => ({
        saat: `${hour}:00`,
        sayı: count,
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

/**
 * Kart okuyucu cihazlarından gelen istekleri işler (internal - HTTP action'dan çağrılır).
 * Erişim kontrolü yapar ve card_readings kaydı oluşturur.
 */
export const processCardReading = internalMutation({
  args: {
    cardNo: v.string(),
    deviceSerial: v.string(),
    deviceIp: v.optional(v.string()),
    rawBody: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const accessTime = new Date().toISOString();

    // 1. Cihazı serial veya IP ile bul (her zaman - kayıt için gerekli)
    let device = null;
    if (args.deviceSerial?.trim()) {
      device = await ctx.db
        .query("devices")
        .withIndex("by_device_serial", (q) =>
          q.eq("deviceSerial", args.deviceSerial!.trim())
        )
        .first();
    }
    if (!device && args.deviceIp?.trim()) {
      const all = await ctx.db.query("devices").collect();
      device = all.find((d) => d.deviceIp?.trim() === args.deviceIp!.trim()) ?? null;
    }

    // 2. Çalışanı kart numarasına göre bul
    const employee = await ctx.db
      .query("employees")
      .withIndex("by_card", (q) => q.eq("cardNumber", args.cardNo))
      .first();

    if (!employee) {
      await ctx.db.insert("cardReadings", {
        projectId: device?.projectId,
        deviceId: device?._id,
        cardNo: args.cardNo,
        accessTime,
        accessStatus: "reddedildi",
        rawData: args.rawBody,
        createdAt: accessTime,
        updatedAt: accessTime,
      });
      return { granted: false };
    }

    if (!employee.isActive) {
      await ctx.db.insert("cardReadings", {
        projectId: employee.projectId,
        deviceId: device?._id,
        employeeId: employee._id,
        cardNo: args.cardNo,
        employeeName: `${employee.firstName} ${employee.lastName}`,
        accessTime,
        accessStatus: "reddedildi",
        rawData: args.rawBody,
        createdAt: accessTime,
        updatedAt: accessTime,
      });
      return { granted: false };
    }

    if (!device) {
      await ctx.db.insert("cardReadings", {
        projectId: employee.projectId,
        employeeId: employee._id,
        cardNo: args.cardNo,
        employeeName: `${employee.firstName} ${employee.lastName}`,
        accessTime,
        accessStatus: "reddedildi",
        rawData: args.rawBody,
        createdAt: accessTime,
        updatedAt: accessTime,
      });
      return { granted: false };
    }

    // 3. Cihazın hiçbir grupta olup olmadığını kontrol et
    const deviceGroups = await ctx.db
      .query("groupDevices")
      .withIndex("by_device", (q) => q.eq("deviceId", device._id))
      .collect();

    if (deviceGroups.length === 0) {
      await ctx.db.insert("cardReadings", {
        projectId: employee.projectId,
        deviceId: device._id,
        employeeId: employee._id,
        cardNo: args.cardNo,
        employeeName: `${employee.firstName} ${employee.lastName}`,
        accessTime,
        accessStatus: "reddedildi",
        rawData: args.rawBody,
        createdAt: accessTime,
        updatedAt: accessTime,
      });
      return { granted: false };
    }

    // 4. Çalışanın bu cihaza erişimi var mı? (groupMembers + accessRules)
    const groupIds = deviceGroups.map((gd) => gd.groupId);
    const employeeAccessGroups = await ctx.db
      .query("groupMembers")
      .withIndex("by_employee", (q) => q.eq("employeeId", employee._id))
      .collect();

    const employeeGroupIds = new Set(employeeAccessGroups.map((gm) => gm.groupId));
    const matchingGroupIds = groupIds.filter((gid) => employeeGroupIds.has(gid));

    let hasAccess = false;
    for (const groupId of matchingGroupIds) {
      const rule = await ctx.db.get(groupId);
      if (rule?.isActive) {
        hasAccess = true;
        break;
      }
    }

    // 5. Kayıt oluştur
    await ctx.db.insert("cardReadings", {
      projectId: employee.projectId,
      deviceId: device._id,
      employeeId: employee._id,
      cardNo: args.cardNo,
      employeeName: `${employee.firstName} ${employee.lastName}`,
      accessTime,
      accessStatus: hasAccess ? "izin_verildi" : "reddedildi",
      rawData: args.rawBody,
      createdAt: accessTime,
      updatedAt: accessTime,
    });

    // 6. Geç kalma bildirimi (hasAccess + geç giriş)
    if (hasAccess) {
      const h = new Date(accessTime).getHours();
      const m = new Date(accessTime).getMinutes();
      const isLate = h > 9 || (h === 9 && m > 15);
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
          ctx.scheduler.runAfter(0, api.actions.sendEmail.sendLateNotification, {
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
