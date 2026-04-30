import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { employeeAuthedQuery } from "./lib/customFunctions";
import { verifyEmployeePassword } from "./lib/employeeAuth";

const SESSION_TTL_MS = 90 * 24 * 60 * 60 * 1000;

function generateSessionToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const getByEmployee = query({
  args: { employeeId: v.id("employees") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("employeeAuth")
      .withIndex("by_employee", (q) => q.eq("employeeId", args.employeeId))
      .first();
  },
});

export const getByToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("employeeAuth")
      .withIndex("by_token", (q) => q.eq("setupToken", args.token))
      .first();
  },
});

export const create = mutation({
  args: {
    employeeId: v.id("employees"),
    projectId: v.optional(v.id("projects")),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    setupToken: v.optional(v.string()),
    tokenExpiresAt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    return await ctx.db.insert("employeeAuth", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    authId: v.id("employeeAuth"),
    email: v.optional(v.string()),
    passwordHash: v.optional(v.string()),
    setupToken: v.optional(v.union(v.string(), v.null())),
    tokenExpiresAt: v.optional(v.union(v.string(), v.null())),
    lastLogin: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { authId, ...updates } = args;
    const clean: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    for (const [k, val] of Object.entries(updates)) {
      if (val !== undefined) clean[k] = val === null ? undefined : val;
    }
    await ctx.db.patch(authId, clean);
  },
});

/**
 * Mobil giriş. `users` tablosuna ve Convex Auth'a tamamen bağımsızdır.
 * Email + şifre `employees` + `employeeAuth.passwordHash` üzerinden doğrulanır.
 * Başarılıysa yeni bir `employeeSessions` token'ı döner.
 */
export const signIn = mutation({
  args: {
    email: v.string(),
    password: v.string(),
  },
  returns: v.object({
    token: v.string(),
    expiresAt: v.string(),
    employee: v.object({
      id: v.id("employees"),
      firstName: v.string(),
      lastName: v.string(),
      email: v.string(),
      photoUrl: v.union(v.string(), v.null()),
      departmentId: v.union(v.id("departments"), v.null()),
      cardNumber: v.string(),
    }),
  }),
  handler: async (ctx, args) => {
    const normalizedEmail = args.email.trim().toLowerCase();
    const employee = await ctx.db
      .query("employees")
      .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
      .first();

    if (!employee || employee.isActive === false) {
      throw new Error("E-posta veya şifre hatalı");
    }

    const auth = await ctx.db
      .query("employeeAuth")
      .withIndex("by_employee", (q) => q.eq("employeeId", employee._id))
      .first();

    if (!auth || !auth.passwordHash) {
      throw new Error(
        "Mobil şifreniz henüz kurulmamış. Yöneticinizden kurulum bağlantısı isteyin."
      );
    }

    const ok = await verifyEmployeePassword(args.password, auth.passwordHash);
    if (!ok) {
      throw new Error("E-posta veya şifre hatalı");
    }

    const now = new Date();
    const token = generateSessionToken();
    const expiresAt = new Date(now.getTime() + SESSION_TTL_MS).toISOString();

    await ctx.db.insert("employeeSessions", {
      employeeId: employee._id,
      token,
      expiresAt,
      createdAt: now.toISOString(),
      lastUsedAt: now.toISOString(),
    });

    await ctx.db.patch(auth._id, {
      lastLogin: now.toISOString(),
      updatedAt: now.toISOString(),
    });

    return {
      token,
      expiresAt,
      employee: {
        id: employee._id,
        firstName: employee.firstName,
        lastName: employee.lastName,
        email: employee.email,
        photoUrl: employee.photoUrl ?? null,
        departmentId: employee.departmentId ?? null,
        cardNumber: employee.cardNumber,
      },
    };
  },
});

/**
 * Mobil oturumu sonlandırır. Token bulunmazsa sessizce başarılı sayılır.
 */
export const signOut = mutation({
  args: { sessionToken: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("employeeSessions")
      .withIndex("by_token", (q) => q.eq("token", args.sessionToken))
      .first();
    if (session) {
      await ctx.db.delete(session._id);
    }
    return null;
  },
});

/**
 * Mobil bootstrap için: token geçerliyse oturumdaki çalışanın profilini döner.
 * `employeeAuthedQuery` `sessionToken` arg'ını otomatik ekler.
 */
export const me = employeeAuthedQuery({
  args: {},
  handler: async (ctx) => {
    const employee = ctx.employee;
    const department = employee.departmentId
      ? await ctx.db.get(employee.departmentId)
      : null;
    return {
      id: employee._id,
      firstName: employee.firstName,
      lastName: employee.lastName,
      email: employee.email,
      photoUrl: employee.photoUrl ?? null,
      departmentId: employee.departmentId ?? null,
      departmentName: department?.name ?? null,
      cardNumber: employee.cardNumber,
    };
  },
});

/**
 * Migration: Eski salt'sız SHA-256 (64-hex) password hash'lerini siler.
 * bcrypt hash'leri "$2" ile başlar; SHA-256 başlamaz. Etkilenen çalışanlara
 * admin panelinden yeniden mobil setup maili gönderilmeli.
 *
 * `internalMutation` — sadece `npx convex run` ile çalıştırılır, public client'tan
 * erişilemez. Tek seferlik migration için ideal.
 */
export const wipeLegacyHashes = internalMutation({
  args: {},
  returns: v.object({ wiped: v.number() }),
  handler: async (ctx) => {
    const all = await ctx.db.query("employeeAuth").collect();
    let wiped = 0;
    const now = new Date().toISOString();
    for (const row of all) {
      if (row.passwordHash && !row.passwordHash.startsWith("$2")) {
        await ctx.db.patch(row._id, {
          passwordHash: undefined,
          updatedAt: now,
        });
        wiped++;
      }
    }
    return { wiped };
  },
});
