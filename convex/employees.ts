import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

export const list = query({
  args: {
    projectIds: v.optional(v.array(v.id("projects"))),
    isSuperAdmin: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    let employees;
    if (args.isSuperAdmin) {
      employees = await ctx.db.query("employees").order("desc").collect();
    } else if (args.projectIds && args.projectIds.length > 0) {
      const results = await Promise.all(
        args.projectIds.map((pid) =>
          ctx.db
            .query("employees")
            .withIndex("by_project", (q) => q.eq("projectId", pid))
            .collect()
        )
      );
      employees = results.flat();
    } else {
      return [];
    }

    return await Promise.all(
      employees.map(async (emp) => {
        const department = emp.departmentId
          ? await ctx.db.get(emp.departmentId)
          : null;
        const position = emp.positionId
          ? await ctx.db.get(emp.positionId)
          : null;
        return {
          ...emp,
          departments: department
            ? { id: department._id, name: department.name }
            : null,
          positions: position
            ? { id: position._id, name: position.name }
            : null,
        };
      })
    );
  },
});

export const getById = query({
  args: { employeeId: v.id("employees") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.employeeId);
  },
});

export const checkDuplicate = query({
  args: {
    tcNo: v.string(),
    cardNumber: v.string(),
    email: v.string(),
    excludeId: v.optional(v.id("employees")),
  },
  handler: async (ctx, args) => {
    const byCard = await ctx.db
      .query("employees")
      .withIndex("by_card", (q) => q.eq("cardNumber", args.cardNumber))
      .first();
    if (byCard && byCard._id !== args.excludeId) {
      return { field: "cardNumber", duplicate: true };
    }
    const byEmail = await ctx.db
      .query("employees")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
    if (byEmail && byEmail._id !== args.excludeId) {
      return { field: "email", duplicate: true };
    }
    return { duplicate: false };
  },
});

export const create = mutation({
  args: {
    projectId: v.optional(v.id("projects")),
    firstName: v.string(),
    lastName: v.string(),
    email: v.string(),
    tcNo: v.string(),
    cardNumber: v.string(),
    departmentId: v.optional(v.id("departments")),
    companyId: v.optional(v.id("companies")),
    positionId: v.optional(v.id("positions")),
    shiftId: v.optional(v.id("shifts")),
    accessRuleId: v.optional(v.id("accessRules")),
    photoUrl: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    notes: v.optional(v.string()),
    shift: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    return await ctx.db.insert("employees", {
      ...args,
      isActive: args.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    employeeId: v.id("employees"),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    email: v.optional(v.string()),
    tcNo: v.optional(v.string()),
    cardNumber: v.optional(v.string()),
    departmentId: v.optional(v.id("departments")),
    companyId: v.optional(v.id("companies")),
    positionId: v.optional(v.id("positions")),
    shiftId: v.optional(v.id("shifts")),
    accessRuleId: v.optional(v.id("accessRules")),
    photoUrl: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    notes: v.optional(v.string()),
    shift: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { employeeId, ...updates } = args;
    const clean: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    for (const [k, v] of Object.entries(updates)) {
      if (v !== undefined) clean[k] = v;
    }
    await ctx.db.patch(employeeId, clean);
    return employeeId;
  },
});

export const remove = mutation({
  args: { employeeId: v.id("employees") },
  handler: async (ctx, args) => {
    // İlişkili kayıtları temizle
    const groupMembers = await ctx.db
      .query("groupMembers")
      .withIndex("by_employee", (q) => q.eq("employeeId", args.employeeId))
      .collect();
    await Promise.all(groupMembers.map((gm) => ctx.db.delete(gm._id)));

    const employeeAuth = await ctx.db
      .query("employeeAuth")
      .withIndex("by_employee", (q) => q.eq("employeeId", args.employeeId))
      .collect();
    await Promise.all(employeeAuth.map((ea) => ctx.db.delete(ea._id)));

    await ctx.db.delete(args.employeeId);
  },
});

export const bulkDelete = mutation({
  args: { employeeIds: v.array(v.id("employees")) },
  handler: async (ctx, args) => {
    await Promise.all(
      args.employeeIds.map(async (id) => {
        const groupMembers = await ctx.db
          .query("groupMembers")
          .withIndex("by_employee", (q) => q.eq("employeeId", id))
          .collect();
        await Promise.all(groupMembers.map((gm) => ctx.db.delete(gm._id)));
        await ctx.db.delete(id);
      })
    );
  },
});

export const bulkUpdateStatus = mutation({
  args: {
    employeeIds: v.array(v.id("employees")),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    await Promise.all(
      args.employeeIds.map((id) =>
        ctx.db.patch(id, { isActive: args.isActive, updatedAt: now })
      )
    );
  },
});
