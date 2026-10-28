# Vardiya Faz 2-4 — BİRLEŞİK son denetim (A+B+C1+C2, salt okuma)

**Özet:** Engel yok; commit'e hazır, ama commit'ten önce 2 küçük düzeltme öneriyorum (Önemli-1, Önemli-2) ve 3 maddede Emre'nin kararı gerek (Önemli-3, -4, -5). Plansız / 0-1 vardiyalı projede hesap motoru, çözümleyici, okutma işleme, mobil ve rapor yolları eski sonucu veriyor (kod okuma + eski testler); **iki istisna** aşağıda: vardiya filtresi ve (kural-yönetimli projelerde) dashboard mesaisi.

Koşumlar: `vitest run` → 374 dosya / 4135 test yeşil · `find-node-leak.mjs` → exit 0 · yeni/değişen satırlarda `any` / `as any` / `!` / `eslint-disable` yok. Önceki A/B/C denetimlerinin tüm bulguları kapanmış (worker yanıtları koda karşı doğrulandı); tekrar yazılmadı.

## Engel
Yok.

## Önemli

1. **[C2] Isı haritasında "döngü boş günü" sunucu durumunu eziyor** — [PDKSHeatmapView.tsx:85](src/components/pdks/dashboard/PDKSHeatmapView.tsx)
   - `cell?.planKind === "rest" ? STATUS_META.weekend : statusMetaFor(cell)`. Sunucu zaten boş günü `weekend` sayıyor (`dayKind:"rest"` → classification weekend), yani ezme gereksiz; ama şu durumları yanlış gösterir: boş günde okutma varsa (hafta sonu çalışması → sunucu `present/late`), onaylı izin (`leave`), gelecek gün (`future`), işe başlamamış (`notEmployed`/`noData`) → hepsi "H/hafta tatili" rengi ve kodu. Tablo/detay doğru durumu gösterirken ısı haritası farklı → görünüm tutarsız. C2 raporundaki "karar çözümlemesi yok" ilkesine de aykırı.
   - Düzeltme: o satırı `statusMetaFor(cell ?? { status })` yap (override'ı sil); `PdksPlanSummary` rozeti zaten "Boş gün (döngü)" yazıyor. Test: rest + `status:"present"` hücre `weekend` kodu basmamalı.

2. **[B] Çok vardiyalı gün, proje hafta sonuna denk gelince "weekend" durumu — tek vardiyadan farklı** — [pdksMultiShift.ts:79](convex/lib/pdksMultiShift.ts)
   - `mergePdksDays` her zaman `attendanceDecision` yazıyor; `resolveDayStatus` (pdksCalc.ts:147) karar tanımlıysa takvimde `classification==="weekend"` için `hasAttendance`'a bakmadan `weekend` döner. Tek vardiyada karar `undefined` olduğundan aynı gün `present/late` çıkar.
   - Doğruladım (geçici /tmp testi, repo'ya yazılmadı): Cumartesi (proje çalışma günü değil), haftalık plan, kişi 08–12 + 14–18 çalışmış → 1 vardiya: `status=present, 225 dk`; 2 vardiya: `status=weekend, 450 dk`. Aynı kişi-günde dakika var ama durum "hafta tatili" → devam sayımı/rapor/dashboard bundan etkilenir (haftalık plana Cumartesi eklenen mağaza senaryosu).
   - Düzeltme: karar `undefined` kalmalı ya da çok vardiyada `weekend/holiday` sınıflı günde `hasAttendance` ise tek-vardiya yolundaki gibi `present/late` üret (en güvenlisi: `mergePdksDays` yalnız parça kararlarından biri `incomplete` ise veya `dayKind` tanımlıysa `attendanceDecision` yazsın). Test ekle: `pdksMultiShift.test.ts`'e "Cumartesi haftalık 2 vardiya = tek vardiya durumu".

3. **[B] Vardiya filtresinin anlamı plansız projede de değişti** — [pdksTableQuery.ts:122](convex/lib/pdksTableQuery.ts), [dashboard.ts:248](convex/dashboard.ts)
   - Eski: `employee.shiftId === filtre` (kişinin varsayılan vardiyası). Yeni: dönemdeki herhangi bir gün çözümlenen planda o vardiya var mı. Plansız projede bile farklı: varsayılanı X ama tüm dönem Y'ye kişisel atanmış kişi eskiden X filtresinde çıkıyordu, artık çıkmaz; tersi de geçerli. Yeni davranış daha doğru ama "birebir" şartını bozuyor ve test yok.
   - Karar (Emre): bilinçli kabul → CHANGELOG/handoff'a not + test (`atama varken filtre`); istenmiyorsa plan yokken eski `e.shiftId` koşulunu koru.

4. **[B] Dashboard `overtimeHours` kural-yönetimli (sürümlü/esnek/sabit) plansız projelerde de değişti** — [dashboard.ts:349](convex/dashboard.ts), çağrı `getActivitySummary` (`dataset.ruleRows`)
   - `computePdksCoreInMemory` artık `ruleRows` alıyor: o projelerde mesai = `ruleRows.days[].overtimeMinutes` toplamı, yönetilen günlerin ham okumaları eski yoldan çıkıyor. Plan olmasa da `ruleRows` dolu olan projede canlı rakam değişir (eskiden çağrıya yalnız çıkışsız okumalar giriyordu, değer pratikte ilk-son farkıydı). w5a D1 eşdeğerlik testi "sürüm yokken" olduğundan bunu yakalamıyor.
   - Düzeltme: ya kabul et (daha doğru; not düş), ya `ruleRows`'u yalnız plan günleri (`usesPlanDayRules`) için kullan. Emin değilim → canlı rakam karşılaştırması önerilir (PLAUSIBLE).

5. **[A/C1] Departman önizlemesi büyük projede ölçeklenmiyor** — [shiftPlans.ts:63](convex/shiftPlans.ts) (`prepare`)
   - Her çalışan için tarih sınırsız `leaves.by_employee` + `shiftAssignments` okunuyor; ortak bütçe 5000 belge ve çalışan başına 2 `db` çağrısı. ~300 kişilik departmanda izin geçmişi 15/kişi ≈ 4500 → "okuma sınırı aşıldı" ile önizleme (ve dolayısıyla atama) engellenir; ayrıca `DepartmentLiveSummary` her form değişikliğinde reaktif çalıştırır, projedeki her izin/atama değişimi aboneliği yeniler.
   - Düzeltme: izinleri tarih sınırlı oku (`leaves.by_employee_start`, `lte startDate=args.endDate+1`, bitişi bellekte filtrele — mobileAttendance.ts'deki gibi) ve sayımı çalışan başına değil proje bazlı tek sorguyla yap. (PLAUSIBLE; küçük projelerde sorun yok.)

## Düşük

1. **[C2] Segment "Gelmedi" etiketi gün durumundan bağımsız** — [PdksDaySegments.tsx:13](src/components/pdks/dashboard/PdksDaySegments.tsx): izinli/tatil/gelecek ya da henüz başlamamış öğleden sonra parçası "Gelmedi" yazıyor (`decisionFor` yokluğu = absent). Düzeltme: `PdksPlanDay`'e `status` ekle; `future/leave/holiday/weekend` günlerinde "—" veya "Bekleniyor" göster.
2. **[C1] Departman kaynaklı gece vardiyasının ertesi gün "(devam)" kuyruğu takvimde yok** — [shiftCalendarModel.ts:35](src/components/shifts/calendar/shiftCalendarModel.ts): `previousAssignment` yalnız kişisel `assignmentId`'den bulunuyor; departman hücresinde `continuations` boş. Düzeltme: önceki hücrenin `shiftIds`'inden (kaynak fark etmeksizin) gece vardiyalarını türet.
3. **[A] `notifyLateReading` her geçişte aralıksız departman okuması** — [processCardReadingCore.ts:468](convex/lib/processCardReadingCore.ts): `buildShiftResolver(ctx,[employee])` aralıksız → departman atamalı projede her `hasAccess` okutmasında ≤2000 atama + ≤2000 departman okunuyor. Düzeltme: `{ start: date, end: date }` aralığı geçir (`directionShift` zaten geçiriyor).
4. **[B] `computePdksChartData` üretimde çağrılmıyor** — [pdksChart.ts:67](convex/lib/pdksChart.ts): `resolvePlan` eklemesi ölü kodda; ya çağıranı bağla ya dokunma (yalnız test kullanıyor).
5. **[B] `devamOrani` boş günü yalnız aralığın ilk gününe göre eliyor** — [dashboard.ts:395](convex/dashboard.ts): çok günlü aralıkta ilk gün dinlenme ise kişi tüm dönem paydadan düşer. Dashboard bugün (tek gün) kullanıyorsa sorun yok; aralık desteği varsa gün başına say.
6. **[C2] Isı haritası hücresinde ek metin taşma riski** — [PDKSHeatmapView.tsx:110](src/components/pdks/dashboard/PDKSHeatmapView.tsx): hücreye birleşik ad + saat aralığı ekleniyor; dar hücrede taşma/yükseklik farkı olabilir. Görsel doğrulama koordinatörün Orca turunda.
7. **[A] Mesaj farkı:** `updateAssignment` plansız yolda eski "Çalışan veya vardiya bulunamadı" yerine "Vardiya bulunamadı"/"Çalışan bulunamadı" ayrı veriyor — yalnız metin, davranış aynı.

## Kontrol edilenler (sorun yok)

- **Değişmezlik (hesap):** `computePdksPlannedDay` plan yok/`none`/tek vardiyada `computePdksDay`'e düşüyor (`dayKind` yalnız cycle/rest'te dolu); `classify` `dayKind===undefined` iken eski `classifyDay(...)` ile birebir; pdksTable/Payroll/Detail'de `lateTolerance` ve `settings` tek vardiyada eski değerle aynı (`shift.lateToleranceMinutes ?? workSettings.maxLateMinutes` ≡ `settingsForShift`); `plannedStart` aynı; mola ihlali tek vardiyada eski yol. Not: `pdksMultiShift.test.ts` "altın" testleri yeni `computePdksDay` ile karşılaştırıyor (HEAD anlık görüntüsü değil); eski davranışı asıl taşıyan, dokunulmamış mevcut pdksDay/pdksTable/w5a/w53 testleri ve onlar yeşil.
- **Test değişiklikleri:** silinen/zayıflatılan `expect` yok. Değişenler: `attendanceCorrections.test.ts` mock'una `resolveLast`; `auditLogQuery.test.ts` listeye yeni tablo; `w53Integration.test.ts` + `w5aLegacyEquivalence.test.ts` yalnız iki ek varlık-sondası (`shiftPlanRefs.first`, `departmentShiftAssignments.first`) için okuma sayımı/izi — sondaların şekli `toEqual` ile sıkı doğrulanıyor, DTO ve veri okumaları aynı (koordinatör onaylı, kabul).
- **Okutma işleme:** `directionShift` eski sıralamayı (`updatedAt` desc, başka projenin vardiyası atlanır, `employee.shiftId` yedek) `createShiftResolver` ile koruyor; `notifyLateReading` tek vardiyada `shiftForInstant` ≡ eski `resolve`, `rest` günü bildirim üretmiyor.
- **Mobil:** `summary` return validator'ı değişmemiş; plan sorguları `addWorkDate(±1)` ile sınırlı; `resolveLast` kapsamlı (proje dışı vardiya sızmıyor).
- **Yetki / IDOR:** `shiftPlans.ts` her fonksiyonda `resolveProjectScope`, yazmalar `schedule.manage` (update/remove'da satırın kendi `projectId`'sinden); departman `projectId` eşleşmesi, ana + ikincil vardiyaların proje eşleşmesi (`validateShiftPlan`, `shift.projectId !== row.projectId`), `planCells` çalışan proje kontrolü, `updateDepartmentAssignment` projeyi değiştirtmiyor; `shifts.updateAssignment` `requirePermission` + proje üyeliği + `assertPeopleProject` korunmuş; `definitionPlanLinks` ref/sahip proje çapraz doğrulaması; `departments.remove`, proje silme engelleri, çalışan silmede `syncPlanRefs` var.
- **Emre kararları:** döngüde boş=`weekend`/dolu=`workday` (pdksDay `dayKind`); kaçırılan parça=`incomplete`, hepsi=`absent`; ≤8 vardiya, ara ≥30 dk (gece kuyruğu→ertesi gün ilk vardiya dahil); esnek+sabit aynı gün yasak; departman değişikliği uyarısı UI'da ([EmployeeFormFields.tsx](src/components/employees/EmployeeFormFields.tsx) `DepartmentShiftWarning`, null↔null yanlış tetiklemiyor).
- **Tutarlılık:** tablo/detay/bordro/rapor/dashboard/mobil hepsi `resolvePlan`+`resolveLast` kullanıyor; kalan `.resolve(` çağıranları (cardReadings 582/589/640/662, pdksPayrollQuery 98/144/151/191, pdksTableQuery 249, mobileAttendance 140, reportAttendance 118/158, dashboard 365/452) ya sarmalayıcı (plan aynı çağrıda ayrıca geçiyor), ya sınır/hasFlexible kapısı, ya ruleRows ile dışlanan eski yol; plan/rest gününde yanlış sayan yer bulamadım (istisna: yukarıdaki Önemli-2).
- **Performans / sınırlar:** bounded okumalar `take(limit+1)` + Türkçe ConvexError; departman zinciri ≤32 + ziyaret kümesi; `resolvePlan` memo'lu; gün başına DB okuması yok; Node import yok.
- **UI:** zod şeması ↔ backend (`validatePlanStructure`/`validateShiftPlan` istemcide aynı modülden); `PlanQueryBoundary` yalnız canlı özet çevresinde; segment gösterimi tek vardiyada gizli (`segments.length<2` → null); Türkçe metinler; `DepartmentAssignments` tablosunda satır tıklama (`onRowActivate` + `ROW_CLICK_CLASS`, yetkiye bağlı) uygulanmış; yeni dosyalarda `any`/`!` yok; saat biçimi `Europe/Istanbul`.


## Worker yanıtı (convex)

- Önemli-2: `convex/lib/pdksMultiShift.ts:74,102` haftalık hafta sonu/tatilde `attendanceDecision` alanını çıkarır; çalışma günü/döngü kararları ve parça dakikaları korunur; `convex/lib/pdksMultiShift.test.ts:27` tam çalışma (450 dk), tek parça ve boş gün eşdeğerliği, mevcut eksik-parça testi yeşil.
- Önemli-3: Onaylanan filtre anlamı dönem içindeki çözümlenen vardiyadır; `convex/lib/pdksTableQuery.ts:123` ve `convex/dashboard.ts:249` yorumları, `convex/pdksPlans.integration.test.ts:106` varsayılan X / tüm dönemde kişisel Y testinde Y dahil, X hariç.
- Önemli-4: `convex/dashboard.ts:352` yalnız `usesPlanDayRules` günlerinin ruleRows mesaisini alır; `convex/dashboardPlans.review.test.ts:87` sürümlü ama plansız proje, dolu ve pozitif mesaili ruleRows karşısında `8f57a2d9` HEAD formülüyle birebir `toBe` doğrulaması.
- Önemli-5: `convex/shiftPlans.ts:60` izinler `by_employee_start` üst tarih sınırı + bellekte bitiş süzmesi, atamalar dönem kesişimi ile okunur; yalnız gece kuyruğu varsa izin üst sınırı ertesi güne uzar; sorgu başına sentinel ve dönem kayıtlarının ortak bütçesi korunur; `convex/shiftPlans.test.ts:38,52` 300×20 eski izin başarı, tek sorgu/ortak bütçe aşımı Türkçe hata testleri.
- Düşük-3: `convex/lib/processCardReadingCore.ts:469` geç kalma bildirimi çözümleyicisine `{ start: date, end: date }` geçirir.
- Düşük-5: `convex/dashboard.ts:396` tek üretim çağıranı `getActivitySummary`nin bugün aralığını kullandığı doğrulandı; çok günlük kullanımda gün bazında payda gerektiği yorumlandı.

Kapılar: app tsc ve convex tsc exit 0; eslint exit 0 (0 hata, mevcut attendanceCorrections.test.ts:8 admin uyarısı); vitest 374 dosya / 4152 test yeşil; find-node-leak exit 0; git diff --check temiz. Mevcut test beklentileri değiştirilmedi, schema/_generated/src dosyalarına dokunulmadı; açık soru yok.
