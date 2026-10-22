# W3 sentezi — 2FA + dondurma / bitiş (koordinatör, 2026-10-21)

Girdi: [w3-2fa-claude.md](w3-2fa-claude.md) (öneri b) · [w3-2fa-codex.md](w3-2fa-codex.md) (öneri a). Birbirini görmediler.

## Mimari kararı: (b) iki adımlı giriş — Claude'un modeli, Codex'in sertleştirmeleriyle
- **Neden (b):** kod doğrulanmadan oturum (authSessions satırı) hiç oluşmaz → "yarım oturum" ile bypass edilecek yüzey yok. (a) her guard/action/HTTP yolunun envanterini ve kalıcı disiplinini gerektiriyor; bir unutulmuş yol tüm 2FA'yı deler (Codex'in kendi 1. riski).
- **Codex'in (b) itirazları ve cevabı:**
  - "Eski Password signIn açık kalırsa tam bypass" → `beforeSessionCreation` MFA gereken kullanıcıda varsayılan oturum açmayı HER ZAMAN reddeder; tek yol OTP'yi tüketen mutation'ın kendi açtığı oturum (Claude §1.3).
  - "`authorize` challenge döndüremez" → Adım 1 ayrı **public action** olur (`requestLoginCode({email,password})` → `retrieveAccount` ile şifre doğrulama + kod e-postası + opak `challengeToken`). Adım 2 `signIn("password-mfa",{challengeToken,code})` → `verifyChallenge` kodu tüketir + oturumu kendisi açar → `{userId,sessionId}`. ConvexError'ın istemciye taşınmasına bağımlılık kalkar.
- **Codex'ten alınanlar (her iki mimaride de gerekli):**
  1. Mevcut açık yollar kapatılır: `authedAction` (`convex/lib/customFunctions.ts:104` → gevşek `currentUser`), `userProjects.getByCurrentUser` (`convex/userProjects.ts:6`) → tam guard.
  2. `getValidAuthUserId` oturum **süresini** de kontrol eder (şu an yalnız varlık/sahiplik).
  3. Bitiş tarihi: istek anı kontrolü + **bitiş anına tek seferlik `runAt` iş** (oturumları kapatır; query cache `Date.now()` ile yenilenmediği için). Cron değil, kullanıcı başına tek iş.
  4. Oturum iptali sınırlı batch (`take(50)` + `runAfter(0)` devam); paketin sınırsız `invalidateSessions`'ı kullanılmaz.
  5. Son **etkin ve süresiz** super_admin korunur; `updateRole`/`deleteUser` sayımı da buna göre düzeltilir; eşzamanlı iki işlem son admini kaldıramaz.
  6. Audit'e kod/e-posta/IP/token yazılmaz; yalnız olay kodu.
- **OTP:** 6 hane (Claude) · 10 dk geçerlilik · kod başına 5 deneme · kullanıcı başı saatte 10 hatalı deneme · yeniden gönder 60 sn, kod başına ≤3, saatte ≤5 · HMAC + env pepper (`AUTH_MFA_PEPPER`) · tek kullanımlık · enumeration'a karşı tek tip hata + sahte Scrypt.
- **Açılış:** politika `off` (varsayılan, davranış aynı) → `optional` + Emre hesabıyla tam tur → `required`. `required`'a geçiş, çağıranın son 10 dk'da başarılı OTP girişi yapmış olmasını ister (posta bozuksa açılamaz). Acil durum: süreli env anahtarı `AUTH_MFA_BREAK_GLASS_UNTIL` + internal-only kurtarma mutation'ı.
- **Diğer kırılan yol:** `UserSetup.tsx:110-113` mevcut-hesap girişi OTP adımını da almalı.
- **Mobil çalışan girişi etkilenmez** (ayrı `employeeAuth`), iki tasarım da teyit etti.

## Süre
Claude 9-11 sa · Codex 4-6 iş günü (guard envanteri dahil). Sentez: **~2 gün worker süresi** (b mimarisi guard envanterini küçültür; Codex'in 1-2 maddesi eklenir).

## İzolasyon
W3b ayrı worktree/dalda koşar (CEO'nun commit'siz W2'si ana ağaçta; `schema.ts` ortak). CEO yayınından sonra `main` üstüne alınır → temiz kapı → commit.

## Emre kararları
1. Zorunluluk kapsamı · 2. Hesap yönetimi yetkisi · 3. Oturum süresi · 4. Bitiş tarihi kesinliği → bkz. sohbet.
