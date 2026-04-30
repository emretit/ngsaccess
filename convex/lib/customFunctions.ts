import { customQuery, customMutation, customAction, customCtx } from "convex-helpers/server/customFunctions";
import { v } from "convex/values";
import { query, mutation, action } from "../_generated/server";
import { api } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { getCurrentUser, getCurrentUserOrNull } from "./auth";
import { getCurrentEmployee } from "./employeeAuth";

/**
 * Kimlik doğrulaması gerektiren query.
 * ctx.user otomatik olarak sağlanır.
 */
export const authedQuery = customQuery(
  query,
  customCtx(async (ctx) => {
    const user = await getCurrentUser(ctx);
    return { user };
  })
);

/**
 * Kimlik doğrulaması gerektiren mutation.
 * ctx.user otomatik olarak sağlanır.
 */
export const authedMutation = customMutation(
  mutation,
  customCtx(async (ctx) => {
    const user = await getCurrentUser(ctx);
    return { user };
  })
);

/**
 * Opsiyonel auth - kullanıcı varsa ctx.user, yoksa null.
 */
export const optionalAuthQuery = customQuery(
  query,
  customCtx(async (ctx) => {
    const user = await getCurrentUserOrNull(ctx);
    return { user };
  })
);

/**
 * Sadece super_admin veya project_admin için.
 */
export const adminQuery = customQuery(
  query,
  customCtx(async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (user.role !== "super_admin" && user.role !== "project_admin") {
      throw new Error("Bu işlem için yetkiniz yok");
    }
    return { user };
  })
);

/**
 * Sadece super_admin veya project_admin için mutation.
 */
export const adminMutation = customMutation(
  mutation,
  customCtx(async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (user.role !== "super_admin" && user.role !== "project_admin") {
      throw new Error("Bu işlem için yetkiniz yok");
    }
    return { user };
  })
);

/**
 * Sadece super_admin için mutation (kullanıcı yönetimi vb.).
 */
export const superAdminMutation = customMutation(
  mutation,
  customCtx(async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (user.role !== "super_admin") {
      throw new Error("Bu işlem için süper admin yetkisi gerekli");
    }
    return { user };
  })
);

/**
 * Kimlik doğrulaması gerektiren action.
 * Action context'te ctx.db yok, runQuery ile kullanıcı alınır.
 */
export const authedAction = customAction(
  action,
  customCtx(async (ctx): Promise<{ user: Doc<"users"> }> => {
    const user = await ctx.runQuery(api.users.currentUser, {}) as Doc<"users">;
    if (!user) throw new Error("Giriş yapmanız gerekiyor");
    return { user };
  })
);

/**
 * Mobil employee oturumu için query. Her çağrı `sessionToken` arg'ı ister
 * ve `ctx.employee`'yi enjekte eder. Web `users` tablosundan tamamen ayrıdır.
 */
export const employeeAuthedQuery = customQuery(query, {
  args: { sessionToken: v.string() },
  input: async (ctx, { sessionToken }) => {
    const employee = await getCurrentEmployee(ctx, sessionToken);
    return { ctx: { employee }, args: {} };
  },
});

/**
 * Mobil employee oturumu için mutation. Aynı sözleşme.
 */
export const employeeAuthedMutation = customMutation(mutation, {
  args: { sessionToken: v.string() },
  input: async (ctx, { sessionToken }) => {
    const employee = await getCurrentEmployee(ctx, sessionToken);
    return { ctx: { employee }, args: {} };
  },
});
