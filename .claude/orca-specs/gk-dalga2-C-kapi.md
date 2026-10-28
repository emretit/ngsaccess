# Geçiş Kontrol Dalga 2 — C: Kapı Planları terim, tatil boş durumu, sonuç kutusu

## Hedef
Kapı Planları'nda "Kapalı" (plan etkin değil) ile "kilitli" (kapı modu) karışmaz, tatil yokken takvime yol, varken uygulanacak tarihler görünür, ve sonuç kutusu yapılmamış bir kaydı "kaydedildi" diye göstermez.

## Ownership (yalnız bunlar; testleri dahil)
- src/components/access-control/door-plans/DoorPlansTab.tsx, DoorPlanDialog.tsx (+ DoorPlanDialog.test.tsx), DoorPlanImpactSummary.tsx (+ test), CopyDoorPlansDialog.tsx (yalnız metin)
- src/components/access-control/door-dialog/DoorSaveResults.tsx, DoorStatusPlanSection.tsx, DoorVerifyPlanSection.tsx (+ DoorVerifyPlanEditor.test.tsx gerekirse)
- src/components/access-control/DoorStatusPlanEditor.tsx (+ testi varsa)
Kapsam dışı: TemplatePicker.tsx (A — 04-O8 orada çözülüyor), unified/ altı (A/B), convex/ (backend değişmez).
Not: door-dialog/* ve DoorStatusPlanEditor Cihazlar tarafındaki kapı formunda da kullanılabilir; metin değişikliği orada da tutarlı olmalı, davranışı bozma (ilgili testleri koş: `grep -rl` ile kullananları bul).

## İstenenler
1. **04-O2 terim:** Listede etkin olmayan plan "Kapalı" → "Plan etkin değil". Tüm modlarda "Sürekli kilitli" / "Sürekli açık" (editördeki "Sürekli Kapalı"/"Sürekli Açık" dahil, aynı yazım). Durum planı bölümüne kısa yardım: kapı modu herkes için geçerlidir; kişilerin hangi saatlerde geçebileceği Kurallar ve Zaman Şablonları'nda belirlenir; aralık dışında kapının ne yaptığını tek cümleyle yaz — davranışı `convex/lib/doorStatusPlan.ts` ve gönderim kodundan doğrula, emin değilsen ask.
2. **04-O3 tatil:** Tatil etkinken seçilen yılda tatil yoksa uyarının yanına "Tatil takvimini aç" eylemi → tatil takviminin bulunduğu sayfa (bul: `HolidayCalendarManager` nerede render ediliyor — `/pdks-records/settings` ya da `/settings`). Gitme, DoorPlanDialog'daki mevcut kaydedilmemiş-değişiklik korumasıyla (`guard.requestClose(() => { onOpenChange(false); navigate(...) })`, TemplatePicker onEdit örneği gibi). Tatil varsa uygulanacak tarihleri önizle (`holidayRanges`: beginDate–endDate, tr-TR, "tam gün"); 10'dan fazlaysa ilk 10 + "ve N tarih daha". Backend'e dokunma (ad alanı yoksa yalnız tarih).
3. **Sonuç kutusu:** `DoorSaveResults` şu an `planResults.length > 0` ile açılıyor; formda kaydedilmemiş düzenleme varken "Cihaza tekrar gönder" sonrası da "Kaydedildi / Ayarlar veritabanına kaydedildi" yazıyor ve hata metni üstteki banner'la iki kez görünüyor. Düzelt: "veritabanına kaydedildi" yalnız bu açılışta gerçekten kayıt yapıldıysa (`saved`); plan bazlı gönderim sonucu tek yerde; banner yalnız durum cümlesi + "Cihaza tekrar gönder". Dalga 1 testlerini (04-H1*, R1-R4) koru.
4. **Sekme başlığı:** DoorPlansTab üstüne ortak kalıp ("Kapı Planları" + açıklama); "N kapı seçildi / Planı kopyala" satırı altında kalır.

## Kabul
- Test: listede etkin olmayan plan "Plan etkin değil"; editörde "Sürekli Kapalı" yok.
- Test: tatil etkin + boş yıl → "Tatil takvimini aç" görünür ve guard üzerinden çağrılır; dolu yıl → tarih önizlemesi (11+ tarihte "ve N tarih daha").
- Test: kaydedilmemiş düzenleme varken başarılı tekrar gönderimde "veritabanına kaydedildi" görünmez; hata metni bir kez görünür.
- Mevcut DoorPlanDialog / DoorPlanImpactSummary / DoorVerifyPlanEditor testleri yeşil.
