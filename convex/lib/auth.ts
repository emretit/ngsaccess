import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { accessBlockReason } from "./accountAccess";
import { getAuthSessionId, getAuthUserId } from "@convex-dev/auth/server";

/**
 * JWT'deki kullanıcı kimliğini, JWT'nin işaret ettiği oturum hâlâ mevcutsa kabul eder.
 * Oturum silinince elde kalmış access token da sonraki istekte geçersiz olur.
 */
async function getValidAuthUser(
  ctx: QueryCtx | MutationCtx
): Promise<Doc<"users"> | null> {
  const userId = await getAuthUserId(ctx);
  if (!userId) return null;

  const sessionId = await getAuthSessionId(ctx);
  if (!sessionId) return null;

  const session = await ctx.db.get(sessionId);
  if (!session || session.userId !== userId || session.expirationTime <= Date.now()) return null;
  const user = await ctx.db.get(userId);
  if (user?.sessionsRevokedThrough !== undefined && session._creationTime <= user.sessionsRevokedThrough) return null;
  return user && accessBlockReason(user, Date.now()) === null ? user : null;
}

export async function getValidAuthUserId(ctx: QueryCtx | MutationCtx): Promise<Id<"users"> | null> {
  return (await getValidAuthUser(ctx))?._id ?? null;
}

/**
 * Kimliği doğrulanmış kullanıcıyı döndürür.
 * Kullanıcı yoksa hata fırlatır.
 */
export async function getCurrentUser(
  ctx: QueryCtx | MutationCtx
): Promise<Doc<"users">> {
  const user = await getValidAuthUser(ctx);
  if (!user) throw new Error("Giriş yapmanız gerekiyor");
  // Doğrulanmamış self-signup hesabı hiçbir korumalı veriye erişemez.
  // Eski kullanıcılar verified=undefined → engellenmez (yalnızca === false).
  // currentUser query'si erişim/oturum kontrolünü korur, verified kontrolünü atlar — AuthProvider
  // doğrulanmamış kullanıcıyı profile üzerinden tespit edip signOut eder.
  if (user.verified === false) {
    throw new Error("E-posta adresinizi doğrulamanız gerekiyor");
  }
  return user;
}

/**
 * Kimliği doğrulanmış kullanıcıyı döndürür veya null.
 */
export async function getCurrentUserOrNull(
  ctx: QueryCtx | MutationCtx
): Promise<Doc<"users"> | null> {
  return await getValidAuthUser(ctx);
}

/**
 * Kullanıcının erişebildiği proje ID'lerini döndürür.
 * super_admin tüm projelere erişir.
 */
export async function getProjectIdsForUser(
  ctx: (QueryCtx | MutationCtx) & { user?: Doc<"users"> | null }
): Promise<Id<"projects">[]> {
  // customFunctions has already validated this user in the same transaction.
  const user = ctx.user ?? await getCurrentUser(ctx);
  if (user.verified === false) {
    throw new Error("E-posta adresinizi doğrulamanız gerekiyor");
  }

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
 * bir projeye atanmalı).
 */
export function isProjectAllowed(
  allowed: ReadonlyArray<Id<"projects">>,
  projectId: Id<"projects"> | undefined,
): boolean {
  if (!projectId) return false;
  return allowed.some((id) => id === projectId);
}

/**
 * Çalışanın projesine erişim kararı (action'larda ctx.db yok → requireEmployeeAccess kullanılamaz).
 * requireEmployeeAccess ile aynı kural: projesiz (orphan) çalışana yalnız super_admin erişir.
 */
export function canAccessEmployeeProject(
  role: Doc<"users">["role"],
  allowed: ReadonlyArray<Id<"projects">>,
  projectId: Id<"projects"> | undefined,
): boolean {
  return role === "super_admin" || isProjectAllowed(allowed, projectId);
}

/**
 * Bir employeeId'ye erişim kontrolü. super_admin tüm employee'lere erişebilir;
 * diğer roller (project_admin, project_user) sadece üyesi oldukları projelerdeki employee'lere.
 * Projesiz (orphan) employee'ye yalnız super_admin erişir. Erişim yoksa hata fırlatır.
 * Çağıran handler `authedMutation`/`authedQuery` ctx'i kullanmalı (ctx.user mevcut).
 */
export async function requireEmployeeAccess(
  ctx: (QueryCtx | MutationCtx) & { user: Doc<"users"> },
  employeeId: Id<"employees">,
): Promise<Doc<"employees">> {
  const employee = await ctx.db.get(employeeId);
  if (!employee) throw new Error("Çalışan bulunamadı");
  if (ctx.user.role !== "super_admin") {
    const userProjects = await ctx.db
      .query("userProjects")
      .withIndex("by_user", (q) => q.eq("userId", ctx.user._id))
      .collect();
    if (!isProjectAllowed(userProjects.map((up) => up.projectId), employee.projectId)) {
      throw new Error("Bu çalışanın projesine erişim yetkiniz yok");
    }
  }
  return employee;
}

/**
 * Kullanıcıyı doğrulanmış olarak işaretler ve token'ı temizler.
 * emailVerification, invites ve users.initializeAdmin — 3 güvenilir kanal — bunu çağırır.
 */
export async function verifyUser(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<void> {
  await ctx.db.patch(userId, {
    verified: true,
    setupToken: undefined,
    tokenExpiresAt: undefined,
    updatedAt: new Date().toISOString(),
  });
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

