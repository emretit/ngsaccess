# Görev: P5 polish (frontend) — davet kurulum ekranı: oturum koruma (R5-04) + sabit zaman aşımı (R5-06)

## Hedef (test edilebilir)
(1) Mevcut hesapla ("mevcut hesabım var" akışı) davet kabul edilirken davet hatası (geçersiz/kullanılmış/e-posta uyuşmaz) olursa kullanıcının oturumu KAPANMASIN;
yeni hesap (signUp) akışında hata olursa bugünkü gibi signOut olsun. (2) Auth-hazır bekleyicisinin 15 sn zaman aşımı, bağımlılıklar değişse de bekleyici başladığı andan itibaren SABİT 15 sn olsun.

## Bağlam (önce oku)
Repo `/Users/emreaydin/ngsaccess`. Denetim: `/tmp/pub-p5/REVIEW.md` R5-04, R5-06.
- `src/components/auth/AuthProvider.tsx:170-182` `runSetup`: catch'te koşulsuz `convexSignOut()`. Çağıranlar: `src/pages/UserSetup.tsx:107`, `src/pages/AdminSetup.tsx:47` (AdminSetup davranışı DEĞİŞMEZ).
- AuthProvider guard effect'i (:62-119): `profile.verified === false` ise zaten signOut + /login yönlendirmesi yapar → oturumu korunan hesap doğrulanmamışsa guard kendisi kapatır (güvenlik korunur).
  `/user-setup`'ta doğrulanmış kullanıcı yönlendirilmez (yalnız /login,/register,/verify-email) → hata mesajı ekranda kalır.
- `src/pages/UserSetup.tsx:57-74` auth-waiter effect'i: timer `[authWaiter, isAuthenticated, user?.email, email]` değişince yeniden kuruluyor (R5-06).
- `src/components/auth/registrationFlow.ts` (+test): saf yardımcılar burada (`deferAuthGuard`).
- Projede RTL/jsdom YOK, EKLENMEZ: sayfa testleri SSR + `vi.mock` + saf fonksiyon (`src/pages/UserSetup.test.tsx` desenine bak).

## Yapılacaklar
1. `runSetup(action, options?: { signOutOnError?: boolean })` — varsayılan `true` (AdminSetup aynı kalır). `false` ise catch'te signOut YOK; ref/phase sıfırlaması ve `throw` aynen.
   Kararı saf fonksiyonla ver ve test et (ör. `registrationFlow.ts`'e `setupSignOutOnError(existingAccount: boolean)` → `!existingAccount`).
2. `UserSetup.tsx`: `runSetup(..., { signOutOnError: setupSignOutOnError(existingAccount) })`.
3. R5-06: timer'ı yalnız `[authWaiter]`'a bağlı ayrı effect'e al (bekleyici oluşunca 15 sn, temizlikte clear); eşleşme/resolve effect'i ayrı kalsın. Unmount reject davranışı korunur.
   Zaman aşımı mantığını mümkünse saf/test edilebilir yap; değilse UserSetup.test.tsx'e SSR'ın elverdiği kadar test + rapora Playwright gerekmediğini gerekçele.
4. Metin/tasarım değişikliği YOK.

## Ownership (YALNIZ bunlar)
`src/components/auth/AuthProvider.tsx` (yalnız `runSetup` + context tipi), `src/components/auth/registrationFlow.ts`, `src/components/auth/registrationFlow.test.ts`,
`src/pages/UserSetup.tsx`, `src/pages/UserSetup.test.tsx`. `convex/**`, `src/lib/reports/**`, `src/components/reports/**`, `AdminSetup.tsx` — DOKUNMA.

## YASAK
`npx convex …` · commit/push · deploy · canlı DB okuma-yazma · `package.json` · RTL/jsdom ekleme · arka planda sunucu.

## Kapılar (kendin koş)
`node_modules/.bin/tsc --noEmit -p tsconfig.app.json` → Ownership'te 0 (`src/lib/reports/rows.test.ts` kırmızısı başka oturumun, kapsam dışı) ·
`node_modules/.bin/eslint src/components/auth src/pages/UserSetup.tsx src/pages/UserSetup.test.tsx` → 0 ·
`node_modules/.bin/vitest run src/components/auth src/pages/UserSetup.test.tsx src/pages/AdminSetup*` → yeşil.

## Rapor
`worker_done` ≤8 satır: file:line, AdminSetup'ın değişmediği kanıtı, testler, kapılar. Ayrıntı `/tmp/pub-p5/polish-fe.md`.
