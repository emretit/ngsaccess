# Landing W2 — Okunur ürün görselleri (kırpımlar)

ÖNCE `.claude/orca-specs/landing-ortak.md` dosyasını oku: YASAK + repo kuralları + kapılar + rapor biçimi aynen geçerli.
Rapor yolu: `/tmp/landing-w2/RAPOR.md` · kontrol görselleri: `/tmp/landing-w2/`.

## Hedef (test edilebilir)
Tek komutla (`node scripts/marketing-shots.cjs`) yeniden üretilebilen, örnek veri içeren, okunur ürün kırpımları:
hedef gösterim genişliğinde mockup'taki UI yazısı ekranda ≥10,5 CSS px görünür (şu an ~5 px).

## Bağlam
- Mevcut görseller `/tmp/pub-p1/assets.cjs` ile üretildi: `docs/ui-scan/pages/<dir>/mockup.html` dosyaları 1440×900'de çekilip
  1600/800 WebP'ye küçültüldü (`.preview,.preview-note,.mock-state-buttons` gizlenerek). O betiği temel al.
- Mockup'lar ÖRNEK veri içerir (gerçek müşteri verisi yok) — kaynak yalnız bunlar. Canlı uygulamadan/DB'den görüntü ALMA.
- Gösterim genişlikleri (W3b bağlayacak): tam genişlik = 1200 CSS px · ikili sütun = ~585 CSS px · mobil = ~350 CSS px.
  Kural: kırpılan bölgenin CSS genişliği ≈ gösterim genişliği / 0,9'u geçmesin (mockup yazısı ~12 px → ekranda ≥10,5 px).

## Üretilecek dosyalar (`public/marketing/`, `deviceScaleFactor: 2`, WebP ~q78, sharp effort 6)
| Dosya (genişlik px) | Mockup | Kırpım içeriği |
|---------------------|--------|----------------|
| `ana-sayfa-2400.webp` | 01-ana-sayfa | mevcut `ana-sayfa-1600` ile AYNI kare (1440×900), yalnız 2400w |
| `crop-canli-{1200,2400}.webp` | 07-canli-izleme | akış tablosu: başlık satırı + ilk 6 satır; "Reddedildi" satırlarının neden metni ("Kart tanımlı değil", "Yetki yok" vb.) okunur |
| `crop-pdks-{600,1200}.webp` | 08-pdks-kayitlari | Günlük/Haftalık/Aylık sekmeleri + "Dışa aktar" düğmesi + tablonun ilk 5-6 satırı |
| `crop-gecis-{600,1200}.webp` | 05-gecis-kontrol | kural tablosu (Kural, Tür, Kim, Nereye, Ne zaman, Durum) |
| `crop-vardiya-{1200,2400}.webp` | 09-vardiyalar | haftalık takvim: gece vardiyası "(+1)" hücreleri ve "Yıllık izin" hücresi görünür; geniş-kısa şerit (en/boy ≈ 2,5–3,5) |
| `ana-sayfa-m-{700,1400}.webp` | 01-ana-sayfa | mobil: üst özet kartları (Toplam personel…) + "Son kart okutmaları" ilk 3 satırı, ~380 CSS px genişlik |
| `crop-canli-m-{700,1400}.webp` | 07 | mobil: Saat + Kişi + Sonuç sütunları, 4-5 satır |
| `crop-pdks-m-{700,1400}.webp` | 08 | mobil: Çalışan + İlk giriş + Son çıkış + Durum |
| `crop-gecis-m-{700,1400}.webp` | 05 | mobil: Kural + Kim + Durum |
| `crop-vardiya-m-{700,1400}.webp` | 09 | mobil: Çalışan + 3 gün |
Kırpım bölgesini sabit piksel yerine mümkünse DOM öğesinin `boundingBox()`'ından türet (mockup değişirse betik kırılmasın);
gerekirse geçici CSS (sütun gizleme, `max-width`) enjekte et — mockup HTML dosyalarını DEĞİŞTİRME.
Kırpımın kenarı yazıyı yarıda kesmesin; tablo kenarında 1 px çerçeve/temiz kenar kalsın.

## Bütçe
2400w dosya ≤120 KB · 1200w/1400w ≤70 KB · 600w/700w ≤35 KB. Aşılırsa kaliteyi düşür, raporda belirt.

## Betik: `scripts/marketing-shots.cjs`
- Playwright: `process.env.PLAYWRIGHT_PATH || '/Users/emreaydin/pafta/node_modules/playwright'`; sharp: `process.env.SHARP_PATH || '/Users/emreaydin/pafta/node_modules/sharp'`.
- Çıktı: dosyalar + stdout'a ve `/tmp/landing-w2/assets.json`'a `{ name, width, height, bytes }` listesi.
- Dosya başında 3-4 satır yorum: ne üretir, nasıl çalıştırılır.
- Eski `*-1600.webp`/`*-800.webp` dosyalarını SİLME, üzerine yazma (W3b sonrası koordinatör temizler) — `ana-sayfa-1600/800` dahil.

## Mockup güncelliği
Kırpımdan önce her mockup'ın ilgili bölümünü güncel arayüzle kıyasla (kaynak: `src/pages/LiveMonitoring.tsx`, `src/pages/PDKSRecords.tsx`, `src/pages/AccessControl.tsx`, `src/pages/Shifts.tsx`
ve bileşenleri — yalnız OKU). Belirgin fark (kaldırılmış sekme, değişmiş başlık) varsa raporla; mockup'ı değiştirme, uydurma.

## Ownership (yalnız bunlara yaz)
`scripts/marketing-shots.cjs` (yeni) · `public/marketing/` altında YALNIZ yukarıdaki yeni dosyalar · `/tmp/landing-w2/**`

## Kapsam dışı
`src/**` (bağlama W3b'de), `public.css` (W1 paralel çalışıyor), `docs/ui-scan/pages/**` mockup dosyaları.

## Kabul
- `node scripts/marketing-shots.cjs` hatasız biter, 21 dosya üretir; `assets.json`'da hepsi bütçe içinde.
- `/tmp/landing-w2/contact.png`: tüm kırpımların gösterim boyutunda (1200 / 585 / 350 px) yan yana kontak sayfası — koordinatör buna bakacak.
- Rapor: her dosya için kırpım bölgesi (hangi DOM öğesi), en/boy oranı, byte; mockup güncellik notları.
