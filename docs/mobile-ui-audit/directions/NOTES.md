# NGS Plus — üç mobil tasarım yönü

4 Kasım 2026 · Karar için statik HTML sunumu · [Karşılaştırmayı aç](index.html)

**Önerim A — Sakin:** Web A2 ile en güçlü ürün ailesi bağını, günlük geçiş işlerinde en düşük görsel yük ve en küçük Flutter uygulama maliyetiyle kuruyor.

## Teslim

| Yön | Ana Sayfa | Geçmiş | QR Kodum | Ana Sayfa koyu |
|---|---|---|---|---|
| A — Sakin | [home](A/home.html) | [history](A/history.html) | [qr](A/qr.html) | [home-dark](A/home-dark.html) |
| B — Marka bandı | [home](B/home.html) | [history](B/history.html) | [qr](B/qr.html) | [home-dark](B/home-dark.html) |
| C — Canlı pano | [home](C/home.html) | [history](C/history.html) | [qr](C/qr.html) | [home-dark](C/home-dark.html) |

- `index.html`: masaüstünde üç yön satırı × dört telefon; dar ekranda telefonlar iki sütuna geçer. Telefon içeriği masaüstünde %60 ölçekli, “Tam boy” bağlantısıyla 390px açılır.
- Her ekran kendi CSS, SVG ve küçük gezinme betiğini içerir; dış font, resim, CDN, paket veya servis isteği yoktur.
- `_shots/{A,B,C}-{home,history,qr,home-dark}.png`: 12 adet 780×1688 PNG; ölçüm kaydı `_shots/validation.json`.
- A, önceki [codex-home.html](../mockups/codex-home.html) düzeninin devamıdır; veri, nötr seçim zemini, tarih/kurum bağlamı ve üç hareket saati bu teslimde güncellendi. Önceki dosya değiştirilmedi.

## Her yönde sabit kararlar

1. Aynı veri: Ayşe Yılmaz, NGS Teknoloji — Merkez, 4 Kasım Çarşamba, İçeride, ilk giriş 08:52 / Ana Giriş, çıkış 12:31 ve giriş 13:14 / Otopark Turnike, güncelleme 13:20, kapı Ana Giriş, bir bekleyen talep.
2. Ana Sayfa’da tek dolu bordo **QR kod tara** eylemi; diğer işlemler nötr. B’nin başlık bandı, briefte istenen ayrı marka kimliği alanıdır. Koyu temada bordo dolgu korunur; açık accent konturu düğme sınırını görünür kılar.
3. Beş eşit alt hedef: Ana Sayfa / Geçmiş / QR / Ziyaretçi / Profil. Navigasyon 65px + home indicator 29px + 1px çizgi; içerik yüksekliğinden düşülür. Yüzen hap veya büyük QR dairesi yoktur.
4. Durum için aynı ikonlu `İçeride` rozeti; ret için metin ve çarpı ikonu. Renk tek başına anlam taşımaz. Pembe seçili-container zemini kullanılmaz; seçili sekme/navigasyon nötr yüzey + bordo yazıyla ayrılır.
5. Geçmiş: Bugün 3, Dün 3, 2 Kas Pzt 2 hareket; her gün yeniden eskiye sıralı. Reddedilen hareket dün 08:46 / Depo Kapısı. Sekiz satırın tamamı başlangıç görünümünde yer alır.
6. QR: aynı statik desen, 44 sn kalan süre, tek satır “Kodu okuyucuya gösterin”, görünür Yenile. İlerleme çubuğundaki 44/60 oranı yalnız sunum varsayımıdır; gerçek ürünün TTL değeriyle bağlanmalıdır.
7. Saatler Türkiye saati kabul edilmiştir; kullanıcı arayüzüne UTC/sunucu gibi açıklamalar eklenmedi. Başlıkta tam gün adı, geçmişte kısa `4 Kas Çar` ve `2–4 Kas` aynı yerel tarih ailesini izler.
8. Görsel sunum statiktir: QR deseninde gerçek erişim verisi bulunmaz, süre ilerlemez, Yenile/kapı/talep/ziyaretçi/filtre işlemleri servis çağırmaz. Ana Sayfa’daki **QR kod tara** yerel `qr.html#tara` adresine gider ve **Tara** sekmesini doğrudan seçer; sadece çizilmiş tarama çerçevesi gösterilir, kamera izni istenmez. Alt gezinmenin Ana Sayfa/Geçmiş/QR bağlantıları çalışır; diğer ekranlar bu teslim kapsamı dışındadır.

## Token farkları

| Token / ölçü | A — Sakin | B — Marka bandı | C — Canlı pano |
|---|---|---|---|
| Açık canvas | `#fcfcfc` | `#f7f7f5` | `#f4f4f2` |
| Surface / subtle | `#ffffff` / `#f3f3f2` | Aynı | Aynı |
| Text / muted | `#252523` / `#646461` | Aynı | Aynı |
| Primary / onPrimary | `#7a1f1f` / `#ffffff` | Aynı | Aynı |
| Marka bandı | Yok | Düz `#7a1f1f`, kimlik dairesi `#551919`, ikincil yazı `#f1dcd8` | Yok |
| Line / control | `#e2e2e0` / `#858582` | Aynı | Aynı |
| Açık seçim zemini | `#f3f3f2`; sekmeler çizgiyle | Nötr segment içinde beyaz seçim | Nötr segment içinde beyaz seçim |
| Buton radius | 8px | 12px | 16px; işlem karolarında 20px |
| Durum paneli | Kartsız, alt ayırıcı | 16px, 1px kontur | 20px, 1px kontur |
| Geçmiş grubu | Kartsız liste | 12px grup yüzeyi | 16px grup yüzeyi |
| QR paneli | 12px | 16px | 24px |
| Segment dış / iç radius | Çizgili sekme | 10 / 6px | 14 / 10px |
| Rozet radius | 4px | 4px | 4px |
| Elevation | Her yerde 0 | Durum/QR panelinde `0 3px 9px #25252308`; seçili segmentte çok hafif gölge; koyu durum paneli 0 | Her yerde 0 |
| Ana Sayfa başlığı | 25px / 650 | 25px / 650 | 24px / 650 |
| Bugün saatleri / ana metrik | 25px / 600 | 24px / 600 | Süre 38px / 650, birimler 18px |
| Ortak tipografi | Sayfa 26, bölüm 18, birincil eylem 16, satır 14–15, yardımcı 12–13, nav 12px | Aynı | Aynı; zaman çizgisi açıklaması 11px |
| Sayfa kenarı / aralık | 20px / 4, 8, 12, 16, 20, 24px | 20px / aynı | 16px karo kenarı, 20px başlık; karolar arası 10px |

Sistem font yığını `-apple-system, BlinkMacSystemFont, Segoe UI, Arial, sans-serif`; Flutter’da platform sistem fontu ve `TextTheme` kullanılır. HTML px değerleri 390px referans görünümündeki tasarım ölçüleridir; üretimde dp/sp ve kullanıcının metin ölçeğine uyarlanır.

### Koyu tema — üç yönde aynı semantik palet

| Rol | Hex |
|---|---|
| Canvas / surface / subtle | `#181817` / `#20201e` / `#2a2a27` |
| Text / muted | `#f3f3f0` / `#b8b8b2` |
| Accent / primary fill / onPrimary | `#e7b3ad` / `#7a1f1f` / `#ffffff` |
| Line / control | `#3c3c37` / `#9a9a93` |
| Success fg / bg | `#bbdcc6` / `#21362a` |

B’nin başlık bandı koyu temada da marka bordosudur; gövde ve kartları ortak koyu palete döner. Açık tema durum çifti `#356047 / #edf4ef`; ret yazısı/ikonu `#963e36`.

### Hesaplanan metin kontrastları

Yerel Python hesabı: sRGB kanalı `c≤0.04045` ise `c/12.92`, değilse `((c+0.055)/1.055)^2.4`; luminance `0.2126R + 0.7152G + 0.0722B`; oran `(Lmax+0.05)/(Lmin+0.05)`.

| Ön plan / arka plan | Oran |
|---|---:|
| Beyaz / bordo `#ffffff / #7a1f1f` | 10,28:1 |
| B bant ikincil metni `#f1dcd8 / #7a1f1f` | 7,82:1 |
| Açık ana metin `#252523 / #fcfcfc` | 14,97:1 |
| C ikincil metin `#646461 / #f4f4f2` | 5,39:1 |
| Koyu ana metin `#f3f3f0 / #181817` | 15,98:1 |
| Koyu ikincil metin `#b8b8b2 / #20201e` | 8,19:1 |
| Koyu seçili metin `#e7b3ad / #20201e` | 8,90:1 |
| Açık durum rozeti `#356047 / #edf4ef` | 6,44:1 |
| Koyu durum rozeti `#bbdcc6 / #21362a` | 8,71:1 |
| Ret metni `#963e36 / #ffffff` | 6,91:1 |

## Değişen ortak bileşenler ve Flutter karşılıkları

| Bileşen | A | B | C | Flutter uygulama karşılığı |
|---|---|---|---|---|
| `AppScaffold`, `AppBottomNavigation` | Nötr kabuk, çizgi | Aynı kabuk | Aynı kabuk | `Scaffold` + tek `SafeArea` sahibi + beş eşit `NavigationDestination`; `extendBody:false` |
| `AppPageHeader` | Kompakt nötr başlık | Yalnız home’da `BrandHeader`; diğerleri nötr | Kompakt nötr başlık | `AppBar`/sliver; B için ölçülen içerikle örtüşen panel, sabit metin yüksekliği kullanılmaz |
| `AttendanceSummary` | Üç saat + ayırıcı | Aynı içerik tek yüzeyde | `AttendanceTimeline`: süre + zaman çizgisi + metin | `Row/Flexible`, `ThemeExtension`; C için `CustomPainter` veya oranlı `Row` + birleşik `Semantics` |
| `AppPrimaryButton`, `AppDoorAction` | Tam genişlik buton, altına kapı | Radius 12; aynı eylem düzeni | `QuickActionTile` içinde iki eşit hedef | `FilledButton`, `OutlinedButton`, `Material/InkWell`; min 48dp |
| `AppUtilityList` | İki çizgili satır | Tek nötr grup yüzeyi | 2×2 karonun ikinci sırası | `ListTile`; C için `LayoutBuilder` + genişleyen grid/Wrap |
| `AppStatusBadge` | Ortak | Değişmez | Değişmez | Semantik tone token + ikon/metin; görsel ve anlam birlikte |
| `AppSegmentControl` | Alt çizgili sekme | Nötr yuvarlatılmış segment | Daha yumuşak radius | `TabBar` veya `SegmentedButton`; tüm hedefler min 48dp |
| `HistoryDayGroup`, `HistoryRecordRow` | Düz liste, ayırıcı | Gün başına tek panel | Gün başına daha yuvarlak panel | `SliverList`/builder; `FontFeature.tabularFigures()`, ret için ikon + metin |
| `QrDisplayPanel`, `QrExpiryIndicator` | İnce kontur, 12px köşe | 16px ve hafif gölge | 24px, gölgesiz | Mevcut QR üreticisini koruyan yüzey + `LinearProgressIndicator`; Yenile gövde içinde ve nav üstünde |

A için veri modelleri ve uygulama akışına ek durum gerekmez. B’de tek özel yerleşim başlık/durum örtüşmesidir. C’de canlı süre mevcut hareketlerin toplamından hesaplanmalı; arka plan/ön plan geçişi, gün değişimi, eksik veya eski veri ve ekran okuyucu güncelleme sıklığı ayrıca ele alınmalıdır.

**C süre hesabı:** 08:52–12:31 = 219 dakika; 13:14–13:20 = 6 dakika; toplam **225 dakika = 3 sa 45 dk**. Briefteki 4 sa 28 dk yalnız örnekti; verilen hareketlerle tutarlı sonuç kullanıldı. Barın blokları 219:43:6 oranındadır; ilk/son blok içeride, orta boşluk öğle çıkışıdır. Görseldeki bar canlı veri bağlantısı değildir.

## Yönlerin değerlendirmesi ve maliyet

- **A — S / önerilen:** Web A2 ile tutarlı, birincil eylemi en net ayıran ve en az özel bileşen gerektiren yön; kimliği büyük dekorasyon yerine düzen ve tipografi taşır.
- **B — M:** Daha güçlü marka varlığı ve tanıdık finans uygulaması düzeni; bordo bant, birincil eylemden dikkat alır ve örtüşen kartın büyük metin/ekran boyutu davranışı ek uygulama işi getirir.
- **C — M:** Süre takibi ve geniş hedefler güçlü; iki sütundaki QR alanı A/B’den dar, canlı süre ve çizginin durum yönetimi daha fazla iş gerektirir.

S/M/L göreli UI uygulama eforudur; takvim tahmini değildir. S standart tema/liste/sekme/NavigationBar, M bunlara ek özel yerleşim veya yeni zaman çizgisi durumu, L çok sayıda özel etkileşim/rendering anlamına gelir. Üç yön de Material 3 ile üretilebilir; hiçbir yönde üçüncü taraf animasyon veya çizim paketi gerekmiyor.

## Görsel ve teknik doğrulama

- Mevcut `/Users/emreaydin/pafta/node_modules/playwright` ile headless Chromium, viewport **390×844**, DPR **2**; 12 ekranın tümü **780×1688** olarak çekildi.
- 12 ekran için belge ve içerik yatay taşması **0px**; gövde dikey taşması da başlangıç veri setinde **0px**. Sekiz geçmiş satırı nav üstünde görünür.
- Tüm örnek ekranlardaki buton/alt gezinme hedefleri en az **48×48px**. Beş nav öğesi eşit **76,4px** genişlikte; HTML ölçümü Flutter hit-test doğrulaması yerine geçmez.
- QR Yenile alt kenarı A **677,16px**, B **684,16px**, C **686,16px**; nav üst sınırı **749px**. Bütün home eylemleri görünür alan içinde.
- Üç yönde QR kod tara tıklaması `qr.html#tara` adresini ve seçili **Tara** sekmesini doğruladı; kod gösterme paneli bu modda bulunmuyor.
- Karşılaştırmada 12 iframe yükleniyor; 1280px masaüstü ve 390px mobil dış sayfa genişliklerinde yatay taşma yok. Harici HTTP isteği **0**, JavaScript sayfa hatası **0**.
- 12 farklı ekran PNG’si `view_image` ile açılarak incelendi; son revizyonda liste son satırları, segment boyutu, koyu palet, QR/Yenile ve telefon çerçeveleri ayrıca kontrol edildi.
- Bu teslim tasarım kararı içindir; Flutter kodu veya mevcut ürünün işlevsel testleri değiştirilmedi. `git diff --stat -- mobile` boş; mevcut untracked `mobile/screenshot_test/` alanına dokunulmadı.
