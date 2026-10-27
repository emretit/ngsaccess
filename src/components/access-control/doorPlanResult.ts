import { z } from "zod";
import type { FunctionReturnType } from "convex/server";
import type { api } from "../../../convex/_generated/api";

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Saati HH:mm biçiminde girin.");
export const doorPlanTimeSchema = z.object({
  beginTime: time,
  endTime: time,
}).refine((plan) => plan.beginTime < plan.endTime, {
  message: "Başlangıç saati bitiş saatinden önce olmalıdır.",
  path: ["endTime"],
});

export type PlanKey = "status" | "verify";
type ApplyResult = FunctionReturnType<typeof api.actions.hikGatewayDevice.applyDoorStatusPlan>;
export type PlanResult = ApplyResult & { key: PlanKey };

/** Her plan bağımsız sonuçlanır; yalnız istenen planlar gönderilir. */
export async function applySelectedDoorPlans(
  keys: PlanKey[],
  actions: Record<PlanKey, () => Promise<ApplyResult>>,
  messageForError: (error: unknown) => string,
): Promise<PlanResult[]> {
  return Promise.all(keys.map(async (key) => {
    try {
      return { key, ...await actions[key]() };
    } catch (error: unknown) {
      return { key, ok: false, error: messageForError(error) };
    }
  }));
}

/** Boş gönderim, cihaza uygulanmış bir plan değildir. */
export function allDoorPlansApplied(results: PlanResult[]): boolean {
  return results.length > 0 && results.every((result) => result.ok);
}
