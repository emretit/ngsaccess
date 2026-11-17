import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { auditSearchText } from "./auditSearch";
import { employeeAuditValues } from "./auditPrivacy";

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
  const values = args.targetTable === "employees"
    ? employeeAuditValues(args.oldValue, args.newValue, args.action)
    : { oldValue: args.oldValue, newValue: args.newValue };

  await ctx.db.insert("auditLog", {
    userId: args.user?._id,
    userName,
    searchText: auditSearchText({ ...args, ...values, userName: args.user?.fullName ?? args.user?.name }),
    projectId: args.projectId ?? undefined,
    action: args.action,
    targetTable: args.targetTable,
    targetId: args.targetId,
    ...values,
    note: args.note,
    timestamp: Date.now(),
  });
}
