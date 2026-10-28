# FAZ 5-A — Web şifre sıfırlama akışı (Y-03)

ÖNCE `/Users/emreaydin/ngsaccess/.claude/orca-specs/fix-ortak.md` OKU (YASAK: git add/commit/stash/checkout/reset/restore; npx convex; DB; paket kurma). Rapor: `/tmp/fix-f5-a-sifre-rapor.md`.
Kaynak: `docs/sistem-audit-2026-10-25/DOGRULAMA.md` Y-03 + `M4-hesap-yonetim.md` (kanıt satırlarını yeniden doğrula).

## Hedef (test edilebilir)
Yöneticinin gönderdiği "reset" davetiyle web kullanıcısı yeni şifre belirleyip giriş yapabilir; sıfırlama tamamlanınca kullanıcının TÜM eski oturumları iptal edilir; davet tek kullanımlık ve süreli kalır.

## Ownership
`convex/invites.ts`, `convex/auth.ts` (yalnız gerekiyorsa), `src/pages/UserSetup.tsx`, `src/pages/Login.tsx` (yalnız yanlış "yöneticiniz sıfırlayabilir" metni), `src/components/**/SecurityCard.tsx` (profil düğmesi), ilgili testler + yeni `convex/fixF5PasswordReset.test.ts`.
DOKUNMA: `convex/actions/sendEmail.ts`, `convex/actions/sendScheduledReports.ts`, `src/components/settings/**`, `src/lib/capabilities.ts`, `convex/lib/auditLogQuery.ts`, `package.json` (BAŞKA OTURUMUN WIP'i) · `convex/employees.ts`, `convex/lib/employeeCascade.ts`, `convex/employeeAuth.ts` (F5-B) · `convex/lib/pdks*`, `src/components/reports/**`, `src/lib/reports/**`.
Reset e-postasını göndermek için sendEmail.ts değişikliği gerekirse DURMA: `ask` ile sor (büyük olasılıkla gönderim zaten var, eksik olan tüketme tarafı).

## Değişiklikler
1. `invites.ts:~14-23` tüketme: `type === "reset"` daveti, davetteki e-postaya ait MEVCUT kullanıcı için kabul edilsin (yeni kullanıcı yaratmaz; başka kullanıcının şifresini değiştiremez). Kullanılmış/süresi dolmuş/yanlış e-posta → mevcut Türkçe hata kodları.
2. Şifre güncelleme Convex Auth password sağlayıcısının desteklenen yoluyla (mevcut `resetClaimedAccount` `:162` desenini incele; `auth.ts` gerekirse) — düz metin şifre saklama YOK, mevcut hash yolu.
3. Sıfırlama tamamlanınca kullanıcının tüm `authSessions` (+ refresh token) kayıtları silinsin; davet `usedAt` ile kapansın; audit kaydı (mevcut audit deseni) — e-posta adresi audit'e düz yazılmaz.
4. UI: `UserSetup.tsx:~148` reset davetinde "Yeni şifre belirle" akışı (ad/soyad sormaz); `Login.tsx:~198` metni gerçek akışa göre ("Şifrenizi unuttuysanız yöneticinizden sıfırlama bağlantısı isteyin"); `SecurityCard.tsx:~20-23` kapalı düğme ya kaldırılsın ya da gerçek akışa bağlansın (yalnız mevcut uçlarla — yeni e-posta gönderimi yok).
5. Yetki: reset daveti oluşturma mevcut yetki kontrolüyle kalır (kontrol et: başka projenin kullanıcısına/super_admin'e reset gönderilemesin; açık varsa düzelt + test).

## Kabul (testler)
- Reset davetiyle şifre değişir, eski oturum geçersiz, davet ikinci kez kullanılamaz; süresi dolmuş davet reddedilir; invite tipi davet mevcut kullanıcıyı ezmez; başka e-postanın daveti reddedilir.
- Kapılar (fix-ortak.md) + `vitest run convex/invites*.test.ts convex/fixF5PasswordReset.test.ts src/pages/UserSetup*.test.tsx src/pages/Login*.test.tsx` (var olanlar) yeşil.
commit/push/deploy/migration/DB yazma YOK. `git add`/`git commit` YASAK.
