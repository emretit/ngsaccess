import { requirePermission } from "./lib/permissions";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { requireEmployeeAccess } from "./lib/auth";
import { authedQuery } from "./lib/customFunctions";
import { paginationOptsValidator } from "convex/server";
import { normalizeAuditSearch } from "./lib/auditSearch";
import { auditDateRange, auditPageMatches } from "./lib/auditLogQuery";

import { AUDIT_ACTOR_SCAN_LIMIT, auditActorIndex, mergeAuditActors } from "./lib/auditActors";

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

export const getPdksAuditForEmployee = authedQuery({
  args: {
    employeeId: v.id("employees"),
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, args) => {
    const employee = await requireEmployeeAccess(ctx, args.employeeId);
    await requirePermission(ctx, ctx.user, employee.projectId, "admin.manage");
    const records = await ctx.db.query("pdksRecords")
      .withIndex("by_employee_date", q => q.eq("employeeId", employee._id)
        .gte("date", args.startDate).lte("date", args.endDate))
      .order("desc").take(500);
    // Both employee-targeted history and existing record-targeted manual edits use by_target.
    // The budget applies only to this employee, never to a global recent-history scan.
    const filtered: Doc<"auditLog">[] = [];
    let remaining = 500;
    for (const targetId of [String(employee._id), ...records.map(record => String(record._id))]) {
      const rows = await ctx.db.query("auditLog")
        .withIndex("by_target", q => q.eq("targetTable", "pdksRecords").eq("targetId", targetId))
        .order("desc").take(remaining);
      remaining -= rows.length;
      filtered.push(...rows.filter(row => row.projectId === employee.projectId));
      if (remaining === 0) break;
    }
    filtered.sort((a, b) => b.timestamp - a.timestamp);
    const userIds = [...new Set(filtered.flatMap(row => row.userId ? [row.userId] : []))];
    const users = await Promise.all(userIds.map(async id => [id, await ctx.db.get(id)] as const));
    const userMap = new Map(users.map(([id, user]) => [id, user?.name ?? user?.email ?? "Bilinmeyen"]));

    return filtered
      .map((r) => {
        const newDate = isPdksPayload(r.newValue) ? r.newValue.date : undefined;
        const oldDate = isPdksPayload(r.oldValue) ? r.oldValue.date : undefined;
        const recordDate = newDate ?? oldDate;
        if (recordDate && (recordDate < args.startDate || recordDate > args.endDate)) {
          return null;
        }
        return {
          id: String(r._id),
          timestamp: r.timestamp,
          action: r.action,
          userName: (r.userId ? userMap.get(r.userId) : undefined) ?? "Bilinmeyen",
          date: recordDate,
          oldValue: isPdksPayload(r.oldValue) ? r.oldValue : null,
          newValue: isPdksPayload(r.newValue) ? r.newValue : null,
          note: r.note,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);
  },
});

export const list = authedQuery({
  args: {
    projectId: v.optional(v.id("projects")),
    allProjects: v.optional(v.boolean()),
    targetTable: v.optional(v.string()),
    userId: v.optional(v.id("users")),
    actor: v.optional(v.literal("system")),
    action: v.optional(v.union(v.literal("create"), v.literal("update"), v.literal("delete"))),
    search: v.optional(v.string()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    if (args.allProjects && ctx.user.role !== "super_admin") throw new Error("Tüm projeler görünümü süper admin gerektirir; bir proje seçin");
    if (!args.allProjects && !args.projectId) throw new Error("Denetim kaydı için bir proje seçin");
    const projectId = args.allProjects ? undefined : args.projectId;
    await requirePermission(ctx, ctx.user, projectId, "admin.manage");
    const { startTimestamp: start, endTimestamp: end } = auditDateRange(args.startDate, args.endDate);
    const { targetTable, userId, action } = args;
    const search = normalizeAuditSearch(args.search);
    const index = auditActorIndex(projectId, targetTable, userId, action, args.actor);
    const query = ctx.db.query("auditLog");
    const indexed = projectId
      ? index === "by_project_action_timestamp" && action
        ? query.withIndex("by_project_action_timestamp", q => q.eq("projectId", projectId).eq("action", action).gte("timestamp", start).lte("timestamp", end))
        : index === "by_project_table_timestamp" && targetTable
        ? query.withIndex("by_project_table_timestamp", q => q.eq("projectId", projectId).eq("targetTable", targetTable).gte("timestamp", start).lte("timestamp", end))
        : index === "by_project_user_timestamp" && (userId || args.actor)
          ? query.withIndex("by_project_user_timestamp", q => q.eq("projectId", projectId).eq("userId", userId).gte("timestamp", start).lte("timestamp", end))
          : query.withIndex("by_project_timestamp", q => q.eq("projectId", projectId).gte("timestamp", start).lte("timestamp", end))
      : index === "by_action_timestamp" && action
        ? query.withIndex("by_action_timestamp", q => q.eq("action", action).gte("timestamp", start).lte("timestamp", end))
        : index === "by_table_timestamp" && targetTable
        ? query.withIndex("by_table_timestamp", q => q.eq("targetTable", targetTable).gte("timestamp", start).lte("timestamp", end))
        : index === "by_user_timestamp" && (userId || args.actor)
          ? query.withIndex("by_user_timestamp", q => q.eq("userId", userId).gte("timestamp", start).lte("timestamp", end))
          : query.withIndex("by_timestamp", q => q.gte("timestamp", start).lte("timestamp", end));
    const result = search
      ? await query.withSearchIndex("search_text", q => {
          let searched = q.search("searchText", search);
          if (projectId) searched = searched.eq("projectId", projectId);
          if (targetTable) searched = searched.eq("targetTable", targetTable);
          if (userId || args.actor) searched = searched.eq("userId", userId);
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
    return { ...result, ...(args.actor ? { actorFilterScope: "index" as const } : {}), page: result.page
      .filter(row => row.timestamp >= start && row.timestamp <= end)
      .filter(row => !args.actor || row.userId === undefined)
      .map(row => ({ ...row,
        userName: row.userName ?? (row.userId ? names.get(row.userId) : "Sistem"),
        projectName: row.projectId ? projectNames.get(row.projectId) ?? "Bilinmeyen proje" : "Projesiz kayıt",
      }))
      .filter(row => auditPageMatches(row, { ...args, search: undefined })) };

  },
});

/** Bounded recent-history picker, not a cursor-paginated query. */
export const actorOptions = authedQuery({
  args: {
    projectId: v.optional(v.id("projects")),
    allProjects: v.optional(v.boolean()),
    search: v.optional(v.string()),
    paginationOpts: v.optional(paginationOptsValidator),
  },
  handler: async (ctx, args) => {
    if (args.allProjects && ctx.user.role !== "super_admin") throw new Error("Tüm projeler görünümü süper admin gerektirir; bir proje seçin");
    if (!args.allProjects && !args.projectId) throw new Error("Denetim kaydı için bir proje seçin");
    const projectId = args.allProjects ? undefined : args.projectId;
    await requirePermission(ctx, ctx.user, projectId, "admin.manage");
    // Accepted for caller compatibility; no cursor contract is advertised by this picker.
    if (args.paginationOpts?.cursor) throw new Error("Aktör seçenekleri cursor ile sayfalanmaz");
    const requested = args.paginationOpts?.numItems ?? AUDIT_ACTOR_SCAN_LIMIT;
    if (!Number.isInteger(requested) || requested < 1) throw new Error("Aktör tarama sınırı pozitif tam sayı olmalı");
    const limit = Math.min(requested, AUDIT_ACTOR_SCAN_LIMIT);
    const events = await (projectId
      ? ctx.db.query("auditLog").withIndex("by_project_timestamp", q => q.eq("projectId", projectId))
      : ctx.db.query("auditLog").withIndex("by_timestamp"))
      .order("desc").paginate({ numItems: limit, cursor: null, maximumRowsRead: limit, maximumBytesRead: 4 * 1024 * 1024 });
    const members = await (projectId
      ? ctx.db.query("userProjects").withIndex("by_project", q => q.eq("projectId", projectId))
      : ctx.db.query("userProjects"))
      .take(AUDIT_ACTOR_SCAN_LIMIT + 1);
    const boundedEvents = events.page;
    const memberIds = members.slice(0, AUDIT_ACTOR_SCAN_LIMIT).map(member => member.userId);
    const userIds = [...new Set([
      ...boundedEvents.flatMap(event => event.userId ? [event.userId] : []),
      ...memberIds, ctx.user._id,
    ])];
    const users = await Promise.all(userIds.map(id => ctx.db.get(id)));
    return {
      ...mergeAuditActors({
        events: boundedEvents,
        users: users.filter((user): user is NonNullable<typeof user> => user !== null),
        memberIds, callerId: ctx.user._id, allProjects: args.allProjects, search: args.search,
        membershipComplete: members.length <= AUDIT_ACTOR_SCAN_LIMIT,
      }),
      truncated: !events.isDone || members.length > AUDIT_ACTOR_SCAN_LIMIT,
    };
  },
});
