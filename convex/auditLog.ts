import { v } from "convex/values";
import { adminQuery } from "./lib/customFunctions";
import { getProjectIdsForUser } from "./lib/auth";

interface PdksAuditPayload {
  date?: string;
  entryTime?: string;
  exitTime?: string;
  status?: string;
  manualNote?: string;
}

function isPdksPayload(value: unknown): value is PdksAuditPayload {
  return typeof value === "object" && value !== null;
}

export const getPdksAuditForEmployee = adminQuery({
  args: {
    employeeId: v.id("employees"),
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("auditLog")
      .order("desc")
      .take(500);
    const filtered = rows.filter((r) => r.targetTable === "pdksRecords");

    const userIds = new Set(filtered.map((r) => String(r.userId)));
    const users = await Promise.all(
      [...userIds].map(async (id) => {
        const u = await ctx.db.get(id as never);
        return u ? { id, name: (u as { name?: string; email?: string }).name ?? (u as { email?: string }).email ?? id } : null;
      }),
    );
    const userMap = new Map(users.filter((u) => u !== null).map((u) => [u!.id, u!.name]));

    return filtered
      .map((r) => {
        const newDate = isPdksPayload(r.newValue) ? r.newValue.date : undefined;
        const oldDate = isPdksPayload(r.oldValue) ? r.oldValue.date : undefined;
        const recordDate = newDate ?? oldDate;
        if (recordDate && (recordDate < args.startDate || recordDate > args.endDate)) {
          return null;
        }
        // Filter to this employee: heuristic — targetId starts with the employee
        // id or oldValue/newValue includes it. Audit log doesn't index by
        // employee directly, so we accept best-effort matching.
        const targetIdStr = String(r.targetId);
        const matchesEmployee =
          targetIdStr === String(args.employeeId) ||
          (isPdksPayload(r.newValue) && JSON.stringify(r.newValue).includes(String(args.employeeId))) ||
          (isPdksPayload(r.oldValue) && JSON.stringify(r.oldValue).includes(String(args.employeeId)));
        if (!matchesEmployee && targetIdStr !== "bulk-upsert") return null;

        return {
          id: String(r._id),
          timestamp: r.timestamp,
          action: r.action,
          userName: userMap.get(String(r.userId)) ?? "Bilinmeyen",
          date: recordDate,
          oldValue: isPdksPayload(r.oldValue) ? r.oldValue : null,
          newValue: isPdksPayload(r.newValue) ? r.newValue : null,
          note: r.note,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);
  },
});

export const list = adminQuery({
  args: {
    projectId: v.optional(v.id("projects")),
    targetTable: v.optional(v.string()),
    userId: v.optional(v.id("users")),
    startTimestamp: v.optional(v.number()),
    endTimestamp: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 200;
    const isSuperAdmin = ctx.user.role === "super_admin";

    if (args.projectId !== undefined) {
      if (!isSuperAdmin) {
        const allowedProjectIds = await getProjectIdsForUser(ctx);
        if (!allowedProjectIds.some((id) => id === args.projectId)) {
          throw new Error("Bu projeye erişim yetkiniz yok");
        }
      }
    } else if (!isSuperAdmin) {
      throw new Error("Tüm projeler görünümü süper admin gerektirir");
    }

    let rows;
    if (args.userId) {
      rows = await ctx.db
        .query("auditLog")
        .withIndex("by_user_timestamp", (q) => q.eq("userId", args.userId))
        .order("desc")
        .take(limit);
    } else if (args.projectId !== undefined) {
      rows = await ctx.db
        .query("auditLog")
        .withIndex("by_project_timestamp", (q) =>
          q.eq("projectId", args.projectId)
        )
        .order("desc")
        .take(limit);
    } else {
      rows = await ctx.db.query("auditLog").order("desc").take(limit);
    }

    if (args.targetTable) {
      rows = rows.filter((r) => r.targetTable === args.targetTable);
    }
    if (args.startTimestamp !== undefined) {
      rows = rows.filter((r) => r.timestamp >= args.startTimestamp!);
    }
    if (args.endTimestamp !== undefined) {
      rows = rows.filter((r) => r.timestamp <= args.endTimestamp!);
    }

    return rows;
  },
});

export const distinctTargetTables = adminQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("auditLog").take(500);
    return Array.from(new Set(rows.map((r) => r.targetTable))).sort();
  },
});
