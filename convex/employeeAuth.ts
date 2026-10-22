import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { employeeAuthedMutation, employeeAuthedQuery } from "./lib/customFunctions";
import { hashEmployeePassword, verifyEmployeePassword, writeEmployeePassword } from "./lib/employeeAuth";
import { mobileErrorData } from "./lib/mobileErrors";
import { employmentEnded } from "./lib/employment";
import { trTodayKey } from "./lib/trDate";
import { getPasswordError } from "./lib/passwordPolicy";
import { limiter } from "./lib/rateLimit";
import type { Doc } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";

const SESSION_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const DUMMY_PASSWORD_HASH = "$2b$10$Jv3Xc1iFpPrOXqYPSpBzk.D/Xoqy1q3awkqS3sXEplBuTT5dYe.jW";

function generateSessionToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function employeeDepartment(ctx: QueryCtx, employee: Doc<"employees">): Promise<Doc<"departments"> | null> {
  if (!employee.projectId || !employee.departmentId) return null;
  const department = await ctx.db.get(employee.departmentId);
  return department?.projectId === employee.projectId ? department : null;
}

export const getByEmployee = internalQuery({
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
  returns: v.union(
    v.null(),
    v.object({
      tokenExpiresAt: v.optional(v.string()),
      email: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const authRecord = await ctx.db
      .query("employeeAuth")
      .withIndex("by_token", (q) => q.eq("setupToken", args.token))
      .first();
    return authRecord
      ? { tokenExpiresAt: authRecord.tokenExpiresAt, email: authRecord.email }
      : null;
  },
});

export const getByTokenInternal = internalQuery({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("employeeAuth")
      .withIndex("by_token", (q) => q.eq("setupToken", args.token))
      .first();
  },
});

// internalMutation: setup token / passwordHash yazar → public olarak açık kalırsa
// anonim caller hedef çalışanın e-postasını + token'ını ezip hesabı ele geçirir.
// Yalnızca yetkili action'lardan (sendEmployeeSetupEmail authedAction,
// setEmployeePassword token-guard'lı) internal çağrılır.
export const create = internalMutation({
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

export const update = internalMutation({
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
    const clean: Partial<Omit<Doc<"employeeAuth">, "_id" | "_creationTime">> = {
      updatedAt: new Date().toISOString(),
      ...(updates.email === undefined ? {} : { email: updates.email }),
      ...(updates.setupToken === undefined ? {} : { setupToken: updates.setupToken ?? undefined }),
      ...(updates.tokenExpiresAt === undefined ? {} : { tokenExpiresAt: updates.tokenExpiresAt ?? undefined }),
      ...(updates.lastLogin === undefined ? {} : { lastLogin: updates.lastLogin }),
    };
    if (updates.passwordHash !== undefined) {
      const auth = await ctx.db.get(authId);
      if (!auth) throw new Error("Çalışan kimlik kaydı bulunamadı");
      await writeEmployeePassword(ctx, auth, updates.passwordHash, clean);
    } else {
      await ctx.db.patch(authId, clean);
    }
  },
});

export const consumeSetupToken = internalMutation({
  args: { token: v.string(), passwordHash: v.string() },
  returns: v.union(
    v.object({ status: v.literal("invalid") }),
    v.object({ status: v.literal("expired") }),
    v.object({ status: v.literal("ok") }),
  ),
  handler: async (ctx, args) => {
    const auth = await ctx.db
      .query("employeeAuth")
      .withIndex("by_token", (q) => q.eq("setupToken", args.token))
      .first();
    if (!auth) return { status: "invalid" as const };
    if (!auth.tokenExpiresAt || !Number.isFinite(Date.parse(auth.tokenExpiresAt)) || Date.parse(auth.tokenExpiresAt) <= Date.now()) {
      return { status: "expired" as const };
    }

    await writeEmployeePassword(ctx, auth, args.passwordHash);
    return { status: "ok" as const };
  },
});

// Süre index'i yok: her günlük geçiş tabloyu 200 satırlık sayfalarla tarar.
// Filtreyi paginate sonrasında uygula; eşleşme az olsa da okuma maliyeti sınırlı kalsın.
export const cleanupExpiredSetupTokens = internalMutation({
  args: { cursor: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now();
    const page = await ctx.db.query("employeeAuth").paginate({
      numItems: 200,
      cursor: args.cursor ?? null,
    });
    for (const auth of page.page) {
      if (auth.tokenExpiresAt && Date.parse(auth.tokenExpiresAt) < now) {
        await ctx.db.patch(auth._id, {
          setupToken: undefined,
          tokenExpiresAt: undefined,
          updatedAt: new Date(now).toISOString(),
        });
      }
    }
    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.employeeAuth.cleanupExpiredSetupTokens, {
        cursor: page.continueCursor,
      });
    }
    return null;
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
  returns: v.union(v.object({
    token: v.string(),
    expiresAt: v.string(),
    employee: v.object({
      id: v.id("employees"),
      projectId: v.union(v.id("projects"), v.null()),
      projectName: v.union(v.string(), v.null()),
      firstName: v.string(),
      lastName: v.string(),
      email: v.string(),
      photoUrl: v.union(v.string(), v.null()),
      departmentId: v.union(v.id("departments"), v.null()),
      cardNumber: v.string(),
    }),
  }), v.object({ error: v.object({
    code: v.union(v.literal("INVALID_CREDENTIALS"), v.literal("RATE_LIMITED"), v.literal("EMPLOYMENT_ENDED")),
    message: v.string(),
    retryAfterMs: v.optional(v.number()),
  }) })),
  handler: async (ctx, args) => {
    const normalizedEmail = args.email.trim().toLowerCase();
    // Return expected failures: throwing would roll back the limiter write.
    const limit = await limiter.limit(ctx, "employeeSignIn", { key: normalizedEmail, throws: false });
    if (!limit.ok) {
      return { error: mobileErrorData("RATE_LIMITED", Math.max(1, Math.ceil(limit.retryAfter ?? 1))) };
    }
    const employee = await ctx.db
      .query("employees")
      .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
      .first();

    // İşten ayrılan (cron isActive'i kapatmış olsa da) EMPLOYMENT_ENDED alır, ama yalnız şifre
    // doğruysa: yanlış şifre genel hata kalır, hesabın durumu dışarı sızmaz.
    const ended = employee ? employmentEnded(employee, trTodayKey()) : false;
    if (!employee || (employee.isActive === false && !ended)) {
      await verifyEmployeePassword(args.password, DUMMY_PASSWORD_HASH);
      return { error: mobileErrorData("INVALID_CREDENTIALS") };
    }

    const auth = await ctx.db
      .query("employeeAuth")
      .withIndex("by_employee", (q) => q.eq("employeeId", employee._id))
      .first();

    if (!auth || !auth.passwordHash) {
      await verifyEmployeePassword(args.password, DUMMY_PASSWORD_HASH);
      return { error: mobileErrorData("INVALID_CREDENTIALS") };
    }

    const ok = await verifyEmployeePassword(args.password, auth.passwordHash);
    if (!ok) {
      return { error: mobileErrorData("INVALID_CREDENTIALS") };
    }
    if (ended) return { error: mobileErrorData("EMPLOYMENT_ENDED") };

    const department = await employeeDepartment(ctx, employee);
    const project = employee.projectId ? await ctx.db.get(employee.projectId) : null;
    const now = new Date();
    const token = generateSessionToken();
    const expiresAt = new Date(now.getTime() + SESSION_TTL_MS).toISOString();

    await ctx.db.insert("employeeSessions", {
      employeeId: employee._id,
      passwordVersion: auth.passwordVersion ?? 0,
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
        projectId: employee.projectId ?? null,
        projectName: project?.name ?? null,
        firstName: employee.firstName,
        lastName: employee.lastName,
        email: employee.email,
        photoUrl: employee.photoUrl ?? null,
        departmentId: department?._id ?? null,
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

/** Employee identity is supplied by the session wrapper, never a frontend ID. */
export const changePassword = employeeAuthedMutation({
  args: { currentPassword: v.string(), newPassword: v.string() },
  returns: v.union(
    v.object({ requiresSignIn: v.literal(true) }),
    v.object({ error: v.object({
      code: v.union(v.literal("INVALID_CREDENTIALS"), v.literal("RATE_LIMITED"), v.literal("PASSWORD_POLICY")),
      message: v.string(),
      retryAfterMs: v.optional(v.number()),
    }) }),
  ),
  handler: async (ctx, args) => {
    const limit = await limiter.limit(ctx, "employeePasswordChange", {
      key: ctx.employee._id,
      throws: false,
    });
    if (!limit.ok) {
      return { error: mobileErrorData("RATE_LIMITED", Math.max(1, Math.ceil(limit.retryAfter ?? 1))) };
    }
    // Ortak politika + bcrypt'in 72 bayt sınırı + mevcut şifreden farklılık.
    const policyError = getPasswordError(args.newPassword);
    if (policyError || new TextEncoder().encode(args.newPassword).length > 72 || args.newPassword === args.currentPassword) {
      return { error: {
        code: "PASSWORD_POLICY" as const,
        message: `${policyError ?? "Şifre politikası karşılanmıyor."} En fazla 72 UTF-8 bayt olmalı ve mevcut şifreden farklı olmalı.`,
      } };
    }
    const auth = await ctx.db.query("employeeAuth")
      .withIndex("by_employee", (q) => q.eq("employeeId", ctx.employee._id))
      .first();
    if (!auth?.passwordHash || !await verifyEmployeePassword(args.currentPassword, auth.passwordHash)) {
      return { error: mobileErrorData("INVALID_CREDENTIALS") };
    }
    const passwordHash = await hashEmployeePassword(args.newPassword);
    await writeEmployeePassword(ctx, auth, passwordHash);
    return { requiresSignIn: true as const };
  },
});

/**
 * Mobil bootstrap için: token geçerliyse oturumdaki çalışanın profilini döner.
 * `employeeAuthedQuery` `sessionToken` arg'ını otomatik ekler.
 */
export const me = employeeAuthedQuery({
  args: {},
  returns: v.object({
    id: v.id("employees"),
    projectId: v.union(v.id("projects"), v.null()),
    projectName: v.union(v.string(), v.null()),
    firstName: v.string(),
    lastName: v.string(),
    email: v.string(),
    photoUrl: v.union(v.string(), v.null()),
    departmentId: v.union(v.id("departments"), v.null()),
    departmentName: v.union(v.string(), v.null()),
    cardNumber: v.string(),
  }),
  handler: async (ctx) => {
    const employee = ctx.employee;
    const department = await employeeDepartment(ctx, employee);
    const project = employee.projectId ? await ctx.db.get(employee.projectId) : null;
    return {
      id: employee._id,
      projectId: employee.projectId ?? null,
      projectName: project?.name ?? null,
      firstName: employee.firstName,
      lastName: employee.lastName,
      email: employee.email,
      photoUrl: employee.photoUrl ?? null,
      departmentId: department?._id ?? null,
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
 * erişilemez. Her çağrı en fazla 100 kaydı okur; isDone false ise dönen
 * continueCursor sonraki çağrıya cursor olarak verilir. wiped sayfa sayacıdır.
 */
export const wipeLegacyHashes = internalMutation({
  args: { cursor: v.optional(v.string()) },
  returns: v.object({ wiped: v.number(), isDone: v.boolean(), continueCursor: v.string() }),
  handler: async (ctx, args) => {
    const page = await ctx.db.query("employeeAuth").paginate({ numItems: 100, cursor: args.cursor ?? null });
    let wiped = 0;
    for (const row of page.page) {
      if (row.passwordHash && !row.passwordHash.startsWith("$2")) {
        await writeEmployeePassword(ctx, row, undefined);
        wiped++;
      }
    }
    return { wiped, isDone: page.isDone, continueCursor: page.continueCursor };
  },
});
