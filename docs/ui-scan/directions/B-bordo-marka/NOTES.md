# B — Bordo marka

## Fikir
NGS Plus’ın tanınan bordo kimliği, düz ve derin bir sol menü ile korunur; sıcak nötr çalışma alanında tablo ve listeler öne çıkar. Büyük sayfa başlıkları ve bağlamı açık bir günlük özet, İK ve güvenlik yöneticisinin ilk bakışta işe başlamasını sağlar. Marka rengi gezinme ve birincil aksiyonları taşırken, tek tamamlayıcı petrol yeşili olumlu durumları ayırır.

## Tasarım planı ve eleştiri
Temel palet: koyu bordo `#551919`, aksiyon bordosu `#6B1A1A`, sıcak zemin `#F5F3EF`, beyaz `#FFFFFF`, koyu metin `#292522`, petrol yeşili `#27645C`.
Arial, Türkçe karakter desteği ve ağsız tek dosyada öngörülebilir metrikleri nedeniyle Poppins yerine seçildi; rakamlar tabular, başlıklar sıkı ve sola hizalıdır.

```text
Bordo menü | Proje seçimi                           Kullanıcı
           | Ana Sayfa / Kişiler                    Birincil aksiyon
Ana Sayfa  | Senkron uyarısı → Bugün giriş yapan / geç kalan
           | Birimli proje göstergeleri, tek satır ve bölücüler
           | Son kart okumaları             Çalışma özeti / kısa liste
Kişiler    | Organizasyon | Arama ve filtreler
           |              | Seçim ve toplu işlem → personel tablosu
```

İlk plandaki bağımsız KPI kartlarını kaldırdım: bu ürünün günlük işi kart keşfetmek değil, kişi ve geçiş kaydı taramak. Sayı bandını dört mevcut alanla, tarih/kapsam/birim açıklamalarıyla kullandım; dekoratif ikon kutuları yok. Ana Sayfa yalnız günlük özet ve son okumalar için iki sınırlandırılmış yüzey kullanır; Kişiler tek çalışma yüzeyidir.

## Tokenlar
Her HTML kendi `<style>` bloğunda aynı `:root` tokenlarını içerir; çalışma anında harici dosya veya ağ isteği yoktur.

| Token | Hex | Rol |
|---|---|---|
| `--bg` | #F5F3EF | Zemin |
| `--surface` | #FFFFFF | Yüzey |
| `--soft` | #F0EDE8 | Tablo başlığı, nötr yüzey |
| `--line` | #DDD7D0 | Dekoratif ayırıcı çizgi |
| `--control` | #8C817B | Form/buton sınırı |
| `--text` | #292522 | Ana metin |
| `--muted` | #6A605B | İkincil metin, yer tutucu |
| `--primary` | #6B1A1A | Birincil aksiyon ve bağlantı |
| `--sidebar` | #551919 | Düz bordo menü |
| `--sidebar-active` | #743131 | Aktif/hover menü yüzeyi |
| `--sidebar-muted` | #E1C8C3 | Pasif menü metni |
| `--brand-soft` | #F7EDEC | Toplu işlem ve seçili organizasyon |
| Seçili satır | #FAF5F3 | Çok hafif bordo satır yüzeyi |
| `--danger` / `--danger-bg` | #6B1A1A / #F7EDEC | Tehlike / reddedilen geçiş |
| `--warning` / `--warning-bg` | #5D4A3E / #F0EDE8 | Uyarı; nötr sıcak aile |
| `--success` / `--success-bg` | #27645C / #EAF3F0 | Başarı; tek tamamlayıcı ton |
| `--info` / `--info-bg` | #27645C / #EAF3F0 | Bilgi; aynı tamamlayıcı ton |
| `--focus` | #27645C | Açık yüzeylerde odak |

Semantik tokenlar farklı anlamlar için korunur, ek vurgu tonu üretilmez. Durumlar yalnız renkle anlatılmaz: “Aktif”, “Reddedildi”, “Pasif” metinleri ve uygun çizgi ikonları bulunur.

### Tipografi
Font: `Arial, "Helvetica Neue", sans-serif`; harici font yok. Altı ana basamak:

| Kullanım | Boyut / satır yüksekliği | Ağırlık |
|---|---|---|
| Yardımcı bilgi | 12 / 18 px | 400–600 |
| Gövde ve kontroller | 14 / 21 px | 400–600 |
| Alt bölüm | 18 / 27 px | 700 |
| Özet ifadesi | 24 / 32 px | 700 |
| Sayfa başlığı | 36 / 44 px | 700 |
| Günlük kişi sayısı | 60 / 68 px | 700 |

Yoğun tablo satırları 13 px, ikincil satır/rozet 11 px; tablo başlığı 12 px; ara bölüm başlığı 20/28 px ve KPI 28/36 px. Mobilde sayfa başlığı 32/40 px, günlük sayı 52/60 px olur. Büyük başlık −1,3 px, büyük sayı −3 px harf aralığı kullanır; veri metni varsayılan aralıktadır.

### Aralık, köşe, gölge ve odak
- Spacing tokenları: 4 / 8 / 12 / 16 / 24 / 32 / 40 px. Masaüstü ana içerik kenarı 40 px, mobil 18 px; sol menü 220 px, üst kabuk 80 px.
- Radius: kontrol ve rozet 4 px, ana yüzey 8 px, `--r-lg:12px` ayrılmış üst sınır; mevcut yüzeylere uygulanmadı. Avatar daire; kartlarda dekoratif yuvarlama yok.
- Statik yüzeylerde gölge yok. Açılan hesap menüsü, mobil menü ve dialog: `0 12px 36px #2925221A`.
- Focus: 3 px `#27645C`, 3 px offset; bordo menüde beyaz. Form sınırları `#8C817B`; dekoratif ince çizgiler kontrol sınırı yerine kullanılmaz.
- Giriş animasyonu yok; `prefers-reduced-motion` altında animasyon ve geçişler kapalı.

## Bileşen kuralları
- **Buton:** sayfa başına bir bordo birincil eylem; ikincil işlem beyaz yüzey ve görünür sınır; gezinme bağlantısı bordodur. Yükseklik 40 px; yoğun toplu işlem kontrolü 34 px. Önizleme kapsamı dışındaki eylem açıklayıcı dialog açar, yapılmamış bir iş için başarı mesajı göstermez.
- **Tablo:** saat ve sonuç tek satır; kişilerde ad/e-posta, departman/pozisyon ve kart/bordro kodu aynı sütunda iki satırdır. Son okumalar 58 px, kişiler 67 px satır yüksekliği; kart içinde kart yok. Seçili satır hafif bordo yüzeyle, checkbox ile ve sayacı olan işlem çubuğuyla belirgindir.
- **Rozet:** 4 px köşe; 11 px kalın metin; minimum 25 px yükseklik. Her zaman durum adı var, dekoratif departman renkleri yok.
- **Boş/yükleniyor:** filtre sonucunda boş liste gerekçesi ve “Filtreleri temizle”; yüklenirken bölüm içinde sabit iskelet ve `role=status`; sahte 0 kişi gösterilmez. Kişiler altındaki “Örnek görünüm” kontrolleri bu iki durumu gösterir.
- **Sidebar:** verilen 13 modül tam sırayla korunur. Aktif sayfa beyaz işaret + dolgu + `aria-current` ile ayrılır. 700 px altında etiketli menü düğmesiyle açılır; Escape ile kapanır, bağımsız kaydırılır.
- **Başlık:** tek h1; aşağısında kapsam/tarih veya iş açıklaması. İşlevsiz “Hoş geldin” yok. Kişilerde proje toplamı ve aktif/pasif dağılımı, filtrelenmiş örnek liste sayısından ayrıdır.
- **Mobil:** organizasyon ağacı kapanır; aynı filtre her zaman departman seçicisinde bulunur. Tablo kendi odaklanabilir bölgesinde yatay kayar; tüm sayfa taşmaz. Filtreler, eylemler ve KPI’lar akışa göre sarılır.
- **Etkileşim:** arama, departman, aktif/pasif filtre, ad sıralama, görünür satırları seçme, seçim temizleme, kişi detayı, örnek durumlar ve iki ekran arası gezinme çalışır. Filtre dışı seçimler temizlenir; görünmeyen kişilere toplu işlem uygulanmaz.

## Mevcut arayüze göre en büyük beş fark
1. Bordo kimlik korunurken koyuluk, aktif menü işareti ve metin kontrastı belirginleşir; içerik tek sıcak zemin üzerinde okunur.
2. Karşılama başlığı yerine mevcut personel ve geç kalma verileriyle işe yarayan günlük özet gösterilir; senkron sorunları ilk bakışta bulunur.
3. Aynı görünüşte tekrar eden istatistik/hızlı erişim kartları yerini bölücülü sayılara, tanım listesine ve sade bağlantı listesine bırakır.
4. Kişiler tablosunda fotoğraf için ayrı kolon kaldırılır; ilişkili alanlar eşlenir, organizasyon ve filtreler aynı iş alanını paylaşır.
5. 36 px başlık ile 13 px veri satırı arasında açık hiyerarşi kurulur; seçim ve boş/yükleniyor durumları ayrıca incelenebilir.

## Veri kaynağı ve sınırlar
Bu bir tasarım önizlemesidir: tüm adlar, sayılar ve kayıtlar örnektir; canlı veri sorgulanmadı. Sayfada bu durum dipnotta belirtilir.

- `src/hooks/useDashboard.ts`, `StatsGrid.tsx`: `employees`, `devices`, `cardReadings`, `pendingRequests`. Son alan mevcut ekrandaki gibi “Pasif erişim kuralları” diye adlandırıldı; bekleyen istek değildir.
- `ActivitySummaryCard.tsx`: `presentToday`, `lateArrivals`, `workHours`, `averageFirstEntry`, `averageLastExit`. “142 kişi giriş yaptı” bugün okuması bulunan personeldir; **anlık içerideki kişi sayısı değildir**. Ortalamalar ve çıkış yokluğu ayrı gösterilir.
- `RecentReadingsTable.tsx`: tarih/saat, personel, cihaz, erişim sonucu. Sütun icat edilmedi; ortak tarih başlıkta, saat satırda.
- `src/components/sync/SyncIssuesBanner.tsx`: aktif proje, cihaz grupları ve yüklenmiş açık hata sayısı. Örnekte iki cihaz/üç hata ve tam yüklenmiş kapsam varsayılır; gerçek entegrasyonda `hasMore/unknown` varsa kesin toplam yerine “yüklenen hata” metni korunmalıdır.
- `Employees.tsx`, `EmployeeTable.tsx`, `EmployeeBulkActions.tsx`, `src/types/employee.ts`: ad, e-posta, departman, pozisyon, kart numarası, bordro kodu ve aktiflik. Durum filtresi var olan `isActive` alanı üzerinde sunum önerisidir.
- Dünkü/geçen haftaki sayaçlar mevcut dashboard sonucunda yok; fark yüzdesi uydurulmadı. KPI bağlamı birim, tarih ve proje kapsamıdır; dönemsel farklar gerçek bir sorgu eklendiğinde kullanılabilir.
- Toplam 186 kişilik örnek projeden 8 temsili kayıt bulunur; filtre ve seçim yalnız bu 8 kayıt üzerinde çalışır. Tam sayfalama, kayıt düzenleme, cihaz işlemleri ve diğer 11 modül bu iki ekranlık teslimin kapsamı dışındadır.
- Font gömülmedi; Arial sistemde bulunmazsa yerel sans-serif yedeği kullanılır. Koyu tema bu yönün kapsamı değil.

## Kontrast hesabı — WCAG AA
sRGB kanalını doğrusal değere çevir: `c ≤ 0.04045 ? c/12.92 : ((c+0.055)/1.055)^2.4`; bağıl parlaklık `L=0.2126R+0.7152G+0.0722B`; oran `(L_açık+0.05)/(L_koyu+0.05)`. Aşağıdaki değerler Python ile hesaplandı; yuvarlanmadan önce normal metin için ≥4,5 şartı doğrulandı.

| Metin / zemin | Oran | Sonuç |
|---|---:|---|
| Ana metin / beyaz: `#292522` / `#FFFFFF` | 15.20:1 | AA |
| Ana metin / zemin: `#292522` / `#F5F3EF` | 13.71:1 | AA |
| Ana metin / nötr: `#292522` / `#F0EDE8` | 13.01:1 | AA |
| Ana metin / toplu işlem: `#292522` / `#F7EDEC` | 13.23:1 | AA |
| Ana metin / seçili satır: `#292522` / `#FAF5F3` | 14.05:1 | AA |
| İkincil / beyaz: `#6A605B` / `#FFFFFF` | 6.11:1 | AA |
| İkincil / zemin: `#6A605B` / `#F5F3EF` | 5.51:1 | AA |
| İkincil / nötr: `#6A605B` / `#F0EDE8` | 5.23:1 | AA |
| İkincil / seçili satır: `#6A605B` / `#FAF5F3` | 5.65:1 | AA |
| Bağlantı / beyaz: `#6B1A1A` / `#FFFFFF` | 11.75:1 | AA |
| Bağlantı / zemin: `#6B1A1A` / `#F5F3EF` | 10.60:1 | AA |
| Bağlantı / nötr: `#6B1A1A` / `#F0EDE8` | 10.06:1 | AA |
| Marka / soluk marka: `#6B1A1A` / `#F7EDEC` | 10.22:1 | AA |
| Beyaz / birincil: `#FFFFFF` / `#6B1A1A` | 11.75:1 | AA |
| Beyaz / menü: `#FFFFFF` / `#551919` | 13.64:1 | AA |
| Beyaz / aktif menü: `#FFFFFF` / `#743131` | 9.43:1 | AA |
| Pasif menü / menü: `#E1C8C3` / `#551919` | 8.61:1 | AA |
| Başarı veya bilgi / yüzeyi: `#27645C` / `#EAF3F0` | 6.06:1 | AA |
| Uyarı / yüzeyi: `#5D4A3E` / `#F0EDE8` | 7.15:1 | AA |

Tüm metin çiftleri normal metin eşiği olan 4,5:1 üzerinde; büyük metne tanınan 3:1 istisnasına ihtiyaç yok. Form kontrol sınırı beyaza karşı 3.79:1, odak rengi beyaza karşı 6.85:1; bunlar metin değil arayüz bileşenleri için 3:1 eşiğini geçer.

## Doğrulama / teslim kapısı
16.10.2026 tarihinde kurulu Playwright CLI ve Chromium ile, doğrudan `file://` adreslerinden doğrulandı; paket kurulmadı.

| Kontrol | Sonuç |
|---|---|
| `home.html`, `people.html`, `NOTES.md` | Var; yalnız bu yönün klasörüne yazıldı |
| HTMLParser etiket yığını, yinelenen ID | İki HTML başarılı |
| Harici URL, CSS import, font/CDN | Yok; çevrimdışı tek dosyalar |
| Ana Sayfa 1440 × 1080 ve 390 × 844 | Görsel kontrol başarılı; belge genişliği 1440 / 390 |
| Kişiler 1440 × 1080 ve 390 × 844 | Görsel kontrol başarılı; belge genişliği 1440 / 390 |
| Kişi arama ve departman/durum filtreleri | Ayşe: 1, Mühendislik: 2, Pasif: 1 kayıt |
| Toplu seçim ve işlem önizleme | 8 kişi seçimi, doğru sayaç, dialog açma/kapatma başarılı |
| Boş ve yükleniyor durumu | Doğru durum ve metin görünür |
| Mobil menü | Açılış, Ayarlar erişimi, Escape kapanışı başarılı |
| Tarayıcı konsolu | 0 hata, 0 uyarı |
| Metin kontrastı | Tüm çiftler ≥4,5:1; en düşük 5,23:1 |

Mobil incelemede tespit edilen grid minimum genişliği ve mutlak konumlu erişilebilir tablo etiketinin taşması düzeltildi; kaydırma tablo bölgesinde kaldı. Uygulama kaynakları değişmediği için uygulama derlemesi/TS/lint çalıştırılmadı; bu teslim statik tasarım dosyalarıdır. Bilinen eksik: canlı veri bağlantısı, diğer modül ekranları ve gerçek yazma işlemleri bu mockup kapsamında yoktur; tarihsel karşılaştırma ve anlık içeride sayacı için mevcut veri sözleşmesinde alan bulunmuyor.
