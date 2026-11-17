# NGS Access — görsel inceleme ve ortak tasarım yönü

Tarih: 12 Kasım 2026. Kapsam: workstream 3, yalnız denetim ve tasarım yönü. Kaynak kodu, ayarlar ve iş verileri değiştirilmedi. Bu rapor frontend-design, ux-designer, orca-cli ve orchestration becerileri ile depo AGENTS.md kuralları okunarak hazırlandı.

## Yöntem, erişim ve kanıt sınırları

- `orca ports --all --json` mevcut NGS Access sunucusunu `http://localhost:8081`, PID 83304, `/Users/emreaydin/ngsaccess` olarak tanımladı. Yeni sunucu başlatılmadı.
- `orca tab list --json` iki açık sekme gösterdi: geçiş kontrolü ve PDKS planı. Bu sekmelerde gezinilmedi, genişlikleri değiştirilmedi. İnceleme için ayrı `ae9c848f-c7fa-4ff6-85c3-a21b78c3c725` sekmesi oluşturuldu; mevcut Default profilindeki doğrulanmış oturum doğrudan çalıştı. Kimlik bilgisi girilmedi, oturum verisi kopyalanmadı.
- Dört temsilî ekran 1440×1000 ve 390×844 CSS px genişliklerinde incelendi. Dar görünümde Orca `viewport --mobile` kullanıldı; bu gerçek telefon cihazı testi değildir. Ekran görüntüleri yalnız aşağıdaki evidence klasörüne yazıldı.
- Sayfa görüntüsü ile kaynak bulguları aşağıda ayrı belirtilmiştir. Repo inceleme anında çok sayıda mevcut değişiklik içeriyordu; denetim bu çalışma ağacını ve canlı Vite çıktısını temsil eder, temiz bir sürüm/commit garantisi vermez.
- İşlem menüleri, kayıt/düzenleme/silme, atama, aktarma ve tema anahtarları çalıştırılmadı. Diğer roller, uzun listeler, hata durumları, koyu tema, 200% zoom, ekran okuyucu ve bütün klavye sırası test edilmedi. Bunlar için uygunluk iddiası yoktur.
- Dar PDKS ilk karede yükleniyordu; `Bu dönemde atama yok` metni beklendikten sonra aynı kanıt dosyası kararlı görünümle yenilendi. Yükleme görüntüsü bir ürün kusuru olarak sayılmadı.
- Kanıtlar mevcut personel/cihaz bilgilerini içerir; iç denetim materyalidir.

| Ekran / görev | Masaüstü kanıtı | Dar görünüm kanıtı |
|---|---|---|
| Kişiler / personel bulma | [Masaüstü](evidence/visual-employees-desktop.png) | [390 px](evidence/visual-employees-narrow.png) |
| Cihazlar / bağlantı durumu | [Masaüstü](evidence/visual-devices-desktop.png) | [390 px](evidence/visual-devices-narrow.png) |
| PDKS / vardiya planı | [Masaüstü](evidence/visual-pdks-desktop.png) | [390 px](evidence/visual-pdks-narrow.png) |
| Ayarlar / genel form | [Masaüstü](evidence/visual-settings-desktop.png) | [390 px](evidence/visual-settings-narrow.png) |

## Temel değerlendirme

Ürün personel, cihaz, kapı ve vardiya işlemlerini yürüten bir operasyon arayüzü. Modernleşmenin ana getirisi dekorasyon eklemekten değil; kişinin doğru kaydı, aktif proje kapsamını ve güvenli sonraki işlemi hızla ayırt etmesinden gelmeli. Mevcut arayüzde bordo navigasyon, sakin açık zemin ve küçük köşe yarıçapları zaten tutarlı bir kimlik oluşturuyor. Bunları sıfırlamak yerine içerik hiyerarşisini, yoğunluğu ve eylem yerlerini birleştirmek daha anlamlı.

### Korunacak güçlü taraflar

- **Canlı:** Kişiler ve Cihazlar başlıkları, ana eylemleri, soldaki kapsam ağacı ve filtreleri benzer yerlerde. Ortak şablon için gerçek bir temel mevcut.
- **Canlı:** Aktif navigasyon satırı renk yanında sol işaretle de belirtiliyor. Durum rozetleri yalnız renge dayanmıyor; Aktif, Çevrimiçi ve Çevrimdışı metinleri var.
- **Canlı:** Dar görünümde ağaç tek kapsam düğmesine, ayar navigasyonu etiketli seçiciye dönüşüyor. Kişiler ve Cihazlar gerekli kolonları azaltıyor. Dar PDKS, haftalık ızgara yerine günlük çalışan listesi sunuyor; tüm ekranları aynı tabloya zorlamamak doğru.
- **Canlı + DOM:** Kişiler, Ayarlar ve PDKS dar ölçümlerinde belge genişliği 390 px kaldı; genel sayfa yatay taşması görülmedi. Bu, bütün ekran/breakpoint kombinasyonları için garanti değildir.
- **Canlı klavye kontrolü:** Ayarlar ekranında `İçeriğe geç` bağlantısına odak verilip Enter basıldığında `document.activeElement` MAIN, kimliği `main` oldu. Kayıt alanları değiştirilmedi.
- **Statik:** `src/index.css` global görünür odak, azaltılmış hareket ve semantik durum tokenları içeriyor. `Layout.tsx` rota değişiminde ana içeriğe odak taşıyor. `TreePanel.tsx` ağaç işlemlerini focus-within ve dokunmatik ortamda da açığa çıkarıyor.

## Öncelikli bulgular

P1: günlük operasyon verisini okumayı veya hedefi seçmeyi zorlaştırır. P2: tutarlılık ve verimlilik fırsatı. Bulgular gözlenen durumun önceliğidir; kullanıcı araştırmasıyla doğrulanmış sıklık/etki değildir.

| ID | Öncelik / kanıt türü | Bulgular ve etkisi | Ortak şablon kararı |
|---|---|---|---|
| V01 | P1 / canlı + statik | 1440 px Kişiler tablosunda e-posta, departman, pozisyon ve kart alanları birkaç harfe kadar kısalıyor; başlıklarda E-posta ve Kart no bölünüyor. Günlük kimlik eşleştirme için görünür veri zayıf. `EmployeeTable.tsx` `table-fixed` kullanıyor. Gözlenen kolon genişlikleri profilin saklanmış durumundan etkilenebilir; bunun temiz profil varsayılanı olduğu doğrulanmadı. | Ad ve kimlik alanlarına içerik temelli minimum genişlik; düşük öncelikli kolonları görünüm menüsüne taşıma; gerekirse yalnız tablo bölgesini kaydırma. Tek tip eşit dar kolon üretmeme. |
| V02 | P1 / canlı + DOM | Dar Kişiler görünümünde ikinci kişinin adı kısalıyor; içerik genişliği 356 px olmasına rağmen ad kolonu dar. Kayıt tanımak için kullanılan en temel alan alan kaybediyor. | Mobilde adın iki satıra izin vermesi, durumun ikincil satıra geçmesi veya kimlik hücresinin daha fazla alan alması; işlem hedefini koruma. Tam adın ayrıntıda erişilebilirliği ayrıca doğrulanmalı. |
| V03 | P2 / canlı + statik | Dar Kişilerde üç filtre, temizleme ve aktarma satırları nedeniyle ilk veri satırı yaklaşık 550 px aşağıda. Cihazlarda sabit toplu işlem alanı yaklaşık 88 px; yalnız bir cümle için büyük boşluk bırakıyor (`DeviceList.tsx:101`). Operatör önce kontrolleri kaydırıyor. | Mobilde arama + özetli Filtreler düğmesi; gelişmiş filtreleri açılır bölgeye taşıma. Toplu işlem şeridini seçim olunca gösterme; boş durumda kısa yardımcı satır. Filtre etkinliği ve temizleme erişilebilir kalmalı. |
| V04 | P2 / canlı + statik | 13 px gövde, 12 px tablo ve 11 px başlık/yardımcı metin kombinasyonu özellikle yoğun tablolarda küçük görünüyor. Ayarlarda alan etiketleri ve açıklamalar da benzer görsel ağırlıkta. Kaynak: `index.css`, `ui/table.tsx`, `TreePanel.tsx`. Küçük metin tek başına WCAG ihlali değildir. | Ana veri 14 px, etiket 13 px, yardımcı metin 12 px altına inmeme. Başlık ve kayıt kimliği ile meta bilgiyi boyut/ağırlıkla ayırma. |
| V05 | P2 / canlı + statik | Kişilerde sonuç özeti kutu dışında, Cihazlarda kutu içinde. Plan ekranında eylemler başlığa, zaman seçici tabloya bağlı. Dikey aralıklar sayfaya göre 12/16/20/24/32 px değişiyor; `space-y-3/4/5/6/8` kullanımları var. | Tek PageFrame sıra ve boşluk sözleşmesi; tablo altlığı aynı yerde. Takvim araçları içerik araç çubuğunda kalmalı; sayfanın ana eylemi başlıkta kalmalı. |
| V06 | P2 / canlı + statik | Mobil Ayarlar inputları DOM ölçümünde 36 px yükseklikte; PDKS arama ve düğmeleri ise 44 px. `Input` ve varsayılan `Button` h-9, bazı sayfalar yerel min-h-11 ekliyor. Bu doğrudan WCAG 2.5.8 başarısızlığı değildir; standart 24 px ve aralık istisnaları ayrıca değerlendirilir. | Dokunmatik görünümde ortak 44 px ergonomi hedefi. Masaüstünde kontrollü 36 px kontroller; satır menüsü/onay kutusu gerçek hedef alanı ayrıca ölçülmeli. |
| V07 | P2 / statik | Ortak kabuk 761 px, bazı personel kolonları 760 px, genel md stilleri 768 px, ağaç 1100 px kullanıyor. Eşikler farklı işlere hizmet edebilir ancak belgesiz 760–768 aralığı farklı yoğunluk üretebilir. | Kabuk/telefon, içerik/iki sütun ve tablo kolon eşiklerini adlandırıp belgelemek. 760/761/767/768/1099/1100 px geçişlerini regresyon kontrolüne almak. Bu aralıkta canlı hata kanıtlanmadı. |
| V08 | P2 / statik | `canvas/background`, `surface/card`, `text/foreground`, `line/border` ve `side/sidebar` çift token ailesi mevcut; başlangıçta eş değerler içeriyor. Ayrı bakım zamanla ayrışma riski taşır. Bazı mor durum stilleri doğrudan HSL yazıyor. | Tek kanonik token seti, bileşen kütüphanesinin adlarına alias. Renk değerlerini sayfa içinde yeniden tanımlamama; durumlar semantik tokenlardan gelmeli. |
| V09 | P2 / statik | Table bileşeni yalnız `scrollLabel` verilirse adlandırılmış/odaklanabilir kaydırma bölgesi oluşturuyor. Cihazlar bunu veriyor; Kişiler vermiyor. Gelecekte kolon minimumlarıyla kaydırma eklendiğinde klavye erişimi farklılaşabilir. | Kaydırılan bütün veri bölgelerinde aynı adlandırma/odak sözleşmesi. Şu an Kişiler için yatay klavye kaydırma hatası canlı olarak gösterilmedi. |

Ayarlar ekranında “Genel bildirim tercihi (eski kayıt)” açıklaması bu anahtarın gönderimi durdurmadığını söylüyor. Bu canlı metin ürün içi teknik mirası kullanıcıya taşıyor; gerçek eylem etkisini anlatan etiketle sadeleştirmek gerekir. İşlev doğruluğu bu denetimin kapsamında test edilmedi.

## Önerilen tasarım yönü: sakin operasyon masası

Ayırt edici öğe mevcut bordo navigasyon ve tek ana eylem olsun. Geri kalan yüzeyler nötr, çizgiler işlevsel, içerik sola hizalı olsun. Kart ızgarası, gradient, büyük pazarlama metrikleri ve dekoratif animasyonlar eklenmesin. Ürün karakteri çalışan kimliği, kapı/cihaz kapsamı, bağlantı durumu ve İstanbul saatinin açık ifade edilmesinden gelsin.

İki seçenek değerlendirildi: her bölümü ayrı kartlara ayırmak veya tek veri çalışma alanı kullanmak. Kart yaklaşımı liste/kalender taramasını parçalayacağı için elendi; ortak kabuk içinde tek çalışma yüzeyi seçildi. “Tek şablon” aynı içerik sırası ve eylem davranışlarıdır; ayar formu, günlük ajanda ve personel tablosu kendi görevlerine uygun içerik türünü korur.

### Altı çekirdek renk tokenı

| Token | Hex | Kullanım |
|---|---|---|
| canvas | `#FAFAFA` | Sayfa zemini |
| surface | `#FFFFFF` | Form/veri çalışma yüzeyi ve üst çubuk |
| text | `#252523` | Ana veri, başlık, etiket |
| mutedText | `#646461` | Yardımcı bilgi; kritik kimlik verisi için kullanılmaz |
| line | `#E2E2E0` | Bölüm ve satır ayırıcı; etkileşimli alan sınırı için tek başına kullanılmaz |
| primary | `#7A1F1F` | Ana eylem, seçili öğe vurgusu, klavye odağı; mevcut bordo kimliğe yakın |

Bunlar çekirdek palettir. Mevcut başarı/uyarı/hata/bilgi durum tokenları ayrı semantik katman olarak korunmalı; ana eylem ile silme/kritik alarm aynı anlama gelmemeli. Sidebar, seçili yüzey, hover, kontrol sınırı ve koyu tema bu rollerden türeyen açıkça tanımlanmış varyantlar olmalı. Line dekoratif ayırıcıdır; input sınırı ve focus için mevcut daha güçlü control/ring rolleri gerekir. Yeni bileşimlerde metin için 4.5:1, gerekli UI sınırı ve odak göstergelerinde 3:1 hedefi ölçülerek doğrulanmalı; bu rapor tam kontrast taraması değildir.

### Tipografi ve ölçüler

Mevcut sistem sans ailesi korunsun: `-apple-system, BlinkMacSystemFont, Segoe UI, Arial, sans-serif`. Operasyon ürününde yeni font indirmek yerine Türkçe adların okunaklılığı ve platform davranışı öncelikli. Sayfa başlığı 26/34 px 600, mobil 24/32 px; bölüm başlığı 18/26 px 600; ana metin ve veri 14/20 px 400; kontrol etiketi 13/18 px 500; yardımcı bilgi 12/18 px 400. Ekran başına aynı anda en fazla dört rol öne çıksın. Saat, süre ve sayılarda tabular-nums; personel adlarında doğal harf aralığı. Açıklama satırları mümkünse 65–80 karakteri geçmesin.

Boşluklar: 4 px alt birim; 8 px ikon/metin, 12 px ilişkili kontroller, 16 px panel içi/mobil kenar, 24 px bölümler, 32 px masaüstü sayfa kenarı. Her sayfa `space-y-*` değerini kendi seçmesin. Başlık–içerik 24 px; filtre–veri 16 px. Form alanları 16 px, form bölümleri 32 px. Köşeler kontrollerde 6 px, büyük yüzeylerde en fazla 8 px; gölge yalnız üstte yüzen menü/dialogda.

Masaüstü kontroller 36 px; dokunmatik 44 px. Ana tablo satırı normal 48 px, isteğe bağlı yoğun mod 42 px; mobil kimlik/meta satırı gerektiğinde 64 px veya içerik kadar. Ana kimlik kırpılmadan önce ikincil kolonlar azaltılmalı. Büyük boş sayfayı doldurmak için gereksiz istatistik kartları eklenmemeli.

## Birleşik sayfa tel çerçevesi

```text
Masaüstü
┌──────────────┬───────────────────────────────────────────────────┐
│ NGS Plus     │ Aktif proje     İçerik yolu       Ara     Hesap   │
│              ├───────────────────────────────────────────────────┤
│ Ana menü     │ Başlık + kapsam             İkincil  [Ana eylem] │
│              │ [Varsa durum/uyarı: neden + sonraki adım]         │
│              ├──────────────┬────────────────────────────────────┤
│              │ Kapsam ağacı │ Arama   Filtreler      Görünüm ⋯  │
│              │ veya bölüm  │ [Yalnız seçim varsa toplu işlem]   │
│              │ navigasyonu │ Tablo / takvim / form              │
│              │ (isteğe bağlı)│ Sonuç sayısı        Sayfalama    │
└──────────────┴──────────────┴────────────────────────────────────┘

Telefon
┌──────────────────────────────────┐
│ Menü   Aktif proje   Ara   Hesap  │
├──────────────────────────────────┤
│ Başlık                           │
│ Kapsam                  [Eylem]  │
│ [Kapsam/bölüm seçici]             │
│ Arama             [Filtreler (n)] │
│ [Etkin filtre özeti / Temizle]    │
│ [Seçim varsa toplu işlem]        │
│ Kimlik + durum / ajanda / form   │
│ Sonuç sayısı / Sayfalama          │
└──────────────────────────────────┘
```

- Global kabuk: mevcut 64 px üst çubuk, sabit konumda proje ve hesap; mobil menü açıldığında odak yönetimi ve Escape ile kapanma sonraki uygulama testine dahil edilmeli.
- PageFrame: tek H1, isteğe bağlı kapsam, tek baskın sayfa eylemi, daha seyrek işlemler menüsü, uyarı slotu ve içerik. Özet metrikler yalnız görev için gerekliyse eklenir.
- ContentFrame: isteğe bağlı 220 px bağlam paneli, esnek min-width:0 çalışma alanı. Formlar yaklaşık 800 px ile sınırlanabilir; tablolar kullanılabilir genişliği alır. Bu fark şablon istisnası değil içerik varyantıdır.
- ListWorkspace: FilterBar → koşullu BulkBar → veri/boş/yükleniyor/hata → ortak PaginationBar. Kayıt kimliği, durum ve işlemler aynı sırada kalır. İçe/dışa aktarma başlığın ana eylemiyle yarışmamalı; görünürlük kullanım sıklığıyla belirlenmeli.
- PlanWorkspace: aynı başlık ve kapsam; içerik araç çubuğunda tarih ve görünüm. Masaüstünde ızgara, dar görünümde mevcut günlük ajanda yaklaşımı korunur. Kapsam ve zaman dilimi belirgin kalır.
- FormWorkspace: bölüm başlığı ve açıklama, alan grupları, hata özeti/alan hatası, tutarlı kaydet/iptal alanı. Bu denetimde kaydetme çalıştırılmadı.

## Uygulamaya geçiş için kabul kontrolü

1. Önce ortak PageFrame/ContentFrame/Toolbar/ResultFooter sözleşmesi belirlenmeli; mevcut PageHeader, MasterDetailListLayout, FilterBar, TreePanel ve Table tekrar kullanılmalı. Görsel yakınlık için paralel bileşen aileleri oluşturulmamalı.
2. Kişiler, Cihazlar, Vardiya planı ve Ayarlar pilot ekranları aynı başlık, kenar, yoğunluk ve odak kurallarıyla onaylanmalı. Ana ad/kimlik alanlarının okunurluğu gerçek uzun Türkçe içerikle kontrol edilmeli.
3. 390, 760, 761, 767, 768, 1099, 1100 ve 1440 px; 200% zoom; boş/yüklü/uzun liste; kaydırılan tablo ve günlük ajanda durumları doğrulanmalı.
4. Klavyeyle menü, filtre, satır ayrıntısı ve geri dönüş sırası; Escape/odak geri dönüşü; görünür focus; durumların renk olmadan anlamı; form hata ilişkileri ve kontrast ölçülmeli.
5. Bu belge uygulama yapmaz. Kaynak kod değişmediğinden build/lint/test çalıştırılmadı; kanıt, canlı salt okunur inceleme ve kaynak analiziyle sınırlıdır.
