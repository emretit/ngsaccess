# W3a — Yönetici 2FA + Dondurma / Bitiş Tarihi — Tasarım (Claude)

> Salt-okuma tasarımı. Kanıtlar `dosya:satır`; `nm/` = `node_modules/@convex-dev/auth/dist/` (sürüm **0.0.96**,
> `package.json:29`, kurulu `nm/../package.json` "0.0.96"). Doğrulanamayanlar **[teyit]**.

## Özet karar
- **Öneri: (b) iki adımlı `ConvexCredentials` provider'ı + `beforeSessionCreation` kilidi.** Kod doğrulanmadan
  oturum (authSessions satırı) hiç oluşmaz → JWT yok → yarım-doğrulanmış oturumla bypass yolu yok.
- MFA gereken kullanıcı için varsayılan oturum açma yolu (`createSession`) **her zaman reddedilir**; tek giriş yolu
  OTP'yi tüketen mutation'ın kendi açtığı oturumdur. Böylece düz `signIn("password")` çağrısıyla 2FA atlanamaz.
- Dondurma/bitiş: tek kontrol noktası `getValidAuthUserId` (bütün korumalı yollar oradan geçiyor) + `beforeSessionCreation`
  + dondurulunca oturum silme. Cron yok.

## §1 2FA mimarisi — karşılaştırma

### Kodda doğrulanan temel gerçekler
- Credentials akışı: `authorize()` → `{userId, sessionId?}` → `callSignIn` (`nm/server/implementation/signIn.js:102-115`).
  `sessionId` dönerse Convex Auth yeni oturum açmaz, verilen oturuma token üretir (`nm/.../mutations/signIn.js:12-14`).
- `beforeSessionCreation(ctx,{userId})` yalnız yeni oturum oluşturulurken çağrılır, throw = giriş reddi
  (`nm/server/implementation/sessions.js:41`, tip: `nm/server/types.d.ts:181-207`).
- Refresh akışı `beforeSessionCreation`'ı **çağırmaz**; yalnız refresh token + oturum satırının varlığı/süresine bakar
  (`nm/.../mutations/refreshSession.js:18-30`, `nm/.../refreshTokens.js:90-100`). → Dondurmada oturum silmek şart.
- Her istekte oturum satırı zaten okunuyor: `getValidAuthUserId` (`convex/lib/auth.ts:9-22`). Oturum silinince
  elde kalan JWT de sonraki istekte geçersiz.
- `retrieveAccount` Scrypt doğrulaması + hesap başına saatte 10 hatalı deneme sınırı içerir
  (`nm/.../mutations/retrieveAccountWithCredentials.js:22-34`, `nm/.../rateLimit.js:1`), hata türleri string
  (`InvalidAccountId` / `InvalidSecret` / `TooManyFailedAttempts`) olarak fırlatılır (`nm/server/implementation/index.js:373-379`).
- Password `verify` seçeneği yalnız `!account.emailVerified` iken devreye girer (`nm/providers/Password.js:150-155`).

| | (a) Oturum aç + "MFA bekliyor" | (b) İki adımlı provider (ÖNERİ) | (c) Yerleşik Password `verify`/Email |
|---|---|---|---|
| Bypass riski | Orta-yüksek: JWT kod girilmeden geçerli; `getAuthUserId`'yi doğrudan çağıran her yeni kod, HTTP action `ctx.auth`, `authedAction` (→ `users.currentUser` → guard'sız `getCurrentUserOrNull`, `customFunctions.ts:104-110`, `users.ts:27-34`) atlatabilir | Düşük: kod tüketilmeden oturum yok; MFA kullanıcısı için `createSession` her zaman throw | — |
| Refresh token | Bekleyen oturuma da 30 gün refresh token verilir; durum tablosu oturumla senkron tutulmalı | Oturum yalnız OTP sonrası doğar; refresh normal | — |
| Action/HTTP | Hepsi ayrıca gate'lenmeli | Ek iş yok | — |
| Guard değişikliği | Tüm guard + istemci (`AuthProvider` "orphan" mantığı oturum açık/profil null'ı çıkış sayar, `AuthProvider.tsx:124-147`) | Guard'a dokunmaz (yalnız dondurma için) | — |
| Sürüm uyumu | Ok | `ConvexCredentials`, `retrieveAccount`, `beforeSessionCreation` 0.0.96'da var | `verify` tek seferlik e-posta doğrulaması; doğrulandıktan sonra bir daha sormaz → 2FA DEĞİL. Email provider tek başına şifresiz giriş. **Elendi** |

`Password` config'inde `...config` yayılımıyla (`nm/providers/Password.js:168`) `authorize` ezilebilir ama belgelenmemiş → kullanılmaz.

### Önerilen akış (b)
1. **Adım 1 — `signIn("password-mfa", {step:"start", email, password})`** (yeni provider, `convex/auth.ts`):
   - `normalizeAuthEmail` → `retrieveAccount(ctx,{provider:"password", account:{id,secret}})`. Her hata yakalanıp tek tip
     `ConvexError({code:"INVALID_CREDENTIALS"})` atılır (canlı deployment *dev* olduğu için ham hata metni istemciye gidebilir **[teyit]**).
   - Hesap yoksa zamanlama eşitlemek için sahte Scrypt doğrulaması (`lucia` Scrypt, Password ile aynı; `nm/providers/Password.js:27`).
   - `runQuery(internal.authMfa.loginPolicy,{userId})` → `blocked` ise genel hata; `mfaRequired=false` ise `return {userId}`
     (normal oturum; `beforeSessionCreation` yine kontrol eder).
   - `mfaRequired` ise `runMutation(internal.authMfa.createChallenge)` → kodu e-postayla gönder (aşağıda) →
     `throw ConvexError({code:"MFA_REQUIRED", challengeToken, maskedEmail})`. Challenge kaydı ayrı mutation'da commit edildiği
     için throw onu geri almaz. İstemci `signIn` hatası olarak alır **[teyit: `@convex-dev/auth/react` ConvexError.data'yı korur]**.
2. **Adım 2 — `signIn("password-mfa", {step:"verify", challengeToken, code})`**: `runMutation(internal.authMfa.verifyChallenge)`
   tek transaction'da: challenge'ı bul (token hash), süre/deneme/tüketilmiş kontrolü, kod HMAC karşılaştırma (sabit zamanlı),
   kullanıcının dondurulmuş/süresi dolmuş olmadığını kontrol, `consumedAt` yaz, **`authSessions` satırını kendisi ekler**
   (`{userId, expirationTime: now + (AUTH_SESSION_TOTAL_DURATION_MS || 30g)}`; varsayılan 30g `nm/.../sessions.js:4,42-46`)
   → `{ok:true,userId,sessionId}`. Hatada `attempts++` commit edilir ve `{ok:false}` döner (throw değil; aksi halde sayaç geri alınır).
   `authorize` `{userId, sessionId}` döner → Convex Auth yalnız token üretir.
3. **`callbacks.beforeSessionCreation`**: `accessBlockReason(user)` ≠ null → throw; `isMfaRequired(user)` → throw
   `"MFA_REQUIRED"`. Düz `Password` signIn, ileride eklenecek OAuth vb. hepsi MFA kullanıcısında reddedilir.
   signUp ile yeni açılan hesapta rol yok → MFA gerekmez (AdminSetup/UserSetup kırılmaz).
4. **E-posta gönderimi**: `sendResendEmail` (`convex/actions/sendEmail.ts:16-60`) yalnız `fetch` kullanıyor; `"use node"`
   gerektirmeyen `convex/lib/resendClient.ts`'e taşınır ve `authorize` içinden doğrudan çağrılır. Kod scheduler argümanına
   **yazılmaz** (`_scheduled_functions`'da düz metin kalırdı). Gönderen = sistem Resend adresi; proje `mailSettings` kullanılmaz.
5. **Yeniden gönder — `step:"resend", challengeToken`**: yeni kod üretir, deneme sayacı sıfırlanmaz.

## §2 OTP kuralları
- **Kod**: 6 hane, `crypto.getRandomValues` + rejection sampling (mod yanlılığı yok). Kullanıcıya görünen metin Türkçe.
- **Saklama**: `codeHash = HMAC-SHA256(AUTH_MFA_PEPPER, challengeId + ":" + code)`. Tuz = challenge kimliği; pepper env'de
  (6 haneli uzay DB sızıntısında pepper'sız kırılır). `challengeToken` 32 bayt rastgele base64url, DB'de yalnız SHA-256'sı.
- **Süre**: 10 dk. **Deneme**: challenge başına 5; 5.'de challenge geçersiz → yeni giriş gerekir.
- **Kullanıcı başı sınırlar** (`@convex-dev/rate-limiter`, mevcut `convex/lib/rateLimit.ts:4-13`'e eklenir):
  `mfaSend` 5 / 15 dk (key userId), `mfaVerifyFail` 10 / saat (key userId; challenge yenilemekle sıfırlanmaz).
  Şifre adımı zaten saatte 10 hata (Convex Auth).
- **Resend**: 60 sn bekleme, challenge başına en fazla 3 gönderim.
- **Tek kullanımlık**: `consumedAt` set → tekrar kullanılamaz. Yeni challenge aynı kullanıcının eski açık challenge'larını siler.
- **Enumeration**: `MFA_REQUIRED` yalnız doğru şifreden sonra döner; şifre/hesap hatası tek tip `INVALID_CREDENTIALS`.
  `maskedEmail` (`e***@d***.com`) yalnız şifre doğrulandıktan sonra. Doğrulama hatası tek tip "Kod geçersiz veya süresi dolmuş".
- **Zamanlama**: sahte Scrypt (yukarı), sabit zamanlı karşılaştırma (`requireSetupSecret` deseni `convex/lib/auth.ts:189-206`).
- **Audit**: `writeAudit` (`convex/lib/audit.ts:18-38`), `targetTable:"authSecurity"`, `targetId:userId`, `note` yalnız olay
  kodu: `mfa.sent`, `mfa.ok`, `mfa.fail`, `mfa.locked`, `user.frozen`, `user.unfrozen`, `user.expiry_set`, `mfa.policy`.
  E-posta, kod, IP, token yazılmaz. **Giriş başına audit satırı** kotayı/tabloyu şişirir → `mfa.sent`/`mfa.ok` yerine yalnız
  `mfa.fail`+`mfa.locked`+yönetimsel olaylar da yeterli olabilir (Açık karar 4).
- **Temizlik (cron yok)**: `createChallenge` kullanıcının eski challenge'larını `by_user` + `.take(20)` ile siler.

## §3 Kapsam ve geçiş
Seçenekler: (i) rol bazlı zorunlu (super_admin + project_admin), (ii) proje ayarı — **uygun değil**: kullanıcı birden çok
projede, super_admin hepsinde; giriş anında proje bağlamı yok, (iii) kullanıcı tercihi (opt-in).
**Öneri: sistem politikası + kullanıcı tercihi.** `systemSecuritySettings.adminMfaPolicy`:
`"off"` (varsayılan) | `"optional"` (kullanıcı Profil'den açar) | `"required"` (super_admin+project_admin zorunlu,
project_user opt-in). `isMfaRequired = !exempt && (policy==="required" && isManager(user) || policy!=="off" && user.mfaEnabled)`.
- **Açılış**: politika `off` ile deploy → davranış birebir aynı (beforeSessionCreation yalnız dondurma kontrol eder).
  Önce `optional` + Emre'nin hesabıyla deneme, sonra `required`.
- **Kilitlenme önleme**: `required`'a geçiş mutation'ı, çağıranın son 10 dk içinde başarılı OTP girişi yapmış olmasını ister
  (oturum `authMfaChallenges.consumedAt` ile eşlenir) → posta çalışmıyorsa politika açılamaz.
- **Kurtarma**: e-posta OTP'de sıfırlanacak sır yok; sorun posta kutusuna erişim. super_admin başka kullanıcıya
  `mfaExemptUntil` (≤24 saat) verir veya e-postasını düzeltir. **Tek super_admin kilitlenirse**: env acil anahtarı
  `AUTH_MFA_BREAK_GLASS_UNTIL=<epoch ms>` (Convex dashboard'dan; süreli, kendiliğinden kapanır) + `internalMutation
  authMfa.breakGlassExempt({email})` (`npx convex run`, yalnız Emre). Resend kesintisi de bu yolla aşılır.
- **"Bu cihazı 30 gün hatırla"**: **v1'de yok.** Oturum zaten 30 gün yaşıyor (`sessions.js:4`), OTP yalnız yeni girişte
  sorulur. Cihaz çerezi yeni çalınabilir sır + iptal mantığı demek.
- **Gelecek TOTP**: `users.mfaMethod: "email"|"totp"` + şifreli `totpSecret`; `verifyChallenge` yöntem bazlı dallanır, akış aynı kalır.

## §4 Dondurma / bitiş tarihi
- **Alanlar** (`users`, hepsi opsiyonel): `disabledAt?: number`, `disabledBy?: Id<"users">`, `accessExpiresAt?: number`.
  Gerekçe metni saklanmaz (KVKK; gerekirse audit `note` kodu).
- **Tek kural** `convex/lib/accountAccess.ts`: `accessBlockReason(user, now): "disabled"|"expired"|null`.
- **Uygulama noktaları**:
  1. `getValidAuthUserId` (`convex/lib/auth.ts:9-22`) kullanıcıyı da okuyup bloklu ise `null` döner → `getCurrentUser`,
     `getCurrentUserOrNull` (dolayısıyla `users.currentUser` ve `authedAction`), `invites.consume` (`invites.ts:227`),
     `initializeAdmin` (`users.ts:151`), `projects.ts:33`, `userProjects.ts:9`, `ideSync.ts:585`, `hikvisionSync.ts:632` tek yerden kapsanır.
     (Yeni `getValidAuthUser` Doc döndürür; `getCurrentUser` ikinci `db.get`'i bırakır.)
  2. `beforeSessionCreation` → yeni giriş reddi; 3. `verifyChallenge` → OTP sonrası da kontrol.
- **Oturum sonlandırma**: `freezeUser` aynı transaction'da `authSessions` (`userId` index) + her biri için
  `authRefreshTokens` (`sessionId` index) siler (`.take(100)` döngü). Silme reaktif → açık sekmelerde `currentUser` null olur,
  `AuthProvider` orphan mantığı çıkış yaptırır (`AuthProvider.tsx:124-147`). Not: mevcut `deleteUser` refresh token'ları
  bırakıyor (`users.ts:200-204`) — zararsız (oturum yoksa refresh reddedilir) ama aynı helper'a alınabilir.
- **Bitiş (cron yok)**: istek anında `Date.now()` karşılaştırması. Query aboneliği zaman geçince kendiliğinden yeniden
  koşmaz → istemci `AuthProvider`'da `accessExpiresAt`'e tek `setTimeout` ile çıkış (sunucu çağrısı yok). Mutation'lar zaten reddeder.
- **Korumalar** (`userProtectionError` genişletilir, `convex/lib/adminGuards.ts:14-32`): kendini dondurma / kendine geçmiş
  bitiş verme yasak; **son aktif super_admin** (dondurulmamış + süresi dolmamış; `by_role` `.take(20)`) dondurulamaz / bitiş verilemez.
  `updateRole`/`deleteUser`'daki son-admin sayımı da "aktif" super_admin'e göre düzeltilmeli (dondurulmuş admin sayılmamalı).
- **Rol matrisi (öneri v1)**: dondur/çöz/bitiş/MFA-muafiyet = yalnız `super_admin` (mevcut `updateRole`/`deleteUser` ile
  tutarlı, `users.ts:47,180`). project_admin'in kendi projesindeki project_user'ı dondurması = Açık karar 2.
- **Mobil çalışan girişi etkilenmez**: ayrı `employees`/`sessionToken` yolu, Convex Auth'a bağımsız
  (`convex/employeeAuth.ts:172-176`, `customFunctions.ts:117-134`). Ne `beforeSessionCreation` ne `getValidAuthUserId` çağrılır.

## §5 Değişecek dosyalar ve imzalar
**Şema** (`convex/schema.ts`, migration yok):
- `users` +: `disabledAt`, `disabledBy`, `accessExpiresAt`, `mfaEnabled?: boolean`, `mfaExemptUntil?: number`.
- Yeni `authMfaChallenges`: `userId, tokenHash, codeHash, expiresAt, attempts, sendCount, lastSentAt, consumedAt?,
  purpose: "login"|"stepUp"`; index `by_token_hash [tokenHash]`, `by_user [userId]`.
- Yeni `systemSecuritySettings` (tekil satır): `adminMfaPolicy: "off"|"optional"|"required", updatedBy?, updatedAt`.
- `publicUserValidator` (`convex/lib/publicUser.ts:6-25`) + `mfaEnabled`; `adminUserRow` (`convex/lib/adminLists.ts:32`) +
  `disabledAt, accessExpiresAt, mfaEnabled, mfaExemptUntil`.

**Convex** (sarmalayıcı türüyle):
- `convex/auth.ts`: `ConvexCredentials({id:"password-mfa", authorize})` + `callbacks.beforeSessionCreation`.
- `convex/lib/accountAccess.ts`: `accessBlockReason`, `isMfaRequired(user, policy, now, breakGlassUntil)` (saf, test edilebilir).
- `convex/lib/mfaCrypto.ts`: `generateOtp()`, `hmacCode()`, `randomToken()`, `sha256()`, `timingSafeEqual()`, `maskEmail()`.
- `convex/lib/resendClient.ts`: `sendResendEmail` (`sendEmail.ts`'den taşınır, re-export).
- `convex/authMfa.ts`: `internalQuery loginPolicy({userId})` · `internalMutation createChallenge({userId, purpose})` →
  `{challengeToken, code, to}` · `internalMutation verifyChallenge({challengeToken, code, purpose})` →
  `{ok:true,userId,sessionId?}|{ok:false}` · `internalMutation prepareResend({challengeToken})` ·
  `internalMutation breakGlassExempt({email, hours})`.
- `convex/accountSecurity.ts`: `superAdminMutation freezeUser({userId})`, `unfreezeUser({userId})`,
  `setAccessExpiry({userId, accessExpiresAt: number|null})`, `setMfaExempt({userId, until: number|null})` ·
  `superAdminQuery getSecurityPolicy({})` · `superAdminMutation setAdminMfaPolicy({policy})` ·
  `authedAction startMyMfaToggle({enable})` (step-up kodu yollar) + `authedMutation confirmMyMfaToggle({challengeToken, code})`
  (açma/kapama posta kutusuna erişimi kanıtlar; oturumu çalan kişi tek tıkla kapatamaz). `required` + manager → kapatma reddedilir.
- `convex/lib/auth.ts`: `getValidAuthUser` + blok kontrolü; `convex/lib/adminGuards.ts`: dondurma/bitiş korumaları.
- `convex/lib/rateLimit.ts`: `mfaSend`, `mfaVerifyFail`.

**Frontend**:
- `AuthProvider.tsx:157-166`: `signIn` → `"password-mfa"` start; `MFA_REQUIRED` → `{mfa:{challengeToken, maskedEmail}}`;
  yeni `verifyMfa(code)`, `resendMfa()`. Token yalnız bellekte (localStorage yok).
- `Login.tsx`: OTP adımı (6 hane `inputMode="numeric" autoComplete="one-time-code"`, 60 sn yeniden gönder sayacı, "Geri").
  Metinler: "E-postanıza gönderilen 6 haneli kodu girin", "Kod geçersiz veya süresi dolmuş".
- `UserSetup.tsx:110-113`: mevcut hesap `signIn('password',{flow:'signIn'})` MFA kullanıcısında **kırılır** → aynı OTP
  bileşeni + `password-mfa` akışı. (`AdminSetup` yalnız ilk signUp → etkilenmez.)
- `AdminUsersPanel.tsx`: satır aksiyonları Dondur/Çöz, Bitiş tarihi, 2FA muafiyeti; rozetler "Donduruldu", "Süresi doldu",
  "2FA". Kullanıcılar sekmesine politika kartı (Kapalı / İsteğe bağlı / Yöneticilere zorunlu).
- `SecurityCard.tsx:29` (şu an yer tutucu): 2FA aç/kapa (step-up kodu ile).

**Testler** (`convex-test` mevcut, ör. `convex/employeeAuth.mobile.test.ts`):
1. Bypass: MFA kullanıcısı düz `signIn("password",{flow:"signIn"})` → `beforeSessionCreation` reddi; `step:"start"` sonrası oturum yok.
2. Brute force: 5 yanlış kod → challenge kilitli; 10/saat kullanıcı sınırı; deneme sayacı hata dönüşünde commit edilmiş.
3. Süresi dolmuş / tüketilmiş kod reddi; resend sonrası eski kod geçersiz; başka kullanıcının challengeToken'ı ile giriş yok.
4. Dondurulmuş: start/verify reddi, mevcut oturum + refresh token silinmiş, `getCurrentUser`/`authedAction` reddi; bitiş geçmiş → aynı.
5. Korumalar: kendini / son aktif super_admin'i dondurma reddi; politika `off` iken davranış değişmedi (regresyon);
   mobil `employeeAuth` testleri yeşil; enumeration: olmayan hesap ve yanlış şifre aynı hata kodu.

## §6 W3b uygulama adımları (tahmin toplam ~9-11 saat)
1. **Saf çekirdek** (~1 sa): `accountAccess.ts`, `mfaCrypto.ts` + birim testleri. Geri dönüş: dosyayı sil.
2. **Şema + dondurma backend** (~1.5 sa): opsiyonel alanlar, `getValidAuthUser`, `freezeUser/unfreezeUser/setAccessExpiry`,
   oturum silme, korumalar, `beforeSessionCreation` (yalnız blok kontrolü). Test 4-5. Risk: guard regresyonu → tüm suite.
3. **Dondurma UI** (~1 sa): AdminUsersPanel aksiyonları + rozetler + AuthProvider bitiş zamanlayıcısı.
4. **MFA backend** (~2.5 sa): tablolar, `authMfa.ts`, `resendClient`, `password-mfa` provider, politika (varsayılan `off`),
   rate limit, `beforeSessionCreation` MFA kontrolü. Test 1-3.
5. **MFA UI** (~2 sa): Login OTP adımı, UserSetup mevcut-hesap yolu, SecurityCard step-up, politika kartı.
6. **Canlıya alma** (~1 sa, Emre onayıyla): `AUTH_MFA_PEPPER` env, deploy (politika `off`) → mevcut girişler aynı mı →
   `optional` + Emre hesabında tam tur → `required`.
- **Riskler**: (1) e-posta teslim sorunu tüm yöneticileri kilitler → break-glass env + `required`'a geçişte canlı OTP şartı;
  (2) `getValidAuthUserId` değişikliği her korumalı çağrıya +1 `db.get` ekler (`getCurrentUser` zaten okuyor → net ~0);
  (3) Convex Auth iç şemasına (`authSessions` alanları) doğrudan yazmak — 0.0.96'ya bağlı; sürüm yükseltmede test 1 kapı olur.
- **Geri dönüş**: politika `off` (anında, deploy yok); dondurma alanları opsiyonel → kod geri alınsa da veri zararsız.
  Acil: `AUTH_MFA_BREAK_GLASS_UNTIL`.

## §7 Emre'ye açık kararlar
1. **Zorunluluk kapsamı** — Öneri: politika varsayılan `off`, sonra `required` = super_admin + project_admin; project_user opt-in.
2. **project_admin dondurabilsin mi?** — Öneri: v1'de hayır (yalnız super_admin); talep gelirse kendi projesindeki project_user için.
3. **"Bu cihazı 30 gün hatırla"** — Öneri: v1'de yok (oturum zaten 30 gün).
4. **Audit yoğunluğu** — Öneri: başarılı girişleri yazma; yalnız `mfa.fail`/`mfa.locked` + yönetimsel olaylar (kota + KVKK).
