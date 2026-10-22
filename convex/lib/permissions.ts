import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { accessBlockReason } from "./accountAccess";
import { getProjectIdsForUser } from "./auth";
import {
  LOCKED_ROLE,
  PERMISSIONS,
  ROLE_DEFAULTS,
  legacyRoleToProjectRole,
  normalizeRolePermissions,
  type Permission,
  type ProjectRole,
} from "./roleCatalog";

/**
 * Proje bazlı yetki kararları (docs/roles/PLAN.md). Rol = userProjects.role (yoksa users.role'den
 * türetilir); yetki seti = projectRolePermissions satırı (yoksa ROLE_DEFAULTS). super_admin her projede
 * her yetkiye sahiptir; projesiz (orphan) kayıtta yalnız super_admin geçer.
 */

type DbCtx = Pick<QueryCtx, "db">;
type RoleUser = Pick<Doc<"users">, "_id" | "role">;

export const PERMISSION_DENIED = "Bu işlem için yetkiniz yok";

export function isSuperAdmin(user: Pick<Doc<"users">, "role">): boolean {
  return user.role === "super_admin";
}

/** Üyeliğin etkin rolü: kayıtlı rol, yoksa kullanıcının eski global rolünden türetilen. */
export function membershipRole(user: Pick<Doc<"users">, "role">, membership: Pick<Doc<"userProjects">, "role">): ProjectRole {
  return membership.role ?? legacyRoleToProjectRole(user.role);
}

export async function getMembership(
  ctx: DbCtx,
  userId: Id<"users">,
  projectId: Id<"projects">,
): Promise<Doc<"userProjects"> | null> {
  const rows = await ctx.db
    .query("userProjects")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .take(1000);
  return rows.find((row) => row.projectId === projectId) ?? null;
}

/** Kullanıcının projedeki rolü; üye değilse null. super_admin için de üyeliğe bakar (platform rolü ayrı). */
export async function getProjectRole(
  ctx: DbCtx,
  user: RoleUser,
  projectId: Id<"projects">,
): Promise<ProjectRole | null> {
  const membership = await getMembership(ctx, user._id, projectId);
  return membership ? membershipRole(user, membership) : null;
}

export async function getRolePermissions(
  ctx: DbCtx,
  projectId: Id<"projects">,
  role: ProjectRole,
): Promise<ReadonlySet<Permission>> {
  if (role === LOCKED_ROLE) return new Set(PERMISSIONS);
  const row = await ctx.db
    .query("projectRolePermissions")
    .withIndex("by_projectId_and_role", (q) => q.eq("projectId", projectId).eq("role", role))
    .unique();
  return new Set(row ? normalizeRolePermissions(role, row.permissions) : ROLE_DEFAULTS[role]);
}

/** Kullanıcının projedeki etkin yetkileri (super_admin → hepsi; üye değil → boş). */
export async function getUserPermissions(
  ctx: DbCtx,
  user: RoleUser,
  projectId: Id<"projects"> | null | undefined,
): Promise<ReadonlySet<Permission>> {
  if (isSuperAdmin(user)) return new Set(PERMISSIONS);
  if (!projectId) return new Set();
  const role = await getProjectRole(ctx, user, projectId);
  return role ? await getRolePermissions(ctx, projectId, role) : new Set();
}

export async function hasPermission(
  ctx: DbCtx,
  user: RoleUser,
  projectId: Id<"projects"> | null | undefined,
  permission: Permission,
): Promise<boolean> {
  return (await getUserPermissions(ctx, user, projectId)).has(permission);
}

/** Yetki yoksa throw eder. `message` mevcut hata metnini korumak için verilebilir. */
export async function requirePermission(
  ctx: DbCtx,
  user: RoleUser,
  projectId: Id<"projects"> | null | undefined,
  permission: Permission,
  message: string = PERMISSION_DENIED,
): Promise<void> {
  if (!(await hasPermission(ctx, user, projectId, permission))) throw new Error(message);
}

/** Liste sorguları için: kullanıcının `permission` yetkisine sahip olduğu projeler. */
export async function getProjectIdsWithPermission(
  ctx: (QueryCtx | MutationCtx) & { user?: Doc<"users"> | null },
  user: Doc<"users">,
  permission: Permission,
): Promise<Id<"projects">[]> {
  if (isSuperAdmin(user)) return await getProjectIdsForUser({ ...ctx, user });
  const memberships = await ctx.db
    .query("userProjects")
    .withIndex("by_user", (q) => q.eq("userId", user._id))
    .take(1000);
  const allowed: Id<"projects">[] = [];
  for (const membership of memberships) {
    if (allowed.includes(membership.projectId)) continue;
    const permissions = await getRolePermissions(ctx, membership.projectId, membershipRole(user, membership));
    if (permissions.has(permission)) allowed.push(membership.projectId);
  }
  return allowed;
}

/** Projede (excludeUserId hariç) etkin müşteri yöneticisi var mı; son yöneticiyi düşürme/silme engeli için. */
export async function hasOtherActiveAdmin(
  ctx: DbCtx,
  projectId: Id<"projects">,
  excludeUserId?: Id<"users">,
): Promise<boolean> {
  const memberships = await ctx.db
    .query("userProjects")
    .withIndex("by_project", (q) => q.eq("projectId", projectId));
  for await (const membership of memberships) {
    if (membership.userId === excludeUserId) continue;
    const member = await ctx.db.get(membership.userId);
    if (member && !isSuperAdmin(member) && accessBlockReason(member, Date.now()) === null && membershipRole(member, membership) === "admin") return true;
  }
  return false;
}
