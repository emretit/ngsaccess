# TAŞIMA K-02 — W1 FIX2 (denetim 2 DÜZELT 1-3 + NOT 5, 6)

ÖNCE `/Users/emreaydin/ngsaccess/.claude/orca-specs/fix-ortak.md` OKU (YASAK: git add/commit/stash/checkout/reset/restore; npx convex; DB; paket kurma).
Kaynak: `/tmp/tasima-k02-w1-denetim2.md` (tablo satırları 1,2,3,5,6) + `/tmp/tasima-k02-w1-fix1-rapor.md`. Rapor: `/tmp/tasima-k02-w1-fix2-rapor.md`.
Aynı ağaçta başka worker yok; başka oturumun mail/PDKS/rapor WIP'i var (`convex/lib/auditLogQuery.ts` dahil — DOKUNMA; koordinatör oraya
`accessTransfers` etiketini ekledi).

## Hedef (test edilebilir)
Tam vitest yeşil; sunucudaki ESKİ IDE köprüsüyle günlük upsert davranışı eskisi gibi (login yoksa iş deneme harcamadan bekler); taşıma başladığı an ağda
olan doğrudan Hik senkronu kartı eski cihaza yazsa bile devir bunu yakalar ve yeniden siler.

## Ownership
`convex/lib/accessTransfer.ts`, YENİ `convex/lib/transferGuard.ts` (hafif: ideSync/hikvisionSync/accessScheduleTemplates import ETMEZ),
`convex/lib/employeeCardChange.ts`, `convex/employees.ts` (yalnız import yolu), `convex/ideSync.ts`, `convex/hikvisionSync.ts`, `convex/lib/grantStatus.ts`,
`convex/lib/hikSyncEmployee.ts`, `convex/employeeTermination.ts`, `convex/employeeTransfer.test.ts` + değişen modüllerin mevcut testleri.
Gerekirse `ask`.

## Değişiklikler
1. **İmport zinciri (DÜZELT 1)** — `employeeTransfer`, `assertNoEmployeeTransfer`, `activeTransferStatuses`, `transferError` gibi okuma/kilit yardımcıları
   `lib/transferGuard.ts`'e; `employeeCardChange.ts`, `employees.ts` ve mümkün olan her yer oradan alsın. `ideSync.ts`/`hikvisionSync.ts`'in
   `lib/accessTransfer.ts`'e (ve tersine) döngüsel import'unu kaldır ya da en aza indir (raporda import grafiğini yaz). Kabul: `convex/employeeImport.test.ts`
   test dosyası DEĞİŞTİRİLMEDEN 38/38 geçer.
2. **Eski köprü uyumu (DÜZELT 2)** — poll'daki upsert rezervasyonu `attempts`'ı ARTIRMAZ; `markSent` (msxId ile) `attempts+1` yazar. `msxId` almamış ve süresi
   dolmuş rezervasyon deneme harcamadan `pending`'e döner (poll içinde ucuz index aralığı — boşsa 0 ek belge — ya da `requeueTimedOut`'ta; hangisi
   ise gerekçe). Eski köprü (`/sent` çağırmadan `continue`) senaryosu testle: 6 poll döngüsü sonra iş hâlâ `pending`/`sent`, `failed` DEĞİL, attempts 0.
   Yeni köprü (önce `/sent`) senaryosu: denemeler sayılır, 5'te terminal. `TRANSFER_DEVICE_BUSY` mesajı gerçek bekleme süresiyle uyumlu olsun
   ("birkaç dakika sonra tekrar deneyin").
3. **Ağdaki doğrudan senkron yarışı (DÜZELT 3)** — `upsertGrantStatus` `state:"effective"` aldığında kişi `terminationType==="transfer"` ya da aktif devrin
   kaynağı ise grant'ı effective YAZMAZ; o cihaz için yeni devir silmesi kuyruğa alır (`enqueueTransferDeletion`), hedef `confirmed` ise `pending`'e çeker,
   devir `revoked`/`done` olduysa da (kart B'ye geçmiş olabilir) silme yine kuyruğa girer ve audit'e "geç yazım yakalandı" düşer. Ek: `hikSyncEmployee.ts:~283`
   doğrudan senkron HTTP'den hemen önce kişiyi yeniden okur, taşınmışsa eklemeyi atlar. Test: start → devir silmesi markOpDone → done → geç gelen
   effective sonucu → yeni silme işi + audit; ve "HTTP öncesi yeniden okuma" testi.
4. **NOT 5** — `transferBlocksAddition` legacy (employeeId'siz) dalı poll/retry yolunda FIRLATMAZ: yalnız aktif statülü hedefleri okur, sınır aşılırsa işi
   atlar (gönderme) — tek eski iş tüm poll'u durdurmaz (test).
5. **NOT 6** — devir silmelerinin payload'ına `transferId` yaz; onay eşleşmesi önce `transferId` ile, yoksa `_creationTime >= requestedAt` ile (zamana
   bağımlılık azalır). Test: transferId'li silme ACK'i onaylar; başka devrin transferId'si onaylamaz.

## Kabul
Kapılar (fix-ortak.md) + `vitest run convex/employeeImport.test.ts convex/employeeTransfer.test.ts convex/employeeTermination.test.ts convex/employees*.test.ts
convex/employeeAuth*.test.ts convex/ideSync*.test.ts convex/hikvisionSync*.test.ts convex/actions/hikQueueWorker*.test.ts convex/accessGrantStatus.test.ts
convex/devices*.test.ts convex/lib/hikSyncEmployee*.test.ts convex/fixF2b*.test.ts` (var olanlar) yeşil. Ayrıca `convex/lib/customFunctions`'ı mock'layan
tüm test dosyaları (`grep -l 'lib/customFunctions' convex -r --include=*.test.ts`) yeşil.
commit/push/deploy/migration/DB yazma YOK. `git add`/`git commit` YASAK.
