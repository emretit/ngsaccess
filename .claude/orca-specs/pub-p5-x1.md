# Görev: X1 — çalışan mobil hesap kaydı (passwordHash + setupToken) kimliksiz sızıyor (GÜVENLİK, yüksek)

## Hedef (test edilebilir)
`employeeAuth` belgesinin `passwordHash`, `setupToken`, `sessionToken` ve benzeri gizli alanları hiçbir public fonksiyondan dönmesin. Canlı web (eski bundle) kırılmasın:
`EmployeeSetup` sayfası `api.employeeAuth.getByToken` çağırıp yalnız `authRecord.tokenExpiresAt` okuyor → bu public query AYNI İSİMLE kalır ama yalnız güvenli DTO döner.

## Açık (denetim `/tmp/pub-p5/REVIEW-b1.md` X1, koordinatör kodda doğruladı)
`convex/employeeAuth.ts:16-24` `getByEmployee` ve `:26-34` `getByToken` — kimliksiz public `query`, returns validator yok, `employeeAuth` belgesinin tamamını döner.
`employeeId` bilen herkes `getByEmployee` ile `setupToken` (+ `passwordHash`) okur → `actions/setPassword.setEmployeePassword({token})` ile çalışanın mobil hesabını ele geçirir.
Çağıranlar: `convex/actions/sendEmail.ts:163` (`api.employeeAuth.getByEmployee`), `convex/actions/setPassword.ts:21` (`api.employeeAuth.getByToken`), `src/pages/EmployeeSetup.tsx:28` (`getByToken`, yalnız `tokenExpiresAt`).
Mobil `mobile/**` bunları çağırmıyor (grep'le doğrula).

## Yapılacaklar
1. `getByEmployee` → `internalQuery` (aynı isim); `sendEmail.ts` `internal.employeeAuth.getByEmployee` kullansın.
2. Yeni `internalQuery` `getByTokenInternal` (ham kayıt; yalnız action'lar için); `setPassword.ts` bunu kullansın.
3. Public `getByToken` AYNI isim ve args kalsın; dönüş: `v.union(v.null(), v.object({ tokenExpiresAt: v.optional(v.string()) }))` — İZİNLİ alan listesi, başka hiçbir alan yok.
   (Eski ve yeni web `authRecord.tokenExpiresAt` okumaya devam eder; frontend değişikliği gerekmez — `src/pages/EmployeeSetup.tsx` tsc'den geçmeli, DOKUNMA.)
4. Tarama: `grep -rn "passwordHash\|sessionToken\|setupToken" convex` → herhangi bir PUBLIC query/mutation/action dönüşüne (veya hata metnine) bu alanlar gidiyor mu; `employeeAuth`/`employeeSessions` belgesini ham döndüren başka public fonksiyon var mı.
   Ownership içindeyse düzelt, dışındaysa rapora file:line yaz.
5. Test `convex/employeeAuth.test.ts` (yeni; desen `convex/invites.test.ts` — kayıtlı `_handler` + in-memory ctx): `getByEmployee.isInternal === true`; `getByTokenInternal.isInternal === true`;
   public `getByToken` → yalnız `tokenExpiresAt` anahtarı (passwordHash/setupToken/email/employeeId YOK), kayıt yoksa null. Varsa `setPassword` için mevcut test desenine uy.

## Ownership (YALNIZ bunlar)
`convex/employeeAuth.ts`, `convex/actions/sendEmail.ts` (yalnız :163 çağrısı), `convex/actions/setPassword.ts` (yalnız :21 çağrısı), yeni `convex/employeeAuth.test.ts`.
`src/**`, `mobile/**`, `convex/schema.ts`, `convex/lib/**`, `convex/users.ts`, `convex/invites*` — DOKUNMA (ağaçta başka işler var).

## YASAK
`npx convex …` · commit/push · canlı DB/Convex · `package.json` · arka planda sunucu.

## Kapılar (kendin koş)
`node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` ve `-p tsconfig.app.json` → 0 · `node_modules/.bin/eslint convex/employeeAuth.ts convex/employeeAuth.test.ts convex/actions/sendEmail.ts convex/actions/setPassword.ts` → 0 ·
`node_modules/.bin/vitest run convex/employeeAuth.test.ts` → yeşil.

## Rapor
`worker_done` ≤10 satır: file:line, tarama sonucu, eski-web uyumluluğu, testler, kapılar. Ayrıntı `/tmp/pub-p5/fix-x1.md`.
