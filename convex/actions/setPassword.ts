"use node";

import { action } from "../_generated/server";
import { api } from "../_generated/api";
import { v } from "convex/values";

export const setEmployeePassword = action({
  args: {
    token: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    const authRecord = await ctx.runQuery(api.employeeAuth.getByToken, {
      token: args.token,
    });

    if (!authRecord) {
      return { success: false, error: "Geçersiz veya süresi dolmuş token" };
    }

    if (authRecord.tokenExpiresAt && new Date(authRecord.tokenExpiresAt) < new Date()) {
      return { success: false, error: "Token süresi dolmuş" };
    }

    // Basit hash - production'da bcrypt gibi bir kütüphane kullanın
    const encoder = new TextEncoder();
    const data = encoder.encode(args.password);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const passwordHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    await ctx.runMutation(api.employeeAuth.update, {
      authId: authRecord._id,
      passwordHash,
      setupToken: undefined,
      tokenExpiresAt: undefined,
    });

    return { success: true };
  },
});
