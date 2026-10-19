# Görev: B1 — kullanıcı belgesindeki doğrulama token'ı istemciye sızmasın (GÜVENLİK, yüksek)

## Hedef (test edilebilir)
Hiçbir public/admin users sorgusu `setupToken` ve `tokenExpiresAt` alanlarını döndürmesin; böylece kişi kendi doğrulama token'ını okuyup `emailVerification.verifyEmail` ile
e-postasını sahiplik kanıtı olmadan doğrulayamasın. Diğer alanlar ve frontend davranışı aynı kalsın.

## Açık (denetim `/tmp/pub-p5/REVIEW-r503.md` B1, koordinatör kodda doğruladı)
- `convex/users.ts:27-33` `currentUser` (optionalAuthQuery, returns validator yok) → `ctx.user`'ı aynen döner (setupToken dahil).
  Saldırı: başkasının e-postasıyla signUp → `requestVerification({email})` (`convex/emailVerification.ts:21`) token'ı users'a yazar → `currentUser`'dan oku → `verifyEmail({token})` → verified=true.
- `convex/users.ts:46-51` `getProfile` (adminQuery) → `ctx.db.get(userId)` ham belge, proje kapsamı yok.
- `convex/users.ts:145-165` `list` (adminQuery) → ham belgeler.
- Frontend: `src/components/auth/AuthProvider.tsx:13` `UserProfile = FunctionReturnType<typeof api.users.currentUser>`; `src/components/admin/types/user-types.ts:8` `users.list` dönüş tipi.
  `convex/lib/customFunctions.ts:104-110` `authedAction` `api.users.currentUser`'ı `as Doc<"users">` cast'ler (DOKUNMA; hiçbir action `ctx.user.setupToken` kullanmıyor — grep'le doğrula ve rapora yaz).

## Yapılacaklar
1. Yeni `convex/lib/publicUser.ts`: `toPublicUser(user: Doc<"users">)` → `setupToken` ve `tokenExpiresAt` HARİÇ belge (tip `Omit<Doc<"users">, "setupToken" | "tokenExpiresAt">`). ESLint'te uyarı bırakmayan yazım (repodaki `no-unused-vars` ayarına bak).
2. `currentUser`, `getProfile`, `list` çıktısını `toPublicUser` ile geçir. `getProfile`: super_admin dışı için yalnız çağıranın projelerindeki kullanıcılar (`getProjectIdsForUser` + `userProjects.by_project`/`by_user`; `list`'teki mantığı yeniden kullan), değilse `null`.
   Önce `grep -rn "users.getProfile" src convex mobile` — çağıran varsa davranışını raporla.
3. Repo genelinde başka public/admin fonksiyonun ham users belgesi döndürüp döndürmediğini tara (`grep -rn 'query("users")\|db.get(' convex` → dönüşe ham user giden yerler). Bulursan AYNI yardımcıyla düzelt (yalnız Ownership'teki dosyalarda),
   Ownership dışındaysa düzeltme, rapora file:line yaz.
4. Test `convex/users.test.ts` (yeni): kayıtlı `_handler`'lar + in-memory ctx (desen: `convex/invites.test.ts`, gerekirse `vi.mock('./lib/customFunctions', …)` ile sarmalayıcıyı sahtele):
   currentUser → setupToken/tokenExpiresAt YOK, diğer alanlar (email, role, verified, name) VAR; list (super_admin + project_admin yolları) → gizli alan yok; getProfile → gizli alan yok + başka projedeki kullanıcı için project_admin'e `null`.
   `convex/lib/publicUser.ts` için birim test.

## Ownership (YALNIZ bunlar)
`convex/users.ts`, yeni `convex/lib/publicUser.ts`, yeni `convex/users.test.ts`, (gerekirse) yeni `convex/lib/publicUser.test.ts`.
`convex/invites*`, `convex/emailVerification.ts`, `convex/lib/customFunctions.ts`, `convex/schema.ts`, `src/**` — DOKUNMA (tsc hata verirse rapora yaz, koordinatör karar verir).

## YASAK
`npx convex …` · commit/push · canlı DB/Convex · `package.json` · arka planda sunucu.

## Kapılar (kendin koş)
`node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` ve `-p tsconfig.app.json` → 0 · `node_modules/.bin/eslint convex/users.ts convex/users.test.ts convex/lib/publicUser.ts` → 0 · `node_modules/.bin/vitest run convex/users.test.ts convex/lib/publicUser.test.ts` → yeşil.

## Rapor
`worker_done` ≤10 satır: file:line, tarama sonucu (başka sızıntı var mı), getProfile çağıranları, testler, kapılar. Ayrıntı `/tmp/pub-p5/fix-b1.md`.
