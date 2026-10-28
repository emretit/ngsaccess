# Vardiyasız çalışanda PDKS yok — K3 uygulama raporu

Tarih: 2026-10-25. Repo ana dizinde çalışıldı; commit, deploy, DB yazma, backfill, şema değişikliği ve codegen yapılmadı.

## Sonuç ve sözleşme

PDKS için atanmışlık artık yalnız o tarihte geçerli kişi veya departman zinciri atamasıdır. `employees.shiftId` alanı korunur fakat `resolvePlan` için fallback değildir; kaynak türündeki `default` kaldırıldı. `none`, `computePdksPlannedDay` girişinde hesap yapılmadan kesilir. `rest` mevcut hesap yolunda kalır.

Tablo/gün DTO'sunda opsiyonel `noShift: true`, mevcut `noData` durumu ve uyumluluk için sıfır/null sayısal alanlar kullanılır; bunlar hesaplanmış PDKS sayılmaz ve toplamlara/raporlara dahil edilmez. Web tüm sayı hücrelerini `—` gösterir. Tamamen plansız satır listede gri kalır, `Vardiya atanmamış` ve mevcut Sheet'i açan `?plan=1` bağlantısı vardır; çalışan ön seçimi eklenmedi. Kısmi dönemde yalnız plansız hücre `Vardiya yok` olur. Durum filtreleri, üst sayaçlar, analiz ve dışa aktarma bu günleri dışlar.

Mobil için koordinatörün açık kararı: yayımlı Flutter parserı `presentDays == entryCount > 0 olan gün sayısı` şartı koyduğu için **mevcut `presentDays` ham geçiş günü olarak korunur**, opsiyonel `totals.pdksPresentDays` tarihli planla hak edilen PDKS gününü taşır; plansız günde sıfırdır. Eski Flutter yeni alanı görmez ve ham geçiş sayısını göstermeye devam eder. Bu görev Flutter ekranını değiştirmedi; yeni PDKS sayacının mobil UI tarafından tüketilmesi kapsam dışıdır. Yeni status string'i yoktur.

## Çağrı noktası kararları

| Çağrı noktası | Karar |
| --- | --- |
| `convex/lib/shiftResolver.ts:97` | Tarihli kişi/departman zinciri çözümü korunur; son dal `none`. Eski shiftId yüklenebilmesi yalnız ham yön ve elle giriş doğrulaması uyumluluğu içindir. |
| `convex/lib/pdksMultiShift.ts:107` | Tek merkezi gün hesabı koruması; none için punch/izin/tatil/mesai hesabı çağrılmaz. |
| `convex/lib/pdksTable.ts:250` | None günün raw/manual/izin girdileri kullanılmaz; gün detayı/logu yok, noData/noShift; dönem mesaisi ve ölçülebilirlik yalnız atanmış hesaplardan gelir. |
| `convex/lib/pdksTableQuery.ts:247` | Değişmedi; her gerçek çalışan için scoped resolvePlan zaten merkezi çekirdeğe veriliyor. |
| `convex/lib/pdksPayroll.ts:34`, `pdksPayrollQuery.ts:173` | Plan guard ve manual görünürlük; none gün hücresi üretmez, tamamen plansız kişi bordro satırı üretmez. |
| `convex/lib/pdksDetail.ts:37` | Guard sonucu taşınır; none günde manual/izin/raw detay gösterimi bastırılır. |
| `convex/cardReadings.ts:663` | Değişmedi; tablo/bordro/detail uçları merkezi yardımcıları ve scoped planı kullanır. Ham geçiş uçları değişmedi. |
| `convex/lib/reportAttendance.ts:101` | Devam raporu tamamen plansız kişiyi dışlar; karma dönem merkezi tablo hesabıyla yalnız planlı günleri sayar. |
| `convex/lib/reportAttendance.ts:397` | Rule/legacy PDKS rapor adaptörünün ortak çıkışında no-plan günler, manuel kayıtlar ve PDKS için kullanılacak okumalar dışlanır. Ham kapı raporunun readReportReadings/splitPdksEligible/toReportTransactionRow akışı değişmez. |
| `convex/reports.ts` | Değişmedi; PDKS/mesai/SGK raporlarının ortak adaptörü filtrelenir; geçiş raporu korunur. |
| `convex/sgkExport.ts:74` | APHB plansız çalışanı çıkarır ve koordinatörün istediği isimli uyarıyı döner. Kısmi ayda prim/eksik gün hesabı yalnız planlı tarihlerden yapılır; tam ay 30 gün davranışı korunur. |
| `convex/dashboard.ts:267` | Legacy veri kümesi ve gün çekirdeği plan kontrolü yapar; aşağıdaki metrik sınıflaması uygulanır. |
| `convex/lib/pdksChart.ts:116` | Tarih bazlı nüfus/present/late/absent no-plan kişiyi dışlar; hourlyTrend ham geçiş olarak kalır. Mevcut doğrudan üretim çağırıcısı bulunmadı, yardımcı testleri korundu. |
| `convex/mobileAttendance.ts:107`, `convex/lib/mobileAttendance.ts:112` | Ham günlük liste/sayaç/timestamp/enum sözleşmesi korunur; ayrı opsiyonel pdksPresentDays yalnız planlı katılımı sayar. |
| `convex/lib/processCardReadingCore.ts:470` | Geç e-postası yalnız shifts planında değerlendirilir; none/rest scheduler çağrısı üretmez. |
| `convex/lib/cardReadingProcess.ts:62` | Ham geçiş yönü için legacy shiftId fallback korunur; plan resolverına ve PDKS hesabına geri sokulmaz. |
| `convex/lib/pdksManualWrite.ts:57`, `convex/pdksRecords.ts` | Elle kayıt doğrulamasında eski legacy vardiya davranışı korunur; upsert/bulk/preview akışları çalışır. Kaydedilen veri none günde PDKS görünümü/toplamı üretmez. |
| `convex/shiftPlans.ts:158` | Değişmedi; resolverın none çıktısı arayüze taşınır. Eski default rozetleri ilgili iki takvim bileşeninden kaldırıldı. |
| `convex/lib/pdksDay.ts`, `pdksWorkDay.ts`, `pdksAvailability.ts`, `pdksCalc.ts` | Alt hesap/tarih/erişilebilirlik yardımcıları değişmedi. Üretim gün hesabı çağrıları computePdksPlannedDay üzerinden plan guard alır; plan verilmeden çalışan saf yardımcı testleri korunur. |
| `convex/lib/cardReadingAudit.ts`, `deviceHelpers.ts`, erişim kuralları | Değişmedi; ham kart geçişi ve kapı erişimi PDKS atamasından bağımsızdır. |
| `convex/lib/reportScope.ts` | Başka oturumun kirli dosyası, değiştirilmedi; yalnız ilgili temiz reportScope test fixture'ı tarihli plan aldı. |
| İzin/düzeltme talebi ve onay akışları | Değişmedi; onaylı veri de none gün guard'ını aşmaz, izin bakiyesi aynı kalır. attendanceCorrections.test.ts düzenlenmedi. |

Rapor adaptörü legacy projelerde de planı doğrulamak zorunda olduğu için çalışan başına bounded shiftAssignments okuması ekler. Proje çalışan keşifleri ve hazır resolverlar tekrar kullanılır; managed projelerde gereksiz ikinci resolver yüklenmez. w53 okuma bütçesi assertion'ları yeni zorunlu okuma sayısına göre güncellendi. w5a snapshot'ında yalnız 9 sorgu-izi satırı eklendi, rapor sonuçları değişmedi.

## Dashboard metrik sınıflandırması

| Metrik | Sınıf / davranış |
| --- | --- |
| presentToday, lateArrivals, incompleteDays | PDKS: plansız kişi-gün dışarıda. |
| expectedEmployees, devamOrani, PDKS totalEmployees | PDKS: none dışarıda; rest beklenen iş günü değildir, mevcut davranış korunur. |
| leaveToday, overtimeHours, annual overtime balance | PDKS: yalnız tarihli planlı günler; plansız kişi yıllık satır üretmez. |
| repeat late offenders, break violations | PDKS: filtrelenmiş veri kümesi kullanır. |
| Günlük/haftalık PDKS present/late/absent grafik nüfusu | PDKS: planlı çalışan-günler; noShift noData analiz sayımına da girmez. |
| getStats çalışan/cihaz/kart okuma/bekleyen kural sayıları | Ham envanter/erişim: korunur. |
| getTodayTimeline, hourlyTrend | Ham geçiş: korunur. |
| getRecentReadings | Ham geçiş listesi: korunur. |
| getActivitySummary averageFirstEntry, averageLastExit, insideBuilding | Ham giriş/çıkış: korunur; plansız kişinin 10:00/20:00 örneği entegrasyon testinde doğrulandı. |
| Proje workHours ayar etiketi | Yapılandırma bilgisi: korunur, plansız günde PDKS hesabına yedek saat sağlamaz. |

## Flutter salt okuma incelemesi ve sözleşme testi

HEAD sürümü de ayrıca `git show HEAD:mobile/lib/models/attendance_summary.dart` ile okundu. Çalışma ağacındaki başka oturuma ait parser gevşetmesine dayanılmadı. İncelenen dosyalar: `mobile/lib/models/attendance_summary.dart:41,107,142`, `mobile/lib/models/attendance.dart` (`parseInstant` ve yönler), `mobile/lib/repositories/attendance_repository.dart:82`, `mobile/lib/providers/attendance_provider.dart:499`.

`convex/noShift.test.ts` yayımlı parserın şu koşullarını gerçek query yanıtıyla doğrular:

- Europe/Istanbul timezone, geçerli generatedAt, istenen tarih aralığında eksiksiz/benzersiz günler (en fazla 93).
- entry/exit/denied/unknown sayaçları negatif olmayan tam sayıdır; totals dört günlük sayacın toplamına eşittir.
- Eski presentDays ham entryCount>0 gün sayısına eşittir; yeni pdksPresentDays plansız aralıkta sıfırdır.
- Nullable firstEntry/lastEntry/lastExit anahtarları bulunur; giriş/çıkış sayısı ile null eşleşmeleri korunur.
- Timestamp geçerliliği, İstanbul takvim günü ve ilk giriş <= son giriş sırası korunur.
- lastDirection yalnız entry/exit/unknown; entry/exit yönü ilgili pozitif sayacı gerektirir. Yeni status alanı/enum'u gönderilmez.
- Eski summary sözleşmesinde dakika veya çalışma süresi alanı/toplam-dakika invarianti yoktur.

Repository range eşitliğini denetler; provider daysPresent mevcut totals.presentDays okur. Flutter kodu bu worker tarafından değiştirilmedi. Yeni opsiyonel alan bilinmeyen JSON anahtarlarını görmezden gelen eski parserı bozmaz.

## Test kapsamı ve fixture gerekçeleri

- `convex/noShift.test.ts`: legacy shiftId + atamasız kişi, raw geçiş, manual mutasyonu/kayıt, onaylı izin ve tatil birlikte; tablo/noData/noShift, durum filtresi, boş bordro/rapor/APHB, APHB uyarısı, dashboard ham/PDKS ayrımı, mobil ham liste; ayrıca kişisel ve üst-departman ataması için 14 none / 15 plan / 16 none ve yalnız 1 prim günü; HEAD Flutter şekil sözleşmesi.
- `convex/lib/shiftResolver.test.ts`: legacy alan dolu fakat atamasız none; başlangıç ve bitiş sınırları. `shiftPlans*.test.ts` eski default beklentisini none yaptı.
- `convex/processCardReading.characterization.test.ts`: mevcut geç e-postası senaryolarına tarihli plan eklendi; noShift senaryosunda scheduler sıfır. Ham yön testleri değiştirilmedi.
- `src/components/pdks/dashboard/noShift.test.tsx`: gri satır, atama etiketi/linki, sayı boşluğu ve kısmi hücre/metrik filtresi. `recordsView.test.ts` sayaç/export; `analysis.test.ts` noShift analizden dışlama.
- `dashboardPlans.review`, `employeeTermination`, `pdksFixedRules`, `pdksFlexible`, `pdksPayroll.overtime`, `pdksCheckpointTypes`, `pdksEachPunch`, `pdksFixedRules.integration`, `pdksRules`, `reports.attendance`, `reportAttendance`, `reportScope`, `w53Integration`, `w5aLegacyEquivalence` fixture'ları: tarihli plan eklenerek önceki testlerin asıl mesai/yetki/işten çıkış/kural amacının sürmesi sağlandı.
- `pdksNight.handlers`: eski proje saati fallback testlerinin planlı örneklerine açık gündüz ataması; gerçekten atamasız gece örneğinde noShift ve boş bordro. `pdksMultiShift`, `pdksChart`, `assignmentPlans`: default kaynak türü temizliği ve none nüfus kontrolü.
- `w5aFix1`: gerçekten plansız senaryoda atama silinir, present0/noData; ham ortalama/içeride sayımı kalır. Diğer planlı rapor senaryolarına fixture planı eklendi.
- `mobileAttendance`: ham sayaç/JSON beklentileri korundu, pdksPresentDays ek beklentisi. `pdksPlans.integration`, `pdksFixedRules.integration`, `w53Integration`, `w5aFix1` mobil PDKS eşitliği assertion'ları yeni pdksPresentDays alanına taşındı; bu koordinatörün sözleşme kararının sonucudur.
- `payVisibility.handlers.test.ts`: koordinatör izniyle yalnız 2 fixture satırı (09:00–18:00 vardiya ve tarihli atamalar) eklendi; başka oturumun K-03 assertion hunk'ına dokunulmadı, 25 testi geçti.
- Snapshot güncellemesi `convex/__snapshots__/w5aLegacyEquivalence.test.ts.snap` yalnız yeni tarihli plan sorgularını kaydeder.

## Kapılar

Nihai tur: 2026-10-26 01:29, Düzeltme 1 (E-1, Ö-1–3, D-1–5) ve önceki mobil geriye uyumluluk sözleşmesi dahil.

| Komut | Sonuç |
| --- | --- |
| `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` | Exit 0; hata/çıktı yok. |
| `node_modules/.bin/tsc --noEmit -p convex` | Exit 0; hata/çıktı yok. |
| `node_modules/.bin/eslint src convex` | Exit 0; 0 error, 0 warning. |
| `node_modules/.bin/vitest run` | Exit 0; **383 dosya, 4278 test geçti**, 18.19 saniye. |
| `node scripts/find-node-leak.mjs` | Exit 0; hata/çıktı yok. |
| `git diff --check` | Exit 0; whitespace hatası yok. |

Odaklı son mobil/plan/sözleşme turu ayrıca 6 dosya / 76 test geçti. PayVisibility'nin 25 testi ve attendanceCorrections'ın 14 testi tam turda da geçti.

Önceki tam turdaki üç dış hata sonradan ilgili oturum tarafından düzeltildi; bu worker o dosyaları değiştirmedi:

1. `convex/lib/auditLogQuery.test.ts:116`: `employeeAuth: expected undefined to be defined`.
2. `src/components/audit/auditLabels.test.ts:140`: eksik etiket `employeeAuth.email`.
3. `convex/roles.fix1.test.ts:118`: beklenen `Bu işlem için yetkiniz yok`, gelen `EMPLOYEE_PROJECT_MOVE_UNSUPPORTED`.

Bu hatalı turun çıktısı 379/382 dosya ve 4264/4267 test geçti; dış düzeltmeler sonrasındaki ara tam tur 382 dosya / 4267 test geçti. Nihai kapı sonuçları yukarıdadır. UI doğrulaması statik React render testidir; canlı tarayıcı/production doğrulaması yapılmadı.

## Değişen dosyalar (bu worker)

Aşağıda ilk değişiklik satırı verilmiştir; payVisibility dosyasında yalnız fixture hunk'ı bu worker'a aittir. Git stat'teki diğer kirli dosyalar bu işe ait değildir (özellikle mobile/**, employees/leaves/devices, reportScope.ts, PDKSRecords.tsx, CorrectionRequestsPanel ve audit dosyaları).

- `convex/lib/shiftResolver.ts:27`
- `convex/lib/pdksMultiShift.ts:17`
- `convex/lib/pdksTable.ts:43`
- `convex/lib/pdksPayroll.ts:52`
- `convex/lib/pdksDetail.ts:54`
- `convex/lib/pdksPayrollQuery.ts:173`
- `convex/lib/processCardReadingCore.ts:471`
- `convex/lib/reportAttendance.ts:2`
- `convex/dashboard.ts:270`
- `convex/lib/pdksChart.ts:116`
- `convex/mobileAttendance.ts:2`
- `convex/lib/mobileAttendance.ts:116`
- `convex/sgkExport.ts:1`
- `convex/lib/cardReadingProcess.ts:62`
- `convex/lib/pdksManualWrite.ts:5`
- `convex/pdksRecords.ts:5`
- `src/components/pdks/dashboard/PdksRowStatus.tsx:6`
- `src/components/pdks/dashboard/PDKSTableView.tsx:133`
- `src/components/pdks/dashboard/PDKSMobileCardList.tsx:25`
- `src/components/pdks/dashboard/PDKSHeatmapView.tsx:1`
- `src/components/pdks/dashboard/PDKSEmployeeDetailDrawer.tsx:155`
- `src/components/pdks/statusMeta.ts:53`
- `src/components/pdks/lib/presentation.ts:80`
- `src/components/pdks/lib/analysis.ts:17`
- `src/components/pdks/records/recordsView.ts:45`
- `src/components/shifts/ShiftDayDetails.tsx:64`
- `src/components/shifts/ShiftCalendarCell.tsx:46`
- `convex/noShift.test.ts:1`
- `src/components/pdks/dashboard/noShift.test.tsx:1`
- `src/components/pdks/records/recordsView.test.ts:62`
- `src/components/pdks/lib/analysis.test.ts:78`
- `convex/dashboardPlans.review.test.ts:43`
- `convex/employeeTermination.test.ts:20`
- `convex/lib/pdksChart.test.ts:189`
- `convex/lib/pdksFixedRules.test.ts:146`
- `convex/lib/pdksFlexible.test.ts:240`
- `convex/lib/pdksMultiShift.test.ts:48`
- `convex/lib/pdksNight.handlers.test.ts:85`
- `convex/lib/pdksPayroll.overtime.test.ts:31`
- `convex/lib/reportAttendance.test.ts:82`
- `convex/lib/reportScope.test.ts:64`
- `convex/lib/shiftResolver.test.ts:21`
- `convex/mobileAttendance.test.ts:199`
- `convex/pdksCheckpointTypes.test.ts:60`
- `convex/pdksEachPunch.test.ts:19`
- `convex/pdksFixedRules.integration.test.ts:22`
- `convex/pdksRules.test.ts:21`
- `convex/reports.attendance.test.ts:20`
- `convex/w53Integration.test.ts:37`
- `convex/w5aFix1.test.ts:32`
- `convex/w5aLegacyEquivalence.test.ts:31`
- `convex/processCardReading.characterization.test.ts:161`
- `convex/shiftPlans.test.ts:197`
- `convex/shiftPlans.review.test.ts:121`
- `convex/payVisibility.handlers.test.ts:49`
- `convex/__snapshots__/w5aLegacyEquivalence.test.ts.snap:9`
- `src/components/shifts/assignmentPlans.test.tsx:152`
- `convex/pdksPlans.integration.test.ts:60`
- `.claude/reports/vardiyasiz-pdks-report.md:1`

## Açık noktalar

İşlevsel açık soru yoktur; mobil mevcut presentDays ham geçiş olarak kalması koordinatör tarafından açıkça kararlaştırıldı. Yeni pdksPresentDays alanını Flutter ekranında göstermek ayrı mobil işidir. Şema, izin bakiyesi ve onay akışları aynı kaldı; legacy alan/backfill kaldırma işi yapılmadı. Başka oturumların eşzamanlı çalışma ağacı değişiklikleri nedeniyle nihai commit öncesi koordinatörün dosya/hunk sahipliğini koruması gerekir.


## Düzeltme 1 (2026-10-26)

Denetimdeki dokuz bulgu kapatıldı; her bulgunun file:line ve test eşlemesi `.claude/review-vardiyasiz-pdks.md` sonundaki **Düzeltme 1 yanıtları** bölümündedir. Bu bölüm önceki raporun hücre atlama ve `?plan=1` düz bağlantı açıklamalarını günceller: kısmi bordroda plansız gün hücreleri artık korunur, Excel tarihe göre yerleştirir, kısayol yetkili kullanıcı için mevcut hook'u çağıran butondur. Çalışan ön seçimi yapılmadı.

Rapor adaptörü hazır personel/çözümleyici alır ve kapsamlı `hasPlan` paylaşır; ana sayfa ve SGK çift okuma yapmaz. 10.001 eski kişi ve 2.001 eski departman atamasıyla gerçek query yolları test edildi; aralık dışı geçmiş sınırı tetiklemez. 500 kişilik sorgu üst sınırı ve yabancı/legacy personel okuma koruması geri getirildi. SGK kısmi plan uyarısı eklendi, prim günü hesap kuralı korunarak Emre kararı beklenmeye devam ediyor. Onaylı iznin plansız günleri SGK aylık dökümünden çıkarıldı.

Bu tur değişen dosyalar: `convex/{dashboard,reports,sgkExport,noShift.test,w53Integration.test,w5aFix1.test}.ts`, `convex/lib/{shiftResolver,shiftResolver.test,reportAttendance,pdksPayrollQuery,pdksChart}.ts`, `convex/__snapshots__/w5aLegacyEquivalence.test.ts.snap`, `src/utils/{pdksExport,pdksExport.test}.ts`, `src/components/pdks/dashboard/{PdksRowStatus,PDKSTableView,noShift.test}.tsx` ve iki rapor dosyası. Snapshot farkları yalnız sorgu izleridir; rapor DTO ve hesap çıktıları değişmedi. `reportScope.ts`, PDKSRecords sayfası, CorrectionRequestsPanel, şema, generated dosyaları ve diğer yasak dosyalar bu tur düzenlenmedi.
