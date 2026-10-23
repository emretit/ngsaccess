# Landing modernizasyon planı — 2026-10-23

Hedef: ngsplus.app ana sayfası şablon SaaS görünümünden çıkıp ürüne özgü, modern ve okunur hale gelsin.
Kaynak: [LANDING_AUDIT_2026-10-23.md](LANDING_AUDIT_2026-10-23.md) (L1-L9). Toplam ~1 iş günü (worker süresi), yayın ayrı.

## Checklist

### Dalga 0 — Hazırlık + metin (koordinatör, ~1 sa)
- [ ] 0.1 (commit CEO'da, yayınla birlikte) Bekleyen 2 değişiklik (görsel tıklama kaldırma + info@ngsteknoloji.com) commit'lensin — Emre/CEO
- [x] 0.2 Önce/sonra karşılaştırması için ekran görüntüleri + Lighthouse ölçümü (1440 + 390)
- [x] 0.3 `marketingFacts.ts` yeni metinler + `marketingFacts.test.ts` + `index.html` meta senkronu

### Dalga 1 — Paralel 2 worker (~2,5 sa)
- [x] W1 Tipografi + ritim: Overpass, tip ölçeği, çizgiler, açık bant, sticky SSS, AuthShell başlıkları
- [x] W2 Görseller: kırpım betiği + 4 masaüstü + 5 mobil kırpım + 2400w hero

### Dalga 2 — Tek worker, sıralı (~5 sa)
- [x] W3a Hero: `LiveFeedDemo` canlı akış + yeni hero düzeni + mobil düzen
- [x] W3b Donanım şeridi + özellikler bölümünün 3 düzeni + güvenlik, footer, son CTA

### Dalga 3 — Denetim + kapı (~1,5 sa)
- [x] D1 Claude denetçi worker'ı: diff + ekran görüntüsü + erişilebilirlik
- [x] D2 Koordinatör kapısı: tsc, eslint, tam vitest, build, Playwright 4 genişlik, Lighthouse
- [ ] D3 "anında" iddiası için gerçek kart okutma gecikmesi ölçümü (Emre, NGS0002)

### Dalga 4 — Yayın (Emre onayı)
- [ ] Y1 Commit (CEO) → Netlify CLI `deploy --prod --no-build` → canlı CSS'te Overpass doğrulaması

## Durum (2026-10-23 12:25 TR)
Kod tamam, commit'siz, yayında değil. Kapılar: tsc (src) 0 · eslint 0 hata · tam vitest 345 dosya / 3850 test · build OK
(LandingPage chunk 3,8 KB gzip). Lighthouse mobil (prod build, yerel): performans 89 = HEAD ile aynı (2 ölçüm, değişikliğin maliyeti 0;
90 altı mevcut SPA paketinden) · erişilebilirlik 100 · best practices 100 · SEO 100 · CLS 0. D1 7 bulgu → 6'sı düzeltildi
(Sürdür odakta donma, footer hizası, CTA öncesi çizgi, ikili satır boşluğu, 768 başlık 4 satır, yarım not çizgisi); 7. (ölü anahtar) yanlış alarm.
Kalan: D3 gecikme ölçümü (Emre) → Y1 commit + yayın (CEO, Emre onayı). Raporlar: /tmp/landing-w1|w2|w3|d1/RAPOR.md.

## Alınan kararlar

| # | Konu | Karar | Neden |
|---|------|-------|-------|
| K1 | Başlık fontu | **Overpass 700**, `letter-spacing: -0.025em`; gövde sistem fontunda kalır | Yol tabelası fontu Highway Gothic'ten türemiş, "kapı/geçiş" konusuna bağlanıyor; Türkçe İĞŞÜ temiz (bkz. `landing-audit-2026-10-23/font-karsilastirma.png`). 19 Ekim'deki K5 (sistem fontu) kararını değiştirir |
| K2 | Hero başlık | "Kapıda okutulan her kart,<br>anında ekranınızda." | Ürünün en özgün anı. D3'te gecikme >5 sn çıkarsa yedek: "Kapıdaki her geçiş,<br>Canlı İzleme'de." |
| K3 | Hareket | Sayfada **tek** otomatik hareket: hero'daki canlı akış | Dağınık animasyonlar şablon gibi durur; tek an akılda kalır |
| K4 | Görseller | Tam ekran yerine okunur **kırpım**, 2x çözünürlük, mobil için ayrı kırpım | 5 px yazı okunmuyor, tıklayıp büyütme de yok |
| K5 | Görsel kaynağı | `docs/ui-scan/pages/*/mockup.html` (örnek veri) | Gerçek müşteri verisi sayfaya girmez |
| K6 | Donanım | Model adları: Hikvision DS-K1T804, DS-K1T807; IDE Smart kontrol paneli. Fotoğraf yok (v1), yer ayrılır | Canlıda çalışan cihazlar; logo kullanılmaz. Fotoğraf gelince eklenir |
| K7 | Güven | Footer: "NGS Plus, NGS Teknoloji ürünüdür." + telefon + e-posta. Tam unvan/adres gelince eklenir | Şirket arkası görünür olur; bilmediğimiz adresi uydurmuyoruz |
| K8 | Güvenlik metni | Somut: proje bazlı erişim, 5 rol × 13 yetki, denetim kaydı. Biyometri/KVKK iddiası **yok** | `marketingFacts.test.ts` "biyometr" ve "KVKK uyumlu" ifadelerini yasaklıyor (P-20/22) |
| K9 | Renk | A2 paleti aynen kalır; yeni renk yok | Uygulama ile landing aynı marka dilinde kalır |
| K10 | Kapsam | Landing + PublicHeader/Footer + AuthShell başlık fontu. Login/Register formları değişmez | Landing'den kayda geçişte başlık fontu tutarlı kalır |

## Tasarım sistemi

**Renk** (değişmez, `src/index.css` A2 token'ları):
| Ad | Hex | Token | Kullanım |
|----|-----|-------|----------|
| Bordo sahne | `#551919` | `--side-bg` | hero, son CTA |
| Bordo vurgu | `#7A1F1F` | `--primary` | düğme, bağlantı, modül adı |
| Kırık beyaz | `#FCFCFC` | `--canvas` | sayfa zemini |
| Mürekkep | `#252523` | `--text` | metin |
| Kemik pembe | `#F6ECEA` | `--side-text` | sahne üstü metin + Güvenlik bandı zemini |
| İzin verildi | `#356047` / açık zemin | `--success` / `--success-subtle` | yalnız canlı akış verisi |
| Reddedildi | `#963E36` | `--destructive` | yalnız canlı akış verisi |

**Tip ölçeği** (masaüstü → ≤600 px):
| Öğe | Font | Boyut | Satır yüksekliği |
|-----|------|-------|------------------|
| h1 hero | Overpass 700 | 72 → 44 px | 1.02 |
| h2 bölüm | Overpass 700 | 52 → 34 px | 1.06 |
| h3 özellik | Overpass 700 | 28 → 24 px | 1.15 |
| Gövde | sistem | 17 → 16 px | 1.6 |
| Küçük not / alt yazı | sistem | 13 px | 1.5 |

**Font teslimi:** `public/fonts/overpass/` altına Google Fonts'tan latin (39 KB) + latin-ext (46 KB) değişken woff2
+ `OFL.txt`. `@font-face` `public.css`'te (yalnız public sayfalar yükler), `unicode-range` ile, `font-display: swap`.
Yazı kaymasını (CLS) azaltmak için Arial'dan türetilmiş `size-adjust`/`ascent-override` ayarlı yedek `@font-face`.
`index.html`'e preload **yok** (uygulama sayfaları da bu dosyayı kullanıyor).

**Biçim kuralları:** panel köşesi 8 px, düğme 6 px; gölge yalnız hero görselinde; çizgiler hep içerik genişliğinde;
hover'da büyütme/kaydırma yok; geçişler yalnız `transform` + `opacity`.

## Sayfa yapısı

### Masaüstü (1440)
```
┌──────────────────────────── bordo sahne ────────────────────────────┐
│ NGS Plus           Özellikler  Kurulum  Güvenlik  İletişim  Giriş [Hesap oluştur] │
│                                                                      │
│ Kapıda okutulan her kart,          ┌ Canlı İzleme ─────── ● Canlı ┐  │
│ anında ekranınızda.                │ 09:14  Deniz A.  Otopark     ✕ Reddedildi │ ← yeni satır üstten kayar
│                                    │        Yetki yok             │  │
│ Geçişleri izleyin, kapı            │ 09:12  Burak Y.  Ana Giriş   ✓ İzin verildi │
│ yetkilerini düzenleyin, ...        │ 09:09  Selin K.  Ana Giriş   ✓ İzin verildi │
│ [Hesap oluştur] [Özellikleri incele]│ 09:06  Mert Ç.   Depo        ✓ İzin verildi │
│ Hesap oluşturmak ücretli plan...   │ [❚❚ Durdur]   Örnek veri     │  │
│                                    └──────────────────────────────┘  │
├────────────── Ana Sayfa ekranı (bindirmeli, 2400w, gölgeli) ──────────┤
│ Test edilen cihazlar   Hikvision DS-K1T804 │ Hikvision DS-K1T807 │ IDE Smart kontrol paneli │
├──────────────────────────────────────────────────────────────────────┤
│ Kapıdan puantaja,                 Kart okutması geçiş kaydına,       │
│ günün bütün kaydı.                geçiş kaydı puantaja dönüşür.      │
│                                                                      │
│ ① Canlı İzleme — başlık solda, 3 madde sağda (2 sütun)               │
│ [──────────── tam genişlik kırpım: akış satırları + red nedeni ─────]│
│                                                                      │
│ ② PDKS Kayıtları             │ Geçiş Kontrol                         │
│ [kırpım: tablo + dışa aktar] │ [kırpım: kural satırları]             │
│ 3 madde                      │ 3 madde                               │
│                                                                      │
│ ③ Vardiya ve İzin — başlık + madde üstte                             │
│ [──── geniş şerit kırpım: haftalık takvim, gece vardiyası, izin ────]│
├──────────────────────────────────────────────────────────────────────┤
│ Üç adımda kurulum.   1 Projenizi açın  2 Cihazları bağlayın  3 Kişi ve kurallar │
├────────────────── kemik pembe bant (#F6ECEA) ─────────────────────────┤
│ Kim neyi görür,          Proje bazlı erişim / 5 rol, 13 yetki /      │
│ kim neyi değiştirir?     Denetim kaydı                               │
├──────────────────────────────────────────────────────────────────────┤
│ İletişim (e-posta, telefon büyük)                                    │
│ Sorular [sticky başlık] │ akordeon                                   │
├──────────────────────────── bordo sahne ────────────────────────────┤
│ Projenizi açın, ilk kapıyı bağlayın.                 [Hesap oluştur] │
├──────────────────────────────────────────────────────────────────────┤
│ NGS Plus — NGS Teknoloji ürünüdür.   Özellikler İletişim Giriş       │
└──────────────────────────────────────────────────────────────────────┘
```
Hizalama: tüm metin sola. Hero iki sütun (1.1fr / 1fr), metin ve canlı kart alt kenarda hizalı.

### Mobil (390)
- Hero: başlık 44 px → açıklama → 2 düğme yan yana → not → canlı kart (tam genişlik, 3 satır).
- Hero altındaki Ana Sayfa görseli mobilde ayrı kırpım (`ana-sayfa-m`: üst özet kartları + son okutmalar).
- Donanım: 3 model alt alta.
- Özellikler: hepsi tek sütun; her biri mobil kırpımla (`<picture><source media="(max-width: 600px)">`).
- Yatay taşma 0; dokunma alanları ≥44 px.

## Metinler (Dalga 0.3 — koordinatör yazar)

| Anahtar | Yeni metin |
|---------|-----------|
| `heroTitle` | Kapıda okutulan her kart,<br>anında ekranınızda. |
| `heroDescription` | Geçişleri izleyin, kapı yetkilerini düzenleyin, PDKS ve vardiya kayıtlarını aynı hesaptan yönetin. |
| `accountDescription` | Hesap oluşturmak ücretli plan satın almaz. *(yalnız hero; son CTA'dan kalkar)* |
| `productCaption` | kaldırılır → her kırpımın kendi `caption`'ı |
| `featuresTitle` | Kapıdan puantaja,<br>günün bütün kaydı. |
| `featuresDescription` | Kart okutması geçiş kaydına, geçiş kaydı puantaja dönüşür. |
| Canlı İzleme caption | Reddedilen geçişin nedeni satırda yazar. |
| PDKS caption | Günlük, haftalık, aylık görünüm; Excel ve PDF çıktısı. |
| Geçiş Kontrol caption | Her kural kişi, kapı ve saat aralığıyla tanımlanır. |
| Vardiya caption | Gece vardiyası ertesi güne taşar, izinler takvimde görünür. |
| `hardwareTitle` (yeni) | Test edilen cihazlar |
| `hardwareModels` (yeni) | Hikvision DS-K1T804 · Hikvision DS-K1T807 · IDE Smart kontrol paneli *(dizi; ayraç UI'da çizgi)* |
| `setupTitle` | Üç adımda kurulum. *(`setupDescription` kalkar)* |
| `securityTitle` | Kim neyi görür,<br>kim neyi değiştirir? |
| `securityDescription` | Erişim projeye, yetki role bağlıdır. Her yönetim işlemi kayda geçer. |
| Güvenlik 2. madde | **5 rol, 13 yetki** — Kimin kapı açacağı, kimin ücret bilgisini göreceği role göre belirlenir. |
| Güvenlik 3. madde | **Denetim kaydı** — Kim, neyi, ne zaman değiştirdi; Denetim Kaydı sayfasında. |
| `liveFeed` (yeni) | 8 örnek olay: saat, "Ad S." biçiminde isim, kapı, sonuç, red nedeni (Yetki yok / Saat dışı / Kart tanımlı değil) |
| `finalTitle` | Projenizi açın,<br>ilk kapıyı bağlayın. |
| `footerDescription` | Personel ve geçiş yönetimi. NGS Plus, NGS Teknoloji ürünüdür. |
| `extraShot` | kaldırılır (izin, vardiya şeridine girer) |

Test: `hardwareBrands` beklentisi korunur, `hardwareModels` için yeni beklenti eklenir; yasaklı ifade regex'i aynen
kalır. `index.html` `description` + `og:description` + `twitter:description` = yeni `heroDescription`.

## Worker spec'leri

Ortak (her spec'e): ana dizinde çalış, worktree yok · **git add/commit/push/deploy YOK** (`feedback_codex_worker_commits`) ·
yeni npm paketi/symlink yok · Convex'e dokunma · repo stilinde çok satırlı JSX · `any` yok · rapor `worker_done`'da
≤10 satır, file:line · kapılar: `node_modules/.bin/tsc --noEmit -p tsconfig.app.json`, `node_modules/.bin/eslint src`,
`node_modules/.bin/vitest run src/components/public src/components/landing src/pages`.

### W1 — Tipografi + ritim (Codex `gpt-6.1-sol medium`, ~1,5 sa)
- **Hedef:** Landing başlıkları Overpass 700 ile, yeni tip ölçeğinde, CLS < 0,05.
- **Ownership:** `public/fonts/overpass/*`, `src/components/public/public.css`, `src/components/public/Section.tsx`,
  `src/components/public/AuthShell.tsx` (yalnız başlık sınıfları).
- **Adımlar:** font dosyalarını indir + OFL · `@font-face` + metrik ayarlı yedek · `--public-display` tanımı ·
  tip ölçeği (tablo yukarıda) · `.pub-section` çizgisi içerik genişliğinde (border yerine iç sarmalayıcı ya da
  `::after` ile gutter içinde) · `.pub-band` sınıfı (kemik pembe tam genişlik bant) · SSS başlığı sticky (top 96 px,
  ≤1023 px'de kapalı) · AuthShell h1/h2 aynı font.
- **Kapsam dışı:** metin, görsel, bileşen yapısı.
- **Kabul:** Playwright'ta `document.fonts.check('700 72px Overpass')` true; h1/h2/h3 boyutları tabloyla aynı;
  1440'ta tüm yatay çizgiler x=120…1320.

### W2 — Ürün görselleri (Codex `gpt-6.1-sol medium`, ~2 sa) — W1 ile paralel
- **Hedef:** Okunur kırpımlar: ekrandaki UI yazısı masaüstünde ≥11 px, mobilde ≥10 px görünür.
- **Ownership:** `scripts/marketing-shots.cjs` (yeni; `/tmp/pub-p1/assets.cjs` temel alınır, Playwright yolu
  `PLAYWRIGHT_PATH` env, varsayılan Pafta node_modules), `public/marketing/*` (yalnız yeni dosyalar).
- **Çıktılar** (`deviceScaleFactor: 2`, WebP q≈78):
  | Dosya | Kaynak mockup | İçerik |
  |-------|---------------|--------|
  | `ana-sayfa-2400.webp` | 01-ana-sayfa | mevcut kare, 2400w |
  | `crop-canli-{1200,2400}` | 07-canli-izleme | akış tablosunun ilk 6 satırı, red nedenleri görünür |
  | `crop-pdks-{600,1200}` | 08-pdks-kayitlari | sekmeler + tablo + "Dışa aktar" |
  | `crop-gecis-{600,1200}` | 05-gecis-kontrol | kural tablosu |
  | `crop-vardiya-{1200,2400}` | 09-vardiyalar | haftalık takvim, gece vardiyası + yıllık izin hücresi görünür |
  | `*-m-{700,1400}` (5 adet) | aynı | mobil dar kırpım (ana-sayfa, canli, pdks, gecis, vardiya) |
- **Bütçe:** 2400w dosya ≤120 KB, diğerleri ≤70 KB; ilk ekranda yüklenen görsel ≤150 KB.
- **Kapsam dışı:** `src/` (bileşene bağlama W3b'de). Eski `*-1600/800.webp` silinmez (W3b sonrası temizlik).
- **Kabul:** betik tek komutla tüm dosyaları yeniden üretir; çıktı listesi + byte boyutları raporda.

### W3 — Hero + bölümler (Codex `gpt-6-astra high`, ~5 sa) — W1 + W2 bittikten sonra, aynı thread'de a → b
**W3a Hero**
- **Ownership:** `src/components/landing/LiveFeedDemo.tsx` (+ `.test.tsx`), `HeroSection.tsx`, `public.css` (hero bölümü).
- **LiveFeedDemo davranışı:**
  - `marketingFacts.liveFeed`'den 4 satır gösterir; ~3 sn'de bir sıradaki olay en üste girer, en alttaki çıkar.
  - Giriş: `translateY(-8px)` + opacity 0→1, 280 ms, `cubic-bezier(0.16, 1, 0.3, 1)`. Başka animasyon yok
    ("Canlı" noktası yanıp sönmez).
  - Durma: "Durdur/Sürdür" düğmesi (`aria-pressed`, ≥44 px) · fare üstündeyken ve odak içerideyken durur ·
    sekme gizliyken (`visibilitychange`) ve ekran dışındayken (`IntersectionObserver`) durur.
  - `prefers-reduced-motion: reduce` → otomatik ilerleme yok, sabit 4 satır, düğme gizli.
  - Erişilebilirlik: satır listesi `aria-hidden`, kartın `aria-label`'ı "Canlı İzleme örneği: kart okutmaları izin
    verildi veya reddedildi olarak listelenir"; ekran okuyucuya canlı duyuru yok. "Örnek veri" yazısı görünür.
  - SSR güvenli (modül seviyesinde `window` yok); zamanlayıcılar unmount'ta temizlenir.
  - Yeni bağımlılık yok (framer-motion vb. eklenmez).
- **Hero düzeni:** masaüstü 2 sütun (metin | canlı kart), altta 2400w Ana Sayfa görseli bindirmeli; mobil düzen yukarıda.
- **Testler:** SSR render (4 satır, düğme), reduced-motion'da düğme yok, saf `nextFeedState` fonksiyonu birim testi.

**W3b Bölümler**
- **Ownership:** `HardwareStrip.tsx` (yeni; HeroSection'daki şerit buraya taşınır), `FeaturesSection.tsx`,
  `ProductShot.tsx` (mobil `<source>` + `caption` prop'u + kırpım oranı prop'u), `HowItWorksSection.tsx`,
  `SecuritySection.tsx` (`pub-band`), `FinalCTASection.tsx`, `PublicFooter.tsx`, `public.css` (bu bölümler).
- **Özellikler düzeni:** `features` dizisi aynı kalır (test 4 bekliyor); sunumda düzen tipi
  `full | pair | strip` olarak `FeaturesSection` içinde eşlenir (Canlı = full, PDKS + Geçiş = pair, Vardiya = strip).
- **Kabul:** "İzinler ekranını incele" bağlantısı yok; tüm görsel kırpım dosyaları kullanılıyor; eski 1600/800
  dosyalarından yalnız referansı kalmayanlar raporda listelenir (silme koordinatörde).

### D1 — Denetim (Claude `sonnet medium`, ~45 dk) — W3 bittikten sonra
- Diff'i oku (rapora değil), kapıları kendisi koşsun, 1440/1024/768/390 + reduced-motion ekran görüntüsü al.
- Kontrol: klavyeyle sekme sırası (atlama bağlantısı → menü → hero düğmeleri → Durdur), odak görünürlüğü,
  kontrast (yeni bant üstü metin ≥4,5:1), yatay taşma, CLS, bu planla farklar.
- Çıktı: engel / düzelt / not üç başlıkta, file:line.

## Kapılar (D2 — koordinatör kendi koşar)
1. `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` → 0 hata
2. `node_modules/.bin/eslint src convex` → `no-explicit-any` 0
3. `node_modules/.bin/vitest run` (tam; `feedback_full_vitest_gate`)
4. `npm run build` → landing JS'i öncekinden en fazla +5 KB gzip
5. Playwright: 1440/1024/768/390, yatay taşma 0, reduced-motion'da akış duruyor, fontlar yüklü
6. Lighthouse mobil: performans ≥90 (önceki 92), erişilebilirlik ≥95, CLS <0,05

## Riskler
| Risk | Önlem |
|------|-------|
| Mockup'lar güncel arayüzden geri kalmış olabilir | W2 kırpımdan önce mockup'ı canlı arayüzle karşılaştırır; büyük fark varsa raporlar, uydurmaz |
| "anında" iddiası gerçek gecikmeyle uyuşmaz | D3 ölçümü; >5 sn ise K2 yedek başlığı |
| Font yüzünden CLS / LCP kötüleşir | metrik ayarlı yedek font + swap; Lighthouse kapısı |
| Codex worker commit atar | spec'te açık yasak + `worker_done` sonrası `git reflog` kontrolü |
| Ortak `public.css` çakışması | W1 → W3 sıralı; W2 CSS'e dokunmaz |

## Yayın
Kapılar yeşil + Emre onayı → CEO commit → `netlify deploy --prod --no-build` (bkz. `web_deploy_manual`) →
canlı doğrulama: `curl -s https://ngsplus.app/ | grep -o 'assets/index-[^"]*\.css'` dosyasında `Overpass` ve
`crop-canli` referansı var mı.

## Sonraya kalanlar
- Cihaz fotoğrafı (ofisteki NGS0002 terminali) → `HardwareStrip`'te ayrılmış yere
- NGS Teknoloji tam unvan + adres → footer
- İzinli gerçek müşteri referansları
- Eski `*-1600/800.webp` dosyalarının temizliği
