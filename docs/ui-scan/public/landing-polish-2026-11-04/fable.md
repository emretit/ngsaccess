# Landing "modern polish" önerisi — Fable, 2026-11-04

**Özet:** Sayfa iskeleti doğru; iki renkli (bordo + kırık beyaz) sakin düzen, Overpass başlıklar, okunur kırpımlar ve
canlı akış kartı tutuyor. Bugünkü eksik "henüz bitmemiş gibi duran" yüzey dili: her şey 1 px çizgi + beyaz kutu, hiçbir
öğede derinlik/katman yok, etkileşimlerde geçiş yok, hero başlığı bir ürün kategorisi adı. Cila = ürünü yeniden çizmek
değil; **yüzeye bir kat derinlik, metne bir kat iddia, etkileşime bir kat yumuşaklık** eklemek. Yeni renk, yeni kütüphane,
yeni animasyon yok.

Kaynak: `src/pages/LandingPage.tsx`, `src/components/landing/*`, `src/components/public/{PublicHeader,PublicFooter,
Section,ProductShot}.tsx`, `src/components/public/public.css`, `src/index.css` (public token'ları 219-234),
`docs/ui-scan/public/LANDING_AUDIT_2026-10-23.md`, `LANDING_PLAN_2026-10-23.md` (K1-K10), `DESIGN_PUBLIC.md`.
Yerel dev (localhost:8081, HEAD ile aynı landing kodu) 1440 / 1024 / 768 / 390 px ekran görüntüleri:
`/tmp/landing-polish/shots-fable/` (`desk-*.png`, `mob-*.png`, `w1024-*.png`, `w768-*.png`).

Ölçülen (1440): h1 72/1.04 Overpass, 3 satır, 668 px sütun · lead 19/1.6 · h2 52 · h3 28 · gövde 17 · liste 15 ·
SSS başlığı 17 · footer alt satırı 12 px · canlı kart 500×450 · sayfa 7.184 px (mobilde 8.639 px).

---

## 1. Mevcut durum — bölüm bölüm

### Header (`PublicHeader.tsx`, `public.css:180-222`)
**Güçlü:** 88 px sakin bar, logo + 4 bağlantı + "Giriş yap" + tek dolu düğme; atlama bağlantısı, 44 px hedefler, mobil
Sheet animasyonsuz ve erişilebilir.
**Zayıf:**
- Hover yalnız `text-decoration: underline` (`public.css:206`); geçiş yok, aktif bölüm işareti yok. Modern B2B'de nav
  bağlantısı renkle (muted → tam) ve 120 ms geçişle tepki verir, alt çizgi "1999 bağlantısı" hissi.
- Sayfa kayınca header kaybolur; 7.200 px'lik sayfada "Hesap oluştur" ikinci kez ancak en altta görünür. Sticky header
  bilinçli olarak yok (DESIGN_PUBLIC); bunu P1'de "hafif sticky" olarak yeniden öneriyorum.
- Bordo üstünde "Giriş yap" 600 ağırlık, nav bağlantıları 400 (`public.css:214-218`): iki ayrı ton ama aynı boyut;
  hiyerarşi gözle değil ağırlıkla kuruluyor, zayıf.

### Hero (`HeroSection.tsx`, `public.css:223-252`, metin `marketingFacts.ts:8-11`)
**Güçlü:** İki sütun, metin + canlı kart alt çizgide hizalı (`align-items: end`), bindirmeli ürün görseli (2400w,
`fetchPriority=high`), birincil/ikincil düğme ayrımı net, tek dürüst küçük not.
**Zayıf:**
- **Başlık bir kategori adı:** "Bulut PDKS ve Geçiş Kontrol Sistemi" (`marketingFacts.ts:8`). SEO için doğru kelimeler,
  ama bir iddia/sonuç yok; ziyaretçi "ne yapar" değil "ne tür ürün" okuyor. K2 kararı (Kapıda okutulan her kart, anında
  ekranınızda) D3 gecikme ölçümü bekleyerek askıda kaldı; sayfa o sırada SEO başlığına döndü. 3 satır 72 px, "ve"
  satır sonunda sarkıyor (`.pub-hero h1 br {display:none}` `public.css:236` + sütun 668 px → kırılım kaçınılmaz).
- Lead cümlesi noktalı virgülle 2 fikri birleştiriyor (`marketingFacts.ts:9-10`): "...puantaja dönüşür; kapı yetkileri,
  vardiya ve izinler aynı bulut hesapta." 25 kelime, 2 satır. Hero'da tek nefeslik cümle gerekir.
- Hero zemini tek düz bordo (`.pub-scene` `public.css:113-116`). Düz renk + beyaz kart = "poster"; modern hissin
  yarısı yüzeydeki 2-3 %'lik tonal derinlikten gelir (bkz. P0-2).
- Düğmelerde geçiş/`:active` yok (`public.css:120-157`); birincil düğme bordo üstünde kemik pembe (iyi), ama hover
  yalnız `background: surface` (beyaza atlıyor, ani).
- Canlı kart 500 px genişlikte 450 px yükseklik, hero sütunu 417 px → kart metinden 33 px daha uzun, hero yüksekliği
  kartla belirleniyor; masaüstünde 754 px hero + 160 px bindirme ile ürün görseli ilk ekranda ancak 1/4 görünüyor
  (900 px viewport'ta görselin üst 218 px'i). Bilinçli olabilir; P1'de "feed 4→3 satır + kart yüksekliği ≤ metin" öneriyorum.

### LiveFeedDemo (`LiveFeedDemo.tsx`, `public.css:861-999`)
**Güçlü:** Gerçek HTML; deterministik saat dizisi; IntersectionObserver + `visibilitychange` + hover/focus'ta durma;
`aria-hidden` satırlar + grup etiketi; reduced-motion'da sabit ve düğme gizli; 280 ms tek giriş animasyonu. Bu kart
sayfanın en "ürün" anı ve kalmalı.
**Zayıf:**
- Yeni satır üstten `translateY(-8px)` ile giriyor ama **alttaki satır sessizce yok oluyor** (`feedRows(..., 4)` sabit
  4 satır, `pub-feed-rows` 320 px `overflow: hidden`). Göz "liste kaydı" değil "bir satır değişti" algılıyor. Alttaki
  satırın 150 ms'de opacity 1→0 ile silinmesi (ya da 5. satırın maskeyle kayması) akışı akış yapar.
- "Canlı" rozeti sabit nokta (`public.css:895-900`). Bir "canlı" göstergesi nefes almalı; ancak K3 "tek hareket" kuralı
  var → yeni satır animasyonu zaten hareket, noktaya 2 s'lik tek `opacity` pulse eklemek aynı bileşenin parçası sayılır
  (reduced-motion'da kapalı). Karar Emre'de (soru 3).
- "Durdur" düğmesi 72 px, 1 px `--control` gri çerçeve; bordo sahnede beyaz kartın içinde "form düğmesi" gibi duruyor.
  İkon (lucide `Pause`/`Play` 14 px) + metin, çerçevesiz, hover'da `--subtle` zemin daha hafif.
- "Örnek veri" dürüst ve gerekli; 12 px muted sağda. Kalsın.

### Hero ürün görseli (`HeroSection.tsx:30-49`, `ProductShot.tsx`, `public.css:83-91, 249-266`)
**Güçlü:** Tek gölge burada (`--public-shot-shadow`), 2400w WebP 76 KB, mobil için ayrı dikey kırpım, `figcaption`
dürüst ("Ekranlardaki veriler örnektir").
**Zayıf:**
- Görsel çerçevesi 1 px `--line` + 8 px köşe; gölge `0 16px 40px rgba(.08)` tek katman → "yapıştırılmış ekran görüntüsü".
  Modern çerçeve iki katmanlı: yakın temas gölgesi + uzak yumuşak gölge + 1 px iç beyaz hat (bkz. P0-2).
- Görsel bordoyla kesişirken alt kenarı kırık beyaza geçiyor; görsel üstünde 1 px iç highlight olmadığı için bordo
  üstündeki üst kenar "bıçak gibi" (sert) duruyor.

### HardwareStrip (`HardwareStrip.tsx`, `public.css:267-308`)
**Güçlü:** Gerçek entegrasyon markaları; `width/height` + `loading="lazy"`; dürüst yan not.
**Zayıf:**
- 4 logo 4 farklı optik ağırlık: Hikvision kırmızı+gri, Dahua kırmızı daire, IDE Smart **renkli raster PNG** (mavi
  devre deseni, `HardwareStrip.tsx:8`, 251×96 kaynak → 52 px'te yumuşak), Mavisoft ince harf. Her biri 112 px'lik
  beyaz kutuda; göz önce kutulara sonra kutuların içindeki "gürültüye" takılıyor.
- Kutulu logo ızgarası ("logo wall with cards") 2019 şablon kalıbı. Modern eşdeğeri: kutusuz, tek satır, eşitlenmiş
  x-height, düşük kontrast (grayscale + %70 opaklık), hover'da renk.
- Metin: "Entegre olduğumuz markalar" + "Cihaz modelinizin uygunluğunu kurulumdan önce birlikte değerlendirelim." İkinci
  cümle sağa yaslı 14 px; iki metin aynı satırda iki ayrı hizada (`space-between`) → ilişkisiz duruyor.
- K6 "model adı" kararı uygulanmadı; logolar geldi. Model adı (DS-K1T804/807, DS-K2804) güven sinyalidir, logo değil.

### Features (`FeaturesSection.tsx`, `public.css:309-390`, metin `marketingFacts.ts:60-115`)
**Güçlü:** 3 farklı düzen (tam / çift / şerit), subgrid ile çift sütun hizası, modül adı eyebrow (bordo 14/600),
somut alt yazılar ("Reddedilen geçişin nedeni satırda yazar."), kırpımlar okunur.
**Zayıf:**
- **768 px'te Canlı İzleme ve Vardiya kırpımları okunmuyor:** mobil kaynak yalnız `(max-width: 600px)`
  (`FeaturesSection.tsx:22, 67`); 601-1023 arası 2400w masaüstü kırpımı 704 px'e sığıyor, tablo yazısı ~6 px
  (`w768-features.png`). 2026-10-23 audit'in "5 px yazı" bulgusu tablet aralığında geri geldi.
- Madde listesi (`pub-feature-list`, `public.css:381-390`) işaretsiz cümleler + hairline: liste mi paragraf mı belli
  değil. Küçük bir işaret (2 px bordo çizgi ya da 6 px nokta) ya da "fiil" vurgusu okunurluğu artırır.
- Bölüm 2.605 px (sayfanın %36'sı), dört modül arasında görsel "nefes" aynı: hairline + 48 px. Çift sütun bloğunda
  başlık → görsel → madde sırası, tam genişlikte başlık+madde → görsel; ritim değişiyor ama **yüzey** değişmiyor (hepsi
  kırık beyaz zemin). Tek bir modülün (ör. Geçiş Kontrol) `--surface` beyaz panel içinde sunulması derinlik katar.
- Kırpım çerçeveleri 1 px + 8 px köşe, gölgesiz (`public.css:86-91`). Hero'da gölge var, burada yok → aynı bileşen iki
  farklı dil. DESIGN "gölge yalnız hero" diyor; P0-2'de **karar değişikliği** olarak işaretlenmiş.
- "PDKS yapay zekâ asistanına kayıtlarınızla ilgili soru sorun." (`marketingFacts.ts:83`) — tek "yapay zekâ" geçişi,
  görselde karşılığı yok. Ya kırpımda asistan düğmesi görünür ya madde "Kayıtlar hakkında soru sorun, asistan yanıtlar."
  gibi somutlaşır (ürün kararı, soru 4).

### HowItWorks (`HowItWorksSection.tsx`, `public.css:391-421`)
**Güçlü:** Gerçek 3 adım, numaralar Overpass 36 bordo, mobilde 36 px sütun + metin ızgarası.
**Zayıf:**
- Üç sütun arasında bağ yok (çizgi/ok yok, adımlar arası "sonra" hissi yok). Numaraların üstüne 1 px hairline + numara
  üstünde 24 px boşluk (`public.css:396-406`'da yalnız `margin-bottom`), ya da üç sütunun ortak üst çizgisi bir
  "zaman çizgisi" hissi verir; ek öğe gerekmez.
- "Mobil uygulama yakında. Şimdilik işyerinizin web QR girişini kullanın; erişim için yöneticinize başvurun."
  (`marketingFacts.ts:6-7`) — bölümün altında kalan tek satır, konuyla (kurulum) ilgisiz ve savunmacı. Mobil 1.0.5
  mağaza build'i yoksa doğru; ama "yakında" vaadi tarihsiz. Ya SSS'ye taşınır ya mağaza çıkınca "App Store / Google
  Play" rozetine döner (soru 5).

### Security (`SecuritySection.tsx`, `public.css:422-447, 635-640`)
**Güçlü:** Tek açık bant (kemik pembe, `clip-path` ile tam genişlik), somut 3 madde (proje bazlı, 5 rol 13 yetki,
denetim kaydı), biyometri/KVKK iddiası yok, aydınlatma metni e-postası.
**Zayıf:**
- Bant düz `#F6ECEA`; üst/alt kenarı sert (hairline yok). 1 px `hsl(var(--side-bg) / .08)` kenar ya da bandın üst
  kenarında 1 px daha koyu çizgi geçişi yumuşatır.
- Üç madde yalnız hairline ile ayrılıyor; her maddenin başına 20 px lucide ikon (ShieldCheck / Users / History)
  **tek renk bordo, çerçevesiz** koymak "ikon kartı" olmadan tarama hızı kazandırır. (Sayfada ikon yalnız iletişim
  kartında var; ikonografi dili tek yerde kalmış.)
- "5 rol, 13 yetki" sayısal ve gerçek — bu sayfadaki en güçlü güven cümlesi ama h3 22 px'te gömülü. Bu üçlünün
  başlıkları Overpass 28 (feature ölçeği) ile büyütülebilir; bölümün ağırlığı artar.

### Pricing / İletişim (`PricingSection.tsx`, `public.css:448-510`)
**Güçlü:** Fiyat uydurmak yerine "kapsamı konuşalım"; e-posta/telefon tıklanır, 76 px satırlar, hover zemin, ikonlar
kemik pembe kutuda bordo.
**Zayıf:**
- Kart 1 px çizgi + beyaz; gölgesiz. Sayfadaki tek "kart" olduğu için (FAQ hariç) hafif gölge hak ediyor (P0-2 ile aynı
  token).
- Birincil eylem belirsiz: e-posta mı telefon mu? B2B'de telefon KOBİ/fabrika için güçlü; ilk satır telefon olabilir.
  Ayrıca "Bize yazın" dolu bir düğme yok; satır tıklanabilirliği yalnız hover'da anlaşılıyor (ok ikonu yok).
- `.pub-contact-row` hover zemini `--side-text` (kemik pembe) (`public.css:477-479`) ama ikon kutusu da aynı renk →
  hover'da ikon kutusu kayboluyor. Hover'da ikon kutusu `--surface` beyaza dönmeli.
- "Konum: Kadıköy, İstanbul" tıklanmıyor (harita bağlantısı yok) ama diğer iki satırla aynı görünümde.

### FAQ (`FAQSection.tsx`, `public.css:511-573`)
**Güçlü:** Native `details`, sticky sol başlık, `+` → `×` 45° dönüş, açık öğede `--control` kenar, ilk öğe açık.
**Zayıf:**
- İlk açık öğe "Hesap oluşturduğumda ne olur?" — cevabı savunmacı ("Satış talebi göndermez"). En değerli soru "Mevcut
  kart okuyucularımı kullanabilir miyim?" (`marketingFacts.ts:164`) ilk ve açık olmalı.
- Kartlar 1 px çizgi; `summary` hover'da hiçbir şey olmuyor. Hover'da `--subtle` zemin + 120 ms geçiş.
- Açık öğede `details p` 72 px sağ padding (`public.css:570`) ikonun altında boşluk bırakıyor; makul.
- Birden fazla öğe aynı anda açılabiliyor. `<details name="faq">` (Chrome 120+, Safari 17.2+) ile tek açık; eski
  tarayıcıda zararsız.

### FinalCTA (`FinalCTASection.tsx`, `public.css:574-585`)
**Güçlü:** Kısa başlık, tek düğme, bordo bant ile sayfayı kapatıyor.
**Zayıf:**
- Tek düğme "Hesap oluştur". B2B ziyaretçinin yarısı önce konuşmak ister; ikincil hayalet düğme "Bize yazın" (mailto)
  eksik. Hero'da ikincil "Özellikleri incele" var, sonda yok → CTA hiyerarşisi tutarsız.
- 72 px dikey padding, 254 px yükseklik; hero ile aynı düz bordo. Hero'ya tonal derinlik gelirse buraya da gelmeli.

### Footer (`PublicFooter.tsx`, `public.css:586-634`)
**Güçlü:** Logo bordo ton, NGS Teknoloji künyesi, konum, 3 bağlantı, aydınlatma e-postası.
**Zayıf:**
- Alt satır 12 px (`public.css:616`): "Bilgi ve aydınlatma metni talepleri: info@… 0 (212) …" — telefon, KVKK talebi
  etiketinin altında okunuyor (`PublicFooter.tsx:25-27`). Telefonu "Telefon:" ile ayır ya da üst bloğa taşı.
- Footer bağlantıları Özellikler / İletişim / Giriş yap: "Nasıl çalışır?" ve "Güvenlik" yok; nav ile simetrik olmalı.
- Durum sayfası (`StatusPage`, d0e1ac8c) ve mobil yasal sayfalar varsa bağlantıları yok; güven sinyali kaçıyor
  (soru 2).

### Genel (tüm bölümler)
- **Geçiş yok:** `transitionProperty` her yerde `all` (Tailwind preflight) ama `transition-duration` 0; hiçbir hover
  animasyonlu değil (yalnız FAQ ikonu 200 ms). Sayfa "tıklanınca zıplıyor".
- **Tek yüzey seviyesi:** canvas `#FCFCFC`, surface `#FFF`, line `#E1E1DE`. Yükseklik yalnız hero görselinde. Modern B2B
  sayfaların "şık" hissi 2-3 yüzey seviyesinden gelir (zemin / panel / kart), burada 1,5 var.
- **Dark mode yok** (`usePublicTheme` `.dark`'ı siler, `color-scheme: light`). Doğru karar; pazarlama sayfası tek tema.
  Eklenmesin.
- **İkonografi:** yalnız iletişim kartında (Mail/Phone/MapPin 20 px) ve FAQ'da (+). Tutarlı, az; güvenlik bölümüne
  taşımak dengeyi bozmaz.
- **Metin kalitesi:** iyi; tekrar yok, iddia yok. Hero başlığı hariç bütün başlıklar iddia cümlesi ("Geçişleri olurken
  görün.", "Kim neyi görür, kim neyi değiştirir?"). Sorun hero'nun bu dile uymaması.

---

## 2. Tasarım yönü

Sayfa **"sakin, somut, mühendis işi"** hissine cilalanmalı: bir güvenlik amiri ya da fabrika İK'sı bu sayfayı açtığında
"bu ekip sistemi gerçekten kurar, veriler gerçekten ekrana düşer" demeli. Bu kitle parlak gradient, maskot ya da
"dünyayı değiştiren" dil karşısında güvensizleşir; buna karşılık düzenli tipografi, gerçek ürün ekranı, model adları ve
"ne olur / ne olmaz" netliği güven verir. Mevcut bordo + kırık beyaz palet ve Overpass başlıklar tam bu dili kuruyor;
cila yüzeye katman (zemin/panel/kart + iki katmanlı gölge), hero'ya iddia cümlesi, etkileşime 120-160 ms yumuşaklık
katacak. Referans kalıplar: **Linear** (tek vurgu rengi, 2 katmanlı yumuşak gölgeli ürün çerçeveleri, gövde/başlık
kontrastı ve metin-önce özellik blokları); **Stripe Terminal / Stripe Reader sayfaları** (donanım + yazılım birlikteliği,
model adıyla cihaz şeridi, düz zemin üstünde tek açık bant); **Vercel** (mono hairline ızgara, hover'da renkle tepki
veren nav, hayalet ikincil CTA'nın birincilin yanında durması). Hiçbirinin görünümü kopyalanmaz; alınan şey yüzey
katmanı, çerçeve dili ve CTA çifti.

---

## 3. Polish listesi

### P0 — en çok fark yaratan (≤5)

**P0-1 · Hero başlığına iddia, kategori adına eyebrow** · `marketingFacts.ts:8-10`, `HeroSection.tsx:12-16`,
`public.css:232-248`, `index.html:34` (başlık/OG değişmez) · ~45 dk + Emre onayı
- Ne: h1 iddia cümlesi olur; "Bulut PDKS ve Geçiş Kontrol Sistemi" h1'in üstünde 14/600 bordo-açık eyebrow olarak
  kalır (SEO için `document.title` ve `meta description` zaten bu ifadeyi taşıyor; h1'de tekrar şart değil, eyebrow
  `<p>` içinde kalır). Lead iki kısa cümleye bölünür.
- Neden: Sayfadaki tüm bölüm başlıkları iddia, yalnız hero etiket. Modern B2B hero = "sonuç + tek kanıt".
- Metin alternatifleri (4. bölümde).
- Risk: SEO. h1'de hedef anahtar kelimelerin kalması istenirse alternatif: h1 2 parçalı — eyebrow yerine h1 içinde
  `<span class="pub-kicker">Bulut PDKS ve Geçiş Kontrol</span>` küçük satır + büyük iddia satırı; erişilebilir ad
  ikisini de içerir. Emre'ye soru 1.

**P0-2 · Yüzey/derinlik sistemi: 2 katmanlı gölge + iç hat tokenları** · `src/index.css:219-234` (token),
`public.css:83-91, 253-266, 458-463, 530-537, 861-871` · ~1,5 sa · **karar değişikliği önerisi** (DESIGN "gölge yalnız
hero görseli")
- Ne: Üç token:
  ```css
  --public-shadow-rest:  0 1px 2px rgba(37,37,35,.05), 0 8px 24px -8px rgba(37,37,35,.08);
  --public-shadow-lift:  0 1px 2px rgba(37,37,35,.06), 0 24px 48px -16px rgba(37,37,35,.16);
  --public-inner-hat:    inset 0 1px 0 rgba(255,255,255,.6);
  ```
  Ürün kırpımları ve canlı kart: `rest` + 1 px `--line` çerçeve; hero görseli ve iletişim kartı: `lift`; bordo sahne
  üstündeki beyaz kart/görsel çerçevesine `--inner-hat` (üst kenar yumuşar). FAQ ve donanım kutuları gölgesiz kalır
  (çok kart = gürültü).
- Neden: Bugün tek yüzey seviyesi var; göz hiçbir öğeyi "öne" almıyor. İki katmanlı, düşük opaklıklı gölge Linear/
  Stripe'ın "şık" hissinin %60'ı. Negatif spread (`-8px/-16px`) sayesinde gölge "blur yığını" olmaz.
- Risk: DESIGN_PUBLIC "gölge yalnız hero" kuralı ve K-ilkesi "kart yığını yok". Öneri yığın değil, aynı bileşenin
  (ProductShot) iki yerde iki dil konuşmasını bitirmek. Lighthouse'a etkisi 0 (CSS).

**P0-3 · Etkileşim katmanı: 120-160 ms geçiş + hover/active/focus dili** · `public.css:98-106, 120-157, 203-208,
477-479, 538-549, 955-965` · ~1 sa
- Ne: `.pub-btn, .pub-site-nav a, .pub-faq summary, .pub-contact-row, .pub-feed-toggle { transition: background-color
  140ms, border-color 140ms, color 140ms, box-shadow 140ms, transform 140ms; }` (easing `cubic-bezier(.2,.8,.2,1)`).
  Nav: alt çizgi yerine `color: side-muted → side-text` (sahnede) / `muted-foreground → text` (açıkta); altına 1 px
  `currentColor` 2 px offset "hover'da belirir" istenirse `background-size` tekniğiyle. Düğme `:active { transform:
  translateY(1px) }`, birincil hover bordo-koyu / sahnede kemik pembe → beyaz yerine `hsl(var(--side-text) / .92)`
  (atlamaz, koyulaşır). FAQ `summary:hover { background: hsl(var(--subtle)) }`. Birincil CTA'ya lucide `ArrowRight`
  16 px, hover'da `translateX(2px)`.
- Neden: Bugün tıklanabilir hiçbir şey yumuşak tepki vermiyor; "AI şablon" sayfalar aşırı animasyonla, "bitmemiş"
  sayfalar hiç animasyonsuz ayırt edilir. 140 ms, K3 "tek otomatik hareket" kuralını ihlal etmez (kullanıcı tetikli).
- Erişilebilirlik: `@media (prefers-reduced-motion: reduce)` içinde `transition-duration: 0ms`; `:focus-visible` dili
  aynen kalır (`public.css:69-75`).

**P0-4 · Donanım şeridi: kutusuz logo satırı + model adları** · `HardwareStrip.tsx`, `public.css:267-308`,
`marketingFacts.ts:55-59` · ~1 sa + model listesi onayı
- Ne: Kutular kalkar; tek satır, logolar aynı optik yükseklikte (`displayHeight` yeniden ölç: Hikvision 20, Dahua 28,
  IDE 36, Mavisoft 16), `filter: grayscale(1); opacity: .72`, hover/focus'ta renk (140 ms). Sol başlık "Entegre
  markalar", altında 14 px muted "Sahada çalışan modeller: Hikvision DS-K1T804 · DS-K1T807 · DS-K2804 · IDE Smart
  kontrol paneli" (liste Emre'den). Yan cümle ("...birlikte değerlendirelim") bu satırın sonuna bağlanır, sağa yaslı
  ayrı paragraf olmaktan çıkar.
- Neden: 4 ayrı renkli kutu "logo duvarı" kalıbı, en gürültülü bölüm; tek satır grayscale modern standardı. Model adı
  marka logosundan daha güçlü güven sinyali (K6'nın aslı).
- Risk: Marka kullanım kuralları grayscale'e izin vermeyebilir (Hikvision brand guide renkli kullanım ister). Emre'ye
  soru 2. İzin yoksa: kutusuz ama renkli, yalnız opaklık .85 ve hizalı yükseklik.
- `marketingFacts.test.ts:25` `hardwareBrands` sırası/değeri değişmemeli.

**P0-5 · Tablet aralığında okunmayan kırpım (601-1023 px)** · `FeaturesSection.tsx:22, 67` (ve 37, 52) · ~20 dk
- Ne: Tam genişlik kırpımlarda (canli, vardiya) `mobile.media: '(max-width: 1023px)'`; çiftlerde (pdks, gecis)
  `(max-width: 600px)` kalır (zaten yarım sütun). Alternatif: 1200w kaynağa `sizes` düzeltmesi yetmez, kırpım alanı
  sorunu; mobil kırpım dikey ve okunur.
- Neden: 768 px'te Canlı İzleme tablosu ~6 px yazı (`w768-features.png`); 2026-10-23 L1 bulgusunun kaçan aralığı.
  iPad dikey, B2B'de yönetici tableti gerçek senaryo.

### P1 — belirgin ama ikincil

**P1-1 · Hero sahnesine tonal derinlik (gradient değil)** · `public.css:113-116, 574-576` · ~20 dk
- `.pub-scene { background: linear-gradient(180deg, hsl(0 54% 23%) 0%, hsl(var(--side-bg)) 60%); }` — 2 %'lik
  luminans farkı, gözle "gradient" okunmaz, düzlük kırılır. Final CTA'da ters yön (koyu → açık) ile iki bant eşleşir.
  Mor/mavi blob, radial parıltı yok. Kontrast ölçümü: side-text üstünde en açık tonda ≥7:1 korunur (23 % L).

**P1-2 · Canlı kartta çıkan satır + "Durdur" sadeleştirme** · `LiveFeedDemo.tsx:92-108, 109-121`,
`public.css:901-916, 955-965, 969-983` · ~1 sa
- 5. satırı render edip `pub-feed-leave` ile 150 ms opacity-out (reduced-motion'da yok); `feedRows(copy.events, step,
  5)` + `pub-feed-rows` 320 px maskesi aynı. Düğme: ikon + metin, çerçevesiz, `--subtle` hover. `aria-pressed` kalır.
- Hero yüksekliği: masaüstünde satır 80 → 72 px (kart 418 px ≈ metin sütunu 417) → görsel ilk ekranda 32 px daha
  fazla görünür. Mobilde 3 satır (`count` 390'da 3) kartı 448 → 368 px yapar.

**P1-3 · Hafif sticky header** · `PublicHeader.tsx:33`, `public.css:180-187` · ~40 dk · **karar değişikliği önerisi**
- `position: sticky; top: 0` + kaydırınca `backdrop-filter: blur(8px)` değil (performans/AI-şablon), düz
  `hsl(var(--side-bg) / .96)` zemin + alt 1 px `hsl(var(--side-text) / .12)`; `IntersectionObserver` ile `data-scrolled`
  (JS 10 satır). Açık bölümlerde header bordo kalır (tutarlı). 7.200 px'lik sayfada CTA'yı hep erişilebilir kılar.
  DESIGN "sticky yok" kararına karşı; Emre'ye soru 3'te değil, burada bırakıyorum: isterse kapatır.

**P1-4 · Güvenlik bölümü: ikon + başlık ölçeği + bant kenarı** · `SecuritySection.tsx:19-24`, `public.css:422-447,
635-640` · ~40 dk
- Her maddeye 20 px lucide ikon (ShieldCheck, Users, History) bordo, çerçevesiz, başlığın solunda `grid 28px 1fr`;
  h3 → 24 px; bant üst/alt 1 px `hsl(var(--side-bg) / .08)`.

**P1-5 · CTA hiyerarşisi: sonda ikincil düğme, iletişimde birincil düğme** · `FinalCTASection.tsx:13-17`,
`PricingSection.tsx:15-44`, `marketingFacts.ts` (+2 anahtar: `contactCta: 'Bize yazın'`, `callCta: 'Bizi arayın'`) ·
~30 dk
- Final CTA: `[Hesap oluştur] [Bize yazın]` (ikincil, mailto). İletişim kartı: satırlar kalır, altına
  `pub-contact-help` yerine `[Bize yazın]` dolu düğme + yardım cümlesi. Hover'da ikon kutusu beyaza (`public.css:487`).

**P1-6 · Features madde işareti + bir modüle panel zemini** · `public.css:381-390, 333-363` · ~45 dk
- `li::before` 6 px bordo nokta (ya da 2 px kısa çizgi) + 14 px girinti; Geçiş Kontrol çiftinde `article` beyaz panel
  (`--surface`, 1 px line, 12 px köşe, 24 px iç boşluk, `rest` gölge) → dört modülün ortasında bir "ada"; ritim
  yüzeyde de değişir. Yalnız bir modül; ikisi birden "kart yığını" olur.

**P1-7 · Üç adım: zaman çizgisi hissi** · `public.css:391-413` · ~20 dk
- `.pub-step { border-top: 1px solid var(--line); padding-top: 24px }`, numara 36 → 40 px, numaranın altına 8 px
  boşluk + 2 px 32 px bordo kısa çizgi. Masaüstünde üç sütun ortak çizgide "1 → 2 → 3" okunur; ok/ikon yok.

**P1-8 · Footer düzeni + ek bağlantılar** · `PublicFooter.tsx:16-28`, `public.css:609-634` · ~30 dk
- Alt satır 12 → 13 px; "Aydınlatma metni talepleri: e-posta" ve "Telefon: …" ayrı öğeler; bağlantı sütunu nav ile
  aynı 4 + Giriş; varsa Durum sayfası / Gizlilik bağlantısı (soru 2).

### P2 — ince cila

- **P2-1 Tipografi mikro:** tüm h2'lere `text-wrap: balance` (şu an yalnız hero h1, `public.css:234`); `p { text-wrap:
  pretty }` (Chrome/Safari, yetim kelime azalır); lead 19 → 20 px, `max-width: 30ch`; Overpass'ta "İ" noktasının
  üst çizgiyle çakışmaması için h1 `line-height` 1.04 → 1.06 (3 satırlı başlıkta "Geçiş" ile "Sistemi" arası
  sıkışık); `.pub-feature-name` `letter-spacing: .01em`. ~20 dk, `public.css:48-64`.
- **P2-2 Köşe yarıçapı ölçeği:** düğme 6, kart 8, görsel 8, ikon kutusu 8, FAQ ikonu 50 %. Panel 10-12, kontrol 6
  olarak iki seviye: ProductShot/kart 10 px, düğme/chip 6 px. ~10 dk, `public.css:88, 128, 460, 486, 533`.
- **P2-3 Canlı rozet rengi:** `pub-feed-live` yeşil 12 px; nokta 6 px → 8 px + `box-shadow: 0 0 0 3px
  hsl(var(--success) / .15)` halo (statik). ~5 dk, `public.css:888-900`.
- **P2-4 FAQ:** ilk açık öğe "Mevcut kart okuyucularımı kullanabilir miyim?" (`marketingFacts.ts:158-187` sıra +
  `FAQSection.tsx:15` `open={i===0}`); `<details name="faq">`; `summary` hover zemini. ~15 dk.
- **P2-5 Hero görseli `figcaption`:** "Ana Sayfa: günün özeti ve son kart okutmaları. Ekranlardaki veriler örnektir."
  — görselin altında soldan 12 px üstte; sağa yaslı 12 px + üstte 1 px hairline olmadan "yüzüyor". `figcaption`
  `display:flex; justify-content: space-between` ile sol açıklama / sağ "Örnek veri" ayrımı, canlı kartla aynı dil.
  ~10 dk, `public.css:261-266`.
- **P2-6 Header mobil "Menü ☰":** metin + ikon 14 px; yalnız ikon 24 px + `aria-label` daha modern, ama "Menü"
  yazısı erişilebilirlik ve yaşlı kullanıcı için artı. Kalsın; `Sheet` içinde bağlantı 15 → 17 px, 12 px dikey ritim.
  ~10 dk, `PublicHeader.tsx:62-67`.
- **P2-7 OG görseli:** `public/branding/og-image.png` içeriği kontrol edilmeli (hero yeni başlıkla uyumlu mu); P0-1
  sonrası yeniden üretim ~20 dk (tasarım aracı, kod yok).
- **P2-8 Font preload (yalnız landing):** `LandingPage` `useEffect`'inde `<link rel="preload" as="font">` 2 woff2
  (17,5 + 20,7 KB) → FOUT 0; uygulama sayfaları etkilenmez (K: "index.html'e preload yok" korunur). LCP h1 ise +50-100
  ms kazanım. ~15 dk. Lighthouse'a eksi yok.
- **P2-9 Bölüm numaraları/ilerleme:** eklenmesin. "01 / 02" eyebrow sayıları şablon kalıbı.

Toplam: P0 ≈ 5 sa · P1 ≈ 5 sa · P2 ≈ 2 sa. Her maddenin kapısı: `tsc`, `eslint`, tam `vitest` (marketingFacts testi),
Playwright 390/768/1024/1440, Lighthouse mobil ≥ 89.

---

## 4. Hero için somut öneri

### Düzen (1440)
```
┌──────────────────────────── bordo sahne (P1-1: üst %2 daha açık) ───────────────────────────┐
│ ◉ NGS Plus          Özellikler  Nasıl çalışır?  Güvenlik  İletişim      Giriş yap  [Hesap oluştur] │
│                                                                                               │
│ BULUT PDKS VE GEÇİŞ KONTROL  (eyebrow 14/600, side-indicator rengi)                           │
│                                                     ┌ Canlı İzleme ──────────── ● Canlı ┐     │
│ Kapıdaki her geçiş,                                 │ 09:14 Deniz A. · Otopark   Reddedildi│     │
│ anında ekranınızda.            (h1 72, 2 satır)     │       Yetki yok                     │     │
│                                                     │ 09:12 Burak Y. · Ana Giriş İzin verildi│   │
│ Kart, terminal ve QR okutmaları puantaja            │ 09:09 Selin K. · Ana Giriş İzin verildi│   │
│ dönüşür. Kapı yetkisi, vardiya ve izin              │ 09:07 Mert Ç.  · Depo      İzin verildi│   │
│ aynı hesapta.                  (lead 20, 2 cümle)   │ ⏸ Durdur                 Örnek veri │     │
│                                                     └─────────────────────────────────────┘     │
│ [Hesap oluştur →]  [Bize yazın]                                                               │
│ Hesap oluşturmak ücretli plan satın almaz.                                                    │
│                                                                                               │
├────────────── Ana Sayfa ekranı (bindirmeli, lift gölge + iç hat) ─────────────────────────────┤
│ Entegre markalar  ─ Hikvision · Dahua · IDE Smart · Mavisoft (grayscale, tek satır)           │
│ Sahada çalışan modeller: DS-K1T804 · DS-K1T807 · DS-K2804 · IDE Smart paneli · uygunluğu birlikte değerlendirelim │
```
Değişen: eyebrow eklendi; h1 2 satır (iddia); lead iki cümle; ikincil düğme "Bize yazın" (hero'da "Özellikleri incele"
kalabilir; aşağıda alternatif); kart ve metin alt çizgide hizalı kalır (`align-items: end`).

### Başlık alternatifleri (h1)
| # | h1 | Not |
|---|----|-----|
| A | **Kapıdaki her geçiş,<br>anında ekranınızda.** | K2 yedeği; "anında" için D3 gecikme ölçümü gerekiyordu. Ölçülmediyse B. |
| B | **Kapıdaki her geçiş,<br>Canlı İzleme'de.** | Ölçüm gerektirmez, ürün sayfası adıyla bağ kurar. Önerim. |
| C | **Kart okutulur,<br>puantaj yazılır.** | PDKS tarafını öne alır; geçiş kontrol ikinci planda kalır. |
| D | **Kapıdan puantaja,<br>tek hesapta.** | "tek hesap" 2026-10-23'te silinen "tek yerden" ailesine yakın; kaçın. |

### Eyebrow (h1 üstü, `<p class="pub-eyebrow">`)
"Bulut PDKS ve Geçiş Kontrol Sistemi" — SEO ifadesi burada kalır; `document.title` ve `meta description` değişmez.

### Lead alternatifleri
- L1: "Kart, terminal ve QR okutmaları puantaja dönüşür. Kapı yetkisi, vardiya ve izin aynı hesapta." (18 kelime, 2 cümle)
- L2: "Hikvision, Dahua ve IDE Smart okuyucular buluta bağlanır; geçişler puantaja, yetkiler kurallara dönüşür."
  (marka adıyla somut; noktalı virgül yine var, L1 tercih)

### CTA'lar
- Birincil: **Hesap oluştur →** (ok ikonu, P0-3).
- İkincil: **Özellikleri incele** (mevcut, sayfa içi) — ya da **Bize yazın** (mailto). Önerim: hero'da "Özellikleri
  incele" kalsın (keşif), final CTA'da "Bize yazın" gelsin (karar anı). İki yerde iki farklı ikincil = huni mantığı.
- Alt not aynen: "Hesap oluşturmak ücretli plan satın almaz."

### Görsel
- Canlı kart: 4 satır × 72 px, çıkan satır animasyonu (P1-2), `rest` gölge + iç hat (P0-2). Satır formatı
  "Deniz A. · Otopark" tek satır, altında neden; mevcut iki satır düzeni de olur.
- Bindirmeli Ana Sayfa görseli: `lift` gölge + `--inner-hat`; `figcaption` sol açıklama / sağ "Örnek veri".
- Mobil (390): eyebrow 12 px, h1 44 px 2-3 satır, lead 17, düğmeler yan yana (mevcut), kart 3 satır, görsel dikey
  kırpım (mevcut). Kart ilk ekranda başlık düzeyinde görünür (bugün 490 px'te başlıyor, 3 satırla 80 px kazanılır).

---

## 5. Yapılmaması gerekenler / riskler

**"AI şablon SaaS" kalıpları (ekleme):**
- Mor-mavi / turuncu-pembe gradient blob, mesh gradient, "glow" arka plan; glassmorphism (blur + yarı saydam) kart
  yığını; hero'da yüzen 3B mockup/izometrik cihaz; emoji ya da renkli ikon kartları (3×2 "özellik ızgarası");
  "Trusted by 500+ companies" logo şeridi (zaten yasak, uydurma); yıldızlı testimonial carousel; sayaç animasyonu
  ("10.000+ geçiş"); bento grid; `01/02/03` numaralı bölüm etiketleri; bölüm girişinde scroll-reveal fade-up
  (K3 ihlali + Lighthouse CLS riski); "gradient text" başlık; dönen "✓ ✓ ✓" rozet satırı; sticky "Demo iste" chat
  balonu; "Yapay zekâ destekli" rozeti.
- Başlık fontunu değiştirmek (Overpass kararı sabit); gövdeye ikinci web fontu (Inter vb.) eklemek — +60-100 KB, sistem
  fontu kalır.

**Performans riskleri:**
- `backdrop-filter` (sticky header'da) düşük cihazlarda kaydırma kareleri düşürür; P1-3'te bilinçli olarak yok.
- Gölgelerde büyük blur (>48 px) + çok öğe = paint maliyeti; P0-2 yalnız 6-7 öğe, blur ≤48.
- Çıkan satır animasyonu için 5. satır render'ı DOM'a +1 `li`; ihmal edilebilir. `will-change` ekleme.
- Yeni görsel yok; logo grayscale `filter` composite katmanı — 4 küçük öğe, sorun değil.
- Lighthouse mobil 89 mevcut SPA paketinden geliyor (plan notu); bu listede JS artışı yalnız sticky header observer
  (~10 satır). Puan değişmemeli; yayın öncesi ölçüm şart.

**Erişilebilirlik riskleri:**
- Grayscale logolar `alt` ile marka adı taşımaya devam eder; `opacity .72` görsel öğe olduğu için kontrast kuralına
  girmez ama `:focus-visible`/hover'da tam renge dönmeli.
- Hover-only bilgi yok: nav rengi değişimi + alt çizgi birlikte, çizgi yalnız hover'da belirirse klavye odakta da
  belirmeli (`:focus-visible` aynı kural).
- Canlı nokta pulse'ı (soru 3) reduced-motion'da kapalı, WCAG 2.2.2 kapsamında 5 sn üstü hareket = "Durdur" düğmesi
  zaten var.
- `details name="faq"`: bir öğe açılınca diğeri kapanır, ekran okuyucuya bildirim yok; native davranış, kabul.
- Eyebrow `<p>` h1'in üstünde: başlık sırası bozulmaz; `aria-hidden` verme (SEO ifadesi okunmalı).
- Yeni ikonlar (ShieldCheck vb.) `aria-hidden="true"`; metin zaten yanında.
- Renk: tonal gradient'in en açık noktasında side-text kontrastı ≥7:1 (23 % L bordo üstünde #F6ECEA ≈ 9:1).

**Metin riskleri:** `marketingFacts.test.ts:6-7` yasak ifadeleri: "biyometr", "KVKK uyumlu", "5 dakika", "14 gün",
"ücretsiz deneme", "Türkiye'nin", "tek satır kod", "IT ekibine gerek yok", sayı+TL/müşteri. Hero alternatifleri ve
model adı satırı bu listeyi geçer; "anında" (A) yalnız ölçümle.

---

## 6. Emre'ye açık sorular (≤5)

1. **Hero h1:** SEO ifadesi h1'de kalsın mı (eyebrow'a inmesi Google için kabul edilebilir; title/description aynı), ve
   iddia hangisi: B "Kapıdaki her geçiş, Canlı İzleme'de." mi, A "…anında ekranınızda." (D3 gecikme ölçümü yapıldı mı)?
2. **Donanım şeridi:** Logolar grayscale/düşük opaklık gösterilebilir mi (marka kullanım izinleri)? Sahada çalışan model
   listesi onayı: DS-K1T804, DS-K1T807, DS-K2804, IDE Smart paneli — Dahua/Mavisoft için model var mı? Footer'a
   Durum sayfası / Gizlilik bağlantısı eklenebilir mi (sayfalar web'de var mı)?
3. **Hareket sınırı:** K3 "tek otomatik hareket" canlı kartın bütününü mü kapsıyor? Evet ise çıkan satır fade'i ve
   "Canlı" noktasının 2 s'lik pulse'ı aynı hareket sayılır; hayır ise yalnız giren satır kalır.
4. **"PDKS yapay zekâ asistanı" maddesi:** canlı ürün özelliği mi ve görselde gösterilsin mi? Değilse madde çıkar.
5. **Mobil uygulama notu:** "Mobil uygulama yakında" cümlesi kalacak mı (1.0.5 mağazaya ne zaman)? Mağaza çıkınca
   kurulum bölümü altına App Store / Google Play bağlantısı; o güne kadar not SSS'ye taşınsın mı?
