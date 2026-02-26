import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { authedQuery, adminMutation } from "./lib/customFunctions";
import { getProjectIdsForUser } from "./lib/auth";

export const list = authedQuery({
  args: {
    projectIds: v.optional(v.array(v.id("projects"))),
    isSuperAdmin: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);

    let employees;
    if (args.isSuperAdmin && ctx.user.role === "super_admin") {
      employees = await ctx.db.query("employees").order("desc").collect();
    } else if (allowedProjectIds.length > 0) {
      const results = await Promise.all(
        allowedProjectIds.map((pid) =>
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

export const getById = authedQuery({
  args: { employeeId: v.id("employees") },
  handler: async (ctx, args) => {
    const emp = await ctx.db.get(args.employeeId);
    if (!emp) return null;
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    if (
      emp.projectId &&
      !allowedProjectIds.some((id) => id === emp.projectId)
    ) {
      return null;
    }
    if (!emp.projectId && ctx.user.role !== "super_admin") {
      return null;
    }
    return emp;
  },
});

export const checkDuplicate = authedQuery({
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

export const create = adminMutation({
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
    if (args.projectId) {
      const allowedProjectIds = await getProjectIdsForUser(ctx);
      if (!allowedProjectIds.some((id) => id === args.projectId)) {
        throw new Error("Bu projeye erişim yetkiniz yok");
      }
    }
    const now = new Date().toISOString();
    return await ctx.db.insert("employees", {
      ...args,
      isActive: args.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    });
  },
  returns: v.id("employees"),
});

export const update = adminMutation({
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
    const emp = await ctx.db.get(employeeId);
    if (!emp) throw new Error("Çalışan bulunamadı");
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    if (
      emp.projectId &&
      !allowedProjectIds.some((id) => id === emp.projectId)
    ) {
      throw new Error("Bu çalışana erişim yetkiniz yok");
    }
    const clean: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    for (const [k, val] of Object.entries(updates)) {
      if (val !== undefined) clean[k] = val;
    }
    await ctx.db.patch(employeeId, clean);
    return employeeId;
  },
  returns: v.id("employees"),
});

export const remove = adminMutation({
  args: { employeeId: v.id("employees") },
  handler: async (ctx, args) => {
    const emp = await ctx.db.get(args.employeeId);
    if (!emp) throw new Error("Çalışan bulunamadı");
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    if (
      emp.projectId &&
      !allowedProjectIds.some((id) => id === emp.projectId)
    ) {
      throw new Error("Bu çalışana erişim yetkiniz yok");
    }
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
  returns: v.null(),
});

export const bulkDelete = adminMutation({
  args: { employeeIds: v.array(v.id("employees")) },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    for (const id of args.employeeIds) {
      const emp = await ctx.db.get(id);
      if (emp && emp.projectId && !allowedProjectIds.some((pid) => pid === emp.projectId)) {
        throw new Error(`Çalışan ${emp.firstName} ${emp.lastName} için erişim yetkiniz yok`);
      }
    }
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
  returns: v.null(),
});

export const bulkUpdateStatus = adminMutation({
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
  returns: v.null(),
});
