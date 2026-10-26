import { v } from "convex/values";
import { internalMutation, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { limiter } from "./lib/rateLimit";
import { verifyUser } from "./lib/auth";
import { prepareVerificationToken } from "./lib/emailVerification";

/**
 * Self-signup sonrası e-posta doğrulama talebi.
 *
 * Convex Auth signUp anında oturum açtığı için auth token client'a anında
 * yerleşmeyebilir (race). Bu yüzden authed değil; email arg'ı alıp users'ı
 * email ile bulur. Çağıran AuthProvider.signUp, convexSignIn'den hemen sonra
 * bunu çağırır, ardından signOut eder.
 *
 * - firstCompanyName'i users'a yazar (ilk projeye dönüştürülecek)
 * - verified=false kullanıcı için doğrulama token'ı üretir (login guard'ı için)
 * - setupToken + tokenExpiresAt üretir
 * - doğrulama mailini tetikler (link: SITE_URL/verify-email?token=...)
 */
export const requestVerification = mutation({
  args: {
    email: v.string(),
  },
  // Tek tip yanıt — kullanıcı enumeration'ını önlemek için kullanıcının var olup
  // olmadığını / doğrulanmış olup olmadığını çağırana sızdırmıyoruz.
  returns: v.null(),
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();

    await limiter.limit(ctx, "emailVerify", { key: email, throws: true });

    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .first();

    // Kullanıcı yoksa veya zaten doğrulanmışsa: sessizce, aynı yanıtla çık.
    // (Enumeration sızıntısı yok; doğrulanmış kullanıcının token'ı sıfırlanmaz.)
    if (!user || user.verified !== false) {
      return null;
    }

    // verified=false, firstCompanyName signUp anında (auth.ts profile) yazıldı.
    // Burada yalnızca doğrulama token'ı üretip maili gönderiyoruz.
    const now = new Date();
    const tokenDecision = prepareVerificationToken(user, now.getTime());

    if (tokenDecision.shouldPersist) {
      await ctx.db.patch(user._id, {
        setupToken: tokenDecision.token,
        tokenExpiresAt: tokenDecision.expiresAt,
        updatedAt: now.toISOString(),
      });
    }

    await ctx.scheduler.runAfter(0, internal.actions.sendEmail.sendVerificationEmail, {
      to: email,
      token: tokenDecision.token,
      name: user.fullName ?? user.name,
    });

    return null;
  },
});

/**
 * Maildeki "Hesabı Doğrula" linki bu mutation'ı çağırır (token ile).
 * Token geçerliyse hesabı doğrular ve token'ı tüketir.
 */
export const verifyEmail = mutation({
  args: {
    token: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    email: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    if (!args.token) {
      throw new Error("Doğrulama linki geçersiz");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_setup_token", (q) => q.eq("setupToken", args.token))
      .first();

    if (!user) {
      throw new Error("Doğrulama linki geçersiz");
    }

    if (user.tokenExpiresAt && new Date(user.tokenExpiresAt) < new Date()) {
      throw new Error("EXPIRED: Doğrulama linkinin süresi dolmuş");
    }

    await verifyUser(ctx, user._id);

    return { success: true, email: user.email };
  },
});

/**
 * Süresi dolmuş e-posta doğrulama token'larını temizler.
 * Cron tarafından çağrılır (günlük).
 */
export const cleanupExpiredTokens = internalMutation({
  args: { cursor: v.optional(v.string()), runAt: v.optional(v.string()), batch: v.optional(v.number()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const runAt = args.runAt ?? new Date().toISOString();
    const batch = args.batch ?? 0;
    if (batch >= 20) return null;
    const page = await ctx.db.query("users")
      .withIndex("by_tokenExpiresAt", q => q.gt("tokenExpiresAt", "").lt("tokenExpiresAt", runAt))
      .paginate({ numItems: 200, cursor: args.cursor ?? null });
    for (const user of page.page) {
      await ctx.db.patch(user._id, { setupToken: undefined, tokenExpiresAt: undefined });
    }
    if (!page.isDone && batch + 1 < 20) {
      await ctx.scheduler.runAfter(0, internal.emailVerification.cleanupExpiredTokens, {
        cursor: page.continueCursor, runAt, batch: batch + 1,
      });
    }
    return null;
  },
});
