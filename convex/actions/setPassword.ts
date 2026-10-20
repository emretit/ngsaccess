"use node";

import bcrypt from "bcryptjs";
import { getPasswordError } from "../lib/passwordPolicy";
import { action, internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";

const BCRYPT_COST = 10;

export const setEmployeePassword = action({
  args: {
    token: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    const passwordError = getPasswordError(args.password);
    if (passwordError) {
      return { success: false, error: passwordError };
    }

    // Ucuz ön kontrol: geçersiz token bcrypt maliyeti yaratmasın. Nihai karar
    // consumeSetupToken'da (oku + tüket tek mutation'da, atomik).
    const authRecord = await ctx.runQuery(internal.employeeAuth.getByTokenInternal, {
      token: args.token,
    });
    if (!authRecord) {
      return { success: false, error: "Geçersiz veya süresi dolmuş token" };
    }

    const passwordHash = await bcrypt.hash(args.password, BCRYPT_COST);
    const result = await ctx.runMutation(internal.employeeAuth.consumeSetupToken, {
      token: args.token,
      passwordHash,
    });

    if (result.status === "invalid") {
      return { success: false, error: "Geçersiz veya süresi dolmuş token" };
    }
    if (result.status === "expired") {
      return { success: false, error: "Token süresi dolmuş" };
    }

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
    const passwordError = getPasswordError(args.password);
    if (passwordError) {
      return { success: false, error: passwordError };
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
