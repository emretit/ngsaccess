# Faz 3.3 / P-06 — Gündüz vardiyasının ertesi güne uzanan çıkışı (K2+)

## Hedef
Sabit (fixed) gündüz vardiyası (ör. 09:00–18:00, bitiş > başlangıç) `validWindow.checkOutEndDayOffset === 1` ile çıkış penceresini ertesi güne uzattığında (ör. çıkış 17:00 → ertesi gün 02:00), ertesi gün 01:00'deki çıkış okutması ve manuel 01:00 çıkışı ÖNCEKİ iş gününe yazılsın; gece vardiyası ve esnek vardiya davranışı DEĞİŞMESİN. Test edilebilir: aşağıdaki "Kabul testleri" yeşil + tüm vitest yeşil.

## Kök sebep (audit M3 P-06, DOGRULAMA)
- `convex/lib/pdksWorkDay.ts:40` `pdksWorkDay`: `if (!previous || !isOvernightShift(previous)) return date;` — önceki gün gündüz vardiyasıysa erken dönüyor, `:48`'deki `validFixedPunch(previous.validWindow, ...)` kontrolüne hiç ulaşmıyor.
- Doğrulama bu ayarı kabul ediyor: `convex/lib/pdksFixedRules.ts:36-41` (`checkOutEndDayOffset` 0|1, `fixedExitEnd`).

## Yapılacaklar
1. `convex/lib/pdksWorkDay.ts`: yeni dışa açık yardımcı
   `export function exitMayCrossMidnight(shift)` = `isOvernightShift(shift) || (shift?.scheduleType !== "flexible" && shift?.validWindow?.checkOutEndDayOffset === 1)` (esnek için `flexibleSchedule(...)?.checkOutEndDayOffset === 1` zaten isOvernightShift'te).
2. `pdksWorkDay` erken dönüşü: önceki gün **gündüz** sabit vardiyası + offset 1 ise:
   - `direction === "entry"` → `date`.
   - Okutma `validFixedPunch(previous.validWindow, previousDate, accessTime, "exit")` DEĞİLSE → `date`.
   - Yönsüz (direction yok / "entry"/"exit" dışı) okutma bugünün vardiyasını açabiliyorsa → `date` (bugün vardiya var ve: `current.validWindow` varsa `validFixedPunch(current.validWindow, date, accessTime, "entry")`, yoksa `isoTimeToTRMinutes(accessTime) >= parseHHMM(current.startTime)`). Ardışık gün girişi korunmalı.
   - Aksi halde → `previousDate`.
   - Gündüz vardiyası için orta nokta (`cutoff`) hesabı KULLANILMAZ (end > nextStart'ta yanlış sonuç verir). Gece vardiyası dalı aynen kalır.
3. `manualPdksTimes` (`pdksWorkDay.ts` ~:170-190): sabit gündüz vardiyası + offset 1 iken manuel `exitTime < entryTime` → `exitNextDay = true`, exitISO ertesi gün. (Eşit saatler: mevcut kural aynen.)
4. `convex/lib/pdksManual.ts:13` `isManualPdksTimeOrderValid`: `isOvernightShift(shift)` → `exitMayCrossMidnight(shift)`.
5. `convex/pdksRecords.ts:155` (manuel doğrulama için gece vardiyası listesi): `isOvernightShift` → `exitMayCrossMidnight` (UI "çıkış ertesi gün" izni bu listeye dayanıyorsa). Döndürülen şekli DEĞİŞTİRME.
6. `convex/lib/reportScope.ts:143`: sabit dalda `isOvernightShift(shift)` → `exitMayCrossMidnight(shift)` (önceki günün ataması kapsam keşfine girsin).
7. `convex/lib/pdksDay.ts:358` `isOvernightShift: isOvernightShift(shift)` → `exitMayCrossMidnight(shift)` (UI manuel diyaloğu "Çıkış ertesi gün kaydedilecek" + doğrulama bu bayrağı kullanıyor: `src/components/pdks/lib/presentation.ts:147`, `ManualPdksEditDialog.tsx:163`). `pdksDay.ts:221` (planlı bitiş dakikası +1440) DEĞİŞMEZ — gündüz vardiyasının planlı bitişi aynı gün.
8. Diğer `isOvernightShift` kullanımlarını (grep) incele; anlamı "çıkış ertesi güne düşebilir" olanları yardımcıya çevir, "planlı vardiya gece mi" olanlara dokunma. Kararını rapora yaz.

## Kabul testleri (yeni; mevcut test dosyalarına ekle — ör. `convex/lib/pdksNight.handlers.test.ts`, `convex/lib/pdksFixedRules.test.ts`, `convex/lib/pdksManual*.test.ts`, `convex/pdksFixedRules.integration.test.ts`)
- 09–18 vardiya, pencere giriş 08–10, çıkış 17:00 → ertesi 02:00 (offset 1): D 09:00 giriş + D+1 01:00 `exit` → ikisi de D iş gününde; D günü çıkış 01:00, süre ~16 sa.
- Aynı, yönsüz 01:00 okutma → D.
- D+1 03:00 (pencere dışı) exit → D+1.
- D+1 günü de 09–18 vardiyası var; D+1 09:00 yönsüz → D+1 (ardışık giriş korunur), D+1 01:00 exit → D.
- Pencere offset 0 olan gündüz vardiyası: D+1 01:00 exit → D+1 (eski davranış).
- Gece vardiyası (22–06) mevcut testleri aynen yeşil.
- Manuel: offset 1 gündüz vardiyasında giriş 09:00 çıkış 01:00 kabul edilir, exitISO D+1; offset 0'da reddedilir.

## Ownership (YALNIZ bunlar)
convex/lib/pdksWorkDay.ts · convex/lib/pdksManual.ts · convex/pdksRecords.ts · convex/lib/reportScope.ts · convex/lib/pdksDay.ts · ilgili mevcut/yeni test dosyaları (convex/lib/pdks*.test.ts, convex/pdksFixedRules.integration.test.ts, convex/lib/reportScope.test.ts, convex/pdksRecords*.test.ts). UI dosyasına gerek görürsen ÖNCE `ask` ile sor.

## Kapsam dışı
convex/cardReadings.ts, convex/lib/pdksTableQuery.ts, convex/lib/pdksPayrollQuery.ts (başka worker'da) · esnek vardiya mantığı · biyometrik kaynak filtresi (Emre kararı: biyometri PDKS'ye GİRER; `isPdksEligibleReading`'e dokunma) · schema.

## Kapılar (hepsi senin koşumunla)
- `node_modules/.bin/vitest run` → tamamı yeşil (yalnız convex değil, TAM)
- `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` → 0 · `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` → 0
- `node_modules/.bin/eslint src convex --quiet` → 0 · `node scripts/find-node-leak.mjs` → 0

## YASAK
git add / git commit / git stash / git checkout / git reset / git restore / push / deploy / `npx convex` (dev, deploy, run, codegen) / migration / DB yazma YOK. `any` / `as any` yasak. Ağaçta başka oturumların değişiklikleri olabilir; ownership dışına yazma.

## Rapor
`worker_done`'da ≤10 satır: değişen dosyalar (file:line), 8. adım kararları, eklenen test sayısı, kapı sonuçları (sayılarla).
