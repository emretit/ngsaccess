# 03 · Cihazlar — A2 UI taraması

## Özet
Cihazlar sayfası proje envanterini, bağlantı sağlığını ve bölge–kapı–okuyucu eşlemesini yönetir. En büyük üç sorun dar ağaçta adların işlem açıklamaları tarafından sıkıştırılması, dört ayrı istatistik kartının liste alanını tüketmesi ve bağlantı/işlem bilgisinin düzenleme formunun arkasında kalmasıdır. Öneri A2 kabuğunda tam genişlik envanter, kartsız sayaçlar, isteğe bağlı konum ağacı ve bağlantı özetiyle açılan cihaz ayrıntısıdır.

## Kapsam ve kaynak doğruluğu

17.10.2026 çalışma ağacı esas alındı; önceki audit (`docs/ux-audit/01_CIHAZLAR.md`) tek başına mevcut davranış kabul edilmedi. `03-cihazlar.png`, `03-cihazlar-mobil.png`, `03-cihazlar-mobil-2.png` görsel olarak incelendi; masaüstü `03-cihazlar-2.png` yok. Mobil görseller sabit açık eski kabuk gösteriyor; güncel kaynakta sayfa artık `flex-col lg:flex-row` olduğundan eski yatay flex hatası yeniden bulgu sayılmadı. Canlı uygulamaya/DB'ye giriş yapılmadı.

Korunacak tamamlanmış işler: ayrı `connectionStatus` ve 15 saniye tazelik (`src/hooks/useProjectFilteredDevices.ts:20`); URL filtreleri (`src/hooks/useDeviceFilters.tsx:11`); `doorIds` eşlemesi (`convex/devices.ts:77`); gerçek model ve özel ad (`src/components/devices/DeviceTableRow.tsx:75`); adlandırılmış checkbox ve boş durum eylemleri (`src/components/devices/DeviceList.tsx:91`, `:140`); kapatılmış senkron uyarısını başarı saymama (`src/components/sync/SyncIssuesBanner.tsx:63`); kaynak kapı etkisini açıklayan okuyucu taşıma ve kısmi sensör hatası (`src/components/access-control/MoveReaderDialog.tsx:95`, `src/components/access-control/EditReaderDialog.tsx:80`). Bu davranışlar tasarım geçişinde gerilememeli.

## Mevcut durum taraması

| ID | Kategori | Bulgu ve kanıt | Etki | Öneri |
|---|---|---|---|---|
| DEV-UI-01 | Yerleşim | 300px panelde bölge adı ile 192px'e kadar silme engeli açıklaması aynı flex satırını paylaşıyor; ad sıfıra yakın daralıyor. `src/components/access-control/ZoneDoorTreePanel.tsx:42`, `src/components/access-control/ZoneDoorTree.tsx:497`, `:523`; masaüstü sol panel. | Yüksek | Konum ağacını 480px sheet'te aç; silme gerekçesini satır menüsünde, adları sarılabilir göster. |
| DEV-UI-02 | AI arayüzü izi | Dört renkli ikon kutulu sayaç, dört ayrı yüzey/gölge oluşturuyor. `src/components/devices/DeviceStats.tsx:18`, `:26`; masaüstü orta bant ve mobil-2 üst bölüm. | Yüksek | `StatInline`: Toplam / Çevrimiçi / Çevrimdışı / Henüz bağlanmadı, nötr tek satır; mobil doğal sarma. |
| DEV-UI-03 | Görsel hiyerarşi | Sayfa adı filtre kartında 14px h2; ekleme arama ve iki select arasına gömülü. `src/components/devices/DeviceFilters.tsx:44`, `:52`, `:101`. | Orta | 26px tek h1 + proje kapsamı; sağda tek Cihaz ekle birincil eylemi. |
| DEV-UI-04 | Bileşen tutarlılığı | Tablo iki ayrı yuvarlatılmış çerçeve içinde; dış kabuk gölgeli. `src/components/devices/DevicesContent.tsx:78`, `src/components/devices/DeviceList.tsx:86`. | Orta | Tek `DataTable` yüzeyi, 6px radius, 1px ayırıcı; gölge yok. |
| DEV-UI-05 | Yerleşim | Bölge→cihaz→kapı→okuyucu dört seviye ve okuyucuda çok sayıda sürekli ikon ad alanını daraltıyor. `src/components/access-control/ZoneDoorTree.tsx:236`, `:249`, `:258`, `:278`, `:298`, `:547`. | Yüksek | Navigasyonda bölge→kapı→okuyucu; sahip cihaz kapının yardımcı satırı. Okuyucu eylemleri tek menü; cihaz sahipliği veri modelinde korunur. |
| DEV-UI-06 | Responsive | Güncel mobilde ağaç liste önünde en çok 288px yüksekliğinde yer tutuyor; tablo hâlâ 760px minimum. `src/components/access-control/ZoneDoorTreePanel.tsx:64`, `src/components/devices/DeviceList.tsx:87`. | Yüksek | Mobil konum sheet'i ve ad/bağlantı/menü kolonları; seri/model/konum ayrıntıda. Belge yatay kaymaz. |
| DEV-UI-07 | Tipografi | Gereksiz sıra numarası ile uzun seri/model kolonları dar listeyi sıkıştırıyor; görüntüde dört satır yaklaşık 400px. `src/components/devices/DeviceList.tsx:97`, `src/components/devices/DeviceTableRow.tsx:69`, `:81`; masaüstü tablo. | Orta | # kalkar; 42px satır, 36px başlık; model yoksa kısa “Belirtilmedi”, tip ayrıntıda. |
| DEV-UI-08 | Bileşen tutarlılığı | Her satırda QR, konum, düzenleme, silme ve kimi cihazlarda havuza al ikonları. `src/components/devices/DeviceTableRow.tsx:89`. | Orta | Ad düğmesi ayrıntıyı açar; geri kalanlar tek “İşlemler” menüsünde; silme son grupta. |
| DEV-UI-09 | Mikro-metin | Her iki seçicide görünen değer “Tümü”; görsel olarak hangi filtre olduğu belirsiz, aria-label zaten var. `src/components/devices/DeviceFilters.tsx:75`, `:80`, `:88`, `:92`. | Orta | Görünen etiketler “Bağlantı: Tümü”, “Tip: Tümü”. |
| DEV-UI-10 | Mikro-metin | Kapı filtresi açık ad yerine “Kapı filtresi etkin” diyor. `src/components/devices/DevicesContent.tsx:61`. | Orta | “Konum: Zemin kat / Ana giriş”; chip temizleme ve sheet seçili yolu. |
| DEV-UI-11 | Görsel hiyerarşi | Ayrıntı “Cihazı Düzenle” adıyla Bilgiler formunda açılıyor; son sinyal ve kuyruk ikinci sekmede. `src/components/devices/DeviceDetailsPanel.tsx:63`, `:85`, `:107`. | Yüksek | Cihaz adı başlık; varsayılan Genel bakış, sonra Ayarlar. Bağlantı/son sinyal/bekleyen işler ilk ekranda. |
| DEV-UI-12 | AI arayüzü izi | Cihaz Merkezi kart içinde kart, büyük harf başlık ve metrik kutularıyla yoğun. `src/components/devices/DeviceCommandCenter.tsx:390`, `:408`, `:422`, `:431`, `:488`. | Orta | 1px ayırıcıyla Bağlantı / İşlemler / Kapılar bölümleri; teknik tarama açılır ayrıntıda. |
| DEV-UI-13 | Mikro-metin | “Capability Snapshot” ve “Snapshot yok” kullanıcı dilinden kopuk. `src/components/devices/DeviceCommandCenter.tsx:432`, `:446`. | Düşük | “Cihaz özellikleri”, “Henüz özellik taraması yapılmadı”, “Özellikleri tara”. |
| DEV-UI-14 | Form-diyalog | IDE marka seçimi HTTP/JSON ve “bölge olarak eklenir” diyor; aktif bölüm MQTT ve ayrı bölge seçimi kullanıyor. `src/components/devices/BrandPickerStep.tsx:27`, `src/components/devices/form-sections/DeviceIdeSmartSection.tsx:12`, `src/components/devices/DeviceForm.tsx:100`. | Yüksek | “IDE Smart · MQTT ile bağlanan çok kapılı panel”; bölge ayrı alan. Renkli marka ikonları nötr seçim satırına dönüşür. |
| DEV-UI-15 | Form-diyalog | Hikvision marka açıklaması yalnız gateway'i anlatıyor; modelden seçilen yerel köprü akışı keşfedilmiyor. `src/components/devices/BrandPickerStep.tsx:21`, `src/components/devices/form-sections/DeviceHikvisionSection.tsx:55`. | Orta | “Hikvision · Gateway veya yerel köprü”; model seçimi sonrası ilgili bağlantı alanları. DS-K2804'e ISAPI portu uydurulmaz. |
| DEV-UI-16 | Form-diyalog | Dış tıklama/Escape doğrudan kapatıyor; marka geri dönüşü formu kaldırıyor; dirty koruması görünmüyor. `src/components/devices/DeviceDetailsPanel.tsx:58`, `:119`, `src/components/devices/DeviceForm.tsx:164`. | Yüksek | Taslak korunur; dirty kapanışta “Değişiklikleri bırak / Düzenlemeye dön”; pending kapanış kilitli, alt eylem sabit. |
| DEV-UI-17 | Görsel hiyerarşi | Liste bağlantı rozetini gösteriyor ama senkron işi aynı yerde görünmüyor; proje şeridi ve cihaz kuyrukları ayrı bileşenlerde. `src/components/devices/DeviceTableRow.tsx:50`, `src/components/sync/DeviceSyncStatusBanner.tsx:14`, `src/components/devices/DeviceCommandCenter.tsx:254`. | Orta | Bağlantı ve senkron ayrı anlamlar; proje uyarısı sayaç altı, ilgili cihaz bağlantısı ayrıntının İşlemler bölümünü açar. Listeye sorgulanmamış senkron sayısı eklenmez. |
| DEV-UI-18 | Yerleşim | Tüm filtrelenen kayıtlar bir defada render ediliyor, sayfa boyutu yok; liste sorgusu tüm kayıtları topluyor. `src/components/devices/DeviceList.tsx:119`, `convex/devices.ts:51`, `:77`. | Orta | İlk fazda mevcut veri üzerinde 25/50/100 yerel sayfalama; büyüyen envanter için sunucu kapsamlı arama/sayfalama ayrı backend işi. |

## Yeni tasarım

### Bilgi mimarisi ve eylemler

1. A2 `home.html` / `people.html` ile aynı bordo sidebar, 13 menü, proje seçici, üst bar. Cihazlar aktif. Kabuk CSS'i mockup'a kopyalandı; yalnız içerik için ek kurallar var.
2. `PageHeader`: Cihazlar; alt satır “Merkez Ofis · Cihaz envanteri”. Birincil Cihaz ekle; tek girişte Yeni cihaz / Havuzdan ata seçenekleri.
3. `StatInline`: filtreden etkilenmeyen proje toplamları; aktif filtre sonucu ayrıca tablo altında “4 cihazdan 2 gösteriliyor”. Dört sayacın paydası aynı. Bilinmeyen yükleme durumunda sıfır gösterilmez.
4. Senkron sorunu varsa proje kapsamlı, kompakt uyarı. Cihaz adı ilgili ayrıntıyı açar. Kapatma sonucu değiştirmez; eksik tarama “Yalnız yüklenen uyarılar” der. Sorun yokken sürekli yeşil başarı şeridi yok.
5. `FilterBar`: ad/seri/UUID araması; Bağlantı, Tip; “Bölge ve kapı” sheet düğmesi; Filtreleri temizle. URL geri/ileri ve proje değişimi sıfırlaması korunur.
6. Seçim olunca `BulkBar`: N cihaz seçili, Seçimi temizle, Sil. Mevcut görünür seçim/kısmi sonuç sözleşmesi korunur; onay isimleri ve gerçek silme etkisini gösterir. Filtre dışında örtük seçim tutulmaz.
7. Tam genişlik tablo. Ağaç aynı anda kalıcı ikinci sidebar değildir. Kapsam yolu seçildiğinde filtre satırında görünür.
8. Cihaz adıyla açılan 620px sheet: Genel bakış / Ayarlar. Genel bakış sırası bağlantı+son sinyal, kimlik/marka/transport, bekleyen/başarısız işlemler, kapılar ve okuyucular, teknik ayrıntı. Modelde bulunmayan pil/RSSI/uptime verisi eklenmez.

### Tablo kolonları

| Sıra | Kolon | Genişlik / öncelik | 390px |
|---|---|---|---|
| 1 | Seçim | 40px / sabit | 36px, cihaz adını söyleyen label |
| 2 | Cihaz adı | kalan alan, min 160px / 1 | min 0, sözcük sarar; ad düğmesi |
| 3 | Marka / model | 180px / 4 | Gizli; ayrıntıda |
| 4 | Seri no / UUID | 170px / 5, tabular-nums | Gizli; ayrıntıda tam kimlik ve kopyalama |
| 5 | Bölge | 140px / 3 | Gizli; ayrıntıda tam yol |
| 6 | Bağlantı | 132px / 2 | 112px; rozet taşmadan sarabilir |
| 7 | İşlemler | 44px / sabit | 40px; tek menü |

42px masaüstü satır, 36px başlık; zebra yok. Mobilde ad sararsa satır büyüyebilir; 44px dokunma alanları. Yatay kaydırma sayfa düzeyinde gerekmez; ikincil veri kaybolmaz, ayrıntıya taşınır. `#` kolonu kaldırılır. Ürün adını/seri bilgisini ellipsis ile tek başına erişilmez bırakma.

### Durumlar ve metinler

- Bağlantı: `online` → başarı tonu “Çevrimiçi”; `offline` → nötr “Çevrimdışı”; `never` → nötr “Henüz bağlanmadı”. Aktif/pasif ayrı kullanım ayarıdır; bağlantı yerine geçmez. `deviceConnection` ortak hesaplayıcısı korunur.
- Son sinyal: “17.10.2026 14:32 (TR)” veya “Henüz sinyal alınmadı”. Sadece saat gösterilmez. Gateway/bridge zaman alanı ortak bağlantı sözleşmesine göre seçilir.
- Senkron: “2 işlem bekliyor”, “1 işlem başarısız”, “Senkron durumu bilinmiyor — tarama tamamlanamadı”; sıfır kuyruk “Bekleyen işlem yok”, hiçbir zaman kendiliğinden “Her şey eşitlendi” değildir.
- İlk yükleme: başlık/filtre sabit; bölüm iskeleti `role=status`, “Cihazlar yükleniyor”. Hata: “Cihazlar yüklenemedi. Bağlantınızı kontrol edip yeniden deneyin.” + gerçek error-boundary reset; no-op refetch bağlanmaz.
- Proje boş: “Bu projede henüz cihaz yok.” + yetkili kullanıcıya Cihaz ekle. Filtre boş: “Filtrelere uygun cihaz bulunamadı.” + Filtreleri temizle.
- Konum boş: “Henüz bölge yok. Cihazları yerleştirmek için bir bölge ekleyin.”; kapıda okuyucu yoksa “Bu kapıya okuyucu atanmamış.”
- Komut: hedef kapı ve cihaz adıyla onay; pending'de düğme kilitli. Kuyruğa kabul “Komut sıraya alındı; cihaz onayı bekleniyor.”; fiziksel kapı açıldı iddiası yok. Güncel backend onay/komut sınırları korunur.

### Ağaç, diyalog ve formlar

**Konum sheet'i:** 480px, mobil tam genişlik. Bölge başlığı, altında kapılar ve açılan okuyucular; her kapıda sahibi cihazın adı. Tek cihaz birden çok kapıda tekrar yardımcı etiket olarak görünebilir; backend topolojisi değiştirilmez. Seçim yalnız filtreyi etkiler. Bir kapıyı silme engeli yalnız ilgili menüde, neden ve çözümüyle görünür. Okuyucu Düzenle/Taşı mevcut doğrulamalarını korur: ad → yön → IDE kapı sensörü; taşımada kaynak yol → hedef kapı+kapasite → yön → etki özeti. Fiziksel kablolamanın değişmediği açık kalır.

**Cihaz ekle:** Yeni cihaz / Havuzdan ata → nötr marka seçenekleri → tek kolon alanlar → gözden geçirme → Kaydet. Proje üstte salt okunur. Cihaz adı, model/kimlik, bölge, bağlantı, kullanım durumu, isteğe bağlı açıklama sırası. Hata her alanın altında `aria-describedby`; üst hata özeti ilk hataya odak bağlantısı verir. Zod/form isimleri değişmez.

- Hikvision: ad → katalog model → seri → bölge → bağlantı yöntemi. DS-K2804 yerel köprü için IP/sunucu, SDK portu, kullanıcı, şifre; gateway için Ehome ID + şifreleme anahtarı. Katalogdan gerçek “4 kapı · 4 okuyucu oluşturulacak” özeti. `hikTransport` değerleri yalnız `gateway`/`localBridge`; ayrı doğrudan ISAPI transport'u icat edilmez. Elle modelde geçerli kapı sayısı zorunlu.
- IDE Smart: ad → UUID → bölge → kapı sayısı → MQTT kimlik bilgileri; IP ve HTTP portu “İsteğe bağlı LAN bilgileri” ayrıntısında. Kapı sayısı düzenlemede salt okunur. Özet yeni bölge/kapı etkisini açıklar.
- Diğer / QR: ad → seri → cihaz tipi → bölge/kapı → ağ bilgileri → durum. QR kimlik etiketi erişim yetkisi değildir; Sanal Okuyucular ayrı mevcut ekran. Bu görevde gerçek olmayan sanal geçiş endpoint'i veya metrik eklenmez.
- Havuzdan ata: proje → atanabilir cihaz → cihaz adı → mevcut/yeni bölge → kapı özeti → Projeye ata. Aynı bölge/cihaz adı kuralı alan yanında; havuz boşsa “Atanabilecek cihaz yok”.
- Kayıt ve bağlantı aşamaları ayrılır: “Cihaz kaydedildi; bağlantı kurulamadı” halinde mevcut kayıt ID'si korunur, yalnız Bağlantıyı tekrar dene. Mevcut kısmi başarı düzeltmesi korunur.
- Ayarlar dirty kapanışında onay; marka geri dönüşünde taslak; sabit alt eylem alanı. API token yönetimi Ayarlar altında, ilk bakışta açık sır gösterilmez.

### 390px davranışı

Sidebar katmanla açılır; proje seçici görünür. Başlık ve Cihaz ekle gerektiğinde sarar. Sayaçlar iki doğal satır; arama tam genişlik; iki select yan yana sığmazsa sarar. Konum ve ayrıntı sheet'i viewport genişliğindedir, kendi içeriği dikey kayar; kapatma/Escape ve açana odak dönüşü vardır. Mobil tablo yalnız dört temel kolonu gösterir; adlar sarılır. Mockup'ta yerel ekleme, marka dalları, ayrıntı, hedef kapı onayı, konum seçimi, arama/filtre, seçim ve boş sonuç çalışır; kaydetme/komutlar açıkça yerel tasarım önizlemesidir, ağ çağrısı yapmaz.

## Bileşen eşlemesi

| Ortak bileşen | Kullanım / mevcut dosya |
|---|---|
| PageHeader | `DevicesContent`, `DeviceFilters` içindeki başlık ve Cihaz ekle ayrılır. Kullanılmayan `DevicesHeader` yeniden canlandırılmaz. |
| StatInline | `DeviceStats` kart içeriğinin yerini alır; bu sayfa StatCard tüketimini bırakır. |
| FilterBar | `DeviceFilters` mevcut URL/arama mantığı korunur; görünür etiket ve konum yolu eklenir. |
| BulkBar, DataTable | `DeviceBulkActions`, `DeviceList`, `DeviceTableRow`; tek çerçeve, 42px, menü ve mobil öncelikler. |
| StatusBadge | Liste, `DeviceCommandCenter`, `DeviceSyncStatusBanner`, `SyncIssuesBanner` aynı anlam/token seti. |
| EmptyState, SectionSkeleton, ErrorState | Mevcut liste durumları sade kabuğa taşınır; `DeviceListErrorBoundary` korunur. |
| Sheet | `ZoneDoorTreePanel` isteğe bağlı sheet; `ZoneDoorTree` görsel hiyerarşi/satır menüleri. Paylaşılan erişim kontrol ekranıyla aynı değişiklik sahibi atanmalı. |
| Sheet + Dialog | `DeviceDetailsPanel` Genel bakış önceliği; `DeviceCommandCenter` düz bölümler; hedef kapı onayı. |
| Form alanları | `BrandPickerStep`, `DeviceAddMenu`, `DeviceForm`, form-sections, `ClaimDeviceDialog`, `EditReaderDialog`, `MoveReaderDialog`. İsim/değer/API sözleşmesi korunur. |

Bu fazda kaynak dosya silinmedi. Kullanılmayan eski `form-fields/*` temizliği uygulama fazında import doğrulaması sonrası ayrı iş; görsel yenileme için zorunlu değil.

## Veri eşlemesi ve backend gereksinimi

Mockup örnek kayıtları sentetiktir; canlı proje durumunu temsil etmez. Ad, marka, model, seri/UUID, bölge ve bağlantı mevcut `devices.list` + `deviceConnection` alanlarıdır; bölge/kapı/okuyucu mevcut `useZonesAndDoors`/ağaç sorgularıdır. Ayrıntıdaki IP/transport/son sinyal ve kuyruk sayıları `convex/deviceCenter.ts:185–269` içindeki mevcut `device`, `doors`, `readers`, `queues` alanlarını temsil eder; kuyruklar sınırlı örneklem olduğunda “yüklenen” kapsam etiketi korunmalıdır. Hik model/otomatik okuyucu sayısı `convex/lib/hikModels.ts:35` kataloğundan gelir. Sahte sağlık yüzdesi veya yeni telemetri yok.

**Zorunlu yeni backend alanı yok.** Listeye cihaz bazında senkron rozet/sayısı ileride eklenirse her satıra ayrı overview sorgusu yapılmamalı; proje kapsamlı toplu özet sorgusu gerekir (bu mockup'ta yok). Gerçek sunucu sayfalaması/arama toplamları için `devices.list` sözleşmesi ayrıca tasarlanmalı; yerel sayfa boyutu bunu çözmüş sayılmaz. Komut ACK durumu ile kapının fiziksel açılışı farklıdır; doğrulanabilir sensör/operasyon izlemesi ürün tarafından istenirse ayrıca backend işi.

## Açık sorular

1. Cihaz ayrıntısı varsayılanı Genel bakış; operasyon ekibi için Ayarlar'a doğrudan açan menü yeterli mi?
2. Kalıcı ağaç yerine konum sheet'i seçildi; yoğun kurulum yapan operatörler için sonradan sabitlenebilir ağaç modu gerekli mi?
3. QR/sanal okuyucu eklemesi mevcut Diğer kolunda mı kalacak, ayrı Sanal Okuyucular sayfasından mı başlatılacak? Mockup mevcut Diğer kolunu ve ayrı sayfa sınırını korur.

## Uygulama tahmini ve risk

**L · 18–26 saat**, ortak A2 kabuk/bileşenleri hazır varsayımıyla: liste/filtre/sayaç 4–6s, konum sheet'i 4–6s, marka formları ve ayrıntı 6–8s, erişilebilirlik/mobil/regresyon 4–6s. Sunucu sayfalama ve donanım ACK değişiklikleri dahil değil. Riskler paylaşılan ZoneDoorTree dosya sahipliği, marka ve modelin topoloji etkisi, admin/izleyici eylem görünürlüğü, kısmi kayıt başarısı ve dirty kapanış yönetimidir. Rol bazlı backend yetkileri görsel yenilemede genişletilmez.

## Doğrulama

Yerel `file://` dosyası kurulu Playwright kitaplığı + sistem Chrome ile açıldı (CLI file protokolünü engelledi; paket indirilmedi). 1440×900 ve 390×844 görselleri incelendi; ek ölçümde 1440 ve 390 genişliklerin ikisinde de `documentElement.scrollWidth === innerWidth`, 390px tabloda genişlik 356px, ekleme sheet'inde iç genişlik/scroll genişliği 388/388px. Konsol/pageerror: **0**; HTTP(S) istek: **0**.

Arama ve boş sonuç; filtre temizleme; tümünü seç ve filtre değişiminde seçim kesişimi; kapı seçimiyle bağlı cihaz; Hikvision gateway/köprü ve IDE/QR alanları; marka geri dönüşünde taslak; dirty kapanış onayı; mobil menü/Escape; ayrıntı sekmeleri ve hedef kapı onayı doğrulandı. Python `html.parser` yığın denetimi: **0 dengesiz etiket, 0 yinelenen ID**. 18 bulgunun tümünde kaynak kanıtı bulunuyor; kısaltılmış `:satır` referansları aynı hücredeki son tam yolu devam ettirir. Uygulama kaynakları değişmediğinden uygulama lint/build çalıştırılmadı.

Görsel kanıtlar: [1440px liste](desktop.png), [390px liste](mobile.png), [cihaz ayrıntısı](detail.png), [390px ekleme](add-mobile.png), [390px konum ağacı](location-mobile.png). Ana teslim: [mockup.html](mockup.html).
