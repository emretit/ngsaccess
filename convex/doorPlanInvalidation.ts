import { v } from "convex/values";
import { internal } from "./_generated/api";
import { type MutationCtx } from "./_generated/server";
import { internalMutation } from "./lib/dashboardMutations";
import type { Id } from "./_generated/dataModel";

type Invalidation = { projectId?: Id<"projects">; years: number[]; cursor?: string | null };

/** Calendar edits invalidate status plans only; no physical send happens here. */
export async function invalidateHolidayPlans(ctx: MutationCtx, args: Invalidation): Promise<void> {
  const query = args.projectId
    ? ctx.db.query("doors").withIndex("by_project", q => q.eq("projectId", args.projectId))
    : ctx.db.query("doors");
  const page = await query.paginate({ numItems: 100, cursor: args.cursor ?? null });
  const now = new Date().toISOString();
  for (const door of page.page) {
    if (!door.hikDoorHolidayPlan?.enabled || !args.years.includes(door.hikDoorHolidayPlan.year)) continue;
    const revision = (door.hikPlanRevision ?? 0) + 1;
    const verify = door.hikPlanResults?.verify;
    await ctx.db.patch(door._id, {
      hikPlanRevision: revision,
      hikPlanSavedAt: now,
      hikPlanPendingReason: "Tatil takvimi değişti; cihaza tekrar gönderin",
      hikPlanResults: verify ? { verify: { ...verify, revision } } : {},
      hikPlanApplyError: verify?.error,
      updatedAt: now,
    });
  }
  if (!page.isDone) await ctx.scheduler.runAfter(0, internal.doorPlanInvalidation.continueInvalidation, {
    ...args, cursor: page.continueCursor,
  });
}

export const continueInvalidation = internalMutation({
  args: { projectId: v.optional(v.id("projects")), years: v.array(v.number()), cursor: v.optional(v.union(v.string(), v.null())) },
  handler: invalidateHolidayPlans,
});
