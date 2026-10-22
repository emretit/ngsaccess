import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx, MutationCtx } from "../_generated/server";
import { addWorkDate } from "./pdksWorkDay";

export type PdksCheckpoint = Pick<Doc<"pdksCheckpointSelections">, "targetType" | "deviceId" | "doorId" | "ioId">;
export type PdksDayPolicy = {
  punchMode: "legacy" | "requirements";
  requireCheckIn?: boolean;
  requireCheckOut?: boolean;
  missingRequiredPunch?: "absent" | "review";
  noPunch?: "absent" | "review";
  checkpointMode: "all" | "selected";
  targets: readonly PdksCheckpoint[];
};
export const LEGACY_PDKS_POLICY: PdksDayPolicy = { punchMode: "legacy", checkpointMode: "all", targets: [] };
export type PdksPolicyResolver = ((dateKey: string) => PdksDayPolicy) & { historyStart?: string };
export function createPdksRulePolicy(versions: readonly (PdksDayPolicy & { effectiveFrom: string })[]): PdksPolicyResolver {
  const sorted = [...versions].sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
  return dateKey => sorted.find(version => version.effectiveFrom <= dateKey) ?? LEGACY_PDKS_POLICY;
}
export function matchesPdksCheckpoint(reading: { deviceId?: string; ideIoId?: number }, policy: PdksDayPolicy): boolean {
  if (policy.checkpointMode === "all") return true;
  if (!reading.deviceId) return false;
  return policy.targets.some(target => target.deviceId === reading.deviceId &&
    (target.targetType === "device" || target.ioId === undefined || reading.ideIoId === target.ioId));
}
export async function loadPdksRulePolicy(ctx: QueryCtx | MutationCtx, projectId: Id<"projects"> | undefined, startDate: string, endDate: string): Promise<PdksPolicyResolver> {
  if (!projectId) return () => LEGACY_PDKS_POLICY;
  const [before, within] = await Promise.all([
    ctx.db.query("pdksRuleVersions").withIndex("by_projectId_and_effectiveFrom", q => q.eq("projectId", projectId).lte("effectiveFrom", addWorkDate(startDate, -1))).order("desc").take(1),
    ctx.db.query("pdksRuleVersions").withIndex("by_projectId_and_effectiveFrom", q => q.eq("projectId", projectId).gte("effectiveFrom", startDate).lte("effectiveFrom", endDate)).take(65),
  ]);
  if (within.length > 64) throw new Error("Dönemde 64'ten fazla PDKS kural sürümü var; tarih aralığını daraltın");
  const versions = await Promise.all([...before, ...within].map(async version => {
    const targets = version.checkpointMode === "all" ? [] : await ctx.db.query("pdksCheckpointSelections").withIndex("by_ruleVersionId", q => q.eq("ruleVersionId", version._id)).take(501);
    if (targets.length > 500) throw new Error("PDKS kural sürümü en fazla 500 hedef içerebilir");
    return { ...version, targets };
  }));
  return Object.assign(createPdksRulePolicy(versions), { historyStart: before[0]?.effectiveFrom });
}
export async function loadPdksPolicies(ctx: QueryCtx, projectIds: readonly (Id<"projects"> | undefined)[], startDate: string, endDate: string) {
  const entries = await Promise.all([...new Set(projectIds)].map(async id => [id, await loadPdksRulePolicy(ctx, id, startDate, endDate)] as const));
  const map = new Map(entries);
  return Object.assign((projectId: Id<"projects"> | undefined, date: string) => map.get(projectId)?.(date) ?? LEGACY_PDKS_POLICY, {
    historyStart: (projectId: Id<"projects"> | undefined) => map.get(projectId)?.historyStart,
  });
}
export type PdksProjectPolicies = Awaited<ReturnType<typeof loadPdksPolicies>>;

/** Policies are resolved first, so ordinary legacy scopes retain their old loaders. */
export function hasVersionedPdksPolicy(policies: PdksProjectPolicies, projectId: Id<"projects"> | undefined, startDate: string, endDate: string) {
  for (let date = startDate; date <= endDate; date = addWorkDate(date, 1)) {
    const policy = policies(projectId, date);
    if (policy.punchMode === "requirements" || policy.checkpointMode === "selected") return true;
  }
  return false;
}
