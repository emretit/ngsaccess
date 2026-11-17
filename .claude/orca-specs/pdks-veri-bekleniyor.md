# PDKS "Veri bekleniyor" — yanlış Devamsız düzeltmesi (2026-11-17)

## Hedef (test edilebilir)
Bir çalışanın günü, o projenin cihaz verisi o gün için tamamlandığı doğrulanmadan "Devamsız" (absent) olmaz;
bunun yerine yeni bir "Veri bekleniyor" durumu gösterilir. Başka bir çalışanın okutması tek başına "veri tamam" sayılmaz.

## Sorunun kaynağı
- `convex/lib/pdksAvailability.ts` → `pdksAvailableDateKeys` / `readPdksAvailableDateKeys`: projede o gün HERHANGİ bir
  okutma varsa günü "veri var" sayıyor.
- Tüketiciler: `convex/lib/pdksTable.ts:~357` (`dataAvailable`), `convex/lib/pdksPayroll.ts:54`, `convex/lib/pdksDetail.ts:56`,
  `convex/lib/pdksTableQuery.ts:202`, `convex/lib/pdksPayrollQuery.ts:178`, `convex/lib/reportAttendance.ts:104,340`,
  `convex/cardReadings.ts:672`, `convex/mobileAttendance.ts:163`.
- Cihaz tarafında geçmiş kayıt taraması zaten var: `devices.hikBackfillCursor`, `hikLastBackfillAt`, `hikBackfillPending`
  (`convex/schema.ts:444-458`, `convex/lib/gatewayBackfill.ts`, `convex/lib/gateway/backfillState.ts`). PDKS bunu kullanmıyor.
- Audit kanıtı: önceki audit testi "B'nin günü Veri yok iken A okutunca B Devamsız oldu".

## İstenen değişiklik
1. Proje + gün için "cihaz verisi tamam" kararı: o projede PDKS'ye kayıt düşüren aktif cihazların her biri için
   o günün (vardiya bitişi + tolerans dahil) sonuna kadar geçmiş tarama tamamlanmış olmalı
   (`hikLastBackfillAt`/cursor o anı geçmiş ve o pencereyi kapsayan `hikBackfillPending` yok).
   Cihazın yalnız çevrimiçi olması yeterli DEĞİL. Backfill takibi olmayan cihaz türleri (IDE, QR/mobil, sanal okuyucu)
   için bugünkü davranışı koru ve bu kararı rapora yaz.
2. Gün bu kontrolü geçemiyorsa ve çalışanın kendi kaydı yoksa: durum `absent` yerine yeni `awaitingData` ("Veri bekleniyor").
   Bordro kodu "—". Kendi okutması/izni/manuel kaydı olan gün etkilenmez.
3. Tüm tüketicilerde (tablo, detay, bordro, raporlar, mobil) aynı ortak fonksiyon kullanılsın; ayrı kopya mantık yazma.
4. UI: `src/components/pdks/lib/presentation.ts` + `PdksRowStatus.tsx` yeni durum için etiket/renk (nötr/bekleme rengi,
   mevcut "Veri yok" stiline yakın). Rapor/Excel çıktısında da "Veri bekleniyor" yazsın.
5. Geçmiş günler: backfill hiç yapılmamış eski cihazlar yüzünden geçmişin tamamı "Veri bekleniyor"a dönmesin.
   Makul kural öner ve uygula (ör. cihazın ilk backfill kaydından önceki günler için eski davranış) — kararı raporda gerekçelendir.

## Ownership (yalnız bunlara yaz)
convex/lib/pdksAvailability.ts (+ yeni test), convex/lib/pdksTable.ts, convex/lib/pdksPayroll.ts, convex/lib/pdksDetail.ts,
convex/lib/pdksTableQuery.ts, convex/lib/pdksPayrollQuery.ts, convex/lib/reportAttendance.ts, convex/cardReadings.ts,
convex/mobileAttendance.ts, convex/lib/pdksDay.ts (yalnız durum tipi gerekiyorsa), src/components/pdks/** , ilgili *.test.ts(x).
Şema değişikliği gerekirse YALNIZ optional alan ekleme (genişletme); migration yazma.

## Kapsam dışı
Mola kuralı, eski hesap yollarının birleştirilmesi, dönem kapatma (audit madde 2-5). Windows köprüsü. Mobil Flutter uygulaması.

## Kapılar (hepsi exit 0)
- `node_modules/.bin/tsc --noEmit -p tsconfig.app.json`
- `node_modules/.bin/eslint src convex` (0 error)
- `node_modules/.bin/vitest run` (TAM koşu; src testleri convex modüllerini mock'luyor)
- `node scripts/find-node-leak.mjs`
- Yeni test: "A okutunca, backfill'i tamamlanmamış günde B Devamsız değil Veri bekleniyor" + "backfill tamam → B Devamsız" +
  "B'nin kendi okutması varsa etkilenmez".

## YASAKLAR
git add / commit / stash / checkout / reset / push YOK. Convex deploy, migration, `npx convex run`, DB yazma YOK.
Supabase MCP KULLANMA. Çalışma ağacında başka değişiklik olabilir, dokunma.

## Rapor
worker_done'da ≤10 satır: değişen dosyalar file:line, eski cihaz/geçmiş gün kuralı kararı, kapı sonuçları (test sayısı).
