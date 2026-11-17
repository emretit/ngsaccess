import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

type RuleFields = Omit<Doc<"pdksRuleVersions">, "_id" | "_creationTime">;
type CheckpointSnapshot = Omit<Doc<"pdksCheckpointSelections">, "_id" | "_creationTime" | "projectId" | "ruleVersionId">;

/** Persist already validated rule fields and published checkpoint addresses atomically.
 * Callers decide whether replacement is allowed; migrations only insert new versions. */
export async function writePdksRuleVersion(
  ctx: MutationCtx,
  data: RuleFields,
  snapshots: readonly CheckpointSnapshot[],
  existing?: Doc<"pdksRuleVersions"> | null,
) {
  if (snapshots.length > 500) throw new Error("PDKS kural sürümü en fazla 500 hedef içerebilir");
  let id;
  if (existing) {
    id = existing._id;
    const rows = await ctx.db.query("pdksCheckpointSelections").withIndex("by_ruleVersionId", q => q.eq("ruleVersionId", existing._id)).take(501);
    if (rows.length > 500) throw new Error("PDKS kural sürümü en fazla 500 hedef içerebilir");
    for (const row of rows) await ctx.db.delete(row._id);
    await ctx.db.replace(id, data);
  } else id = await ctx.db.insert("pdksRuleVersions", data);
  for (const snapshot of snapshots) await ctx.db.insert("pdksCheckpointSelections", { ...snapshot, projectId: data.projectId, ruleVersionId: id });
  return id;
}
