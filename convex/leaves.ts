import { resolveProjectScope } from "./lib/projectScope";
import { assertPeopleProject } from "./lib/peopleScope";
import { v } from "convex/values";
import { authedQuery, adminMutation } from "./lib/customFunctions";
import { getProjectIdsForUser } from "./lib/auth";
import { approvedLeaveFields, leaveDecisionPatch } from "./lib/leaveRules";

export const list = authedQuery({
  args: {
    projectId: v.optional(v.id("projects")),
    employeeId: v.optional(v.id("employees")),
    status: v.optional(v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected"))),
  },
  handler: async (ctx, args) => {
    const projectIds = await resolveProjectScope(ctx, args.projectId);
    const results = await Promise.all(projectIds.map(projectId =>
      ctx.db.query("leaves").withIndex("by_project", q => q.eq("projectId", projectId)).collect(),
    ));
    return results.flat().filter(leave =>
      (!args.employeeId || leave.employeeId === args.employeeId) &&
      (!args.status || leave.status === args.status),
    );
  },
});

export const create = adminMutation({
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
    assertPeopleProject(args.projectId ?? emp.projectId, emp.projectId, "İzin ve çalışan");
    const now = new Date().toISOString();
    return await ctx.db.insert("leaves", {
      ...args,
      projectId: emp.projectId,
      ...approvedLeaveFields(ctx.user),
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const approve = adminMutation({
  args: {
    leaveId: v.id("leaves"),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    const leave = await ctx.db.get(args.leaveId);
    if (!leave || (leave.projectId && !allowedProjectIds.some((id) => id === leave.projectId))) {
      throw new Error("Bu izne erişim yetkiniz yok");
    }
    const now = new Date().toISOString();
    await ctx.db.patch(args.leaveId, leaveDecisionPatch(
      ctx.user.role, leave.status, "approved", ctx.user._id, now, args.notes,
    ));
  },
});

export const reject = adminMutation({
  args: {
    leaveId: v.id("leaves"),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    const leave = await ctx.db.get(args.leaveId);
    if (!leave || (leave.projectId && !allowedProjectIds.some((id) => id === leave.projectId))) {
      throw new Error("Bu izne erişim yetkiniz yok");
    }
    const now = new Date().toISOString();
    await ctx.db.patch(args.leaveId, leaveDecisionPatch(
      ctx.user.role, leave.status, "rejected", ctx.user._id, now, args.notes,
    ));
  },
});

export const listForRange = authedQuery({
  args: { startDate: v.string(), endDate: v.string(), projectId: v.optional(v.id("projects")) },
  handler: async (ctx, args) => {
    const projectIds = await resolveProjectScope(ctx, args.projectId);
    const results = await Promise.all(projectIds.map(projectId =>
      ctx.db.query("leaves").withIndex("by_project", q => q.eq("projectId", projectId)).collect(),
    ));
    return results.flat().filter(l => l.status === "approved" && l.startDate <= args.endDate && l.endDate >= args.startDate);
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
