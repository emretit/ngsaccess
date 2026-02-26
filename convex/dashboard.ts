import { query } from "./_generated/server";
import { v } from "convex/values";

export const getStats = query({
  args: {
    projectIds: v.optional(v.array(v.id("projects"))),
    isSuperAdmin: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();
    const tomorrowISO = new Date(today.getTime() + 86400000).toISOString();

    let employees: unknown[] = [];
    let devices: unknown[] = [];
    let todayReadings: unknown[] = [];
    let pendingRules: unknown[] = [];

    if (args.isSuperAdmin) {
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
    } else if (args.projectIds && args.projectIds.length > 0) {
      const [empResults, devResults, readingResults, ruleResults] = await Promise.all([
        Promise.all(
          args.projectIds.map((pid) =>
            ctx.db
              .query("employees")
              .withIndex("by_project", (q) => q.eq("projectId", pid))
              .collect()
          )
        ),
        Promise.all(
          args.projectIds.map((pid) =>
            ctx.db
              .query("devices")
              .withIndex("by_project", (q) => q.eq("projectId", pid))
              .filter((q) => q.eq(q.field("isActive"), true))
              .collect()
          )
        ),
        Promise.all(
          args.projectIds.map((pid) =>
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
          args.projectIds.map((pid) =>
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

export const getRecentReadings = query({
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
          device_location: "-",
        };
      })
    );
  },
});
