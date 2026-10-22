import { accessBlockReason } from "./lib/accountAccess";
import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import { normalizeAuthEmail } from "./lib/authEmail";
import { getPasswordError } from "./lib/passwordPolicy";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  session: { totalDurationMs: 7 * 24 * 60 * 60 * 1000 },
  callbacks: {
    async beforeSessionCreation(ctx, { userId }) {
      const user = await ctx.db.get(userId);
      if (!user || accessBlockReason(user, Date.now()) !== null) {
        throw new Error("Giriş yapılamadı");
      }
    },
  },
  providers: [
    Password({
      // Yeni şifre (signUp / reset-verification) sunucuda da ortak kuralla doğrulanır; signIn'de çağrılmaz.
      validatePasswordRequirements(password) {
        const error = getPasswordError(password);
        if (error) throw new ConvexError(error);
      },
      // Hesap oluşturulurken (signUp) profile alanlarını yaz.
      //
      // GÜVENLİK: signUp public bir HTTP endpoint'tir. verified HER ZAMAN false
      // set edilir — companyName yokluğuna GÜVENİLMEZ. Aksi halde saldırgan
      // companyName'siz signUp atıp verified=undefined hesap alır, login guard'ını
      // (getCurrentUser: verified===false) atlar ve ensureProjectForNewUser ile
      // ilk proje üyeliğinde admin olur (authentication_bypass).
      //
      // verified=true'ya yükselten YALNIZCA güvenilir, doğrulanmış kanallardır:
      //   - Self-signup (Register): e-posta doğrulama → emailVerification.confirm
      //   - Davet (UserSetup):       davet token doğrulama → invites.consume
      //   - İlk-admin (AdminSetup):  setup secret doğrulama → users.initializeAdmin
      //
      // companyName (varsa) yalnızca firstCompanyName olarak saklanır; ilk projeye
      // dönüştürülür — verified ile ilgisi yok.
      //
      // NOT: "emailVerified" alan adı KULLANILAMAZ — Convex Auth onu profile()'dan
      // ayıklar (users.js: `{ emailVerified, ...profile }`) ve users'a yazmaz.
      profile(params) {
        const email = normalizeAuthEmail(params.email);
        const companyName =
          typeof params.companyName === "string"
            ? params.companyName.trim()
            : "";

        const profile: {
          email: string;
          name?: string;
          verified: boolean;
          firstCompanyName?: string;
        } = {
          email,
          verified: false,
        };
        if (typeof params.name === "string" && params.name.length > 0) {
          profile.name = params.name;
        }
        if (companyName.length > 0) {
          profile.firstCompanyName = companyName;
        }
        return profile;
      },
    }),
  ],
});
