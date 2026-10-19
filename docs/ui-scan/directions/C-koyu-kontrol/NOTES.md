# C — Koyu kontrol odası

NGS Plus, güvenlik ve İK ekiplerinin gün boyunca açık tuttuğu bir çalışma konsolu olarak ele alındı. Sıcak antrasit yüzeyler, açık bordo vurgu ve sık satır ritmi ile geçiş sonucu, kişi ve cihaz adı aynı bakışta okunur. Ana sayfada en belirgin alan son kart okutma akışı; kişi yönetiminde aynı düzen departman, filtre ve seçim kapsamını görünür tutar.

## Tasarım planı ve eleştiri

İlk plan: sıcak antrasit `#1E1D1B`, yüzey `#262522`, yükseltilmiş yüzey `#302E2A`, çizgi `#49453F`, ana metin `#F3F0EA`, açık bordo `#E3A299`; yerel sans serif ve sola hizalı tablo düzeni.

```text
220px menü | Proje seçimi                         Tema / hesap
           | Sayfa başlığı                       Tarih / eylem
           | Dört gerçek metriği taşıyan ortak şerit
           | Son kart okutmaları (geniş) | Aktivite özeti
           | Metin bağlantılarıyla hızlı erişim
Kişiler    | Departmanlar | Arama / durum / sonuç kapsamı
           |             | Seçim çubuğu / personel tablosu
```

İlk değerlendirmede ayrı ayrı dört ikon kartı ve cihazlara dair dekoratif bir “çevrimiçi” paneli çıkarıldı: aynı ölçüde kart tekrarını azaltmak ve kaynakta olmayan bağlantı verisini icat etmemek için. Ayırt edici karar; son geçişin sonucu ile kişinin kimliğini ön plana alan, ikon kutuları ve grafik gösterisi içermeyen operasyon tablosu. Yüzey ayrımı renk tonu ve çizgiyle kuruldu; gölge, parıltı, neon, gradyan ve hareketli giriş yok.

## Dosyalar ve kullanım

- `home.html`: varsayılan koyu Ana Sayfa, son on okutma ve gerçek metrik türleri.
- `people.html`: departman ve durum filtresi, Türkçe arama, satır/tümünü seçme, toplu işlem önizlemesi, boş ve yükleme örnekleri.
- Her dosya tek başına `file://` üzerinden açılır; CSS, JavaScript ve SVG içeridedir. Harici ağ, font veya paket gerekmez.
- Üstteki tema düğmesi `html.light` sınıfını açıp kapatır. Her iki sayfada açık tema hazırdır; varsayılan koyudur ve işletim sistemi tercihi varsayılanı değiştirmez.
- Kişiler ilk açılışında iki seçili satır vardır; seçim çubuğunun tasarımını göstermek içindir. Arama/departman/durum değişiminde seçim silinir; başlık kutusu kısmi seçimde `indeterminate` olur.
- “Önizleme” seçicisi boş/yükleniyor durumlarını gösterir. Sıfır arama sonucu da gerçek filtre davranışıyla boş duruma geçer.
- Kaydetme, silme ve cihazlara gönderme işlemleri uygulanmaz; adları belirten salt okunur bir önizleme diyaloğu açılır. Diğer menü öğeleri kapsam mesajı gösterir; iki tamamlanmış ekran birbirine yerel bağlantıyla gider.

## Renk token'ları

| CSS token | Rol | Koyu | Açık |
|---|---|---|---|
| `--bg` | Zemin | `#1E1D1B` | `#F3F2EF` |
| `--surface` | Yüzey | `#262522` | `#FFFFFF` |
| `--raised` | Yükseltilmiş yüzey / tablo başlığı | `#302E2A` | `#EAE7E2` |
| `--line` | Dekoratif ayırıcı çizgi | `#49453F` | `#D1CCC4` |
| `--control` | Kontrol sınırı | `#827A70` | `#847C72` |
| `--selected` | Seçili satır / etkin menü | `#44312E` | `#F2E3DF` |
| `--text` | Ana metin | `#F3F0EA` | `#292622` |
| `--muted` | İkincil metin | `#BBB5AB` | `#655F57` |
| `--primary` | Birincil eylem / vurgu / odak | `#E3A299` | `#823D35` |
| `--on-primary` | Birincil düğme metni | `#241815` | `#FFFFFF` |
| `--danger` | Tehlike / ret | `#F0A89F` | `#993E34` |
| `--warning` | Uyarı | `#E7C17C` | `#795714` |
| `--success` | Başarı / aktif | `#A6C9B1` | `#386449` |
| `--info` | Bilgi | `#A8C9DD` | `#315E78` |

`--focus` = `--primary`. Opak renkler kullanılır; metin kontrastı alfa karışımına bağlı değildir. Bilgi rengi gerektiğinde kullanılabilecek semantik token olarak hazırdır; gereksiz bilgi rozeti eklenmedi.

## Tipografi ve ölçüler

Font: `'Segoe UI', 'Helvetica Neue', Arial, sans-serif`; cihazda olan ilk aile kullanılır, font indirilmez. Tüm sayılar tabular-nums; saat, kart ve bordro numarası için ayrı monospace yüzü kullanılmaz.

| Rol | px / satır yüksekliği / ağırlık |
|---|---|
| Tablo başlığı, kapsam ve alt bilgi | 11 / 16.5 / 400–600 |
| İkincil bilgi, durum rozeti | 12 / 18 / 400–600 |
| Gövde ve gezinme | 14 / 21 / 400–600 |
| Bölüm başlığı | 17 / 24 / 650 |
| Sayfa başlığı | 28 / 36 / 650 |
| Metrik | 32 / 36 / 600 |

Tablo gövdesi ve kompakt düğmeler 13/19.5 px ara ölçüsünü kullanır. Mobilde başlık 25/32 ve metrik 28/36 olur.

| Token / ölçü | Değer ve kullanım |
|---|---|
| Spacing | `--space-1/2/3/4/6/8`: 4 / 8 / 12 / 16 / 24 / 32 px |
| Masaüstü kabuk | 220 px menü, 72 px üst çubuk, 32 px yatay içerik boşluğu |
| Radius | Yüzey/düğme 6 px; giriş 5 px; menü 4 px; avatar daire |
| Gölge | Yok; modal arkasında yalnız yarı opak perde |
| Odak | 2 px kesintisiz `--focus`, 4 px offset; kaydırma alanında içte |
| Satır | Ana sayfa 47 px; iki satırlı kişi kimliği yaklaşık 57 px |
| Kontroller | Masaüstü düğme 38 px; gezinme en az 42 px; mobil departman en az 40 px |

## Bileşen kuralları

- **Buton:** Sayfa başına bir dolu birincil eylem (Yeni personel). Çerçeveli düğme ikincil eylem; sessiz metin gezinme/temizleme; tehlike rengi yalnız silme/ret anlamında. Toplu seçim önce hedef kişileri açıklar; önizleme gerçek başarı bildirimi üretmez.
- **Tablo:** Tek başlık satırı, ince yatay ayırıcı, tabular saat/kimlikler; kişi adı ve departman yanında ikinci bilgi satırı. Tüm satıra gizli düzenleme davranışı yerine kişi adı ayrı erişilebilir düğmedir. Yatay kaydırma yalnız odaklanabilir ve adlandırılmış tablo kapsayıcısındadır.
- **Rozet:** Dolgu kutusu yerine 12 px metin + açık biçim: onay işareti/izin verildi, çarpı/reddedildi, eksi/pasif, üçgen/uyarı. Renk tek anlam taşıyıcısı değildir. Ret satırı yüzey tonuyla ek ayrım kazanır.
- **Boş durum:** Net başlık, filtre etkisini anlatan bir cümle, filtreleri temizleme eylemi. Yüklenirken metin + durağan iskelet ve `role=status` / `aria-busy` kullanılır; sıfır veri gibi gösterilmez.
- **Sidebar:** İstenen 13 öğenin sırası aynen korunur. Etkin öğede bordo tonlu dolgu ve `aria-current=page`; mobilde menü açma/kapama, Escape ve odak geri dönüşü vardır. Proje ve hesap üst çubukta kalır.
- **Sayfa başlığı:** Bir h1, altında aktif proje bağlamı; sağda gün veya tek ana eylem. Sayfa düzeyinde proje toplamı ile filtreli sonuç sayısı ayrı yazılır.
- **Duyarlılık:** 960 px altında menü çekmecesi; 700 px altında özet iki kolon, aktivite özeti tablonun altı, departmanlar kaydırılabilir yatay liste. 390 px'de belge yatay taşmaz; geniş tablo kendi içinde kayar.
- **Erişilebilirlik:** Türkçe belge dili, atlama bağlantısı, gerçek button/input/label/table yapıları, başlık hiyerarşisi, tüm ikon düğmelerinde isim; dekoratif SVG'ler `aria-hidden`. Animasyon yok; reduced-motion kuralı ekli.

## Mevcut arayüzden beş büyük fark

1. Bordo menü + lacivert siyaha yakın zemin yerine nötr, hafif sıcak antrasit yüzey hiyerarşisi; açık tema ayrıca tamamlanmış.
2. Dört bağımsız istatistik kartı ortak bir şeritte; son kart okutma tablosu sayfanın esas çalışma alanı.
3. Tekrarlayan ikon kutuları, kart içinde kart ve gölgeli hızlı erişim kartları kaldırıldı; hızlı erişim ince bir bağlantı satırı.
4. Kişi listesindeki departman yapısı korunurken ayrı kartlı üst özet yerine proje kapsamı, filtre ve seçim bilgisi birlikte okunuyor.
5. Durum metni + farklı ikon, hesaplanmış kontrast, görünür klavye odağı ve filtre değişince temizlenen seçim aynı tasarımın parçası.

## Kaynakla eşleşme ve sınırlar

`src/pages/Index.tsx`, `useDashboard.ts` ve beş dashboard bileşeni esas alındı: toplam personel, aktif cihazlar, bugünkü geçişler, pasif erişim kuralları; çalışma saatleri, ortalama ilk giriş/son çıkış, geç kalanlar, mevcut personel; son okumalarda tarih/saat, personel, cihaz ve erişim sonucu. Kişilerde `Employees.tsx`, EmployeeFilters/Stats/Table/BulkActions ve departman yapısı esas alındı; ad, e-posta, departman, pozisyon, kart, bordro ve aktiflik mevcut alanlardır. Kabuk ve mevcut tema ile üç UX belgesi incelendi.

Kişiler ve sayılar kurmaca örnek veridir; üretim verisi çekilmedi. 12 personel iki ekranda tutarlıdır; kişilerin 11'i aktif, 1'i pasiftir. Son on okuma toplam günlük 148 okumanın bir kesitidir; ret alan kişinin aktif olması ile belirli kapıdan erişiminin reddedilmesi farklı bilgilerdir.

**Canlı durum sınırı:** Dashboard'da aktif cihaz sayısı var, cihaz/kapı başına doğrulanmış çevrimiçi telemetri alanı yok. Bu nedenle “4 çevrimiçi” gibi uydurma bir metrik eklenmedi; dört aktif cihaz ve son kart okutma akışı kaynak alanlarıyla sunuldu. Akış örneği sabittir, otomatik sahte olay üretmez; gerçek abonelik ve kapı/cihaz bağlantı durumları bu görsel prototipin entegrasyon aşamasına kalır. Çoklu proje seçici yapısı görünür; tek örnek proje içerir ve sayfa geçişinde tema tercihi kaydedilmez.

## WCAG AA kontrast hesabı

WCAG sRGB bağıl parlaklık hesabı: kanal ≤ 0.04045 ise c/12.92, aksi halde ((c+0.055)/1.055)^2.4; L = 0.2126R + 0.7152G + 0.0722B. Oran = (L açık + 0.05)/(L koyu + 0.05). Aşağıdaki her hücre ayrı metin/zemin çiftidir ve normal boyutlu metin için ≥4.5:1 koşulunu geçer; büyük metin istisnasına ihtiyaç yoktur.

| Tema / metin (hex) | Zemin | Yüzey | Yükseltilmiş yüzey | Seçili yüzey |
|---|---:|---:|---:|---:|
| Koyu / `text` `#F3F0EA` | 14.81:1 | 13.48:1 | 11.91:1 | 10.71:1 |
| Koyu / `muted` `#BBB5AB` | 8.27:1 | 7.53:1 | 6.65:1 | 5.98:1 |
| Koyu / `primary` `#E3A299` | 7.94:1 | 7.22:1 | 6.38:1 | 5.74:1 |
| Koyu / `danger` `#F0A89F` | 8.67:1 | 7.89:1 | 6.97:1 | 6.27:1 |
| Koyu / `warning` `#E7C17C` | 9.88:1 | 8.99:1 | 7.95:1 | 7.14:1 |
| Koyu / `success` `#A6C9B1` | 9.31:1 | 8.47:1 | 7.49:1 | 6.73:1 |
| Koyu / `info` `#A8C9DD` | 9.68:1 | 8.80:1 | 7.78:1 | 7.00:1 |
| Açık / `text` `#292622` | 13.45:1 | 15.06:1 | 12.21:1 | 12.07:1 |
| Açık / `muted` `#655F57` | 5.64:1 | 6.31:1 | 5.12:1 | 5.06:1 |
| Açık / `primary` `#823D35` | 7.03:1 | 7.87:1 | 6.38:1 | 6.31:1 |
| Açık / `danger` `#993E34` | 6.06:1 | 6.79:1 | 5.50:1 | 5.44:1 |
| Açık / `warning` `#795714` | 5.89:1 | 6.59:1 | 5.34:1 | 5.28:1 |
| Açık / `success` `#386449` | 6.08:1 | 6.80:1 | 5.52:1 | 5.45:1 |
| Açık / `info` `#315E78` | 6.25:1 | 6.99:1 | 5.67:1 | 5.60:1 |

Zemin/yüzey hex değerleri yukarıdaki token tablosundadır. Birincil düğme eşleşmeleri:

| Tema | Metin | Dolgu | Oran |
|---|---|---|---:|
| Koyu | `#241815` | `#E3A299` | 8.13:1 |
| Açık | `#FFFFFF` | `#823D35` | 7.87:1 |

Dekoratif ayırıcı çizgi metin değildir ve 4.5:1 kuralının hedefi değildir; giriş/düğme sınırları için ayrıca `--control` kullanılır. Odak halkası bordo ile çevreleyen yüzey arasında koyuda en az 5.74:1, açıkta en az 6.31:1 sağlar.

## Doğrulama

- Python HTMLParser ile iki dosyada kapanış sırası, benzersiz ID ve harici URL bulunmaması denetlendi; JavaScript `node --check` geçti.
- Orca tarayıcısında her iki dosya `file://` ile açıldı; ekran görüntüleriyle koyu masaüstü ve mobil açık tema incelendi.
- 1440 × 1000 ve 390 × 844 boyutlarında taşma ölçüldü. Personel tablosundaki erişilebilir gizli başlığın konumlandırmasından kaynaklanan belge taşması düzeltildi; sonuçta `documentElement.scrollWidth` 390 viewport'ta 375 px (15 px kaydırma çubuğu), 1440 viewport'ta 1425 px.
- Kişiler: Ayşe araması 1 sonuç; Üretim filtresi 5 sonuç; tümünü seçme 5 kişi; filtre değişince seçim temizlenmesi; sıfır sonuç, yükleme, toplu gönderim önizleme diyaloğu kontrol edildi. Tarayıcı konsolunda hata yok.
- İki tema toplam 58 metin/zemin çifti sayısal olarak kontrol edildi; en düşük oran 5.06:1.
- Uygulama kaynakları, veritabanı ve paketler değiştirilmedi. Tam uygulama testleri bu bağımsız HTML tasarım tesliminin kapsamında değildir.
