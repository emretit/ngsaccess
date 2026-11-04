# Landing polish Faz 2 — denetim (Fable, 2026-11-04)

**Hüküm: yayına hazır. MUST 0 · SHOULD 4 · NIT 6.** U1-U7 + K-A/B/C/D spec'e uygun uygulanmış; login/register'da gerileme
yok; "tek animasyon" kuralı artık gerçekten tek (`pub-feed-enter`). SHOULD'lar ~30 dk'lık cila, yayını bloke etmez.

Kaynak: `git diff` (13 dosya) + `/tmp/landing-polish/impl.md` · Playwright 390/768/1024/1440 SONRA çekimleri
`/tmp/landing-polish/shots-after/` (ÖNCE: `shots-fable/`) · gölge kıyası `/tmp/landing-polish/shadow-compare.png`.

## Kapılar (kendi koşumum)
| Kapı | Sonuç |
|---|---|
| `tsc --noEmit -p tsconfig.app.json` | 0 hata |
| `eslint src/components/landing src/components/public src/components/ui/sheet.tsx src/pages` | 0 hata |
| `npx vitest run` (tam) | 505 dosya / 5571 test geçti, 71 s |

## Spec kontrolü (satır satır)
| İş | Durum | Kanıt |
|---|---|---|
| U1 tablet kırpım | ✓ | `FeaturesSection.tsx:22,37,52,67` media → `(max-width: 1023px)`; `public.css:692-699` ≤1023 tek sütun; 768'de tablo yazısı okunur (`w768-ozellikler.png`) |
| U2 LiveFeed | ✓ | `LiveFeedDemo.tsx:91-103` kontroller üst şeritte, DOM sırası üstte; Tab sırası: Özellikleri incele → **Durdur** → donanım bağlantısı; `aria-pressed` korunmuş; chip/neden 12 px (`public.css:961,967`); kart 450 → 387 px; 4 satır mobilde de kalıyor; `LiveFeedDemo.test.tsx:55-57` sırayı test ediyor |
| U3 tek animasyon | ✓ | `sheet.tsx:72,85,93` opsiyonel `overlayClassName`; `PublicHeader.tsx:60` overlay `animate-none` — ölçüm: overlay `animationName: none`; FAQ `transform/rotate` yok (`public.css:568-585`), statik +/−; sayfada `transform` içeren geçiş 0, animasyon yalnız `pub-feed-enter` |
| K-B hover | ✓ | `public.css:1033-1042` yalnız color/bg/border/shadow 140 ms ease-out; reduced-motion'da 0 ms (`:1055-1065`); ok ikonu yok |
| K-C gölge | ✓ | `--public-shadow-rest` (`public.css:29`) → `.pub-features .pub-product-shot:not(.pub-elevated) > div` (`:87`) + `.pub-live-feed` (`:891`); hero `elevated` değişmedi; FAQ/iletişim/donanım gölgesiz — `shadow-compare.png` |
| U4 donanım | ✓ | kutular kalktı, 4 sütun/2×2, logolar renkli, ölçülen yükseklik 20/30/40/20 px; cümle `Link to="/#iletisim"` (`HardwareStrip.tsx:19`); model adı yok |
| U5 küçük metin + iletişim | ✓ | hero notu 14, figcaption 13, footer alt 13 (`public.css:260,276,635`); `contactNote` kaldırıldı, `contactHelp` yeni cümle; hover'da ikon kutusu beyaz (`:492`); footer telefon ayrı `<p>` (`PublicFooter.tsx:24-28`) |
| U6 hero h1 | ✓ | iki `<span>` (`HeroSection.tsx:13-14`), `aria-hidden` yok; erişilebilir ad "Bulut PDKS ve Geçiş Kontrol Kapıdaki her geçiş, Canlı İzleme'de."; 1440'ta 20 px + 72 px 2 satır, 390'da 16 + 44 px 3 satır; kategori kontrastı 9:1; `index.html`/`usePageTitle` değişmedi |
| U7 final CTA | ✓ | başlık + `pub-text-link` "Bize yazın" `mailto:` (`FinalCTASection.tsx:17-19`); mobilde yan yana sarılıyor |
| Login/Register | ✓ | 1440 + 390 çekimlerde fark yok (`desk-login.png`, `mob-register-top.png`); ortak CSS değişiklikleri (figcaption 13, `.pub-btn` geçişi) zararsız |
| `LandingTitle.tsx` | ölü değil | hâlâ `SecuritySection`, `PricingSection`, `FinalCTASection` kullanıyor |

## Bulgular

### MUST — yok

### SHOULD
1. **Donanım bağlantısı bağlantı gibi görünmüyor** — `HardwareStrip.tsx:19` + `public.css:292-295`: Tailwind preflight
   `a { text-decoration: inherit }` → cümle alt çizgisiz, muted gri, hover'da değişmiyor; ziyaretçi tıklanabilir olduğunu
   anlayamaz (`desk-pub-wrap.png`). Düzeltme: `.pub-hardware-head a { text-decoration: underline; text-underline-offset: 4px;
   color: hsl(var(--text)) }` + `:hover { color: hsl(var(--primary)) }` ve geçiş listesine ekle. ~5 dk.
2. **Nav hover'ında iki sinyal + dolgusuz kutu** — `public.css:1043-1051` `background-color` ekliyor ama `.pub-site-nav a`
   yatay padding'siz (`:188-195`) → metne yapışık 60×44 px kutu + `:206-208`'deki alt çizgi aynı anda (`desk-hover-nav.png`).
   Düzeltme: `.pub-site-nav a, .pub-header-actions > a:not(.pub-btn) { padding-inline: 10px; margin-inline: -10px;
   border-radius: 6px }` ve `:206-208` alt çizgi kuralını kaldır (tek sinyal zemin). ~10 dk.
3. **h1 erişilebilir adı tek nefeste** — `HeroSection.tsx:13`: iki parça arasında yalnız boşluk; ekran okuyucu "…Geçiş Kontrol
   Kapıdaki her geçiş…" diye birleştirir. Düzeltme: kategori span'ının sonuna `<span className="sr-only">. </span>` (görsel
   değişmez). ~2 dk.
4. **1024 px'te çift sütun kırpımları küçük** — `public.css:692` tek sütun eşiği 1023; 1024-1100 aralığında PDKS/Geçiş 1200w
   masaüstü kırpımı ~440 px'e iniyor, Geçiş Kontrol tablosu ~8 px (`w1024-features-pair.png`). Düzeltme: `.pub-feature-pair`
   tek sütun eşiğini ve `FeaturesSection.tsx:37,52` media'yı `(max-width: 1100px)` yap; `pairSizes` aynı şekilde. ~10 dk.

### NIT
- `marketingFacts.ts:151` `contactNote` artık kullanılmıyor (ölü anahtar) — sil.
- `public.css:584-586` FAQ `summary:hover` zemini `details`'in 8 px köşesinden taşıyor (`overflow` yok) — `summary {
  border-radius: 7px }` ya da `details { overflow: hidden }`.
- `public.css:162-172` `.pub-text-link` ("Bize yazın") hover/alt çizgi ve geçiş yok — `text-decoration: underline` hover'da.
- `public.css:986` `.pub-feed-sample` 12 px kaldı; spec 12-13 diyor ama diğer küçük metinler 13'e çıktı — 13 px.
- Mobil h1 `text-wrap: balance` ile "Kapıdaki / her geçiş, / Canlı İzleme'de." (`mob-pub-site-header.png`): ilk satır tek
  kelime. 44 px'te 2 satıra sığmıyor; kabul, ama `heroTitle`'da "Kapıdaki her geçiş," denenebilir.
- `public.css:633-637` footer alt satırı 3 öğe `space-between` → aydınlatma bloğu ortada (`desk-pub-site-footer.png`);
  okunur ama `gap` ile sola yığmak (`justify-content: flex-start; gap: 16px 40px`, telefon `margin-left:auto`) daha düzenli.

## Ölçülen değişim (1440 / 390)
| | Önce | Sonra |
|---|---|---|
| Canlı kart yüksekliği | 450 / 450 | 387 / 387 |
| Mobil hero yüksekliği | 964 | 940 |
| Sayfa yüksekliği (390) | 8 639 | 8 574 |
| Donanım şeridi (1440 / 390) | 251 / 344 | 238 / 296 |
| 768'de Canlı İzleme tablo yazısı | ~6 px | ~20 px (mobil kırpım) |
