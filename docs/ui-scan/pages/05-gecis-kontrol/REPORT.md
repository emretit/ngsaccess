# 05 · Geçiş Kontrol

## Özet
Geçiş Kontrol, seçili projede kişilerin hangi kapılardan hangi gün ve saatlerde geçebileceğini yönetir. En büyük üç sorun mobil kabuğun içerik alanını daraltması, kural formunda kim → nereye → ne zaman karar sırasının kaybolması ve cihazlara gönderme kapsamı ile sonucunun yeterince görünür olmamasıdır. Öneri, A2 tablosu üzerinde kısa kapsam özetleri, üç adımlı ama düzenlemede doğrudan gezilebilir bir editör ve kayıt sonucundan ayrılmış kalıcı cihaz geri bildirimidir.

## Kapsam ve kanıt sınırı

17.10.2026 tarihli çalışma ağacı esas alındı; commit edilmemiş Dalga 3a dosyaları dahildir. `05-gecis-kontrol.png`, `05-gecis-kontrol-mobil.png`, `05-gecis-kontrol-mobil-2.png` açılarak incelendi; masaüstü `-2.png` yoktur. Ekrandaki **“Erişim kuralları yüklenemedi”**, görev bilgisinde belirtilen deploy edilmemiş `accessRules.listSummaries` nedeniyle oluşmuştur; bunu ürünün sorgu hatası olarak sınıflandırmıyorum. Liste/form değerlendirmeleri güncel kaynak incelemesine, kabuk ve hata görünümü bulguları görüntülere dayanır; gerçek cihaz, canlı veri ve çalışan form denenmedi.

Referans CSS, `directions/A2-sade-bordo-sidebar/people.html` içinden aynen alınmıştır (home.html de incelendi); mockup kabuğu, `.sidebar`, `.topbar`, `.filters`, `.table-section`, `.people-table`, `.badge` sınıflarını korur. Yeni yerleşim kuralları yalnız bu sayfanın editörü, tablosu ve durum şeridine eklenmiştir. Örnek kişi/kural/kapı adları temsilidir; veri alanları aşağıdaki gerçek kaynaklardan gelir.

### Eski audit ile uzlaştırma

- ACC-01/02: saat temizleme `null`, kullanılan Zod şeması, gün ve saat hataları, eksik plan metni mevcut (`useRuleForm.ts:90,110,124`; `TimeSchedule.tsx:24`; `AccessRulesList.tsx:156`). Eski hata tekrarlanmadı.
- ACC-03: gerçek pending ve çift submit kilidi mevcut (`CreateRuleDialog.tsx:37`; `useComplexAccessRuleMutations.ts:57`). Yeni öneri bunları korur.
- ACC-04/09: ziyaretçi üyelikleri korunuyor, sıfır öncelik `??` ile tutuluyor (`useRuleForm.ts:62,70,111`; `CreateRuleDialog.tsx:85`). Açık kalan türün görünürlüğü ayrı bulgudur.
- ACC-05/06/08: kapı/panel ayrımı, alt departman seçimi, kısmi checkbox, arama, ikon adları ve tek Collapsible mevcut (`AccessRulesList.tsx:84,174`; `DepartmentTree.tsx:69,125,211`; `ZoneDeviceTree.tsx:129,183`). Bunların yokluğunu iddia etmiyorum.
- ACC-07: sayfalı özet/lazy detay liste içinde çözülmüş (`AccessRulesList.tsx:198,240`); sayfa üstündeki legacy sorgu kalıntısı ACC-UI-05'te ayrıca gösterildi.

## Mevcut durum taraması

Kısa kaynak kökü: **U/** = `src/components/access-control/unified/`. Satırlar inceleme anındaki çalışma ağacınındır.

| ID | Kategori | Kanıt | Bulgu / etki | Öneri |
|---|---|---|---|---|
| ACC-UI-01 | Responsive | `05-gecis-kontrol-mobil.png`, sol kabuk ve sağda kesilen gönder düğmesi; `-mobil-2.png`, çok satıra bölünen hata | **Yüksek:** mobil görüntüde kalıcı sidebar içeriği çok dar bırakıyor; işlem metni kesiliyor. Görüntü ölçeğinden CSS piksel genişliği çıkarılmadı. | A2 menü katmanı; 390px'te içerik tam genişlik, 16px kenar, proje seçici görünür. Ortak kabuk sahibine aktar. |
| ACC-UI-02 | Görsel hiyerarşi | `src/pages/AccessControl.tsx:20`; `U/AccessRulesList.tsx:348`; masaüstü üst bölüm | **Orta:** sayfa başlığı breadcrumb/üst çubukta, ana yüzey yalnız “Erişim kuralları” h2; proje kapsamı başlık altında görünmüyor. | Tek h1 “Geçiş Kontrol”, “Merkez Ofis · Erişim kuralları”; sağda tek Yeni kural. |
| ACC-UI-03 | AI arayüzü izi / yerleşim | `U/AccessRulesList.tsx:85,86,147,348` | **Orta:** çerçeveli filtre kartı ve her kural için büyük başlıklı kart, karşılaştırmayı düşey taramaya çeviriyor. Liste görüntüde yok; koddan çıkarım. | 42px satırlı A2 tablo; uzun ilişkileri ayrıntıda göster, kart içinde kart üretme. |
| ACC-UI-04 | Durumlar: hata / renk-kontrast | `src/components/shared/ErrorState.tsx:24,29,32`; masaüstü hata bölgesi | **Orta:** 64px renkli ikon dairesi ve ortalanmış geniş boşluk hatayı sayfanın odağı yapıyor. Yeniden deneme mevcut ve korunmalı. | Liste yüzeyinde sade başlık, kısa açıklama ve tekrar dene; yalnız hata metni danger token. Teknik deploy bilgisini ürün metnine taşıma. |
| ACC-UI-05 | Durumlar: yükleniyor | `src/pages/AccessControl.tsx:12`; `src/hooks/access-rules/useAccessRulesQuery.ts:11`; `convex/accessRules.ts:46`; `U/AccessRulesList.tsx:240` | **Yüksek:** yeni özet liste öncesinde eski tam ilişkili `list` sorgusu hâlâ bekleniyor; başlık/form eylemi tüm sayfa spinner'ına bağlı. | Bu sayfanın legacy query bağımlılığını kaldır; özet sorgunun bölüm iskeletini kullan. Diğer hook tüketicilerini değiştirme. |
| ACC-UI-06 | Mikro-metin / filtre | `U/AccessRulesList.tsx:369,376,395,417` | **Orta:** “Ad yazın…” hangi türün arandığını yansıtmıyor; arama ve durum için toplu temizle eylemi yok. | Seçili arama alanına göre “Kural adı ara / Kişi adı ara / Kapı adı ara”; Filtreleri temizle. Mevcut üç arama modu korunur. |
| ACC-UI-07 | Durumlar: boş | `U/AccessRulesList.tsx:251–269` | **Orta:** ilk kullanım, arama sınırı ve sonuç yok metinleri var ama yapılabilir eylem aynı yüzeyde değil; filtresiz ilk kullanım da filtre değiştirmeyi öneriyor. | İlk kullanımda Yeni kural; sonuç yokta Filtreleri temizle; searchLimited'de aramaya odaklanan Aramayı daralt. |
| ACC-UI-08 | Bileşen tutarlılığı | `U/AccessRulesList.tsx:96–138` | **Orta:** her satırda switch + düzenle + sil + aç olmak üzere dört hedef; A2 tek işlem menüsünden ayrışıyor. Erişilebilir adlar zaten var. | Kural adı ayrıntıyı açar; diğer eylemler tek üç nokta menüsünde. Aktif/pasif değişikliği açık eylem ve pending ile korunur. |
| ACC-UI-09 | Mikro-metin / form-diyalog | `U/AccessRulesList.tsx:149`; `U/AccessRuleDetails.tsx:20–24`; `U/CreateRuleDialog.tsx:85`; `convex/accessRules.ts:515` | **Orta:** listede targetType görünmüyor; boş ziyaretçi şablonu “0 kişi / Kişi seçilmemiş” ile kusurlu kural gibi algılanabilir. | Tür kolonunda Ziyaretçi şablonu, ayrıntıda “Ziyaretçiler bu şablona Ziyaretçiler ekranından eklenir.” Personel türünde gerçek üye sayısı. |
| ACC-UI-10 | Form-diyalog / yerleşim | `U/CreateRuleDialog.tsx:71–107` | **Yüksek:** ad/açıklamadan sonra zaman, sonra yan yana kişi/kapı; fiziksel erişim kararının kim → nereye → ne zaman sırası ters. | Üç adım; son adımda birleşik kapsam özeti ve Kaydet. Düzenlemede adımlar serbestçe gezilir. |
| ACC-UI-11 | Form-diyalog | `U/CreateRuleDialog.tsx:50–54,110–128`; `U/UnifiedAccessControl.tsx:21,33` | **Yüksek:** pending dışında kapatma/İptal taslağı sessizce unmount eder; dirty koruması bağlı değil. | Escape, çarpı, Vazgeç ve proje değişiminde kaydedilmemiş değişiklikler onayı; form verisini koru, odağı geri döndür. |
| ACC-UI-12 | Erişilebilirlik / doğrulama | `U/CreateRuleDialog.tsx:71–81`; `U/components/RuleBasicInfo.tsx:18–25`; `U/hooks/useRuleForm.ts:135` | **Orta:** ad hatası zaman bölümünden sonra basılıyor, ad input'una aria-describedby/invalid bağlanmıyor; ilk hata odağı mevcut olsa da mesaj uzak. | Mesaj ad alanının hemen altında; id ilişkisi ve hata özeti, adım geçişinde ilk hataya odak. |
| ACC-UI-13 | Mikro-metin / erişilebilirlik | `U/components/TimeSchedule.tsx:23–43,50` | **Orta:** Tüm gün bir temizleme düğmesi; seçili mod görünmüyor, saat girişlerinin görünür başlangıç/bitiş etiketleri ve TR saat kapsamı yok. | Tüm gün / Saat aralığı radio, başlangıç/bitiş label, “Türkiye saati (Europe/Istanbul)”; günler her iki modda zorunlu. |
| ACC-UI-14 | Form-diyalog / yerleşim | `U/CreateRuleDialog.tsx:69`; `U/components/DepartmentTree.tsx:227`; `U/components/ZoneDeviceTree.tsx:283` | **Orta:** kaydırılan diyalog içinde iki bağımsız kaydırılan ağaç; mobilde seçimi ve aşağıdaki bölümü takip etmek zorlaşıyor. | Her adım tek ana scroll alanı; seçili sayısı ve seçilenleri göster filtresi sabit bölüme yakın. Desktop gerekirse sınırlı tek seçim listesi. |
| ACC-UI-15 | Mikro-metin / form-diyalog | `U/components/DepartmentTree.tsx:179–198`; `U/components/ZoneDeviceTree.tsx:78,254–264` | **Yüksek:** ağaçta arama yaparken Tümünü seç yalnız görünenleri değil projedeki tüm adayları seçiyor; dar arama sonrası beklenmedik geniş yetki oluşturabilir. | Eylemi “Projedeki tüm kişileri seç” diye açıkla veya “Görünenleri seç” kapsamına geçir; adım özetinde toplam seçimi koru. Bölge/alt departman semantiği değişmez. |
| ACC-UI-16 | Durumlar / mikro-metin | `U/AccessRulesList.tsx:327–331`; `convex/actions/hikvisionSync.ts:686,714` | **Yüksek:** başlangıç sayıları gösteriliyor ama `errors` listesi yok sayılıyor; sıfır iş/sıfır hata + errors dönen durumda bile “kuyruğa alındı” deniyor. | Boş sonuç, başlangıç hatası ve başlatılan iş ayrı; errors kalıcı sonuç yüzeyinde. `synced` benzersiz fiziksel cihaz sayısı veya kesin onay diye çevrilmez. |
| ACC-UI-17 | Mikro-metin / durumlar | `U/AccessRulesList.tsx:319,361`; `convex/actions/hikvisionSync.ts:702,521` | **Yüksek:** genel “Cihazlara gönder” eylemi aktif kuralları Hikvision yoluna gönderiyor; IDE Smart için aynı toplu işlem garantisi yok. | Mevcut backend ile düğme “Hikvision cihazlarına gönder”; kapsam diyalogda açık. Genel etiket ancak iki üreticiyi kapsayan sonuç sözleşmesiyle. |
| ACC-UI-18 | Durumlar / görsel hiyerarşi | `src/components/sync/DeviceSyncStatusBanner.tsx:14–33`; `src/hooks/access-rules/useComplexAccessRuleMutations.ts:89–151` | **Yüksek:** proje şeridi geçmiş son onayı gösterebilir, yeni kaydın sonucu hook toast'larına ayrılıyor; satırdaki Aktif cihazda uygulanmış anlamına gelmez. | Kayıt “Kaydedildi”; işlem “Başlatıldı / Yanıt bekliyor / Başarısız / Bilinmiyor” ayrı. Proje kapsamını etiketle; bu kuralın son işlemiyle bağı olmayan onayı kural başarısı gibi sunma. |

## Yeni tasarım

### Bilgi mimarisi ve veri sözleşmesi

1. A2 kabuk: 216px bordo sidebar, sabit 13 menü sırası, Geçiş Kontrol aktif, 64px üst çubuk ve görünür proje seçici.
2. PageHeader: h1, proje kapsamı; tek birincil eylem **Yeni kural**.
3. StatInline yerine yalnız doğru kapsamlı **“Bu sayfada N kural”** ve sayfa numarası. Global Toplam/Aktif/Pasif sayaçları mevcut `listSummaries` cevabında yok; görünür satırlardan global sayaç uydurulmaz.
4. Proje cihaz durumu: mevcut `deviceSyncStatus` alanlarından `failed`, `inFlight`, `unknown`, `hasMore`, `dismissedFailed`, `upToDate`, `lastVerifiedAt`. Şeritte “Proje cihaz durumu” başlığı, gerekirse “En az N işlem”; geçmiş onay yeni gönderime bağlanmaz. İkincil **Hikvision cihazlarına gönder** yanında.
5. FilterBar: arama, arama alanı, Aktif/Pasif/Tümü, Filtreleri temizle. 20 kayıt/sayfa sabit; backend en fazla 20 döndürüyor (`convex/accessRules.ts:450`). Sayfa boyutu seçimi ve tür filtresi eklenmez.
6. DataTable + Önceki/Sonraki cursor gezinmesi. Yeni arama/durum/proje değişince ilk cursor'a dönülür. “Bu sayfada 0 kural” ile `isDone=false` ayrılır; sonraki sayfa eylemi korunur.
7. Ayrıntı Dialog/Sheet: isim, tür, durum, zaman, tam kişi ve panel/kapı listesi; yalnız açılışta getDetails. Liste kapatıldığında arama/scroll/odak korunur.

| Kolon sırası | Genişlik önceliği (1440px içerik) | Kaynak | 390px |
|---|---|---|---|
| Kural | 25%, en az 200px; en yüksek | name; açıklama ayrıntıda | Görünür, satır düğmesi; uzun ad kırılır |
| Tür | 13%, 120px | targetType: visitor → Ziyaretçi şablonu; diğerleri → Personel yetkisi | Ayrı kolon gizli; ayrıntıda tam görünür |
| Kim | 10%, 84px | memberCount + memberCountTruncated | Ayrı kolon gizli; ayrıntıda görünür |
| Nereye | 24%, en az 190px | panels.label, selectedDoors/totalDoors, wholePanel; unassignedDoors | İkinci satır kısa panel özeti; tam liste ayrıntıda |
| Ne zaman | 17%, 160px | days, startTime, endTime | Ayrı kolon gizli; ayrıntıda görünür |
| Durum | 8%, 74px | isActive ?? true | Görünür; yalnız kural durumu |
| İşlemler | 3%, 40px | ayrıntı / düzenle / aktif-pasif / sil | Tek menü; dokunma hedefi en az 44px |

Satır 42px; masaüstü hücre uzun metinleri tek satır keser, tam bilgi adına basınca açılan ayrıntıda bulunur (yalnız hover title'a dayanmaz). Mobilde ad ve nereye aynı hücrede iki satır; satır doğal yüksekliği en az 64px. `scopeTruncated=true` → “Geniş kapsam · Ayrıntıyı aç”; kesin kapı toplamı hesaplanmaz. `memberCountTruncated=true` → “100+ kişi”. `panels[].doorsTruncated` için “Diğer kapıları gör”. `wholePanel=true` → “tüm kapılar”; `false` → “1/4 kapı”. Panelsiz kapılar gizlenmez: “Panel bağlantısı yok; cihaza uygulanamaz.” İlgili rozet warning, sıradan kapsam nötr.

**Rozet sözlüğü:** Aktif = success / Pasif = neutral; Ziyaretçi şablonu = nötr tür; Başlatıldı/Yanıt bekliyor = info; Kısmi hata/Bilinmiyor = warning; Gönderilemedi = danger. “Aktif” yalnız kural ayarıdır; “Uygulandı” ancak ilgili iş için gerçek cihaz onayı varsa kullanılabilir. Toplu seçim/BulkBar bu ekran için önerilmez; mevcut API toplu seçilen kurala işlem sunmuyor.

### Kural oluşturma / düzenleme kararı

**Üç adımlı diyalog seçildi.** İki kapsam ağacı ve haftalık plan, 390px'te tek uzun formda sık sık yukarı-aşağı kontrol gerektiriyor; ayrı adımlar kullanıcının geniş kapı yetkisini yanlışlıkla kaydetme riskini azaltır. Maliyeti ek geçiştir: bu yüzden üstte tıklanabilir adım başlıkları, sürekli “N kişi → panel/kapı → gün/saat” özeti ve düzenlemede doğrudan ilgili adıma atlama vardır. Düzenlemede tüm veriler getDetails ile dolu gelir; her adım seçimi korur, son kayıt tüm şemayı tekrar doğrular.

1. **Kim:** Kural adı* (tam genişlik), açıklama (isteğe bağlı), Personel yetkisi tür açıklaması, kişi/departman arama, Alt departmanları dahil et, ağaç ve “Seçim anındaki kişiler eklenir; yeni katılanlar otomatik eklenmez.” Seçili N kişi görünür, “Yalnız seçilenler” isteğe bağlı yerel filtre. Ziyaretçi şablonu düzenlemesinde kişi ağacı yerine mevcut üyeliği koruyan açıklama; tür değiştirme veya buradan ziyaretçi ekleme yok. Yeni ziyaretçi şablonu oluşturma Ziyaretçiler akışında kalır.
2. **Nereye:** kapı/panel/bölge arama; Bölge → Panel → Kapı. Kısmi seçim indeterminate; kapısız panel seçimi “Tüm cihaz (kapı kapsamı tanımlanmamış)” olarak açık. Tüm panel ve tek kapı ayrı özetlenir. Arama, seçim listesinin scope'unu sessizce değiştirmez. En az bir geçerli hedef zorunlu; mevcut backend sözleşmesi korunur.
3. **Ne zaman:** Türkiye saati açıklaması, gün seçimi, Tüm gün / Saat aralığı, görünür Başlangıç ve Bitiş etiketleri. Tüm gün modunda iki saat temizlenir; günler temizlenmez. Gece aşımı desteklenmiyor: “Bitiş saati başlangıçtan sonra olmalı; geceyi aşan plan için ayrı kurallar oluşturun.” En altta tam **kim → nereye → ne zaman** kontrol özeti ve kayıt/cihaz ayrımı açıklaması.

Footer sabit: Vazgeç · Geri · İleri veya **Kuralı kaydet**; pending'de “Kaydediliyor…” ve tekrar submit engeli. İlk iki adım kendi zorunlu alanlarını doğrular; final tüm şemayı doğrular ve yanlış adımı açıp ilk hataya odaklanır. Ad/kişi/kapı/gün/saat hatası ilgili alan veya grubun hemen altında `role=alert`, `aria-describedby` ve `aria-invalid` ile bağlıdır. Genel kayıt hatası footer üstünde kalır; taslak kapanmaz. Örnek mesajlar: “Lütfen kural adı girin.”, “En az bir kişi seçin.”, “En az bir kapı veya cihaz seçin.”, “En az bir gün seçin.”, “Başlangıç ve bitiş saatini birlikte girin veya tüm günü seçin.”

Düzenlemede `targetType`, `priority:0`, `accessDirection` korunur; görünmeyen alanlar varsayılana çevrilmez. Erişim yönü/öncelik için yeni kontrol eklenmez: mevcut gerçek karar etkisi bu UI taramasında doğrulanmadı. Dirty kapatmada “Değişiklikler kaydedilmedi” / “Düzenlemeye dön” / “Değişiklikleri bırak”. Yeni kayıt başarılıysa “Kural kaydedildi. Cihaz işlemleri ayrıca izlenir.”; eşzamanlı cihaz hatası kayıt hatası gibi sunulmaz.

### Cihazlara gönder: dürüst kapsam ve sonuç

Mevcut toplu action yalnız Hikvision yolunu çağırdığı için mockup'ın etiketi **Hikvision cihazlarına gönder**. Ön bilgi: “Merkez Ofis projesindeki aktif kurallar gönderilir; listedeki arama ve durum filtresi bu işlemi daraltmaz. IDE Smart panelleri bu toplu işleme dahil değildir.” Birincil gönderme eylemi bu kapsamı okuyabilecek diyalog içindedir; liste sayfasında ikincildir.

Action yanıtında `rulesProcessed` → “N aktif kural işlendi”, `synced` → “N cihaz işlemi başlatıldı”, `failed` → “N başlangıç hatası”. Aynı cihaz birden çok kuralda sayılabilir; bunlar benzersiz cihaz sayıları değildir. `errors` ayrı görünür liste; sıfır iş ve hata varsa başarı değil “Gönderme başlatılamadı”; sıfır iş ve hata yoksa “Gönderilecek aktif kural bulunamadı”. Başlatılma fiziksel uygulama değildir: `syncWeekPlanToDevicesInternal` localBridge için sadece kuyruk kaydı oluşturabilir (`hikvisionSync.ts:553`).

İşlem sonucu aynı oturumda diyalog kapandıktan sonra şeritte kalır. Proje cihaz durumu bunun altında ayrı başlıkta gösterilir; iki kapsamın sayıları birleştirilmez. Kural/çalıştırma bazında kalıcı sonuç ve “yalnız başarısızları yeniden dene” **backend gereksinimidir**, mevcut projeye ait son onaydan türetilmez. Mockup yalnız mevcut action cevabının temsili kısmi başlangıç sonucunu gösterir ve açıkça “Örnek sonuç” der; canlı gönderim veya cihaz onayı üretmez.

### Durum metinleri

| Durum | Metin ve sonraki adım |
|---|---|
| İlk kullanım | “Henüz erişim kuralı yok. Kişi, kapı ve zaman seçerek ilk kuralınızı oluşturun.” / Yeni kural |
| Filtre sonucu yok | “Eşleşen kural yok. Arama alanını veya durum filtresini değiştirebilirsiniz.” / Filtreleri temizle |
| Ara sayfa boş, devam var | “Bu sayfada eşleşen kural yok. Sonraki sayfada devam edebilirsiniz.” / Sonraki |
| Arama sınırı | “Çok fazla eşleşme var. Daha uzun bir kişi veya kapı adı yazın.” / Aramayı daralt |
| Liste yükleniyor | “Erişim kuralları yükleniyor…”; dört satır iskeleti, role=status; başlık ve filtreler kalır |
| Liste hatası | “Erişim kuralları yüklenemedi. Liste şu anda gösterilemiyor. Yeniden deneyebilirsiniz.” / Tekrar dene; filtreler korunur |
| Detay hatası | “Kural ayrıntısı yüklenemedi. Listeye dönüp yeniden açabilirsiniz.” / Tekrar dene / Kapat |
| Proje yok | “Önce bir proje seçin. Erişim kuralları seçili proje için gösterilir.”; üstte proje seçicisine odaklan |
| Yetki yok | “Bu projenin erişim kurallarını görüntüleme yetkiniz yok.”; oluştur/gönder eylemleri gösterilmez; otomatik teknik hata sınıflandırması yok |
| Cihaz sonucu bilinmiyor | “Cihaz sonucu henüz doğrulanmadı.”; kayıt başarılı olabilir, yeşil uygulandı rozeti yok |

### 390px ve erişilebilirlik

Sidebar kapalı başlar; menü düğmesiyle katman açılır, Escape ve dış alanla kapanır, odak içeride tutulur ve açana döner. Proje seçimi üst çubukta her zaman görünür; komut araması A2 gibi alt satıra geçer. Filtre araması tam genişlik; diğer alanlar iki satıra yayılır. Tablo yalnız ad/kısa kapı özeti, durum ve menüyü gösterir; yatay sayfa kaydırma gerekmez. Modal 390px'te ekranı kaplar; tek gövde scroll'u ve sabit footer, sayfa arkası inert; native dialog Escape/odak davranışı korunur. Günler sarılır; saat girişleri iki eşit sütun; 200% zoom'da tek kolona geçebilir. Seçili adım `aria-current=step`, step heading programatik odak; tüm ikonlar isimli, renk tek anlam taşıyıcısı değil. Hareket zorunlu değil, reduced-motion korunur.

## Bileşen eşlemesi / uygulama sahipliği

| Ortak parça | Bu sayfadaki kullanım | Değişecek mevcut dosyalar |
|---|---|---|
| PageHeader | h1 + proje + Yeni kural | `src/pages/AccessControl.tsx`, `U/AccessRulesList.tsx` |
| StatInline | “Bu sayfada N kural”; global sayım yok | `U/AccessRulesList.tsx` |
| FilterBar | arama alanı, metin, durum, temizle | `U/AccessRulesList.tsx` |
| DataTable / StatusBadge | kısa kapsam, tür, aktif/pasif, tek menü | RuleCard görseli kaldırılır; `U/AccessRulesList.tsx` |
| BulkBar | Kullanılmaz; seçili kurallara toplu API yok | Yeni seçim state'i ekleme |
| EmptyState / SectionSkeleton / QuerySectionBoundary | liste, ayrıntı, seçim adımı | ortak görsel stil ortak sahibinde; sayfa metinleri bu modülde |
| Dialog/Sheet | ayrıntı ve üç adımlı editör | `U/CreateRuleDialog.tsx`, `U/AccessRuleDetails.tsx`, `U/UnifiedAccessControl.tsx` |
| Form alanları / UnsavedChangesDialog | alan altında hata, dirty çıkış, final şema | `U/components/RuleBasicInfo.tsx`, `TimeSchedule.tsx`, `hooks/useRuleForm.ts` |
| Seçim listeleri | arama + mevcut tri-state mantığı + açık toplu seçim kapsamı | `U/components/DepartmentTree.tsx`, `ZoneDeviceTree.tsx`; selectionHelpers mantığı korunur |
| DeviceSyncStatusBanner + sonuç yüzeyi | proje durumu ve son action yanıtı ayrı | `src/components/sync/DeviceSyncStatusBanner.tsx`, `src/hooks/access-rules/useComplexAccessRuleMutations.ts`, `U/AccessRulesList.tsx` |

`UnifiedRuleTable.tsx` yalnız AccessRulesList saran eski kabuktur; kullanılmıyorsa import taraması sonrasında silinebilir, bu taramada silinmedi. Backend özet alanları camelCase korunur; formun mevcut yerel alan isimleri tasarım uğruna yeniden adlandırılmaz. Ortak kabuk/renk değişiklikleri ortak tasarım sistemi sahibine aittir.

## Backend gereksinimi

Temel A2 liste, üç adımlı form ve aynı oturumdaki başlangıç sonucu için yeni veri modeli gerekmez; `listSummaries`, `getDetails`, mevcut create/update ve sync cevapları yeterlidir. Deploy eksikliği koordinatörün çalışma ortamı önkoşuludur; bu görev deploy yapmaz.

1. **Çalıştırma/kural bazında kalıcı cihaz sonucu istenirse:** action bir operation/run kimliği döndürmeli, ilgili kural sürümü ve hedef cihazlarla bağlanmalı; kuyruk/ACK/başarısız/atlanan/bilinmeyen ayrımı ve sonuç sorgusu gerekir. Mevcut proje agregası belirli kaydın onayı değildir.
2. **Genel Cihazlara gönder etiketi korunacaksa:** IDE Smart ve Hikvision yollarını kapsayan orkestrasyon ve açık üretici kapsamı/atlanan hedef sözleşmesi gerekir. Mevcut backend ile dar Hikvision etiketi uygulanabilir.
3. **Büyük ayrıntılar:** getDetails üyeleri `.collect()` ile getiriyor (`convex/accessRules.ts:543–549`); çok büyük kural için kişi/kapı ayrıntısında cursor API ayrıca planlanmalı. Listeye global sayaç eklemek bu önerinin gereği değildir.

## Açık ürün soruları (2)

1. Toplu yeniden gönderme yalnız Hikvision olarak mı etiketlenecek, yoksa IDE Smart'ı da içeren yeni bir işlem mi ürün kapsamına alınacak? Önerilen ilk uygulama mevcut API'yi doğru etiketler.
2. Çalıştırma bazında kalıcı cihaz sonuç geçmişi bu faza dahil mi? Dahil değilse aynı oturum yanıtı ve ayrı proje durumuyla yetinilmeli; satıra “Uygulandı” eklenmemeli.

## Uygulama tahmini ve riskler

**L · 24–32 saat**, ortak A2 kabuk ve bileşenler hazır kabulüyle: liste/filtre/durumlar 6–8s; adımlı form ve seçim özeti 10–12s; mevcut yanıtla senkron sonuç yüzeyi 3–4s; responsive/klavye/regresyon 5–8s. Çalıştırma geçmişi veya üreticiler arası toplu senkron backend'i bu tahmine dahil değildir; sözleşme kararından sonra ayrıca boyutlandırılmalıdır.

Riskler: legacy tam sorguyu kaldırırken diğer hook tüketicileri; ziyaretçi üyeliklerinin değişmemesi; tüm panel fallback'inin explicit kapı seçimine dönüşümü; priority 0 ve gizli alanların korunması; final kayıt ile arka plan sync hatasının ayrılması. Fiziksel cihaz testi sonraki uygulama dalgasında gerekir; bu tasarım taramasında başarı iddiası yoktur.

## Teslim ve doğrulama

`mockup.html` bağımsız/offline görsel prototiptir: A2 ana liste, filtre/arama, ayrıntı, düzenleme/yeni kural için üç adım, alan doğrulama, dirty vazgeçme, Hikvision gönderim kapsamı ve temsili kısmi başlangıç sonucu, yükleniyor/boş/hata örnekleri. Ağ isteği veya gerçek veri yazımı yapmaz. 

**Doğrulama tamamlandı (17.10.2026):** Kurulu Playwright CLI ve Chrome ile doğrudan `file://` açıldı; paket kurulmadı. İlk CLI oturumunun varsayılan file protokol engeli, yerel dosya erişim ayarıyla giderildi; HTTP sunucusu veya canlı uygulama kullanılmadı.

| Kapı | Sonuç |
|---|---|
| HTMLParser etiket dengesi ve benzersiz id | Geçti; 84 benzersiz id |
| 1440 × 900 ana liste ve editör | Geçti; belge scrollWidth 1425 ≤ 1440 (scrollbar alanı); editör 820px sınırında |
| 390 × 844 liste, ayrıntı, üç editör adımı, senkron, boş/yükleniyor/hata | Geçti; her durumda belge scrollWidth 390; modal iç genişliği 388px, yatay taşma yok |
| Yeni kural | Boş ad hatası, kişi/kapı seçimi, ters saat aralığı hatası ve başarılı yerel örnek kayıt geçti |
| Düzenleme | Adıma doğrudan geçiş, tüm panel seçimi → tek kapı kaldırınca indeterminate, saat aralığı → tüm gün kaydedip ayrıntıdan okuma geçti |
| Taslak ve klavye | Escape dirty onayı, Düzenlemeye dön ile taslak korunması, mobil menü Escape ve açan düğmeye odak dönüşü geçti |
| Gönderim | Üretici/kapsam açıklaması, temsili kısmi başlangıç hatası ve diyalog kapatılınca sonuç şeridinin kalması geçti |
| Konsol / ağ | 0 konsol hatası, 0 uyarı; yalnız yerel HTML gezinmeleri, harici ağ isteği yok |

Doğrulamada yakalanan prototip panel checkbox olay sırası düzeltildi ve tüm/kısmi seçim yeniden geçti; yanlış çoklu eşleşen test locator'ı daraltıldı. Mobil footer ekran altına yerleştirildi, dar durum hücresi düzeltildi ve son görseller yeniden alındı. HTML/mobil testleri gerçek React/Convex veya cihaz entegrasyon testi değildir; `src`/`convex` değişmediğinden uygulama tsc/eslint çalıştırılmadı.

Görsel kanıtlar: [Masaüstü](desktop-1440.png), [Mobil](mobile-390.png), [Editör masaüstü](editor-1440.png), [Editör mobil](editor-390.png), [Gönderim masaüstü](sync-1440.png), [Gönderim mobil](sync-390.png), [Mobil hata durumu](error-390.png).
