import bcrypt from "bcryptjs";
import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";

const BCRYPT_COST = 10;

export async function getCurrentEmployee(
  ctx: QueryCtx | MutationCtx,
  sessionToken: string
): Promise<Doc<"employees">> {
  const session = await ctx.db
    .query("employeeSessions")
    .withIndex("by_token", (q) => q.eq("token", sessionToken))
    .first();
  if (!session) throw new Error("Oturum geçersiz");
  if (new Date(session.expiresAt) < new Date()) {
    throw new Error("Oturum süresi doldu");
  }
  const employee = await ctx.db.get(session.employeeId);
  if (!employee) throw new Error("Çalışan bulunamadı");
  if (employee.isActive === false) throw new Error("Çalışan aktif değil");
  return employee;
}

export async function hashEmployeePassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

export async function verifyEmployeePassword(
  plain: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
