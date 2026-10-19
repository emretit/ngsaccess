# A — Sade nötr + bordo vurgu

## Fikir
NGS Plus, İK ve güvenlik yöneticisinin gün içinde tekrar tekrar açtığı sakin bir çalışma alanı olarak ele alındı. Beyaza yakın nötr zemin, açık sidebar ve ince ayırıcılar bilgiyi düzenlerken bordo yalnız birincil eylemi, aktif menüyü, klavye odağını ve seçili durumu işaretler. Hiyerarşi dekoratif kartlarla değil, tipografi, hizalama ve 42px satır ritmiyle kurulur.

## Tasarım planı ve brief kontrolü
- Ana palet: `#fcfcfc` zemin, `#ffffff` yüzey, `#f7f7f6` sidebar, `#e2e2e0` çizgi, `#252523` metin, `#7a1f1f` bordo.
- Düzen: 216px kalıcı sidebar; 64px üst çubuk; 32px içerik kenarı. Sayfa başlığı ve içerik sola, sayısal değerler sütun ritmine hizalıdır.
- Ana Sayfa: başlık → mevcut dört sayaç → aktivite özeti / hızlı erişim → son 10 okuma. Kişiler: başlık → küçük sayaç özeti → filtreler → bağlamsal toplu işlem → liste.
- Brief eleştirisi: üç büyük hızlı erişim kartı ve üç renkli kişi istatistik kartı tekrarlı SaaS şablonuna dönüştüğü için kaldırıldı. Yerlerine çizgiyle ayrılan bağlantılar ve tek satırlık sayaçlar kullanıldı; dashboard'daki dört gerçek metrik korundu.

## Tokenlar

| Token | Hex | Rol |
|---|---|---|
| `--canvas` | `#fcfcfc` | Sayfa zemini |
| `--surface` | `#ffffff` | Tablo, buton ve diyalog yüzeyi |
| `--sidebar` | `#f7f7f6` | Açık sidebar, tablo başlığı |
| `--subtle` | `#f3f3f2` | Hover, nötr rozet |
| `--line` | `#e2e2e0` | Dekoratif 1px ayırıcı |
| `--control` | `#858582` | Arama/select kontrol sınırı |
| `--text` | `#252523` | Ana metin |
| `--muted` | `#646461` | İkincil metin, placeholder, küçük etiket |
| `--primary` | `#7a1f1f` | Birincil buton, aktif menü, odak, seçim |
| `--primary-hover` | `#611919` | Birincil buton hover |
| `--selected` | `#f8eeee` | Seçili satır ve menü zemini |
| `--success` / `--success-bg` | `#356047` / `#edf4ef` | İzin verildi, aktif |
| `--warning` / `--warning-bg` | `#795619` / `#faf3e5` | Uyarı; ihtiyaç olursa, mevcut örnekte kullanılmadı |
| `--danger` / `--danger-bg` | `#963e36` / `#faefed` | Reddedildi, sil eylemi |
| `--info` / `--info-bg` | `#3b5c76` / `#edf2f7` | Bilgi; ihtiyaç olursa, mevcut örnekte kullanılmadı |
| Avatar | `#ececea` | Nötr baş harf yüzeyi |

### Tipografi
Font: `-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif`. macOS'ta sistem arayüz fontu, Windows'ta Segoe UI kullanılır; font dosyası veya ağ isteği yoktur. Poppins'in geniş geometrik harfleri yerine küçük boyutta yerleşik arayüz okunaklılığı ve daha ekonomik tablo genişliği tercih edildi; işletim sistemleri arasında küçük metrik farklılıkları beklenir.

| Kullanım | Boyut / satır yüksekliği | Ağırlık |
|---|---|---|
| Küçük etiket / rozet | 11 / 16.5px (rozet 18px) | 400–500 |
| Tablo ve yardımcı metin | 12 / 18px | 400–550 |
| Gövde / menü | 13 / 19.5px | 400–600 |
| Bölüm başlığı | 16 / 24px | 600 |
| Sayfa başlığı | 26 / 34px; mobil 24 / 32px | 600 |
| Metrik | 30 / 40px; mobil 27 / 34px | 550 |

- Spacing: 4, 8, 12, 16, 24, 32px; iki ana içerik sütunu arasında 48px. Mobil içerik kenarı 16px.
- Radius: kontroller/tablo 6px; rozet ve menü 4px; diyalog 8px. Avatar daire.
- Gölge: `--shadow: none`; yüzeylerde gölge yok. Mobil menünün arkasındaki nötr karartma yalnız katman kapsamını gösterir.
- Odak: 2px `#7a1f1f` outline, 3px offset. `--focus` eşdeğer çift halkalı uygulama tokenıdır; HTML görünür odağı outline ile uygular.
- Tablo: `--row: 42px`, başlık 36px. Sayı/tarih/kart/bordro kolonlarında `font-variant-numeric: tabular-nums`.

## Bileşen kuralları
- **Buton:** tek baskın bordo eylem “Yeni personel”; ikincil eylemler beyaz yüzeyli ince kenarlık; üçüncül eylemler nötr metin. Sil eylemi semantik tehlike rengi, kaydetme gibi gösterilmez. Kapsam dışı eylem tıklandığında önizleme açıklaması açılır; başarı taklidi yapılmaz.
- **Tablo:** zebra yok, 1px yatay çizgi var. Seçili satır düşük yoğunluklu bordo zemin ve işaretli checkbox ile anlaşılır. Satır işlemleri tek adlandırılmış menü düğmesinde toplanır. Fotoğraf bulunmadığında nötr baş harf gösterilir.
- **Rozet:** 11px metin + küçük nokta; renk tek başına anlam taşımaz. Departmanlar düz metin, pasif kişi nötr rozet; pasiflik hata sayılmaz.
- **Boş durum:** sebep ve yapılabilir sonraki adım birlikte görünür. Kişilerde gerçek boş arama sonucu ve ayrıca açılıp kapanan örnek durum bölümü var. Yükleme örneğinde bölüm içi sabit iskelet ve `role=status` kullanılır; hareket yok.
- **Sidebar:** brief'teki 13 öğe aynı sırada; aktif öğede ince bordo gösterge ve seçili zemin. Logo ve pasif ikonlar nötr. Proje seçimi üst çubukta her genişlikte görünür.
- **Başlık:** tek h1, altında proje kapsamı. Ana Sayfa selamlama içerir; Kişilerde sayfa eylemi başlığın karşısındadır.
- **Komut paleti:** üst çubuktaki arama düğmesi veya ⌘K / Ctrl+K ile açılır; iki teslim ekranını arar, bağlantıyla geçiş yapar, Escape ile kapanır. Yerel `dialog` odak davranışı kullanılır.
- **390px:** sidebar menü düğmesine dönüşür; üst arama ikinci satır olur; özet iki sütun, ana içerik tek sütun. Tablo 42px satırları koruyarak yalnız kendi bölgesinde yatay kayar; tablo bölgesi klavyeyle odaklanabilir.

## Mevcut arayüze göre beş büyük fark
1. Tam bordo sidebar yerine nötr sidebar ve dar aktif gösterge; marka rengi ekrandaki veriden rol çalmaz.
2. Poppins, gölgeli/yuvarlak kart kümeleri yerine sistem fontu, 1px ayırıcı ve farklı metin ölçekleri.
3. Proje seçimi ile komut paleti üst çubukta kalıcı; mobilde proje kapsamı kaybolmaz.
4. Dashboard hızlı erişim kartları sade bağlantı listesine, kişi istatistikleri küçük metin özetine dönüşür.
5. Kişi tablosunda 42px yoğunluk, tek satır işlem menüsü, nötr departman metni ve görünür seçim çubuğu; bordo yalnız seçimi taşır.

## İçerik kaynağı ve sınırlar
Okunan kaynaklar: `src/pages/Index.tsx`, `src/hooks/useDashboard.ts`, `src/components/dashboard/*`, `src/pages/Employees.tsx`, `EmployeeTable`, `EmployeeFilters`, `EmployeeStats`, `EmployeeBulkActions`, Layout/AppSidebar ve tema dosyaları; `docs/ux-audit/DESIGN_SYSTEM.md` ve ilgili iki audit. Audit'teki eski veri hataları güncel bileşenlere göre kontrol edildi: “Bekleyen istek” kullanılmadı; gerçek güncel alan olan “Pasif erişim kuralları” korundu.

Sayılar ve isimler **görsel yerleşim için örnek veri**; canlı DB'den okunmadı. Yeni metrik eklenmedi: dört sayaç, beş aktivite alanı, son okumalarda dört kolon ve Kişilerde mevcut on kolon kullanıldı. İnsan Kaynakları (3), Mühendislik (3), Operasyon (4) toplam 10 kişi; 8 aktif, 2 pasif. Her iki HTML tek başına açılır, aralarındaki gezinme yerel kardeş dosyaya yapılır.

Arama, departman filtresi, seçim/tümünü seç, seçimi temizle, boş sonuç, örnek durum aç/kapat ve komut paleti etkileşimlidir. Örnek listede TC numarası tutulmaz; arama gerçek uygulamadaki alan adını korur, burada görünen örnek alanları tarar. Departman yazma, cihazlara gönderme, silme, yeni kişi, kişi detayları, proje/hesap menüsü ve diğer modüller açıklama diyaloğu düzeyindedir; backend işlemi yoktur. Bu 10 kayıtlık örnekte 10/50/100 sayfa boyutu seçenekleri aynı tek sayfayı verir, önceki/sonraki devre dışıdır. Departman ağacı bu yön için tek düzey select filtresine indirgenmiştir; alt departman hiyerarşisi üretim uygulamasında ayrıca tasarlanmalıdır.

## WCAG AA metin kontrastı
sRGB kanalları doğrusal ışığa dönüştürülerek `L = 0.2126 R + 0.7152 G + 0.0722 B`, oran `(L_açık + 0.05) / (L_koyu + 0.05)` formülüyle Python'da hesaplandı. Aşağıdaki tüm metin çiftleri küçük metin için 4.5:1 eşiğini geçer; büyük metin istisnasına dayanılmaz. Bu tablo tüm ürün için tam erişilebilirlik sertifikası değildir.

| Metin / zemin çifti | Metin | Zemin | Oran |
|---|---|---|---|
| Ana metin / yüzey | `#252523` | `#ffffff` | 15.36:1 |
| Ana metin / zemin | `#252523` | `#fcfcfc` | 14.97:1 |
| Ana metin / sidebar | `#252523` | `#f7f7f6` | 14.32:1 |
| Ana metin / hover | `#252523` | `#f3f3f2` | 13.83:1 |
| Ana metin / seçim | `#252523` | `#f8eeee` | 13.50:1 |
| İkincil metin / yüzey | `#646461` | `#ffffff` | 5.94:1 |
| İkincil metin / zemin | `#646461` | `#fcfcfc` | 5.79:1 |
| İkincil metin / sidebar | `#646461` | `#f7f7f6` | 5.54:1 |
| İkincil metin / nötr rozet | `#646461` | `#f3f3f2` | 5.35:1 |
| İkincil metin / seçili satır | `#646461` | `#f8eeee` | 5.22:1 |
| Avatar metni / avatar | `#646461` | `#ececea` | 5.02:1 |
| Birincil buton | `#ffffff` | `#7a1f1f` | 10.28:1 |
| Birincil buton hover | `#ffffff` | `#611919` | 12.64:1 |
| Aktif menü ve seçim özeti | `#7a1f1f` | `#f8eeee` | 9.03:1 |
| Başarı rozeti | `#356047` | `#edf4ef` | 6.44:1 |
| Tehlike rozeti | `#963e36` | `#faefed` | 6.13:1 |
| Sil eylemi / seçim alanı | `#963e36` | `#f8eeee` | 6.07:1 |
| Uyarı rozeti tokenı | `#795619` | `#faf3e5` | 6.02:1 |
| Bilgi rozeti tokenı | `#3b5c76` | `#edf2f7` | 6.26:1 |

Odak halkası bordo/beyaz: 10.28:1; bordo/seçili zemin: 9.03:1. Girdi sınırı `#858582` / beyaz: 3.70:1. `--line` dekoratif ayırıcıdır; tek başına giriş sınırı veya durum anlamı taşımaz.

## Doğrulama
- Chrome + mevcut yerel Playwright ile iki dosya `file://` üzerinden 1440px ve 390px genişlikte açıldı, ekran görüntüleri incelendi.
- Her iki genişlikte belge yatay taşması yok (1440/1440 ve 390/390); mobilde tablo kendi içinde kayar. Görünen bütün veri satırları ölçümde 42px.
- Tarayıcı konsolu: 0 hata, 0 uyarı; dış kaynak isteği: 0.
- Kişi aramasında sonuçsuz metin → 0 kişi + boş durum + gizli toplu işlem; filtre sıfırlama → liste; Mühendislik → 3 kişi; tümünü seç → 3 seçili doğrulandı.
- ⌘K → açık komut paleti ve arama alanında odak; Escape → kapanma doğrulandı.
- Python `html.parser` + etiket yığını kontrolü: dengeli etiketler, benzersiz id'ler. Her metin kontrastı ≥4.5:1 assert ile doğrulandı.
- Uygulama kaynaklarına dokunulmadığı için TypeScript/ESLint veya Convex testleri çalıştırılmadı. Kapsam yalnız bu klasördeki üç dosya; commit/push/deploy yok.
