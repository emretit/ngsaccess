# Görev: B-1 sertleştirme — silinmiş oturumun JWT'si her uçta anında geçersiz olsun (GÜVENLİK)

## Hedef (test edilebilir)
Web kullanıcı kimliği çözülürken oturum belgesi de doğrulansın: JWT geçerli olsa bile `authSessions` belgesi yoksa (signOut / `invalidateSessions` / devralma sonrası) ya da başka kullanıcıya aitse
istek KİMLİKSİZ sayılsın. Normal oturumlu kullanıcı için davranış aynı.

## Neden (CEO kararı, denetim `/tmp/pub-p5/REVIEW-b1.md` B-1)
`@convex-dev/auth` `getAuthUserId` JWT subject'ten userId'yi oturum kontrolü YAPMADAN alır (`node_modules/@convex-dev/auth/dist/server/implementation/index.js` ~:342-348); JWT ömrü 1 saat.
`invites.claimSetupAccount` → `invalidateSessions` squatter'ın refresh oturumlarını siler ama elindeki JWT ≤1 saat çalışmaya devam eder. `getAuthSessionId(ctx)` aynı JWT'den sessionId verir.

## Yapılacaklar
1. `convex/lib/auth.ts`'e `getValidAuthUserId(ctx: QueryCtx | MutationCtx): Promise<Id<"users"> | null>`: `getAuthUserId` → null ise null; `getAuthSessionId` → null ise null;
   `ctx.db.get(sessionId)` yoksa veya `session.userId !== userId` ise null; değilse userId. (`expirationTime`/`Date.now()` KONTROLÜ EKLEME — sorgu önbelleğini bozar; süresi dolan oturumun JWT'si zaten yenilenemez.)
2. Bu yardımcıyı kullan: `convex/lib/auth.ts` `getCurrentUser` (:12) ve `getCurrentUserOrNull` (:36); doğrudan `getAuthUserId(` çağıran yerler: `convex/userProjects.ts:9`, `:32`, `convex/users.ts:215`, `convex/invites.ts:226` (consume).
   Sonra `grep -rn "getAuthUserId(" convex --glob '!_generated/**'` → yalnız `lib/auth.ts` içindeki yardımcı kalsın (testler hariç). `customFunctions.ts` sarmalayıcıları zaten lib/auth üzerinden geçiyor — doğrula.
3. Testler: yeni `convex/lib/auth.test.ts` (ya da mevcutsa genişlet): session yok → null; session başka kullanıcıya ait → null; JWT yok → null; geçerli → userId; `getCurrentUser` session silinince "Giriş yapmanız gerekiyor".
   Mevcut testler (`convex/invites.test.ts`, `convex/users.test.ts`, `convex/adminSettingsGuards.test.ts` vb.) `ctx.auth.getUserIdentity` subject'ini `"<userId>|<sessionId>"` biçiminde veriyor ve in-memory `db.get`'i sahteliyor:
   bu testlerin fixture'larına oturum belgesini ekle (yalnız fixture; assert'leri zayıflatma). Tüm suite yeşil kalmalı.
4. `invites.consume` için ek test: squatter oturumu `invalidateSessions` ile silinmiş (db'de yok) ama JWT'si var → `INVITE_AUTH_REQUIRED`.

## Ownership (YALNIZ bunlar)
`convex/lib/auth.ts`, yeni `convex/lib/auth.test.ts`, `convex/userProjects.ts`, `convex/users.ts` (yalnız :215 çağrısı), `convex/invites.ts` (yalnız consume'daki çağrı), ve fixture güncellemesi gereken `convex/**/*.test.ts` dosyaları (yalnız fixture).
`convex/lib/publicUser.ts` (paralelde başka worker), `convex/employeeAuth*`, `convex/actions/*`, `convex/schema.ts`, `src/**`, `mobile/**` — DOKUNMA.

## YASAK
`npx convex …` · commit/push · canlı DB/Convex · `package.json` · arka planda sunucu.

## Kapılar (kendin koş)
`node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` ve `-p tsconfig.app.json` → 0 · `node_modules/.bin/eslint convex/lib/auth.ts convex/lib/auth.test.ts convex/userProjects.ts convex/users.ts convex/invites.ts` + dokunduğun testler → 0 ·
`node_modules/.bin/vitest run convex` → TAMAMI yeşil (başka oturumun kırmızısını ayır, raporla).

## Rapor
`worker_done` ≤10 satır: file:line, değişen çağrı yerleri, fixture'ı güncellenen testler, performans notu (istek başına +1 db.get), kapılar. Ayrıntı `/tmp/pub-p5/fix-b1-session.md`.
