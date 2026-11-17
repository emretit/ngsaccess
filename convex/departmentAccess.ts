import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { reconcileEmployeeDepartmentRules } from "./lib/departmentAccess";

/** Hierarchy edits may affect a whole project; bounded transactions resume by cursor. */
export async function reconcileDepartmentProject(ctx: MutationCtx, projectId: Id<"projects">, cursor: string | null = null): Promise<void> {
  const configured = await ctx.db.query("groupDepartments").withIndex("by_project", q => q.eq("projectId", projectId)).take(1);
  if (!configured.length) return;
  const page = await ctx.db.query("employees").withIndex("by_project", q => q.eq("projectId", projectId)).paginate({ numItems: 5, cursor });
  for (const employee of page.page) await reconcileEmployeeDepartmentRules(ctx, employee._id);
  if (!page.isDone) await ctx.scheduler.runAfter(0, internal.departmentAccess.reconcileProjectBatch, { projectId, cursor: page.continueCursor });
}
export const reconcileProjectBatch = internalMutation({
  args: { projectId: v.id("projects"), cursor: v.union(v.string(), v.null()) },
  handler: (ctx, args): Promise<void> => reconcileDepartmentProject(ctx, args.projectId, args.cursor),
});
