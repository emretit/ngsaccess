# Görev: R5-01 — davet token'ı yalnız e-postayla gitsin (GÜVENLİK, orta)

## Hedef (test edilebilir)
`invites.create` istemciden çağrılamaz olsun (internal); davet token'ı yalnız `sendUserInviteEmail` action'ı içinde kalıp e-postaya yazılsın,
hiçbir public fonksiyonun dönüşünde / hata metninde / log'unda görünmesin. Yetki kuralları (super_admin / proje sahibi / o projede üye project_admin) aynen korunsun.

## Sorun (denetim R5-01, `/tmp/pub-p5/REVIEW.md`)
`convex/invites.ts:15` `create` = public `authedMutation`, `returns: v.string()` → token'ı çağırana döner. project_admin, başkasının e-postası için davet açıp
token'ı istemciden doğrudan alır, o adresle signUp yapar → `consume` `verifyUser` ile adresi "doğrulanmış" işaretler (adres squat). Token e-posta sahipliği kanıtı olmalı.
Tek gerçek çağıran: `convex/actions/sendEmail.ts:213-260` `sendUserInviteEmail` (authedAction, `ctx.user` var) → `ctx.runMutation(api.invites.create, …)`.
Frontend `api.invites.create`'i doğrudan çağırmıyor (grep: yalnız sendEmail.ts). Mobil kullanmıyor.

## Bağlam (önce oku)
Repo `/Users/emreaydin/ngsaccess`. ÖNCE `convex/_generated/ai/guidelines.md`. Kod: `convex/invites.ts` (create :15-74), `convex/actions/sendEmail.ts` (:200-262 + `sendResendEmail` dönüşü),
`convex/lib/customFunctions.ts` (`authedMutation`: verified=false reddi; aynı güvenceyi internal'de elle uygula), `convex/invites.test.ts` (fixture deseni: kayıtlı `_handler`, in-memory db).
Convex kayıtlı fonksiyonlarında `isInternal` / `isPublic` bayrakları var (`node_modules/convex/dist/esm/server/impl/registration_impl.js:125-217`).

## Yapılacaklar
1. `convex/invites.ts`: `create` → `internalMutation`; yeni arg `callerId: v.id("users")`. Caller'ı `ctx.db.get(callerId)` ile yükle; yoksa ya da `verified === false` ise reddet
   (authedMutation'ın verdiği güvence). Yetki kontrolü, rate limit (`limiter.limit(ctx, "inviteCreate", { key: callerId, throws: true })`), eski davetleri iptal, insert — mantık AYNI.
   `returns: v.string()` kalabilir (yalnız internal çağırana döner). JSDoc'u güncelle ("token yalnız action içinde kalır, istemciye dönmez").
2. `convex/actions/sendEmail.ts`: `internal.invites.create` + `callerId: ctx.user._id`. Action dönüşü `{ success, error? }` kalsın; token / setupUrl dönüşe, `error` metnine, `console.*`'a
   GİRMESİN (`sendResendEmail` hata yolunu kontrol et; Resend yanıt gövdesi URL'yi yansıtıyorsa error'a koyma). Yorumları güncelle. Kullanılmayan `api` importu kalırsa temizle.
3. Repo genelinde `api.invites.create` referansı kalmasın (`grep -rn "invites.create" src convex mobile` → yalnız internal kullanım + yorumlar).
4. Test (`convex/invites.test.ts`'e yeni `describe`, mevcut consume testlerine DOKUNMA; fixture'ı gerekirse genişlet):
   (a) `create.isInternal === true` ve `create.isPublic` true değil; (b) super_admin caller → token döner + insert e-postası küçük harf; (c) proje sahibi (ownerId) → izin;
   (d) o projeye üye project_admin → izin; (e) üye OLMAYAN project_admin → red, insert yok; (f) project_user → red; (g) caller yok / `verified:false` → red;
   (h) aynı e-postanın kullanılmamış eski davetleri `used:true` olur. Rate limiter'ı `vi.mock('./lib/rateLimit', …)` ile sahtele (canlı çağrı yok).
5. Rapor notu: R5-05 (consume'daki `verifyUser`) bu düzeltmeyle meşru e-posta kanıtına dönüşüyor mu — değerlendir, 1 satır yaz. R5-03'ü (önceden açılmış orphan hesap) DÜZELTME, durumunu not et.

## Ownership (YALNIZ bunlar)
`convex/invites.ts`, `convex/invites.test.ts`, `convex/actions/sendEmail.ts`.
`convex/schema.ts`, `convex/auth.ts`, `convex/users.ts`, `convex/lib/*`, `src/**`, `mobile/**`, `convex/_generated/**` — DOKUNMA (ağaçta başka oturumların işi var).

## YASAK
`npx convex …` (deploy/codegen dahil) · commit/push · canlı DB/Convex/Supabase okuma-yazma · `package.json` · arka planda açık sunucu.

## Kapılar (kendin koş)
1. `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` ve `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` → 0 (kapsam dışı kırmızıyı raporla, düzeltme).
2. `node_modules/.bin/eslint convex/invites.ts convex/invites.test.ts convex/actions/sendEmail.ts` → 0.
3. `node_modules/.bin/vitest run convex/invites.test.ts` → mevcut consume testleri + yeni (a)-(h) yeşil.
4. Uyumluluk notu: eski web ↔ yeni backend (web `sendUserInviteEmail` action'ını çağırıyor; imza değişmiyor mu?), deploy sırası.

## Rapor
`worker_done` ≤10 satır: file:line, test listesi + sonuç, kapılar, grep kanıtı, R5-05/R5-03 notu. Ayrıntı `/tmp/pub-p5/fix-r501.md`.
