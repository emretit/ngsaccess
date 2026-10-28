# Faz 3.4 + 3.5 / P-01 + P-03 — Okuma yetkisi

2026-10-26 · dispatched task task_a7be677e37a8 · dispatch ctx_6c5f1221ae38 · shared main working tree

## Sonuç

Tamamlandı; aşağıdaki sunucu/UI kapsamı ve koordinatörün onayladığı envanter genişletmeleri uygulandı. Rol matrisi, yetki anahtarları, ücret maskesi ve biyometri uygunluk filtresi değiştirilmedi. Commit, stage, stash, checkout, deploy, Convex CLI ve canlı DB işlemi yapılmadı.

## Uç → yetki sınıfı

| Uçlar | Sınıf / davranış |
| --- | --- |
| cardReadings.getPdksTableData, getMonthlyPayrollSheet, listReportTransactions, getEmployeeAttendanceDetail | reports.view |
| dashboard.getAnnualOvertimeBalance, getRepeatLateOffenders, getBreakViolations, getActivitySummary | reports.view; ortak loadPdksDataset kapısı |
| cardReadings.list, listFiltered, listLiveSince, searchMonitoringPeople, lastMonitoringReading, getReading | reports.view VEYA devices.manage |
| dashboard.getTodayTimeline, getRecentReadings; peopleActivity.employeeRecentReadings | reports.view VEYA devices.manage |
| cardReadings.getLastUnknownByDevice | employees.manage VEYA visitors.manage VEYA devices.manage VEYA reports.view |
| doors.readerStatus | Uç çalışır; reports.view VEYA devices.manage yoksa son kart/kişi/zaman/yön/sonuç null; çevrimiçi durumu korunur |
| visitors.getDetail, listPage | reports.view VEYA devices.manage VEYA visitors.manage yoksa recentReadings=[] ve presence/lastSeenAt/lastDirection=null; diğer ziyaretçi verileri korunur |

Yardımcı: convex/lib/readingAccess.ts:13 seçili projede önce üyeliği doğrular, yetki yoksa PERMISSION_DENIED fırlatır; proje seçilmemişse üyelik ile yetkili proje birleşiminin kesişimini döndürür. Super admin mevcut kapsam davranışını korur. Tek kayıt sorguları kişinin/okumanın gerçek projectId alanını da doğrular.

## P-03 ve UI

- convex/cardReadings.ts:396 ve :437: tablo/bordro projectId validator ve TypeScript args zorunlu.
- convex/lib/pdksTableQuery.ts:49 ve convex/lib/pdksPayrollQuery.ts:44: referenceProjectId=args.projectId; global/ilk proje geri dönüşü ve global tarama kolu kaldırıldı.
- src/lib/routeMeta.ts:6 ve :48: PDKS reports.view, Canlı İzleme OR yetkisi; visibleRoutes ile src/components/Layout.tsx:42 rota koruması aynı canAccessRoute kaynağını kullanır; hızlı erişim de visibleRoutes kullanır.
- PDKS, rapor, dashboard, kişi son geçişleri, canlı izleme, kart yakalama ve ek uyarı bileşenleri yetkisizde sorguları skip eder veya alt bileşeni hiç mount etmez; ziyaretçi ve okuyucu ekranları maskeli alanları düzgün gösterir.
- src/lib/reports/query.ts:11 ve :15 dönüş tipleri FunctionArgs ile bağlı; proje yokken hook/snapshot/dışa aktarım sorgusu açılmaz.

## Envanter kararları

`rg -l 'query\("cardReadings"\)' convex` çıktısındaki üretim dosyaları incelendi (testler ayrı değerlendirildi). İlk kapsamın dışındaki doors.readerStatus, dashboard PDKS uçları ve visitors okuma uçları koordinatöre soruldu ve onayla bu göreve eklendi.

- dashboard.getStats yalnız sayı döndürür; talimat gereği değişmedi.
- visitors okuma uçlarında başlangıçta visitors.manage zorunluluğu yoktu; bu nedenle ziyaretçi ekranını reddetmek yerine yukarıdaki gömülü geçiş alanları maskelendi. visitors.summary yalnız yaşam döngüsü sayaçları ve expiry bilgisi içerir, geçişten türeyen alan içermez; aynen bırakıldı.
- projects.getSetupStatus admin.manage ile yalnız kurulum adımı boolean'ı döndürür; değişmedi.
- pdksRules.getCheckpointWarnings schedule.manage altında kontrol noktası uyarı özeti döndürür; değişmedi.
- reports uçları lib/reportScope üzerinden reports.view kapsamını kullanır; sgkExport zaten reports.view kontrolündedir; değişmedi.
- mobileAttendance, lib/mobileVisitors, cardReadings.listForEmployee/selfCheckIn çalışan oturumu kapsamındadır; değişmedi.
- privacyRetention, seedCardReaderTest, lib/employeeCascade, cardReadingProcess, processCardReadingCore ve internal process/backfill yolları iç işleme/yazma/temizliktir; public okuma yanıtı oluşturmaz, değişmedi.
- pdksAvailability, cardReadingList, pdksTableQuery/pdksPayrollQuery ve reportScope yardımcılarının okuma sonuçları yetkilendirilmiş üst uçlardan tüketilir.
- Gerçek dashboard export listesinde getPdksStats adlı ayrı bir public uç yoktur; mevcut dört loadPdksDataset tüketicisi korundu.

## Testler ve kapılar

105 yeni test: convex/cardReadings.readingAccess.test.ts (92), convex/lib/readingAccess.test.ts (5), src/hooks/readingAccess.test.tsx (4), src/lib/permissionsUI.test.ts (3), src/components/visitors/visitorAudit.test.tsx (1). Mevcut handler mock'ları yeni kullanıcı/yetki bağlamını sağlayacak şekilde güncellendi; foreign getReading artık kayıt projesi üyelik doğrulamasında reddedilir.

| Kapı | Sonuç |
| --- | --- |
| node_modules/.bin/vitest run | 413 dosya, 4872 test geçti; 0 hata; exit 0; son koşu 20:04:10, 31.39s |
| node_modules/.bin/tsc --noEmit -p tsconfig.app.json | 0 hata, exit 0 |
| node_modules/.bin/tsc --noEmit -p convex/tsconfig.json | 0 hata, exit 0 |
| node_modules/.bin/eslint src convex --quiet | 0 hata, exit 0 |
| node scripts/find-node-leak.mjs | 0 çıktı, exit 0 |
| git diff --check | 0 çıktı, exit 0 |

Paylaşılan ağaçtaki P-06, PDKS import ve vardiya dialog değişiklikleri bu görev tarafından değiştirilmedi. convex/lib/reportScope.test.ts koordinatörün açık ownership devriyle yalnız fixture uyarlaması için güncellendi.

## Bu görevin değiştirdiği dosyalar (47)

- convex/cardReadings.ts:1
- convex/dashboard.ts:1
- convex/doors.ts:1
- convex/lib/liveReadings.test.ts:203
- convex/lib/pdksPayrollQuery.ts:7
- convex/lib/pdksTableQuery.ts:7
- convex/lib/reportScope.test.ts:94
- convex/payVisibility.handlers.test.ts:114
- convex/peopleActivity.ts:1
- convex/visitors.ts:1
- src/components/Layout.tsx:1
- src/components/access-control/CardReadings.tsx:1
- src/components/dashboard/LiveFeed.tsx:29
- src/components/dashboard/QuickLinksGrid.tsx:5
- src/components/dashboard/ReadingsTimeline.tsx:1
- src/components/dashboard/TodayStrip.tsx:1
- src/components/devices/LocationDoorItem.tsx:33
- src/components/employees/EmployeeActivity.test.tsx:19
- src/components/employees/EmployeeRecentReadings.tsx:1
- src/components/employees/import/BatchCardAssignDialog.test.tsx:33
- src/components/employees/import/BatchCardAssignDialog.tsx:1
- src/components/live-monitoring/LiveStatus.tsx:1
- src/components/live-monitoring/MonitoringPersonPicker.test.tsx:34
- src/components/live-monitoring/MonitoringPersonPicker.tsx:1
- src/components/live-monitoring/ReadingDetailPanel.tsx:14
- src/components/live-monitoring/monitoringAudit.test.tsx:1
- src/components/pdks/dashboard/PDKSEmployeeDetailDrawer.tsx:104
- src/components/pdks/dashboard/PDKSEnhancedExportPanel.tsx:109
- src/components/pdks/dashboard/PDKSOvertimeAlert.tsx:1
- src/components/pdks/dashboard/PDKSSmartPresets.tsx:1
- src/components/pdks/dashboard/shiftPlans.test.tsx:16
- src/components/reports/ReportResults.tsx:1
- src/components/visitors/VisitorCardCapture.tsx:1
- src/components/visitors/VisitorSlideOverPanel.tsx:67
- src/components/visitors/VisitorTable.tsx:18
- src/components/visitors/visitorAudit.test.tsx:106
- src/hooks/useDashboard.ts:1
- src/hooks/usePdksAudit.test.tsx:29
- src/hooks/usePdksTableData.ts:1
- src/lib/permissionsUI.test.ts:30
- src/lib/reports/query.ts:1
- src/lib/reports/reportTransactions.backend.test.ts:44
- src/lib/routeMeta.ts:5
- convex/cardReadings.readingAccess.test.ts:1
- convex/lib/readingAccess.ts:1
- convex/lib/readingAccess.test.ts:1
- src/hooks/readingAccess.test.tsx:1
