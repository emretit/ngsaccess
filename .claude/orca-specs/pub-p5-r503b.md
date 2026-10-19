# Görev: R5-03 ek — devralmada doğrulama token'ını sil (B2) + uçtan uca claim testi (T1)

## Hedef (test edilebilir)
`resetClaimedAccount` devralınan hesabın `setupToken` ve `tokenExpiresAt` alanlarını da temizlesin (squatter önceden okuduğu token'la claim sonrası hesabı doğrulayamasın);
claim testi gerçek `setupAccountState`/`resetClaimedAccount` handler'larıyla uçtan uca koşsun.

## Bağlam
Repo `/Users/emreaydin/ngsaccess`. Denetim `/tmp/pub-p5/REVIEW-r503.md` B2 + T1. Kod: `convex/invites.ts` (`resetClaimedAccount` ~:169-183 patch'i; `claimSetupAccount` ~:186-210;
yardımcılar `getOpenSetupInvite`, `isFreshSetupAccount` en üstte). Test: `convex/invites.test.ts` (claim testleri ~:221-251, `makeQuery` yardımcısı).
`emailVerification.verifyEmail` token'la `by_setup_token` index'inden kullanıcıyı bulup `verifyUser` çağırır.

## Yapılacaklar
1. `resetClaimedAccount` patch'ine `setupToken: undefined, tokenExpiresAt: undefined` ekle (role/verified'a DOKUNMA).
2. T1: claim testinde action'ın `runQuery`/`runMutation`'ını aynı in-memory fixture üzerinde GERÇEK `setupAccountState._handler` / `resetClaimedAccount._handler`'a yönlendir;
   zincir: squat (verified:false, rolsüz, üyeliksiz, setupToken:'old') → claim → modify(id=invite.email)+invalidate(userId) → setupToken/tokenExpiresAt/name/firstCompanyName temiz → consume (gerçek handler) → rol davetteki, verified true, üyelik var.
   Ek: `resetClaimedAccount` reddederse (state sorgusundan sonra hesap doğrulanmış) `modifyAccountCredentials` ve `invalidateSessions` ÇAĞRILMAZ.
3. Mevcut testleri zayıflatma; yalnız ekle/güncelle.

## Ownership (YALNIZ bunlar)
`convex/invites.ts`, `convex/invites.test.ts`. Başka her şey DOKUNMA (paralelde başka worker `convex/users.ts`, `convex/lib/publicUser.ts`, `convex/users.test.ts` üzerinde çalışıyor).

## YASAK
`npx convex …` · commit/push · canlı DB/Convex · `package.json` · arka planda sunucu.

## Kapılar (kendin koş)
`node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` → 0 · `node_modules/.bin/eslint convex/invites.ts convex/invites.test.ts` → 0 · `node_modules/.bin/vitest run convex/invites.test.ts` → yeşil.

## Rapor
`worker_done` ≤8 satır: file:line, test sayısı önce/sonra, kapılar. Ayrıntı `/tmp/pub-p5/fix-r503b.md`.
