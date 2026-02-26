import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
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

    let readings;
    if (args.isSuperAdmin) {
      readings = await ctx.db
        .query("cardReadings")
        .withIndex("by_access_time")
        .order("desc")
        .collect();
    } else if (args.projectIds && args.projectIds.length > 0) {
      const results = await Promise.all(
        args.projectIds.map((pid) =>
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

export const getPdksTableData = query({
  args: {
    projectIds: v.optional(v.array(v.id("projects"))),
    isSuperAdmin: v.optional(v.boolean()),
    date: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const today = args.date ?? new Date().toISOString().split("T")[0];
    const startISO = `${today}T00:00:00`;
    const endISO = `${today}T23:59:59`;

    let readings;
    if (args.isSuperAdmin) {
      readings = await ctx.db
        .query("cardReadings")
        .withIndex("by_access_time")
        .filter((q) =>
          q.and(q.gte(q.field("accessTime"), startISO), q.lt(q.field("accessTime"), endISO))
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
                q.lt(q.field("accessTime"), endISO)
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

    const tableData = await Promise.all(
      Array.from(employeeMap.entries()).map(async ([empKey, empReadings]) => {
        const first = empReadings[0];
        const employee = first.employeeId ? await ctx.db.get(first.employeeId) : null;
        const department = employee?.departmentId
          ? await ctx.db.get(employee.departmentId)
          : null;

        const granted = empReadings.filter((r) => r.accessStatus === "izin_verildi");
        const firstEntry = granted[0];
        const lastExit = granted[granted.length - 1];

        let status: "present" | "late" | "absent" | "leave" = "present";
        if (firstEntry) {
          const h = new Date(firstEntry.accessTime).getHours();
          const m = new Date(firstEntry.accessTime).getMinutes();
          if (h > 9 || (h === 9 && m > 15)) status = "late";
        } else {
          status = "absent";
        }

        let totalHours = "0h 0m";
        if (firstEntry && lastExit && firstEntry._id !== lastExit._id) {
          const diff = new Date(lastExit.accessTime).getTime() - new Date(firstEntry.accessTime).getTime();
          totalHours = `${Math.floor(diff / 3600000)}h ${Math.floor((diff % 3600000) / 60000)}m`;
        }

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
          overtime: "0m",
          leaveType: "-",
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
