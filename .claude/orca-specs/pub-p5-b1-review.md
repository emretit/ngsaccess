# Görev: B1 + R5-03b denetimi (SALT OKUMA) — iki AYRI hüküm ver

## Paket A — B1 (ÖNCELİKLİ, ayrı yayınlanacak)
Diff: `git diff -- convex/users.ts` + yeni `convex/lib/publicUser.ts`, `convex/users.test.ts`, `convex/lib/publicUser.test.ts` (Codex luna yazdı). Spec `.claude/orca-specs/pub-p5-b1.md`;
CEO şartı: yasaklı liste DEĞİL izinli alan listesi + `currentUser` returns validator. Worker raporu `/tmp/pub-p5/fix-b1.md`.
Açık: `currentUser` ham users belgesi dönüyordu → `setupToken` okunup `emailVerification.verifyEmail` ile e-posta sahipliği olmadan doğrulama (requestVerification → currentUser → verifyEmail).
Kontrol: (1) Saldırı zinciri artık kopuk mu — `setupToken`'ı istemciye döndüren BAŞKA yol var mı (tüm `convex/**` public/admin query/mutation/action dönüşleri, hata metinleri, `users.adminList`, `lib/adminLists.ts`,
auditLog, http.ts). (2) allowlist + validator schema (`convex/schema.ts` users) ile tutarlı mı; `firstCompanyName` dışarıda — frontend/akış kırılıyor mu (`AuthProvider.tsx`, `src/components/admin/**`, `user-types.ts`, onboarding).
(3) `authedAction` (`convex/lib/customFunctions.ts:104`) `api.users.currentUser`'ı `as Doc<"users">` cast'liyor → artık eksik alanlar; bunu kullanan action'lar etkileniyor mu (`ctx.user.<alan>` taraması).
(4) `getProfile` proje kapsamı doğru mu (project_admin başka projedeki kullanıcıyı göremez; super_admin hepsini). (5) Eski web ↔ yeni backend: canlı web bundle `currentUser`'dan hangi alanları okuyor — kaldırılan alan okunuyor mu.
(6) Testler gerçek handler'ları mı koşuyor.

## Paket B — R5-03b (R5-03 eki)
Diff: `git diff -- convex/invites.ts convex/invites.test.ts` içindeki `resetClaimedAccount` token temizliği (B2) + uçtan uca claim testi (T1). R5-03'ün geri kalanı önceki denetimde onaylandı (`/tmp/pub-p5/REVIEW-r503.md`).
Kontrol: B2 doğru mu (role/verified'a dokunmuyor), T1 gerçekten gerçek handler'larla zincir kuruyor mu, "reset reddederse modify/invalidate çağrılmaz" kanıtlı mı.

## Kapılar (kendin koş)
`node_modules/.bin/tsc --noEmit -p tsconfig.app.json` · `-p convex/tsconfig.json` · `node_modules/.bin/eslint convex/users.ts convex/users.test.ts convex/lib/publicUser.ts convex/lib/publicUser.test.ts convex/invites.ts convex/invites.test.ts` ·
`node_modules/.bin/vitest run convex/users.test.ts convex/lib/publicUser.test.ts convex/invites.test.ts`. Ağaçta başka oturumların işi var — kapsam dışı.

## YASAK
Dosya düzenleme (rapor hariç) · `npx convex …` · commit/push · canlı DB/Convex yazma · arka planda sunucu. (Canlı web bundle'ı `curl` ile OKUMAK serbest: https://ngsplus.app, lazy chunk'lar dahil.)

## Rapor
`/tmp/pub-p5/REVIEW-b1.md`: ilk iki satır `**A (B1) commit'e engel: var|yok**` ve `**B (R5-03b) commit'e engel: var|yok**`, kapılar, bulgular `ID | Ciddiyet | file:line | sorun | senaryo | öneri`. `worker_done` ≤10 satır.
