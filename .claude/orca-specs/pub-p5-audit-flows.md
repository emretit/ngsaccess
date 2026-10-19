# Görev: Public P5 audit — oturumsuz akışların kalan bulguları (SALT-OKUR, kod değiştirme)

## Hedef (test edilebilir)
`/tmp/pub-p5/AUDIT-flows.md` üretilmiş olsun: aşağıdaki her madde için **durum** (KAPALI / KISMEN / AÇIK / DOĞRULANAMADI) + kanıt file:line +
(açıksa) somut senaryo + önerilen düzeltme + boyut (S/M/L) + **Convex deploy gerekir mi** + risk. Düzeltme YAPMA.

## Bağlam
Repo `/Users/emreaydin/ngsaccess` — React 19 + Vite; backend Convex (`convex/`). Convex kodu okumadan önce `convex/_generated/ai/guidelines.md`'yi oku.
Public sayfalar 2026-10-19'da yeniden yazıldı (commit `77b25ea`, canlı). Eski audit: `docs/ux-audit/05_KABUK_DASHBOARD_GIRIS.md` (SHL-xx satırları 81-96 ve
paket tarifleri 300-350). Son denetimler: `/tmp/pub-p4/REVIEW.md`, `/tmp/pub-p4-fix/REREVIEW.md`, triage `docs/ui-scan/public/P4_FIXES.md`.
Sayfalar: `src/pages/{Login,Register,VerifyEmail,UserSetup,AdminSetup,EmployeeSetup,CheckIn}.tsx`; auth: `src/components/auth/AuthProvider.tsx`, `convex/auth.ts`,
`convex/emailVerification.ts`, `convex/invites.ts`, `convex/employeeCheckIn.ts`, `convex/lib/*checkIn*` (varsa).

## Denetlenecek maddeler
1. **SHL-18** kayıt başarılı + doğrulama e-postası başarısız → kullanıcı ne görür, yeniden kayda mı yönlenir (`AuthProvider.signUp`, `Register.tsx`, `Login.tsx` `verificationQueued`).
2. **SHL-21** VerifyEmail: ham hata metni görünüyor mu, `ran` ref token değişince yeniden çalışıyor mu, geçersiz/tüketilmiş bağlantıda ne öneriliyor.
3. **SHL-23** UserSetup: mevcut hesap / yeni hesap yolları, `type==='reset'` reddi, geçersiz davet ekranı, davetin proje/rol bilgisi.
4. **SHL-24** Kurulum yarışı: UserSetup/AdminSetup `signUp` sonrası `verified=false` kullanıcı için AuthProvider global effect'i `signOut` yapıp davet tüketimini/admin initialize'ı yarıda kesebilir mi?
   Kod yolunu adım adım izle (hangi effect, hangi koşul, hangi sıra); kanıtla "olur / olmaz / koşula bağlı" de. Mümkünse saf mantığı izole bir vitest senaryosuyla `/tmp/pub-p5/` altında dene (repo'ya yazma).
5. **SHL-26 + RR-04** QR: token ömrü (`convex/employeeCheckIn.ts` + TTL sabiti) ↔ sayfanın konum bekleme süresi (`CheckIn.tsx`), kullanılmış token'ın idempotent sonucu (`state==='completed'`),
   çift mount/çift istek, başarısız sonuç sözleşmesi (bugün yalnız Türkçe `error` metni; frontend metinle eşliyor — `src/pages/CheckIn.tsx` `checkInPresentation`).
   Önerilen sözleşme: `{ success:false, code:'invalid_token'|'expired_token'|'employee_not_found', error }` — geriye uyumluluk (eski web ↔ yeni backend, yeni web ↔ eski backend) ve deploy sırası.
6. **SHL-33** AdminSetup teknik metin (`ADMIN_SETUP_SECRET`, "Convex env") ve kör signIn denemesi hâlâ var mı.
7. **SHL-34** EmployeeSetup başarı sonrası sonraki adım.
8. **QA'nın ulaşamadığı dallar** (`/tmp/pub-p4/QA.md` §Ulaşılamayan): `user.verified=true` sonrası "Yönetim alanına geç" CTA'sı, AdminSetup `hasAdmin===true && isLoading` ara dalı,
   tarayıcıda `navigator.geolocation` yokken CheckIn — kod okuyarak doğru davranıp davranmadığını söyle.
9. Okurken gördüğün, yukarıda olmayan **yeni** kritik/yüksek sorun (yalnız public akışlar) — ayrı bölüm.

## Ownership
YALNIZ `/tmp/pub-p5/**`. Repo'ya yazma.

## YASAK
Kod düzeltme · commit/push/deploy · `npx convex …` (codegen dahil) · canlı DB/Convex/Supabase okuma-yazma · gerçek e-posta/form gönderme · arka planda açık sunucu.

## Kapılar
1. Her madde için durum + en az bir file:line kanıt. 2. Convex değişikliği gerektiren her öneri için deploy sırası ve geriye uyumluluk notu.
3. `git status --porcelain` başta/sonda aynı (repo'ya yazmadın).

## Rapor
`worker_done` ≤8 satır: durum sayıları (KAPALI/KISMEN/AÇIK), en kritik 3 açık madde file:line, Convex deploy gerektirenler, `reportPath=/tmp/pub-p5/AUDIT-flows.md`.
