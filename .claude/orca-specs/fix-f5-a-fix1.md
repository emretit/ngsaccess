# FIX1 — Faz 5-A: şifre sıfırlamayı yönetici arayüzünden tetiklenebilir yap + numaralandırmayı kapat

ÖNCE `/Users/emreaydin/ngsaccess/.claude/orca-specs/fix-ortak.md` OKU (YASAK: git add/commit/stash/checkout/reset/restore; npx convex; DB; paket kurma). Rapor: `/tmp/fix-f5-a-fix1-rapor.md`.
Denetim raporu: `/tmp/fix-f5-a-sifre-denetim.md` (bulgu 1 ŞART, NOT 2 ŞART; NOT 3/4 KAPSAM DIŞI — sendEmail.ts başka oturumda). Önceki iş: `.claude/orca-specs/fix-f5-a-sifre.md`.

## Ownership
`src/components/admin/AdminUsersPanel.tsx`, `src/components/admin/hooks/useUserManagement.ts`, `convex/invites.ts` (yalnız NOT 2), ilgili testler (`src/components/admin/**/*.test.tsx`, `convex/fixF5PasswordReset.test.ts`, `convex/invites.test.ts`).
DOKUNMA: `convex/actions/sendEmail.ts` (başka oturum WIP; mevcut `sendUserInviteEmail` zaten `type: "reset"` argümanını kabul ediyor — sendEmail.ts:108), `src/components/settings/**`, F5-B/F5-C dosyaları, `convex/lib/pdks*`, rapor dosyaları.

## Değişiklikler
1. **Bulgu 1** — Kullanıcı yönetimi listesinde (AdminUsersPanel) mevcut password hesabı olan, aktif, super_admin OLMAYAN kullanıcı satırına "Şifre sıfırlama bağlantısı gönder" eylemi: onay diyaloğu ("<ad> adresine şifre sıfırlama bağlantısı gönderilecek. Mevcut oturumları şifre değişince kapanır.") → `sendUserInviteEmail({ ..., type: "reset" })`. Yetki: mevcut kullanıcı yönetimi yetkisi (admin.manage) olmayan kullanıcıya eylem görünmez. Başarı/hata toast'ları Türkçe; backend hata kodları (INVITE_*) anlaşılır metne çevrilir.
2. **NOT 2** — `invites.ts:~41,48` reset oluştururken hesap yok / super_admin / başka projede hesap → TEK genel hata kodu+mesajı ("Bu kullanıcıya şifre sıfırlama bağlantısı gönderilemiyor.") — hesap varlığı sızmasın. Testleri buna göre güncelle.

## Kabul
- UI testi: yetkili yöneticide eylem görünür ve `type: "reset"` ile çağrılır; yetkisiz rolde ve super_admin satırında görünmez. Backend: üç red durumu aynı kod/mesaj.
- Kapılar (fix-ortak.md) + `vitest run convex/invites*.test.ts convex/fixF5PasswordReset.test.ts src/components/admin` yeşil.
commit/push/deploy/migration/DB yazma YOK. `git add`/`git commit` YASAK.
