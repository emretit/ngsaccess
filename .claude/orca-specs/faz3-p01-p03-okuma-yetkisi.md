# Faz 3.4 + 3.5 / P-03 + P-01 — PDKS/geçiş okuma yetkisi ve zorunlu projectId (K2+)

## Hedef
`reports.view` yetkisi olmayan proje üyesi PDKS/puantaj/bordro/rapor verisini sunucudan okuyamasın; ham geçiş kayıtlarını (canlı izleme vb.) yalnız `reports.view` VEYA `devices.manage` sahibi okusun; `getPdksTableData` ve `getMonthlyPayrollSheet` `projectId`'siz çağrılamasın. UI bu yetkilerle tutarlı gizlesin (yetkisiz kullanıcıda hata ekranı değil, menü/sekme görünmez). Test edilebilir: aşağıdaki kabul testleri + TAM vitest yeşil.

## Emre kararları (2026-10-26)
- PDKS/geçiş kayıtlarını `reports.view` görür (yeni yetki YOK, rol matrisi DEĞİŞMEZ).
- Teknisyen (devices.manage, reports.view yok) arıza bakabilsin: canlı izleme + geçiş kayıtları `reports.view` **veya** `devices.manage`.
- Biyometrik okutmalar PDKS'ye GİRER — `isPdksEligibleReading` / biyometri filtresine DOKUNMA (6a7950bb).

## Yetki sınıfları (yeni yardımcı `convex/lib/readingAccess.ts`)
1. **PDKS/rapor** = `["reports.view"]`: `cardReadings.getPdksTableData`, `getMonthlyPayrollSheet`, `listReportTransactions`, `getEmployeeAttendanceDetail`.
2. **Ham geçiş/izleme** = `["reports.view", "devices.manage"]` (herhangi biri): `cardReadings.list`, `listFiltered`, `listLiveSince`, `searchMonitoringPeople`, `lastMonitoringReading`, `getReading`; `dashboard.getTodayTimeline`, `dashboard.getRecentReadings`; `peopleActivity.employeeRecentReadings`.
3. **Kart yakalama** = `["employees.manage", "visitors.manage", "devices.manage", "reports.view"]`: `cardReadings.getLastUnknownByDevice` (VisitorCardCapture + BatchCardAssignDialog kullanıyor).
- Değişmeyen: `assignCardFromReading` (zaten employees.manage), `listForEmployee`/`selfCheckIn` (mobil çalışan), internal'lar, `dashboard.getStats` (yalnız sayı — dokunma, raporda not et), `visitors.*` (kendi yetkisi var — doğrula, değiştirme).
- Yardımcı: `projectId` verilmişse önce `resolveProjectScope` (üyelik), sonra o projede listedeki yetkilerden en az biri yoksa `PERMISSION_DENIED` (`lib/permissions.ts`) fırlat. `projectId` yoksa kapsam = üyelik ∩ (yetkili projeler, `getProjectIdsWithPermission` her yetki için birleşim); boşsa boş sonuç (hata değil). super_admin her yerde geçer. Tek kayıt uçlarında (`getReading`, `getEmployeeAttendanceDetail`) kaydın/kişinin `projectId`'si için kontrol et.
- Envanter: `grep -rln 'query("cardReadings")' convex` — public uçlardan başka okutma satırı/kişi devamı dönen varsa sınıflandır; kararını rapora yaz (yeni uç değiştirmeden önce `ask`).

## P-03
- `cardReadings.getPdksTableData` ve `getMonthlyPayrollSheet` args: `projectId: v.id("projects")` ZORUNLU. `convex/lib/pdksTableQuery.ts:49` ve `convex/lib/pdksPayrollQuery.ts` (~:102, referenceProjectId) içindeki "ilk izinli proje / super_admin global ayar" geri dönüşü kalkar; referans proje = `args.projectId`.
- Frontend çağıranlar (`src/hooks/usePdksTableData.ts:100`, `src/components/reports/ReportResults.tsx`, `src/components/pdks/dashboard/PDKSEnhancedExportPanel.tsx:135`, `src/lib/reports/query.ts`) proje yoksa `"skip"`; tipler `FunctionArgs` ile uyumlu.

## UI
- `src/lib/routeMeta.ts`: `/pdks-records` → `permission: "reports.view"`; `/live-monitoring` → reports.view VEYA devices.manage (RouteMeta'ya `anyPermission?: Permission[]` gibi küçük genişletme; `visibleRoutes` + route guard aynı kaynaktan).
- Yetkisiz kullanıcıda bu uçları çağıran bileşenler `useQuery(..., "skip")` ile çağırmasın (ör. `src/components/dashboard/LiveFeed.tsx`, home timeline, Kişi Ayrıntıları son geçişler, `src/components/access-control/CardReadings.tsx`, PDKS detay çekmecesi). `usePermissions().can(...)` kalıbını kullan.

## Kabul testleri (yeni)
- `viewer`/`security` (reports.view) → PDKS tablo + bordro + rapor kayıtları + canlı liste okur.
- `technician` (devices.manage, reports.view yok) → canlı liste/listLiveSince/getReading okur; getPdksTableData/getMonthlyPayrollSheet/listReportTransactions/getEmployeeAttendanceDetail `PERMISSION_DENIED`.
- reports.view'i rol özelleştirmesiyle kaldırılmış ve devices.manage'i olmayan üye → izleme uçları da reddedilir; `projectId`'siz liste çağrısı o projeyi kapsamdan düşürür.
- `getPdksTableData` `projectId`'siz → arg doğrulama hatası (validator) — handler testinde args tipi zorunlu.
- `getLastUnknownByDevice`: visitors.manage'li security okur; hiçbir sınıf yetkisi olmayan reddedilir.
- UI: technician'da PDKS menüsü görünmez, Canlı İzleme görünür; reports.view'siz + devices.manage'siz üyede ikisi de görünmez.

## Ownership (YALNIZ bunlar)
convex/cardReadings.ts · convex/lib/pdksTableQuery.ts · convex/lib/pdksPayrollQuery.ts · convex/dashboard.ts (yalnız getTodayTimeline/getRecentReadings) · convex/peopleActivity.ts · YENİ convex/lib/readingAccess.ts (+ .test.ts) · src/lib/routeMeta.ts · src/lib/capabilities.ts · route guard dosyası · yukarıdaki UI bileşenleri/hook'lar · bu dosyaların test dosyaları (convex/cardReadings*.test.ts, convex/lib/pdksTableQuery*.test.ts, convex/lib/pdksPayrollQuery*.test.ts, convex/dashboard*.test.ts, src/**/*.test.tsx vb.).
**PARALEL WORKER VAR (P-06)**: convex/lib/pdksWorkDay.ts, pdksManual.ts, pdksDay.ts, reportScope.ts, convex/pdksRecords.ts ve testleri (pdksNight*, pdksFixedRules*, pdksManual*, pdksDay*, pdksMultiShift*, reportScope*, pdksRecords*) ONUN. Bunlardan birine yazman gerekirse ÖNCE `ask`.

## Kapsam dışı
Rol matrisi (roleCatalog ROLE_DEFAULTS) · yeni yetki anahtarı · ücret maskesi (pay.view, olduğu gibi) · biyometri filtresi · schema · mobil (Flutter).

## Kapılar (hepsi senin koşumunla)
- `node_modules/.bin/vitest run` → TAM yeşil (src testleri convex modüllerini vi.mock'luyor; yalnız convex yetmez)
- `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` → 0 · `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` → 0
- `node_modules/.bin/eslint src convex --quiet` → 0 · `node scripts/find-node-leak.mjs` → 0

## YASAK
git add / git commit / git stash / git checkout / git reset / git restore / push / deploy / `npx convex` (dev, deploy, run, codegen) / migration / DB yazma YOK. `any` / `as any` yasak. Ağaçta başka worker'ın değişiklikleri var; ownership dışına yazma.

## Rapor
`worker_done`'da ≤10 satır: uç → sınıf tablosu (kısa), değişen dosyalar (file:line), envanter kararları, eklenen test sayısı, kapı sonuçları (sayılarla).
