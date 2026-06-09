import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { limiter } from "./lib/rateLimit";

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 saat

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
    const token = crypto.randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + TOKEN_TTL_MS).toISOString();

    await ctx.db.patch(user._id, {
      setupToken: token,
      tokenExpiresAt: expiresAt,
      updatedAt: now.toISOString(),
    });

    await ctx.scheduler.runAfter(0, internal.actions.sendEmail.sendVerificationEmail, {
      to: email,
      token,
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
      throw new Error("Doğrulama linkinin süresi dolmuş");
    }

    await ctx.db.patch(user._id, {
      verified: true,
      setupToken: undefined,
      tokenExpiresAt: undefined,
      updatedAt: new Date().toISOString(),
    });

    return { success: true, email: user.email };
  },
});
