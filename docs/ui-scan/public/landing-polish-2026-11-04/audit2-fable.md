# Landing audit 2 — Fable, 2026-11-04 (HEAD f72382bf)

**Hüküm: yayına hazır — MUST 0 · SHOULD 3 · NIT 7.** Sayfa 320-1440 px'te taşmasız, font değişiminde 0 px kayma,
hareket yalnız LiveFeedDemo, klavye/odak/menü doğru, login/register/verify-email'de gerileme yok. Tek gerçek
görsel kusur 1024-1100 px aralığında (çift sütun kırpımları dikey mobil kaynaktan dev boyutta geliyor).

Yöntem: yerel dev, Playwright 320/390/768/1024/1100/1440 (tam sayfa + bölüm + hover + odak çekimleri), DOM ölçümleri,
font dosyaları engellenerek yedek↔Overpass yerleşim kıyası, Tab yürüyüşü, mobil menü odak döngüsü,
`vitest run src/components/landing src/components/public src/pages/Index.test.tsx` (20/20). Görseller:
`/tmp/landing-polish/audit2-fable/` (`w<genişlik>-<bölüm>.png`, `*-focus-*.png`, `*-login/register/verify-email.png`).

## Ölçüm özeti
| | 320 | 390 | 768 | 1024 | 1100 | 1440 |
|---|---|---|---|---|---|---|
| Yatay taşma | yok | yok | yok | yok | yok | yok |
| h1 satır | 4 | 3 | 2 | 3 | 2 | 3 |
| Canlı kart yük. / üst şerit | 423 / 101 (2 satır) | 387 / 65 | 387 / 65 | 387 / 65 | 387 / 65 | 387 / 65 |
| Özellikler bölümü yük. | 3290 | 3275 | 4599 | **4223** | **4415** | 2609 |
| Çift sütun kırpım (PDKS) | 280×313 | 350×391 | 704×787 | **958×1072** | **1034×1157** | 585×502 |
| Sayfa yük. | 8917 | 8548 | 9321 | 8593 | 8755 | 7148 |

Font değişimi (Overpass engelli → yüklü): 1440/768/390'da h1 yüksekliği, lead ve kart üst kenarı **birebir aynı**
(`size-adjust 96.1%` işe yaramış). Hareket: dinlenme hâlinde `animation`/`transform` taşıyan öğe 0; mobil menü overlay
`animationName: none`. Başlık sırası h1 → h2 → h3 düzenli (17 başlık). Odak: bordo sahnede 2 px `--side-indicator`,
açıkta 2 px `--primary`; Tab sırası …Özellikleri incele → Durdur → donanım bağlantısı → … doğru; menü açılınca odak
"Kapat"a, Esc ile "Menü"ye dönüyor; `aria-pressed` Durdur'da. Kontrast: 13 px muted #646461 / #FCFCFC 5,8:1; donanım
bağlantısı artık `--text` + alt çizgi; "Canlı" yeşili 6,5:1; sahnede kemik pembe 9:1.

## MUST — yok

## SHOULD
1. **1024-1100 px'te çift sütun kırpımları dev** — `FeaturesSection.tsx:37,52` mobil kaynak `(max-width: 1100px)` +
   `public.css:699-707` tek sütun ≤1100 → PDKS kırpımı 958×1072 px, tablo yazısı ~30 px, "Yıllık izin" satır kırıyor;
   Özellikler 1024'te 4223 px (1440'ta 2609). Kanıt: `w1024-pair-crop.png`, `w1024-full.png`. Düzeltme: 37 ve 52'deki
   media'yı `(max-width: 1023px)` yap (tek sütun 1100'e kadar kalsın; 1024-1100'de 1200w masaüstü kırpımı 960-1036 px
   genişlikte ~13 px yazıyla okunur), `pairSizes`'ta 1100 dalı kalır. ~10 dk.
2. **320 px'te h1 "Bulut" tek başına** — `marketingFacts.ts:8` `Geçiş Kontrol` bağı 280 px sütunda 44 px'e sığmayınca
   kırılım "Bulut / PDKS ve / Geçiş Kontrol / Sistemi" (4 satır, 183 px). Kanıt: `w320-hero-top.png`. Düzeltme:
   `@media (max-width: 360px) { :root { --public-h1-size: 38px } }` (`public.css` ≤600 bloğunun altına) → 3 satır.
   390'da 3 satır korunur. ~5 dk. (Metin değişmez.)
3. **320 px'te canlı kart üst şeridi iki satıra sarıyor** — `public.css` `.pub-feed-header` `flex-wrap` → "Örnek veri +
   Durdur" ikinci satıra düşüyor, şerit 101 px; başlık-rozet üstte, kontroller altta sağda. Kanıt: `w320-feed.png`.
   Okunur ama dengesiz. Düzeltme: ≤360'ta `.pub-feed-controls { width: 100%; justify-content: space-between }` ya da
   `.pub-feed-title` 17 → 16 px + Durdur `min-width: 64px`. ~10 dk.

## NIT
- `w390-pub-site-footer.png`: alt bilgi "Bilgi ve aydınlatma metni talepleri:" / e-posta / telefon üç ayrı satır, aralar
  16 + 10 px tutarsız (`public.css` ≤600 `.pub-footer-bottom`); e-posta etiketin hemen altına 4 px ile gelsin.
- Mobil menüde (`PublicHeader.tsx:65-75`, `w390-menu-open.png`) 4 bölüm bağlantısı ile "Giriş yap / Hesap oluştur" arasında
  ayırıcı yok; `pub-mobile-nav > a:nth-child(5)` üstüne 12 px boşluk + 1 px `--line`.
- 1440'ta h1 "Bulut PDKS ve / Geçiş Kontrol / Sistemi": "ve" satır sonunda (`w1440-pub-site-header.png`). Karar gereği
  metin sabit; kabul. Kart (387 px) metin bloğundan (420 px) kısa, alt hizalı; dengeli.
- Hero `pub-lead` 19 px / 2 satır, 668 px sütunda ~88 karakter satır; `max-width: 34ch` ile 56-60 karakter daha rahat
  okunur (`public.css:248`).
- FAQ ilk açık soru hâlâ "Hesap oluşturduğumda ne olur?" (SENTEZ P1'de kayıtlı; `FAQSection.tsx` `open={i === 0}` +
  `marketingFacts.ts` sıra). "Mevcut kart okuyucularımı…" öne alınsın.
- `marketingFacts.ts:6-7` "Mobil uygulama yakında." — ürün durumu doğrulanmalı (mağaza build'i yok); metin değilse SSS'ye.
- Final CTA h2 "NGS Plus hesabınızı oluşturun." = `/register` h1 ile aynı cümle; süreklilik sayılır, ama iki ekranda art
  arda aynı başlık okunuyor. İsteğe bağlı: register tarafı değişmez, burada "Hesabınızı oluşturun." yeter.

## Kontrol edilen, sorun bulunmayan
- `marketingFacts.test.ts` yasak ifadeleri: geçti (20 test). Yeni metinlerde tekrar yok; "Canlı İzleme'de" iddiası kalktı.
- Türkçe yazım: kesme işaretleri (`NGS Plus'a`, `hesabınızı`), noktalama, "İzin verildi / Reddedildi" tutarlı.
- Hover: nav bağlantısı 10 px dolgu + 6 px köşe tek zemin sinyali (`w1440-nav-hover.png`); FAQ `summary` zemini 7 px köşe
  içinde (`w1440-faq-hover.png`); iletişim satırında ikon kutusu beyaza dönüyor. Geçişler 140 ms yalnız renk/zemin.
- Gölge: ProductShot (Özellikler) + canlı kart `--public-shadow-rest`; hero `elevated`; FAQ/iletişim/donanım gölgesiz.
- Donanım şeridi: kutusuz, renkli, 20/30/40/20 px; bağlantı alt çizgili ve `--text` renginde; model adı yok (K-D).
- Reduced-motion: Durdur gizli, satır animasyonu yok, geçiş 0 ms (önceki turda ölçüldü, CSS değişmedi).
- Login / register / verify-email 1440 + 390: `public.css` paylaşımı gerilemedi (`w1440-verify-email.png`, `w390-register.png`).

**Yayına hazır:** evet; SHOULD-1 (10 dk) yayından önce yapılırsa tablet-yatay/küçük dizüstü aralığı da temiz olur.
