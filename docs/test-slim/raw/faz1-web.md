# Web/Convex Faz 1 uygulama raporu

## Sonuç ve sayım

- 21 dosya silindi: 19 test dosyası + açıkça izin verilen 2 ölü kaynak dosyası. 1 yeni test dosyası eklendi.
- Değişiklik kapsamındaki testler: **152 → 107** (parametrik `it.each` satırları genişletilerek TypeScript AST üzerinden sayıldı). Net azalma **45 case**; bunun 1 tanesi sidebar senaryosunun mevcut case’e birleştirilmesidir.
- Boş tablo kaynaklarının tamamı: **27 → 27** case. **19 case** ortak dosyaya taşındı; CardReadingsTable’da 2 benzersiz davranış, RulesPage’de 3, EngineeringDepartmentView’da 3 case kendi dosyasında kaldı.
- StatusMeta ve overtimeSettlement içindeki karma case’ler korundu; yalnız ölü analiz fonksiyonuna bağlı assertion’lar çıkarıldı (1 + parametrik 2). Fixtures mevcut gerçek satır/hücre üretimini kullanmaya devam ediyor.
- Ortak dosyadaki 19 case, AuditTable allProjects × loading ve ShiftCalendarGrid 1/7/31 × loading döngülerini de aynen korur; başlık satırı, doğru colSpan ve görünür durum mesajları doğrulanır.

## 1 — Tam dosya silme: yapıldı

- `src/lib/statusTone.test.ts:1` — 5 case kaldırıldı.
- `src/lib/deviceBrand.test.ts:1` — 7 case kaldırıldı.
- `src/components/devices/DeviceForm.fix1.test.tsx:1` — 1 case kaldırıldı.
- `src/components/employees/EmployeeBulkActions.test.tsx:1` — 1 case kaldırıldı.
- `src/components/shared/MasterDetailListLayout.test.tsx:1` — 3 case kaldırıldı.
- `src/components/access-control/unified/components/TimeSchedule.test.tsx:1` — 1 case kaldırıldı.
- `src/components/access-control/unified/UnifiedAccessControl.test.tsx:1` — 1 case kaldırıldı.
- `src/components/public/ProductShot.test.tsx:1` — 1 case kaldırıldı.
- `src/pages/Index.test.tsx:1` — 1 case kaldırıldı.
- `src/components/layout/AppSidebarNav.audit.test.tsx:1` — 1 case kaldırıldı.

- `src/components/layout/shellAudit.test.tsx:67` — AppSidebarNav.audit içindeki benzersiz `Yakında` yok assertion’ı mevcut cihaz/virtual-reader senaryosuna taşındı.

## 2 — Ölü kaynaklar ve referanslar: yapıldı

- Ön koşul komutu `grep -rn "pdksChart" src convex`: kaynak referansları yalnız kendi testi ile generated API bildiriminin 2 satırındaydı; uygulama import’u yoktu.
- `convex/lib/pdksChart.ts:1` ve `convex/lib/pdksChart.test.ts:1` silindi (7 case).
- `convex/_generated/api.d.ts:178` ve eski `:447`: yalnız pdksChart import ve module map satırları çıkarıldı; codegen çalıştırılmadı.
- `analyzePdksRows` referansları yalnız analysis.test, statusMeta.test ve overtimeSettlement.test içindeydi; uygulama import’u yoktu.
- `src/components/pdks/lib/analysis.ts:1` ve `analysis.test.ts:1` silindi (4 case).
- `src/components/pdks/statusMeta.test.tsx:5,27` — analiz import/assertion çıkarıldı; 8/8 statusMeta ve ısı haritası case’i kaldı.
- `src/components/pdks/lib/overtimeSettlement.test.ts:6,35` — analiz import/assertion çıkarıldı; 2/2 settlement case’i, gerçek computePdksTableRow fixture’ı ve KPI/filter/periodTotals assertion’ları kaldı.
- `src/components/pdks/auditPage.test.tsx:27` — var olmayan PDKSChartView mock’u kaldırıldı; 4/4 case kaldı.

## 3 — Yalnız belirtilen CSS/sözlük case’leri: yapıldı

Satır referansları işlem öncesine aittir (EmployeeTable checkbox case’i eski :40).

- `src/components/devices/deviceLabels.test.ts:4 remove komut sözlüğü`
- `src/components/pdks/dashboard/auditFixes.test.tsx:100 remove O6: mobil`
- `src/components/shifts/lib/auditFixes.test.tsx:116 remove D9: önizleme`
- `src/components/visitors/visitorAudit.test.tsx:62 remove retains the shared high-contrast`
- `src/components/layout/shellAudit.test.tsx:52 remove gives the mobile menu`
- `convex/lib/shiftPlan.test.ts:19 remove exposes the agreed constants`
- `src/components/shared/SettingsSection.test.tsx:38 remove supports %s density` — 2 parametrik case.
- `src/components/shared/FormActions.test.tsx:34 remove uses DialogFooter alignment`
- `src/components/shared/DetailFieldList.test.tsx:32 remove uses vertical spacing`
- `src/components/employees/EmployeeTable.test.tsx:31 remove 02-D8:`
- `src/components/employees/EmployeeTable.test.tsx:40 remove 02-O4/D6:`
- `src/components/employees/EmployeeTable.test.tsx:49` (eski) — toolbar görünürlük assertion’ı bulk-send confirmation senaryosuna taşındı.
- `src/components/pdks/settings/PdksSettingsPanel.test.tsx:21,22` — yalnız 2 adet min-[1200px] sınıf assertion’ı çıkarıldı; case korundu.
- Sadece silinen case’lerin artık kullanılmayan import’ları temizlendi; diğer case’lerin davranış assertion’ları korundu.

## 4 — Tablo testleri: yapıldı / iki mock grubu korundu

- `src/components/access-control/CardReadingsTable.test.tsx:6 → tableStates (2 cases)`
- `src/components/access-control/unified/status/StatusViews.test.tsx:6 → tableStates (2 cases)`
- `src/components/access-control/unified/status/StatusViews.test.tsx:13 → tableStates (1 cases)`
- `src/components/admin/projects/ProjectsTable.test.tsx:6 → tableStates (2 cases)`
- `src/components/audit/AuditTable.test.tsx:9 → tableStates (2 cases)`
- `src/components/audit/AuditTable.test.tsx:19 → tableStates (1 cases)`
- `src/components/leaves/LeaveList.test.tsx:5 → tableStates (2 cases)`
- `src/components/pdks/dashboard/PDKSTableView.test.tsx:5 → tableStates (2 cases)`
- `src/components/shifts/ShiftCalendarGrid.test.tsx:6 → tableStates (3 cases)`
- `src/components/visitors/VisitorTable.test.tsx:7 → tableStates (2 cases)`
- `src/components/shared/tableStates.test.tsx:1` — tek `it.each` matrisi, 19 case; özgün assertion’lar ve ilave ortak thead/tr/colSpan kontrolü. CardReadings/Audit/Visitor loading mesajı assertion’ları güçlendirildi.
- `src/components/access-control/CardReadingsTable.test.tsx:6` — eski kayıt arama aksiyonu ve geçersiz tarih mesajı iki ayrı case olarak yerinde korundu.
- **Atlandı (yalnız taşıma):** `src/components/access-control/unified/rules-list/RulesPage.test.tsx:6` ve `src/components/employees/EngineeringDepartmentView.test.tsx:5`. Her ikisi de `convex/react.useQuery` için farklı hoisted/mock dönüş sözleşmeleri kullanıyor (RulesPage paginated rules sonucu; Engineering sırayla departments/employees). Ortak dosyaya taşımak için mock yönlendirme mekanizması gerekeceğinden talimattaki izinle yerinde bırakıldı; 6 case de geçti.
- Taşıma sonrası hedef ilk koşu: `vitest run src/components/shared/tableStates.test.tsx` → 1 dosya, 19/19 geçti.
- Son taşıma kontrolü: hedef + CardReadingsTable + RulesPage + EngineeringDepartmentView → 4 dosya, 27/27 geçti (`merge-tests.log`).

## Dosya başına case sayımı

| Dosya | Önce | Sonra |
|---|---:|---:|
| `convex/lib/pdksChart.test.ts` | 7 | 0 |
| `convex/lib/shiftPlan.test.ts` | 18 | 17 |
| `src/components/access-control/CardReadingsTable.test.tsx` | 4 | 2 |
| `src/components/access-control/unified/UnifiedAccessControl.test.tsx` | 1 | 0 |
| `src/components/access-control/unified/components/TimeSchedule.test.tsx` | 1 | 0 |
| `src/components/access-control/unified/status/StatusViews.test.tsx` | 3 | 0 |
| `src/components/admin/projects/ProjectsTable.test.tsx` | 2 | 0 |
| `src/components/audit/AuditTable.test.tsx` | 3 | 0 |
| `src/components/devices/DeviceForm.fix1.test.tsx` | 1 | 0 |
| `src/components/devices/deviceLabels.test.ts` | 2 | 1 |
| `src/components/employees/EmployeeBulkActions.test.tsx` | 1 | 0 |
| `src/components/employees/EmployeeTable.test.tsx` | 14 | 12 |
| `src/components/layout/AppSidebarNav.audit.test.tsx` | 1 | 0 |
| `src/components/layout/shellAudit.test.tsx` | 5 | 4 |
| `src/components/leaves/LeaveList.test.tsx` | 2 | 0 |
| `src/components/pdks/auditPage.test.tsx` | 4 | 4 |
| `src/components/pdks/dashboard/PDKSTableView.test.tsx` | 2 | 0 |
| `src/components/pdks/dashboard/auditFixes.test.tsx` | 9 | 8 |
| `src/components/pdks/lib/analysis.test.ts` | 4 | 0 |
| `src/components/pdks/lib/overtimeSettlement.test.ts` | 2 | 2 |
| `src/components/pdks/settings/PdksSettingsPanel.test.tsx` | 1 | 1 |
| `src/components/pdks/statusMeta.test.tsx` | 8 | 8 |
| `src/components/public/ProductShot.test.tsx` | 1 | 0 |
| `src/components/shared/DetailFieldList.test.tsx` | 3 | 2 |
| `src/components/shared/FormActions.test.tsx` | 5 | 4 |
| `src/components/shared/MasterDetailListLayout.test.tsx` | 3 | 0 |
| `src/components/shared/SettingsSection.test.tsx` | 4 | 2 |
| `src/components/shifts/ShiftCalendarGrid.test.tsx` | 3 | 0 |
| `src/components/shifts/lib/auditFixes.test.tsx` | 10 | 9 |
| `src/components/visitors/VisitorTable.test.tsx` | 2 | 0 |
| `src/components/visitors/visitorAudit.test.tsx` | 13 | 12 |
| `src/lib/deviceBrand.test.ts` | 7 | 0 |
| `src/lib/statusTone.test.ts` | 5 | 0 |
| `src/pages/Index.test.tsx` | 1 | 0 |
| `src/components/shared/tableStates.test.tsx` | 0 | 19 |
| **Toplam** | **152** | **107** |

RulesPage ve EngineeringDepartmentView değişmediğinden bu kapsam sayımına dahil değildir (her biri 3 → 3).

## Kapılar (istenen sırayla)

1. `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` → exit 0, 0 hata (`tsc-app.log`).
2. `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` → exit 0, 0 hata (`tsc-convex.log`).
3. `node_modules/.bin/eslint <değiştirilen/yeni mevcut 17 dosya>` → exit 0, 0 error / 0 no-explicit-any; yalnız generated api.d.ts için proje ignore uyarısı (`eslint.log`, tam dosya listesi `lint-files.json`).
4. `node_modules/.bin/vitest run src/components/shared src/components/pdks src/components/layout src/components/devices src/components/employees src/components/visitors src/components/shifts src/components/access-control src/components/audit src/components/admin src/components/leaves convex/lib/shiftPlan.test.ts` → exit 0, **167 dosya / 1059 case geçti**, 51,44 sn (`vitest.log`).
5. `grep -rn "pdksChart\|pdks/lib/analysis\|analyzePdksRows" src convex` → boş çıktı; grep exit 1 (eşleşme yok), doğrulama exit 0 (`references.log`).

- `git diff --check -- src convex` → temiz.
- Tam vitest, codegen, deploy, DB işlemi veya yasak git yazma komutu çalıştırılmadı. Ownership dışı mobile/todo/.claude değişikliklerine dokunulmadı.
