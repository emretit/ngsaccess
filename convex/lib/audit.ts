import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { auditSearchText } from "./auditSearch";

type AuditAction = "create" | "update" | "delete";

interface WriteAuditArgs {
  user: Doc<"users"> | null;
  projectId?: Id<"projects"> | null;
  action: AuditAction;
  targetTable: string;
  targetId: string;
  oldValue?: unknown;
  newValue?: unknown;
  note?: string;
}

export async function writeAudit(
  ctx: MutationCtx,
  args: WriteAuditArgs
): Promise<void> {
  const userName =
    args.user?.fullName ?? args.user?.name ?? args.user?.email ?? undefined;

  await ctx.db.insert("auditLog", {
    userId: args.user?._id,
    userName,
    searchText: auditSearchText({ ...args, userName: args.user?.fullName ?? args.user?.name }),
    projectId: args.projectId ?? undefined,
    action: args.action,
    targetTable: args.targetTable,
    targetId: args.targetId,
    oldValue: args.oldValue,
    newValue: args.newValue,
    note: args.note,
    timestamp: Date.now(),
  });
}
