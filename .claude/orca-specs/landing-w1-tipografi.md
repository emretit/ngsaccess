# Landing W1 — Tipografi + ritim

ÖNCE `.claude/orca-specs/landing-ortak.md` dosyasını oku: YASAK + repo kuralları + kapılar + rapor biçimi aynen geçerli.
Rapor yolu: `/tmp/landing-w1/RAPOR.md` · ekran görüntüleri: `/tmp/landing-w1/`.

## Hedef (test edilebilir)
Landing (`/`) başlıkları Overpass 700 ile, plandaki tip ölçeğinde render edilir; gövde/menü/form sistem fontunda kalır;
1440 px'te tüm yatay ayırıcı çizgiler içerik genişliğinde (x=120…1320); yükleme sırasında CLS < 0,05.

## Hazır olan
- Font dosyaları (koordinatör indirdi, OFL lisanslı): `public/fonts/overpass/overpass-700-latin.woff2` (17,5 KB),
  `public/fonts/overpass/overpass-700-latin-ext.woff2` (20,7 KB), `public/fonts/overpass/OFL.txt`.
- Google'ın unicode-range değerleri:
  - latin: `U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD`
  - latin-ext: `U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF`

## Yapılacaklar
1. `public.css` başına iki `@font-face` (`font-family: 'Overpass'`, `font-weight: 700`, `font-display: swap`, yukarıdaki
   unicode-range'ler, `url('/fonts/overpass/...')`). `index.html`'e preload EKLEME.
2. CLS için metrik ayarlı yedek: `@font-face { font-family: 'Overpass Fallback'; src: local('Arial'); size-adjust / ascent-override /
   descent-override / line-gap-override }`. Değerleri Playwright ile ölç: aynı h1 metnini (ör. "Kapıda okutulan her kart,") Overpass 700
   ve Arial bold ile render et, genişlik oranından `size-adjust`'ı bul; ölçümü rapora yaz.
3. `--public-display: 'Overpass', 'Overpass Fallback', var(--font-sans);` tanımla (`:root` içinde, public.css'te).
   DİKKAT: şu an `.pub-page`, `.pub-site-header`, `.pub-site-footer` gövdede de `var(--public-display, …)` kullanıyor → bunlar
   `var(--font-sans)` olsun. Display font YALNIZ: `.pub-page :is(h1, h2, h3)`, `.pub-hardware-brands`, `.pub-step-number`,
   `.pub-contact-lines a`.
4. Tip ölçeği (Overpass için `letter-spacing: -0.025em`; eski -0.035em/-1.5px/-0.6px değerlerini buna göre güncelle):
   | Öğe | ≥1251 | 1024–1250 | 601–1023 | ≤600 | line-height |
   |-----|-------|-----------|----------|------|-------------|
   | h1 (hero) | 72 | 64 | 56 | 44 | 1.04 |
   | h2 (bölüm, son CTA dahil) | 52 | 48 | 44 | 34 | 1.06 |
   | h3 özellik (`.pub-feature-row h3`) | 28 | 28 | 26 | 24 | 1.15 |
   | h3 adım/güvenlik | 22 | 22 | 22 | 21 | 1.2 |
   | gövde `.pub-page` | 17 | 17 | 17 | 16 | 1.6 |
   Aynı öğe için birbirini ezen kural bırakma (ör. `.pub-hero h1` ile `.pub-page h1` çakışmasını tek yerde çöz).
5. Bölüm çizgileri: `.pub-section` `border-bottom` şu an gutter'ı da kapsıyor (x=88…1352). Çizgiyi içerik genişliğine çek
   (ör. `border-bottom` yerine `background: linear-gradient(...) bottom / calc(100% - 2 * var(--public-gutter)) 1px no-repeat`
   ya da eşdeğeri). Mobilde de içerikle hizalı olsun.
6. Yeni yardımcı sınıf `.pub-band` (W3b SecuritySection'a uygulayacak; sen yalnız sınıfı tanımla): `pub-wrap` genişliğindeki
   bölümün arka planını ekran kenarlarına kadar `hsl(var(--side-text))` (#F6ECEA) yap (ör. `box-shadow: 0 0 0 100vmax …;
   clip-path: inset(0 -100vmax)`), bölüm çizgisini gizle; yatay kaydırma çubuğu oluşturmasın. Bant üstündeki gri metnin
   kontrastını hesapla (≥4,5:1 olmalı; değilse bant içinde metin rengini `--text`'e yaklaştır) ve rapora yaz.
7. SSS başlığı: ≥1024 px'te `.pub-faq > h2` `position: sticky; top: 32px; align-self: start;`; altında normal akış.
8. `src/components/public/AuthShell.tsx`: yalnız iki başlığa (h1 satır ~39, h2 satır ~61) display fontu ver
   (Tailwind 4: `font-(family-name:--public-display)` ya da eşdeğeri) ve `tracking-[-.035em]` → `tracking-[-.025em]`.
   AuthShell `public.css`'i import etmiyorsa değişken tanımsız kalır → bunu kontrol et; gerekirse AuthShell'e
   `import '@/components/public/public.css';` ekle (başka değişiklik yok).

## Ownership (yalnız bunlara yaz)
`src/components/public/public.css` · `src/components/public/AuthShell.tsx` (yalnız 8. madde) · `/tmp/landing-w1/**`

## Kapsam dışı
Metin, görsel dosyaları, bileşen yapısı/JSX düzeni (AuthShell başlık sınıfları hariç), `index.html`, `src/index.css`, hero/özellik düzeni
(W3'ün işi), `public/marketing/**` (W2 paralel çalışıyor).

## Kabul (Playwright ile kanıtla, `/tmp/landing-w1/check.mjs`)
- 1440 ve 390'da `document.fonts.check('700 52px Overpass')` true; h1/h2/h3/gövde computed font-size tabloyla aynı.
- h1 font-family `Overpass` ile başlıyor; `p` ve nav bağlantıları sistem fontunda.
- 1440'ta `.pub-section` ayırıcıları ve özellik satırı çizgileri x=120…1320.
- Yükleme CLS (PerformanceObserver `layout-shift`, ilk 3 sn) < 0,05; değeri rapora yaz.
- 390'da yatay taşma 0 (`document.documentElement.scrollWidth === 390`).
- Ekran görüntüleri: `/tmp/landing-w1/1440-fold.png`, `/tmp/landing-w1/390-fold.png`, `/tmp/landing-w1/login-1440.png` (`/login`).
