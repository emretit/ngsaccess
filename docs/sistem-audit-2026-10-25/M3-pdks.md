# M3 — PDKS, vardiya, izin/talep, rapor ve ana sayfa

## 1. Sonuç

Yeni vardiya planı ve sabit vardiya kuralları bağlanmış; ancak rapor yetkisini aşan okuma uçları, izin notlarının alternatif uçtan açığa çıkması ve bazı dönem/ücret hesaplarının ayrışması düzeltilmeli. Yeni bulgu sayısı **11: P0 6, P1 3, P2 2, P3 0**; eski audit'in 45 maddesi ayrıca değerlendirildi ve bu sayıma katılmadı. Eski maddeler içinde özellikle **B3.3 regresyonu** önemlidir: çalışan düzeltme başvurusu mobilde eklenmişken web'deki yönetici onay kuyruğu güncel ekranda bağlı değil.

**İnceleme zemini:** 25.10.2026, yerel kod; başlangıç HEAD `520ba5fc`, son kontrol HEAD `77bce329`. Ortak çalışma sırasında başka oturum `5de547a8` ile mobil talepleri, `77bce329` ile belgeleri commit etti; bu worker git durumunu değiştirmedi. Spec'in istediği **“(commit'siz WIP)”** etiketi aşağıda başlangıç durumunu anlatır; ilgili talep kodlarının son kontrolde HEAD farkı boştu ve artık `5de547a8` içindeydi. Canlıya dağıtım çıkarımı yapılmadı.

**Doğrulama:** `tsc --noEmit -p tsconfig.app.json` başarılı; incelenen 11 ana backend dosyası ve altı sayfada kapsamlı ESLint çağrısı başarılı. Hedefli `pdksPlans.integration`, `pdksFixedRules.integration`, `legacyOvertime`, `reports.attendance`, `payVisibility.handlers` testleri: **5 dosya / 54 test başarılı**, `--maxWorkers=1`; ilk denemede desteklenmeyen `--minWorkers` seçeneği test başlamadan reddedildi, desteklenen komutla tekrarlandı. Tam test paketi, ağ, DB, cihaz ve tarayıcı kullanılmadı; uygulama kodu değiştirilmedi.

## 2. Modül haritası

| Alan | Dosyalar / ana yüzey | Tablolar | Sayfa / ekran |
|---|---|---|---|
| Gün/ay puantajı | `cardReadings.ts:396`, `lib/pdksTableQuery.ts`, `pdksPayrollQuery.ts`, `pdksDay.ts`, `pdksMultiShift.ts`, `overtimeCalc.ts` | cardReadings, pdksRecords, employees, workSettings, overtimeRates | `PDKSRecords.tsx`, PDKS tablo/detay/export, `usePdks*` |
| Manuel kayıt / CSV | `pdksRecords.ts:11`, `actions/pdksImport.ts:87`, `lib/pdksManualWrite.ts` | pdksRecords, auditLog | ManualPdksEditDialog, toplu düzeltme ve içe aktarım |
| Kural / kontrol noktası | `pdksRules.ts:33`, `lib/pdksRules.ts`, `pdksSource.ts`, `pdksFixedRules.ts` | pdksRuleVersions, pdksCheckpointSelections; devices/doors/readers girdisi | `PdksSettings.tsx`, PdksRulesSettings |
| Vardiya / departman planı | `shifts.ts:97`, `shiftPlans.ts:77`, `lib/shiftResolver.ts`, `shiftPlan*.ts` | shifts, shiftAssignments, departmentShiftAssignments, shiftPlanRefs; departments/employees | PDKS içindeki plan Sheet, ShiftCalendarView, tanım/atama formları |
| Tatil / izin | `holidays.ts:31`, `leaves.ts:120`, `leaveRequests.ts:22`, `lib/requestRules.ts` | holidays, leaves; leaveBalances kullanılmıyor | `Leaves.tsx`, LeaveRequestsPanel, takvim; mobil RequestsScreen |
| Düzeltme talebi | `attendanceCorrections.ts:15`, `lib/pdksManualWrite.ts` | attendanceCorrections, pdksRecords, auditLog | Mobil RequestsScreen; web yönetici bağlantısı kopuk (B3.3) |
| Rapor / SGK | `reports.ts:22`, `sgkExport.ts:12`, `lib/reportAttendance.ts`, `reportScope.ts`, `sgkCodes.ts` | Yukarıdaki kaynaklar, reportScheduleSettings | `Reports.tsx`, ReportsSettings, `reports/ReportPage`, `lib/reports/registry.ts:71` |
| Ana sayfa / mobil özet | `dashboard.ts:40`, `lib/dashboard*.ts`, `mobileAttendance.ts`, `lib/mobileAttendance.ts` | employees, cardReadings, pdksRecords, leaves, plan/ayar tabloları | `Index.tsx`, `useDashboard`, mobil home/history |
| Zamanlanmış e-posta | `crons.ts:7` → `reports.ts:434` → `actions/sendScheduledReports.ts:32` | reportScheduleSettings | ReportReminderSettings; aylık hatırlatma, dosya eki yok |

**Public/internal uç envanteri ve kontrol özeti:**

| Grup | Public uçlar | Kontrol / sınır / tüketim |
|---|---|---|
| pdksRecords | upsertManual, bulkUpsertManual, previewManualShifts | Oturum, kişi-proje ve yönetim yetkisi; toplu satır sınırı ve sonuç raporu var. Gün başına tek saat çifti P-07; toplu audit P-10. |
| pdksRules | getRules, listCheckpointTargets, getCheckpointWarnings, publishRuleVersion, deleteFutureRuleVersion | Proje ve yönetim yetkisi, yarından başlayan sürüm, cihaz/kapı/okuyucu sahipliği; yürürlükteki kural değiştirilemiyor. |
| shifts | listAssignments, previewBulkAssign, bulkAssignShift, updateAssignment, removeAssignment, definitionImpacts, assignmentDeleteImpact, definitionUsage, list, create, update, remove, previewClearAssignments, clearAssignments | Yazma uçlarında schedule.manage; atama/proje/tarih/çakışma kontrolleri var. Sabit tanım geçmişi B1.8, kayıt hacmi P-08/09, audit P-10. `definitionImpacts` için uygulama çağrısı bulunmadı; tek başına silme önerisi değildir. |
| shiftPlans | listDepartmentAssignments, previewDepartmentAssign, assignDepartment, updateDepartmentAssignment, removeDepartmentAssignment, planCells | Proje/departman/kişi sahipliği; yönetim yetkisi; rotasyon ve çoklu vardiya doğrulaması; yazmada audit. Çözümleme kişi → yakın departman → üst departman → varsayılan vardiya. |
| holidays | list, listForRange, create, remove, seedTurkishHolidays, getOvertimeRates | Global yazma yalnız super_admin, proje yazma schedule.manage; aralık listesinde seçili proje yok (P-11). |
| leaves | listPage, summary, conflictFor, employeeOptions, create, update, listForRange | Sayfalama, tarih/çakışma/sahiplik, yazma yetkisi var; alternatif listede not maskesi yok (P-02). |
| Talepler | Her iki modülde submit, listMine, withdraw, listPending, approve, reject; ayrıca leaveRequests.pendingCount | Çalışan uçları çalışan oturumu, yönetici uçları proje/yetki kontrolü kullanır; karar manuel kaydı/izni aynı işlemde yazar. `(commit'siz WIP)` başlangıç kodu; son durum yukarıda. |
| cardReadings rapor yüzeyi | getPdksTableData, getMonthlyPayrollSheet, getEmployeeAttendanceDetail, listReportTransactions | Oturum/proje denetleniyor; reports.view kapısı eksik (P-01), ücretler ayrıca pay.view ile maskeleniyor. |
| reports / SGK | getSgkMonthlyReport, getOvertimeSummaryReport, getAttendanceSummaryReport, getDepartmentCostReport, getReportSchedule, saveReportSchedule; buildAphbForMonth | Rapor kapsamı/yetkisi ortak yardımcıda; taslak uyarısı ve ücret maskesi mevcut. Hesap farkları P-04 ve eski B5. |
| dashboard | getStats, getTodayTimeline, getAnnualOvertimeBalance, getRepeatLateOffenders, getBreakViolations, getRecentReadings, getActivitySummary | Proje kapsamlı okuma; yönetilen gün hesabı kısmen ortak. Büyük taramalar P-08, eski manuel farkları B2.7. |
| CSV / zamanlama | Public action: previewPdksCsv, importPdksCsv. Internal: getEnabledSchedules, getReportSummaryForEmail, markReportSent, triggerScheduledReports, sendMonthlyReports | CSV çalışan listesini yetkili sorgudan, yazmayı pdksRecords üzerinden yapar. Cron kullanıcı üyeliği/rapor yetkisini yeniden okur; e-posta servisi çağrısı bu audit'te çalıştırılmadı. |

M3'e özgü yeni bir HTTP route yok; olay alımı M2, çalışan oturumunun taşınması M5 sınırındadır. Tip denetimi başarılı; bu, bütün hesap senaryolarının doğru olduğunu kanıtlamaz. Yerel kılavuzun sınırlı okuma önerisiyle çelişen `.collect()` yolları P-08'de; ayrıca `dashboard.ts:437` gibi non-null assertion kullanımları proje kuralına aykırı temizlik borcudur, ayrı kritik bulgu sayılmadı.

## 3. Yeni bulgular

Örnekler koddan türetilmiş senaryolardır; gerçek çalışan/veri kullanılmadı. KESİN, davranışın kodda kanıtlı olduğunu; OLASI, üretim hacmine bağlı riski belirtir.

| ID | Önem | Tür | Yer (file:line) | Ne oluyor | Kanıt | Öneri | Emek | Güven |
|---|---|---|---|---|---|---|---|---|
| P-01 | P0 | YETKİ | `convex/cardReadings.ts:866`; `convex/lib/pdksPayrollQuery.ts:35`; `src/pages/Reports.tsx:30` | Rapor yetkisi kaldırılmış proje üyesi, rapor ekranı kapalı olsa da rapor verisini doğrudan sorgulayabilir. | listReportTransactions yalnız resolveProjectScope çağırır; tablo/bordro yardımcıları da üyelik kontrolü yapar, reports.view istemez. UI rapor ve export'u bu yetkiyle kapatır; authedQuery yalnız oturum sağlar. Ücret için ayrı pay.view maskesi vardır; başka projeye erişim iddiası değildir. | Rapor uçlarına sunucuda reports.view uygula; PDKS günlük ekranının daha geniş erişimi gerekiyorsa dar DTO/sorgu ayır. | M | KESİN |
| P-02 | P0 | YETKİ | `convex/leaves.ts:127`; `convex/leaves.ts:241`; `src/components/shifts/calendar/useShiftCalendarData.ts:38` | İzin yönetemeyen kullanıcıya ana listede gizlenen izin gerekçesi ve karar notu, plan takvimi sorgusunda gönderiliyor. | listPage canManageLeaves ile notes alanını maskeler; listForRange aynı kullanıcının onaylı izin Doc'larını aynen döndürür. Şemada notes/decisionNote var (`schema.ts:1198`); takvim bu uçtan veri alır. | Takvim için yalnız gerekli alanları döndür; tüm izin okuma uçlarında aynı not yetkisini uygula. | S | KESİN |
| P-03 | P0 | YANLIŞ | `convex/lib/pdksTableQuery.ts:49`; `convex/lib/pdksPayrollQuery.ts:102` | Birden çok projeyi kapsayan çağrıda farklı proje çalışanları tek projenin tatil, çalışma günü ve ücret ayarıyla hesaplanır. | projectId opsiyonel; ilk izinli proje, super_admin için global ayar seçilir. Tek holidayMap/workingDays/workSettings/overtimeRates tüm kişilere geçer (`pdksTableQuery.ts:243`, `pdksPayrollQuery.ts:188`); saat ücreti tabanı da aynı ayardır (:168). A'da cumartesi iş günü/B'de tatil örneği yanlış sonuç verir. Normal seçili-proje ekranının her çağrısının etkilendiği iddia edilmiyor. | Proje başına ayar/tatil/mesai periyodu çöz; veya bu uçlarda tek projeyi zorunlu tut. | L | KESİN |
| P-04 | P0 | TUTARSIZ | `convex/reports.ts:194`; `convex/reports.ts:319`; `convex/lib/overtimeCalc.ts:154` | Mesai özeti ve departman maliyetindeki para, PDKS/bordro mesai parasından farklı çıkabilir. | Gün motoru tatil/hafta sonu/gece ağırlıklarını saklar (`pdksDay.ts:253`); rapor yalnız dakika toplamını alıp workSettings.overtimeMultiplier ile çarpar. Kod örneği: 60 dk, saat ücreti 100, tatil katsayısı 2 ve genel katsayı 1,5 ise 200 yerine 150. | Ortak hesaplanmış ağırlıklı mesai tutarını/toplamını taşı; raporda tek katsayıyla yeniden hesaplama. | M | KESİN |
| P-05 | P0 | YANLIŞ | `convex/lib/shiftResolver.ts:129`; `convex/employees.ts:447` | Çalışan bugün departman değiştirince geçmiş ayın vardiyası ve puantajı da değişebilir. | Plan çözümü her tarih için çalışanın bugünkü departmentId/üst departman zincirini kullanır. bulkUpdateDepartment yalnız departmentId'yi günceller (:461); tarihli üyelik yok. Yeni departmanın önceki ayı kapsayan planı, kişi ataması olmayan eski günlere uygulanır. | Departman üyeliğini yürürlük tarihli tut veya geçmiş günün etkin planını sabitle; transfer tarihini zorunlu al. | L | KESİN |
| P-06 | P0 | YANLIŞ | `convex/lib/pdksWorkDay.ts:20`; `convex/lib/pdksWorkDay.ts:40`; `convex/lib/pdksFixedRules.ts:36` | Gündüz sabit vardiyasının ertesi güne uzatılmış geçerli çıkışı yanlış güne yazılır. | 09:00–18:00 vardiyası, 17:00–ertesi gün 02:00 çıkış penceresi doğrulamadan geçer. 01:00 çıkışında isOvernightShift yalnız vardiya başlangıç/bitişine bakar; :40 erken döner, :48 pencere denetimine ulaşmaz. Böylece önceki günün çıkışı eksik kalır. | İş günü eşlemesinde sabit validWindow gün farkını da dikkate al; ardışık gün girişini ayrı koru. | M | KESİN |
| P-07 | P1 | EKSİK | `convex/lib/pdksMultiShift.ts:67`; `convex/pdksRecords.ts:11`; `src/components/pdks/ManualPdksEditDialog.tsx:69` | Çok vardiyalı günün ara giriş/çıkışı unutulursa yönetici günü tamamlayamıyor. | Kayıt/form yalnız bir entryTime/exitTime çifti taşır; manualForSegment girişi ilk, çıkışı son vardiyaya verir. 08–12 ve 13–17 planında eksik 12 çıkışı/13 girişi için alan veya vardiya kimliği yok; çalışan talebi de bu gün kaydına gider. | Vardiya bölümü bazlı manuel kanıt ve talep modeli ekle; mevcut tek-vardiya kayıtlarını uyumlu tut. | L | KESİN |
| P-08 | P1 | PERF/KOTA | `convex/lib/pdksTableQuery.ts:68`; `convex/lib/shiftResolver.ts:63`; `convex/lib/pdksPayrollQuery.ts:131`; `convex/dashboard.ts:414` | Kayıtlar büyüdükçe tek kişi filtresi bile pahalı sorgu/limit hatası üretebilir. | Tablo kişi filtresinden önce proje dönemindeki tüm okumaları/çalışanları collect eder (:82/:90/:102); çözümleyici bütün vardiyaları ve kişi atama geçmişini okur. Bordro tarih indeksinden manuel kayıtları toplar; ana sayfada yıllık aralık taraması var. Gerçek limit aşımı ölçülmedi. | Kişi/proje/tarih indekslerini sorgu başına uygula; tarih sınırı, sayfalama ve dönem özeti kullan; global vardiya taramasını kaldır. | L | OLASI |
| P-09 | P1 | HATA | `convex/lib/shiftResolver.ts:71`; `convex/shiftPlans.ts:155` | “Tarih aralığını daraltın” uyarısı bazı çalışanlarda hiçbir aralıkta çözülmez. | Sınırlı çözümleyici range alsa da kişisel atamalarda bütün geçmişten take(1001) yapar; 1000 kişi başı/10000 toplam sınırı aşılırsa hata verir. Tek günlük istek geçmiş 1001 kaydı azaltmaz. | Tarihle kesişen atamaları okuyacak indeks/model kur; hata mesajını gerçekten uygulanabilir çözümle eşleştir. | M | KESİN |
| P-10 | P2 | EKSİK | `convex/shifts.ts:194`; `convex/shifts.ts:285`; `convex/leaves.ts:195`; `convex/pdksRecords.ts:81` | Puantajı değiştiren bazı yönetici işlemlerinin kim/ne değiştirdi geçmişi eksik. | Vardiya tanımı/tekli-toplu atama güncelleme/silme ve doğrudan izin create/update audit yazmaz; vardiyada yalnız clearAssignments :672 loglar. Toplu manuel yazma audit:false kullanıp :105/:119'da özet yazar; satırların önceki/sonraki saatleri korunmaz. Departman planı ve tek manuel yazmada audit olması davranışı tutarsızlaştırır. | Hesabı etkileyen tüm yazmalarda kişi/tarih/eski-yeni değerle audit; toplu işlemi ortak işlem kimliğiyle bağla. | M | KESİN |
| P-11 | P2 | TUTARSIZ | `convex/holidays.ts:51`; `src/components/shifts/calendar/useShiftCalendarData.ts:43`; `src/components/shifts/lib/calendarOverlays.ts:16` | İki projeye yetkili yönetici A planında yalnız B'ye ait tatil etiketini görebilir. | listForRange projectId almaz, bütün yetkili projeler+global tatilleri döndürür; holidayOn yalnız tarihe göre ilkini seçer. Takvimde seçilen proje hesapta kullanılan proje takvimiyle uyuşmaz. Yetkisiz proje verisi sızıntısı değil. | Aralık sorgusuna proje ekle; seçili proje+global tatilleri açık öncelikle birleştir. | S | KESİN |

## 4. Modüller arası ilişkiler

| Karşı modül | Bağ (tablo/fonksiyon) | Yön | Sorun var mı (file:line) |
|---|---|---|---|
| M1 kişi/departman | employees.departmentId/shiftId/employmentEndDate; departments.parentId; `lib/employment.ts` | M1 → M3 | Yeni departman planı eski tarihe bugünkü üyelikle uygulanıyor (P-05); işe giriş tarihi eksikliği eski B2.6/B5.7. Ayrılış sonrası ortak bordro günleri filtreleniyor. |
| M2 cihaz/okutma | cardReadings: employeeId/projectId/accessTime/direction/source; devices/doors/readers → pdksCheckpointSelections | M2 → M3 | `pdksSource.ts:73` biyometriyi kasıtlı dışlar; okuyucu önceliği ve kural sürümü hesapta kullanılır. `cardReadingProcess.ts:100` gece yönü iyileşmiş; yeni sabit pencere gün eşlemesi P-06. Canlı alan tutarlılığı teyitsiz. |
| M4 rol/yetki | `projectScope.ts`, `permissions.ts`, `payVisibility.ts`; reports.view/pay.view/schedule.manage | M4 → M3 | Ücret maskesi proje bazlı; rapor üyelik/yetki farkı P-01, izin notu farkı P-02. Proje sınırı bulunması işlem yetkisinin yerine geçmiyor. |
| M4 ayar/audit | generalSettings, workSettings, overtimeRates, auditLog | Çift yön | Tüm-proje hesapta tek ayar P-03; rapor para formülü P-04; değişiklik izi P-10. |
| M4 cron/e-posta | crons → triggerScheduledReports → sendMonthlyReports → getReportSummaryForEmail / markReportSent | M3 → servis | `reports.ts:401`, `sendScheduledReports.ts:32`; aylık özet/hatırlatma, dosya teslimi yok (B5.9). Kullanıcı kapsamı her çalışmada çözülüyor (`reportScope.ts:81`). Servis/env/teslim başarısı canlı teyit. |
| M5 mobil özet | mobileAttendance → lib/mobileAttendance → ortak kural/plan hesapları | M3 → M5 | Ham geçmiş ile onaylı puantaj farklı veri; manuel gün ayrıntısı hâlâ eksik (B2.8). |
| M5 mobil talepler | request_repository → leaveRequests/attendanceCorrections → leaves/pdksRecords | Çift yön | `(commit'siz WIP)` başlangıç kodu: submit/listMine/withdraw bağlı; son durumda commit edilmiş. Düzeltme yönetici web kuyruğu yok (B3.3); karar bildirimi yok (B3.6/B4.7). |

**Zincir sorunları:**

- Departman transferi → tarihli vardiya planı → geçmiş puantaj/bordro: üyelik tarihçesi eksik, planın tarihli olması tek başına geçmişi korumuyor (P-05).
- Mobil düzeltme başvurusu → bekleyen kayıt → web yönetici kararı → manuel puantaj: ortadaki web tüketicisi kopuk (B3.3); backend approve/reject bulunması kullanıcının işi bitirebildiği anlamına gelmiyor.
- Çoklu vardiya → tek manuel günlük kayıt → rapor/SGK inceleme kapısı: ara vardiya kanıtı verilemiyor (P-07); onay akışını eklemek tek başına çözmüyor.
- Aynı gün motoru → dakika toplamı → raporda yeniden para hesabı: gün türü/gece katsayısı bu sınırda kayboluyor (P-04).
- UI'da rapor/not gizleme → alternatif public sorgu: sunucuda aynı sözleşme uygulanmıyor (P-01/P-02).

## 5. Eski audit durumu

Kaynak: `docs/genel-akis-audit/B-pdks-rapor.md` bütünü. **DÜZELDİ**, eski TAMAM maddelerinde “mevcut bağlantı korunuyor” anlamındadır; canlı kabul iddiası değildir. Aynı eski sorunlar yeni P listesinde tekrar sayılmadı. `(commit'siz WIP)` etiketiyle işaretli kodun inceleme sırasında commit edilmesi 1. bölümde açıklanmıştır.

| Eski madde | Durum | Güncel kanıt / kalan |
|---|---|---|
| B1.1 Sabit/esnek vardiya tanımı | DÜZELDİ | `convex/shifts.ts:498`, `lib/pdksFlexible.ts:25`; sabit gelişmiş kurallar da `pdksFixedRules.ts:22` ile doğrulanıyor. |
| B1.2 Toplu atama yazma yetkisi | DÜZELDİ | `convex/shifts.ts:174`, `:274`, `:312` schedule.manage ister; artık salt üyelik yeterli değil. Yetkili beş-rol modeli esas, eski rol adına dönme önerisi yok. |
| B1.3 Haftalık vardiya → çalışma/tatil günü | KISMEN | `shiftResolver.ts:118` rotasyon/boş slot dinlenme; :122 haftalık plan hâlâ project takviminde. `pdksMultiShift.ts:110` plan takvimini destekler; haftalık gün istisnası ve `sgkExport.ts:97` genel iş günü hesabı açık. |
| B1.4 Toplu temizleme / plan export | DÜZELDİ | `shifts.ts:649`, `:672`; `src/lib/shiftExport.ts` ve ShiftCalendarView bağlantısı korunuyor. |
| B1.5 Tarihli kural yayınlama | DÜZELDİ | `pdksRules.ts:126`, `:177`, `:187`; yürürlükteki sürüm değişmez, gelecek sürüm silme kontrollü. |
| B1.6 Kontrol noktası kapsamı | KISMEN | `pdksRules.ts:154` IDE/Hik okuyucu seçimi ve sahiplik doğrulaması eklenmiş; kapı seçimi :168 checkpointDoorReason koşullarına bağlı. Her cihaz/kapının canlı eşitliği henüz kanıtlı değil. |
| B1.7 Tatil proje yetkisi | DÜZELDİ | `holidays.ts:12`, `:37`, `:70`, `:104`, `:123`; global yazma super_admin, diğerleri yetkili proje. Yeni seçili-takvim görünümü P-11 farklı sorundur. |
| B1.8 Özel izin türü / sabit vardiya geçmişi | AÇIK | `leaves.ts:14` sabit türler; `shifts.ts:565` sabit tanımı yerinde değiştirir, :569 patch; geçmiş atamalar aynı tanım kimliğini çözer. |
| B2.1 Cihaz olay sözleşmesi | KISMEN | `lib/pdksSource.ts:31`, `lib/cardReadingProcess.ts:100`; yerel normalizasyon var, cihaz kaynaklarının canlı alan eşitliği denetlenmedi. |
| B2.2 Biyometri/belirsiz kaynak dışlama | DÜZELDİ | `pdksSource.ts:73`, `pdksTableQuery.ts:138`; ortak filtre korunuyor. Kasıtlı ürün kuralı, eksik özellik değil. |
| B2.3 both cihaz gece yarısında yön sıfırlama | DÜZELDİ | `cardReadingProcess.ts:100`–125 önceki vardiya/son okutmayı değerlendiriyor; eski koşulsuz gün değişimi sıfırlaması giderilmiş. Gerçek cihaz tekrarlı okutması teyit gerektirir. |
| B2.4 Çift/eksik/yönsüz kanıt | KISMEN | `pdksDay.ts:102`, `:135`; yeni kanıt/eachPunch mevcut, eski firstLast seçeneği ilk/son çıkarımını koruyor. |
| B2.5 Ara çıkışları net süreden düşme | DÜZELDİ | `pdksDay.ts:151`–181 eachPunch çiftlerini kullanır; firstLast bilinçli ayrı mod olarak kalır. Bu düzeltme mevcut projelerin otomatik moda geçirildiğini göstermez. |
| B2.6 Okutmayan çalışan/devamsızlık | AÇIK | `lib/employment.ts:8`, `lib/pdksTable.ts:76`; işe giriş tarihi modeli yok, ilk kanıt/veri yok ayrımı gerçek işe başlangıcı ikame edemez. |
| B2.7 Dashboard manuel gün | KISMEN | `dashboard.ts:232` legacy manueli dışlayan veri seti; :673 yönetilen gün sonuçları eklenir. Eski sabit manuel gün ile onaylı devam aynı kapsamda değil. |
| B2.8 Mobil geçmiş/özet | KISMEN | `lib/mobileAttendance.ts:135`, `:149`, `:173`; yönetilen gün devam sayısı değişir, ham geçmiş ayrı kalır; onaylı manuel gün ayrıntısı sunulmaz. |
| B3.1 Çalışan düzeltme ekranı | DÜZELDİ | `(commit'siz WIP)` `mobile/lib/router/app_router.dart:124`, `request_repository.dart:66`, `screens/requests/requests_screen.dart:253`; ekran/API bağlantısı mevcut. Son durumda `5de547a8`, canlı başarı iddiası yok. |
| B3.2 Düzeltme tarih/saat/gerekçe | KISMEN | `(commit'siz WIP)` `attendanceCorrections.ts:15`, `lib/requestRules.ts`, mobil form bağlı ve tipli hata dönüşü var; ek dosya alanı yok. |
| B3.3 Yönetici düzeltme kuyruğu | AÇIK | **REGRESYON:** `src/pages/PDKSRecords.tsx:144`–159 kuyruğu render etmez; `src` taramasında attendanceCorrections/CorrectionRequestsPanel çağrısı yok. `attendanceCorrections.ts:65`, `:103` listPending/approve duruyor. Önceki karşılaştırmalı kanıt eksikliğinden daha ağır, ekran zinciri kopmuş. |
| B3.4 Kararın güvenli manuel yazması | DÜZELDİ | `(commit'siz WIP)` `attendanceCorrections.ts:93`–100 ortak manuel yazmayı ve audit'i korur; tek taraflı talep diğer saati silmez. Backend davranışı, B3.3 ekran kopukluğundan ayrıdır. |
| B3.5 Düzeltmenin rapora aktarılması | KISMEN | `lib/reportAttendance.ts:266`–288 eski dalın manuelini artık alır; `reports.ts:93`, `sgkExport.ts:88` kullanır. `legacyOvertime.ts:30` ham ilk/son süre yaklaşımı ortak net/mola motoruyla hâlâ aynı değil. |
| B3.6 Çalışanın sonucu öğrenmesi | KISMEN | `(commit'siz WIP)` `requests_screen.dart:154`, repository listMine sonucu gösterir; `attendanceCorrections.ts:99` karar sonrası push/e-posta üretmez. |
| B3.7 Bekleyen düzeltmeyi geri çekme | DÜZELDİ | `(commit'siz WIP)` `request_repository.dart:85`, `requests_screen.dart:155`; backend withdraw ve görünür düğme bağlı. |
| B4.1 Çalışanın izin başvurusu | DÜZELDİ | `(commit'siz WIP)` mobil RequestsScreen ve `request_repository.dart:55` → `leaveRequests.ts:22`; rota bağlı. |
| B4.2 İzin tarihi/türü doğrulama | KISMEN | `(commit'siz WIP)` `lib/requestRules.ts:41` takvim günü doğrular; `leaveRequests.ts:22` çakışma kontrolü; saatlik izin/ek dosya/iş günü bazlı hak kullanımı yok. |
| B4.3 Yönetici izin kuyruğu | DÜZELDİ | `src/components/leaves/LeaveRequestsPanel.tsx`, `(commit'siz WIP)` `leaveRequests.ts:162`–192; karar sırasında yetki, proje ve çakışma tekrar denetlenir. |
| B4.4 Doğrudan yönetici izni | DÜZELDİ | `leaves.ts:180`–200 doğrudan onaylı kayıt ve LeaveForm yolu korunur. Eksik denetim izi yeni P-10'dur. |
| B4.5 İznin puantaj/rapora aktarılması | KISMEN | `lib/pdksHelpers.ts:205`–209 tatil/hafta tatili önceliği ve genel İZN kodu; `lib/sgkCodes.ts:40` ayrı tür eşlemesi. Tür/saat ayrıntısı ortaklaşmamış. |
| B4.6 İzin bakiyesi | AÇIK | `schema.ts:1244` leaveBalances var; uygulamada hak ediş/kullanım/iptal akışı yok, tabloyu tanımak veya idari listede anmak bakiye hesabı değil. |
| B4.7 İzin sonucu/geri çekme | KISMEN | `(commit'siz WIP)` `request_repository.dart:83`, `requests_screen.dart:133`; istemci bağlandı. `leaveRequests.ts:48` bekleyeni siler, karar bildirimi yok; geçmiş davranışı devam ediyor. |
| B5.1 Proje/dönem/personel raporu | DÜZELDİ | `src/lib/reports/registry.ts:71`, `ReportResults.tsx:22`; 16 rapor ve ortak günlük/aylık kaynak bağlantısı korunur. Yetki açığı ayrı P-01. |
| B5.2 İnceleme/eksik gün kapısı | KISMEN | `sgkExport.ts:86`, `:124`; yönetilen kurallı günler engellenir, eski dal için aynı kapsamda ortak karar yok. |
| B5.3 Seçili kolon/export | DÜZELDİ | `ReportPage.tsx:40`, `PDKSEnhancedExportPanel.tsx:138`, `pdksExportColumns.ts`; kolon ve ücret görünürlük filtreleri korunur. |
| B5.4 Bordro ortak hesap | KISMEN | `pdksPayrollQuery.ts:173` ortak günlük hesap; haftalık plan takvimi B1.3 ve geçmiş tanım değişikliği B1.8 sürüyor. |
| B5.5 SGK özet adı/haftalık mesai | KISMEN | `src/pages/Reports.tsx:20` artık aylık özet adı; `legacyOvertime.ts:52` haftalara böler, ay toplamından tek 45 saat çıkarma giderilmiş. Mola/net süre farkı B3.5 devam ediyor. |
| B5.6 APHB taslak/mesai/manuel | KISMEN | `sgkExport.ts:88` manuel günler, :112 mesai sıfır değil; :133 taslak dosya adı. `sgkCodes.ts` örnek biçim uyarısı korunur; resmî kabul ve tek takvim hesabı tamam kanıtlanmadı. |
| B5.7 Ayrılan/işe başlayan çalışan | KISMEN | `pdksPayrollQuery.ts:173` employedOn, `sgkExport.ts:91` bitiş filtresi; işe giriş tarihi hâlâ yok, `reports.ts:72`–88 izin sayısı istihdam dönemiyle aynı biçimde kesilmiyor. |
| B5.8 Ücret görünürlüğü | DÜZELDİ | `pdksPayrollQuery.ts:160`, `pdksTableQuery.ts:232`, `reports.ts:199`; proje bazlı pay.view, yetkisize null. Varsayılan düşük rol ücret görmez; yetkili HR gibi rolün ücret görmesi bilinçli yeni rol modelidir. Hedefli ücret testleri geçti. |
| B5.9 Otomatik rapor teslimi | AÇIK | `reports.ts:417`, `actions/sendScheduledReports.ts:61` hâlâ hatırlatma/özet, dosya eki yok; UI bunu doğru adlandırıyor. |
| B6.1 Rapor grubu seçimi | DÜZELDİ | `src/lib/reports/registry.ts:71` 3 kayıt+9 günlük+4 aylık korunur. Hik'teki ek üç düzenin eksikliği B6.4'te, çift sayılmadı. |
| B6.2 Ham/mobil hareket ayrıntısı | AÇIK | `registry.ts:64`, `cardReadings.ts:855` filtrelerinde cihaz seçimi yok; mobil konum/ek dosya sütunlarının eşdeğerliği tamamlanmamış. |
| B6.3 Mola/hata raporu | KISMEN | eachPunch süre hesabı ilerlemiş (`pdksDay.ts:151`); `pdksTable.ts:388`–400 ve `registry.ts:83` mola ihlali hâlâ pencere/okutma uyarısı, tam gerçek mola süresi raporu değil. |
| B6.4 Üç özel aylık Hik düzeni | AÇIK | `registry.ts:84`–87 yalnız dört aylık görünüm; Overview/Status/Summary çok satırlı export karşılığı yok. |
| B6.5 Kuruma özel TXT/biçim | AÇIK | `registry.ts:62`, `ReportPage.tsx:52` mevcut export/kolon ayarları; serbest TXT şablon motoru yok. İş ihtiyacı olmadan sırf eşitlik için önerilmiyor. |
| B6.6 Yeniden hesap/periyodik teslim | KISMEN | `ReportResults.tsx:22` güncel sorgudan yeniden hesaplar; `sendScheduledReports.ts:32` dosya teslim etmez, hesap kapanışı/sürümleme yok. Ayrı düğme olmaması başlı başına kusur değil. |

**OZET Faz 3–4 karşılığı:**

| Eski plan | Durum | Kanıt |
|---|---|---|
| 3.1 Eski mesaiyi haftalara ayırma | DÜZELDİ | `legacyOvertime.ts:52`; hedefli test başarılı. |
| 3.2 SGK/APHB ortak hesap + taslak | KISMEN | B3.5, B5.5–6; manuel ve etiket ilerlemiş, net süre/takvim birleşmesi tamam değil. |
| 3.3 Kişinin vardiya günü/tatil ayrımı | KISMEN | `shiftResolver.ts:122`; rotasyonda var, haftalık planda proje takvimi sürüyor. |
| 3.4 Gece both yönü | DÜZELDİ | `cardReadingProcess.ts:100`–125; canlı cihaz akışı teyitsiz. |
| 4.1 Mobil talep aç/geri çek/sonuç | DÜZELDİ | `(commit'siz WIP)` mobil requests rota/repository/screen bağlı; son kontrol `5de547a8`. Uçtan uca yönetici düzeltme kararı için B3.3 ayrıca açık. |
| 4.2 Karar bildirimi | AÇIK | `attendanceCorrections.ts:99`, `leaveRequests.ts:192`; push/e-posta çağrısı yok. |

## 6. Test boşlukları

Geçen 54 test aşağıdaki senaryoların tamamını kapsamaz; yeni test dosyası yazılmadı.

1. reports.view olmayan ama proje üyesi hesabın public rapor uçlarını çağırması; izin listesi ve takvim uçlarında aynı notes/decisionNote maskesi (P-01/02).
2. İki proje, farklı cumartesi/tatil/ücret tabanı ile projectId'siz tablo ve bordro; tek-proje sonuçlarının birleşimine eşitlik (P-03).
3. Tatil/gece/hafta sonu ağırlıklı mesainin PDKS, bordro, mesai özeti ve departman maliyetinde aynı para olması (P-04).
4. Ay ortasında departman transferi ve üst departman değişikliğinden sonra kapanmış günlerin korunması (P-05).
5. Gündüz sabit vardiya + ertesi güne uzayan geçerli çıkış penceresi; sonraki günün erken girişiyle birlikte (P-06).
6. İki/üç vardiyalı günde yalnız ara bölümün eksik saati; yönetici manueli ve çalışan talebinin bu eksikliği kapatması (P-07).
7. 1001 eski kişi atamasıyla tek günlük plan isteği; büyük proje ve tek kişi filtresinde okunacak kayıt sayısının sınırı (P-08/09).
8. Mobil düzeltme → görünür web yönetici kuyruğu → onay → çalışan sonucu akışı; iki proje tatil etiketinin ayrılması ve değişikliklerde audit varlığı (B3.3, P-10/11).

## 7. TEYİT GEREK ve kapsam dışı

- **Canlı/cihaz:** hangi sürümün yayında olduğu, IDE/Hik/ISAPI olaylarının gerçek readerId/doorId/yön/kaynak alanları, both tekrar okutması ve gece geçişleri. Biyometrik olayların puantajdan dışlanması bilinçli karar olarak korundu.
- **Canlı/veri hacmi:** çalışan başına atama geçmişi, ay/yıl okutma hacmi, Convex okuma/boyut/süre sınırlarına gerçek uzaklık; P-08 bir ölçülmüş kesinti değildir.
- **Canlı/servis:** aylık e-posta yapılandırması ve teslimi; uygulama URL'si; dondurulmuş/süresi geçmiş kullanıcıların scheduler davranışı ayrıca M4 kapsamında uçtan uca teyit edilmeli. Kodda e-posta göndermek ile alıcıya ulaştığı bilgisi aynı değildir.
- **Ürün/muhasebe:** haftalık planın tatil önceliği, yarım gün ve izin bakiyesi politikası; APHB taslağının resmî kabulü, Hik'in yalnız export edilen üç dosyasının gerçek örnekleri. Mevzuat veya resmî format uygunluğu hakkında hüküm verilmedi.
- **Kapsam dışı:** M1/M2/M4/M5'in tamamı, fiziksel kapı açma/cihaz eşleme/senkronizasyon, mobil derleme/Flutter analiz, Windows köprü ürünü, hukuk araştırması. İlişki sınırları okundu; ertelenmiş özellikler sırf ertelenmiş oldukları için bulgu yapılmadı.
- Kod düzeltmesi, paket kurma, git değişikliği/commit/stash/checkout/reset, Convex CLI, DB/Supabase, ağ/cihaz isteği, tarayıcı, Netlify ve deploy yapılmadı. Bu worker'ın tek yazdığı dosya bu rapordur.
