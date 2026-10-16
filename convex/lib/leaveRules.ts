import type { Doc, Id } from "../_generated/dataModel";

export function canManageLeaves(role: Doc<"users">["role"]): boolean {
  return role === "super_admin" || role === "project_admin";
}

function requireLeaveAdmin(role: Doc<"users">["role"]): void {
  if (!canManageLeaves(role)) throw new Error("Bu işlem için yetkiniz yok");
}

export function approvedLeaveFields(user: Pick<Doc<"users">, "_id" | "role">) {
  requireLeaveAdmin(user.role);
  return { status: "approved" as const, approvedBy: user._id };
}

export function leaveDecisionPatch(
  role: Doc<"users">["role"],
  currentStatus: Doc<"leaves">["status"],
  status: "approved" | "rejected",
  approvedBy: Id<"users">,
  updatedAt: string,
  notes?: string,
) {
  requireLeaveAdmin(role);
  if (currentStatus !== "pending") throw new Error("Bu izin zaten sonuçlandırılmış");
  return {
    status,
    approvedBy,
    updatedAt,
    ...(notes !== undefined ? { notes } : {}),
  };
}
