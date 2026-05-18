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

/**
 * Kaynak (cihaz, çalışan, kural) caller'ın eriştiği projelerden birine aitse true.
 * projectId undefined → false (legacy "global kayıt" konsepti kaldırıldı; orphan kayıt
 * `migrations/projectIdBackfill` ile bir projeye atanmalı).
 */
export function isProjectAllowed(
  allowed: ReadonlyArray<Id<"projects">>,
  projectId: Id<"projects"> | undefined,
): boolean {
  if (!projectId) return false;
  return allowed.some((id) => id === projectId);
}

/**
 * Bir employeeId'ye erişim kontrolü. super_admin tüm employee'lere erişebilir;
 * project_admin sadece kendi projesindeki employee'lere. Erişim yoksa hata fırlatır.
 * Çağıran handler `authedMutation`/`authedQuery` ctx'i kullanmalı (ctx.user mevcut).
 */
export async function requireEmployeeAccess(
  ctx: (QueryCtx | MutationCtx) & { user: Doc<"users"> },
  employeeId: Id<"employees">,
): Promise<Doc<"employees">> {
  const employee = await ctx.db.get(employeeId);
  if (!employee) throw new Error("Çalışan bulunamadı");
  if (ctx.user.role === "project_admin" && employee.projectId) {
    const userProjects = await ctx.db
      .query("userProjects")
      .withIndex("by_user", (q) => q.eq("userId", ctx.user._id))
      .collect();
    if (!userProjects.some((up) => up.projectId === employee.projectId)) {
      throw new Error("Bu çalışanın projesine erişim yetkiniz yok");
    }
  }
  return employee;
}

/**
 * ADMIN_SETUP_SECRET env değişkeni ile gated maintenance/migration mutation'ları için.
 * Constant-time karşılaştırma timing attack engelliyor.
 */
export function requireSetupSecret(provided: string): void {
  const expected = process.env.ADMIN_SETUP_SECRET;
  if (!expected) {
    throw new Error("Setup secret tanımlı değil");
  }
  const a = new TextEncoder().encode(provided);
  const b = new TextEncoder().encode(expected);
  if (a.length !== b.length) {
    throw new Error("Geçersiz gizli kod");
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  if (diff !== 0) {
    throw new Error("Geçersiz gizli kod");
  }
}

