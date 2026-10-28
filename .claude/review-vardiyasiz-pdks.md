# Denetim — Vardiyasız çalışanda PDKS yok (Claude, salt okuma) 2026-10-25

**Sonuç:** Çekirdek doğru kurulmuş: `resolvePlan` artık `none` dönüyor, gün hesabı tek yerde kesiliyor ve PDKS'yi guard'sız hesaplayan bir üretim yolu bulamadım. Ama kısmi atamada **bordro Excel cetvelinde gün kodları yanlış sütuna kayıyor**. Rapor adaptörü de kişi başı sorgu ekleyerek iki performans/kapsam testini gevşetti. Commit'ten önce 1 Engel düzeltilmeli.

**Sayılar:** Engel 1 · Önemli 3 · Düşük 5

**Kendi koştuğum kapılar (2026-10-25 23:10):**
- `tsc -p tsconfig.app.json` → exit 0
- `tsc -p convex` → exit 0
- `vitest run convex/noShift.test.ts src/components/pdks convex/lib/shiftResolver.test.ts convex/mobileAttendance.test.ts convex/processCardReading.characterization.test.ts convex/reports.attendance.test.ts` → 21 dosya / 204 test geçti

---

## Bulgular

### E-1 · ENGEL · Bordro Excel cetvelinde gün kodları kayıyor
- **Yer:** `convex/lib/pdksPayrollQuery.ts:175` (plansız günler `allCells`'ten atılıyor) + `src/utils/pdksExport.ts:289-290` (`row.cells.forEach((cell, ci) => sheet.getCell(r, 5 + ci))`, yani hücre sırayla yerleşiyor).
- **Senaryo:** Haziran 2026'da ataması 15'inde başlayan kişi düşün. Cetvel `cells = [15, 16, …, 30]` döner (`convex/noShift.test.ts:128` bunu açıkça bekliyor). Excel'de 15 Haziran'ın kodu "01" sütununa, 16'sı "02"ye yazılır. Gün 17-30 sütunları boş kalır. Ortada boşluk olan atamalarda da (örn. 1-10 ve 20-30) aynı kayma olur. Sonuç: yanlış puantaj/bordro belgesi.
- **Daha önce neden çıkmıyordu:** `employedOn` yalnız bitiş tarihinden keser (`convex/lib/employment.ts:10`). Bu yüzden hücreler hep 1. günden başlayan kesintisiz bir diziydi. Web rapor ızgarası tarihle eşleştiği için etkilenmiyor (`src/lib/reports/registry.ts:118` `cells.find(item => item.date === day)`).
- **Düzeltme (birini seç):** (a) Dışa aktarımı tarihle eşle: `const col = 5 + data.days.indexOf(cell.date)`. (b) Daha güvenlisi: sunucu plansız gün için de hücre döndürsün (`noShift: true`, `payrollCode: "—"`, toplamlara girmesin). Tarihe göre değil sıraya göre okuyan başka tüketici varsa o da bozulmaz. Kısmi atama için dışa aktarım testi ekle.

### Ö-1 · ÖNEMLİ · Rapor adaptörü kişi başı atama sorgusu ekledi, kota/limit riski
- **Yer:** `convex/lib/reportAttendance.ts:400-404` (`planEmployees` → her proje için `buildBoundedShiftResolver(ctx, employees)`), `convex/sgkExport.ts:74` (ikinci kez), `convex/lib/shiftResolver.ts:71-75`.
- **Senaryo:** 500 kişilik eski tip (legacy) projede her PDKS raporu, SGK ve ana sayfa sorgusu artık:
  - fazladan 500 adet `shiftAssignments.by_employee` sorgusu atıyor (`take(1001)`, tarih sınırı yok, tüm geçmişi okuyor),
  - ayrıca referans verilen vardiyalar için `db.get` yapıyor,
  - departman atamalarını tarih aralığı olmadan okuyor.
- **Çift okuma:** Ana sayfa zaten `buildShiftResolver` ile N sorgu yapıyor (`convex/dashboard.ts:240-246`). Adaptör N sorgu daha ekliyor. SGK'da da adaptör + `sgkExport.ts:74` toplam 2N sorgu ediyor. Snapshot'ta görünüyor: `employees by_project` ikinci kez okunuyor (`w5aLegacyEquivalence.test.ts.snap:9,83`).
- **Limit hesabı:** 31 günlük ayda 500 kişi için yaklaşık 1000-1500 sorgu çıkıyor. Bu Convex'in fonksiyon başı sorgu/okuma sınırının (yaklaşık 4096 çağrı, 32k doküman) altında. Ama yaklaşık 1500-2000 kişide ana sayfa sınıra yaklaşır. Asıl yeni kırılma noktası şu: projedeki toplam atama satırı 10.000'i geçerse (tüm geçmiş dahil) `shiftResolver.ts:76` hata fırlatıyor ("Vardiya atama sınırı aşıldı"). Bu hata artık legacy projelerde de ana sayfayı, PDKS raporlarını ve SGK'yı düşürür. Free planda okuma bant genişliği de her ana sayfa yenilemesinde artıyor.
- **Düzeltme:**
  1. Adaptörün kurduğu `planResolvers`/`hasPlan` sonucunu dönüşte paylaş. SGK ve ana sayfa yeniden kurmasın.
  2. `buildBoundedShiftResolver` aralık verildiğinde `by_employee_end` + `gte("endDate", range.start)` kullansın (indeks var, `cardReadingProcess.ts:47`'de kullanılıyor). `readDepartmentPlans`'e de aralık geçilsin.
  3. Ana sayfa yolunda (`includeLegacyReadings:false`) mevcut `shiftResolver` dışarıdan verilebilsin.

### Ö-2 · ÖNEMLİ · İki performans/kapsam testinin amacı tersine çevrildi
- **Yer:** `convex/w53Integration.test.ts:342-379`. "D3: … kişi başı vardiya sorgusu açmaz" testi "tarihli planlar bir kez yüklenir" olarak yeniden adlandırılmış. Beklenti `shiftAssignments: 500` ve `gets: 1/2` olarak güncellenmiş. Bu test tam olarak Ö-1'deki maliyete karşı bir korumaydı.
- **Yer:** `convex/w5aFix1.test.ts` D1 ("karma kapsamda ek personel/vardiya/okuma yalnız sürümlü proje içindir"). `["employees","cardReadings"]` yabancı proje assertion'ı yalnız `cardReadings`'e daraltılmış. Artık legacy projenin çalışanları da sorgulanıyor.
- **Değerlendirme:** Doğruluk için bir plan okuması gerekiyor, bu yüzden değişiklik gerekçesiz değil. Ama koruma tamamen kalktı. Üst sınır assertion'ı konmalı (örn. "500 kişide en fazla 1 proje-bazlı + N kişi-bazlı sorgu, ikinci kopya yok"). Ö-1'in 1. maddesi yapılınca D3'teki ikinci kopya ve D1'deki `employees` okuması da düşer.

### Ö-3 · ÖNEMLİ (iş/yasal risk) · SGK kısmi ayda prim günü plan günlerine iniyor, uyarı yok
- **Yer:** `convex/sgkExport.ts:75,103,113-115`.
- **Senaryo:** Kişi tüm ay çalışıyor (ücret ve sigorta tam), ama vardiya ataması 15'inde girilmiş. APHB'de prim günü 30 yerine 16 çıkıyor (`min(30, plannedDates) - eksik`). Eksik gün nedeni de üretilmiyor. Tamamen plansız kişi için isimli uyarı var, kısmi plan için yok. Spec Kural 6'ya ("plansız kişi-günleri hariç") uygun. Ama SGK prim günü hukuken vardiya planına değil istihdam/ücrete bağlı. Taslak uyarısı (`APHB_DRAFT_WARNING`) olsa da sessiz bir eksik bildirim riski var.
- **Düzeltme:** En az şunu yap: `plannedDates(employee).length < employed days` olduğunda isimli uyarı ekle ("X: N gün vardiya atanmamış, prim günü yalnız planlı günlerden hesaplandı"). Kuralın SGK'ya uygulanıp uygulanmayacağını Emre'ye sor.

### D-1 · DÜŞÜK · Plansız güne düşen onaylı izin "SGK Aylık Döküm" raporunda izin gününe giriyor
- **Yer:** `convex/reports.ts:71-88` (`leaveDaysInMonth` plan filtresi olmadan ayın tüm onaylı izin günlerini sayıyor). Dosya değişmemiş, ama kısmi atamada Kural 10'u ihlal ediyor.
- **Senaryo:** 15'inde başlayan atama + 3-5 arası onaylı izin. Satır, planlı günlerdeki geçişler yüzünden var ve `izinGunu = 3` gösteriyor. Tamamen plansız kişi satır üretmediği için etkilenmiyor.
- **Düzeltme:** İzin günlerini adaptörün `hasPlan`'ı ile süz.

### D-2 · DÜŞÜK · "Vardiya ata" bağlantısı tam sayfa yeniden yüklüyor ve izin kontrolü yok
- **Yer:** `src/components/pdks/dashboard/PdksRowStatus.tsx:30` (`<a href="?plan=1">`).
- **Senaryo:**
  - Düz bağlantı olduğu için React Router kullanılmıyor. Sayfa yeniden yükleniyor, Convex bağlantısı ve sayfa durumu sıfırlanıyor.
  - Mevcut sorgu parametreleri `plan=1` ile değiştiriliyor.
  - `schedule.manage` yetkisi olmayan kullanıcıya da gösteriliyor.
  - Çalışan önceden seçilmiyor (spec "kolaysa" diyor).
- **Düzeltme:** `useShiftPlanOpen().setOpen(true)` çağıran bir `<button>` kullan (`ShiftPlanSheet.tsx:10`). `can("schedule.manage")` yoksa yalnız etiketi göster. Erişilebilirlik tarafında sorun yok: bağlantı metni anlamlı. Kontrast açık temada yaklaşık 6:1 (muted-foreground %38,6 / muted %95 açıklık), koyu temada da yeterli.

### D-3 · DÜŞÜK · Ölü yardımcıda gereksiz tip dönüşümü
- **Yer:** `convex/lib/pdksChart.ts:116` (`id as Id<"employees">`). `computePdksChartData`'nın üretimde çağıranı yok (yalnız testler).
- **Düzeltme:** `allEmployeeIds`'i `Id<"employees">` tipiyle tut, ya da yardımcıyı ayrı bir temizlik işinde kaldır.

### D-4 · DÜŞÜK · Eski `employees.shiftId` vardiyası hâlâ okunuyor
- **Yer:** `convex/lib/shiftResolver.ts:79`. `buildBoundedShiftResolver` `employee.shiftId`'yi `ids`'e katıp `db.get` yapıyor. Bunu yalnız elle kayıt doğrulaması (`pdksManualWrite.ts:57-62`) kullanıyor. Ama okuma her rapor ve mobil çağrıda yapılıyor (w53 `gets: 1`).
- **Düzeltme:** Bu okumayı yalnız `manualValidationShift` ihtiyaç duyduğunda yap.

### D-5 · DÜŞÜK · SGK ve ana sayfa planı proje kapsamına almıyor
- **Yer:** `convex/sgkExport.ts:75` ve `convex/dashboard.ts:274,331`. Burada `resolvePlan` doğrudan kullanılıyor; tablo, bordro ve rapor yollarında ise `scopedPdksPlan(…, projectId)` var.
- **Senaryo:** Başka projeye ait bir vardiyanın ataması (bozuk veri) bu iki yolda "planlı" sayılır, tabloda ise `none` olur. Pratik etkisi düşük, ama tutarsız.

---

## 10 sorunun kısa cevapları

1. **Sızıntı:**
   - Yok. Üretimde gün hesabı yalnız 3 yerden çağrılıyor: `pdksTable.ts:311`, `pdksPayroll.ts:34` ve `pdksDetail.ts:37`. Üçü de `computePdksPlannedDay`'e plan veriyor. `none` durumunda `pdksMultiShift.ts:111` hesap yapmadan dönüyor.
   - `computePdksTableRow`'un tüm çağıranları `resolvePlan` geçiyor: `pdksTableQuery.ts:247`, `reportAttendance.ts:155,382` ve `mobileAttendance.ts:169`.
   - `thresholdsForShift`/`settingsForShift(null)` yedeği şu yerlerde kalıyor: ana sayfada plan süzgecinden geçmiş okumalarla (`dashboard.ts:346,522,686`) ve `rest` günlerinde. `rest` korunan eski davranış.
   - Geç e-postası `processCardReadingCore.ts:471`'de `shifts` dışındaki planlarda erken dönüyor.
   - `pdksChart` için üretim çağıranı yok.
2. **Elle kayıt / düzeltme / izin / tatil:** Tablo, detay, bordro, rapor adaptörü, SGK ve ana sayfada bastırılıyor:
   - `pdksTable.ts:301-307`: plansız günde okuma/elle kayıt/izin `undefined`
   - `pdksDetail.ts:99-104`
   - `pdksPayroll.ts:94`
   - `reportAttendance.ts:418-424`: elle kayıtlar `hasPlan` ile süzülüyor
   - `sgkExport.ts:103`: yalnız planlı günler sayılıyor
   - `dashboard.ts:385`: izin
   - Plansız gün `classification:"workday"` döndüğü için tatil sayılmıyor.

   Tek istisna D-1 (SGK Aylık Döküm izin günü).
3. **Kısmi dönem:**
   - Resolver sınırları doğru, testi var: `shiftResolver.test.ts` ve `noShift.test.ts:108` (14 none / 15 plan / 16 none; departman zinciri dahil). Departman zinciri ve `rest` korunmuş (`shiftResolver.ts:123-145`, `pdksMultiShift.ts:122-124`).
   - SGK: tam ay 30 kuralı korunuyor; kısmi ay `min(30, planlı gün) - eksik` ile hesaplanıyor (bkz. Ö-3).
   - Bordro: hesap doğru, Excel çıktısı bozuk (E-1).
4. **Geç kalma e-postası:**
   - Plansızda tetiklenmiyor (`processCardReadingCore.ts:471`; test `processCardReading.characterization.test.ts` "noShift" → scheduler çağrısı yok).
   - Planlıda davranış aynı: diğer 5 senaryo tarihli planla aynı efektleri bekliyor.
   - Tek yol bu: `sendLateNotification` yalnız `processCardReadingCore.ts:490`'dan çağrılıyor.
5. **Mobil geriye uyum:** Kırılma yok.
   - HEAD parser'ı (`attendance_summary.dart:107-117,171-180`) 5 sayaç okuyor ve `presentDays == entryCount>0 olan gün` şartı koyuyor. Bilinmeyen alanları yok sayıyor, anahtar sayısını kontrol etmiyor.
   - Yeni `pdksPresentDays` alanı `v.optional` (`mobileAttendance.ts:112`). Yeni status değeri yok.
   - Artı tarafı: HEAD sunucusu requirements/esnek modda `presentDays`'i PDKS günüyle eziyordu. Bu, yayımlı parser'ı "Inconsistent attendance summary" hatasıyla kırabiliyordu. Yeni kod bunu düzeltiyor.
   - Maliyet: `summary` artık her çağrıda `buildBoundedShiftResolver` çalıştırıyor (1 sorgu + vardiya get'leri). Kabul edilebilir.
6. **Geçiş verisi korunuyor mu:** Evet.
   - Ham listeler değişmedi: `getRecentReadings`, `getTodayTimeline`, mobil gün listesi, `getActivitySummary` ortalama giriş/çıkış ve "binada" sayısı (`activityReadings` filtresiz).
   - Kapı raporları `loadRuleReportDays`'i kullanmıyor.
   - Yön yedeği `cardReadingProcess.ts:62-66` HEAD ile eşdeğer (`none` → eski `shiftId`).
   - Tablodaki `detailedLogs`/`punches` plansız günde boş. Bu PDKS görünümü, geçiş listesi değil.
   - Davranış farkı: PDKS raporlarından personeli bulunamayan kart okumaları da düşüyor (`reportAttendance.ts:425-428`). Bunlar daha önce "Bilinmiyor" satırı olarak çıkabiliyordu. Kurala uygun, bilgi notu.
7. **Performans/kota:** Bkz. Ö-1.
   - 500 kişi / 31 gün sınırın altında kalıyor, ama ana sayfada çift okuma var.
   - Projede toplam atama 10.000'i geçerse hata fırlatılıyor. Bu yeni kırılma noktası artık legacy projeleri ve ana sayfayı da kapsıyor.
   - w53 assertion artışı doğruluk için gerekli, ama ikinci kopya ve tarih sınırı olmayan okuma gereksiz.
8. **Test zayıflatma:**
   - Davranış testlerinde gizlenen eski davranış yok. `default` beklentileri açıkça `none` oldu, ham sayaçlar korundu.
   - Mobil PDKS eşitlikleri `pdksPresentDays`'e taşındı. Koordinatör kararıyla tutarlı.
   - Fixture'lara tarihli atama eklenmesi davranış-nötr. Hepsi testin tarihini kapsayan tam yıllık tek atama.
   - Snapshot yalnız sorgu izi (9 satır `employees`/`shiftAssignments`); sonuç değişmiyor.
   - **Ama** iki performans/kapsam koruması gevşetildi (Ö-2).
   - `shiftResolver.test.ts`'teki "eski resolver'a birebir eşit" testi eski `shiftId` yedeği çıkarılarak yeniden tanımlandı. Bu, kuralın doğal sonucu.
9. **UI:**
   - Çalışanlar:
     - Tam plansız satır gri, "Vardiya atanmamış" + "Vardiya ata" ve sayılar "—": `PDKSTableView.tsx:133,162,166`, `PDKSMobileCardList.tsx:25,65`, `PDKSHeatmapView.tsx:73,82,123`
     - Kısmi dönemde hücrede "Vardiya yok": `PDKSHeatmapView.tsx:114`
     - Filtreler: `presentation.ts:161,172`, `pdksTable.ts:507`
     - Üst sayaçlar ve dışa aktarma: `recordsView.ts:45-47,75`
     - Analiz: `analysis.ts:17`
   - Sorunlar:
     - Bağlantı tam sayfa yeniden yüklüyor ve izin kontrolü yok (D-2).
     - Gri satırda `hover:bg-muted/50` hover'da daha açık bir renk veriyor (kozmetik).
     - Kontrast yeterli.
10. **Kod kuralları:**
    - `any` ve `!` eklenmemiş. camelCase korunmuş, metinler Türkçe.
    - Tek tip dönüşümü var (D-3).
    - Tekrarlar:
      - plan yükleme (Ö-1)
      - `buildPeriodDateKeys(startDate, endDate)` filtre içinde kişi/izin başına yeniden hesaplanıyor (`dashboard.ts:385,401,434`); küçük CPU maliyeti
      - `pdksChart`'ın üretimde çağıranı yok


## Düzeltme 1 yanıtları

2026-10-26. Dokuz bulgu giderildi; aşağıdaki değişiklikler önceki worker'ın çalışma ağacının üzerine uygulandı. SGK hesap kuralı değiştirilmedi.

- **E-1:** `convex/lib/pdksPayrollQuery.ts:173` istihdam kapsamındaki tüm günleri üretir; plansız hücre `noShift: true` / `payrollCode: "—"` taşır. `:199` fazla mesai girdilerinden, `:213` sayaçlardan çıkarılır; `:252` tamamen plansız kişiyi satırdan çıkarır. `src/utils/pdksExport.ts:290` hücre sütununu `data.days.indexOf(cell.date)` ile bulur, aralık dışı tarihi atlar. Testler: `convex/noShift.test.ts:142` **payroll retains every calendar cell for partial assignments $ranges** (15–30 ve 1–10/20–30); `src/utils/pdksExport.test.ts:7` **payroll Excel places %s cells by date under the matching day header** (15 başlangıcı, ortadaki boşluk, ters/sparse hücreler ve aralık dışı tarih). Gerçek ExcelJS worksheet'inde her gün başlığı ve hücre sütunu doğrulanır.
- **Ö-1:** `convex/lib/reportAttendance.ts:255` hazır personel ve `shiftResolver` alır; `:432` `hasPlan` ve `planResolvers` paylaşır. `convex/sgkExport.ts:61` hazır personeli adaptöre verir ve `:73` paylaşılan `hasPlan` kullanır. `convex/dashboard.ts:231` tek bounded resolver kurar, `:241` adaptöre verir. `convex/lib/shiftResolver.ts:74` aralık varsa `by_employee_end` / `gte(endDate, range.start)` kullanır; `:76` departman okuyucusuna aynı aralığı geçirir. Adaptörün aralığı hesap geçmişi/gece sınırları için başlangıç −7, bitiş +1 gündür. `:80` eski `by_employee` creation sırasını koruyarak eşit `updatedAt` önceliğinin değişmesini önler. Test: `convex/noShift.test.ts:180` **over 10000 expired personal and 2000 department assignments do not break reports or dashboard; each resolver loads once** gerçek convex-test verisinde 10.001 eski kişi, 2.001 eski departman atamasıyla adaptör/ana sayfa/SGK'yı çalıştırır; her yolda `shiftAssignments = 1`, `employees = 1`, departman sorguları ≤2. Mevcut limit+1 korumaları kaldırılmadı; yoğun geçerli/future atama aralıkları sınırları aşarsa hata vermeye devam eder.
- **Ö-2:** `convex/w53Integration.test.ts:342` **D3: 500 kişide atama sorguları en fazla N+1; personel ve resolver ikinci kez okunmaz** testi atama sorgularına ≤501, personel sorgularına ≤1, referans vardiya get'lerine ≤2 üst sınır koyar; önce/sonra tam sorgu beklentileri de korunur. `convex/w5aFix1.test.ts:225` **D1: karma kapsamda legacy/yabancı projenin personel ve okumaları yüklenmez; sürümlü personel en fazla bir kez okunur** testi hem `employees` hem `cardReadings` için yabancı proje yasağını ve sürümlü personel okumasında ≤1 sınırını doğrular. `convex/__snapshots__/w5aLegacyEquivalence.test.ts.snap` içindeki 6 snapshot yalnız sorgu izi için güncellendi: tarihli indeks, kaldırılan ikinci personel/atama okuması ve kaldırılan tüm-vardiya taraması; DTO/hesap çıktıları aynı.
- **Ö-3:** `convex/sgkExport.ts:79` kısmi ayda istihdam günü − planlı gün farkını isimli ve istenen metinle bildirir. Tamamen plansız kişiye önceki dışlama uyarısı korunur; prim/eksik gün hesabı aynı. Test: `convex/noShift.test.ts:111` **partial personal and inherited department assignments include only their inclusive dated days** hem kişi hem departman atamasında 1 prim gününü ve 29 plansız gün uyarısını doğrular. SGK hesap kuralına ilişkin Emre kararı bekleniyor; bu tur yalnız görünür uyarı ekledi.
- **D-1:** `convex/reports.ts:86` onaylı iznin ayla kesişen günlerini adaptörün `hasPlan` sonucuyla süzer. Test: `convex/noShift.test.ts:157` **SGK monthly leave counts only the planned part of approved leave**: 15'inde atama, 3–5 ve 14–16 izinleri → yalnız 15–16 sayılır, `izinGunu = 2`.
- **D-2:** `src/components/pdks/dashboard/PdksRowStatus.tsx:29` mevcut `useShiftPlanOpen().setOpen(true)` çağıran `button type="button"` kullanır; `schedule.manage` yoksa sadece etiket kalır. `src/components/pdks/dashboard/PDKSTableView.tsx:133` plansız satırın hover rengini `bg-muted` tutar. Testler: `src/components/pdks/dashboard/noShift.test.tsx:26` **keeps unassigned employees gray with an assignment shortcut and blank numeric cells**; `:50` **assignment button keeps search parameters and only appears with schedule.manage** gerçek hook ile `project=abc&status=late` parametrelerinin korunup `plan=1` eklendiğini, propagation'ın durdurulduğunu ve yetkisiz kullanıcının butonu görmediğini doğrular. Çalışan ön seçimi **yapılmadı**: mevcut hook sadece açık/kapalı durumunu yönetiyor; çalışan seçme arayüzü sunmuyor. `ShiftPlanSheet.tsx` değişmedi.
- **D-3:** `convex/lib/pdksChart.ts:103` kişi anahtarını tipli `Id<"employees"> | undefined` ile eşler; `:116` `as Id<"employees">` dönüşümü kaldırıldı. Test: `convex/lib/pdksChart.test.ts:186` **plan-aware chart keeps zero/one shift results structurally identical** ve chart testlerinin tamamı geçti.
- **D-4:** `convex/lib/shiftResolver.ts:83` bounded rapor/mobil yükleyici yalnız tarihli atamalardaki vardiya ID'lerini okur, legacy `employee.shiftId` için `db.get` yapmaz. Elle doğrulamanın mevcut `buildShiftResolver` / `manualValidationShift` yolu ve legacy vardiya haritası korundu (`convex/lib/pdksManualWrite.ts:16,57`); elle giriş davranışı değişmedi. Test: `convex/lib/shiftResolver.test.ts:142` **bounded reports skip the legacy shiftId get and preserve creation-order ties with an end-date index** atamasız kişide 0 get, atamalı kişide yalnız iki referans get'i ve creation sırasını doğrular; `convex/noShift.test.ts:36` elle giriş akışının çalıştığını doğrular.
- **D-5:** SGK `convex/sgkExport.ts:73` → `convex/lib/reportAttendance.ts:415` kapsamlı `hasPlan` kullanır. Ana sayfa `convex/dashboard.ts:235` çözümleyici çıkışını çalışanın proje kapsamına alır; bellek içi çekirdek `:339,394,410,413` de `scopedPdksPlan` uygular. Test: `convex/noShift.test.ts:168` **foreign project shift assignments do not grant dashboard or SGK attendance** bozuk yabancı proje vardiyasının SGK satırı/present/late üretmediğini doğrular.

**Cetvel tüketici taraması:** `src/utils/pdksExport.ts` tek sıra-numarasıyla bordro hücresi yerleştiren tüketiciydi. `src/lib/reports/registry.ts:118,121` zaten `cell.date === day` ile eşler; rapor ekranı/dışa aktarma bu tanımı kullanır. `src/lib/reports/export.ts` genel hazırlanmış kolon hücrelerini işler; bordro gün dizisini indekslemez. `src/components/shifts/ShiftCalendarGrid.tsx` ayrı vardiya takvimi DTO'sunu kullanır, bordro cetveli tüketicisi değildir. Başka bordro hücresi sıra tüketicisi bulunmadı.

**Nihai kapılar (2026-10-26 01:29):** app tsc exit 0; convex tsc exit 0; eslint exit 0 (0 hata/uyarı); vitest **383 dosya / 4278 test geçti**, 18.19 sn; find-node-leak exit 0; git diff --check exit 0. Yasak dosyalara yazılmadı; commit/codegen/deploy/DB yazımı yapılmadı (testler yalnız bellek içi convex-test fixture'larıdır).


## Tekrar denetim (Düzeltme 1)

**Sonuç:** Dokuz bulgunun dokuzu da kapandı; düzeltmeler yeni Engel/Önemli hata getirmedi. Yalnız 2 küçük açık kaldı (departman eşit-`updatedAt` sırası, resolver testinde uzun atama senaryosu eksik).
**Yeni bulgu:** Engel 0 · Önemli 0 · Düşük 2.

**Kendi koştuğum kapılar (2026-10-26):** `tsc -p tsconfig.app.json` exit 0 · `tsc -p convex` exit 0 · belirtilen vitest seti 23 dosya / 172 test geçti.

### Önceki bulgular

| Bulgu | Durum | Kanıt |
|---|---|---|
| E-1 | **Kapandı** | `pdksPayrollQuery.ts:173` istihdamdaki her gün için hücre üretiyor; plansız hücre `noShift` + `payrollCode "—"` (status `noData`, `pdksTable.ts:62`). Fazla mesai `:199`, sayaçlar `:213`, satır filtresi `:252` plansızı dışlıyor. Excel `pdksExport.ts:289-291` sütunu `data.days.indexOf(cell.date)` ile buluyor, aralık dışını atlıyor. Test: `noShift.test.ts:142` (15–30 ve 1–10/20–30), `pdksExport.test.ts:7` (gerçek ExcelJS, 3 senaryo). |
| Ö-1 | **Kapandı** | `shiftResolver.ts:74-76` aralıkta `by_employee_end` + `gte(endDate, start)`; adaptör/SGK/ana sayfa tek resolver paylaşıyor (`reportAttendance.ts:408,432`; `sgkExport.ts` `ruleReport.hasPlan`; `dashboard.ts:231`). Snapshot'ta ikinci `employees` okuması ve `shifts collect` düşmüş. Test: `noShift.test.ts:180` (10.001 eski atama, 3 yol, `shiftAssignments`=1). |
| Ö-2 | **Kapandı** | `w53Integration.test.ts` D3: `shiftAssignments ≤501`, `employees ≤1`, `gets ≤2` + tam önce/sonra eşitliği. `w5aFix1.test.ts` D1: yabancı proje için `employees` **ve** `cardReadings` yasağı + sürümlü proje `employees` ≤1. Üst sınırlar anlamlı (N+1), gevşek değil. |
| Ö-3 | **Kapandı (uyarı)** | `sgkExport.ts:79-82` kısmi ayda isimli uyarı; `noShift.test.ts:111` metni doğruluyor. Hesap kuralı için Emre kararı hâlâ açık (koordinatör notu). Projede işe giriş tarihi alanı olmadığı için "yeni başlayan" kişide yanlış alarm riski yok (`employedOn` yalnız bitişten keser). |
| D-1 | **Kapandı** | `reports.ts:86-88` izin günleri `hasPlan` ile süzülüyor; `noShift.test.ts:157` (3–5 ve 14–16 → 2). |
| D-2 | **Kapandı** | `PdksRowStatus.tsx:29-37` `button type="button"` + `setOpen(true)` + `schedule.manage` kapısı. Doğal `<button>` → klavye (Tab/Enter/Space) çalışır. Satır tıklaması tetiklenmez: hem `stopPropagation` hem `isRowActivationClick` (`tableRowClick.ts:15`, `button` hedefini hariç tutuyor). `PDKSTableView.tsx:133` hover `bg-muted`. Çalışan ön seçimi yapılmadı (spec "kolaysa" → kabul). |
| D-3 | **Kapandı** | `pdksChart.ts` `as Id<"employees">` kalktı (tsc temiz). |
| D-4 | **Kapandı** | `shiftResolver.ts:83` `ids` yalnız tarihli atama/plan vardiyaları; `employee.shiftId` `db.get` yok. Elle giriş `buildShiftResolver` yolunda (`pdksManualWrite.ts:16`) korunmuş. |
| D-5 | **Kapandı** | SGK: kapsamlı `hasPlan`; ana sayfa `dashboard.ts:235-240` resolver çıkışını `scopedPdksPlan` ile sarıyor; test `noShift.test.ts:168`. |

### Soru 2 — yeni hata var mı?

- **`buildBoundedShiftResolver` aralığı: doğru.** `by_employee_end` `endDate ≥ start−7` ile uzun atamayı (startDate çok eski, endDate aralıkta) ve çok uzak/açık uçlu endDate'i yüklüyor; `startDate ≤ end+1` süzgeci yalnız gelecekteki atamaları eliyor (`shiftResolver.ts:80-81`). Kişi atamalarında eşit `updatedAt` önceliği `_creationTime` sıralamasıyla korunuyor (`:81-82`, ardından kararlı `updatedAt desc` sıralaması `createShiftResolver`'da). `take(1001)` + 10.000 toplam sınırı eskisiyle aynı ama artık yalnız aralıkla kesişen satırları sayıyor.
- **Bordro plansız hücreler: toplamlara girmiyor.** `calculatePeriodOvertime` `!noShift` ile besleniyor, toplamlar `c.noShift` ile atlıyor, `hasPlan`siz kişi satırdan düşüyor. Web ızgara: `registry.ts:118` hücre `noData` → `—`; `rows.ts` `countAttendance` `noData`'yı atlıyor (çalışılan/izin/DV/hafta sonu sayılmaz). Excel'de "—" yazılıyor, renk yok. SGK hücreleri kullanmıyor.
- **Ana sayfa: karışma yok.** `activityReadings` (ham geçiş: binada, ort. giriş) plan süzgecinden geçmiyor; `readings`/PDKS metrikleri `resolvePlan(...).kind !== "none"` ve kapsamlı resolver ile süzülüyor (`dashboard.ts:339,394,410,413`). `w5aFix1` testi `presentToday 0` + `insideBuilding 1` ile ayrımı kanıtlıyor.
- **`PdksRowStatus`:** yukarıdaki D-2 satırı; sorun yok.

### Soru 3 — test korumaları ve snapshot

- w53 D3 ve w5aFix1 D1 artık gerçek üst sınır (N+1 / ≤1 / ≤2) koyuyor; önceki "tam eşitlik gevşetildi" durumu düzelmiş.
- Snapshot yalnız sorgu izi: `by_employee`→`by_employee_end` (+`take 1001`), `shifts collect` ve ikinci `employees` okuması düşmüş, SGK/rapor yollarına aralıklı atama okuması eklenmiş. DTO/sonuç satırı değişmemiş.

### Yeni bulgular

**Y-1 · DÜŞÜK · Departman atamalarında eşit `updatedAt` sırası değişti**
- **Yer:** `shiftResolver.ts:44-46` (`readDepartmentPlans`, aralıkta `by_project_end`) ve `createShiftResolver` departman sıralaması.
- **Senaryo:** Aynı departmanda aynı `updatedAt`'li iki çakışan atama: eskiden `by_project` (creation sırası) kararlı sıralamada ilkini seçerdi; aralıklı okumada `by_project_end` endDate sırası geldiği için endDate'i erken olan kazanıyor. Kişi atamaları için sıra açıkça korunmuş ve testli (`shiftResolver.test.ts:142`), departman için değil.
- **Öneri:** `readDepartmentPlans`'te aralıklı okuduktan sonra `relevant`'ı `_creationTime`'a göre sırala; aynı testi departman için de ekle. (Pratik etki düşük: `updatedAt` ms çözünürlüklü ISO.)

**Y-2 · DÜŞÜK · Resolver testi uzun/açık uçlu atama senaryosunu kapsamıyor**
- **Yer:** `convex/lib/shiftResolver.test.ts:142`, `noShift.test.ts:180`.
- **Senaryo:** Testler yalnız "süresi dolmuş" (endDate < aralık) atamaları ve tam yıllık atamayı kullanıyor. `startDate` aralıktan 1 yıl önce, `endDate` aralık içinde/çok ileride olan atama için doğrudan assertion yok; kod doğru (yukarıda okudum) ama ileride indeks/süzgeç değişirse yakalanmaz.
- **Öneri:** `startDate: 2024-01-01`, `endDate: 2099-12-31` (ve `endDate` aralık ortasında) atamasıyla `resolvePlan` `shifts` dönmeli diye 1 test ekle.

## Koordinatör (2026-10-26 01:3x)
- Y-1 düzeltildi: `convex/lib/shiftResolver.ts` `readDepartmentPlans` aralıklı/aralıksız okumada `relevant` `_creationTime`'a göre sıralanır.
- Y-2 + Y-1 testi: `convex/lib/shiftResolver.test.ts` "bounded reports load long and open-ended assignments and keep department creation-order ties"
  (fix geri alınınca kırmızı, fix'le yeşil doğrulandı). Temiz export kapısı (HEAD + pathspec + payVisibility 1. hunk): tsc×2 0, eslint 0 hata, leak 0, vitest 378/4198.
