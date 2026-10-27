# Geçiş Kontrol — 04 Kapı Planları UX/UI denetimi

Kapı planını düzenleme ve kaydetmeden çıkma akışı çalışıyor; teknik olmayan yönetici için planın etkinliği, fiziksel kapı davranışı ve gönderim sonucu yeterince ayrışmıyor. En önemli iki sorun, tek kapıdaki “Kaydet” düğmesinin cihaza da göndermesi ve gönderim hatasından sonra form yeniden açılınca tekrar gönderme yolunun kaybolması. Tatil ve boş şablon akışları sonraki adımı göstermiyor; mobilde gönderim sütunu ilk görünümün dışında kalıyor.

| Yüksek | Orta | Düşük | Toplam |
|---|---|---|---|
| 2 | 8 | 2 | 12 |

**Tarih / kapsam:** 27.10.2026; NGS aktif projesi; `/access-control?tab=doors`; 1440×1000 masaüstü ve iPhone 12 / 390×844 mobil. Canlı listede yalnız **Giriş / NGS0001** ve **Çıkış / NGS0002** var. “Ana giriş” senaryosunda Giriş kullanıldı. Gerçek kullanıcı testi değil, verilen yönetici profiline göre uzman incelemesidir.

**Güvenli sınır:** Kod ve canlı veri değiştirilmedi; kaydetme, silme, uygulama, gönderim ve nihai toplu işlem düğmeleri kullanılmadı. Yalnız yerel form alanları, açma/kapatma, seçim, Tab/Escape ve kaydırma denendi; taslaklar “Kaydetmeden çık” ile atıldı. Yerel “Pazartesiyi … kopyala” ve “Aralığı sil” de tıklanmadı; davranışları koddan okundu. Önceki iki rapordaki düzeltilmiş teknik bulgular yeniden sayılmadı.

**Görüntü sınırlaması:** Orca PNG çıktısı bu oturumda masaüstünde de yatay/dikey parçaları tekrarladı; mobilde üst yaklaşık 312 CSS px dışındaki tekrarlanan parçalar gerçek devam görüntüsü değildir. Dosyalar ham çıktıdır ve açılıp incelendi. Bu tekrarlar uygulama hatası olarak değerlendirilmedi; taşma, boyut ve görünürlük bulguları ayrıca DOM (tarayıcının gerçek yerleşim ölçümleri) ve kodla doğrulandı.

## Senaryolar

Adım = tıklama veya bir alanın değerini değiştirme; kaydırma ve metin okuma sayılmadı. Yasaklanan son işlemler sayıya dahil değil.

| Senaryo | Adım / sonuç | Takılma noktası |
|---|---|---|
| **S1 — Hafta içi 08:00–09:00 sürekli açık** | **6 adım:** Giriş'i aç → durum planını etkinleştir → günlük bitişi 09:00 yap → Gün bazında seç → Cumartesi modunu Normal yap → Pazar modunu Normal yap. Başlangıç 08:00 ve Sürekli Açık hazır geldi. Pzt–Cum 08:00–09:00 açık, hafta sonu aynı aralık Normal olan taslak DOM'da doğrulandı; kaydedilmedi. | Gün bazına geçiş yedi güne de açık aralık koyuyor. Hafta sonunu ayrıca fark edip düzeltmek gerekiyor; “Normal” ve aralık dışı davranış açıklanmıyor. Aralıkları silmeden senaryo kurulabildi. Escape → Kaydetmeden çık: **2 ek adım**. |
| **S2 — Aynı planı 5 kapıya kopyala** | Mevcut **2 kapı ile 2 adım:** Tüm kapıları seç → Planı kopyala diyaloğunu aç. Kaynak Giriş varsayılan seçili; hedef sayısı 2 doğru. Kaynak türü “Zaman şablonu” da incelendi (**1 ek adım**); listede şablon yok. | Projede beş hedef bulunmadığından **5 kapıyla uçtan uca doğrulanmadı**. S1 taslağı kaydedilmediği için kopyalanabilir kaynak haline getirilmedi. Nihai “Kaydet ve gönder” tıklanmadı. Diyalog hedef adlarını ve kaynak planın saat/mod özetini göstermiyor; kaynak kapı hedeflerin içinde de kalıyor. |
| **S3 — 29 Ekim tatil planı yolu** | **2 adım:** Giriş'i aç → “Proje ve Türkiye geneli tatillerini uygula” seç. Yıl 2026; “Seçilen yılda uygulanacak tatil yok” göründü. | Burada 29 Ekim ekleme/seçme alanı veya takvime bağlantı yok; akış bu noktada duruyor. Kod, takvimin PDKS › Ayarlar'a taşındığını ve ayrı “Tatil ekle / Resmi tatilleri yükle” eylemlerini gösteriyor; o ekranda kayıt yapılmadı. Tarihler bulunduğunda da yalnız seçilen yılın tüm tatilleri uygulanıyor; 29 Ekim'e özel seçim sunulmuyor. |
| **S4 — Cihaza gitti mi, hata nasıl giderilir?** | Masaüstü listesinde **0 işlemle** iki kapının “Gönderilmedi” bilgisi okunuyor; Giriş'i açmak **1 adım**, fakat açılan form önceki gönderim durumunu göstermiyor. Mobilde gönderim için **1 yatay kaydırma** gerekiyor. | Canlıda hata satırı yok; hata üretmek/göndermek yasak olduğundan gerçek cihaz hatası **doğrulanmadı**. Koddan, hata sonrası aynı açık formda yeniden deneme bulunduğu; form kapatılıp açılınca kaybolduğu ve değişikliksiz kaydetmenin yanıltıcı başarıya gidebildiği doğrulandı (04-H1). |

## Bulgular

Kanıttaki kaynak yolları depo köküne göredir. `DP` kısaltması `src/components/access-control/door-plans/`, `AC` ise `src/components/access-control/` dizinidir.

| ID | Önem | Kategori | Ne görülüyor | Neden sorun | Öneri | Kanıt |
|---|---|---|---|---|---|---|
| **04-H1** | Yüksek | Hata sonrası toparlanma / doğru geri bildirim | Form yeniden açılınca `saved=false`, `planResults=[]`; “Tekrar gönder” yalnız bu oturumda kaydetme yapılmışsa çıkıyor. Değişikliksiz Kaydet, sunucudan boş değişiklik listesi alıp boş gönderim sonucunu başarılı kabul ediyor. | Hatalı/bekleyen planı tekrar göndermek isteyen yönetici içerikte yapay değişiklik yapmak zorunda kalabilir; gönderim yapılmadan “cihaza uygulandı” bildirimi alabilir. Canlı hatada çalıştırılmadı; kontrol akışı koddan doğrulandı. | Kalıcı gönderim sonuçlarını form açılışında yükle; değişiklik olmadan başarısız/bekleyen planı yeniden gönderen açık eylem sun. Boş gönderim listesinden cihaz başarısı üretme. | `DP/DoorPlanDialog.tsx:70`, `:126`, `:131`, `:142`, `:445`; `convex/doors.ts:604`; `AC/doorPlanResult.ts:24` |
| **04-H2** | Yüksek | Eylemin sonucu / fiziksel etki | Tek kapıdaki düğme “Kaydet”, fakat işlem hemen `sendPlans(keys)` çağırıyor. Diyalog açıklaması yalnız “zaman planlarını düzenleyin”; sürekli açık modunun fiziksel etkisi hakkında kopyalama ekranındaki uyarı burada yok. | Yönetici yalnız ayar taslağı sakladığını sanarak kapıyı sürekli açık/kilitli moda geçirebilir. Aynı işin toplu sürümünde “Kaydet ve gönder” yazması tutarsızlığı büyütüyor. | Tek kapıda da “Kaydet ve cihaza gönder” yaz; üstünde kapı adı, gün/saat ve sürekli açık/kilitli etkisini kısa özetle. | `DP/DoorPlanDialog.tsx:129`, `:141`, `:228`, `:456`; `DP/CopyDoorPlansDialog.tsx:109`, `:201`; [form](04-kapi-planlari/desktop-dialog.png) |
| **04-O1** | Orta | Etkinlik / form davranışı | Durum ve doğrulama planı anahtarları kapalıyken bütün saat/mod alanları açık ve düzenlenebilir. Formda “bu plan etkin değil” metni yok. | Saatleri doldurmak planı açmıyor; kullanıcı ayarladığı saatlerin uygulanacağını sanabilir. İlgisiz ikinci planın bütün alanları da ilk açılışta yük oluşturuyor. | Kapalı planda özet ve “Planı etkinleştir” göster; alanları devre dışı bırak veya açılınca göster. Anahtar yanında metinsel Açık/Kapalı durum ver. | `AC/door-dialog/DoorStatusPlanSection.tsx:14`, `:24`; `AC/door-dialog/DoorVerifyPlanSection.tsx:22`, `:40`; [mobil form](04-kapi-planlari/mobile-dialog-top.png) |
| **04-O2** | Orta | Kavram / Türkçe | Listede etkin olmayan iki plan da “Kapalı”; editörde kilitleme “Sürekli Kapalı”, şablon/tatilde “Sürekli kilitli”. “Normal”, aralık dışı davranış ve kişi yetkisi ile kapı modu farkı açıklanmıyor. | Fiziksel kapının kilitli oluşu, planın devre dışı oluşu ve kişiye geçiş izni birbirine karışabilir. Yönetici aralık dışını erişim yasağı sanabilir. | “Plan etkin değil” kullan; bütün modlarda “Sürekli kilitli” de. Kısa açıklama ekle: kapı modu herkes için davranışı belirler, kişi bazlı saat izni Kurallar/Zaman Şablonları üzerinden yönetilir; aralık dışı davranışı açıkla. | `DP/DoorPlansTab.tsx:42`, `:200`; `AC/DoorStatusPlanEditor.tsx:67`, `:230`; `DP/DoorPlanDialog.tsx:315`; [liste](04-kapi-planlari/desktop-list.png) |
| **04-O3** | Orta | Tatil akışı / çıkmaz | 2026'da “Seçilen yılda uygulanacak tatil yok”; takvime gitme/ekleme bağlantısı yok. Tatil tarihleri döndüğünde de isim/tarih listesi gösterilmiyor. | Yönetici 29 Ekim'i nereden ekleyeceğini ve hangi günlere hangi modun uygulanacağını kontrol edemiyor. Yarım günlerin de tam gün uygulanacağı küçük açıklamada kalıyor. | Boş durumda “Tatil takvimini aç” bağlantısı; dolu durumda uygulanacak tarih ve tam/yarım gün etkisi önizlemesi. Bütün tatiller/tek tarih kapsamını açık yaz. | `DP/DoorPlanDialog.tsx:95`, `:372`, `:413`; `convex/doors.ts:725`; `src/pages/Settings.tsx:40`; `src/components/settings/sections/components/HolidayCalendarManager.tsx:90`; [tatil](04-kapi-planlari/desktop-holiday.png) |
| **04-O4** | Orta | Haftalık plan kurma | “Gün bazında” seçimi günlük açık aralığı **yedi günün tamamına** taşıyor; doğrudan hafta içi seçeneği yok. S1'de hafta sonunu ayrıca Normal yapmak gerekti. | Hafta içi amacıyla başlayan kullanıcı alttaki hafta sonlarını görmeden açık bırakabilir. Hafta içi kopyalama düğmesi mevcut hafta sonunu koruduğu için bu başlangıç varsayımını temizlemiyor. | Plan düzenine “Hafta içi” seçeneği veya açık gün seçimi ekle; son özette özellikle hafta sonu davranışını göster. | `AC/DoorStatusPlanEditor.tsx:109`, `:150`; S1 DOM: yedi gün 08:00–09:00 `remainOpen`; [düzeltilmiş hafta sonu](04-kapi-planlari/desktop-weekly.png) |
| **04-O5** | Orta | Toplu işlem önizlemesi | Kopya diyaloğu yalnız hedef sayısını veriyor; hedef adları, kaynak planın gün/saatleri ve hangi plan türlerinin değişeceği yok. Kaynak ilk kapı otomatik seçiliyor; tümünü seçince kaynak da hedef sayısına dahil. | Yanlış kaynaktan veya yanlış kapılara işlem yapmak öncesinde fark edilmeyebilir. “Kapının tüm planları” seçeneğinin hangi mevcut ayarları etkileyeceği anlaşılamıyor. | Hedef adlarını, kaynak cihaz/kapıyı ve durum/doğrulama/tatil özetlerini göster; kaynağın hedefte oluşunu açık belirt veya dışla. Kaynakta olmayan planın hedefte korunacağını açıkla. | `DP/CopyDoorPlansDialog.tsx:26`, `:76`, `:109`, `:138`; [kopya](04-kapi-planlari/desktop-copy.png) |
| **04-O6** | Orta | Mobil / gönderim görünürlüğü | 390px'te 358px kapsayıcı içinde tablo 520px. Gönderim sütunu x=429'da başlıyor; ilk görünümde tamamen dışarıda. Yatay kaydırınca kapı adı dışarı çıkıyor. | En önemli kontrol “hangi kapıya gitti?” tek bakışta yapılamıyor. Kısa iki satırlı listede bile ilişkiyi akılda tutmak gerekiyor. | Mobil satırı kapı adı + plan özeti + gönderim durumu biçiminde düzenle veya kapı sütununu sabitle; durum bilgisini önceliklendir. | `DP/DoorPlansTab.tsx:105`, `:202`; `src/components/ui/table.tsx:9`; DOM ölçümleri aşağıda; [ilk görünüm](04-kapi-planlari/mobile-list.png), [yatay kaydırma](04-kapi-planlari/mobile-list-scroll.png) |
| **04-O7** | Orta | Mobil / uzun form | Sadece durum planını Gün bazında yapmak mobil diyalog içeriğini 3133px'e çıkarıyor; görünür alan 758px, Kaydet y≈3080. Etkin olmayan doğrulama planı da altta tam editör olarak duruyor. | Günleri kontrol edip sona ulaşmak çok kaydırma gerektiriyor; kapı adı ve anahtar durumu yukarıda kayboluyor. | Günleri açılır bölümlerde düzenle, “hafta içi” toplu seçim sun; kapalı planları daralt ve alt eylem alanını sabitle. | `DP/DoorPlanDialog.tsx:225`, `:421`, `:436`; `AC/DoorStatusPlanEditor.tsx:166`; mobil DOM ölçümü |
| **04-O8** | Orta | Boş durum / sekmeler arası geçiş | Kopyalama kaynağı “Zaman şablonu” seçildiğinde seçenek yalnız “Şablon seçin”; boş olduğuna dair açıklama ve şablon oluşturma yolu yok. “Şablonu düzenle” yalnız bir şablon seçilmişse çıkıyor. | İlk şablonunu oluşturacak yönetici aynı boş seçicide takılıyor; sonraki adım görünmüyor. | “Henüz zaman şablonu yok” + “Zaman Şablonları'na git” eylemi sun; geri dönüşte kapı seçimlerini koru. | `AC/unified/templates/TemplatePicker.tsx:39`, `:49`; `DP/CopyDoorPlansDialog.tsx:147`; DOM seçenek sayısı 1 (yalnız boş değer) |
| **04-D1** | Düşük | A2 / dokunma hedefi | Kopyalamada şablon kaynağına ait “Kapı modu” seçicisi sınıfsız, 93×18px; aynı formdaki kaynak seçicileri dolgulu ve tam genişlikte. | Fiziksel etkisi önemli seçim görsel olarak geri planda; mobil dokunma hedefi 44px tasarım hedefinin altında. | Aynı form kontrolünü kullan; en az 44px yükseklik ve tam genişlik ver. | `DP/CopyDoorPlansDialog.tsx:150`; masaüstü DOM 93×18px |
| **04-D2** | Düşük | Büyük liste / veri kapsamı | Backend ilk 1000 proje kapısını aldıktan sonra desteklenen cihazları filtreliyor; UI'da arama, sayfalama veya kesilme uyarısı yok. | Çok büyük projede uygun bir kapı sınır dışında kalabilir; kullanıcı neden görünmediğini anlayamaz. Mevcut iki kapıda performans sorunu gözlenmedi; ölçek etkisi canlıda doğrulanmadı. | Desteklenen hedefleri sayfalı sorgula; arama ekle ve varsa kapsam sınırını bildir. | `convex/doors.ts:631`, `:634`; `DP/DoorPlansTab.tsx:139` |

## Doğrulanan iyi noktalar ve sınırlar

- Masaüstü DOM'da tablo 1160px genişliğinde ve kapsayıcısına tam sığıyor; 390px'te sayfa genişliği 390px, diyalog 358px ve içeride yatay taşma yok (clientWidth = scrollWidth = 356px). Bordo birincil eylem, nötr tablo ve ayırıcılar A2 yönüyle uyumlu.
- Kapı adı gerçek `button`, açıklayıcı `aria-label` taşıyor. Form anahtarları `role=switch` ve `aria-checked` ile durum veriyor. Tab ile bir sonraki onay kutusuna geçildi; 2px bordo odak çizgisi ölçüldü. Escape değişmiş formda “Düzenlemeye dön / Kaydetmeden çık” korumasını açtı; değişmemiş form ve kopya diyaloğu kapandı.
- Kopya sayısı iki seçimde 2; seçim yokken açma düğmesi pasif. Günler, başlangıç ve bitişler Türkçe erişilebilir adlara sahip; saat alanlarında “TR saati” var. Liste tarih biçimlendirmesi `formatTrDateTime` kullanıyor; canlıda gönderilmiş kayıt bulunmadığı için gerçek tarih/saat metni sınanmadı.
- Mevcut hata sonrası açık form, kaydetme ile cihaz uygulamasını ayrı rozetlerde gösteriyor ve başarısız planı yeniden deneyebiliyor (`DoorSaveResults.tsx:8`; `DoorPlanDialog.tsx:149`). Sorun bu sonucu yeniden açılışta geri getirememesi.
- Sorgular: liste `doors.listPlanTargets`; tatil işaretlenince `doors.listPlanHolidays`; şablon yolu açılınca `accessScheduleTemplates.list`. Tatil sorgusu kapalıyken `skip`. Yeni sorgu/aksiyon/mutation elle çalıştırılmadı. Boş liste dalı yalnız “Plan kurulabilecek Hikvision kapısı yok” başlığı, yükleme dalı `role=status` içeriyor; canlıda bu durumlar zorla üretilmedi. Ağ hatası ve gerçek cihaz uyumluluğu denenmedi.
- Bütün ekle/sil/kopyala yardımcılarının sınırları koddan incelendi; 8 aralık sınırı ve gece yarısını iki güne bölme ipucu mevcut. Kaydetme doğrulamalarını çalıştırmak canlı yazma riski taşıdığı için yapılmadı. Salt rapor görevinde derleme/test koşulmadı.

### Yerleşim ölçümleri (27.10.2026, Orca eval)

| Ölçüm | Sonuç |
|---|---|
| Masaüstü görünüm | `innerWidth=1440`, `innerHeight=1000` |
| Masaüstü tablo | x=248, width=1160; kapsayıcı clientWidth=scrollWidth=1160 |
| Mobil görünüm | `innerWidth=390`, belge scrollWidth=390 |
| Mobil tablo | kapsayıcı 358px; içerik 520px; Gönderim başlığı x=429 |
| Mobil günlük form | dış genişlik 358px; clientWidth=scrollWidth=356; scrollHeight=1071 |
| Mobil haftalık form | clientHeight=758; scrollHeight=3133; Kaydet y=3079,89, yükseklik=36 |
| Kopya şablon mod seçimi | genişlik=93px, yükseklik=18px |

## Hızlı düzeltmeler

Her biri ayrı, yaklaşık ≤30 dakikalık küçük düzenleme olarak önerilir; uygulanmadı.

1. **04-H2:** Tek kapı düğmesini “Kaydet ve cihaza gönder” yap; sürekli açık/kilitli etki cümlesi ekle.
2. **04-O2:** “Kapalı” → “Plan etkin değil”; “Sürekli Kapalı” → “Sürekli kilitli”; Normal için kısa yardım metni ekle.
3. **04-O1:** Kapalı planın editörünü devre dışı göster ve anahtarın yanına durum metni koy.
4. **04-O3:** Boş tatil durumuna PDKS › Ayarlar tatil takvimi bağlantısı ekle; geçişte mevcut taslak korumasını kullan.
5. **04-O8:** Boş şablon seçicisine açıklama ve Zaman Şablonları bağlantısı koy.
6. **04-D1:** Kopya kapı modu seçicisini aynı A2 ölçü ve genişliğine getir.

04-H1 kalıcı durum/yeniden deneme mantığı ve anlamlı test gerektirir; 30 dakikalık iş olarak değerlendirilmedi.

## Ürün kararı gereken

1. **Kaydetme ve gönderim nasıl ayrılmalı?** A) Tek “Kaydet ve cihaza gönder” eylemi + açık etki özeti. B) “Taslağı kaydet” ve ayrı “Cihaza gönder” adımı.
2. **Tatil kapsamı nasıl olmalı?** A) Takvimdeki tüm günler ve aynı mod, açık tarih önizlemesiyle. B) Tek tek seçilen tarihler. C) Tarih ve yarım gün saatlerine göre ayrı kapı modları.
3. **Toplu kopyada kapsam nasıl seçilmeli?** A) Kaynak kapının bütün mevcut planları, ayrıntılı önizlemeyle. B) Durum / doğrulama / tatil ayrı seçilebilir. C) Yalnız durum planı kopyalanır, diğerleri ayrı akışta yönetilir.

## Ekran görüntüleri

Ham PNG'ler; yukarıdaki Orca tekrar sınırlaması geçerlidir. Dosyalar tek tek açılıp incelendi.

- [Masaüstü liste](04-kapi-planlari/desktop-list.png)
- [Masaüstü ilk form](04-kapi-planlari/desktop-dialog.png)
- [Haftalık taslak / hafta sonları Normal](04-kapi-planlari/desktop-weekly.png)
- [Boş tatil yılı](04-kapi-planlari/desktop-holiday.png)
- [İki kapı için kopyalama diyaloğu](04-kapi-planlari/desktop-copy.png)
- [Mobil liste başlangıcı](04-kapi-planlari/mobile-list.png)
- [Mobil tablo yatay kaydırılmış](04-kapi-planlari/mobile-list-scroll.png)
- [Mobil form üstü](04-kapi-planlari/mobile-dialog-top.png)
- [Mobil form aşağı kaydırılmış](04-kapi-planlari/mobile-dialog-middle.png)

## Kararlar (Emre, 2026-10-27)
- 04-H2 kaydet/gönder: **tek düğme "Kaydet ve cihaza gönder"** + üstünde etki özeti (kapı, gün/saat, sürekli açık/kilitli).
- 04-O3 tatil: **takvimdeki tüm tatiller** aynı modla; etkilenecek tarihler önizlenir, tatil takvimine bağlantı olur.
- 04-O5 toplu kopya: **plan türü seçilebilir** (durum / doğrulama / tatil); hedef kapı adları + kaynak plan özeti gösterilir.
- Koordinatör doğrulaması: 04-H1 (`DoorPlanDialog.tsx:141` boş `keys` → `every()` true → "cihaza uygulandı") ve 04-H2 (`:456` "Kaydet" + `:141` `sendPlans`) kodda doğrulandı.
