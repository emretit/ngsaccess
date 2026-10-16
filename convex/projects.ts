import { query } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { projectDeletionBlockingTables, projectDeletionBlockers, projectDeletionCleanupTables, projectDeletionError } from "./lib/adminGuards";
import { authedMutation, authedQuery, superAdminMutation } from "./lib/customFunctions";

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

export const listActive = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("projects")
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
  },
});

export const getById = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.projectId);
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
    return await ctx.db.insert("projects", {
      name: args.name,
      description: args.description,
      ownerId: ctx.user._id,
      isActive: args.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    });
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
    const counts = await Promise.all(projectDeletionBlockingTables.map(async (entry) => {
      const rows = entry.index === "by_project"
        ? await ctx.db.query(entry.table).withIndex(entry.index, (q) => q.eq("projectId", args.id)).take(101)
        : entry.index === "by_project_employee"
          ? await ctx.db.query(entry.table).withIndex(entry.index, (q) => q.eq("projectId", args.id)).take(101)
          : entry.index === "by_project_device"
            ? await ctx.db.query(entry.table).withIndex(entry.index, (q) => q.eq("projectId", args.id)).take(101)
            : await ctx.db.query(entry.table).withIndex(entry.index, (q) => q.eq("projectId", args.id)).take(101);
      return [entry.table, rows.length] as const;
    }));
    const deletionError = projectDeletionError(projectDeletionBlockers(Object.fromEntries(counts)));
    if (deletionError) throw new ConvexError(deletionError);

    for (const table of projectDeletionCleanupTables) {
      // invites küçük bir tablo ve proje index'i yok; yalnız eşleşen davetler silinir.
      const rows = table === "invites"
        ? ctx.db.query(table).filter((q) => q.eq(q.field("projectId"), args.id))
        : ctx.db.query(table).withIndex("by_project", (q) => q.eq("projectId", args.id));
      // Sohbet mesajları chatConversations satırının içinde tutulur.
      for await (const row of rows) await ctx.db.delete(row._id);
    }
    // auditLog geçmişi korunur.
    await ctx.db.delete(args.id);
    return args.id;
  },
});
