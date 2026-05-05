"use node";

import bcrypt from "bcryptjs";
import { action, internalAction } from "../_generated/server";
import { api, internal } from "../_generated/api";
import { v } from "convex/values";

const BCRYPT_COST = 10;
const MIN_PASSWORD_LENGTH = 8;

export const setEmployeePassword = action({
  args: {
    token: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    if (args.password.length < MIN_PASSWORD_LENGTH) {
      return { success: false, error: `Şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalı` };
    }

    const authRecord = await ctx.runQuery(api.employeeAuth.getByToken, {
      token: args.token,
    });

    if (!authRecord) {
      return { success: false, error: "Geçersiz veya süresi dolmuş token" };
    }

    if (authRecord.tokenExpiresAt && new Date(authRecord.tokenExpiresAt) < new Date()) {
      return { success: false, error: "Token süresi dolmuş" };
    }

    const passwordHash = await bcrypt.hash(args.password, BCRYPT_COST);

    await ctx.runMutation(api.employeeAuth.update, {
      authId: authRecord._id,
      passwordHash,
      setupToken: null,
      tokenExpiresAt: null,
    });

    return { success: true };
  },
});

/**
 * Dev/admin: e-posta ile çalışanın mobil şifresini setup mailine gerek kalmadan
 * doğrudan ayarlar. Sadece `npx convex run` üzerinden çağrılabilir.
 */
export const adminSetEmployeePassword = internalAction({
  args: {
    email: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    if (args.password.length < MIN_PASSWORD_LENGTH) {
      return { success: false, error: `Şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalı` };
    }

    const employee = await ctx.runQuery(internal.employees.getByEmailInternal, {
      email: args.email,
    });
    if (!employee) {
      return { success: false, error: `Çalışan bulunamadı: ${args.email}` };
    }

    const passwordHash = await bcrypt.hash(args.password, BCRYPT_COST);

    const existing = await ctx.runQuery(internal.employees.getAuthByEmployeeInternal, {
      employeeId: employee._id,
    });

    if (existing) {
      await ctx.runMutation(internal.employees.updateAuthPasswordInternal, {
        authId: existing._id,
        passwordHash,
      });
    } else {
      await ctx.runMutation(internal.employees.createAuthInternal, {
        employeeId: employee._id,
        projectId: employee.projectId,
        email: employee.email,
        passwordHash,
      });
    }

    return { success: true };
  },
});
