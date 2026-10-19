# 06 · Ziyaretçiler

## Özet
Ziyaretçiler ekranı, seçili projede geçici kart erişimi tanımlamak, ziyaretin erişim süresini izlemek ve ziyareti sonlandırmak içindir. En büyük üç sorun erişim durumu ile son okuma konumunun aynı rozet içinde karışması, liste sorgusunun gerekli olmayan kişisel alanları da taşıması ve dar ekran/panel düzeninin temel işlemleri zorlaştırmasıdır. Öneri A2 kabuğunu korur; sade sayaçlar, ayrı erişim/son konum kolonları, asgari kişisel veri ve kayıt–kart yakalama–sonlandırma akışını açıklayan tek sütunlu yan paneller kullanır.

## Kapsam ve kaynak gerçeği

17.10.2026 çalışma ağacı, commit edilmemiş Dalga 3a değişiklikleri dahil esas alındı. `docs/ui-scan/current/06-ziyaretciler.png`, `06-ziyaretciler-mobil.png` ve `06-ziyaretciler-mobil-2.png` açıldı; masaüstü `06-ziyaretciler-2.png` yok. Görseller boş listeyi gösterir; dolu liste, formlar ve cihaz etkileşimleri kaynak üzerinden incelendi, canlı uygulamaya giriş yapılmadı.

`src/pages/Visitors.tsx`, tüm ziyaretçi bileşenleri/form hook'ları, `useVisitors`, `useActiveProjectScope`, `useDevices`, `types/visitor`, `visitorTime`, `convex/visitors.ts`, `convex/lib/visitorPresence.ts`, `DeviceSyncStatusBanner` ve kullanılan `ZoneDeviceTree`/`TimeSchedule` incelendi. `SyncIssuesBanner` ortak Layout yüzeyidir; sayfa yalnız `DeviceSyncStatusBanner` ekler, ikinci bir global hata listesi önerilmez. Tüm örnek kişiler kurmacadır; gerçek kayıtlardan kopyalanmadı.

Kabuk sözleşmesi: `../01-ana-sayfa/REPORT.md` “Kabuk”. Mockup, A2 `people.html`/`home.html` ortak CSS sınıf ve değişkenlerinin 01 mockup'ında korunmuş sürümünü doğrudan alır; 216px sidebar, 64px üst çubuk, 13 öğenin sırası, proje seçici, hesap ve komut paleti korunur. Yalnız ziyaretçi içerik alanı ve katmanları eklenir; 390px'te aynı modal mobil menü kullanılır.

### Önceki audit ile karşılaştırma

- **ACC-18 çekirdek düzeltmesi korunur:** son izinli olay olay-zamanı index'inden gelir, ret konumu değiştirmez; süre dolumu içeride sayımını silmez (`convex/visitors.ts:104`, `src/types/visitor.ts:13`). “Şu an” kesinliği ve iki durumun aynı rozetle anlatılması aşağıda kalan UI sorunudur.
- **ACC-19 kapandı:** açık başlatma, ilk kartta kilitleme, proje değişiminde reset ve kart değişim onayı var (`VisitorCardCapture.tsx:49`, `:59`, `:66`, `:84`).
- **ACC-20 / 21 ana düzeltmeleri kapandı:** alan temizliği null ile iletiliyor; ev sahibi “Seçilmedi”, alan altı hatalar ve ilk hataya odak mevcut (`useVisitorFormSubmit.ts:32`, `VisitorFormFields.tsx:113`, `:163`, `VisitorForm.tsx:33`). Tarih doğrulamasında kalan iki durum VIS-UI-15/16.
- **ACC-24 ana düzeltmesi kapandı:** ad içeren sonlandır/sil onayı, pending ve “fiziksel çıkış okuması oluşturmaz” açıklaması var (`VisitorTable.tsx:158`, `:172`).
- **ACC-25 çift sync kapandı:** yalnız backend planlıyor; kayıt ve cihaz sonucu farklı anlatılıyor (`useVisitorFormSubmit.ts:50`). Proje banner'ı kişi bazlı onay değildir.
- **ACC-29 / 30 kapandı:** iade sentinel'i forma gelmiyor; yeni kart doğrulaması ve aktif proje kapsamı/ilişki kontrolü var (`useVisitorFormData.ts:71`, `useVisitorFormSchema.ts:12`, `useVisitors.ts:8`, `convex/visitors.ts:154`).
- **ACC-28 kısmen kapandı:** proje+ziyaretçi index'i var, fakat collect ve kişi başına zenginleştirme sürüyor. **ACC-31 kısmen kapandı:** iskelet ve proje seçin hali var, bölüm hatası/kalıcı başlık yok. **ACC-32 gün seçimi düzeldi:** günler wrap ediyor (`TimeSchedule.tsx:58`); panel/liste sorunları sürüyor. **ACC-22 / 26 / 34** açık. **ACC-27 QR** mevcut yetenek değil, bu öneriye eklenmedi.

## Mevcut durum taraması

Kanıt yollarında kısaltma: `V/` = `src/components/visitors/`; `VH/` = `src/components/visitors/hooks/`. Etki kaynak ve görüntüye dayanır; cihaz gecikmesi, kullanım süresi veya kontrast ihlali ölçülmüş değildir.

| ID | Kategori | Bulgu ve kanıt | Etki | Öneri |
|---|---|---|---|---|
| VIS-UI-01 | Görsel hiyerarşi / AI arayüzü izi | Başlık filtre kartında küçük h2; renkli ikon kutusu, gölgeli dört StatCard ve yuvarlatılmış ayrı yüzeyler üst alanı kaplıyor. `V/VisitorFilters.tsx:39`, `:46`, `V/VisitorStats.tsx:21`, `V/VisitorManagement.tsx:85`; masaüstü üst üç sıra. | Orta | PageHeader h1 + tek birincil eylem, kartsız StatInline, düz FilterBar ve 42px tablo ritmi. |
| VIS-UI-02 | Mikro-metin / durumlar | “Şu an binada” son izinli okumanın yaşını belirtmiyor; konum ve aktif erişim aynı rozetle değişiyor (“Binada” / “Aktif”). `V/VisitorStats.tsx:24`, `src/types/visitor.ts:20`, `V/VisitorTable.tsx:98`. | Yüksek | Ayrı erişim ve son okuma konumu; “Son okumaya göre içeride”, yanında `lastReadingAt`. Geçiş olmadan fiziksel çıkış iddia edilmez. |
| VIS-UI-03 | Durumlar / filtre tutarlılığı | Aktif/pasif sayaç ve filtre yalnız `isActive` kullanıyor; rozet ise saati de kontrol ediyor. Cron öncesinde “Süresi doldu” satırı aktif filtresine girebilir; sonlandırılmış ziyaret bitişi geçince etiketi de değişir. `V/VisitorManagement.tsx:31`, `V/VisitorStats.tsx:14`, `src/types/visitor.ts:21`. | Yüksek | Tek türetilmiş erişim sınıflandırması; checkedOut önce, sonra expiry, sonra ön kayıt/aktif/pasif. Aynı mantık sayaç, filtre ve rozet için kullanılsın; açık sayfada zaman ilerlemesi yenilensin. |
| VIS-UI-04 | Responsive | Eylem grubu wrap olmuyor, arama min 200px; mobil görsellerde kontroller sağdan kesiliyor. Tablo min 820px, eylemler en sağda. `V/VisitorFilters.tsx:51`, `:62`, `V/VisitorTable.tsx:46`, `:105`. | Yüksek | Mobilde tam genişlik arama, filtreler alt sıra; tabloda ad, erişim ve menü korunur, ayrıntı panelinden kalan alanlara erişilir. Kabuk sorunu SHELL-UI-01 kapsamındadır. |
| VIS-UI-05 | Form-diyalog / responsive | En çok 512px sheet içindeki form viewport md'de iki kolona bölünüyor; alan için çok dar sütunlar. `V/VisitorFormFields.tsx:42`, `V/VisitorSlideOverPanel.tsx:23`, `src/components/ui/sheet.tsx:59`. | Yüksek | 520px sheet'te tek sütun; yalnız ad/soyad masaüstünde kısa ikili sıra, 390px'te onlar da alt alta. Sabit başlık/alt eylem, kaydırılan gövde. |
| VIS-UI-06 | Form-diyalog / veri minimizasyonu | Satır tıklaması doğrudan düzenleme açıyor; telefon, ziyaret amacı ve notlar ilk açılışta görünür. Liste query'si `...vz` ile bütün employee alanlarını döndürüyor. `V/VisitorTable.tsx:73`, `V/VisitorSlideOverPanel.tsx:26`, `V/VisitorFormFields.tsx:81`, `:193`, `convex/visitors.ts:120`. | Yüksek | Önce asgari salt okunur ziyaret özeti; iletişim/notlar kullanıcı isteğiyle açılır. Liste DTO'sunu daralt; ayrıntı için yetkili sorgu. CSS maskeleme tek başına veri minimizasyonu sayılmaz. |
| VIS-UI-07 | Bileşen tutarlılığı / erişilebilirlik | Her satırda üç ikon ve tekrarlayan proje sync linki satır ritmini büyütüyor; satır tıklaması klavyede eşdeğer değil (ad hücresi metin). İkon aria-label düzeltmeleri mevcut. `V/VisitorTable.tsx:78`, `:102`, `:106`. | Orta | Ad gerçek düğme/bağlantı; tek adlandırılmış “İşlemler” menüsü. Proje sync bağlantısı bölüm başlığında bir kez, bireysel cihaz onayı gibi sunulmaz. |
| VIS-UI-08 | Durumlar: boş-yükleniyor-hata | Yeni projede dahi “Seçili filtrelere uygun kayıt yok”; temizle/ilk kayıt eylemi yok. Loading başlık/filtreyi kaldırıyor; query hatası yerel yönetilmiyor. `V/VisitorTable.tsx:63`, `V/VisitorManagement.tsx:68`, `src/hooks/useVisitors.ts:8`. | Orta | İlk kayıt/filtre boşluğu/erişimsiz ayrı EmptyState; başlık sabit, içerikte skeleton, query sınırında gerçek retry. |
| VIS-UI-09 | Erişilebilirlik / mikro-metin | Arama yalnız placeholder; durum seçici ve kart okuyucusu label–kontrol bağı yok. `V/VisitorFilters.tsx:53`, `:67`, `V/VisitorCardCapture.tsx:96`, `:103`. | Orta | Görünür kısa etiket, id/htmlFor veya aria-labelledby; input için “Ziyaretçi ara”, select için “Erişim durumu” ve “Kayıt okuyucusu”. |
| VIS-UI-10 | Form-diyalog / mikro-metin | Bölge yok metni hâlâ yanlış/eksik hedef olan “Erişim Yönetimi”ne yönlendiriyor; gerçek oluşturma form dışında. `V/VisitorFormFields.tsx:168`, `V/VisitorFilters.tsx:79`. | Yüksek | “Henüz ziyaretçi erişim bölgesi yok” + aynı taslağı koruyarak “Erişim bölgesi oluştur”; dönüşte yeni kuralı seç. |
| VIS-UI-11 | Form-diyalog / bilgi mimarisi | “Bölge Ekle” fiziksel zone izlenimi veriyor; gerçek veri visitor accessRule. Düzenlemede bölge tamamen kilitli ve yeni kayıt tavsiye ediliyor. `V/VisitorZoneDialog.tsx:50`, `:60`, `V/VisitorFormFields.tsx:150`, `:166`. | Yüksek | “Ziyaretçi erişim bölgesi”; kapı/gün/saat kapsamını göster. Mevcut sürümde kilidi açıklayıp desteklenen yeni ziyaret akışını tanımla; yerinde değiştirmeyi backend gereksinimi olarak tut. |
| VIS-UI-12 | Form-diyalog / hata önleme | Sheet dış tık/Escape sırasında dirty veya pending kontrol etmiyor; bölge dialog taslağı iptal sonrası state'te kalıyor. `V/VisitorSlideOverPanel.tsx:22`, `V/VisitorZoneDialog.tsx:54`, `:75`, `:105`. | Orta | Ortak dirty kapanış onayı, pending kapanış kilidi, “Vazgeç” ile açık taslak silme; bölge oluşturma dönüşünde ana taslak korunur. |
| VIS-UI-13 | Durumlar / kart yakalama | Dinleme başladıktan sonra buton disabled; durdurma, süre aşımı ve okuyucu yok açıklaması yok. `V/VisitorCardCapture.tsx:90`, `:107`, `:115`, `:133`. | Orta | Hazır → dinleniyor → yakalandı/timeout; görünür “Durdur”, okuyucu yoksa manuel giriş, 30sn sonra tekrar dene; iptalde yakalanan ama kabul edilmemiş kartı aktif kart gibi gösterme. |
| VIS-UI-14 | Form-diyalog / ölçek | Ev sahibi aramasız Select; tüm employees listesi yükleniyor, yalnız visitor olmayanlar filtreleniyor. Pasif personel de seçilebilir. `V/VisitorFormFields.tsx:102`, `VH/useVisitorFormData.ts:47`, `:57`. | Orta | Mevcut proje içinde aranabilir Combobox; pasif kişiyi etiketle, yeni atama politikası ürün kararı. Minimum id+ad seçenek sorgusu. |
| VIS-UI-15 | Form-diyalog / doğrulama | TR saati girilen datetime-local, Zod'da tarayıcı yerel saatinde `Date.parse(value)` ile doğrulanıyor; gönderimde +03:00 ekleniyor. Farklı saat diliminde kabul/ret ayrışabilir. `VH/useVisitorFormSchema.ts:10`, `V/visitorTime.ts:26`, `VH/useVisitorFormSubmit.ts:24`. | Yüksek | Doğrulama ve dönüşüm aynı TR duvar-saati helper'ını kullansın; İstanbul dışı tarayıcı saatinde kontrol. |
| VIS-UI-16 | Form-diyalog / doğrulama | Süresi geçmiş pasif ziyarette yalnız isim/not düzeltmesi de gelecek bitiş ister; submit bitişi her seferinde gönderir, backend tekrar doğrular. `VH/useVisitorFormSchema.ts:10`, `VH/useVisitorFormSubmit.ts:24`, `convex/visitors.ts:265`. | Orta | Geçmiş ziyaretin kişisel alan düzenlemesinde mevcut bitişi değiştirme; yalnız bitiş değişimi/yeniden aktifleştirme için gelecek kontrolü. |
| VIS-UI-17 | Yerleşim / performans | Proje index'i düzeldi fakat tüm ziyaretçiler collect, her ziyaretçide host/kural/okuma/rıza sorgusu ve tüm satır render sürüyor. `convex/visitors.ts:96`, `:99`, `:112`, `V/VisitorTable.tsx:67`. | Orta | Sunucu sayfalama + kapsamlı filtre, sayaçları ayrı hesap; UI sayfa boyutu ve sonuç sayısı. Gerçek gecikme ölçülmedi. |
| VIS-UI-18 | Bileşen tutarlılığı / rol | Yeni kayıt, bölge ve satır yazma eylemleri rol kontrolsüz görünür; create/update/checkOut/releaseCard sunucuda adminMutation. `V/VisitorFilters.tsx:79`, `V/VisitorTable.tsx:107`, `convex/visitors.ts:135`, `:235`, `:342`, `:376`, `convex/lib/customFunctions.ts:65`. | Yüksek | Üye için salt okunur ayrıntı, yetkisiz yazma eylemlerini gizle; backend yetkisini koru. İkonu gösterip son adımda yetki hatası üretme. |
| VIS-UI-19 | Form-diyalog / mikro-metin | Aynı kutu “KVKK aydınlatma metni onaylandı”, alt satır “Rıza alındı”; metni açan kontrol yok. `V/VisitorFormFields.tsx:213`, `:221`, `:225`; backend `convex/visitors.ts:42`. | Orta | Mevcut consent kaydını doğru adlandır; hangi metnin kaydı olduğu ürün tarafından kesinleştirilsin. Kutuyu önceden seçme veya zorunlu yapma; kayıt tarihini ayrıntıda göster, yasal uygunluk iddia etme. |

## Yeni tasarım

### Bilgi mimarisi ve eylemler

1. A2 ortak kabuk; aktif öğe Ziyaretçiler. Sayfa h1 “Ziyaretçiler”, altı “Merkez Ofis · Geçici erişim kayıtları”; sağda tek bordo “Yeni ziyaretçi”.
2. Kartsız `StatInline`: Toplam / Erişimi aktif / Son okumaya göre içeride / Erişimi kapalı. Bu rakamlar seçili projenin tüm kayıtlarına aittir, filtre sonucu sayısıyla karışmaz. “İçeride” aktif+kapalı kayıtlarla kesişebilir; sayılar toplanmaz.
3. Tek nötr proje cihaz durumu satırı. Başarısız/bilinmiyor token'ı korunur, örneğin “Proje cihazları · Bekleyen işlem yok”; son doğrulanmış onay varsa gerçek tarih. Kişinin tüm cihazlarının tamamlandığı sonucu çıkarılmaz.
4. `FilterBar`: etiketli ad/şirket/kart arama, erişim durumu, son konum, temizle; sağda sayfa boyutu (25/50). İkincil “Erişim bölgeleri”/“Erişim bölgesi oluştur” eylemi buradadır. Arama trim + `toLocaleLowerCase('tr')`; görünen kart maskelense bile yetkili arama gerçek kartla çalışabilir.
5. 42px satırlı liste, 36px başlık. Alt satır sonuç aralığı, toplam sonuç ve sayfalama; mockup 8 kurmaca kaydın tamamını gösterir.
6. Ziyaret ayrıntısı Sheet ve oradan “Düzenle” veya “Ziyareti sonlandır”. Ana listede toplu seçim yok; mevcut backend toplu işlem sunmuyor, gereksiz BulkBar eklenmez.

Birincil eylem yeni ziyarette “Ziyaretçiyi kaydet”, düzenlemede “Değişiklikleri kaydet”; pending “Kaydediliyor…”. Sonlandırma onayında “Ziyareti sonlandır”; kalıcı silme ayrı tehlikeli menü eylemidir. İade ayrı “Kartı serbest bırak”, fiziksel kart teslim alındığı operatör tarafından doğrulanmadan otomatik uygulanmaz.

### Kolonlar ve 390px davranışı

| Sıra | Kolon / gerçek alan | Masaüstü yaklaşık genişlik / öncelik | 390px |
|---|---|---|---|
| 1 | Ziyaretçi: firstName + lastName | 180px, esnek, en yüksek; adı açılabilir | 46%; açık ad düğmesi |
| 2 | Ziyaret edilen: host adı | 150px, orta | Gizli; panelde |
| 3 | Erişim bölgesi: presetRule.name | 160px, orta | Gizli; panelde |
| 4 | Geçerlilik bitişi: accessExpiresAt | 145px, yüksek, tabular | Ad altında kısa tarih/saat; tam tarih panelde |
| 5 | Erişim: türetilmiş durum | 145px, yüksek | 40%; rozet gerekirse satır sarar |
| 6 | Son konum: presence | 110px, yüksek | Erişim rozetinin altında metin |
| 7 | İşlemler | 44px, sabit | 14%; 36px hedef |

Şirket, telefon, amaç, notlar, kart numarası ana tabloda yok. Şirket panelde; kart varsayılan son dört hane, tam numara yalnız yetkili kullanıcının açık isteğiyle. Telefon/not alanlarını açmak ayrı ve amaca bağlıdır. Mobilde yatay belge kayması yok, sidebar modal; 16px kenar, başlık 24px, filtreler sarılır. Detay/form sheet tam ekran `100dvh`; alt eylemler sabit ve içerik kaydırılabilir, odak sırası görsel sırayla aynı.

### Durum sözleşmesi

- **Erişim aktif**: isActive true, süresi geçmemiş ve sonlandırılmamış; success.
- **Ziyaret sonlandırıldı**: visitorStatus checkedOut, nötr; expiry geçse de bu olay etiketi korunur.
- **Süresi doldu**: expired veya bitiş <= şimdi (sonlandırılmış kayıt hariç), warning; cihaz iptali ayrıca proje durumundan izlenir, danger kullanılmaz.
- **Ön kayıt / Pasif**: ilgili visitorStatus/isActive, nötr.
- **Son konum**: içeride / dışarıda / bilinmiyor; nötr metin + ayrıntıda son izinli olay tarihi. Süre dolumu ve manuel sonlandırma presence değiştirmez. “Çıktı” yalnız izinli exit olayını anlatır; manuel işlem için kullanılmaz.

Filtreler bu erişim sınıflarının hepsini ayrı sunar; konum select'i Tümü/İçeride/Dışarıda/Bilinmiyor. Tarih filtresi yeni bir ziyaret başlangıcı varsaymamak için bu sürüme eklenmedi.

### Boş, yükleniyor ve hata metinleri

| Durum | Metin / eylem |
|---|---|
| İlk kayıt | “Henüz ziyaretçi kaydı yok” / “Bu projede geçici erişim vereceğiniz ilk ziyaretçiyi ekleyin.” / yöneticiye Yeni ziyaretçi; üyeye kayıtların burada görüneceği açıklaması |
| Filtre boş | “Eşleşen ziyaretçi yok” / “Aramayı veya durum filtrelerini değiştirin.” / Filtreleri temizle |
| Yükleniyor | `role=status`: “Ziyaretçiler yükleniyor”; başlık kalır, altı iskelet; sıfır sayı gösterilmez |
| Liste hatası | “Ziyaretçiler yüklenemedi” / “Bağlantınızı kontrol edip tekrar deneyin.” / gerçek query sınırını sıfırlayan Tekrar dene |
| Proje yok | Ortak kabuğun rol temelli atama/aktif proje boşluğu; mevcut kayıt yok mesajıyla birleştirme |
| Kart bekliyor | “Kartı seçili okuyucuya okutun. İlk okuma forma alınır.” / Durdur |
| Kart süre aşımı | “30 saniyede kart okunmadı. Okuyucuyu kontrol edin veya numarayı elle girin.” / Yeniden dene |
| Kayıt tamamlandı | “Ziyaretçi kaydedildi. Cihaz işlemleri arka planda yürütülüyor.”; yalnız mutasyon tamamlandıysa |
| İşlem hatası | Onay/form içinde kalıcı açıklama; girişler korunur. Başarı toast'ı taklit edilmez |

### Kayıt, kart yakalama ve ayrıntı

**Yeni kayıt sırası:** ziyaretçi bilgileri (ad*, soyad*, şirket isteğe bağlı) → ziyaret (aranabilir ev sahibi, amaç isteğe bağlı) → erişim (ziyaretçi erişim bölgesi*, kapsam açıklaması, geçerlilik bitişi* TR saati, kart numarası*/okuyucu, erişim aktif) → kapalı “Ek bilgiler” (telefon, notlar) → mevcut KVKK kayıt alanı. Alanlara metin etiketi, zorunluluk işareti, alan altı Türkçe hata ve aria-describedby verilir; ilk hata odağı korunur. Şirket/telefon/amaç/notlar zorunlu yapılmaz. Doğum tarihi, kimlik numarası, fotoğraf, plaka, QR ve yeni kişisel alan eklenmez.

**Kart:** okuyucu seçilince otomatik başlamaz; “Okumayı başlat” ile arm, ilk okuma sonrası kilitlenir. Okundu durumu aynı kart alanına bağlıdır; tekrar okuma farklı kart getirirse eski/yeni numara maskeli onay, iptalde eski kart ve eski onay durumu kalır. Durdur/timeout yalnız dinlemeyi kapatır, kayıt taslağını silmez. Mockup'taki “Örnek okuma üret” yalnız önizleme kontrolüdür ve üretim bileşenine taşınmaz.

**Bölge ataması:** yeni kayıtta aktif ziyaretçi kurallarından seçilir. “Erişim bölgesi oluştur” ana taslağı koruyan ikinci dialog açar: ad → günler → saatler/Tüm gün → aranabilir zone/device/door ağacı → seçili kapı/cihaz özeti → Oluştur. En az bir kapı/cihaz, ad, gün ve saat hataları kendi alanında; no-options/loading/error ayrılır. Oluşan kural ID'si dönünce otomatik seçilir. Mevcut kayıtta bölge alanı salt okunur; yerinde değişim backend işi tamamlanmadan mockup bunu çalışır gibi sunmaz.

**Ayrıntı:** başlık ad + erişim rozeti; erişim bitişi, bölge, ev sahibi, son konum + olay zamanı, kart iade durumu/maskeli numara; açılır şirket/amaç/iletişim/not ve mevcut consent tarihi. “Ziyareti sonlandır” onayında isim, “Erişim pasife alınır; cihazlardan kaldırma işlemi başlatılır”, “Fiziksel çıkış okuması oluşmaz; kart iadesi ayrıdır.” Sonuçta presence korunur. İade edilmiş kartta yeniden aktivasyon geçerli yeni kart ve gelecek bitiş ister. Üyede yalnız görüntüleme vardır.

## Bileşen eşlemesi

| Ortak bileşen | Kullanım / değişecek mevcut dosya |
|---|---|
| PageHeader | VisitorManagement; VisitorFilters içindeki tekrar başlık/ikon kutusu kalkar |
| StatInline | VisitorStats'taki dört StatCard yerine; bu sayfada StatCard import'u kalkar |
| FilterBar | VisitorFilters; rol bazlı ikincil eylem, erişim/konum filtreleri |
| DataTable | VisitorTable; ad düğmesi, menü, mobil kolon önceliği ve sayfalama |
| StatusBadge | types/visitor ortak sınıflandırma; aynı semantik sayaç/filtrede |
| EmptyState / ErrorState / SectionSkeleton | VisitorManagement ve useVisitors query sınırı; başlık korunur |
| Sheet / Dialog / Form alanları | VisitorSlideOverPanel görüntüleme+düzenleme; VisitorForm/Fields tek sütun; sticky FormActions; VisitorZoneDialog taslağa bağlı |
| Combobox | Ev sahibi ve bölge; useVisitorFormData minimum seçenek sorguları |
| ConfirmDestructive | Mevcut sonlandır/sil/kart değiştir onayı korunur; kart iadesi ve dirty kapanış aynı sözleşmeye alınır |
| DeviceSyncStatusBanner | Sayfada tek proje durumu; src/pages/Visitors yerleşimi başlık altına taşınır |
| BulkBar | Kullanılmaz; ziyaretçi toplu mutation API'si yok |

Mevcut ziyaretçi dosyalarının hiçbiri tamamen silinmek zorunda değil; kabuk, global SyncIssuesBanner ve shared bileşenler koordineli Faz C kapsamıdır. TypeScript strict ve mevcut camelCase Convex alanları korunur; form schema alan adları yeniden adlandırılmaz.

## Backend gereksinimi

1. **Asgari liste + ayrıntı:** `visitors.list` açık alan listesi döndürmeli, tüm employee doc spread edilmemeli. Seçili kayıt için scope/yetki kontrollü detay sorgusu; hassas alanları yalnız gerektiğinde getir. Yeni kişisel alan gerekmez.
2. **Sayfalama ve sayaç:** mevcut API'de cursor yok; proje/erişim filtreli paginate, sunucu arama ve ayrı doğru özet gereklidir. İlk Faz C'de istemci sayfalama yapılırsa tüm veri hâlâ yüklenir; bunun performans çözümü olmadığı belirtilmeli. Mockup'taki toplamlar gerçek model alanlarının kurmaca örneklerinden türetilmiştir.
3. **Bölge değişimi (ayrı iş):** mevcut update presetRuleId kabul etmez; geçmiş kaydı koruyan ilişki/üyelik güncellemesi, eski erişim kaldırma, yeni erişim ve cihaz sonucu gerekir. Bu mutasyon gelmeden düzenlemede bölge açılmaz.
4. **Pasif kayıt düzenleme:** değişmeyen geçmiş bitiş gönderilmez; yeniden aktifleştirme için sunucu etkin bitişi yeniden doğrular. İstemci TR saat doğrulaması aynı yardımcıyla yapılır.
5. **Kişi bazlı sync:** mevcut banner yalnız proje toplaması; kişi-cihaz doğrulanmış durumunu göstermek istenirse ayrı korelasyon API'si gerekir. Tasarım ve mockup kişi bazlı “cihazda hazır” iddiası içermez.

## Açık sorular

1. Mevcut `visitor_kvkk` kaydı ürün dilinde aydınlatma bildirimi mi, rıza kaydı mı; hangi metin/sürüm üzerinden alınır ve geri alma nereden yönetilir?
2. Bölge değişimi aynı ziyaret üzerinde desteklenecek mi, yoksa mevcut yeni ziyaret politikası korunacak mı?
3. Pasif ev sahibi yeni ziyarete atanabilir mi; varsayılan seçenek politikası ne olmalı?

## Uygulama tahmini

**L · 24–36 saat** (ortak A2 kabuk hazır varsayımı): içerik/listeler 6–8s, kayıt/ayrıntı/kart/bölge akışları 8–12s, minimum veri + pagination/sayaç 6–10s, responsive/klavye/rol/doğrulama 4–6s. Yerinde bölge değiştirme ve kişi-cihaz sync korelasyonu bu aralığa dahil değildir; ayrı backend tasarımı gerekir. Başlıca riskler zamanla değişen expiry sınıflandırması, kart yeniden kullanım/sentinel sözleşmesi, yetki-kapsam kontrolleri ve query dönüş tipi değişince mevcut formun güncellenmesidir.

## Teslim ve doğrulama

Yalnız bu klasörde `REPORT.md` ve `mockup.html` üretilir; uygulama kaynakları değiştirilmez. Mockup veri değiştirmeyen, ağsız bir yerel önizlemedir; örnek işlemler yalnız bellekte yürür. 

- Yerel Chrome, mevcut önbellekteki Playwright ile `file://` üzerinden çalıştırıldı; paket kurulmadı. 1440×1000 ve 390×844 viewport'larda belge scrollWidth değeri sırasıyla 1440 ve 390; mobil sheet de 390px. **Konsol/pageerror: 0, HTTP(S) isteği: 0.**
- Python `html.parser` yığın kontrolü: eşleşmeyen/açık tag 0, tekrar eden statik id 0.
- Etkileşim kontrolleri geçti: Türkçe arama ve erişim filtresi; filtre boşluğu; ilk kayıt/yükleniyor/hata; zorunlu alan doğrulaması; bölge oluştururken ana taslağın korunması; ilk karttan sonra dinleme kilidi; farklı kart onayını iptal edince mevcut kartın korunması; kayıt; sonlandırma sonrası içeride konumunun korunması; kart iadesi; üyede yazma eylemlerinin gizlenmesi; dirty dış tık onayı; mobil menü; komut paleti; proje değişiminde eski projenin kayıtlarının temizlenmesi.
- Görsel kontrol yapıldı: [Masaüstü](desktop.png), [Mobil](mobile.png), [Kayıt formu](form.png), [Mobil form](mobile-form.png), [Ayrıntı](detail.png). İlk kontrolde daralan mobil filtreler düzeltilip yeniden doğrulandı.
- Mockup sınırı: sabit 17.10.2026 10:00 örnek zamanı, 8 başlangıç kaydı ve bellek içi işlemler kullanır; gerçek mutation pending/hata, cihaz yanıtı, kalıcı silme ve sunucu sayfalama doğrulanmış değildir. Ev sahibi native datalist ve bölge dialog'undaki küçük kapı listesi etkileşimi örnekler; üretimde rapordaki Combobox ve mevcut aranabilir ZoneDeviceTree kullanılır. Tam UI/cihaz E2E veya hukuki uygunluk testi yapılmadı.

