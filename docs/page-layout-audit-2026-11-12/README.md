# NGS Access ortak sayfa layout audit’i

Audit sonrasında ortak şablon uygulaması tamamlandı. [Teslim özeti ve nihai kontrol sonuçları](TESLIM.md), [uygulama planı](IMPLEMENTATION.md) ve [canlı ölçümler ile ekran görüntüleri](verification-live.md) hazır. Aşağıdaki değerlendirme uygulama öncesi audit kaydıdır.

12 Kasım 2026. Frontend Design ve UX Designer becerileriyle üç Codex worker’ın incelemeleri birleştirildi. Dokuz ana modül kaynak kodundan karşılaştırıldı. Kişiler, Cihazlar, Vardiya Planı ve Ayarlar mevcut oturumla 1440×1000 ve 390×844 ölçülerinde görüntülendi. Sekiz ekran görüntüsü `evidence/` klasöründe.

## Karar önerisi

Mevcut `Layout` global kabuğu sağlıyor. Modernleşmenin odağı, bunun altındaki sayfa kompozisyonunu tek `PageTemplate` sözleşmesine bağlamak olmalı. Başlık, eylemler, kapsam, filtreler, sonuç yüzeyi ve altlık aynı konumlarda bulunmalı. Tablo, takvim, ajanda ve form bu şablonun içerik yuvasında kendi görevine uygun sunulmalı.

“Tek page layout” isteği tüm modüller için ortak sayfa şablonu olarak yorumlandı. Liste ve ayrıntı akışlarını tek URL’de toplama konusu ayrıca tasarlanmadı.

## Öncelikli bulgular

| Öncelik | Bulgu ve kanıt | Öneri |
|---|---|---|
| P1 | Kişiler masaüstü tablosunda e-posta, departman, pozisyon ve kart alanları birkaç harfe kadar kısalıyor. Mobilde personel adı da erken kesiliyor. Canlı ekran görüntülerinde gözlendi. Saklanan kolon genişliklerinin etkisi ayrıştırılmadı. | Kimlik alanına öncelik ver. İçeriğe uygun minimum kolon genişliği, mobilde gerektiğinde iki satır ad, ikincil kolonların görünüm menüsünden yönetimi. |
| P1 | Kapı Planları proje seçilmemişken “Plan kurulabilecek Hikvision kapısı yok” ve “Cihazlara git” gösteriyor. `DoorPlansTab.tsx:119` üzerinden doğrulandı. | Proje seçimi gereksinimini uygun kapı bulunamaması durumundan ayrı sun. |
| P1 | Alarmlar ve Kapı Planları sorgularının yerel sınırı bulunmuyor. Sorgu hatası rota içeriğini değiştirebilir. Statik inceleme, hata senaryosu canlı tetiklenmedi. | Başlık ve gezinmeyi koruyan sonuç alanı hata sınırı, yerel tekrar deneme. |
| P2 | Mobil Kişiler ekranında açık filtreler ve aktarım eylemleri ilk veri satırını yaklaşık 550 px aşağıya taşıyor. Cihazlar seçimsizken 88 px toplu işlem alanı ayırıyor. | Arama görünür kalsın. Gelişmiş filtreler etkin filtre sayısıyla açılsın. Toplu işlem şeridi seçimle görünsün. |
| P2 | Sayfa bölüm aralıkları 16/20/24/32 px arasında değişiyor. İçe/dışa aktarma, görünüm, toplu işlem ve sayfalama konumları modüle bağlı. | Dış ritmi, eylem yerlerini ve sonuç altlığını ortak şablon yönetsin. |
| P2 | 13 px gövde, 12 px tablo ve daha küçük yardımcı metinler ile 36/44 px kontrol yükseklikleri farklı yoğunluk oluşturuyor. | Ana veride 14 px, etiketlerde 13 px, yardımcı bilgide 12 px başlangıç ölçeği. Masaüstünde 36 px, dokunmatikte 44 px kontrol hedefi. Gerçek veriyle doğrula. |
| P2 | Kabuk 761 px, bazı veri bileşenleri 768 px, yerel paneller 1024/1100 px kullanıyor. | Aynı davranış için ortak adlandırılmış eşikler kullan. Geçiş genişliklerini test et. |
| Doğrulama gerekli | Gerçek kaydırıcı `Layout` içindeki main. `App.tsx:52` yalnız `window.scrollTo` çağırıyor. Rota değişiminde konum sorunu oluşması olası. | Uzun liste → başka modül → geri dönüş akışını main üzerinde doğrula, ardından kaydırma sahipliğini merkezileştir. |

Kanıt ayrıntıları ve tam dosya yolları [mimari](architecture.md), [modül karşılaştırması](modules.md) ve [görsel inceleme](visual.md) raporlarında bulunur. P1 günlük görevi veya yönlendirmeyi etkileyen önceliktir. Bu audit kapsamında kritik/P0 hata doğrulanmadı.

## Tek sayfa şablonu

```text
Global kabuk
  Menü | Proje seçici | Breadcrumb | Arama | Hesap

PageTemplate
  Geri bağlantısı                                      isteğe bağlı
  Başlık + kapsam                  İşlemler + Ana eylem
  Bildirim / yerel gezinme / görevle ilgili özet         isteğe bağlı
  ┌────────────────┬─────────────────────────────────────┐
  │ Kapsam paneli  │ Arama · Filtreler · Görünüm          │
  │                │ Seçim varsa toplu işlemler           │
  │ isteğe bağlı   │ Tablo / takvim / ajanda / form       │
  │                │ Sonuç özeti + sayfalama/yükleme      │
  └────────────────┴─────────────────────────────────────┘
  Ayrıntı paneli / diyalog
```

Mobilde kapsam paneli seçiciye dönüşür. Arama ile Filtreler düğmesi erişilebilir kalır. Etkin filtreler ve temizleme görünür olur. Takvim günlük ajandaya, veri sonuçları okunabilir kimlik satırlarına geçebilir. Form genişliği içerik sütununda sınırlanır.

Tek adlandırma olarak `PageTemplate` öneriliyor. Worker raporlarındaki PageFrame/ContentFrame ifadeleri aynı yerleşim sorumluluklarını tarif eder. Uygulamada mevcut PageHeader, MasterDetailListLayout, FilterBar, BulkBar, ResponsiveResults, PaginationBar ve DetailSheet üzerinden ilerlenmeli. Yeni bileşenler yalnız eksik kompozisyon sorumluluğunu üstlenmeli.

## Görsel yön ve başlangıç ölçüleri

Mevcut bordo marka kimliği, nötr zemin ve küçük köşeler temel alınmalı. Okunabilir kayıt kimliği, net durum ve tutarlı ana eylem öncelikli olmalı.

| Rol | Önerilen başlangıç değeri |
|---|---|
| Zemin / yüzey | `#FAFAFA` / `#FFFFFF` |
| Metin / yardımcı metin | `#252523` / `#646461` |
| Ayırıcı / marka | `#E2E2E0` / `#7A1F1F` |
| Font | Mevcut sistem sans ailesi |
| Başlık | Masaüstü 26/34 px, mobil 24/32 px, 600 ağırlık |
| Ana veri / etiket / yardımcı bilgi | 14/20, 13/18, 12/18 px |
| Sayfa kenarı / bölüm arası / içerik grubu | Masaüstü 32, mobil 16 / 24 / 16 px |
| Kontrol / büyük yüzey köşesi | 6 / en fazla 8 px |

Bunlar önerilen değerlerdir. Mevcut durum renkleri semantik rollerini sürdürmeli. Kontrast ve koyu tema ayrıca ölçülmeli. Sidebar marka yüzeyi mevcut varyantıyla değerlendirilmeli.

## Geçiş sırası

1. Projesiz Kapı Planları metnini ve yerel hata durumlarını düzelt. Uzun liste rota kaydırma akışını doğrula.
2. PageTemplate sözleşmesini Kişiler ve Cihazlar üzerinde uygula. Başlık/filtre/sonuç eksenini, okunabilir kolonları ve koşullu toplu işlem şeridini doğrula.
3. Vardiya Planı ve Ayarlar ile takvim ve form içeriklerini aynı dış şablonda doğrula. Ardından Ziyaretçiler, Alarmlar, PDKS, Geçiş Kontrol ve Raporlar’a geçir.
4. Sonuç altlığı, ayrıntı paneli varyantları, rota başlıkları ve token alias’larını ortaklaştır. İmleç tabanlı listeler ve biriktirerek yükleme kendi veri davranışlarıyla temsil edilsin.

Kabul için tek h1 ve main, aynı başlık/eylem ekseni, ana kimlik alanlarında okunurluk, tüm durumlarda sayfa bağlamı, tablo içinde kontrollü yatay kaydırma ve klavye odağının geri dönüşü doğrulanmalı. 390 ve 1440 px pilotlara ek olarak 760/761/767/768 ve 1099/1100 px geçişleri, %200 yakınlaştırma ve uzun Türkçe veri kontrol edilmeli. Proje yok, yetki yok, yükleniyor, hata, ilk kayıt yok ve filtre eşleşmiyor durumları ayrı denenmeli.

## Teslimatlar ve sınırlar

- [Ortak mimari ve önerilen API](architecture.md)
- [Dokuz modülün karşılaştırma matrisleri](modules.md)
- [Görsel tasarım raporu ve sekiz ekran görüntüsü](visual.md)

Bu teslimat audit ve tasarım önerisidir. Kaynak kod uygulaması yapılmadı. Build/lint/test sonucu üretilmedi. Canlı inceleme dört ekran ve mevcut oturumla sınırlı. Koyu tema, diğer roller, bütün klavye akışları, tüm ayar formları, uzun veri ve tam erişilebilirlik ölçümü doğrulanmadı. Bulgular diskteki güncel çalışma ağacına aittir, satır numaraları sonraki düzenlemelerde değişebilir.
