import { requirePermission } from "./lib/permissions";
import { assertDepartmentAncestors } from "./lib/departmentTree";
import { assertPeopleProject } from "./lib/peopleScope";
import { resolveProjectScope } from "./lib/projectScope";

import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { authedQuery, authedMutation } from "./lib/customFunctions";
import { getProjectIdsForUser, isProjectAllowed } from "./lib/auth";

export const list = authedQuery({
  args: { projectId: v.optional(v.id("projects")) },
  handler: async (ctx, args) => {
    const projectIds = await resolveProjectScope(ctx, args.projectId);
    const results = await Promise.all(projectIds.map(projectId =>
      ctx.db.query("departments").withIndex("by_project", q => q.eq("projectId", projectId)).collect(),
    ));
    return results.flat();
  },
});

export const create = authedMutation({
  args: {
    name: v.string(),
    projectId: v.optional(v.id("projects")),
    parentId: v.optional(v.id("departments")),
    level: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, ctx.user, args.projectId, "employees.manage");
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    if (args.projectId && !allowedProjectIds.some((id) => id === args.projectId)) {
      throw new Error("Bu projeye erişim yetkiniz yok");
    }
    if (!args.name.trim()) throw new Error("Departman adı zorunludur");
    if (args.parentId) {
      const parent = await ctx.db.get(args.parentId);
      if (!parent) throw new Error("Üst departman bulunamadı");
      assertPeopleProject(args.projectId, parent.projectId, "Departman ve üst departman");
    }
    const now = new Date().toISOString();
    return await ctx.db.insert("departments", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = authedMutation({
  args: {
    departmentId: v.id("departments"),
    name: v.optional(v.string()),
    parentId: v.optional(v.id("departments")),
  },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    const dept = await ctx.db.get(args.departmentId);
    if (!dept) throw new Error("Departman bulunamadı");
    await requirePermission(ctx, ctx.user, dept.projectId, "employees.manage");
    if (dept.projectId ? !isProjectAllowed(allowedProjectIds, dept.projectId) : ctx.user.role !== "super_admin") {
      throw new Error("Bu departmana erişim yetkiniz yok");
    }
    if (args.name !== undefined && !args.name.trim()) throw new Error("Departman adı zorunludur");
    const parentId = args.parentId ?? dept.parentId;
    if (parentId) {
      const ancestors: string[] = [];
      let nextId: typeof parentId | undefined = parentId;
      while (nextId && ancestors.length < 50) {
        ancestors.push(nextId);
        if (nextId === dept._id || ancestors.slice(0, -1).includes(nextId)) break;
        const ancestor: Doc<"departments"> | null = await ctx.db.get(nextId);
        nextId = ancestor?.parentId;
      }
      assertDepartmentAncestors(dept._id, ancestors, ancestors.length === 50 && Boolean(nextId));
      const parent = await ctx.db.get(parentId);
      if (!parent) throw new Error("Üst departman bulunamadı");
      assertPeopleProject(dept.projectId, parent.projectId, "Departman ve üst departman");
    }
    const { departmentId, ...updates } = args;
    await ctx.db.patch(departmentId, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  },
});

export const remove = authedMutation({
  args: { departmentId: v.id("departments") },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    const dept = await ctx.db.get(args.departmentId);
    if (!dept) throw new Error("Departman bulunamadı");
    await requirePermission(ctx, ctx.user, dept.projectId, "employees.manage");
    if (dept.projectId ? !isProjectAllowed(allowedProjectIds, dept.projectId) : ctx.user.role !== "super_admin") {
      throw new Error("Bu departmana erişim yetkiniz yok");
    }
    const employees = await ctx.db.query("employees").withIndex("by_department", q => q.eq("departmentId", args.departmentId)).take(1);
    const children = await ctx.db.query("departments").withIndex("by_parent", q => q.eq("parentId", args.departmentId)).take(1);
    if (employees.length || children.length) throw new Error("Departman silinemez: bağlı çalışan veya alt departman var. Önce bağlı kayıtları taşıyın.");
    await ctx.db.delete(args.departmentId);
  },
});
