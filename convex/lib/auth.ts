import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * Kimliği doğrulanmış kullanıcıyı döndürür.
 * Kullanıcı yoksa hata fırlatır.
 */
export async function getCurrentUser(
  ctx: QueryCtx | MutationCtx
): Promise<Doc<"users">> {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new Error("Giriş yapmanız gerekiyor");
  }
  const user = await ctx.db.get(userId);
  if (!user) {
    throw new Error("Kullanıcı bulunamadı");
  }
  return user;
}

/**
 * Kimliği doğrulanmış kullanıcıyı döndürür veya null.
 */
export async function getCurrentUserOrNull(
  ctx: QueryCtx | MutationCtx
): Promise<Doc<"users"> | null> {
  const userId = await getAuthUserId(ctx);
  if (!userId) return null;
  return await ctx.db.get(userId);
}

/**
 * Kullanıcının erişebildiği proje ID'lerini döndürür.
 * super_admin tüm projelere erişir.
 */
export async function getProjectIdsForUser(
  ctx: QueryCtx | MutationCtx
): Promise<Id<"projects">[]> {
  const user = await getCurrentUser(ctx);

  if (user.role === "super_admin") {
    const projects = await ctx.db.query("projects").collect();
    return projects.map((p) => p._id);
  }

  const rows = await ctx.db
    .query("userProjects")
    .withIndex("by_user", (q) => q.eq("userId", user._id))
    .collect();

  return rows.map((r) => r.projectId);
}

/**
 * Admin yetkisi gerektirir (super_admin veya project_admin).
 * Yetkisiz kullanıcı için hata fırlatır.
 */
export async function requireAdmin(
  ctx: QueryCtx | MutationCtx
): Promise<Doc<"users">> {
  const user = await getCurrentUser(ctx);
  if (user.role !== "super_admin" && user.role !== "project_admin") {
    throw new Error("Bu işlem için yetkiniz yok");
  }
  return user;
}

/**
 * Sadece super_admin yetkisi gerektirir.
 */
export async function requireSuperAdmin(
  ctx: QueryCtx | MutationCtx
): Promise<Doc<"users">> {
  const user = await getCurrentUser(ctx);
  if (user.role !== "super_admin") {
    throw new Error("Bu işlem için süper admin yetkisi gerekli");
  }
  return user;
}

