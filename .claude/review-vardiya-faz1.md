# Vardiya Faz 1 denetimi (salt okuma)

Özet: Çekirdek hesap (pdksDay/pdksFixedRules) spec'e uyuyor, mevcut test dosyalarında yalnız ekleme var (silinen/değişen beklenti yok), `vitest run convex/lib convex/shifts.test.ts src/components/shifts` → 119 dosya / 1420 test yeşil, `find-node-leak` temiz, diff'te `any`/`as any`/`!` yok. Ama kural yalnız `computePdksDay` + rapor yolunda uygulanıyor; dashboard, mobil özet ve gün detayı sınır kontrolleri hâlâ yalnız "esnek" vardiyayı tanıyor → aynı gün farklı ekranda farklı sonuç verebilir.

## Engel
Yok (merge'i kesin kıran bulgu yok); aşağıdaki Önemli-1 yayından önce kapatılmalı.

## Önemli
1. `convex/dashboard.ts:258,274` — workDate ve "versioned" okuma seçimi yalnız `scheduleType === "flexible"` bakıyor; sabit vardiya + kural olan gün dashboard'da kuralsız (legacy) yoldan sayılır, pencere dışı okutma/ devamsızlık kuralı yansımaz. Düzeltme: `hasFlexible` ve satır 274 koşulunu `hasFixedShiftRules` ile genişlet (reportAttendance'taki `usesShiftDayRules` gibi tek ortak yardımcıya taşı).
2. `convex/mobileAttendance.ts:123,125,140,167` — `flexibleReportProjects(...)` çağrısına `matchesShift` verilmiyor, `flexible` ve `hasFlexible` yalnız esnek arıyor; kurallı sabit vardiyadaki kişinin mobil özeti `summarizeMovements` ile kuralsız hesaplanır (web tablosuyla uyuşmaz). Düzeltme: 4 yerde de `usesShiftDayRules`/`hasFixedShiftRules` kullan ve `hasFlexiblePdksShift` benzeri sabit-kural kontrolü ekle.
3. `convex/cardReadings.ts:580` (detay sınır çözümleyicisi) — `detailHasFlexible` yalnız esnek vardiyayı sayıyor; gece vardiyası `validWindow.checkOutEndDayOffset: 1` penceresindeki sabah okutması detay çözümleyicide önceki güne bağlanmayabilir (pdksWorkDay.ts:47 yalnız çağrılırsa devreye girer). Düzeltme: koşulu sabit-kural vardiyayı da kapsayacak şekilde genişlet, gece vardiyalı kurallı bir detay testi ekle.
4. `convex/lib/pdksDay.ts:~307-312` — `minWorkMinutes` kontrolü `totalMinutes < min` ile çıkışı eksik/devam eden günü ("incomplete"/review, bugün hâlâ çalışan) da "absent" yapıyor ve `attendanceDecision`'ı "incomplete"→"absent" ezer; "eksik okutma = incelenecek" kuralı bu günlerde kaybolur. Düzeltme: `minWorkMinutes` kuralını yalnız `evidence?.durationMeasured` true iken (ya da `punchQuality === "ok"`) uygula; eksik çıkışta mevcut karara dokunma. Test ekle: yalnız giriş + minWork.
5. `convex/lib/pdksDay.ts:~307` — `absentByFixedRule` legacy politikada (`evidence` null) `attendanceDecision`'ı undefined'dan "absent"e çevirir; `pdksTable.ts:68` böylece eski dal yerine yeni dala girer (bugün/`pendingUntil` davranışı değişir). Düzeltme: legacy dalda da aynı sonucu veren bir test ekle ya da `attendanceDecision`'ı yalnız `evidence` varken override et.

## Düşük
1. `convex/lib/pdksDay.ts:~298` — `absentAfterLateMinutes` karşılaştırması tolerans düşülmüş `lateMinutes` ile yapılıyor ("geç kalma bu dakikayı aşarsa" tolerans dahil mi belirsiz); spec/yardım metninde net değil. Düzeltme: form yardım metnine "tolerans düşüldükten sonra" notu ekle ya da ham gecikmeyi kullan.
2. `convex/lib/pdksDay.ts:~305` — devamsızlık kuralları `classification === "workday"` ile sınırlı; yarım gün tatil (`halfDayHoliday`) günü `minWorkMinutes` dışında kalır. Düzeltme: kasıtlıysa testle sabitle (yarım gün için eşiği yarıya indirme kararı Emre'de).
3. `convex/lib/pdksFixedRules.ts:62-80` — legacy + `validWindow` + yönsüz tek okutma çıkış penceresindeyse artık "giriş yok" sayılıyor (eski legacy ilk okutmayı girişe çevirirdi); `missingCheckInLateMinutes` yoksa bu davranış değişimi yalnız pencere dolu vardiyada olduğu için kabul edilebilir ama belgelenmemiş. Düzeltme: spec/handoff'a bir cümle ekle.
4. `convex/shifts.ts:471` — `validateShift` artık kozmetik (ad/renk) güncellemede de çalışıyor; bozuk eski veri varsa yeniden adlandırma bile reddedilebilir. Düzeltme: `cosmeticOnly` ise doğrulamayı atla (önceki davranış).

## Kontrol edilenler (sorun yok)
- Alanlar boşken sonuç: `pdksFixedRules.test.ts:40` karşılaştırma testi üç politika için `toEqual`; mevcut testlerde değişiklik yok.
- Pencere dışı okutma silinmiyor (`rawReadings` korunuyor, `readings` yalnız hesaptan düşüyor), durum "incomplete" (review). Gece penceresi `fixedExitEnd` = `checkOutEnd + 1440*offset`, sınırlar dahil; `pdksWorkDay.ts:47` sabah çıkışını önceki güne bağlıyor.
- `update`: gönderilmeyen alan `toPatch` ile korunuyor, `null` temizliyor, esnek vardiyada ConvexError (`shifts.test.ts` ile kanıtlı).
- `reportScope.ts:95`: varsayılan `matchesShift` = eski esnek filtresi; `isOvernightShift` yalnız sabit vardiya için `dayBefore` ekliyor → varsayılan çağrılar aynı.
- Paylaşılan kopya mantık: `pdksTable`/`pdksPayroll`/`pdksDetail` hepsi `computePdksDay`'den geçiyor, `classification` zaten tatil-düzeltilmiş dönüyor.

## Worker yanıtı
- Düşük-2: Yarım gün tatil mevcut PDKS davranışıyla tatil kalır; sabit devamsızlık eşikleri uygulanmaz veya yarıya indirilmez. Regresyon testi eklendi; holidayWorkRequired=true mevcut tasarımdaki gibi normal iş gününe çevirir.
- Düşük-3: validWindow tanımlı legacy vardiyada yönsüz tek okutma yalnız çıkış penceresine düşerse giriş üretilmez; ham okutma korunur, eksik giriş olarak değerlendirilir. Pencere tanımlanmamış legacy davranışı korunur.
