# Vardiya Paket B — sonuç (2026-10-23)

Görev: `task_8c942b857129`, dispatch: `ctx_078a24b6a737`.

## Uygulama

- `convex/lib/pdksMultiShift.ts:12`: segment DTO/validator, isteğe bağlı DTO alanları, proje kapsamı, plan günü keşfi; `:61` ortak `shiftForInstant`, `:65` pencere → yön → orta nokta bölmesi, `:74` ilk/son manuel düzeltme, `:81` parça birleştirme, `:111` ortak hesaplayıcı.
- `convex/lib/pdksDay.ts:56`: döngü gün tipi; `:58` yalnız çoklu planın manuel gece çıkışı için iç hesap seçeneği; `:205` tatil önceliği korunarak sınıflandırma.
- `convex/lib/pdksWorkDay.ts:33`: son vardiyadan gece kuyruğu; grup ve çalışma tarihi yardımcıları aynı çözümleyiciyi taşır.
- `convex/lib/pdksTable.ts:246`, `convex/lib/pdksPayroll.ts:16`, `convex/lib/pdksDetail.ts:17`: ortak plan hesabı, son parça çıkış eşiği, isteğe bağlı segments/planKind, parça bazlı mola; dönem mesaisi mevcut kişi/dönem yolunda bir kez.
- `convex/lib/pdksTableQuery.ts:121`, `convex/lib/pdksPayrollQuery.ts:98`, `convex/cardReadings.ts:589`: plan ve son vardiya bağlantıları, aralıkta herhangi bir parçayı kapsayan vardiya filtresi.
- `convex/lib/pdksManualWrite.ts:17`, `convex/pdksRecords.ts:77`: manuel gece doğrulaması son vardiya üzerinden.
- `convex/lib/reportAttendance.ts:71`, `convex/lib/reportScope.ts:107`: döngü takvimi ve plan/departman keşfi; varlık sorguları kesilmiş listeyi tam sonuç saymaz, gerçek çözümleme bounded resolver'dadır.
- `convex/lib/processCardReadingCore.ts:466`, `convex/dashboard.ts:268`, `convex/mobileAttendance.ts:124`: yakın parçanın gecikme eşiği, plan günlerinin ortak rapor hesabı, mobil özet; mobil return validator değişmedi.
- `convex/lib/pdksChart.ts:74`: koordinatörün eklediği kapsam; isteğe bağlı resolvePlan ile ilk okutmaya en yakın parça eşiği (bu saf yardımcıya mevcut üretim çağrısı bulunmuyor).

## Doğrulama

| Kapı | Sonuç |
|---|---|
| `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` | 0 |
| `node_modules/.bin/tsc --noEmit -p convex` | 0 |
| `node_modules/.bin/eslint src convex` | 0 hata; mevcut `attendanceCorrections.test.ts:8` unused admin uyarısı |
| `node_modules/.bin/vitest run` | **371 dosya / 4119 test geçti** (C1 dahil ortak çalışma ağacı) |
| `node scripts/find-node-leak.mjs` | 0 |
| `git diff --check` | 0 |

Yeni B kapsamı: `convex/lib/pdksMultiShift.test.ts:26` 15 test; `convex/pdksPlans.integration.test.ts:50` 7 gerçek API entegrasyon testi; `convex/lib/pdksChart.test.ts:186` 2 ek test. Toplam 24 yeni B testi: eski motor/tablo strict eşdeğerliği, iki parça tam/eksik/devamsız, yön/orta nokta/pencere, gece kuyruğu, manuel ilk/son, parça ve dönem mesaisi, döngü dinlenme/çalışma/tatil, esnek+sabit red, departman/kişi API uçları, mobil ve dashboard.

## Koordinatörün onayladığı dar test uyarlamaları

- `convex/w5aLegacyEquivalence.test.ts:104`: yalnız `shiftPlanRefs.by_project.first` ve `departmentShiftAssignments.by_project_end.gte.first` metadata okumaları açık kapsam/index/terminal işlem assertion'ıyla doğrulanıp eski snapshot izinden çıkarıldı; DTO ve diğer okumalar aynen karşılaştırılır, snapshot dosyası değişmedi.
- `convex/w53Integration.test.ts:231` (ayrıca `:237`, `:366`): query-count beklentilerine proje başına bu iki varlık okuması eklendi; personel başına okuma beklentileri korundu.
- `convex/attendanceCorrections.test.ts:19`: mock'a eski resolve ile aynı sonuç veren resolveLast eklendi.

## Bilerek korunan resolve çağrıları

`rg '\.resolve\(' convex --glob '!*.test.ts'` gözden geçirildi; Promise.resolve eşleşmeleri vardiya çözümlemesi değildir.

- `cardReadings.ts:582`, `pdksTableQuery.ts:129`, `pdksPayrollQuery.ts:91`: esnek vardiya keşfi; esnek vardiya zaten tek başına olmak zorunda. Detayın ek önceki gün yükleme kapısı mevcut özel sabit kurallar için de korunur.
- `cardReadings.ts:589,640,642`; `pdksTableQuery.ts:136,198`; `pdksPayrollQuery.ts:98,144,151`; `reportAttendance.ts:113`: günün başlangıcı ilk vardiyadır, aynı çağrılara son vardiya için resolveLast ayrıca verilmiştir.
- `cardReadings.ts:662`; `pdksTableQuery.ts:249`; `pdksPayrollQuery.ts:191`; `reportAttendance.ts:153`; `mobileAttendance.ts:140`: eski ilk vardiya girdisi/başlığı korunur, aynı hesap çağrısında resolvePlan/dayPlan da taşınır.
- `reportAttendance.ts:345,375`; `dashboard.ts:276,641,644`: eski sabit/esnek kural kontrolü; çoklu/döngü/departman günleri ayrıca usesPlanDayRules ile kapsanır.
- `dashboard.ts:425`: eski yıllık mesai yolu; plan günlerinde bu hesap dayEntries'e alınmaz, ruleRows'un ortak motor sonucu kullanılır.
- `dashboard.ts:340`: özel computePdksCoreInMemory'nin eski overtimeHours ara hesabı; tek çağıranı getActivitySummary bu alanı dışarı döndürmez/kullanmaz, gerçek yıllık mesai plan günlerinde ruleRows üzerinden gelir.

A ve C dosyalarına bu dispatch'te dokunulmadı; commit, codegen, canlı DB yazımı ve yayın yapılmadı. Public A sözleşmesinden sapma ve açık soru yok; ertelenmiş parça bazlı manuel düzeltme tablosu eklenmedi.
