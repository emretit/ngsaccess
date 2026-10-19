# 04 · Sanal Okuyucular — A2 UI taraması

## Özet
Sanal Okuyucular sayfasının amacı telefonla QR okutulan giriş noktalarını ve bunların kapı bağlantısını yönetmektir. En büyük üç sorun üretim verisi yerine altı sabit örneğin gösterilmesi, QR yükünün mevcut check-in sözleşmeleriyle uyuşmaması ve oluşturma/kapı eşleme/son okutma yönetiminin bulunmamasıdır. Öneri A2 kabuğunda proje kapsamlı sade bir tablo, okuyucu oluşturma diyaloğu ve QR ile son okutmalara odaklanan okuyucu ayrıntısıdır.

## Kapsam ve kaynak gerçeği

17.10.2026 güncel çalışma ağacı, commit edilmemiş değişikliklerle birlikte esas alındı; kaynak kod değiştirilmedi. `04-sanal-okuyucular.png`, `04-sanal-okuyucular-mobil.png`, `04-sanal-okuyucular-mobil-2.png` açılarak incelendi; masaüstü `04-sanal-okuyucular-2.png` yok. Mobil görsellerde eski açık sidebar içeriği sıkıştırıyor; bu gözlem güncel kabuğun çalışma zamanı hatası olarak ileri sürülmüyor. Canlı uygulama, DB veya dış servis kullanılmadı.

A2 referanslarının CSS'i, class adları ve kabuğu mockup'a aynen kopyalandı; sayfaya özgü kurallar sonuna eklendi. Cihazlar taramasındaki (`../03-cihazlar/REPORT.md`) 42px tablo, ad düğmesiyle ayrıntı, tek satır işlem menüsü, kartsız sayaç ve mobil ikincil kolonları ayrıntıya taşıma kararları korundu. Bu teslim hedef tasarımdır: sanal okuyucu envanteri bugün mevcut değildir; örnek satırlar canlı kayıt değildir.

### Önceki audit ile uzlaştırma

| Önceki bulgu | Güncel kaynak sonucu |
|---|---|
| DEV-27: QR indirme ve IDE kimliği | Çözülmüş: SVG serialization/Blob indirme ve `deviceSerial` → `ideUuid` fallback var (`src/components/devices/useQRCodeDialog.tsx:9`, `:19`); QR amacı açık (`src/components/devices/QRCodeDialog.tsx:35`). Yeniden açık bulgu sayılmadı. |
| DEV-28: sabit sanal envanter | Açık; aşağıdaki VRD-UI-01–06 hedef yeteneği somutlaştırır. |
| DEV-29: fare, pending, toast | Açık; VRD-UI-07–09. |
| SHL-25: konum doğrulaması iddiası | Çözülmüş: “Konum bilgisi kayda eklendi”, `locationRecorded` kontrolü var (`src/pages/CheckIn.tsx:98`). |
| SHL-26: token süresi/GPS/idempotency/ISO zaman | Ana düzeltmeler var: 60 saniye token (`convex/lib/checkInUx.ts:9`), 3 saniye konum bütçesi, ayrı fazlar, İstanbul zamanı (`src/pages/CheckIn.tsx:41`, `:55`, `:65`), tüketilmiş tokena aynı zamanla başarı (`convex/employeeCheckIn.ts:59`). Kalan sonuç mesajı sorunları VRD-UI-15–16; eski 10 saniye/5 saniye iddiası tekrarlanmadı. |

### Birbirine karıştırılmaması gereken üç QR akışı

| Akış | Mevcut sözleşme | Tasarımdaki sınır |
|---|---|---|
| Cihaz kimlik etiketi | QR yalnız seri/UUID taşır; `QRCodeDialog.tsx:35–38`. | 03 Cihazlar'da kalır; geçiş QR'ı diye yeniden etiketlenmez. |
| Çalışanın ürettiği token → web sonuç sayfası | `createMyCheckInToken` çalışan tokenı üretir; `/check-in?token=…` tüketir; `employeeCheckIn.ts:10`, `:34`. Kapı/okuyucu bağı yok. | Kişisel token yazdırılmaz; mevcut CheckIn akışı korunur, kapının açıldığı iddia edilmez. |
| Telefonda bir giriş noktası QR'ını tarama | Mobil parser JSON/base64 içindeki `deviceId` bekler (`mobile/lib/models/qr_code_model.dart:78`); `cardReadings.selfCheckIn` cihazı bulur ve erişim gruplarına göre kayıt yazar (`convex/cardReadings.ts:1198`). | Sanal okuyucu hedefinin başlangıç yönü bu; okuyucu/kapı ve yenileme için ek sözleşme gerekir. Mevcut `VR-001` payload'ı bunların hiçbiri değildir. |

## Mevcut durum taraması

| ID | Kategori | Bulgu ve kanıt | Etki | Öneri |
|---|---|---|---|---|
| VRD-UI-01 | Durumlar: boş-yükleniyor-hata | Altı sabit örnek tüm projelerde aynı; query/proje bağı yok. `src/pages/VirtualReaders.tsx:5`, `:29`. | Yüksek | Üretim görünümünden örnekleri çıkar; backend hazır değilken açık “Sanal okuyucular henüz kullanıma açılmadı” durumu. Hedefte proje kapsamlı gerçek liste. |
| VRD-UI-02 | Bileşen tutarlılığı | QR `value={id}` ile VR-001 üretir, tıklama her satırda varsayılan VQR-001 ile `/api/check-access` çağırır. `src/components/devices/VirtualReader.tsx:18`, `:22`, `:57`; repository handler taramasında yalnız bu çağrı bulundu; dış yönlendirme doğrulanmadı. | Yüksek | Tek QR sözleşmesi; gerçek çalışan oturumu ve giriş noktası doğrulaması. Kart tıklaması hiçbir giriş kaydı oluşturmasın. |
| VRD-UI-03 | Yerleşim | Kart yalnız etiketi gösterir; proje, kapı ve yön görünmez. `src/components/devices/VirtualReader.tsx:63`; gerçek `readers` modeli kapı/yön içerir (`convex/schema.ts:248`). | Yüksek | Ad, bağlı kapı, bölge, yön ve kullanım durumu; kapı adı ayrıntıda tam yoluyla. |
| VRD-UI-04 | Form-diyalog | Sayfada oluşturma, düzenleme veya pasifleştirme kontrolü yok; yalnız örnekleri map eder. `src/pages/VirtualReaders.tsx:14–37`. | Yüksek | Tek “Sanal okuyucu ekle” CTA ve ad→bölge→kapı→yön formu; yeni sanal türü ve yetkili mutation önce tamamlanmalı. |
| VRD-UI-05 | Bileşen tutarlılığı | Sanal QR yalnız kartta 128px gösterilir; büyütme/yazdırma/yenileme eylemi yok. `src/components/devices/VirtualReader.tsx:17`, `:49–67`. Cihaz kimlik QR indirmesi başka akıştır. | Yüksek | Okuyucu ayrıntısında büyük QR, kapı/yön başlığı, baskı önizlemesi; yenilemede eski çıktının etkisini açıklayan onay. |
| VRD-UI-06 | Görsel hiyerarşi | Son okutmalar yok; token kaydı `deviceId`, kapı veya okuyucu yazmıyor (`convex/employeeCheckIn.ts:70`), mobil akış cihaz düzeyinde (`convex/cardReadings.ts:1254`). | Yüksek | Okuyucuya doğru bağlanabilen kayıt sorgusu tamamlanınca son 10 okutma; cihaz/proje kayıtlarını okuyucununmuş gibi gösterme. |
| VRD-UI-07 | Erişilebilirlik | Etkileşim `CardContent` div'inin `onClick`'inde; button, klavye aktivasyonu veya erişilebilir eylem adı yok. `src/components/devices/VirtualReader.tsx:51–54`. | Yüksek | Adı açıklayıcı native button ile ayrıntı; satır menüsü Türkçe accessible name; QR dekorasyonu ayrı. |
| VRD-UI-08 | Durumlar: boş-yükleniyor-hata | Async çağrının pending/disabled/tek istek kilidi yok. `src/components/devices/VirtualReader.tsx:20–47`. | Orta | Simülasyon üretimden kalksın; gerçek kaydet/yenile eylemlerinde pending ve çift gönderim engeli. |
| VRD-UI-09 | Durumlar: boş-yükleniyor-hata | Sonuç yalnız kısa toast; hata nedeni genel, kalıcı sonuç/sonuç zamanı yok; tarih tarayıcı locale'ine bağlı. `src/components/devices/VirtualReader.tsx:38–45`. | Orta | Sonuç ilgili bölümde aria-live; bilinmeyen sonucu başarı/ret sayma; İstanbul tarih/saat biçimi. |
| VRD-UI-10 | Mikro-metin | Başlık, açıklama ve altı yer adı İngilizce; “simulate” ana üretim menüsünün anlamıyla çelişiyor. `src/pages/VirtualReaders.tsx:6–11`, `:19–23`; masaüstü başlık. | Orta | “Sanal Okuyucular”, “Telefonla QR okutulan giriş noktaları”; simülasyon varsa ayrı açık demo sınırı. |
| VRD-UI-11 | AI arayüzü izi | Başlık kartı + altı QR kartı, iç QR gölgesi ve hover shadow hiyerarşiyi yüzey tekrarına taşıyor. `src/pages/VirtualReaders.tsx:17`, `:28`; `src/components/devices/VirtualReader.tsx:50–55`. | Orta | Tek h1, çizgisiz sayaçlar, 42px tablo; QR yalnız ayrıntıda. |
| VRD-UI-12 | Responsive | Mevcut mobil görüntülerde kalıcı açık sidebar başlığı kelime kelime böler; QR kendi kartından taşar. `04-sanal-okuyucular-mobil.png` başlık/ilk kart, `-mobil-2.png` QR kenarları; sabit QR boyutu `VirtualReader.tsx:17`. Bu görsel eski kabuk kanıtıdır. | Yüksek | A2 overlay menü; 390px'te ad+kapı/rozet/işlem, QR `max-width:100%`; güncel uygulamada ayrıca yeniden ölç. |
| VRD-UI-13 | Yerleşim | Liste arama/durum/kapı filtresi sağlamıyor; tüm örnek QR'lar eşit görsel ağırlıkta. `src/pages/VirtualReaders.tsx:28–35`. | Orta | Ad/kapı araması, Durum ve Kapı filtreleri; filtre sonucu sayısı, “Filtreleri temizle”. |
| VRD-UI-14 | Bileşen tutarlılığı | Gerçek reader CRUD fiziksel kapasiteye göre sınırlar; sanal tür ayrımı şemada yok. `convex/readers.ts:131–145`, `convex/schema.ts:248–270`. Dolayısıyla mevcut create'i bağlamak tek başına sanal okuyucu oluşturmaz. | Yüksek | Tür sözleşmesi ve sanal kapasite kuralı backend işi; aynı fiziksel okuyucuları ikinci envanterde çoğaltma. |
| VRD-UI-15 | Mikro-metin | Ağ belirsizliğinde mesaj “Yeni kod taramadan önce ... kaydı kontrol edin” der; ortak error alt metni yine yeni QR taramayı emreder. `src/pages/CheckIn.tsx:73`, `:110`. | Yüksek | `unknownResult` ile expired/invalid ayrımı; yalnız geçersiz/süresi dolan kodda yeni tarama, belirsizde kayıt kontrolü. |
| VRD-UI-16 | Durumlar: boş-yükleniyor-hata | İdempotent başarı `locationRecorded` döndürmez (`convex/employeeCheckIn.ts:59–64`); frontend false sayar (`src/pages/CheckIn.tsx:63`), tekrar açılışta GPS alınamazsa “Konum bilgisi eklenemedi” yazar (`:87`) ve önceki kaydın konumunu yanlış anlatabilir. | Orta | Aynı kaydın konum sonucunu saklayıp geri döndür; tekrar tüketimde yeni GPS alma. Alan yoksa “Konum durumu bilinmiyor”; önceki kaydın sonucunu tahmin etme. |

## Yeni tasarım

### Bilgi mimarisi

1. Referans A2 kabuğu: 216px bordo sidebar, 13 menü aynı sırada, Sanal Okuyucular aktif; üst barda proje seçimi her genişlikte görünür.
2. `PageHeader`: “Sanal Okuyucular”; “Merkez Ofis · Telefonla QR okutulan giriş noktaları”; tek birincil “Sanal okuyucu ekle”.
3. `StatInline`: Toplam 6 · Aktif 5 · Pasif 1; yalnız örnek satır sayılarından. Gerçekte filtrelerden bağımsız aynı proje paydası; yüklenirken sıfır yok, sanal tür tanımlanmadan fiziksel reader toplamını kullanma.
4. `FilterBar`: “Okuyucu veya kapı ara…” + “Durum: Tümü” + “Kapı: Tümü” + temizle; sağda 25/50/100 sayfa boyutu. Filtreler aktif projeye bağlı; proje değişince seçim, ayrıntı ve filtre sıfırlanır. Tablo altında gösterilen/sonuç sayısı.
5. Tam genişlik tek tablo. Toplu işlem ilk sürümde yok; bağlamı farklı kapılarda yanlış QR yenilemeyi kolaylaştıracak checkbox eklenmez.
6. Ad düğmesi veya tek ⋯ menüsünden “QR ve ayrıntılar”; menüde ayrıca “Düzenle”. Ayrıntı: ad, Aktif/Pasif, bölge/kapı/yön, QR, Yazdır/QR yenile, sonra son 10 okutma. QR gösterimi kayıt oluşturmaz.

### Kolon sözleşmesi

| Sıra | Kolon | Genişlik / öncelik | 390px |
|---|---|---|---|
| 1 | Okuyucu adı | kalan alan, en az 180px / 1 | ad ve altında kapı; satır doğal büyür |
| 2 | Bağlı kapı | 180px / 2 | ayrı kolon gizli; adın altında korunur |
| 3 | Bölge | 140px / 4 | gizli, ayrıntıda |
| 4 | Yön | 90px / 3 | gizli, ayrıntıda |
| 5 | Kullanım durumu | 100px / 2 | 70px; Aktif/Pasif |
| 6 | İşlemler | 44px / sabit | 44px dokunma alanı |

Masaüstü 42px satır/36px başlık; normal adlar bir satır, uzun ad sarar; zebra ve kalıcı QR küçük resimleri yok. Son okutma listeye ayrıca kolon yapılmaz; ayrıntıda kişi, İstanbul zamanı, sonuç ve varsa yön görünür. Mobilde ayrıntı 100%−32px genişliğinde, 90dvh içinde kaydırılır; alanlar tek sütun, eylemler sarılır. Bölge/kapı/yön ayrıntıda tam yazılır; belge yatay taşmaz.

### Rozetler ve durum metinleri

- `readers.status=active` → **Aktif**, success; `inactive` → **Pasif**, nötr. Eksik/tanınmayan değer → **Belirtilmedi**, nötr; aktif sayılmaz. “Çevrimiçi” sanal okuyucuya uydurulmaz.
- `direction`: entry → Giriş; exit → Çıkış; both → Giriş / çıkış. İki yönlü noktada okutmanın gerçek yönü sunucu politikasıyla belirlenir; admin seçiminden son olaya yön uydurulmaz.
- Okutma sonucu `izin_verildi` → **İzin verildi**, success; `reddedildi` → **Reddedildi**, danger; eksik → **Sonuç bilinmiyor**. Bu rozet kapının fiziksel açıldığı anlamına gelmez.
- Boş proje: “Bu projede henüz sanal okuyucu yok. Telefonla QR okutulacak bir giriş noktası ekleyin.” + yetkiliye Ekle.
- Filtre boş: “Okuyucu bulunamadı. Aramanızı veya filtreleri değiştirin.” + Filtreleri temizle.
- Proje seçilmemiş: “Sanal okuyucuları görmek için bir proje seçin.”; yetki yoksa ayrı erişim durumu, ekleme yok.
- Yükleme: “Sanal okuyucular yükleniyor…” + `role=status` bölüm iskeleti; kabuk kalır. Hata: “Sanal okuyucular yüklenemedi. Bağlantınızı kontrol edip yeniden deneyin.” + gerçek query boundary reset.
- Okutma boş: “Henüz okutma yok.”; sorgu hazır değil/hata verirse bu metni kullanma. “Son okutmalar yüklenemedi.” + Yeniden dene.
- QR yok/yüklenemedi: “QR kod görüntülenemedi.” + Yeniden dene; yazdır kapalı. Pasif: “Bu okuyucu pasif. Giriş kaydı almak için okuyucuyu etkinleştirin.”; etkinlik sunucuda da uygulanmadan bu vaat yayımlanmaz.

### Oluşturma ve düzenleme

480px Dialog; mobil 358px. Alan sırası: proje bağlamı salt okunur → Okuyucu adı (zorunlu) → Bölge filtresi → Bağlı kapı (zorunlu) → Yön (zorunlu) → kullanım durumu (oluştururken Aktif varsayılanı, düzenlemede mevcut). Bölge kapı listesini daraltır, kayıtta doğrulanmış kapıdan türetilir; iki ayrı çelişkili konum yazılmaz. Bölge değişince kapı sıfırlanır.

Hatalar ilgili alan altında ve `aria-describedby` ile: “Okuyucu adını girin.”, “Bu projeden bir kapı seçin.”, “Bir yön seçin.”; submit ilk hataya odaklanır. Kapı yoksa “Bu bölgede kapı yok. Önce Cihazlar'dan kapı ekleyin.”; yanlış projedeki kapı sunucuda reddedilir. Kapı taşıma/düzenleme, eski asılı QR'ın konum metnini değiştireceği için “Kapı değiştiğinde basılı etiketleri güncelleyin” açıklaması gerekir. İptal ve Oluştur/Kaydet; pending tek işlem, hata formu korur, dirty kapatmada bırak/dön onayı. Başarı gerçek mutation sonucu sonrası, yeni kaydın ayrıntısı açılır. Mockup submit'i yalnız önizleme bildirimi verir, kayıt eklemez.

### QR ayrıntısı, baskı ve yenileme

QR alanı 224px, beyaz yüzey, yeterli boş kenar; “Mobil uygulamada QR tara bölümünü açın” talimatı; üstünde okuyucu adı ve kapı/yön. Örnek mockup QR'ı taranabilir credential değildir ve görünür biçimde “Tasarım örneği · taranamaz” der. Başarılı baskı/yenileme toast'ı taklit edilmez.

Yazdır: önce başlık + proje/bölge/kapı/yön + QR içeren A4 baskı önizlemesi; baskı CSS'i kabuğu, son okutma listesini ve aksiyonları saklar. Tarayıcı yazdırma diyaloğunu açma eylemi fiziksel çıktının alındığını kanıtlamaz. Kişisel 60 saniyelik check-in tokenı bu postere konmaz.

Yenile: “QR kodu yenilensin mi?”; hedef okuyucu adı ve “Eski QR koduyla okutma yapılamayacak. Asılı çıktıları yenisiyle değiştirin.”; İptal / QR kodu yenile. Bu geçersizleştirme **önerilen backend sözleşmesidir**, mevcut seri/UUID QR'ını tekrar render etmek yenileme değildir. Yeni QR gelene kadar eski görüntü ve pending bilgi korunur; hata halinde geçersizleştirme sonucunun belirsiz olup olmadığı sorgulanır. Mockup onayı yalnız önerinin açıklamasını gösterir; çalışır yenileme iddiası yok.

### CheckIn sonuç ekranı

Ayrı public akış; yönetici sidebar'ı eklenmez. 24px “QR ile giriş”; fazlar “Konum bilgisi bekleniyor…” → “Giriş kaydediliyor…”; sonuçta kişi ve `17.10.2026 09:12` (Europe/Istanbul). Konum metni kayıt bilgisidir, mesafe doğrulaması değildir. `expired/invalid` için yeni QR talimatı; `unknownResult` için “Giriş sonucu alınamadı. Yeni kod taramadan önce mobil uygulamadaki kaydı kontrol edin.” ve ikinci çelişkili talimat yok. Tamamlanmış token için aynı kaydın bilgisi gösterilir; yeni GPS alınmaz. Ürün dağıtım URL'si bilinmediği için çalışmayan “Uygulamayı aç” bağlantısı eklenmez.

## Bileşen eşlemesi

| Ortak bileşen | Yer / kaynak etkisi |
|---|---|
| PageHeader, StatInline | `src/pages/VirtualReaders.tsx` başlık kartını ve sampleReaders dizisini kaldırır; gerçek query entegrasyonu sonrası sayaçlar. |
| FilterBar, DataTable, StatusBadge | Aynı sayfanın grid'i yerine; `VirtualReader.tsx` mevcut simülasyon bileşeni yalnız bu sayfada import ediliyor, yeni ayrıntı bileşeni hazır olduğunda silinebilir. |
| EmptyState, ErrorState, SectionSkeleton | Sayfa listesi ile ayrıntının QR/okutma bölümleri ayrı yükleme/hata sınırları. |
| BulkBar | İlk sürümde kullanılmaz; checkbox/varsayımsal toplu API yok. |
| Dialog + Form alanları | Önerilen VirtualReaderFormDialog; `z.infer` form tipi, camelCase domain payload. |
| Dialog/Sheet | Önerilen VirtualReaderDetails; mobil aynı bilgi sırası, keyboard focus trap/geri dönüş, Escape. Ad/işlem menüsünden açılır. |
| QR sunumu | `QRCodeDialog.tsx` ve `useQRCodeDialog.tsx` cihaz kimlik sözleşmesini korur; yalnız görsel QR frame/export helper ortaklaştırılabilir, credential/payload ortaklaştırılmaz. |
| Durum içeriği | `src/pages/CheckIn.tsx` discriminated durumlar; success tokenları, `aria-live`; konum sonucu backend ile aynı kayıt üstünden. |

Bu fazda kaynak dosya silinmedi/değiştirilmedi. Kabuk 03 ile aynı ortak implementasyonun tüketicisi olmalı; ayrı sidebar geliştirilmemeli.

## Veri eşlemesi ve backend gereksinimi

| Mockup alanı | Mevcut veri | Gereken ek çalışma |
|---|---|---|
| Ad, kapı, bölge, yön, Aktif/Pasif | `readers.name/doorId/zoneId/direction/status`; `doors.name/zoneId`; `zones.name` | Alanlar mevcut; sanal tür seçimi mevcut değil. Türü belirlenen gerçek liste ve kapı adlarını birleştiren proje kapsamlı sorgu. |
| Toplam/Aktif/Pasif | Doğrulanmış sanal liste üzerinden türetilebilir | Sayfalama varsa tüm proje toplamını tek sayfa uzunluğu sanma; ayrı aynı kapsamlı sayaç/aggregate. |
| QR göster/yazdır/yenile | Mevcut reader üzerinde QR token/version yok | Sunucuda giriş noktası tanımı, geçerli QR kimliği/sürümü, iptal/yenile, pasifleştirme ve mobil çözümleme sözleşmesi. Önerilen yeni alanlar camelCase; kesin isim ürün/backend tasarımında. |
| Kişi/zaman/sonuç/yön | `cardReadings.employeeName/accessTime/accessStatus/direction` | Kayıtta sanal reader ilişkisi yok; güvenilir `readerId` veya eşdeğer normalize ilişki + proje/okuyucu/zaman indeksi ve bounded son 10 sorgusu. Eski cihaz kayıtlarını sessizce okuyucuya atama. |
| Yeniden açılan check-in konumu | `checkInTokens.usedAt`; ilk sonucun locationRecorded bilgisi saklanmıyor | Tamamlanan sonucun konum durumu veya reading referansı; aynı sonucu tekrar döndürme. |

**B1 — Envanter:** Mevcut `readers` fiziksel kapı kapasitesine tabidir; sanal tür/discriminator veya ayrı tablo kararından önce UI create'i `readers.create`'e doğrudan bağlama. Proje yetkisi, kapı sahibi, durum doğrulama ve sanal kapasite kuralı birlikte tasarlanmalı.

**B2 — QR sözleşmesi:** Statik cihaz kimliği, kişisel token ve giriş noktası QR'ı farklıdır. Yeni tarama sunucuda gerçek çalışan oturumuyla okuyucu/kapı/aktiflik/erişim kuralını doğrulamalı; dönen sonuç kayıt mı, erişim kararı mı açık olmalı. Fiziksel kapı açma bu tasarımda taahhüt edilmez. Mobil parser ve selfCheckIn entegrasyonu bu işin bağımlılığıdır; mevcut web dosyasına sadece URL basmak yeterli değildir.

**B3 — Sonuç doğruluğu:** Yenileme eski kodu gerçekten iptal etmeli; eşzamanlı okutma ve tekrar isteği için tek sonuç semantiği gerekli. Son okutmalar doğru reader'a bağlanmalı, veri yok/bağ yok/hata ayrılmalı. Token tüketimi konum sonucunu idempotent döndürmeli.

Backend bitene kadar üretimde hedef listeyi sabit verilerle yayımlama; “Henüz kullanıma açılmadı” durumu ve ürünce seçilen doğru yönlendirme kullan. Mockup salt tasarım incelemesidir.

## Açık sorular (4)

1. Sanal okuyucu mevcut readers üzerinde ayrı tür mü, fiziksel kapasiteden bağımsız ayrı giriş noktası mı olacak? 03 Cihazlar'daki Diğer kolu yalnız fiziksel QR cihazına mı ayrılacak? Öneri: sanal oluşturma yalnız bu sayfada.
2. Hedef tarama telefondan asılı giriş noktası QR'ını okumak mı, telefondaki kişisel QR'ı bir okuyucuya göstermek mi? Mockup ilkini tasarlar; mevcut kişisel token ayrı kalır.
3. Asılabilir kalıcı QR mı, süreli ekran QR'ı mı gerekiyor; yenileme eski baskıları derhal iptal edecek mi? Önerilen poster/iptal davranışı bu karara bağlı.
4. İşlem yalnız PDKS/erişim kaydı mı oluşturacak, fiziksel kapı da açacak mı? Mockup yalnız kayıt/erişim sonucunu gösterir; kapı açma entegrasyonu ayrıca kapsamlanmalıdır.

## Uygulama tahmini

**L · 32–48 saat**, ortak A2 kabuk hazır varsayımıyla: liste/filtre/durum 5–7s, oluşturma/düzenleme 5–7s, QR ayrıntı/baskı/yenileme 5–7s, envanter ve QR backend/mobil sözleşmesi 10–16s, sonuç doğruluğu/mobil/klavye/regresyon 7–11s. Yeni donanım kapı açma, konum doğrulama politikası ve ayrı kapsamlı mobil yeniden tasarım dahil değil. Riskler: sanal-fiziksel model kararı, eski asılı QR'ın geçerliliği, aynı tokenın yeniden tüketimi, geçmiş kayıtların okuyucuyla eşlenememesi ve ortak Cihazlar dosyalarının sahipliği.

## Doğrulama

Kurulu Playwright kitaplığı + sistem Chrome ile yerel `file://` mockup açıldı; paket indirilmedi. 1440×900 ve 390×844 görselleri açılıp incelendi. Her iki genişlikte `documentElement.scrollWidth === innerWidth`; 390px oluşturma ve ayrıntı diyalogları `clientWidth/scrollWidth = 356/356`. Konsol/pageerror **0**, HTTP(S) istek **0**. Örnek QR credential değildir.

Arama/boş sonuç/temizleme, durum ve kapı filtreleri, satır menüsü, QR ayrıntısı, pasifte yazdırma/yenileme engeli, son okutma boşluğu, zorunlu alan hataları ve ilk hataya odak, hata düzeltildiğinde mesajın kalkması, bölge değişiminde kapı sıfırlama, dirty kapanış/dön/bırak, önizleme submit mesajı, yenilemenin gerçek işlem yapmadığı bildirimi, baskı CSS'i, mobil menü/inert/Escape ve odağın geri gelmesi kontrol edildi. Baskı medya önizlemesinde kabuk ve son okutmalar gizleniyor; gerçek yazıcı/QR çözümleme veya backend çağrısı yapılmadı.

Python `html.parser` yığın denetimi: **0 dengesiz etiket, 0 yinelenen ID**. A2 `people.html` özgün CSS bloğunun mockup içinde değişmeden bulunduğu doğrulandı. 16 bulgunun her birinde dosya/satır veya görüntü bölgesi kanıtı var; kısaltılmış `:satır` aynı hücredeki son tam yolu sürdürür. Uygulama kaynakları değişmediği için uygulama lint/build çalıştırılmadı.

Teslimler: [mockup.html](mockup.html), [1440px liste](desktop.png), [390px liste](mobile.png), [ayrıntı](detail.png), [390px ayrıntı](detail-mobile.png), [390px oluşturma](create-mobile.png), [baskı önizlemesi](print.png).
