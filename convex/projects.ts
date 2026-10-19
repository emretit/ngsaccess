import { writeAudit } from "./lib/audit";
import { upsertPrivacySettings } from "./lib/privacySettings";
import { paginationOptsValidator } from "convex/server";
import { stream } from "convex-helpers/server/stream";
import schema from "./schema";
import { adminPaginationOptions, adminSearch, ADMIN_COUNT_LIMIT, projectName } from "./lib/adminLists";
import { projectDeletionCounts, projectDeletionImpact, projectDeletionCleanupQuery } from "./lib/adminGuards";
import { ConvexError, v } from "convex/values";
import { projectDeletionBlockers, projectDeletionCleanupTables, projectDeletionError } from "./lib/adminGuards";
import { authedMutation, authedQuery, superAdminQuery, superAdminMutation } from "./lib/customFunctions";

export const list = authedQuery({
  args: {},
  handler: async (ctx) => {
    if (ctx.user.role === "super_admin") {
      return await ctx.db.query("projects").collect();
    }
    // project_admin / project_user sadece kendi projelerini görür
    const rows = await ctx.db
      .query("userProjects")
      .withIndex("by_user", (q) => q.eq("userId", ctx.user._id))
      .collect();
    const projects = await Promise.all(rows.map((r) => ctx.db.get(r.projectId)));
    return projects.filter((p): p is NonNullable<typeof p> => p !== null);
  },
});

export const listActive = authedQuery({
  args: {},
  handler: async (ctx) => {
    if (ctx.user.role === "super_admin") {
      const projects = await ctx.db.query("projects").collect();
      return projects.filter(p => p.isActive === true);
    }
    const rows = await ctx.db.query("userProjects").withIndex("by_user", q => q.eq("userId", ctx.user._id)).collect();
    const projects = await Promise.all([...new Set(rows.map(r => r.projectId))].map(id => ctx.db.get(id)));
    return projects.filter((p): p is NonNullable<typeof p> => p !== null && p.isActive === true);
  },
});

export const getById = authedQuery({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project || ctx.user.role === "super_admin" || project.ownerId === ctx.user._id) return project;
    const memberships = ctx.db.query("userProjects").withIndex("by_user", q => q.eq("userId", ctx.user._id));
    for await (const row of memberships) {
      if (row.projectId === args.projectId) return project;
    }
    throw new Error("Bu projeye erişim yetkiniz yok");
  },
});

export const create = superAdminMutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  returns: v.id("projects"),
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    const id = await ctx.db.insert("projects", {
      name: projectName(args.name),
      description: args.description,
      ownerId: ctx.user._id,
      isActive: args.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    });
    await upsertPrivacySettings(ctx, id, { biometricEnabled: false });
    await writeAudit(ctx, { user: ctx.user, projectId: id, action: "create",
      targetTable: "projectPrivacySettings", targetId: id, newValue: { biometricEnabled: false } });
    return id;
  },
});

export const update = superAdminMutation({
  args: {
    id: v.id("projects"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  returns: v.id("projects"),
  handler: async (ctx, args) => {
    const { id: projectId, ...updates } = args;
    const existing = await ctx.db.get(projectId);
    if (!existing) throw new Error("Proje bulunamadı");
    const updateData: Record<string, unknown> = {
      ...updates,
      ...(updates.name !== undefined ? { name: projectName(updates.name) } : {}),
      updatedAt: new Date().toISOString(),
    };
    Object.keys(updateData).forEach((k) => {
      if (updateData[k] === undefined) delete updateData[k];
    });
    await ctx.db.patch(projectId, updateData);
    return projectId;
  },
});

export const remove = authedMutation({
  args: { id: v.id("projects") },
  returns: v.id("projects"),
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.id);
    if (!project) throw new Error("Proje bulunamadı");
    const isSuperAdmin = ctx.user.role === "super_admin";
    const isOwner = project.ownerId === ctx.user._id;
    if (!isSuperAdmin && !isOwner) {
      throw new Error("Sadece proje sahibi veya süper admin silebilir");
    }
    // Sayım proje index'inde 101'de durur; büyük kümeler alt sınır olarak gösterilir.
    const counts = await projectDeletionCounts(ctx, args.id);
    const deletionError = projectDeletionError(projectDeletionBlockers(counts));
    if (deletionError) throw new ConvexError(deletionError);

    for (const table of projectDeletionCleanupTables) {
      // invites küçük bir tablo ve proje index'i yok; yalnız eşleşen davetler silinir.
      const rows = projectDeletionCleanupQuery(ctx, table, args.id);
      // Sohbet mesajları chatConversations satırının içinde tutulur.
      for await (const row of rows) await ctx.db.delete(row._id);
    }
    // auditLog geçmişi korunur.
    await ctx.db.delete(args.id);
    return args.id;
  },
});

export const adminList = superAdminQuery({
  args: {
    search: v.optional(v.string()), status: v.optional(v.union(v.literal("active"), v.literal("inactive"))),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    let totalScanned = 0;
    const result = await stream(ctx.db, schema).query("projects").order("desc").filterWith(async project => {
      totalScanned++;
      return (!args.status || (project.isActive === true) === (args.status === "active")) && adminSearch(args.search, project.name, project.description);
    }).paginate(adminPaginationOptions(args.paginationOpts, 25));
    return { ...result, filterScope: "server" as const, totalScanned,
      page: await Promise.all(result.page.map(async project => {
        const [members, owner] = await Promise.all([
          ctx.db.query("userProjects").withIndex("by_project", q => q.eq("projectId", project._id)).take(ADMIN_COUNT_LIMIT + 1),
          project.ownerId ? ctx.db.get(project.ownerId) : null,
        ]);
        // Duplicate legacy memberships must not inflate the visible member count.
        const memberCount = { count: new Set(members.slice(0, ADMIN_COUNT_LIMIT).map(row => row.userId)).size,
          capped: members.length > ADMIN_COUNT_LIMIT };
        return { _id: project._id, name: project.name, description: project.description, isActive: project.isActive === true,
          createdAt: project.createdAt, memberCount: memberCount.count, memberCountCapped: memberCount.capped,
          ownerName: owner?.fullName || owner?.name || owner?.email,
        };
      })),
    };
  },
});

/** Owner-or-super-admin, identical to remove; no writes or lock promises. */
export const getDeletionImpact = authedQuery({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) throw new Error("Proje bulunamadı");
    if (ctx.user.role !== "super_admin" && project.ownerId !== ctx.user._id) {
      throw new Error("Sadece proje sahibi veya süper admin silebilir");
    }
    return await projectDeletionImpact(ctx, args.projectId);
  },
});
