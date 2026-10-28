# Backend B6 — devices.ts provizyon + havuz mutation'ları lib'e (önce karakterizasyon)

ÖNCE `/Users/emreaydin/ngsaccess/.claude/orca-specs/backend-ortak.md` dosyasını oku ve harfiyen uygula (SAF TAŞIMA, use node, kapılar, yasaklar). Not: ortak dosyadaki "şu an devices.ts… commit'siz" cümlesi ESKİ; devices.ts artık temiz (roller commit'i ce09baf0 girdi).

Hedef: `convex/devices.ts` (1383 sat) içindeki 6 authedMutation'ın gövdesi lib'e taşınır, registered sarmalayıcılar aynı dosyada aynı ad/args/sarmalayıcı türüyle kalır; davranış birebir; devices.ts ~900 satıra iner.

Taşınacaklar (HEAD satırları):
- `create` (:119, 87 sat), `createIdePanel` (:567, 108), `createHikDevice` (:675, 116) → YENİ `convex/lib/deviceProvision.ts`
- `claimDevice` (:791, 60), `reassignDevice` (:851, 73), `releaseDevice` (:924, 73) → mevcut `convex/lib/devicePool.ts`'e ekle (`claimAdminDeviceCore` aynen kalır)

YERİNDE KALIR (dokunma): `list`, `getById`, `update`, `remove`, `updateLastSeen`, `applyGatewayHeartbeat`, `applyIsupStatus`, `confirmIsupOffline`, `regenerateApiToken`, `DEVICE_SECRET_FIELDS` ve tüm internal query/mutation'lar. Sebep: sır okuma/yazma gate'i ve cross-tenant pin bilinçli olarak devices.ts'te tek yerde (Faz 2c kararı). Taşınan gövde `DEVICE_SECRET_FIELDS` kullanıyorsa sabiti TAŞIMA; argüman olarak geç ya da o mutation'ı yerinde bırakıp rapora yaz.

## Adım 1 — karakterizasyon testi (taşımadan ÖNCE, HEAD kodunda yeşil)
YENİ `convex/devicesMutations.characterization.test.ts` (desen: `convex/processCardReading.characterization.test.ts`, `convex/deviceCenter.test.ts`, `convex/e1w4.test.ts`, rol fixture'ı için `convex/roles*.test.ts` / `convex/lib/permissions*.test.ts`). 6 mutation'ın her biri için en az:
1. `devices.manage` yetkisi olmayan proje üyesi (viewer rolü) → hata (ConvexError metni birebir assert)
2. Başka projenin cihazı/projesi → hata (metin birebir)
3. Mutlu yol: dönüş değeri + yazılan/patch'lenen dokümanların tam alan seti (devices, zones/doors/readers provizyonu, audit satırı varsa) + scheduler kuyruğu
4. super_admin + projeId'siz/havuz dalı (create, claim/reassign/release'te varsa)
Testleri HEAD'de (taşımadan önce) koş, yeşil olduğunu rapora yaz. Test assertion'ı taşımadan SONRA DEĞİŞMEZ.

## Adım 2 — saf taşıma
- Lib fonksiyonları `MutationCtx` + mevcut `ctx.user` tipini alır (customFunctions'tan gelen authed ctx tipi; `any` yasak). requirePermission/hasPermission/getProjectIdsForUser/isProjectAllowed çağrılarının SIRASI ve hata metinleri birebir.
- `convex/_generated` değişmemeli (`git status --porcelain convex/_generated` boş). Yeni lib dosyası registered fn tanımlamaz.
- deviceProvision.ts / devicePool.ts V8'de çalışır: "use node" YOK, node-yalnız import (crypto, ./hikGateway, ./gateway/*) YOK, dolaylı dahil.

Ownership (yalnız bunlara yaz):
- convex/devices.ts (yalnız 6 gövde + import satırları)
- YENİ convex/lib/deviceProvision.ts
- convex/lib/devicePool.ts (ekleme; claimAdminDeviceCore değişmez)
- YENİ convex/devicesMutations.characterization.test.ts
DOKUNMA: convex/adminDevices.ts, convex/lib/deviceHelpers.ts, lib/deviceSync.ts, lib/permissions.ts, schema.ts, src/**, diğer tüm dosyalar.

Vitest: `node_modules/.bin/vitest run convex/devicesMutations.characterization.test.ts convex/deviceCenter.test.ts convex/e1w4.test.ts convex/lib/deviceHelpers.test.ts convex/lib/deviceUx.test.ts convex/adminSettingsGuards.test.ts`
Ek kapı: `node_modules/.bin/vitest run convex` (tam convex suite; `convex/w5aFix2.test.ts` yük altında 5 sn timeout ile flaky — düşerse tek başına koş ve öyle raporla).
Rapor yolu: /tmp/backend-b6-rapor.md — satır sayıları (önce→sonra), Adım 1 HEAD sonucu, kapılar, korunan tuhaflıklar/bug şüpheleri (file:line).
