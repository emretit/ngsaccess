# UI Audit 2 — 09 Vardiyalar (/shifts)

**Özet:** A2 arayüzü bu sayfada büyük ölçüde oturmuş: tek h1, tanımlar yan Sheet'te, tam genişlik takvim, mobilde günlük ajanda, Türkçe ve İstanbul saati notu doğru, gece vardiyası formda tanımlanabiliyor ("Bitiş ertesi gün (+1 gün)", Brüt 480 dk). Yüksek önemde bulgu yok. Asıl sorunlar tanımsız projede çelişkili boş durum ("Vardiya ata" aslında tanım panelini açıyor), ISO tarihlerin (2026-10-19) sızması ve birkaç performans/erişilebilirlik kalemi.

| Yüksek | Orta | Düşük |
|---|---|---|
| 0 | 7 | 10 |

**Kapsam notu (doğrulama sınırı):** Canlı NGS projesinde 0 vardiya tanımı, 1 çalışan ve 0 atama var; bu yüzden **atama formu, önizleme, çakışma/kısmi sonuç ekranı ve dolu takvim hücreleri tarayıcıda açılamadı** (tanım yokken "Vardiya ata" tanım panelini açıyor, gün penceresindeki atama düğmesi pasif). Bu bölümler yalnız koddan okundu; "doğrulanmadı" olarak işaretlendi. Tanım formu ve gece vardiyası alanları tarayıcıda denendi (kaydedilmedi). Not: oturum ortasında ilk iki sekmem kapandı (kendi sekmelerimdi), yenilerini açıp devam ettim; tüm sekmeler kapatıldı.

**Eski rapordan (`docs/ui-scan/pages/09-vardiyalar/REPORT.md`):** SHF-UI-01/02/03/05/06/07/08/10/11/12/13/14/15/17/18 çözülmüş görünüyor (Sheet, ajanda, +1 gün etiketi, "Atama yok", alan altı hata, işlem menüsü, "Tüm dönemlerde N atama serisi", hafta/ay). **Hâlâ açık:** SHF-UI-16 (tek gün istisnası yok — gün penceresi bunu açıkça yazıyor, ürün kararı), SHF-UI-19 (ölçek → 09-O7), SHF-UI-02 (mobil dokunma hedefleri → 09-D3). Bu sayfada gün kısaltmaları tutarlı (Pzt…Paz, `lib/planning.ts:26-32`); 05-O4 sorunu burada yok.

## Bulgular

| ID | Önem | Kategori | Ne görülüyor | Neden sorun | Öneri | Kanıt |
|---|---|---|---|---|---|---|
| 09-O1 | Orta | etkileşim | Hiç aktif vardiya yokken başlıktaki birincil "Vardiya ata" düğmesi atama formu yerine "Vardiya tanımları" panelini açıyor. | Etiket ile sonuç uyuşmuyor; kullanıcı neden atama formu gelmediğini anlamıyor. | Düğmeyi tanım yokken pasif yap + "Önce vardiya tanımlayın" ipucu ya da etiketi "Önce vardiya tanımla" yap. | `ShiftCalendarView.tsx:194-203`; `desktop-sheet.png` |
| 09-O2 | Orta | içerik | Tanım yokken aynı sayfada üç çelişkili mesaj: "Henüz vardiya tanımlanmamış" kartı, hemen altında "Bu dönemde atama yok. **Boş bir gün seçerek plan oluşturabilirsiniz.**", gün penceresinde pasif "Bu tarihe vardiya ata" (nedeni yazmıyor). | Kullanıcıya imkânsız bir yol öneriliyor; pasif düğme gerekçesiz. | Atama ipucunu yalnız aktif tanım varken göster; pasif düğmenin yanına "Önce vardiya tanımlayın" yaz. | `ShiftCalendarView.tsx:332-350`; `ShiftDayDetails.tsx:81`; `desktop-0.png`, `desktop-day-detail.png` |
| 09-O3 | Orta | içerik | Tarihler iki biçimde: başlıkta "19 Ekim 2026 Pzt", ama gün penceresinde "Seri: 2026-10-19 – 2026-10-25", düzenleme açıklamasında, atama formu özetinde ve önizleme çakışma/izin/tatil satırlarında da ISO (2026-10-19). | Türkiye biçimi (GG.AA.YYYY / "19 Ekim 2026") bekleniyor; tutarsız. | `dayLabel`/kısa Türkçe tarih yardımcısıyla hepsini biçimle. | `ShiftDayDetails.tsx:65`; `AssignShiftDialog.tsx:344` ve `Decision` (çakışma/izin/tatil tarihleri); `AssignmentEditDialog.tsx:239,295`; `desktop-day-detail.png` (kod doğrulaması; dolu veriyle görsel doğrulanmadı) |
| 09-O4 | Orta | içerik | Vardiya seçicilerde gece vardiyası "Gece (22:00–06:00)" diye listeleniyor; "(+1 gün)" yok. Oysa hücre, gün penceresi, tanım listesi ve tanım formu "+1 gün" gösteriyor. | Atama yaparken seçilen vardiyanın ertesi güne taştığı görünmüyor; PDKS 08-H2 ile aynı konu. | `{s.startTime}–{s.endTime}{endTime<startTime?" (+1 gün)":""}` ortak yardımcı. | `AssignShiftDialog.tsx:262`; `AssignmentEditDialog.tsx:166` (doğrulanmadı — dolu veriyle açılamadı) |
| 09-O5 | Orta | etkileşim | Doldurulmuş tanım formunda Escape → "Değişiklikler kaydedilmedi" uyarısı; düğmeler "Vazgeç" (= formda kal) / "Çık". Ana formdaki "Vazgeç" ise formu kapatır. | Aynı kelime iki zıt anlamda (05-O6 ile aynı ortak bileşen). | "Düzenlemeye dön" / "Çık ve değişiklikleri sil". | `shared/UnsavedChangesDialog.tsx:24-25`; `desktop-def-dirty-escape.png` |
| 09-O6 | Orta | performans | Tanım panelinde her vardiya satırı kendi `assignmentDeleteImpact` canlı sorgusunu açıyor (her biri o vardiyanın atamalarını 5000'e kadar okur); silme penceresi aynı sorguyu tekrar açıyor. Her atama değişiminde tümü yeniden çalışır. | Tanım sayısı × atama sayısı kadar okuma; Convex kotası/okuma maliyeti (ölçülmedi). | Tek sorguda tüm tanımların sayacı (veya sayaçları vardiya belgesinde tut); silme penceresinde tekrar kullan. | `ShiftListSidebar.tsx:92,127-141,157`; `convex/shifts.ts:349-370` |
| 09-O7 | Orta | hata / performans | Takvim sorgusu 50 çalışan için `by_employee_end` ile her kişinin bitiş tarihi ≥ başlangıç olan TÜM atamalarını okuyor; toplam 5000 satırı aşarsa "Atama kontrolü 5000 kayıt okuma sınırını aşıyor" hatası fırlatıyor ve bölüm "yüklenemedi"ye düşüyor. | Çok atamalı projede tüm takvim açılmaz (50 kişi × 100 seri = 5000). Doğrulanmadı: canlı veride 0 atama. | Sayfa boyutunu 50 → 25'e indir ya da sorguyu görünür aralık içine sınırla; hata mesajına "Çalışan sayısını azaltın" eylemi ekle. | `convex/shifts.ts:28-35,118-123`; `ShiftCalendarView.tsx:130-137` |
| 09-D1 | Düşük | içerik | Üst şeritte "Gün 7" (ay görünümünde 31, mobilde 1). | Kullanıcıya bilgi vermeyen, seçilen görünümün kendisini sayan kutu. | Kaldır; yerine "Atanmış çalışan N" veya dönem etiketi. | `ShiftCalendarView.tsx:212`; `desktop-0.png`, `desktop-month.png` |
| 09-D2 | Düşük | görsel | Araç çubuğu hizasız: "Vardiya" ve "Dönem" etiketi üstte, "Tarih" etiketi solda satır içi; alt başlık ("NGS · Çalışma planı"), stat şeridi ve "Vardiya" etiketi birbirine yapışık (aralık ~4-8px). | A2 boşluk/hiza düzeni bozuk; etiket biçimi tutarsız. | Tüm etiketleri üstte yap; başlık–stat–filtre arası 12-16px. | `ShiftCalendarView.tsx:233-290`; `desktop-0.png` |
| 09-D3 | Düşük | erişilebilirlik | Mobilde (390px) Önceki/Bugün/Sonraki, "Vardiya ata", filtre düğmeleri 36px yüksek; çalışan seçim kutusu 16×16; tanım formundaki onay kutuları ~13px, düğmeler 34px. | 44px dokunma hedefi altında. | Mobilde `min-h-11`; onay kutusu etiketini tam satır yap. | Mobil ölçüm (eval, 390px); `ShiftAgendaView.tsx:23`; `AddShiftDialog.tsx:267-300` |
| 09-D4 | Düşük | görsel | Tanım formundaki onay kutuları yerel mavi; takvimdeki seçim kutuları bordo (`accent-primary`). | A2 renk tutarlılığı. | Aynı `accent-primary` sınıfını ekle. | `AddShiftDialog.tsx:267,286,300` vs `ShiftCalendarGrid.tsx:91`; `desktop-def-form.png` |
| 09-D5 | Düşük | görsel | Vardiya filtresi, Dönem ve atama/düzenleme formundaki Vardiya seçicileri yerel HTML `<select>` (05-D2 ile aynı). | A2 Select bileşeninden farklı görünüm; mobilde yerel menü. | A2 Select'e geç. | `ShiftCalendarView.tsx:236,284`; `AssignShiftDialog.tsx:249`; `AssignmentEditDialog.tsx:154` |
| 09-D6 | Düşük | içerik | Mobilde (≤760px) yalnız tek günlük ajanda; "Dönem" seçicisi gizleniyor ve haftaya geçiş yok, neden olduğu yazmıyor. | Haftalık plan telefonda görülemiyor (bilinçli olabilir). | Ürün kararı (aşağıda). | `ShiftCalendarView.tsx:33-44,101,281` |
| 09-D7 | Düşük | etkileşim | "Vardiya ata" ve "Seçilenlere ata" tarih aralığını görünür döneme göre ön dolduruyor: hafta → 7 gün, **ay görünümünde bütün ay**, mobilde tek gün. | Ay görünümünde istemeden 31 günlük atama önizlenebilir (önizleme/onay koruyor). | Varsayılanı "bugün" veya seçili gün yap; ay görünümünde uyarı yaz. | `ShiftCalendarView.tsx:196-199,311-318` |
| 09-D8 | Düşük | erişilebilirlik | Atama formunda "Uygulanacak günler" hatasında `aria-invalid` yalnız Pzt kutusunda. | Ekran okuyucu hatayı yalnız ilk kutuda bildirir. | `aria-invalid`'i fieldset'e ver, `role="group"`+`aria-describedby`. | `AssignShiftDialog.tsx:309` (doğrulanmadı, form açılamadı) |
| 09-D9 | Düşük | görsel | Atama formunda iç içe kaydırma: çalışan listesi `max-h-40`, önizleme `max-h-64`, dış pencere `max-h-[90dvh]`. | Küçük ekranda üç ayrı kaydırma alanı. | Önizleme listesini pencere kaydırmasına bırak. | `AssignShiftDialog.tsx:212,423` (doğrulanmadı) |
| 09-D10 | Düşük | görsel | Gün başlıkları uzun ("19 Ekim 2026 Pzt Bugün", ay görünümünde "10 Ekim 2026 Cmt" 3 satıra kırılıyor). | Her sütunda yıl tekrarı; ay görünümünde başlık yüksek. | Başlıkta "19 Pzt", yıl/ay üstte. | `ShiftCalendarGrid.tsx:68-73`; `desktop-month.png` |

## Doğrulananlar (sorun yok)
- Gece vardiyası: formda 22:00 → 06:00 giriliyor, "Bitiş ertesi gün (+1 gün)" ve "Brüt 480 dk · Mola 0 dk · Net 480 dk" doğru. Hücre mantığı ertesi gün "Önceki günden · 00:00–06:00" yazıyor (`ShiftCalendarCell.tsx:29-34`, kod; dolu veriyle görsel doğrulanmadı). Saatler İstanbul (`istanbulToday`, `dayLabel` timeZone Europe/Istanbul).
- Takvim hücresi erişilebilir adı ("Emre Aydın, 19 Ekim 2026 Pzt, atama yok, günü aç"), kaydırma bölgesi `role=region` + `tabIndex`, tablo `caption`/`scope`, Escape ile Sheet/form/gün penceresi kapanıyor, odak halkası görünüyor.
- Aktif proje kapsamı: tüm sorgular `projectId` alıyor (`Shifts.tsx`, `convex/shifts.ts` `resolveProjectScope`).

## Hızlı düzeltmeler (≤30 dk)
1. 09-O1/09-O2: tanım yokken "Vardiya ata" pasif + ipucu; "Boş bir gün seçerek…" yalnız aktif tanım varsa.
2. 09-O3: ISO tarihleri Türkçe biçimle (5 yer).
3. 09-O4: vardiya seçicilerinde "(+1 gün)" etiketi.
4. 09-O5: uyarı düğme etiketleri (ortak bileşen, 05-O6 ile birlikte).
5. 09-D1: "Gün N" stat kutusunu kaldır.
6. 09-D4: onay kutularına `accent-primary`.

## Ürün kararı gereken
1. Mobilde yalnız günlük ajanda mı kalsın, yoksa haftalık özet de eklensin mi (09-D6)?
2. Çalışan sayfa boyutu 50'de mi kalsın, yoksa 5000 satır sınırı için 25'e mi inilsin (09-O7)? Önce canlıda atama sayısı artınca ölçülmeli.
3. "Tek gün istisnası" (eski SHF-UI-16) yapılacak mı, yoksa "tüm seri" modeli kalıcı mı?

## Kanıt dosyaları
`09-vardiyalar/`: desktop-0, desktop-month, desktop-sheet, desktop-def-form, desktop-def-overnight, desktop-def-dirty-escape, desktop-day-detail, mobile-0 (yalnız üst 312px; mobil emülasyon görüntüsü güvenilir değil — ölçümler eval ile alındı), m-2.

## Kararlar (Emre, 2026-10-19)
- Tek gün istisnası şimdilik YOK ("tüm seri" modeli kalır).
- Mobilde günlük ajanda kalır.
- 09-O7 sayfa boyutu: canlıda atama sayısı artınca ölçülecek.
- Gece vardiyası: Vardiyalar'da tanımlanıp atanır; PDKS atanmış vardiyayı esas alır (bkz. 08 Kararlar).
