# TAŞIMA K-02 — W1 FIX1 (denetim ENGEL + DÜZELT'ler)

ÖNCE `/Users/emreaydin/ngsaccess/.claude/orca-specs/fix-ortak.md` OKU (YASAK: git add/commit/stash/checkout/reset/restore; npx convex; DB; paket kurma).
Kaynak: `/tmp/tasima-k02-w1-denetim.md` (bulgu 1,2,3,4,5,7) + önceki spec `.claude/orca-specs/tasima-k02-w1-backend.md` + `/tmp/tasima-k02-w1-rapor.md`.
Rapor: `/tmp/tasima-k02-w1-fix1-rapor.md`. Aynı ağaçta W2 UI worker'ı `src/components/employees/**` + `src/pages/Employees.tsx` yazıyor — DOKUNMA.

## Hedef (test edilebilir)
Taşıma başladıktan sonra A'nın kartı, hiçbir kuyruk yolundan (IDE upsertUser, Hik gateway retry addPerson/updatePerson, yerel köprü addPerson) eski
cihazlara YENİDEN yazılamaz; devir yalnız devirden SONRA oluşturulmuş silmelerin onayıyla ilerler.

## Ownership
W1 dosyaları: `convex/employeeTermination.ts`, `convex/lib/accessTransfer.ts`, `convex/lib/grantStatus.ts`, `convex/schema.ts` (yalnız index adı),
`convex/ideSync.ts`, `convex/hikvisionSync.ts`, `convex/employees.ts` (yalnız `getByEmailInternal` / `adminSetEmployeePassword`),
`convex/employeeTransfer.test.ts` + EK: `convex/actions/hikQueueWorker.ts` (yalnız teslim savunması). Başka dosya gerekirse `ask`.

## Değişiklikler
1. **ENGEL (bulgu 1)** —
   (a) `startTransfer` aynı transaction'da, dondurulan cihazlarda A'ya ait açık EKLEME/GÜNCELLEME işlerini terminal yapar: Hik
   `addPerson/updatePerson/addCard/addFace/addFingerprint` (`pending`/`failed`, dismissed olmayanlar) → mevcut terminal desenle (done + lastError
   "Taşıma başladı: geçersiz", grant'ı "effective" YAPMADAN); IDE `upsertUser` (`pending`/`failed`; dedupe anahtarı + runId'li olanlar dahil) → terminal.
   Sınırlı okuma: cihaz başına `by_device_status` index'i, kişiye ait olmayanı sayma.
   (b) Yolda olan iş (Hik `processing`, IDE `sent`) A'ya ait ekleme/güncelleme ise `startTransfer` VE `transferPreflight` `TRANSFER_DEVICE_BUSY`
   döner: "<cihaz> cihazına giden bir işlem sürüyor; 2 dakika sonra tekrar deneyin." (preflight'ta reason olarak).
   (c) Ek savunma (dar kapsam): üç teslim yolu — IDE `pendingForBridge`/poll (`ideSync.ts:~434`), Hik worker ekleme dalı (`hikQueueWorker.ts:~137`
   `retryPersonFromRules`), yerel köprü claim (`hikvisionSync.ts:~584`) — kişi `terminationType === "transfer"` ise YA DA kaynak tarafında aktif
   devri varsa ekleme/güncelleme işini GÖNDERMEZ, terminal yapar. Genel `isActive===false` kontrolü EKLEME (pasifleştirme/ziyaretçi akışlarını
   bozabilir) — yalnız taşıma koşulu.
   (d) Testler: start öncesi pending IDE upsert → start sonrası teslim edilmiyor + silme ack'i → devir done → panele upsert gitmedi; Hik failed
   addPerson retry → worker göndermiyor; yerel köprü pending addPerson → claim etmiyor; IDE `sent` upsert varken start → TRANSFER_DEVICE_BUSY.
2. **Bulgu 2** — `grantStatus.ts:~150` devir istisnası yalnız `op._creationTime >= transfer.requestedAt` olan silmeleri kabul eder; daha eski silme ACK'i
   hedefi onaylamaz (test).
3. **Bulgu 3** — `snapshotTransferDevices` proje genelinde değil aday cihaz başına okur; başka kişilerin failed işleri `TRANSFER_LIMIT`'e sayılmaz;
   projede 600 ilgisiz failed iş varken preflight/start çalışır (test).
4. **Bulgu 4** — `by_source_project` → `by_source_project_requested_at` (kullanılmıyorsa kaldır; hangisini yaptığını yaz).
5. **Bulgu 5** — `ctx.runMutation(internal.ideSync.enqueueIdeOp …)` / hikvisionSync çağrıları yerine aynı transaction helper'ları
   (`enqueueIdeOpInTransaction`, `enqueueLocalBridgeOperationInTransaction`, beginPersonDeletion mantığı) — davranış aynı, testler yeşil.
6. **Bulgu 7** — `getByEmailInternal` / `adminSetEmployeePassword`: aynı e-postada taşınmış A yerine aktif kaydı seçer (mobil girişle aynı kural).

## Kabul
Kapılar (fix-ortak.md) + `vitest run convex/employeeTransfer.test.ts convex/employeeTermination.test.ts convex/employees*.test.ts
convex/employeeAuth*.test.ts convex/ideSync*.test.ts convex/hikvisionSync*.test.ts convex/actions/hikQueueWorker*.test.ts
convex/accessGrantStatus.test.ts convex/devices*.test.ts` (var olanlar) yeşil.
commit/push/deploy/migration/DB yazma YOK. `git add`/`git commit` YASAK.
