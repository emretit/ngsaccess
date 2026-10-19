import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

/** Modül açma kapısı; operasyon durumu auditLog içinde tutulur. */
export async function hasActiveDestructionRun(ctx: QueryCtx | MutationCtx, projectId: Id<"projects">): Promise<boolean> {
  const [row] = await ctx.db.query("auditLog")
    .withIndex("by_project_table_timestamp", q => q.eq("projectId", projectId).eq("targetTable", "biometricDestructionRun"))
    .order("desc").take(1);
  const state: unknown = row?.newValue;
  if (!state || typeof state !== "object" || !("status" in state)) return false;
  if (state.status === "waitingDevices") return true;
  if (state.status !== "running") return false;
  return "heartbeatAt" in state && typeof state.heartbeatAt === "number" && Date.now() - state.heartbeatAt < 30 * 60 * 1000;
}
