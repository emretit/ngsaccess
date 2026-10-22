import bcrypt from "bcryptjs";
import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { mobileError } from "./mobileErrors";
import { employmentEnded } from "./employment";
import { trTodayKey } from "./trDate";

const BCRYPT_COST = 10;

export async function getCurrentEmployee(
  ctx: QueryCtx | MutationCtx,
  sessionToken: string
): Promise<Doc<"employees">> {
  const session = await ctx.db
    .query("employeeSessions")
    .withIndex("by_token", (q) => q.eq("token", sessionToken))
    .first();
  if (!session) throw mobileError("SESSION_INVALID");
  const expiresAt = Date.parse(session.expiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    throw mobileError("SESSION_EXPIRED");
  }
  const employee = await ctx.db.get(session.employeeId);
  if (!employee) throw mobileError("SESSION_INVALID");
  // İşten çıkış cron'u isActive'i kapatmadan önce de, kapattıktan sonra da aynı kod (mobil "İşten ayrıldınız").
  if (employmentEnded(employee, trTodayKey())) throw mobileError("EMPLOYMENT_ENDED");
  if (employee.isActive === false) throw mobileError("EMPLOYEE_INACTIVE");
  const auth = await ctx.db.query("employeeAuth")
    .withIndex("by_employee", (q) => q.eq("employeeId", employee._id))
    .first();
  // Legacy documents without versions remain valid only until the first
  // password write. New auth records start at 1, so old unversioned tokens
  // cannot regain access when a previously missing auth record is created.
  if (!auth?.passwordHash || (session.passwordVersion ?? 0) !== (auth.passwordVersion ?? 0)) {
    throw mobileError("SESSION_REVOKED");
  }
  return employee;
}

/** Password and revision are committed together; no unbounded session scan. */
export async function writeEmployeePassword(
  ctx: MutationCtx,
  auth: Doc<"employeeAuth">,
  passwordHash: string | undefined,
  changes: Partial<Omit<Doc<"employeeAuth">, "_id" | "_creationTime">> = {},
): Promise<void> {
  await ctx.db.patch(auth._id, {
    ...changes,
    passwordHash,
    passwordVersion: (auth.passwordVersion ?? 0) + 1,
    setupToken: undefined,
    tokenExpiresAt: undefined,
    updatedAt: new Date().toISOString(),
  });
}

export async function hashEmployeePassword(plain: string): Promise<string> {
  return bcrypt.hashSync(plain, BCRYPT_COST);
}

// Sync API kullanılıyor: Convex query/mutation environment'ında setTimeout
// yasak; bcryptjs.compare async sürümü setTimeout ile chunk yaptığı için
// "Can't use setTimeout in queries and mutations" hatası verir.
export async function verifyEmployeePassword(
  plain: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compareSync(plain, hash);
}
