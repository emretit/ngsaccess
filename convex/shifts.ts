import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { authedQuery, authedMutation } from "./lib/customFunctions";
import { getProjectIdsForUser } from "./lib/auth";

export const listAssignments = authedQuery({
  args: {
    employeeId: v.optional(v.id("employees")),
    shiftId: v.optional(v.id("shifts")),
  },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    if (args.employeeId) {
      const emp = await ctx.db.get(args.employeeId);
      if (!emp || (emp.projectId && !allowedProjectIds.some((id) => id === emp.projectId))) {
        return [];
      }
      return await ctx.db
        .query("shiftAssignments")
        .withIndex("by_employee", (q) => q.eq("employeeId", args.employeeId!))
        .collect();
    }
    if (args.shiftId) {
      const shift = await ctx.db.get(args.shiftId);
      if (!shift || (shift.projectId && !allowedProjectIds.some((id) => id === shift.projectId))) {
        return [];
      }
      return await ctx.db
        .query("shiftAssignments")
        .withIndex("by_shift", (q) => q.eq("shiftId", args.shiftId!))
        .collect();
    }
    if (ctx.user.role === "super_admin") {
      return await ctx.db.query("shiftAssignments").collect();
    }
    if (allowedProjectIds.length > 0) {
      const results = await Promise.all(
        allowedProjectIds.map((pid) =>
          ctx.db
            .query("shiftAssignments")
            .withIndex("by_project", (q) => q.eq("projectId", pid))
            .collect()
        )
      );
      return results.flat();
    }
    return [];
  },
});

export const assignShift = authedMutation({
  args: {
    employeeId: v.id("employees"),
    shiftId: v.id("shifts"),
    projectId: v.optional(v.id("projects")),
    startDate: v.string(),
    endDate: v.string(),
    weekPattern: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    if (args.projectId && !allowedProjectIds.some((id) => id === args.projectId)) {
      throw new Error("Bu projeye erişim yetkiniz yok");
    }
    const emp = await ctx.db.get(args.employeeId);
    if (!emp || (emp.projectId && !allowedProjectIds.some((id) => id === emp.projectId))) {
      throw new Error("Bu çalışana erişim yetkiniz yok");
    }
    const shift = await ctx.db.get(args.shiftId);
    if (!shift || (shift.projectId && !allowedProjectIds.some((id) => id === shift.projectId))) {
      throw new Error("Bu vardiyaya erişim yetkiniz yok");
    }
    const now = new Date().toISOString();
    return await ctx.db.insert("shiftAssignments", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateAssignment = authedMutation({
  args: {
    assignmentId: v.id("shiftAssignments"),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    shiftId: v.optional(v.id("shifts")),
    weekPattern: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    const assignment = await ctx.db.get(args.assignmentId);
    if (!assignment) throw new Error("Atama bulunamadı");
    if (assignment.projectId && !allowedProjectIds.some((id) => id === assignment.projectId)) {
      throw new Error("Bu atamaya erişim yetkiniz yok");
    }
    const { assignmentId, ...updates } = args;
    const clean: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    for (const [k, val] of Object.entries(updates)) {
      if (val !== undefined) clean[k] = val;
    }
    await ctx.db.patch(assignmentId, clean);
  },
});

export const removeAssignment = authedMutation({
  args: { assignmentId: v.id("shiftAssignments") },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    const assignment = await ctx.db.get(args.assignmentId);
    if (!assignment) throw new Error("Atama bulunamadı");
    if (assignment.projectId && !allowedProjectIds.some((id) => id === assignment.projectId)) {
      throw new Error("Bu atamaya erişim yetkiniz yok");
    }
    await ctx.db.delete(args.assignmentId);
  },
});

export const list = authedQuery({
  args: {},
  handler: async (ctx) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    if (ctx.user.role === "super_admin") return await ctx.db.query("shifts").collect();
    if (allowedProjectIds.length === 0) return [];
    const results = await Promise.all(
      allowedProjectIds.map((pid) =>
        ctx.db
          .query("shifts")
          .withIndex("by_project", (q) => q.eq("projectId", pid))
          .collect()
      )
    );
    return results.flat();
  },
});

export const create = authedMutation({
  args: {
    name: v.string(),
    projectId: v.optional(v.id("projects")),
    startTime: v.string(),
    endTime: v.string(),
    breakStart: v.optional(v.string()),
    breakEnd: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    if (args.projectId && !allowedProjectIds.some((id) => id === args.projectId)) {
      throw new Error("Bu projeye erişim yetkiniz yok");
    }
    const now = new Date().toISOString();
    return await ctx.db.insert("shifts", { ...args, createdAt: now, updatedAt: now });
  },
});

export const update = authedMutation({
  args: {
    shiftId: v.id("shifts"),
    name: v.optional(v.string()),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    breakStart: v.optional(v.string()),
    breakEnd: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    const shift = await ctx.db.get(args.shiftId);
    if (!shift) throw new Error("Vardiya bulunamadı");
    if (shift.projectId && !allowedProjectIds.some((id) => id === shift.projectId)) {
      throw new Error("Bu vardiyaya erişim yetkiniz yok");
    }
    const { shiftId, ...updates } = args;
    const clean: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    for (const [k, v] of Object.entries(updates)) {
      if (v !== undefined) clean[k] = v;
    }
    await ctx.db.patch(shiftId, clean);
  },
});

export const remove = authedMutation({
  args: { shiftId: v.id("shifts") },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    const shift = await ctx.db.get(args.shiftId);
    if (!shift) throw new Error("Vardiya bulunamadı");
    if (shift.projectId && !allowedProjectIds.some((id) => id === shift.projectId)) {
      throw new Error("Bu vardiyaya erişim yetkiniz yok");
    }
    await ctx.db.delete(args.shiftId);
  },
});
