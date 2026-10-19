# Görev: R5-03 hesap devralma — güvenlik denetimi (SALT OKUMA)

## Hedef
`git diff -- convex/invites.ts convex/invites.test.ts src/pages/UserSetup.tsx src/pages/UserSetup.test.tsx` (Codex luna yazdı; koordinatör action'daki state tipini ayrık birleşime çevirdi)
güvenli mi, karar ve sözleşmeye uyuyor mu — kanıtla raporla. Kod DEĞİŞTİRME. Spec: `.claude/orca-specs/pub-p5-r503.md`. Worker raporu: `/tmp/pub-p5/fix-r503.md`.

## Karar (CEO, Emre adına)
Silme yok. Davet token'ı (artık yalnız e-postada, R5-01 canlı) sahiplik kanıtı → davet e-postasına ait DOĞRULANMAMIŞ + rolsüz + üyeliksiz password hesabı devralınır
(yeni şifre, oturumlar düşer, sonra consume verifyUser). Doğrulanmış/rolü/üyeliği olan hesaba dokunulmaz.

## Kontrol et (saldırgan gözüyle)
1. `claimSetupAccount` public + kimliksiz: token olmadan / kullanılmış / süresi dolmuş / reset token'ıyla bir şey yazılabiliyor mu? Bilgi sızıntısı (none vs taken) yalnız token sahibine mi?
2. Doğrulanmış hesabın (verified true veya undefined=eski kullanıcı), super_admin'in, rolü/üyeliği olan hesabın şifresi değiştirilebiliyor mu — tüm dallar. `resetClaimedAccount` yeniden kontrolü + `modifyAccountCredentials`
   sırası: state sorgusu → reset → modify → invalidate arasında yarış penceresi; saldırgan (squatter) o arada hesabı "doğrulanmış" yapabilir mi (doğrulama maili kurbana gider) — gerçekçi risk değerlendir.
3. Hesap id eşleşmesi: `authAccounts.providerAccountId === invite.email` (küçük harf). `convex/auth.ts` Password provider e-postayı normalize etmiyor → büyük/küçük harf farklı squat (ör. `Victim@x.com`) ne olur:
   davetli signUp'ı engellenir mi, yoksa ayrı hesap mı açılır; consume hangi hesabı alır? İki hesap aynı e-postayla kalırsa risk?
4. `modifyAccountCredentials`/`invalidateSessions` (`node_modules/@convex-dev/auth/dist/server/implementation/`) bu kullanımda doğru mu (provider "password", `auth.ts` export'ları `store` dahil); hata durumunda yarım kalan durum.
5. UserSetup: yeni-hesap modunda claim → dönen flow ile signIn → consume; mevcut hesap modu değişmedi mi; hata kodları Türkçe; `runSetup` `signOutOnError` mantığı hâlâ doğru mu.
6. Testler gerçek kayıtlı handler'ları mı koşuyor, yalnız db/auth fonksiyonları mı sahte; squat→claim→consume zinciri ve doğrulanmış hesapta red kanıtlanmış mı.
7. Convex guidelines (`convex/_generated/ai/guidelines.md`): action'da `ctx.db` yok, validator'lar, internal/public ayrımı.

## Kapılar (kendin koş)
`node_modules/.bin/tsc --noEmit -p tsconfig.app.json` · `-p convex/tsconfig.json` · `node_modules/.bin/eslint convex/invites.ts convex/invites.test.ts src/pages/UserSetup.tsx src/pages/UserSetup.test.tsx` ·
`node_modules/.bin/vitest run convex/invites.test.ts src/pages/UserSetup.test.tsx`. Ağaçta başka oturumların değişiklikleri var (dashboard, reports, pdks) — kapsam dışı.

## YASAK
Dosya düzenleme (rapor hariç) · `npx convex …` · commit/push · canlı DB/Convex · arka planda sunucu.

## Rapor
`/tmp/pub-p5/REVIEW-r503.md`: ilk satır `**commit'e engel: var|yok**`, kapılar, bulgular `ID | Ciddiyet | file:line | sorun | senaryo | öneri`. `worker_done` ≤10 satır.
