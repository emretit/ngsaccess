import { v } from "convex/values";
import { authedQuery, authedMutation } from "./lib/customFunctions";
import { getProjectIdsForUser } from "./lib/auth";

export const list = authedQuery({
  args: {
    employeeId: v.optional(v.id("employees")),
    status: v.optional(v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected"))),
  },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    if (args.employeeId) {
      const emp = await ctx.db.get(args.employeeId);
      if (!emp || (emp.projectId && !allowedProjectIds.some((id) => id === emp.projectId))) {
        return [];
      }
      const leaves = await ctx.db
        .query("leaves")
        .withIndex("by_employee", (q) => q.eq("employeeId", args.employeeId!))
        .collect();
      if (args.status) return leaves.filter((l) => l.status === args.status);
      return leaves;
    }
    if (ctx.user.role === "super_admin") {
      const leaves = await ctx.db.query("leaves").collect();
      if (args.status) return leaves.filter((l) => l.status === args.status);
      return leaves;
    }
    if (allowedProjectIds.length > 0) {
      const results = await Promise.all(
        allowedProjectIds.map((pid) =>
          ctx.db
            .query("leaves")
            .withIndex("by_project", (q) => q.eq("projectId", pid))
            .collect()
        )
      );
      const leaves = results.flat();
      if (args.status) return leaves.filter((l) => l.status === args.status);
      return leaves;
    }
    return [];
  },
});

export const create = authedMutation({
  args: {
    employeeId: v.id("employees"),
    projectId: v.optional(v.id("projects")),
    leaveType: v.union(
      v.literal("annual"),
      v.literal("sick"),
      v.literal("excuse"),
      v.literal("unpaid"),
      v.literal("parental"),
      v.literal("marriage"),
      v.literal("bereavement"),
      v.literal("paternity"),
      v.literal("lactation"),
      v.literal("compensatory")
    ),
    startDate: v.string(),
    endDate: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    const emp = await ctx.db.get(args.employeeId);
    if (!emp || (emp.projectId && !allowedProjectIds.some((id) => id === emp.projectId))) {
      throw new Error("Bu çalışana erişim yetkiniz yok");
    }
    if (args.projectId && !allowedProjectIds.some((id) => id === args.projectId)) {
      throw new Error("Bu projeye erişim yetkiniz yok");
    }
    const now = new Date().toISOString();
    return await ctx.db.insert("leaves", {
      ...args,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const approve = authedMutation({
  args: {
    leaveId: v.id("leaves"),
    approvedBy: v.id("users"),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    const leave = await ctx.db.get(args.leaveId);
    if (!leave || (leave.projectId && !allowedProjectIds.some((id) => id === leave.projectId))) {
      throw new Error("Bu izne erişim yetkiniz yok");
    }
    const now = new Date().toISOString();
    await ctx.db.patch(args.leaveId, {
      status: "approved",
      approvedBy: args.approvedBy,
      notes: args.notes,
      updatedAt: now,
    });
  },
});

export const reject = authedMutation({
  args: {
    leaveId: v.id("leaves"),
    approvedBy: v.id("users"),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    const leave = await ctx.db.get(args.leaveId);
    if (!leave || (leave.projectId && !allowedProjectIds.some((id) => id === leave.projectId))) {
      throw new Error("Bu izne erişim yetkiniz yok");
    }
    const now = new Date().toISOString();
    await ctx.db.patch(args.leaveId, {
      status: "rejected",
      approvedBy: args.approvedBy,
      notes: args.notes,
      updatedAt: now,
    });
  },
});

export const listForRange = authedQuery({
  args: {
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    let leaves;
    if (ctx.user.role === "super_admin") {
      leaves = await ctx.db.query("leaves").collect();
    } else if (allowedProjectIds.length > 0) {
      const results = await Promise.all(
        allowedProjectIds.map((pid) =>
          ctx.db
            .query("leaves")
            .withIndex("by_project", (q) => q.eq("projectId", pid))
            .collect()
        )
      );
      leaves = results.flat();
    } else {
      return [];
    }
    return leaves.filter(
      (l) =>
        l.status === "approved" &&
        l.startDate <= args.endDate &&
        l.endDate >= args.startDate,
    );
  },
});

export const getBalances = authedQuery({
  args: {
    employeeId: v.id("employees"),
    year: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    const emp = await ctx.db.get(args.employeeId);
    if (!emp || (emp.projectId && !allowedProjectIds.some((id) => id === emp.projectId))) {
      return [];
    }
    const year = args.year ?? new Date().getFullYear();
    return await ctx.db
      .query("leaveBalances")
      .withIndex("by_employee_year", (q) =>
        q.eq("employeeId", args.employeeId).eq("year", year)
      )
      .collect();
  },
});
