# Landing W3 — Hero canlı akış + bölüm düzenleri

ÖNCE `.claude/orca-specs/landing-ortak.md` dosyasını oku: YASAK + repo kuralları + kapılar + rapor biçimi aynen geçerli.
Rapor yolu: `/tmp/landing-w3/RAPOR.md` · ekran görüntüleri: `/tmp/landing-w3/`.
Ön koşul (bitti): W1 tipografi (`/tmp/landing-w1/RAPOR.md`: Overpass, tip ölçeği, `.pub-band`, sticky SSS) ve W2 görseller
(`/tmp/landing-w2/RAPOR.md` + `/tmp/landing-w2/assets.json`: kırpım dosyaları, en/boy). İkisinin raporunu oku; W1'in CSS kararlarını bozma.
Plan + wireframe: `docs/ui-scan/public/LANDING_PLAN_2026-10-23.md` ("Sayfa yapısı" bölümü). İki aşama sırayla: önce W3a, sonra W3b.

## Hedef (test edilebilir)
Ana sayfada hero'nun sağında ~3 sn'de bir yeni satır alan, durdurulabilir, reduced-motion'da sabit duran bir Canlı İzleme örnek kartı var;
özellikler bölümü 3 farklı düzende (tam genişlik / ikili / şerit) okunur kırpımları gösteriyor; donanım şeridi model adlarını listeliyor;
Güvenlik bölümü açık ton bantta; 1440/1024/768/390'da yatay taşma 0 ve CLS < 0,05.

## W3a — Hero
1. Yeni `src/components/landing/LiveFeedDemo.tsx` (+ `LiveFeedDemo.test.tsx`). Veri: `marketingFacts.liveFeed` (metinler + 8 olay; saat YOK).
   - 4 satır gösterir; en üstteki en yeni. Saatleri bileşen üretir: SSR/ilk render deterministik (en üst 09:14, satırlar arası 2-3 dk geriye);
     her ilerlemede en üste sıradaki olay girer, saati bir öncekinden 1-3 dk ileri; 23:59'dan sonra 00:00'a sarar. Bunu SAF fonksiyon yap
     (ör. `feedRows(events, step, count)`), testle.
   - Zamanlayıcı: 3000 ms. Yeni satır girişi: `translateY(-8px)`+`opacity 0→1`, 280 ms, `cubic-bezier(0.16, 1, 0.3, 1)`; alttaki satır
     sabit yükseklikli kartın dışına düşüp kaybolur (layout zıplaması yok). Başka animasyon YOK ("Canlı" noktası yanıp sönmez).
   - Durma: "Durdur/Sürdür" düğmesi (`type="button"`, `aria-pressed`, ≥44 px dokunma alanı) · fare kartın üstündeyken ve odak kart içindeyken
     durur · `document.hidden` iken durur · ekran dışındayken (`IntersectionObserver`) durur. Unmount'ta tüm zamanlayıcı/gözlemciler temizlenir.
   - `prefers-reduced-motion: reduce`: zamanlayıcı hiç başlamaz, düğme gizli, 4 sabit satır.
   - Erişilebilirlik: satır listesi `aria-hidden="true"`; kartın erişilebilir adı `liveFeed.label` (ör. `role="group"` + `aria-label`);
     ekran okuyucuya canlı duyuru (aria-live) YOK; "Örnek veri" görünür metin. Durum yalnız renkle değil, metinle ("İzin verildi"/"Reddedildi").
   - Görünüm: beyaz yüzey (`--surface`), 8 px köşe, ince çizgi; başlık satırı "Canlı İzleme" + sağda statik yeşil nokta + "Canlı";
     satır ızgarası: saat (tabular-nums, gri) · ad (600) + kapı (küçük, gri) · durum çipi (izin: `--success` metin + `--success-subtle` zemin;
     red: `--destructive` metin + açık kırmızı zemin, altında küçük neden metni). Alt satır: Durdur düğmesi solda, "Örnek veri" sağda.
     Masaüstü genişlik ~480–520 px; mobil tam genişlik.
   - SSR güvenli: modül seviyesinde `window`/`document` yok; `matchMedia` yalnız effect içinde.
2. `HeroSection.tsx`: sol sütun h1 + açıklama + 2 düğme + not; sağ sütun `LiveFeedDemo` (alt kenarlar hizalı).
   DİKKAT (W1 bulgusu): 72 px'te "Kapıda okutulan her kart," ~850 px; dar sol sütunda zorunlu `<br>` yüzünden "kart," tek başına satıra
   düşüyor. Hero h1'de `<br>`'yi tüm genişliklerde gizle (metinde `<br>` öncesi boşluk var) ve `text-wrap: balance` ile doğal sarmaya bırak;
   tek kelimelik yetim satır kalmasın. Sütun oranını buna göre seç (h1 en fazla 3 satır). ≤1023 px'te tek sütun:
   metin → canlı kart. Altındaki bindirmeli Ana Sayfa görseli kalır, ama `ana-sayfa-2400.webp` srcset'e girer ve ≤600 px'te
   `<source media="(max-width: 600px)">` ile `ana-sayfa-m-{700,1400}` gösterilir. Caption `copy.heroCaption`.
3. `ProductShot.tsx`: isim-kalıbı (`${name}-1600/800`) yerine açık kaynak listesi alacak şekilde genişlet: masaüstü `srcSet` + `width`/`height`
   (W2 `assets.json`'daki gerçek en/boy — CLS için şart) + opsiyonel mobil kaynak (`<source media>` + kendi width/height) + `sizes`.
   Tipler açık (`any` yok). Var olan çağrılar (hero) yeni API'ye taşınır. `aspect-ratio: 1.6` sabitini kaldır, oran width/height'tan gelsin.

## W3b — Bölümler
4. Yeni `src/components/landing/HardwareStrip.tsx`: HeroSection'daki donanım şeridini buraya taşı. Başlık `hardware[0]` ("Test edilen cihazlar"),
   `hardwareModels` listesi (marka küçük/gri, model display fontunda ~20 px; masaüstünde aralarında dikey ince çizgi, mobilde alt alta),
   altında not `hardware[1]`. `hardwareBrands` alanını kullanmaya devam etmek zorunlu değil (test yalnız değerini kontrol ediyor).
   Fotoğraf için yer AYIRMA (v1 fotoğrafsız); kod içinde yorum da bırakma.
5. `FeaturesSection.tsx`: `features` dizisi (4 öğe) aynı; düzen eşlemesi bileşende:
   - 0 Canlı İzleme = **tam genişlik**: üstte iki sütun (sol: modül adı + h3 + açıklama; sağ: 3 madde), altta `crop-canli` 1200 px tam genişlik.
   - 1 PDKS + 2 Geçiş Kontrol = **ikili**: iki eşit sütun; her biri modül adı + h3 + açıklama + kırpım (`crop-pdks` / `crop-gecis`, ~585 px) + 3 madde.
   - 3 Vardiya ve İzin = **şerit**: üstte iki sütun (başlık | maddeler), altta `crop-vardiya` geniş şerit.
   - Her kırpımın altında `feature.caption`; alt metin `feature.alt`. Mobilde (≤600) hepsi tek sütun, `-m-` kaynakları.
   - Eski zigzag CSS'i (`.pub-feature-row.pub-reverse`, `.pub-extra-shot`, kullanılmayan kurallar) temizle.
6. `SecuritySection.tsx`: bölüme `pub-band` sınıfı (W1 tanımladı); bant içi boşlukları ayarla; bantla komşu bölüm çizgileri çift görünmesin.
7. `FinalCTASection.tsx`: `accountDescription` paragrafını kaldır (yalnız hero'da kalıyor).
8. `PublicFooter.tsx`: `footerDescription` + altında `footerLocation`; telefon bağlantısı (`copy.phone` / `copy.phoneHref`) e-postanın yanına.
9. Kullanılmayan eski görselleri LİSTELE (silme): `public/marketing/*-1600.webp`, `*-800.webp` içinden artık hiçbir `src/` dosyasında
   referansı kalmayanlar (`grep -r`). `AuthShell.tsx` `ana-sayfa-1600/800` kullanıyor — ona dokunma, o dosyalar kalır.

## Ownership (yalnız bunlara yaz)
`src/components/landing/LiveFeedDemo.tsx` + `.test.tsx` (yeni) · `src/components/landing/HardwareStrip.tsx` (yeni) ·
`src/components/landing/HeroSection.tsx` · `FeaturesSection.tsx` · `SecuritySection.tsx` · `FinalCTASection.tsx` · `HowItWorksSection.tsx` ·
`src/components/public/ProductShot.tsx` (+ gerekirse `ProductShot.test.tsx` yeni) · `src/components/public/PublicFooter.tsx` ·
`src/components/public/public.css` · `/tmp/landing-w3/**`

## Kapsam dışı
`marketingFacts.ts` ve testi (metin hazır; eksik anahtar gerekirse `ask`) · `AuthShell.tsx` · `index.html` · `public/marketing/**` dosyaları
(yeni dosya üretme/silme yok) · `scripts/**` · tip ölçeği/font (W1'in kararları; yalnız yeni bileşenlerin kendi boyutları).

## Kabul (Playwright ile kanıtla, `/tmp/landing-w3/check.mjs`, dev: `http://localhost:8081/`)
- 1440, 1024, 768, 390 tam sayfa + ilk ekran görüntüleri; her genişlikte `scrollWidth === innerWidth`.
- Canlı kart: 3,5 sn içinde en üst satırın adı değişir, satır sayısı 4 kalır; "Durdur"a basınca 7 sn değişmez; fare üstündeyken değişmez.
- `reducedMotion: 'reduce'` bağlamında 7 sn boyunca değişmez ve düğme görünmez.
- Klavye: Tab sırası atlama bağlantısı → menü → hero düğmeleri → Durdur; odak halkası görünür.
- Tüm `<img>`'ler yüklü (`naturalWidth > 0`); 390'da mobil kaynak seçilmiş (`currentSrc` `-m-` içeriyor).
- Yükleme CLS < 0,05 (PerformanceObserver, ilk 3 sn).
- Kapılar (ortak dosya) + `LiveFeedDemo.test.tsx` geçer; `src/components/landing/marketingFacts.test.ts` yeşil kalır.
