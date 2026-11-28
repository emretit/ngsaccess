import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

/** Imported IDs can refer to scheduler rows that were not included in the snapshot. */
export async function cancelImportedJob(ctx: MutationCtx, id: Id<"_scheduled_functions">) {
  const job = await ctx.db.system.get(id);
  if (job && (job.state.kind === "pending" || job.state.kind === "inProgress")) await ctx.scheduler.cancel(id);
}
