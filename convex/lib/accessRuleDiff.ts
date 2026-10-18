import { ConvexError } from "convex/values";
import { diffIds } from "./reconcileMath";

export const RULE_DETAILS_MEMBER_LIMIT = 100;
export const RULE_DETAILS_RELATION_LIMIT = 50;

export type RelationDiff<T extends string> = { added: T[]; removed: T[] };

/** Compare against the editor's opening snapshot, never against a later subscription. */
export function buildRelationDiff<T extends string>(before: readonly T[], after: readonly T[]): RelationDiff<T> {
  const { added, removed } = diffIds(before, after);
  return { added, removed };
}

/** Apply explicit intent to live membership. Unseen/concurrent additions survive. */
export function applyRelationDiff<T extends string>(live: readonly T[], diff: RelationDiff<T>): T[] {
  const added = new Set(diff.added);
  const removed = new Set(diff.removed);
  if (diff.removed.some(id => added.has(id))) {
    throw new ConvexError({ code: "RULE_DIFF_CONFLICT", message: "Aynı ilişki hem eklenemez hem çıkarılamaz." });
  }
  return [...new Set([...live.filter(id => !removed.has(id)), ...added])];
}

/** A legacy client cannot prove that a replacement came from a complete snapshot. */
export function assertLegacyRuleReplacement(counts: { members: number; devices: number; doors: number }): void {
  if (counts.members > RULE_DETAILS_MEMBER_LIMIT || counts.devices > RULE_DETAILS_RELATION_LIMIT || counts.doors > RULE_DETAILS_RELATION_LIMIT) {
    throw new ConvexError({ code: "RULE_MEMBERS_TRUNCATED", message: "Kuralın ilişki listesi bu eski düzenleyicinin sınırını aşıyor. Sayfayı yenileyip kuralı yeniden açın; hiçbir değişiklik kaydedilmedi." });
  }
}

/** Only scope/status changes need every surviving person's permissions refreshed. */
export function ruleDiffSyncPlan<T extends string>(args: {
  live: readonly T[];
  next: readonly T[];
  scopeChanged: boolean;
  settingsChanged: boolean;
  activeChanged: boolean;
  missingWeekPlan?: boolean;
}) {
  const { added, removed } = diffIds(args.live, args.next);
  return {
    added,
    removed,
    syncMembers: args.scopeChanged || args.activeChanged ? [...new Set(args.next)] : added,
    syncRule: args.scopeChanged || args.settingsChanged || args.activeChanged || (args.missingWeekPlan === true && added.length > 0),
    reconcileRoster: args.scopeChanged || args.activeChanged,
  };
}

/** Remove live stale door links while preserving explicit additions in this save. */
export function retainedDiffDoorIds<T extends string, D extends string>(
  next: readonly T[],
  doorDeviceById: ReadonlyMap<T, D | undefined>,
  removedDevices: ReadonlySet<D>,
  explicitlyAdded: ReadonlySet<T>,
): T[] {
  return next.filter(id => {
    const deviceId = doorDeviceById.get(id);
    return explicitlyAdded.has(id) || deviceId === undefined || !removedDevices.has(deviceId);
  });
}
