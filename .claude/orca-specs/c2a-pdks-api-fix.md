# C2a backend denetim düzeltmeleri — KVKK rapor sızıntısı + toplu manuel kural + çift süzme
Önce `.claude/orca-specs/c2-common.md`, `convex/_generated/ai/guidelines.md` ve `.claude/orca-specs/reports/c2a-pdks-api.md` oku.
Claude backend denetimi "deploy'a HAZIR DEĞİL" dedi:
1. **KRİTİK (KVKK 2026/921)** `convex/lib/reportScope.ts:28` `readReportReadings` biyometriyi süzmeden döndürüyor → `convex/reports.ts:39`
   getSgkMonthlyReport, `:165` getOvertimeSummaryReport, `:295` getDepartmentCostReport biyometrik okumayla gün/mesai/maliyet hesaplıyor.
   Dönüşü `filterPdksReadings` (`convex/lib/pdksSource.ts`) ile süz; `lib/reportScope.test.ts`'e biyometrik okuma dışlanır testi ekle.
   Sonra `grep -rn "cardReadings" convex` ile PDKS/rapor hesabına süzülmeden giren BAŞKA yol kalmadığını doğrula ve raporda listele
   (getCurrentlyInside doluluk ölçümüdür, PDKS değil — dokunma).
2. **YÜKSEK** `convex/pdksRecords.ts:116` `bulkUpsertManual`: tekil upsertManual ile aynı kural — `validateManualPdksInput` (`lib/pdksManual.ts`)
   kullan; toplu işlemde gerekçe batch düzeyinde ZORUNLU yeni arg `note: v.string()` (3–500, trim) tüm satırlara yazılır + audit; iki boş saatli
   satır reddedilir (satır bazlı sonuç listesinde hata, diğer satırlar işlenir); status semantiği upsertManual ile aynı (boş saatte 'absent' yazma).
   Dönüş şekli değişirse raporda kesin yaz (frontend PDKSImportDialog'u 08 frontend worker'ı uyarlayacak).
3. **ORTA perf** `filterPdksReadings` aynı okumalara handler + `buildPdksEmployeeReadingMap` + `computePdksTableRow` içinde 3 kez uygulanıyor
   (her seferinde JSON.parse). Handler/yükleyici sınırında BİR KEZ süz; iç saf motorlarda tekrarlama (saf motor testleri süzülmüş girdi varsayımıyla
   güncellenir; biyometri regresyon testleri yükleyici/handler düzeyine taşınır, kapsam kaybolmaz). Bir kez süzme davranışı aynı kalmalı.
## Ownership
convex/lib/reportScope.ts (+test) · convex/reports.ts · convex/pdksRecords.ts · convex/lib/pdksManual.ts (+test) · convex/cardReadings.ts ·
convex/lib/pdksTable.ts · convex/lib/pdksDetail.ts · convex/lib/pdksPayroll.ts · convex/lib/pdksChart.ts (+testleri) · convex/dashboard.ts (yalnız süzme tekrarı varsa)
## Kapsam dışı
Frontend (src/**) · schema.ts · ingest/http.ts · convex/lib/cardReadingAudit.ts · pdksSource.ts sınıflandırma mantığı (koordinatör düzeltti, değiştirme).
## Kapılar
convex tsc · eslint convex · npx vitest run (hepsi yeşil). commit/push/deploy YOK. worker_done ≤8 satır: düzeltmeler file:line, bulkUpsertManual yeni sözleşmesi, grep sonucu.
