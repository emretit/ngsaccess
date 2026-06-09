import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      // Hesap oluşturulurken (signUp) profile alanlarını yaz.
      //
      // GÜVENLİK: signUp public bir HTTP endpoint'tir. verified HER ZAMAN false
      // set edilir — companyName yokluğuna GÜVENİLMEZ. Aksi halde saldırgan
      // companyName'siz signUp atıp verified=undefined hesap alır, login guard'ını
      // (getCurrentUser: verified===false) atlar ve ensureProjectForNewUser ile
      // otomatik project_admin olur (authentication_bypass).
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
          email: params.email as string,
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
