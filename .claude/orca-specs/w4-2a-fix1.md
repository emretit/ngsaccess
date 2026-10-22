# W4.2a DÜZELTME 1 — denetim bulguları (UYGULAMA)

Çalışma dizini: `/tmp/hik-headbuild` — İLK İŞ `cd /tmp/hik-headbuild`. W4.2a backend'inin donmuş kopyası: W4.2a değişiklikleri STAGED, taban `6ff9d42`. Senin düzeltmelerin UNSTAGED kalsın: `git add`/`stash`/`reset`/`checkout` YAPMA.
Denetim raporu: `/tmp/w42a-denetim.md` (oku). Orijinal spec: `/Users/emreaydin/ngsaccess/.claude/orca-specs/w4-2a-grant-status-backend.md`.

## Ortak kurallar
TypeScript strict; `any`/`as any`/`!` yok; tip korumalı filtre. Convex guidelines (`convex/_generated/ai/guidelines.md`); sınırsız `.collect()` yok; yeni cron/polling yok.
YASAK: commit, push, deploy, `npx convex *`, DB yazma, `src/**`, `mobile/**`, `bridge/**`, `convex/_generated/**`, `package.json`/lock.

## Düzeltmeler
**E1 — Büyük kuralda gönderim engeli (regresyon)** `convex/actions/hikvisionSync.ts:604-607`: `throw` KALDIR; gönderim hiçbir koşulda yetki-durumu yazımı yüzünden engellenmez. `grantResults`'ı 500'lük parçalarla yaz (⌈n/500⌉ mutation; "action başına ≤1" bütçesinin büyük kural için bilinçli istisnası — kodda yorumla belgele). Test: 1200 kişi×cihazda HTTP gönderimi yapılır + 3 parça yazım.

**D1 — Kart değişiminde sahte "Kaldırıldı"** `convex/employees.ts:305`: kart değişimi temizliği yetki kaldırması değildir → bu çağrıya `employeeId` GEÇME (W4.2a'da eklenen argümanı geri al). Ayrıca savunma: `convex/lib/grantStatus.ts` ~100 silme op'unun kartı/ideUserId çalışanın GÜNCEL kartıyla eşleşmiyorsa yetki yazımını atla. Test: upsertUser(yeni kart) önce, deleteUser(eski kart) sonra kuyruğa girer + iki ack → satır `effective`.

**D2 — Gateway kapsam silmesi `failed` yazılıyor** `convex/actions/hikvisionSync.ts:230-237`→`:346-352`: silme başarılıysa yetki sonucu `removed` (run sayacı/hata satırı mevcut davranışta kalabilir). Test.

**D3 — localBridge sahte "Etkin"** `convex/hikvisionSync.ts:655` `ackLocalBridgeOperation`: mobil olmayan op'ta da `op.status !== "processing"` ise (dedupe op'u yeni payload'la `pending`'e çekmiş) → op'u `done` YAPMA (pending kalsın, yeni payload teslim edilsin), yetki satırı yazma; köprüye `{ ok: true }` dön (köprü C# değişmeden döngüye girmesin). `processing` ise bugünkü akış. Test: processing→pending'e çekilmiş op'a gelen ok-ack → op pending kalır, satır `effective` olmaz.

**D4 — Kart hatasında "Etkin"** `convex/actions/hikvisionSync.ts:296-302`: `addCardToDevice` gerçek hata döndürürse yetki sonucu `failed` + mesaj (run dışı akışın dönüş değeri değişmesin; ayrı bayrakla taşı). Test.

**D5 — Grafik iki kez** `convex/lib/grantStatus.ts:80`: bekleyen SİLME op'unda grafik hesaplama; `ruleIds: existing?.ruleIds ?? []`. Grafik en çok bir kez, yalnız pending upsert için. Test (okuma sayımı ya da spy).

**N1 — Yeni aktif-run engeli geri alınsın** `convex/deviceSyncRuns.ts:84` `assertNoActiveGrantRun`: genel `createRunInTransaction`'dan KALDIR; yalnız `redistribute` yolunda uygula (kural/project_resync run'ları eskisi gibi). Test: aktif run varken kural run'ı oluşturulabilir; redistribute reddedilir.

**N4** `convex/accessGrantStatus.ts:157-158` `byEmployee.unauthorizedDoors`: cihazı olmayan (manuel) kapıları sayma. (Not: bu dosyada paralel bir UI worker'ı `counts`'a `deviceId` ekliyor olabilir — başka bir kopyada; sen yalnız `byEmployee` bölgesine dokun.)

**N5** `convex/actions/hikvisionSync.ts:350`: `tasks.find` yerine cihaz bazlı eşleme; aynı `bridgeDedupeKey`'i paylaşan cihazlarda `ruleIds` doğru.

## Kapsam dışı
N2 (geçici hata → failed; kabul) · N3 (departman/bayatlık gürültüsü; kabul) · UI · bridge C#.

## Kapılar (`/tmp/hik-headbuild` içinde)
`node_modules/.bin/tsc --noEmit -p tsconfig.app.json` → 0 · `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` → 0 · `node_modules/.bin/eslint src convex` → 0 error · `node_modules/.bin/vitest run` → tamamı yeşil (sayı).

## Rapor
`/tmp/w42a-fix1.md` + `worker_done`'da ≤10 satır: madde başına file:line + test adı · kapı sayıları · yapılmayan madde ve gerekçe.
