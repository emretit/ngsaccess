import type { Id } from "../../../../convex/_generated/dataModel";
import {
  applySelectedDoorPlans,
  type PlanResult,
  type PlanKey,
} from "../doorPlanResult";
/** Toplu plan işleminde bir seferde en fazla kapı sayısı. */
export const MAX_BULK_DOORS = 50;
export type BulkResult = {
  doorId: Id<"doors">;
  saved: boolean;
  error?: string;
  plans: PlanResult[];
};
export async function applyBulkPlans(
  doorIds: Id<"doors">[],
  save: (doorId: Id<"doors">) => Promise<PlanKey[]>,
  apply: Record<
    PlanKey,
    (doorId: Id<"doors">) => Promise<{ ok: boolean; error?: string }>
  >,
  previous: BulkResult[] = [],
): Promise<BulkResult[]> {
  const ids = [...new Set(doorIds)];
  if (!ids.length || ids.length > MAX_BULK_DOORS)
    throw new Error(`Bir seferde 1–${MAX_BULK_DOORS} kapı seçin`);
  const results: BulkResult[] = [];
  for (const doorId of ids) {
    const old = previous.find((row) => row.doorId === doorId);
    let changed: PlanKey[] = [];
    try {
      if (!old?.saved) changed = await save(doorId);
    } catch (error) {
      results.push({
        doorId,
        saved: false,
        error: error instanceof Error ? error.message : "Kaydedilemedi",
        plans: [],
      });
      continue;
    }
    const keys: PlanKey[] = old?.saved
      ? old.plans.filter((plan) => !plan.ok).map((plan) => plan.key)
      : changed;
    const next = await applySelectedDoorPlans(
      keys,
      {
        status: () => apply.status(doorId),
        verify: () => apply.verify(doorId),
      },
      (error) => (error instanceof Error ? error.message : "Gönderilemedi"),
    );
    results.push({
      doorId,
      saved: true,
      plans: [
        ...(old?.plans.filter((plan) => !keys.includes(plan.key)) ?? []),
        ...next,
      ],
    });
  }
  return results;
}
export const bulkFailed = (row: BulkResult) =>
  !row.saved || row.plans.some((plan) => !plan.ok);
