# Görev: P5 polish (backend) — invites.list düzeltmesi + test temizliği

## Hedef (test edilebilir)
`invites.list` runtime'da returns-validator hatası vermesin ve token'ı asla döndürmesin; `convex/invites.test.ts` fixture tekrarı tek yardımcıya insin.
`create` / `consume` / `verify` / `listExpired` DAVRANIŞI DEĞİŞMEZ (yalnız test yapısı).

## Bağlam (önce oku)
Repo `/Users/emreaydin/ngsaccess`. ÖNCE `convex/_generated/ai/guidelines.md`. Denetim: `/tmp/pub-p5/REVIEW-r501.md` B-02.
`convex/invites.ts` `list` (~:215-240): `superAdminMutation`, `.collect()` ham doc döndürüyor; `returns` validator'ı yalnız `_id,email,projectId,role,expiresAt,used,createdAt` →
ham doc'taki `token`, `type`, `createdBy`, `_creationTime` fazla alan → Convex dönüş doğrulaması patlar. Repo'da çağıran yok (`grep -rn "invites.list" src convex mobile` → yalnız listExpired).
`invites` index'leri: yalnız `by_token`, `by_email` (`convex/schema.ts`'e DOKUNMA — paylaşımlı).

## Yapılacaklar
1. `list`: `superAdminQuery`'ye çevir (okuma işlemi; çağıran yok). Satırları validator'daki alanlara `map`le (token ASLA dönmez). projectId süzmesi mevcut gibi kalabilir
   (index yok, schema'ya dokunma); `.collect()` yerine makul üst sınır (`.take(500)`) kullan ve JSDoc'a yaz.
2. `convex/invites.test.ts`: `fixture` ve `createFixture` içindeki kopya `query`/`IndexBuilder` mock'unu tek `makeQuery(...)` yardımcısına çıkar (createFixture'ın `.filter` desteği korunsun).
   Gereksiz `isPublic` assert'ini sil (`isInternal === true` yeter). Mevcut tüm testler aynen geçsin (30 → 30 + yeni).
3. Yeni test: `list` handler'ı (kayıtlı `_handler`, super_admin ctx fixture'ı ile) → dönen nesnelerde `token` / `type` / `createdBy` / `_creationTime` yok; projectId süzmesi çalışıyor.
   Gerekirse `superAdminQuery` sarmalayıcısının ctx ihtiyacını mevcut desenle sahtele (`convex/adminSettingsGuards.test.ts`'e bak).

## Ownership (YALNIZ bunlar)
`convex/invites.ts`, `convex/invites.test.ts`. Başka her şey DOKUNMA (ağaçta başka oturumların işi var: cardReadings, lib/pdks*, reportAttendance*, src/lib/reports/*).

## YASAK
`npx convex …` · commit/push · canlı DB/Convex okuma-yazma · `package.json` · arka planda sunucu.

## Kapılar (kendin koş)
`node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` → 0 · `node_modules/.bin/eslint convex/invites.ts convex/invites.test.ts` → 0 · `node_modules/.bin/vitest run convex/invites.test.ts` → yeşil.
(`tsconfig.app.json`'da `src/lib/reports/rows.test.ts` kırmızısı başka oturumun — kapsam dışı.)

## Rapor
`worker_done` ≤8 satır: file:line, test sayısı önce/sonra, kapılar. Ayrıntı `/tmp/pub-p5/polish-be.md`.
