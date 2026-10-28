# Backend B1 — cardReadings.ts PDKS sorguları (R10 kalanı)

Hedef: `convex/cardReadings.ts` içindeki `getPdksTableData` (~259 satır) ve `getMonthlyPayrollSheet` (~245 satır) handler gövdeleri lib'e taşınır; registered sorgular ince sarmalayıcı kalır; PDKS çıktıları birebir aynı (mevcut golden/snapshot testleri değişmeden yeşil).

Ownership:
- convex/cardReadings.ts (YALNIZ bu iki handler'ın gövdesi + import satırları; `processCardReading` ve diğer handler'lara DOKUNMA)
- convex/lib/pdksTable.ts ve convex/lib/pdksPayroll.ts: yalnız YENİ export EKLE (mevcut export'ların imzası/davranışı değişmez) — ya da yeni dosyalar convex/lib/pdksTableQuery.ts, convex/lib/pdksPayrollQuery.ts (tercih: yeni dosya, mevcut lib'i değiştirmemek)
- İsteğe bağlı yeni test: convex/lib/pdksTableQuery.test.ts / pdksPayrollQuery.test.ts

Dikkat: R8 notu — tablo/bordro/detay ekranları aynı kişi-gün için bilinçli olarak farklı hesaplar (tablo=ham, bordro=net+haftalık). Birleştirme YOK; her biri kendi yolunu korur.

Vitest: `node_modules/.bin/vitest run convex/lib/pdks convex/w5a convex/w53Integration.test.ts convex/lib/pdksTable.test.ts convex/lib/pdksPayroll.test.ts convex/lib/pdksPayroll.overtime.test.ts`
(Snapshot dosyası convex/__snapshots__/w5aLegacyEquivalence.test.ts.snap DEĞİŞMEMELİ.)
Rapor yolu: /tmp/backend-b1-rapor.md
