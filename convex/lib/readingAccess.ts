import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { getProjectIdsWithPermission, getUserPermissions, isSuperAdmin, PERMISSION_DENIED } from "./permissions";
import { resolveProjectScope } from "./projectScope";
import type { Permission } from "./roleCatalog";

export const REPORT_READING_PERMISSIONS = ["reports.view"] as const;
export const MONITORING_READING_PERMISSIONS = ["reports.view", "devices.manage"] as const;
export const VISITOR_READING_PERMISSIONS = ["reports.view", "devices.manage", "visitors.manage"] as const;
export const CARD_CAPTURE_PERMISSIONS = ["employees.manage", "visitors.manage", "devices.manage", "reports.view"] as const;

/** Explicit projects fail closed; unselected lists contain only authorized memberships. */
export async function resolveReadingScope(
  ctx: QueryCtx & { user: Doc<"users"> },
  projectId: Id<"projects"> | undefined,
  permissions: readonly Permission[],
): Promise<Id<"projects">[]> {
  const membershipScope = await resolveProjectScope(ctx, projectId);
  if (isSuperAdmin(ctx.user)) return membershipScope;
  if (projectId !== undefined) {
    if (!(await hasReadingPermission(ctx, projectId, permissions))) throw new Error(PERMISSION_DENIED);
    return membershipScope;
  }
  const permitted = new Set((await Promise.all(permissions.map(permission =>
    getProjectIdsWithPermission(ctx, ctx.user, permission)))).flat());
  return membershipScope.filter(id => permitted.has(id));
}

/** Redact embedded reading fields while keeping the parent resource accessible. */
export async function hasReadingPermission(
  ctx: QueryCtx & { user: Doc<"users"> },
  projectId: Id<"projects"> | undefined,
  permissions: readonly Permission[],
): Promise<boolean> {
  const granted = await getUserPermissions(ctx, ctx.user, projectId);
  return permissions.some(permission => granted.has(permission));
}
