import { v } from "convex/values";
import { adminQuery } from "./lib/customFunctions";
import { paginationOptsValidator } from "convex/server";
import { resolveProjectScope } from "./lib/projectScope";
import { normalizeAuditSearch } from "./lib/auditSearch";
import { AUDIT_TARGET_LABELS, auditDateRange, auditPageMatches, auditIndex } from "./lib/auditLogQuery";

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
    allProjects: v.optional(v.boolean()),
    targetTable: v.optional(v.string()),
    userId: v.optional(v.id("users")),
    action: v.optional(v.union(v.literal("create"), v.literal("update"), v.literal("delete"))),
    search: v.optional(v.string()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    if (args.allProjects && ctx.user.role !== "super_admin") throw new Error("Tüm projeler görünümü süper admin gerektirir; bir proje seçin");
    if (!args.allProjects && !args.projectId) throw new Error("Denetim kaydı için bir proje seçin");
    const scope = await resolveProjectScope(ctx, args.allProjects ? undefined : args.projectId);
    const projectId = args.allProjects ? undefined : scope[0];
    const { startTimestamp: start, endTimestamp: end } = auditDateRange(args.startDate, args.endDate);
    const { targetTable, userId, action } = args;
    const search = normalizeAuditSearch(args.search);
    const index = auditIndex(projectId, targetTable, userId, action);
    const query = ctx.db.query("auditLog");
    const indexed = projectId
      ? index === "by_project_action_timestamp" && action
        ? query.withIndex("by_project_action_timestamp", q => q.eq("projectId", projectId).eq("action", action).gte("timestamp", start).lte("timestamp", end))
        : index === "by_project_table_timestamp" && targetTable
        ? query.withIndex("by_project_table_timestamp", q => q.eq("projectId", projectId).eq("targetTable", targetTable).gte("timestamp", start).lte("timestamp", end))
        : index === "by_project_user_timestamp" && userId
          ? query.withIndex("by_project_user_timestamp", q => q.eq("projectId", projectId).eq("userId", userId).gte("timestamp", start).lte("timestamp", end))
          : query.withIndex("by_project_timestamp", q => q.eq("projectId", projectId).gte("timestamp", start).lte("timestamp", end))
      : index === "by_action_timestamp" && action
        ? query.withIndex("by_action_timestamp", q => q.eq("action", action).gte("timestamp", start).lte("timestamp", end))
        : index === "by_table_timestamp" && targetTable
        ? query.withIndex("by_table_timestamp", q => q.eq("targetTable", targetTable).gte("timestamp", start).lte("timestamp", end))
        : index === "by_user_timestamp" && userId
          ? query.withIndex("by_user_timestamp", q => q.eq("userId", userId).gte("timestamp", start).lte("timestamp", end))
          : query.withIndex("by_timestamp", q => q.gte("timestamp", start).lte("timestamp", end));
    const result = search
      ? await query.withSearchIndex("search_text", q => {
          let searched = q.search("searchText", search);
          if (projectId) searched = searched.eq("projectId", projectId);
          if (targetTable) searched = searched.eq("targetTable", targetTable);
          if (userId) searched = searched.eq("userId", userId);
          if (action) searched = searched.eq("action", action);
          return searched;
        }).paginate(args.paginationOpts)
      : await indexed.order("desc").paginate(args.paginationOpts);
    const userIds = [...new Set(result.page.map(row => row.userId).filter((id): id is NonNullable<typeof id> => id !== undefined))];
    const users = await Promise.all(userIds.map(async id => [id, await ctx.db.get(id)] as const));
    const names = new Map(users.map(([id, user]) => [id, user?.name ?? user?.email ?? "Bilinmeyen"]));
    const projectIds = [...new Set(result.page.map(row => row.projectId).filter((id): id is NonNullable<typeof id> => id !== undefined))];
    const projects = await Promise.all(projectIds.map(async id => [id, await ctx.db.get(id)] as const));
    const projectNames = new Map(projects.map(([id, project]) => [id, project?.name ?? "Silinmiş proje"]));
    return { ...result, page: result.page
      .filter(row => row.timestamp >= start && row.timestamp <= end)
      .map(row => ({ ...row,
        userName: row.userName ?? (row.userId ? names.get(row.userId) : "Sistem"),
        projectName: row.projectId ? projectNames.get(row.projectId) ?? "Bilinmeyen proje" : "Projesiz kayıt",
      }))
      .filter(row => auditPageMatches(row, { ...args, search: undefined })) };

  },
});

export const distinctTargetTables = adminQuery({
  args: {},
  handler: async () => Object.keys(AUDIT_TARGET_LABELS),
});

export const filterUsers = adminQuery({
  args: { projectId: v.optional(v.id("projects")), allProjects: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    if (args.allProjects && ctx.user.role === "super_admin") {
      const users = await ctx.db.query("users").collect();
      return users.map(user => ({ _id: user._id, name: user.name ?? user.email ?? "Bilinmeyen" }));
    }
    const projectId = args.projectId;
    if (!projectId) return [];
    await resolveProjectScope(ctx, projectId);
    const members = await ctx.db.query("userProjects").withIndex("by_project", q => q.eq("projectId", projectId)).collect();
    const users = await Promise.all([...new Set([...members.map(member => member.userId), ctx.user._id])].map(id => ctx.db.get(id)));
    return users.filter((user): user is NonNullable<typeof user> => user !== null).map(user => ({ _id: user._id, name: user.name ?? user.email ?? "Bilinmeyen" }));
  },
});
