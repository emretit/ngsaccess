# Görev: "Cihazdan verileri çek" — backend (Faz 1-3)

Repo: /Users/emreaydin/ngsaccess (Convex + React, TypeScript strict). Ana dizinde çalış, worktree AÇMA.
Plan (okumak zorunlu): `.claude/plan-cihazdan-veri-cek.md`. Convex işine başlamadan ÖNCE `convex/_generated/ai/guidelines.md` oku.

## Hedef (test edilebilir)
Hikvision gateway cihazındaki kişileri önizleyen ve seçilenleri ngsplus'a (kişi + şifreli parmak izi + rıza + erişim kuralı)
aktaran iki action, ve cihazdaki TÜM geçmiş olayları parmak izi olayları dahil doğru saatle çekebilen backfill — vitest ile kanıtlanmış.

## Proje kuralları (CLAUDE.md'den, sen okumazsın)
- `any` / `as any` YASAK (eslint error). Bilinmeyen veri `unknown` + narrowing. `!` non-null yerine erken return.
- Convex tablo/alan adları camelCase; handler'lar şema alan adlarını olduğu gibi döner.
- `db.get` null filtresi: `filter((p): p is NonNullable<typeof p> => p !== null)`.
- Node modülü (crypto, `convex/lib/gateway/*`, `fingerprintCrypto`) içe aktaran HER convex dosyasının ilk satırı `"use node";`.
  Node dosyası yalnız action içerir; query/mutation ayrı (node'suz) dosyada.
- Yeni convex modülü eklersen `convex/_generated/api.d.ts`'yi ELLE güncelle (mevcut satır desenini kopyala: import + mapping).
  `npx convex codegen` ÇALIŞTIRMA (canlıda index kurar).

## YASAKLAR (ihlal = iş geçersiz)
- `git add`, `git commit`, `git stash`, `git reset`, `git checkout`, `git restore`, `git push` ÇALIŞTIRMA.
- `npx convex dev|deploy|codegen|run|import|env` ÇALIŞTIRMA. Canlı DB'ye yazma/okuma yok. ssh/curl ile gateway'e veya Hetzner'a bağlanma.
- Ownership dışındaki dosyaya yazma. Özellikle `src/**` (arayüz başka worker'ın) ve çalışma dizinindeki başka oturumun
  değişiklikleri (`src/components/pdks/**`, `src/components/shared/FilterBar.tsx`, `src/pages/PDKSRecords.tsx`) — dokunma.
- Cihazdan kişi SİLEN hiçbir kod yazma (Emre kuralı: cihazdaki yerel kişiler hiçbir şekilde otomatik silinmez).

## Ownership (yalnız bunlara yaz)
- YENİ: `convex/actions/hikDeviceImport.ts` ("use node", authedAction'lar), `convex/hikDeviceImport.ts` (internal query/mutation),
  `convex/lib/hikDeviceImport.ts` (saf yardımcılar), bunların `*.test.ts`'leri.
- DEĞİŞİR: `convex/cardReadings.ts` (yalnız `backfillHikEventRow`), `convex/lib/trDate.ts` (yeni yardımcı ekle, mevcutları değiştirme),
  `convex/lib/gatewayBackfill.ts`, `convex/actions/hikGatewayDevice.ts` (yalnız `backfillDeviceEvents` arg'ı),
  `convex/lib/hikSyncEmployee.ts` (kartsız), `convex/schema.ts` (yalnız `employees.hikCardless` ekle),
  `convex/lib/gateway/cards.ts` / `persons.ts` (yalnız yeni okuma fonksiyonu ekle), `convex/_generated/api.d.ts`, ilgili mevcut testler.

## İş 1 — `previewDeviceImport` (authedAction, yalnız okur)
- Args `{ deviceId }`. Yetki: cihaz projesinde `devices.manage` (mevcut desen: `convex/lib/gatewayBackfill.ts` `runBackfillDeviceEvents`
  başı — listProjectIdsForCurrentUser + internal.roles.checkPermission). Yalnız `brand=hikvision`, `hikTransport=gateway`, `hikDevIndex` dolu.
- Cihazdan oku: kişiler `searchPersonOnDevice` (sayfa 30, tam liste), kartlar `/ISAPI/AccessControl/CardInfo/Search` (sayfalı; `cards.ts`'de
  yoksa ekle), parmak izi `searchFingerprintsOnDevice` (`convex/lib/gateway/biometrics.ts`) kişi başına → yalnız SAYI ve fingerPrintID'ler.
  **Şablon verisi (fingerData) action dışına ASLA dönmez, loglanmaz.**
- Her satır: `{ employeeNo, name, cards: string[], fingerCount, status, matchedEmployeeId?, reason? }`, `status`:
  - `matched`: aynı projede `employees.cardNumber == employeeNo` var (yeniden oluşturulmaz).
  - `conflict`: kart no sistem genelinde başka kayıtta (bkz. `convex/lib/cardIdentity.ts` tekillik kuralı) veya başka projede.
  - `manual`: kişinin kartı var ve hiçbir kartı `employeeNo`'ya eşit değil (K4) ya da birden fazla kart.
  - `new`: aksi.
- Dönüş: `{ rows, totals: { persons, cards } }`. Kişi sayısı 1000'i geçerse ilk 1000 + `truncated: true`.

## İş 2 — `importDevicePersons` (authedAction)
- Args `{ deviceId, employeeNos: string[], biometricConsentConfirmed: boolean }`. Yetki: `devices.manage` + `employees.manage`;
  parmak izi için ayrıca `biometrics.manage` (yoksa kişiler aktarılır, parmak izi atlanır, sonuçta belirt).
- İstemcinin gönderdiği ada güvenme: seçilen kişileri cihazdan YENİDEN oku ve İş 1 sınıflamasını tekrar uygula; yalnız `new` olanlar oluşur.
- Kişi oluştur (internal mutation, tek transaction): `firstName`/`lastName` = ad'ın son kelimesi soyad, kalanı ad (tek kelime → soyad ""),
  `email: ""`, `cardNumber: employeeNo`, `projectId: device.projectId`, `isActive: true`, kartı yoksa `hikCardless: true`.
  Mevcut `employees.create`'in yan etkilerini (kart tekilliği, audit) incele; uygunsa aynı iç yardımcıları kullan.
- Rıza (K1.1): `biometricConsentConfirmed && fingerCount>0` ise `employeeConsents` `{ consentType: "biometric_fingerprint", grantedAt, grantedBy: user._id,
  notes: "Cihazdan aktarım: <device.name>" }`. Onay yoksa parmak izi aktarılmaz.
- Parmak izi (K1, FP-Central): şablonu cihazdan oku (`searchFingerprintsOnDevice`), `convex/lib/fingerprintCrypto.ts` ile şifrele,
  `internal.employeeFingerprints.upsertEncrypted` ile sakla. Bu cihaza ait teslim/metadata kaydını mevcut kayıt akışıyla aynı yap
  (`convex/fingerprintEnrollment.ts` `upsert` / `recordPush` / `deviceFingerprintEnrollments` — kişi başı en fazla 5 parmak, `convex/lib/fingerprintSlots.ts`).
  Cihazın fingerPrintID'si 1-10 dışında veya 5'ten fazla parmak varsa fazlası atlanır + sonuçta sayılır.
- Erişim kuralı (K2): projede adı `"<device.name> mevcut kişiler"` olan kural varsa onu kullan, yoksa oluştur: 7/24, bu cihazın TÜM kapıları.
  Yeni kişileri üye ekle. Mevcut kural/üyelik oluşturma yardımcılarını kullan (`convex/accessRules.ts`, `convex/groupMembers*`); normal eşitleme
  tetiklensin (kişi cihazda aynı employeeNo ile upsert edilir → parmak izi korunur).
- Dönüş: `{ created, matched, conflicts, manual, consentsRecorded, fingerprintsStored, fingerprintsSkipped, ruleId }`.
- İdempotent: aynı istek ikinci kez → `created: 0`.

## İş 3 — Kartsız kişi (K3)
- `employees.hikCardless?: boolean` şemaya ekle (opsiyonel, migration gerekmez).
- `convex/lib/hikSyncEmployee.ts`: `hikCardless === true` ise `addCardToDevice` ÇAĞRILMAZ (gateway) ve localBridge `addCard` op'u kuyruğa
  girmez; kişi upsert'i ve parmak izi push'u (`hasFingerprintTemplates`) aynen çalışır (kart sonucu "ok" sayılır).

## İş 4 — Geçmiş olaylar
- `backfillHikEventRow` (`convex/cardReadings.ts`): kimlik = `cardNo.trim() || employeeNoString?.trim()`; kart okuması oluşturma kararı
  (`shouldCreateCardReadingForHikEvent`) ve kişi eşleşmesi (`findDeviceCardEmployee`) bu kimlikle yapılsın. Parmak izi eşleşti
  (major 5 / minor 0x26) olayı → `cardReadings`'e `izin_verildi` ve doğru kişiyle düşmeli.
- Saat kuralı: cihaz olay saatinin YEREL kısmı alınır, offset etiketi yok sayılır, Europe/Istanbul (+03:00) uygulanır
  (canlı köprü `EVENT_TIME_OFFSET=+03:00` ile aynı). `convex/lib/trDate.ts`'ye yeni yardımcı (ör. `hikWallClockToUtcISO`), mevcut
  `toUtcISO`'yu DEĞİŞTİRME. Örnek: `2026-09-14T15:37:19+08:00` → `2026-09-14T12:37:19.000Z`.
- `backfillDeviceEvents`'e opsiyonel `fromAll: boolean` → startTime `2000-01-01T00:00:00+03:00`. Varsayılan (son 24 sa) değişmez.

## ANKA gerçek cihaz örnekleri (DS-K1T804AMF, test fixture olarak kullan)
- `UserInfo/Search` → `{UserInfoSearch:{responseStatusStrg:"OK",numOfMatches:4,totalMatches:4,UserInfo:[{employeeNo:"1",name:"Okan ISMAN",userType:"normal"}, …]}}`
- `CardInfo/Search` → `{CardInfoSearch:{numOfMatches:0,responseStatusStrg:"NO MATCH",totalMatches:0}}`
- `FingerPrintUpload` (employeeNo "1") → `{FingerPrintInfo:{FingerPrintList:[{cardReaderNo:1,fingerData:"<684 karakter base64>",fingerPrintID:6,fingerType:"normalFP"}],searchID:"…",status:"OK"}}`
- `AcsEvent` parmak izi → `{time:"2026-09-14T15:37:19+08:00",major:5,minor:38,cardNo:"",employeeNoString:"4",serialNo:30}`
- Kapı olayı → `{time:"…+08:00",major:5,minor:21,cardNo:"",employeeNoString:"",serialNo:584}` (kimliksiz → deviceEvents, değişmez)

## Kapılar (hepsi yeşil olmadan worker_done YOK)
```
node_modules/.bin/tsc --noEmit -p tsconfig.app.json
node_modules/.bin/tsc --noEmit -p convex/tsconfig.json
node_modules/.bin/eslint src convex        # no-explicit-any 0
node_modules/.bin/vitest run               # TAM koşu (src testleri convex modüllerini mock'luyor)
node scripts/find-node-leak.mjs
```
Not: `convex/shiftPlans.test.ts` tam koşuda zaman aşımına düşebiliyor (tek başına geçiyor) — öyleyse tek başına koşup belirt.

## Rapor (worker_done, ≤10 satır)
Yeni action imzaları (arayüz worker'ı bunları kullanacak), değişen dosyalar file:line, kapı sonuçları, varsa açık risk.
`--files-modified` ile tam dosya listesini ver.
