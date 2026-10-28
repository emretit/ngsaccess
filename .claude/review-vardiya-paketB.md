# Vardiya Paket B — denetim raporu (salt okuma, Claude)

**Özet:** Engel yok. Hesap motoru sözleşmeye ve Emre kararlarına uyuyor; 0-1 vardiyalı günde sonuç aynı kalıyor. `vitest run convex` 182 dosya / 2891 test yeşil, `find-node-leak` temiz, `eslint` yeni dosyalarda temiz. Dashboard'da 3 önemli, rapor uyarısında 1 önemli boşluk var.

## Engel
Yok.

## Önemli
1. **Dashboard `hasFlexible` kapısı genişledi (değişmezlik riski)** — `convex/dashboard.ts:266`
   `|| ruleReport.ruleRows.size > 0` eklendi. Eski kod yalnız `usesShiftDayRules` vardiyası varsa `ruleReport.workDate` kullanıyordu. `ruleRows` artık yalnız versiyonlu politika (eachPunch/requirements/yönlü) olan, **0-1 vardiyalı** projede de dolu olur. O durumda gün atfı `buildPdksWorkDateResolver`'dan `ruleReport.workDate`'e geçer; planlı olmayan günde bu takvim günüdür (`reportAttendance.ts:341`). Gece vardiyalı çalışanın ertesi gün çıkışı dashboard'da yanlış güne düşebilir. w5a D1 testi yalnız "sürüm yokken" durumu kapsıyor.
   Düzeltme: kapıyı `planned` bilgisine bağla (planlı kişi/gün varsa) ya da `ruleRows.size > 0` kısmını kaldır; gece vardiyası + versiyonlu politika için dashboard testi ekle.

2. **Dashboard `overtimeHours` plan'dan habersiz** — `convex/dashboard.ts:330-345` (`computePdksCoreInMemory`)
   İlk–son okutma farkı ve `shiftResolver.resolve()` (ilk vardiya) kullanıyor. İki vardiyalı günde aradaki boşluk çalışma sayılır → fazla mesai şişer; döngü dolu cumartesisi `classifyDay(workingDays)` ile hafta sonu primi sayılır. Aynı dosyada yıllık mesai (`:432`) `ruleRows` günlerini zaten `day.overtimeMinutes` ile topluyor, bu yol toplamıyor. Tutarlılık hedefi (tablo = dashboard) bozuluyor.
   Düzeltme: `ruleRows`'u `computePdksCoreInMemory`'ye geçir; `ruleRows` günü olan çalışanları döngüden çıkarıp `day.overtimeMinutes` topla (`:432` ile aynı desen).

3. **Dashboard `devamOrani` paydası dinlenme gününü devamsız gibi sayıyor** — `convex/dashboard.ts:~373`
   `devamOrani = presentToday / totalEmployees`. Döngüde boş gündeki (rest) kişiler paydada kalıyor, oran düşüyor. Emre kararı "boş gün devamsız değil" ile çelişir. Testte yalnız `presentToday: 0` doğrulanıyor.
   Düzeltme: payda = bugün `resolvePlan().kind !== "rest"` olan kişi sayısı (izinliler mevcut kuralda ne ise o). Test: 2 kişi, biri rest → oran.

4. **Departman haftalık planında takvim uyarısı yok** — `convex/lib/reportAttendance.ts:71-79`
   `hasUnsupportedShiftCalendar` yalnız kişi `assignments` satırına bakıyor. `planFor` kolu `calendar === "plan"`'ı serbest bırakıyor ama departman + haftalık (`calendar: "project"`) `weekPattern` proje `workingDays`'ine uymuyorsa uyarı çıkmaz; sınıflandırma sessizce proje günleriyle yapılır.
   Düzeltme: `plan.kind === "shifts" && plan.source === "department" && plan.calendar === "project"` gününde departman satırının `weekPattern`'i ile `classifyDay` uyumunu da kontrol et (ya da uyarıyı doğrudan `DayPlan`'dan türet). Test ekle.

## Düşük
1. `convex/lib/reportScope.ts:107-115` — `shiftPlanRefs` probu tarihsiz. Süresi dolmuş tek bir plan referansı projeyi sonsuza dek "flexible/bounded" yola sokar (yalnız performans, sonuç doğru). Düzeltme: ref'e tarih filtresi yok; kabul edilebilir, ama `departmentShiftAssignments` gibi aralık sınırı eklenebilir ya da bilinçli kabul notu düş.
2. `convex/w53Integration.test.ts:231,237,367`, `w5aLegacyEquivalence.test.ts:105-116` — mevcut okuma-sayacı beklentileri değişti (her proje +2 `first()` probu). Notta "koordinatör onaylı" yazıyor; yeni probun eski sürüm yolunu yavaşlatmadığını (yalnız 2 indeksli `first`) kabul ettiğini doğrula. Veri okumaları ve DTO'lar katı kalmış (iyi).
3. `convex/lib/pdksMultiShift.ts:18` — `pdksSegmentValidator` dışa aktarılıyor ama hiçbir yerde kullanılmıyor (ölü kod). Kaldır ya da validator'lı bir query dönüşünde kullan.
4. `convex/lib/pdksChart.ts:143` — `computePdksChartData`'nın prod çağıranı yok (yalnız test). `resolvePlan` değişikliği etkisiz; ölü kod temizliği ayrı iş.
5. `convex/lib/pdksDay.ts:~206` `classify` — `dayKind` gece vardiyasının ertesi takvim günü yarısına da uygulanıyor (`splitAtMidnight`). Cuma "dolu" gece vardiyası, cumartesi "boş" ise cumartesi yarısı `workday` sınıflanır, hafta sonu primi uygulanmaz. Karar belirsiz; en azından kod yorumu/test ile sabitle.
6. `convex/lib/pdksTable.ts:~300` — çoklu vardiyada `lateTolerance` ilk vardiyadan, `shiftEnd/earlyExit` son vardiyadan alınıyor. `lateTolerance` yalnız "henüz gelmedi" bekleme eşiğinde kullanıldığı için sonuç doğru; ama okuyan için belirsiz → kısa yorum ekle.

## Kontrol edilenler (sorun yok)
- **Değişmezlik:** `pdksMultiShift.test.ts` altın testleri `toStrictEqual` (0 / 1 vardiya, `none ≡ shift:null`, `computePdksTableRow` resolvePlan'lı ≡ resolvePlan'sız). Not: karşılaştırılan taban değiştirilmiş `computePdksDay`; "motor eskisiyle aynı" kanıtı değişmemiş `pdksDay*.test.ts` dosyalarından geliyor (`git diff` yok, hepsi yeşil). `pdksDay.ts` değişikliği (`classify`, `manualExitNextDay`) `dayKind`/`manualExitNextDay` verilmezse eski yolu birebir izliyor.
- Mevcut test beklentisi silinmemiş. Değişen testler: `attendanceCorrections.test.ts` (mock'a `resolveLast`), `auditLogQuery.test.ts` (+1 satır, Paket A), `w53`/`w5a` (yukarıda Düşük 2).
- **Emre kararları:** boş gün → `weekend` + `planKind:"rest"`; dolu döngü günü → `workday` (cumartesi testi); tatil önceliği ve `holidayWorkRequired` korunuyor; bir parça kaçarsa `incomplete` + çalışılan parça süresi (225 dk) korunuyor; hepsi kaçarsa `absent`; gün içinde son vardiya bitmeden `future` (classifyPdksDay `shiftEnd` = son parça).
- **Bölme/birleştirme:** pencere → yön → orta nokta sırası `segmentIndex`'te doğru; her okutma tek kovaya düşüyor; net süre = parça toplamı (450 dk, vardiya arası boşluk sayılmıyor); mola parça bazlı (yasal mola parçaya göre, 15+15); `overtimeSegments` birleşiyor, `calculatePeriodOvertime` kişi/dönem başına tek çağrı (`pdksTable.ts:409`, `pdksPayrollQuery.ts:199`, `pdksDetail.ts:131`); manuel giriş → ilk, çıkış → son parça, son parça gece çıkışı `manualExitNextDay` ile.
- **`resolveLast` taşıma:** `pdksWorkDay`, `groupPdksWorkDays`, `buildPdksWorkDateResolver` tüm çağıranlarda (table, payroll, detail, rapor, reportScope, dashboard, mobil) geçiriliyor; `pdksManualWrite.ts:17` ve `pdksRecords.ts:77,152` `resolveLast`.
- **Kalan `.resolve(` çağıranları:** `mobileAttendance.ts:140` (resolveShift sarmalı, `resolvePlan` ayrıca geçiyor), `pdksTableQuery.ts:249` (aynı), `cardReadings.ts:582/589/640/662`, `pdksPayrollQuery.ts:98/144/151/191` (sınır/gün-atfı için ilk vardiya yeterli, plan ayrıca `dayPlan`), `dashboard.ts:276/340/425/641/644` (Önemli 2 hariç bilerek bırakılabilir; 425 `ruleRows` günlerini zaten dışlıyor).
- **DTO:** `segments`/`planKind` yalnız `plannedDayFields` ile ve yalnız ≥2 vardiya / rest günü ekleniyor; `mobileAttendance:summary` `returns` değişmemiş; `cardReadings` return validator'larında dönüşü etkileyen değişiklik yok.
- **Entegrasyon:** `pdksPlans.integration.test.ts` departman + kişi planı için tablo = detay = bordro = rapor (`loadRuleReportDays`) = mobil `presentDays` = dashboard aynı günü sayıyor; rest günü, eksik öğleden sonra, geç öğleden sonra eşiği, gece son parça + D+1 çıkış kapsanmış.
- **Kurallar:** yeni/diff satırlarında `any`, `as any`, `!` yok; Node import yok (`find-node-leak` exit 0); ownership dışı dosya değişikliği yok (`cardReadingProcess.ts`, `shiftResolver.ts` vb. Paket A).
- **Performans:** `resolvePlan` memo'lu kullanılıyor; `pdksTableQuery.ts:123` vardiya filtresi kişi × gün `resolvePlan` (memo, DB okuması yok); gün başına DB okuması eklenmemiş.
- Kapsam dışı bırakılanlar (denetlenmedi): Paket A, C1 (`src/**`), tam kapı (`tsc`, tam `vitest run`) koordinatörde.

## Worker yanıtı

- Önemli 1 — `convex/dashboard.ts:286`: plan kapısı kişi/gün ve önceki gece günü üzerinden `usesPlanDayRules`; eski `usesShiftDayRules` ve sıradan günlerin boundary resolver yolu korundu; versiyonlu gece politikası ve karma personel regresyonları `convex/dashboardPlans.review.test.ts:51,74` geçti.
- Önemli 2 — `convex/dashboard.ts:347`: ilgili `ruleRows.days[].overtimeMinutes` bir kez toplanır, yönetilen günün ham okumaları eski mesai yolundan çıkarılır; ara boşluğu ve döngü cumartesisi testleri `convex/dashboardPlans.review.test.ts:29` geçti.
- Önemli 3 — `convex/dashboard.ts:395`: rest personel devam oranının nüfusundan çıkarılır; toplam personel sayısı ve izin davranışı korunur; 2 kişi/1 rest ve plansız %50 eşdeğerlik testi `convex/dashboardPlans.review.test.ts:40` geçti.
- Önemli 4 — `convex/lib/reportAttendance.ts:75`: doğrudan çözümlenen DayPlan'da departman haftalık günü proje iş gününe aykırıysa uyarılır; cycle ve tatil istisnası, kişi satırlarının eski eşleşmeyen-gün kontrolü korunur; `convex/lib/reportAttendance.review.test.ts:11` dört regresyon geçti (ek departman taraması yapılmadı).
- Düşük 1 — `convex/lib/reportScope.ts:109`: tarihsiz ref probunun yalnız performans maliyeti olduğu, sonucu bounded resolver'ın doğruladığı yorumla açıklandı; sorgu davranışı değişmedi.
- Düşük 2 — Koordinatörün önceki okuma sayacı istisnası korundu; bu dispatch'te ilgili testlere dokunulmadı.
- Düşük 3 — `convex/lib/pdksMultiShift.ts:1`: `rg pdksSegmentValidator src convex` yalnız tanım buldu; kullanılmayan validator ve v import'u kaldırıldı, `PdksSegment` tipi korundu; src import'u yoktu.
- Düşük 4 — Talimat uyarınca pdksChart ve testlerine dokunulmadı.
- Düşük 5 — `convex/lib/pdksDay.ts:206`: gece taşmasında vardiya başlangıç gününün dayKind'ının bütün vardiyaya ait olduğu yorumlandı; Cuma→Cumartesi splitAtMidnight testi `convex/lib/pdksMultiShift.test.ts:120` geçti, sıradan haftalık prim davranışı ayrıca doğrulandı.
- Düşük 6 — `convex/lib/pdksTable.ts:303`: giriş bekleme eşiğinin ilk parçaya, çıkış ve erken çıkış toleransının son parçaya ait olduğu kısa yorum eklendi.
- Kapılar — app tsc 0; convex tsc 0; eslint 0 hata (mevcut `attendanceCorrections.test.ts:8` uyarısı); tam vitest **374 dosya / 4135 test geçti**; find-node-leak 0; diff-check temiz; A, src, _generated dosyalarına dokunulmadı, commit/yayın yapılmadı.
- Önemli 4 kapsam notu — Görevde açıkça izin verilen doğrudan DayPlan yolu uygulandı: seçili departman haftalık günü karşılaştırılır; none/default fallback günlerinde görünmeyen departman weekPattern'ini çıkarmak için yeni atama/zincir taraması eklenmedi. Bu daha geniş tarama hakkındaki `msg_971f5814fdb9` sorusu yanıtlanmadı; mevcut yetkili seçeneğin teslimatı için ek onay gerekmiyor.
