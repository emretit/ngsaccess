# Çapraz eleştiri — Fable, 2026-11-04

Okunan: `astra.md` (301 satır). Kendi raporum: `fable.md`. Aşağıda 7 ayrışma noktasında nihai pozisyonum; 3 yerde
fikrimi değiştirdim (2, 4-mobil, 7).

## 1. Yedi ayrışma — nihai pozisyon

| # | Konu | Nihai pozisyon | Gerekçe |
|---|------|----------------|---------|
| 1 | Derinlik | **Fable'ı koruyorum, kapsamı daraltıyorum:** `rest` gölgesi yalnız ProductShot (4 kırpım + hero) ve canlı kart; iletişim/FAQ/donanım gölgesiz. | Aynı bileşen (ProductShot) hero'da gölgeli, Özellikler'de gölgesiz → iki dil. Astra'nın "her yere gölge = kart yığını" endişesi haklı; çözüm sıfır değil, tek bileşene tutarlılık. Negatif spread ile blur yığını olmaz; Lighthouse etkisi 0. |
| 2 | Etkileşim | **Orta yol, Astra'ya yaklaştım:** 140 ms yalnız `background/border/color` (transform yok, ok ikonu kayması yok); CTA'ya ok ikonu **statik** eklenir; FAQ ikon dönüşü kaldırılır, açıkta statik "−". | K3 "tek hareket" kuralını Emre koydu; renk geçişi hareket değil (öğe yer değiştirmiyor) ama `translateX` ve 45° dönüş harekettir. Astra'nın P1.9 Sheet overlay bulgusu da aynı kuralın zaten delindiğini gösteriyor; önce o kapanmalı. |
| 3 | Hero h1 | **Fable'ı koruyorum, metin Astra'nın A'sı olabilir:** h1 iddia cümlesi, kategori eyebrow'a. Emre SEO için kategoriyi h1'de isterse Astra A ("PDKS ve geçiş kontrolü, işyerinizin günlük akışı.") kabul edilebilir ikinci seçenek; C ("Bulut PDKS ve geçiş kontrolü.") hâlâ etiket, reddediyorum. | Sayfadaki her h2 iddia, yalnız h1 etiket. `document.title` + `meta description` kategoriyi zaten taşıyor; h1'de tekrar SEO'da marjinal. Astra A'nın ikinci yarısı ("günlük akışı") soyut; Fable B ("Kapıdaki her geçiş, Canlı İzleme'de.") ürün sayfasına bağlanır. Karar Emre'de (soru 1). |
| 4 | LiveFeedDemo | **Astra'ya katılıyorum: "Örnek veri" + Durdur üste** (`pub-feed-header`'a; DOM sırası da üste, klavye sırası aynı). **Çıkan satır fade'i kalır** (giren satır animasyonunun parçası, aynı hareket), **nokta pulse'ı çıkarıyorum**. **Mobilde 4 satır** (Astra haklı: 3 satır kanıtı kısaltır; yükseklik satır 80→72 px ile kazanılır). | Mobil ilk ekranda "Canlı" görünüp "Örnek veri" görünmemesi gerçek bir dürüstlük sorunu (`LiveFeedDemo.tsx:85,109`). Pulse ayrı bir döngü = ikinci hareket. Çıkan satırın yok olması bugün "satır değişti" algısı veriyor; fade aynı 280 ms penceresinde. |
| 5 | Donanım şeridi | **Birleşik:** kutular kalkar (Astra), logolar **renkli** kalır (Astra; marka izni riski yok), optik eşitleme (`displayHeight` yeniden ölçüm), açıklama cümlesi `/#iletisim` bağlantısı olur (Astra), **model adları yalnız Emre onaylı liste gelirse** (Fable P0-4 → P2'ye iner). | Grayscale için Hikvision/Dahua marka kılavuzu belirsiz; onaysız riske girmeye değmez. Model adı güven sinyali ama K6 listesi doğrulanmadı; Astra'nın "desteklenmeyen model yazma" uyarısı doğru. |
| 6 | Sticky header | **Hayır (Astra).** Fable P1-3 geri çekildi. | DESIGN kararı var, 10 satır JS + `data-scrolled` durumu + mobil Sheet etkileşimi = polish değil özellik; 7.200 px sayfada final CTA + header'daki "Hesap oluştur" yeterli. İstenirse ayrı iş. |
| 7 | Final CTA | **İkisi de:** başlık "NGS Plus hesabınızı oluşturun." (Astra) + ikincil "Bize yazın" (Fable, `mailto:`). | "Projenizi açın, ilk kapıyı bağlayın" hesap açmanın ötesine atlıyor (Astra haklı, `marketingFacts.ts:188`). B2B ziyaretçinin bir kısmı önce konuşmak ister; hayalet düğme hiyerarşiyi bozmaz, hero'daki ikincil ile simetri kurar. Astra'nın "satış görüşmesini birincil yapma" uyarısıyla çelişmez: ikincil kalır. |

## 2. Astra'da olup benim atladığım bulgular (kodla doğrulandı)

1. **Mobil Sheet overlay animasyonu K3'ü deliyor** — `src/components/ui/sheet.tsx:22` `data-[state=open]:animate-in
   … fade-in-0 / fade-out-0`; `PublicHeader.tsx:62` yalnız `SheetContent`'e `animate-none` veriyor, overlay'e değil.
   "Sayfada tek animasyon LiveFeedDemo" iddiası bugün mobilde yanlış. Çözüm public'e sınırlı: `SheetContent`'in
   kardeşi overlay'e sınıf geçirilemiyor → `Sheet`'e `className` prop'u yok; `SheetOverlay`'e `overlayClassName`
   prop'u eklemek (ortak bileşende 1 satır) ya da `.pub-page`-dışı portal için `[data-radix-dialog-overlay]`
   seçicili public CSS. En temiz: `sheet.tsx`'e opsiyonel `overlayClassName` (uygulama etkilenmez).
2. **Canlı kartta 11 px metin** — `public.css:930` (red nedeni `small`) ve `:935` (sonuç chip'i). Sayfanın ana kanıtı
   11 px; Astra'nın "13-14 px" P0.4'ü doğru, benim P2-1'imde yok. Chip 12, neden 12-13 px; satır 72-80 px'e sığar.
3. **İletişim bölümünde aynı çağrı 3 kez** — `PricingSection.tsx:12,13,43` (`planDescription` + `contactNote` +
   `contactHelp`). Ben yalnız düğme eksikliğini yazmıştım; önce tekrar silinmeli, sonra düğme.
4. (Küçük) **Çift sütun kırpım oranları farklı** — `FeaturesSection.tsx:33-34` 1200×1029 vs `:48-49` 1200×780; subgrid
   başlıkları hizalıyor ama görsel altı maddeler farklı y'de başlıyor (`desk-feat-2600.png`'de görülüyor). P1.

## 3. Astra'da yanlış/riskli bulduklarım

- **P0.3 hero görselini yeniden kırpmak (2-3 sa + yeni varlık):** "yatay, gün özeti odaklı" kırpım Ana Sayfa'nın
  tanınabilirliğini (sol nav + özet + son okumalar) kaybettirir; mevcut mobil dikey kırpım zaten var (`HeroSection.tsx:36-42`).
  Yükseklik sorunu mobilde 505 px; 280-330 hedefi yazıları 5 px'e düşürür — 23 Ekim L1'in tersine dönüşü. Reddediyorum;
  yerine canlı kart satır yüksekliği + P0.4 metin büyütme.
- **"Tek animasyon" yorumu çok katı:** hover'da renk geçişi (140 ms) WCAG'de "hareket" değil; Astra "anlık yüzey
  değişimi" istiyor. Anlık değişim 2026'da "bitmemiş" okunur. Renk/zemin geçişi kalmalı, transform yok (bkz. #2).
- **Güvenlik "5 rol, 13 yetki" → "Roller ve yetkiler":** sayı canlı kodda sabit (ce09baf0, 2026-10-22, 5 rol × 13 yetki).
  Sayı bu sayfadaki en somut güven cümlesi; silmek değil, doğrulayıp büyütmek gerekir. Bakım riski için
  `marketingFacts.test.ts`'e rol/yetki sayısını kod sabitinden okuyan bir assertion eklenebilir.
- **Model listesine karşı tutum fazla temkinli:** 23 Ekim K6 kararı ve canlı kurulumlar (K1T804/807, K2804, ANKA001)
  var; "onay gelirse ekle" doğru ama P2'ye atmak yerine Emre sorusu olarak P0 yanında tutulmalı.
- **Header "Hesap oluştur" düğmesini sakinleştirme (P1.7):** header + hero aynı düğme standart kalıp; sakinleştirmek
  header CTA'sını `Giriş yap` ile eşitler, sticky de olmadığından sayfa ortasında tek erişilebilir CTA kaybolur. Reddediyorum.
- **Astra'nın masaüstü görsel QA'sı tamamlanmamış** (kendisi belirtiyor: karo tekrarı). Benim 1440/1024/768/390
  Playwright çekimlerim bu boşluğu kapatıyor; 601-1023 px kırpım bulgusu (`FeaturesSection.tsx:22,67`) Astra'da yok.

## 4. Ortak P0 — nihai öneri (≤5)

1. **Hero metni:** h1 iddia + kategori eyebrow (Emre SEO kararı; yedek Astra A), lead iki cümle, final CTA başlığı
   "NGS Plus hesabınızı oluşturun." + ikincil "Bize yazın". `marketingFacts.ts:8-10,188`, `HeroSection.tsx`,
   `FinalCTASection.tsx` — ~1,5 sa.
2. **LiveFeedDemo:** "Örnek veri" + Durdur üst şeride (DOM da üste), çıkan satır fade, satır 80→72 px, chip/neden 11→12-13 px,
   mobil 4 satır. `LiveFeedDemo.tsx:85-121`, `public.css:872-999`, `LiveFeedDemo.test.tsx` — ~2 sa.
3. **Hareket kuralını gerçekten tek yap:** Sheet overlay fade'i public'te kapat (`sheet.tsx:22` + `PublicHeader.tsx:62`),
   FAQ ikon dönüşü yerine statik +/−; etkileşimlere yalnız 140 ms renk/zemin geçişi (transform yok). `public.css:561-568` — ~1 sa.
4. **Kırpım tutarlılığı:** 601-1023 px'te tam genişlik kırpımlara mobil kaynak (`FeaturesSection.tsx:22,67` media → 1023px);
   ProductShot + canlı karta tek `rest` gölge tokenı (karar değişikliği, yalnız bu iki bileşen); çift sütun madde hizası. — ~1 sa.
5. **Donanım şeridi + küçük metinler:** kutusuz renkli logo satırı, optik eşitleme, açıklama → `/#iletisim` bağlantısı;
   satın alma notu/caption/footer 12→13-14 px; iletişimde 3 tekrar çağrı → 1. `HardwareStrip.tsx`, `public.css:175,245,261,616`,
   `PricingSection.tsx:12-13,43` — ~1,5 sa.

Emre'ye kalan 3 soru: h1'de kategori ifadesi SEO için şart mı · onaylı model listesi (şeride eklensin mi) · "Mobil uygulama
yakında" hâlâ doğru mu.
