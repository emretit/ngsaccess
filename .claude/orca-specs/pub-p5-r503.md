# Görev: R5-03 — davet akışı, aynı e-postayla açılmış DOĞRULANMAMIŞ hesabı devralsın (GÜVENLİK)

## Hedef (test edilebilir)
Davet token'ı (artık yalnız e-postada → sahiplik kanıtı) ile, davet e-postasına ait **doğrulanmamış + rolsüz + üyeliksiz** password hesabı varsa davetli yeni şifre belirleyip
o hesabı devralabilsin (eski oturumlar düşer, sonra normal signIn + consume). Doğrulanmış / rolü olan / üyeliği olan hesaba ASLA dokunulmasın. Hesap SİLME yok.

## Karar (CEO oturumu, Emre adına, 2026-10-19)
Silme yok; devralma: yeni şifre + verifyUser (consume içinde zaten var) + oturumları düşür. Doğrulanmış hesaplara dokunma.

## Bağlam (önce oku)
Repo `/Users/emreaydin/ngsaccess`. ÖNCE `convex/_generated/ai/guidelines.md`. Denetim R5-03: `/tmp/pub-p5/REVIEW.md`.
- `convex/invites.ts`: `verify` (public query), `consume` (:~115; `isNewSetupAccount` = `verified===false && role===undefined && üyelik yok` → rol ata + `verifyUser`).
- `convex/auth.ts`: Password provider; signUp `verified:false` yazar; account id = e-posta (`params.email`, olduğu gibi). Var olan id'ye signUp → "account already exists" → bugün davetli takılıyor (squat).
- `@convex-dev/auth/server` (v0.0.91): `modifyAccountCredentials(ctx: ActionCtx, { provider: "password", account: { id, secret } })`, `invalidateSessions(ctx: ActionCtx, { userId })`
  (`node_modules/@convex-dev/auth/dist/server/implementation/index.d.ts:297-350`). `authAccounts` index: `providerAndAccountId` [provider, providerAccountId].
- `src/pages/UserSetup.tsx`: "yeni hesap" modunda `signIn('password', {flow:'signUp'})` → auth bekle → `consumeInvite`. `inviteSetupError` hata kodu→Türkçe metin eşlemesi.
- `convex/onboarding.ts` `ensureProjectForNewUser`: üyelik varsa proje açmaz (consume üyelik ekler → squatter'ın `firstCompanyName`'i proje olmaz, yine de temizle).
- Test deseni: `convex/invites.test.ts` (kayıtlı `_handler` + in-memory ctx; `vi.mock` ile modül sahteleme). Projede RTL/jsdom YOK, EKLENMEZ.

## Sözleşme (aynen uygula)
1. `convex/invites.ts`'e public **action** `claimSetupAccount` — args `{ token: v.string(), password: v.string() }`, returns `v.object({ flow: v.union(v.literal("signUp"), v.literal("signIn")) })`.
   a. `ctx.runQuery(internal.invites.setupAccountState, { token })` (yeni **internalQuery**): davet yok/used/süresi dolmuş → `ConvexError({code:"INVITE_INVALID"})`; `type==="reset"` → `INVITE_WRONG_TYPE`.
      `authAccounts` `providerAndAccountId` ile (`"password"`, `invite.email`) hesabı bul. Yoksa `{ state: "none", email }`. Varsa user'ı yükle:
      `verified===false && role===undefined && userProjects üyeliği yok` → `{ state: "claimable", email, userId }`; aksi → `{ state: "taken" }`.
   b. Şifre politikası sunucuda (UI ile aynı): ≥8, büyük, küçük, rakam → değilse `INVITE_WEAK_PASSWORD`.
   c. `none` → `{ flow: "signUp" }` (hiçbir yazma yok). `taken` → `ConvexError({code:"INVITE_ACCOUNT_EXISTS"})` (mevcut hesap modunu kullanmalı).
   d. `claimable` → `modifyAccountCredentials(ctx, { provider:"password", account:{ id: email, secret: password } })` → `invalidateSessions(ctx, { userId })` →
      `ctx.runMutation(internal.invites.resetClaimedAccount, { userId })` (yeni **internalMutation**: user hâlâ claimable mı yeniden kontrol et, değilse `INVITE_ACCOUNT_EXISTS`;
      claimable ise `firstCompanyName` ve `name`'i kaldır (patch `undefined`), `updatedAt`). Sıra önemli: kontrolü yazmadan ÖNCE yap; resetClaimedAccount'u
      modify'dan ÖNCE çağırıp yeniden-kontrol + temizlik yapmak da kabul (gerekçeni rapora yaz). → `{ flow: "signIn" }`.
   e. Token'ı `used` YAPMA (consume yapar). verified'a DOKUNMA (consume `verifyUser` çağırır).
2. `src/pages/UserSetup.tsx`: "yeni hesap" modunda (existingAccount=false) signIn'den ÖNCE `useAction(api.invites.claimSetupAccount)({ token, password })` → dönen `flow` ile
   `signIn('password', { email, password, flow })`. Mevcut hesap modu DEĞİŞMEZ. `inviteSetupError`'a `INVITE_ACCOUNT_EXISTS` ("Bu e-postayla doğrulanmış bir hesap var; 'Mevcut hesabım var' ile giriş yapın.")
   ve `INVITE_WEAK_PASSWORD` Türkçe metinleri. Ekran metni/tasarım başka değişmez. `runSetup` `signOutOnError: !existingAccount` kalır.

## Testler
`convex/invites.test.ts`'e (mevcutlara DOKUNMA, `makeQuery` yardımcısını kullan/genişlet):
- `setupAccountState`: hesap yok → none; squat (verified:false, rol yok, üyelik yok) → claimable; verified:true → taken; verified:undefined (eski kullanıcı) → taken; rolü olan → taken; üyeliği olan → taken;
  used/expired → INVITE_INVALID; reset → INVITE_WRONG_TYPE.
- `claimSetupAccount` (`vi.mock('@convex-dev/auth/server', …)` ile modify/invalidate sahte; `runQuery`/`runMutation` sahte): squat → modify(id=invite.email) + invalidate(userId) + reset çağrılır, flow signIn;
  taken → hiçbiri çağrılmaz, INVITE_ACCOUNT_EXISTS; none → flow signUp, yazma yok; zayıf şifre → INVITE_WEAK_PASSWORD, yazma yok.
- `resetClaimedAccount`: claimable değilse reddeder ve patch yok; claimable ise firstCompanyName/name temizlenir, role/verified değişmez.
- Uçtan uca mantık: squat → claim → consume (mevcut consume handler'ı) → rol davetteki, verified true, üyelik eklendi.
`src/pages/UserSetup.test.tsx`: yeni hata kodlarının metin eşlemesi.
`getAuthUserId` mock'u gerekiyorsa mevcut testlerin gerçek-handler yaklaşımını bozma.

## Ownership (YALNIZ bunlar)
`convex/invites.ts`, `convex/invites.test.ts`, `src/pages/UserSetup.tsx`, `src/pages/UserSetup.test.tsx`.
`convex/auth.ts`, `convex/schema.ts`, `convex/lib/**`, `convex/_generated/**`, `AuthProvider.tsx`, diğer her şey DOKUNMA (ağaçta başka oturumların işi var).

## YASAK
`npx convex …` (deploy/codegen dahil) · commit/push · canlı DB/Convex okuma-yazma · `package.json` · RTL/jsdom · arka planda sunucu.

## Kapılar (kendin koş)
`node_modules/.bin/tsc --noEmit -p tsconfig.app.json` ve `-p convex/tsconfig.json` → 0 · `node_modules/.bin/eslint convex/invites.ts convex/invites.test.ts src/pages/UserSetup.tsx src/pages/UserSetup.test.tsx` → 0 ·
`node_modules/.bin/vitest run convex/invites.test.ts src/pages/UserSetup.test.tsx` → yeşil. (Not: `_generated/api.d.ts` modül tiplerinden türer; yeni export'lar codegen'siz tiplenir — tiplenmezse rapora yaz, codegen KOŞMA.)

## Rapor
`worker_done` ≤10 satır: file:line, sıra/yarış gerekçesi, test listesi + sonuç, kapılar, kalan risk. Ayrıntı `/tmp/pub-p5/fix-r503.md`.
