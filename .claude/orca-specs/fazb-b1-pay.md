# B1 — project_user ücret bilgisini GÖRMESİN (Emre kararı, güvenlik)
Rapor: `/Users/emreaydin/ngsaccess/.claude/orca-specs/reports/fazb-b1-pay.md`
Önce oku: `.claude/orca-specs/reports/audit-1019-risk.md` §1 (tam harita + önerilen çözüm + test kabulü). O rapordaki satır numaraları HEAD 1a0c112'ye göre.

Hedef (test edilebilir): `project_user` rolündeki kullanıcı aşağıdaki 7 public uçtan hiçbir parasal değer alamaz (`null`); `super_admin`/`project_admin` için sonuçlar birebir aynı kalır.
1. `convex/employees.ts` `list` + `getById`: `hourlyRate`, `monthlySalary` → `canSeePay ? değer : null` (spread'den SONRA açık override).
2. `convex/visitors.ts` `list` (ham `...vz` employee belgesi): aynı iki alan maskelenir.
3. `convex/cardReadings.ts` `getPdksTableData`: satır `hourlyRate`, `overtimePayTRY`. `getMonthlyPayrollSheet`: `rows[].hourlyRate`, HER `rows[].cells[].overtimePayTRY`, `rows[].totals.overtimePayTRY`.
   Tercih: ücret çözümüne (`resolveHourlyRate` vb.) project_user için `null` ver → hesaplayıcılar (`convex/lib/pdksTable.ts`, `pdksPayroll.ts`) zaten null'da null üretiyor mu DOĞRULA; üretmiyorsa çıktıda maskele.
4. `convex/reports.ts` `getOvertimeSummaryReport`: `rows[].overtimePayTRY`, `totalOvertimePayTRY` → null. `getDepartmentCostReport`: `hourlyRate`, `rows[].cost` → null VE project_user için sıralama maliyete göre değil departman adına göre (yan kanal).
5. Ortak saf yardımcı: YENİ `convex/lib/payVisibility.ts` (`canSeePay(user)` = `isManager(user)`; `maskPay<T>(value, canSee)` gibi) + testi.
6. UI null uyumu: `src/components/settings/sections/ReportsSettings.tsx`, `src/components/settings/sections/reports/exportReport.ts`, `src/utils/reportsExport.ts` — null'u `0 ₺` diye GÖSTERME, "—" göster / toplamda null'u atla. (Bu sayfalar zaten yönetici kapılı; amaç tip/null güvenliği.)
   PDKS/Raporlar UI'ında (`src/components/pdks/**`, `src/components/reports/**`, `src/lib/reports/**`) ücret render'ı yok (audit) — tsc kırılırsa yalnız tip uyarlaması yap; kırılmazsa dokunma.

Ownership (yazabileceğin dosyalar): `convex/employees.ts` (yalnız list/getById), `convex/visitors.ts` (yalnız list), `convex/cardReadings.ts` (yalnız 2 fonksiyon + ücret çözüm yardımcısı),
`convex/reports.ts` (yalnız 2 fonksiyon), `convex/lib/payVisibility.ts` (yeni) + `convex/lib/payVisibility.test.ts` (yeni), YENİ `convex/payVisibility.handlers.test.ts`,
`src/components/settings/sections/ReportsSettings.tsx`, `src/components/settings/sections/reports/exportReport.ts`, `src/utils/reportsExport.ts` ve bu üçünün mevcut test dosyaları.
Kapsam DIŞI: employees/visitors'taki diğer fonksiyonlar (orphan işi ayrı), `convex/lib/pdksTable.ts`/`pdksPayroll.ts` (yalnız oku), şema, ücret YAZMA yolları (zaten adminMutation).
Testler (`convex/lib/reportScope.test.ts`'in handler kalıbını kullan: customFunctions passThrough mock + gerçek handler + fixture ctx):
 - 7 ucun her biri için project_user → tüm iç içe ücret alanları null; project_admin ve super_admin → mevcut sayılar.
 - Departman maliyet raporu project_user'da ada göre sıralı.
 - payVisibility saf testleri. UI: null değer "—"/atlanır, `0 ₺` değil.
