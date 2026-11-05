# Web test sadeleştirme adayları (src/ + convex/) — Claude

Kapsam: 505 dosya, vitest'te 5573 case (inventory grep'i 3765 diyor; fark `it.each` açılımından). Süre kaynağı `/tmp/test-slim/vitest.json`:
17 dk 11 sn duvar saati, yük altında. Testlerin toplam süresi 2248 sn (convex 2028, src 229). Başarısız case'ler aday gerekçesi olarak **kullanılmadı**.

## 1. Özet

- **Case azalması (tahmini): ~50 case** (5573'ün ~%1'i). **Dosya azalması: ~20 dosya.** İsteğe bağlı olarak 24 sprint dosyası yeniden adlandırılabilir; case sayısı değişmez.
- **Asıl kazanç sayı değil süre:** süresi 8 sn'yi aşan 15 case toplam test süresinin **%41'ini (934/2248 sn)** harcıyor. Hepsi KORU alanında (cihaz senkronu / sınırlı okuma), bu yüzden silinmiyor; N küçültme veya ayrı "scale" koşusu öneriliyor (SADELEŞTİR).
- Sprint adlı dosyaların (fixF*, w5a*, *.audit, *.review) çoğu gerçek olay regresyonu. Başlıkları ve api çağrıları ana dosyalarla çakışmıyor; silinirlerse kapsam kaybolur.

**En büyük 5 kazanç**
1. `convex/hikRevocation.test.ts:372`: "500 members" `it.each` 4 türle koşuyor, **~565 sn** (offlineDevice 383, remove 111, inactive 31, member). 1 tür tam ölçekte kalsın, 3'ü N=5-10 ile koşsun → **~8-9 dk**.
2. `convex/accessGrantStatus.test.ts:567` (1200 çift, 149 sn) + `:610` (1500 grant, 40 sn): `GRANT_LIMIT=1000` (`convex/lib/grantStatus.ts:11`) parametre olarak verilebilirse N=limit+1 ile aynı sınır test edilir → **~3 dk**.
3. 600/300/200 kayıtlı diğer ölçek testleri (ideRoster.audit, doorTarget, shiftPlans, fixF2Cards, w5aFix2): her biri 20-27 sn → N küçültülürse **~2 dk**.
4. Boş tablo başlığı testleri: 10 dosya / 27 case / 6,1 sn → tek tablo-güdümlü dosya (~14 case). **−13 case, −9 dosya.**
5. Ölü kaynak testleri: `convex/lib/pdksChart.test.ts` (7) + `src/components/pdks/lib/analysis.test.ts` (4) kaynaklarıyla birlikte silinmeli. **−11 case, −2 dosya (+2 ölü kaynak dosyası).**

## 2. Aday tablosu

Case: vitest'te çalışan case sayısı. Süre: dosyanın toplam süresi (`vitest.json`, ms); tekil case için case süresi belirtildi.

### SİL

| Eylem | Dosya | Case | Süre (ms) | Gerekçe (1 satır) | Kanıt | Risk |
|---|---|---|---|---|---|---|
| SİL (+ kaynağı) | `convex/lib/pdksChart.test.ts` | 7 | 439 | Ölü: `computePdksChartData`/`emptyPdksChartData` yalnız testten import ediliyor; PDKSChartView bileşeni de yok | tek kullanıcı `convex/lib/pdksChart.test.ts:4`; `src/components/pdks/dashboard/` içinde *Chart* dosyası yok | düşük |
| SİL (+ kaynağı) | `src/components/pdks/lib/analysis.test.ts` | 4 | 70 | Ölü: `analyzePdksRows` uygulamada hiç import edilmiyor; Analiz sekmesi kaldırıldı | `src/components/pdks/lib/analysis.ts:13` tek tanım; `src/components/pdks/auditPage.test.tsx:34` "Analiz … yok" | düşük |
| SİL | `src/components/layout/AppSidebarNav.audit.test.tsx` | 1 | 215 | Aynı iddia 3 dosyada: sanal okuyucu ayrı menüde değil | `shellAudit.test.tsx:68`, `routeMeta.test.ts:13-14`; nav `visibleRoutes`'tan üretiliyor (`AppSidebarNav.tsx:13`) | düşük |
| SİL (case) | `src/components/layout/shellAudit.test.tsx:68` | 1 | (dosya 982) | Aynı mükerrer iddia; veri katmanındaki `routeMeta.test.ts:14` yeterli | yukarıdaki | düşük |
| SİL | `src/lib/statusTone.test.ts` | 5 | 81 | Yalnız sınıf-adı eşlemesi (`status-success-badge` …), davranış yok | `statusTone.test.ts:5` | düşük |
| SİL | `src/components/employees/EmployeeBulkActions.test.tsx` | 1 | 596 | Yalnız Tailwind sınıfı kontrolü (`border-destructive/40 text-destructive`) | `EmployeeBulkActions.test.tsx:4` | düşük |
| SİL | `src/components/devices/DeviceForm.fix1.test.tsx` | 1 | 284 | Yalnız `sticky bottom-0` sınıfı + iki buton metni; 5 vi.mock | `DeviceForm.fix1.test.tsx:19` | düşük |
| SİL | `src/pages/Index.test.tsx` | 1 | 72 | `grid items-start` sayısı + footer yokluğu: düzen/CSS; 7 bileşen mock'lu | `Index.test.tsx:18`, `src/pages/Index.tsx:13` | düşük |
| SİL (case) | `src/components/pdks/dashboard/auditFixes.test.tsx:100` | 1 | (dosya 2025) | O6: yalnız `--pdks-person-width:120px/192px` CSS değişkeni | `auditFixes.test.tsx:100-105` | düşük |
| SİL (case) | `src/components/layout/shellAudit.test.tsx:52` | 1 | (dosya 982) | Yalnız `h-11 w-11` dokunma hedefi sınıfı | `shellAudit.test.tsx:52-56` | düşük |
| SİL (case) | `src/components/shifts/lib/auditFixes.test.tsx:116` | 1 | (dosya 1511) | D9: yalnız `overflow-y-auto`/`max-h-64` sınıflarının yokluğu | `auditFixes.test.tsx:116-119` | düşük |
| SİL (case) | `src/components/visitors/visitorAudit.test.tsx:62` | 1 | (dosya 4018) | Yalnız `data-[state=on]:bg-primary` sınıfı | `visitorAudit.test.tsx:62-67` | düşük |
| SİL (case) | `src/components/devices/deviceLabels.test.ts:4` | 1 | (dosya 393) | Sabit metin sözlüğünü birebir tekrar ediyor (`toBe("Çalışma durumu")` …) | `deviceLabels.test.ts:4-12`; `deviceDateTime` case'i (`:13`) kalsın | düşük |
| SİL (case) | `convex/lib/shiftPlan.test.ts:19` | 1 | (dosya 74) | Sabit değerlerini (`8, 30, 31, 52`) doğruluyor; aynı sınırlar davranışla da test ediliyor | `shiftPlan.test.ts:20` (8/9), `:27` (30/29), `:54-55` (31/52) | düşük |
| SİL (case) | `convex/roles.fix1.test.ts:109` | 1 | (dosya 12220) | K-02 proje taşıma yasağı mükerrer; `fixF0People` daha güçlü (iki projede admin + snapshot eşitliği) | `convex/fixF0People.test.ts:65-75` | düşük |
| SİL | `convex/lib/deviceAssignment.hik.test.ts` | 2 | 41 | Hik taşıma koruması, 5 vi.mock ile birim test; handler seviyesinde aynı senaryo + "yazma yok" snapshot'ı zaten var | `convex/devicesMutations.characterization.test.ts:250-262` (claim/reassign × HIK_DEVICE_MOVE_UNSUPPORTED, `state` eşitliği) | orta: birim test "ilk yazmadan önce" diyor; Convex mutation geri alındığı için pratikte fark yok, yine de onay iste |

**SİL toplamı: ~30 case, 8 dosya (+2 ölü kaynak dosyası). Süre etkisi ihmal edilebilir (~2 sn).**

### BİRLEŞTİR

| Eylem | Dosya | Case | Süre (ms) | Gerekçe (1 satır) | Kanıt | Risk |
|---|---|---|---|---|---|---|
| BİRLEŞTİR → `src/components/shared/tableStates.test.tsx` (tek `it.each`) | `CardReadingsTable`, `RulesPage`, `StatusViews`, `ProjectsTable`, `AuditTable`, `EngineeringDepartmentView`, `LeaveList`, `PDKSTableView`, `ShiftCalendarGrid`, `VisitorTable` (.test.tsx) | 27 → ~14 | 6144 (10 dosya) | Hepsi aynı kalıp: boş/yükleme durumunda `<thead>` + `colSpan=N` + mesaj; loading döngüsü her dosyada tekrar | ör. `VisitorTable.test.tsx`, `LeaveList.test.tsx`, `ProjectsTable.test.tsx:4`; ortak bileşen testi `shared/TableStateRow.test.tsx` | düşük: tablo listesi tek yerde tutulursa 2026-10-28 boş-tablo kuralı korunur |
| BİRLEŞTİR → `src/components/devices/DeviceCommandCenter.test.tsx` | `DeviceCommandCenter.audit.test.tsx` (10) + `DeviceOfflineConfirmation.test.tsx` (4) + `DeviceAudit.test.tsx:187` (1) | 15 → ~14 | 2529 + 555 + (1435) | Aynı bileşen 3 dosyada, 3 ayrı mock kurulumuyla; çevrimdışı açıklaması iki yerde | `DeviceAudit.test.tsx:12,212`, `DeviceOfflineConfirmation.test.tsx:19-28`, `DeviceCommandCenter.audit.test.tsx:9` | düşük (project_user/doors.open yetki case'leri aynen taşınır) |
| BİRLEŞTİR → `src/components/live-monitoring/lib/readings.test.ts` | `monitoringAudit.test.tsx:39` | 1 | (dosya 1872) | Saf `readFilters/writeFilters` testi render dosyasında duruyor | `readings.test.ts:21-23` aynı fonksiyonları test ediyor (source alanı hariç) | düşük |
| BİRLEŞTİR → `src/lib/reports/excel.test.ts` | `reports/auditFixes.test.tsx:79` (dakika kısmı) | 0 | (dosya 2001) | Excel'deki sayısal dakika kolonu iki yerde test ediliyor | `excel.test.ts:12` "numeric duration companion columns"; kolon-depolama kısmı auditFixes'te kalsın | düşük |
| TAŞI → `convex/leaves.test.ts` (yeni) | `src/components/leaves/leavesBackend.test.ts` | 3 | 473 | Convex handler testi src altında; `convex/leaves.ts`'in tek testi bu | `leavesBackend.test.ts:4,7` (`convex/leaves` import + customFunctions mock); `convex/leaveRequests.test.ts` farklı modül | düşük (silinmez, yalnız yeri değişir) |
| TAŞI → `convex/` | `src/lib/reports/reportTransactions.backend.test.ts` | 8 | 1386 | Aynı durum: `convex/cardReadings.listReportTransactions` src'den test ediliyor | `reportTransactions.backend.test.ts:6,8,12` | düşük |

**BİRLEŞTİR toplamı: ~14 case, ~11 dosya.**

### SADELEŞTİR (KORU alanı: case silinmez, maliyet düşer)

Ölçek testleri (N küçült), süreye göre sıralı:

| Eylem | Dosya | Case | Süre (ms) | Gerekçe (1 satır) | Kanıt | Risk |
|---|---|---|---|---|---|---|
| N küçült | `convex/hikRevocation.test.ts:372` (`it.each` member/remove/inactive/offlineDevice × 500 üye) | 4 | ~565 000 (dosya 599 842) | Aynı sınırlı zamanlama mantığı 4 kez 500 kayıtla kuruluyor; bir tür 500'de kalsın, kalan üçü N=5-10 ile koşsun | case süreleri: offlineDevice 383 sn, remove 111 sn, inactive 31 sn; `CLEANUP_BATCH_SIZE = 500` (`convex/hikvisionSync.ts:1045`) | orta: bir tür tam ölçekte kalmalı |
| N küçült | `convex/accessGrantStatus.test.ts:567` (1200 gateway çifti) | 1 | 149 370 | Üç sınırlı grant batch'i 1200 kayıtla doğruluyor; limit enjekte edilirse N=3×limit+1 küçük olur | `GRANT_LIMIT = 1000` (`convex/lib/grantStatus.ts:11`) | orta |
| N küçült | `convex/accessGrantStatus.test.ts:610` (K-09, 1500 grant) | 1 | 40 615 | Sayfalama/sayım yabancı proje kayıtlarını görmezden geliyor mu: limit+1 yeterli | aynı | orta |
| N küçült | `convex/ideRoster.audit.test.ts:113` (600 IDE üyesi) | 1 | 26 896 | Sınırlı revocation zinciri; batch boyutu + 1 ile aynı güvence | case süresi | orta |
| N küçült | `convex/w5aFix2.test.ts:11` (yıllık 20002 okuma) | 1 | 26 852 | "Tek yükleme" iddiası için okuma sayısı değil sorgu sayısı önemli; N=2000 yeterli | case süresi | orta |
| N küçült | `convex/shiftPlans.test.ts:38` (300 kişi × 20 izin) | 1 | 26 265 | Departman önizlemesi geçmişi görmezden geliyor mu; 30 kişi yeterli | case süresi | düşük |
| N küçült | `convex/doorTarget.test.ts:200` (Y-07, 600 üye × hikvision/ide_smart) | 2 | 23 428 (tek case) | "Fan-out yok" iddiası; sayı değil zamanlanan iş sayısı kontrol ediliyor | case süresi | orta |
| N küçült | `convex/fixF2Cards.test.ts:56` (200 kart, iki 100'lük batch) | 1 | ~20 000 | Batch sınırı 101 kartla da test edilir (`:46` zaten 101'i reddediyor) | `fixF2Cards.test.ts:46,56` | düşük |
| SADELEŞTİR | `src/components/audit/auditLabels.test.ts` ("labels every statically known … key") | 1 | 22 139 | Tek case convex kaynağını tarıyor ve 22 sn sürüyor; dosya listesi ya da tarama önbelleğe alınabilir | case süresi | düşük |

Diğerleri:

| Eylem | Dosya | Case | Süre (ms) | Gerekçe (1 satır) | Kanıt | Risk |
|---|---|---|---|---|---|---|
| SADELEŞTİR | `src/lib/deviceBrand.test.ts` | 7 → 1 | 4 | 7 satırlık etiket eşlemesi tek `toEqual` tablosuna iner | `deviceBrand.test.ts:5` | düşük |
| SADELEŞTİR | 9 dosyada kopyalanmış `expectLabel` + `grid w-full min-w-0 gap-1 text-xs min-[761px]:w-40` sınıf iddiası | 0 | — | Aynı yardımcı 9 kez kopyalanmış; sınıf dizesi FilterField sözleşmesi, `shared/FilterBar.test.tsx`'te bir kez test edilsin | `AlarmFilters`, `VisitorFilters`, `DeviceFilters`, `EmployeeFilters`, `AdminListParts`, `HolidayCalendarManager`, `monitoringAudit`, `reports/auditFixes`, `pdks/dashboard/auditFixes` | düşük |
| SADELEŞTİR | `src/components/pdks/auditPage.test.tsx:27` | 0 | 1577 | Artık var olmayan modülü (`PDKSChartView`) mock'luyor | modül dosyası yok (bayat vi.mock taraması) | düşük |
| SADELEŞTİR | `src/components/pdks/settings/PdksSettingsPanel.test.tsx` | 1 | 69 | Davranış kalsın (plan linki, "Çalışma günleri" yok); `min-[1200px]:grid-cols…` satırları çıksın | `PdksSettingsPanel.test.tsx` son iki `expect` | düşük |
| SADELEŞTİR | `src/components/leaves/LeaveFilters.test.tsx` (+ React `useState`'i mock'layan 39 dosya daha) | 1 | 1811 | `vi.mock("react")` ile hook çağrı sırasına bağlı, kırılgan | `grep -l 'vi.mock("react",' src` = 40 dosya | orta (ayrı iş, bkz. soru 3) |

**SADELEŞTİR toplamı: ~6 case, tahmini ~13 dk test süresi (toplam 2248 sn'nin ~%35'i).**

### YENİDEN ADLANDIR / TAŞI (isteğe bağlı, case değişmez)

Sprint adlı convex dosyaları gerçek regresyon testi ve KORU alanında oldukları için silinmez. Modül adına taşınırlarsa bir sonraki mükerrer test görünür olur. Hedef, baskın modüle (api çağrı sayısı) göre:
`fixF0Devices`→devices(37) · `fixF0People`/`fixF4People`/`fixF5People`→employees · `fixF2Cards`→visitors(23) · `fixF2Ide`/`fixF2bIde`→ideSync(41/21) · `fixF2Hik`→hikvisionSync(11) ·
`fixF5PasswordReset`→invites(20) · `fixF5Consistency`→projects(10) · `fixF1Requests`→attendanceCorrections(8) · `w53Integration`/`w5aFix1`/`w5aFix2`/`w5aLegacyEquivalence`→cardReadings/reports (PDKS) ·
`roles.fix1`→roles · `visitorsAudit2`→visitors(21) · `ideRoster.audit`→accessRules/ideSync · `e1w4`→employeeAuth+devices.
src tarafında: `*/auditFixes.test.tsx`, `*Audit.test.tsx`, `unified/audit.test.tsx`, `usePdksAudit.test.tsx` bileşenin kendi test dosyasına taşınır.
Risk: düşük. `src` testleri convex modüllerini `vi.mock`'luyor; yalnız test dosyasının adı değiştiği için bu mock'lar etkilenmez.

## 3. Emin değilim (sahibine sor)

1. **Ölçek testleri:** 8 sn'yi aşan 15 case (çoğu 200-20002 kayıtlı ölçek testi) test süresinin %41'ini harcıyor. N küçültülüp her kapıda mı koşsun, yoksa tam ölçek ayrı bir `test:scale` koşusuna (gece/yayın öncesi) mı alınsın?
2. **Legacy PDKS yolu:** `w5aLegacyEquivalence`, `w53Integration` (`describe.each([false, true])`) ve `reports.attendance` içindeki "legacy" blokları sürümsüz projeleri test ediyor. Canlıda sürümsüz (legacy) proje kaldı mı? Kalmadıysa legacy dalı kodla birlikte kaldırılabilir; ~15-20 case de gider.
3. **React hook mock'u (40 dosya):** jsdom + Testing Library eklenip bu testler yeniden yazılsın mı? Ayrı iş, ~1-2 gün; case sayısı aynı kalır, kırılganlık azalır.
4. **Metin koruma testleri:** `src/lib/consentNotice.test.ts` (KVKK aydınlatma metni) ve `src/components/landing/marketingFacts.test.ts` (yasaklı pazarlama iddiaları) yalnız metin kontrol ediyor, ama hukuki ve pazarlama riski için konmuşlar. Kalsınlar mı?
5. **Ölü kaynaklar:** `convex/lib/pdksChart.ts` ve `src/components/pdks/lib/analysis.ts` testleriyle birlikte silinsin mi, yoksa yakında yeniden kullanılacaklar mı?

Not: çalışma ağacında başka oturumun değiştirdiği test dosyaları (`convex/lib/employeeUx.test.ts`, `convex/lib/employeeImportValidation.test.ts`, `src/components/employees/{EmployeeActivityBoundary,EmployeeForm,EmployeeFormFields,EmployeeTable}.test.tsx`, `useEmployeeFormSchema.test.ts`, `src/lib/employees/employeeExcel.test.ts`) bilinçli olarak aday yapılmadı.
