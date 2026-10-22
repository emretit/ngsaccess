import type { QueryCtx } from "../_generated/server";
import { hasPermission, requirePermission } from "./permissions";
import type { Doc, Id } from "../_generated/dataModel";

export async function canManageLeaves(ctx: QueryCtx, user: Doc<"users">, projectId: Id<"projects"> | undefined): Promise<boolean> {
  return await hasPermission(ctx, user, projectId, "attendance.approve");
}

export async function approvedLeaveFields(ctx: QueryCtx, user: Doc<"users">, projectId: Id<"projects"> | undefined) {
  await requirePermission(ctx, user, projectId, "attendance.approve");
  return { status: "approved" as const, approvedBy: user._id };
}

export async function leaveDecisionPatch(
  ctx: QueryCtx,
  user: Doc<"users">,
  projectId: Id<"projects"> | undefined,
  currentStatus: Doc<"leaves">["status"],
  status: "approved" | "rejected",
  approvedBy: Id<"users">,
  updatedAt: string,
  notes?: string,
) {
  await requirePermission(ctx, user, projectId, "attendance.approve");
  if (currentStatus !== "pending") throw new Error("Bu izin zaten sonuçlandırılmış");
  return {
    status,
    approvedBy,
    updatedAt,
    ...(notes !== undefined ? { notes } : {}),
  };
}
