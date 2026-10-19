# UI Audit 2 · 10 İzinler (`/leaves`)

**Özet.** Eski taramadaki (LEV-UI-01…16) büyük eksikler kapanmış: tek tablo, kişi/tür/dönem filtresi, sayfalama, ayrıntı paneli, düzenleme, çakışma kontrolü, İstanbul saatine göre "bu ay" var; karar kurallarına (yalnız tam gün, çakışan onaylı izin engeli, eski pending/rejected salt okunur) aykırı bir görünüm veya kod yok. Kalan sorunlar filtre/sayfalama mantığında (filtre sunucuda yalnız 200 satırlık aday sayfaya uygulanıyor), masaüstünde bozuk "Ay" etiketi ve yanıltıcı kişi arama kutusunda. Proje (NGS) şu an 0 izin kaydı içerdiği için liste satırı, ayrıntı paneli ve satır menüsü canlıda **görülemedi**; o kısımlar koddan okundu ve "doğrulanmadı" diye işaretli. Hiçbir kayıt kaydedilmedi/silinmedi.

| Önem | Adet |
|---|---|
| Yüksek | 1 |
| Orta | 6 |
| Düşük | 5 |

## Bulgular

| ID | Önem | Kategori | Ne görülüyor | Neden sorun | Öneri | Kanıt |
|---|---|---|---|---|---|---|
| 10-H1 | Yüksek | hata / performans | Liste sorgusu (`listPage`) en fazla 200 satırlık "aday sayfa" okuyor, kişi/tür/dönem filtresini **sonra** bellekte uyguluyor. Dönem başlangıcı indeks sınırı değil; kişi ve tür hiç indeks kullanmıyor. Arayüz de bunu "Bu sayfada eşleşen izin yok; daha eski kayıtları tarayın" + "Devam" düğmesiyle kullanıcıya yansıtıyor. | Çok kayıtlı projede "Ahmet" seçilince ilk sayfalar boş gelir, "Sonraki" sürekli açık kalır, sayfa sayısı bilinmez; üstteki "N kayıt · M kişi" sayacı (ayrı sorgu, ayrı tarama) ile liste tutmaz. Bu, eski 06-H1 (sayfa içi filtre) türünün sunucu tarafı hali. Canlıda **doğrulanmadı** (0 kayıt). | Kişi seçiliyken `by_employee_start`, tür için bileşik indeks kullan; dönemde `by_project_end` ile alt sınır ekle. Kısa vadede "Devam" boş sayfa yerine sunucuda boş sayfaları atlayıp dolu sayfa dön. | `convex/leaves.ts:115-123`, `src/components/leaves/LeaveResults.tsx:172-176`, `:202` |
| 10-O1 | Orta | görsel / erişilebilirlik | Masaüstünde "Ay" etiketi ay seçicinin **solunda, aynı satırda** (x=1129, picker x=1144) küçük "Ay" yazısı olarak kalıyor; diğer filtrelerde etiket üstte. Ay seçicinin erişilebilir adı "Ay" — ekran okuyucu "Ekim 2026" değerini okumaz. Mobilde etiket üstte (y343 / picker y361), yani yalnız ≥md. | Hizasız, yanlış okunan alan; bu bir A2 filtre çubuğu tutarsızlığı. | Etiketi diğerleri gibi üste al (picker'ın `flex` kapsayıcısını kontrol et); `aria-label="Dönem ayı: Ekim 2026"` ver. | `d-01.png`, `LeaveFilters.tsx:176-186`; erişilebilirlik ağacı: `button "Ay"` |
| 10-O2 | Orta | etkileşim / içerik | Filtre çubuğunun ilk kutusu "Kişi adı veya departman ara" **listeyi değil**, yalnız yandaki "Kişi" açılır listesinin seçeneklerini daraltıyor. | Kullanıcı "Ahmet" yazıp Enter'a basınca listenin süzülmesini bekler; hiçbir şey olmaz. Eski LEV-UI-11 (aranabilir kişi seçici) yarım kapanmış. Formda da aynı: arama kutusu + ayrı `select`, label `select`'e bağlı ama ilk odak arama kutusunda. | Tek bir aranabilir seçici (combobox: yazdıkça seçenek, seçince filtre) kullan; arama kutusunu kaldır. Formda da aynısı. | `d-01.png`, `d-02-form.png`, `LeaveFilters.tsx:97-123`, `EmployeePicker.tsx:33-50` |
| 10-O3 | Orta | içerik / etkileşim | Kapatırken çıkan "Değişiklikler kaydedilmedi" kutusunda düğmeler **Vazgeç** ve **Çık**. Formun kendi düğmesi **İptal**. | "Vazgeç" burada "kapatmaktan vazgeç = formda kal" anlamında, ama günlük dilde "izin eklemekten vazgeç" gibi okunur; İptal de aynı yönde. Eski 05-O6/09-O5 **hâlâ açık**. | "Düzenlemeye dön" / "Kaydetmeden çık". | `src/components/shared/UnsavedChangesDialog.tsx:24`, `LeaveForm.tsx:391` |
| 10-O4 | Orta | içerik / performans | Çakışma ve tarih kuralları yalnız **Kaydet**'e basınca sunucudan öğreniliyor (alan anlık doğrulaması `isSubmitted` olmadan kapalı; çakışma önceden sorgulanmıyor). Eski LEV-UI-05/06 sunucu tarafı kapanmış, ama kullanıcı 366 gün/çakışma sorununu ancak kayıt denemesinde görür. | Kayıt denemesi = yazma denemesi; hatalı denemeler gereksiz mutation. (Canlı yazma testi yasak olduğundan form hata metinleri görülmedi, koddan okundu.) | Kişi+tarih seçilince salt-okunur bir `conflictFor(employeeId,start,end)` sorgusuyla form içinde uyar. | `LeaveForm.tsx:332-336`, `:349-353`; `convex/leaves.ts:31-52` |
| 10-O5 | Orta | performans | Bir ekran 3 ayrı tarama yapıyor: `listPage` (200 satır), `summary` (en çok 5000 satır, her filtre değişiminde), boş durumda üçüncü bir `summary` (`0001-01-01…9999-12-31`, 5000 satır). Her izin yazımında hepsi yeniden çalışır (canlı abonelik). `summary` 5000'i aşınca sayaç "N kayıt gösteriliyor"a düşüp kişi sayısını da kaybediyor. Eski LEV-UI-15 **hâlâ açık**. | Büyük projede ağır okuma, sayaç tutarsızlığı; Convex okuma kotası riski (bkz. IDE poll kota olayı). | Sayaç için `count` indeksi/özet tablosu ya da sayacı yalnız "≥ N" olarak tutarlı göster; boş durum için `take(1)` yeterli. | `convex/leaves.ts:127-141`, `LeaveResults.tsx:25-35`, `:48-57` |
| 10-O6 | Orta | içerik | "PDKS kayıtlarını aç" bağlantısı kişiyi **ad aramasıyla** (`person=Ad Soyad`) taşıyor. Aynı adlı iki kişi varsa PDKS yanlış/çift kişi gösterebilir; panel bunu küçük bir not olarak söylüyor ("aynı adlı kişiler de eşleşebilir"). | Yanlış kişinin puantajına bakma riski. Canlıda satır olmadığından **doğrulanmadı**. | PDKS kişi filtresi employeeId kabul etsin; o zamana kadar notu kalın/uyarı yap. | `leaveState.ts:114-123`, `LeaveDetails.tsx:107-113` |
| 10-D1 | Düşük | içerik | Ayrıntı panelinde "Son güncelleme" `toLocaleString("tr-TR")` ile **tarayıcı saat dilimine** göre yazılıyor; saat dilimi `Europe/Istanbul` verilmemiş (bilinen 08-O2 türü). | Yurt dışındaki yönetici farklı saat görür; liste ise İstanbul'a göre "bu ay" hesaplıyor — tutarsız. | `toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })`. | `LeaveDetails.tsx:88` |
| 10-D2 | Düşük | içerik | Filtrede seçili kişi ilk 50 seçenekte yoksa seçenek adı **"Seçili kişi"** yazıyor (paylaşılan bağlantıda ad görünmez). | Hangi kişinin süzüldüğü anlaşılmaz. | Kişi adını `employeeOptions`'a id ile ayrıca çektir. | `LeaveFilters.tsx:57-59` |
| 10-D3 | Düşük | görsel | Mobilde (390px) filtreler ilk ekranın büyük kısmını kaplıyor: filtre alanları y159–397, içerik y421 / 844 (DOM ölçümü); arama + Kişi + Tür/Dönem + Ay + Temizle ayrı satırlar. Yatay taşma yok (scrollWidth=390). | Satırlar ilk ekranda görünmez. | Mobilde filtreleri "Filtreler" düğmesiyle katla; sayaç üste. | `m-01.png`…`m-03.png` (emülasyon bilinen hatası nedeniyle yalnız DOM ölçümü güvenilir) |
| 10-D4 | Düşük | görsel / içerik | "Dönem: Ay seçimi / Özel aralık" seçimi + ayrı "Ay" seçici = tek iş için iki kontrol; "Ay seçimi" etiketi eylem gibi okunuyor. | Gereksiz tıklama. | Tek "Dönem" kontrolü: ay seçici + "Özel aralık…" seçeneği. | `d-01.png`, `LeaveFilters.tsx:139-187` |
| 10-D5 | Düşük | içerik | Adres çubuğuna otomatik `?scope=<projectId>` ekleniyor (ham Convex kimliği); sayfa her açılışta `replace` ile URL'yi yeniden yazıyor. | Kirli URL, paylaşılan bağlantıda proje kimliği görünür. | Proje bağlamını URL yerine bağlamdan al ya da yalnız farklıysa yaz. | `src/pages/Leaves.tsx:55-61` |

## Doğrulanamayanlar (0 kayıt nedeniyle)
Satır görünümü, durum rozetleri, satır menüsü (Ayrıntılar/Düzenle), ayrıntı paneli, eski pending/rejected salt-okunur görünümü, çakışma bağlantısı ("Kaydı aç"), sayfalama davranışı. Kod bu kısımlarda kurallara uygun: pending/rejected'da Düzenle yok (`LeaveList.tsx:32`, `LeaveDetails.tsx:92-96`), sunucu `LEAVE_READ_ONLY` döner (`convex/leaves.ts:221`), form yalnız tam gün (saat alanı yok).

## Çalışan / iyi olanlar
Escape formu kapatır, takvimden Escape yalnız takvimi kapatır; dialog açılışta odak arama kutusunda; mobil form tam ekran sheet, İptal/Kaydet alt sabit (y792, 36px); `Ekim 2026` varsayılan dönem İstanbul'a göre; tarih `GG.AA.YYYY`; tablo `caption` ve satır menüsü `aria-label` taşıyor.

## Hızlı düzeltmeler (≤30 dk)
1. 10-O1: "Ay" etiketini üste al + picker `aria-label`.
2. 10-O3: Kaydedilmedi kutusu düğme metinleri.
3. 10-D1: `timeZone: "Europe/Istanbul"`.
4. 10-O5 (kısmi): boş durum sorgusunu `take(1)`'e indir.
5. 10-D4: "Ay seçimi" seçeneğini "Aylık" yap.

## Ürün kararı gereken
1. **Kişi araması** (10-O2): tek aranabilir combobox mu, yoksa listeyi süzen ayrı arama kutusu mu?
2. **Sayfalama modeli** (10-H1): "N kayıt · M kişi" sayacı ve gerçek sayfa sayısı gerekli mi? Gerekliyse indeks/özet tablosu maliyeti kabul edilir mi?

## Ekran görüntüleri
`10-izinler/d-01.png` (masaüstü boş durum), `d-02-form.png` (İzin ekle), `d-03-datepicker.png` (takvim), `m-01…03.png` (390px; emülasyon sürekli kaydırmayı yakalamadı, bu yüzden mobil bulgular DOM ölçümüne dayanır).

## Kararlar (Emre, 2026-10-19)
- 10-O2: tek aranabilir kişi seçici (arama + seçim birleşik; seçim listeyi süzer).
- 10-H1: sunucu taraflı tam filtre (kişi/tür/dönem indeksli; gerçek sayfa + sayaç), Ziyaretçiler 06-H1 ile aynı yaklaşım.
