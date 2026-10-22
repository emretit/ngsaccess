import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { hasPermission } from "./permissions";

/** Mask response data using the row's project; never alter storage. */
export async function canSeePayInProject(ctx: Pick<QueryCtx, "db">, user: Doc<"users">, projectId: Id<"projects"> | undefined): Promise<boolean> {
  return await hasPermission(ctx, user, projectId, "pay.view");
}

export function maskPay<T>(value: T, canSee: boolean): T | null {
  return canSee ? value : null;
}

