import { getProjectRole, requirePermission } from "./lib/permissions";
import { writeAudit } from "./lib/audit";
import { upsertPrivacySettings } from "./lib/privacySettings";
import { paginationOptsValidator } from "convex/server";
import { stream } from "convex-helpers/server/stream";
import schema from "./schema";
import { adminPaginationOptions, adminSearch, ADMIN_COUNT_LIMIT, projectName } from "./lib/adminLists";
import { projectDeletionCounts, projectDeletionImpact, projectDeletionCleanupQuery } from "./lib/adminGuards";
import { ConvexError, v } from "convex/values";
import { projectDeletionBlockers, projectDeletionCleanupTables, projectDeletionError } from "./lib/adminGuards";
import { query } from "./_generated/server";
import { getCurrentUser, getValidAuthUserId } from "./lib/auth";
import { authedMutation, authedQuery, superAdminQuery, superAdminMutation } from "./lib/customFunctions";

export const list = authedQuery({
  args: {},
  handler: async (ctx) => {
    if (ctx.user.role === "super_admin") {
      return await ctx.db.query("projects").collect();
    }
    // Üyeler sadece kendi projelerini görür
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
    if (!(await getValidAuthUserId(ctx))) return [];
    const user = await getCurrentUser(ctx);
    if (user.role === "super_admin") {
      const projects = await ctx.db.query("projects").collect();
      return projects.filter(p => p.isActive === true);
    }
    const rows = await ctx.db.query("userProjects").withIndex("by_user", q => q.eq("userId", user._id)).collect();
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
    await ctx.db.insert("userProjects", { userId: ctx.user._id, projectId: id, role: "admin", createdAt: now });
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
    await requirePermission(ctx, ctx.user, args.id, "admin.manage");
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

/** Same permission as remove; no writes or lock promises. */
export const getDeletionImpact = authedQuery({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) throw new Error("Proje bulunamadı");
    await requirePermission(ctx, ctx.user, args.projectId, "admin.manage");
    return await projectDeletionImpact(ctx, args.projectId);
  },
});

/** İlk gerçek kart geçişine kadar seçili projenin kurulum durumu. */
export const getSetupStatus = authedQuery({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    if (!(await ctx.db.get(projectId))) throw new Error("Proje bulunamadı");
    await requirePermission(ctx, ctx.user, projectId, "admin.manage");
    const [administrator, connectedDevice, cardholder, rule, reading] = await Promise.all([
      stream(ctx.db, schema).query("userProjects")
        .withIndex("by_project", q => q.eq("projectId", projectId))
        .filterWith(async row => {
          const member = await ctx.db.get(row.userId);
          return member !== null && (row.role === "admin" || (member.role !== "super_admin" && await getProjectRole(ctx, member, projectId) === "admin"));
        }).first(),
      // lastSeen ve aktif/kart koşullarının birleşik indeksi yok: proje aralığında erken dur.
      stream(ctx.db, schema).query("devices")
        .withIndex("by_project", q => q.eq("projectId", projectId))
        .filterWith(async row => row.lastSeen !== undefined).first(),
      stream(ctx.db, schema).query("employees")
        .withIndex("by_project", q => q.eq("projectId", projectId))
        .filterWith(async row => row.isActive === true && row.isVisitor !== true && row.cardNumber.trim().length > 0).first(),
      ctx.db.query("accessRules")
        .withIndex("by_project_active", q => q.eq("projectId", projectId).eq("isActive", true)).first(),
      ctx.db.query("cardReadings")
        .withIndex("by_project_status_time", q => q.eq("projectId", projectId).eq("accessStatus", "izin_verildi")).first(),
    ]);
    const steps = [
      { key: "administrator" as const, done: administrator !== null },
      { key: "device" as const, done: connectedDevice !== null },
      { key: "cardholder" as const, done: cardholder !== null },
      { key: "accessRule" as const, done: rule !== null },
      { key: "firstPassage" as const, done: reading !== null },
    ];
    return { steps, complete: steps.every(step => step.done) };
  },
});
