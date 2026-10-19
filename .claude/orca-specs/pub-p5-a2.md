# Görev: A2 — publicUser alan listesi tek kaynaktan (validator) türesin

## Hedef (test edilebilir)
`convex/lib/publicUser.ts`'te `toPublicUser` alanlarını elle değil `publicUserValidator.fields`'tan türetsin; böylece validator'a eklenmeyen alan asla dönmesin ve
validator ↔ toPublicUser kayması (canlıda `currentUser` ReturnsValidationError → tüm girişler kırılır) imkânsız olsun. Davranış bugünküyle AYNI.

## Bağlam
`convex/lib/publicUser.ts` (commit 3ad9529): `publicUserValidator = v.object({...14 alan})`, `PublicUser = Pick<Doc<"users">, ...>` ve `toPublicUser` her alanı ayrı spread ediyor.
Denetim `/tmp/pub-p5/REVIEW-b1.md` A2. Testler `convex/lib/publicUser.test.ts`, `convex/users.test.ts`.

## Yapılacaklar
1. `PublicUser = Infer<typeof publicUserValidator>` (`convex/values`). `toPublicUser`: `Object.keys(publicUserValidator.fields)` üzerinden dön, `user[key] !== undefined` olanları kopyala (izinli liste korunur).
   Tip güvenliği: `any`/`as any` YASAK; gerekiyorsa `keyof PublicUser` daraltması + tek, gerekçeli `as PublicUser` (yorumla) kabul.
2. Test: (a) tam dolu users belgesi (+ setupToken/tokenExpiresAt/firstCompanyName + bilinmeyen ekstra alan) → çıktı anahtarları ⊆ validator alanları ve gizliler yok; (b) çıktıyı `publicUserValidator`'a karşı doğrula
   (`convex/values` içinde çalışma-zamanı doğrulayıcı yoksa: her çıktı anahtarının `publicUserValidator.fields`'ta olduğunu ve undefined değer olmadığını assert et); (c) mevcut testler aynen geçsin.

## Ownership (YALNIZ bunlar)
`convex/lib/publicUser.ts`, `convex/lib/publicUser.test.ts`. Başka her şey DOKUNMA (paralelde başka worker lib/auth.ts, users.ts, invites.ts üzerinde).

## YASAK
`npx convex …` · commit/push · canlı DB/Convex · `package.json` · arka planda sunucu.

## Kapılar (kendin koş)
`node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` ve `-p tsconfig.app.json` → 0 · `node_modules/.bin/eslint convex/lib/publicUser.ts convex/lib/publicUser.test.ts` → 0 ·
`node_modules/.bin/vitest run convex/lib/publicUser.test.ts convex/users.test.ts` → yeşil.

## Rapor
`worker_done` ≤6 satır: file:line, testler, kapılar. Ayrıntı `/tmp/pub-p5/fix-a2.md`.
