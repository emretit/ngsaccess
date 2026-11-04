# Landing polish — sentez (Fable + Codex Astra), 2026-11-04

## Checklist

### Faz 0 — danışma (BİTTİ)
- [x] Fable bağımsız rapor — `fable.md`
- [x] Astra bağımsız rapor — `astra.md`
- [x] Çapraz eleştiri — `fable-critique.md`, `astra-critique.md`
- [x] Koordinatör sentezi (bu dosya)

### Faz 1 — Emre kararları (BİTTİ 2026-11-04)
- [x] K-A Hero h1 → ~~Hibrit ("Kapıdaki her geçiş, Canlı İzleme'de.")~~ **GERİ ALINDI (f72382bf): Emre istemedi; h1 = "Bulut PDKS ve Geçiş Kontrol Sistemi". Yeni başlık önerme.**
- [x] K-B Hover → **140 ms yalnız renk/zemin**, transform yok, reduced-motion 0 ms
- [x] K-C Gölge → **ekle** (ProductShot + canlı kart, tek rest token), önce/sonra ekran görüntüsüyle Emre bakar
- [x] K-D Model adları → **HAYIR**, yalnız logolar

### Faz 2 — uygulama (BİTTİ 2026-11-04 16:40, commit yok)
- [x] U1 Tablet kırpım fix (601-1023 px)
- [x] U2 LiveFeedDemo: "Örnek veri" + Durdur üste, 11 px → 12-13 px
- [x] U3 Hareketi gerçekten tek yap: Sheet overlay fade kapat, FAQ statik +/−
- [x] U4 Donanım şeridi: kutusuz, renkli, optik eşit, `/#iletisim` bağlantısı
- [x] U5 Küçük metinler 13-14 px + iletişimde 3 tekrar → 1
- [x] U6 Lead 2 cümle (h1 hibrit kısmı f72382bf ile geri alındı)
- [x] U7 Final CTA: "NGS Plus hesabınızı oluşturun." + ikincil "Bize yazın"
- [x] Kapılar: tsc 0, eslint 0, tam vitest 5571/5571 (koordinatör koştu), görsel tur + denetim MUST 0 (`fable-audit.md`), SHOULD/NIT düzeltildi
- [x] Lighthouse mobil (aynı makine, 3 koşu): eski canlı 82cf883c perf 85-87 / CLS 0 → yeni 62c63ea5 perf 88 / CLS 0 / a11y 100 (font-swap CLS 0.036 bulundu, 62c63ea5 ile düzeltildi)
- [x] Commit 2ee2babe + 62c63ea5 (Emre "devam edelim")
- [ ] Push + Netlify yayını (ayrı onay; export /tmp/ngs-pub-62c63ea5/dist hazır)

## İkisinin de kabul ettiği (karar gerekmez)

| # | İş | Kanıt |
|---|----|-------|
| U1 | 601-1023 px'te Canlı İzleme/Vardiya kırpımı ~6 px yazı → mobil kaynak/breakpoint düzelt, çift sütunu da 768'de kontrol et | `FeaturesSection.tsx:22,67` (`max-width: 600px`) — koordinatör doğruladı |
| U2 | "Örnek veri" + Durdur kartın üstüne (DOM sırası da), mobil 4 satır kalır, chip/red nedeni 11 → 12-13 px | `LiveFeedDemo.tsx:85,109`, `public.css:930,935` |
| U3 | Mobil menü overlay'i fade ediyor → "tek animasyon" kuralı bugün delik; public'e özel `overlayClassName`. FAQ 45° dönüş → statik +/− | `ui/sheet.tsx:22`, `PublicHeader.tsx:62`, `public.css:561-564` |
| U4 | Donanım şeridi kutuları kalkar, logolar renkli kalır, optik yükseklik eşitlenir, uygunluk cümlesi `/#iletisim` bağlantısı | `HardwareStrip.tsx`, `public.css:267-308` |
| U5 | Satın alma notu / caption / footer 12 → 13-14 px; iletişimde aynı çağrı 3 kez → 1; hover'da ikon kutusu zemine karışıyor | `public.css:175,245,261,477,487,616`, `PricingSection.tsx:12,13,43` |
| U7 | Final CTA başlığı hesap açmanın ötesine atlıyor → "NGS Plus hesabınızı oluşturun." + ikincil "Bize yazın" (mailto) | `marketingFacts.ts:188`, `FinalCTASection.tsx:14` |
| — | Sticky header YOK · dark mode YOK · yeni font/kütüphane YOK · "Canlı" pulse YOK | ikisi de |

## Ayrışan noktalar ve koordinatör önerisi

| Karar | Fable | Astra | Öneri |
|-------|-------|-------|-------|
| K-A h1 | "Kapıdaki her geçiş, Canlı İzleme'de." + kategori eyebrow | "PDKS ve geçiş kontrolünü birlikte yönetin." (kategori h1'de) | **Hibrit:** h1 içinde küçük satır "Bulut PDKS ve Geçiş Kontrol" + büyük satır iddia. SEO kelimesi h1'de kalır, iddia da gelir (Fable'ın kendi yedek önerisi). |
| K-B Hover | 140 ms yalnız renk/zemin, transform yok | Anlık değişim, geçiş yok | **Fable:** renk geçişi yer değiştirme değil; reduced-motion'da 0 ms. |
| K-C Gölge | ProductShot + canlı karta tek "rest" gölge | Gölge yalnız hero görselinde | **Fable (dar kapsam)**, ama önce/sonra ekran görüntüsüyle karar. |
| K-D Model adları | Şeride sahada çalışan modeller | Yalnız doğrulanmış listeyle, P2 | Liste Emre'den: DS-K1T804 · DS-K1T807 · DS-K2804 · IDE Smart paneli? |

## Elenenler
- Hero görselini yeniden kırpma (Astra P0.3) — Fable: yazılar yine okunmaz olur; Astra P1'e indirdi → yapılmıyor.
- Çıkan satır fade (Fable) — Astra: ayrı yaşam döngüsü gerekir, ucuz değil → yapılmıyor.
- Bordo sahneye tonal gradient, Geçiş Kontrol "ada" paneli (Fable P1) — Astra itiraz etti, kazanım düşük → yapılmıyor.
- "5 rol, 13 yetki" sayısını kaldırma (Astra P1.8) — sayı canlıda doğru (ce09baf0) → kalıyor.
- Header "Hesap oluştur" düğmesini sönükleştirme (Astra P1.7) — Fable itiraz etti → yapılmıyor.

## P1 (sonraki tur)
FAQ'de ilk açık soru "Mevcut kart okuyucularımı kullanabilir miyim?" · güvenlik maddelerine çerçevesiz 20 px ikon ·
üç adıma ortak üst çizgi · footer'da telefon/aydınlatma talebini ayırma · `text-wrap: balance/pretty`.

## Audit turu 2 (2026-11-04, f72382bf)
- [x] Fable `audit2-fable.md` (MUST 0 / SHOULD 3 / NIT 7) · Astra `audit2-astra.md` (MUST 1 / SHOULD 3 / NIT 1)
- [ ] M1 Canlı İzleme görselinde "Biyometrik · PDKS dışı" etiketi (pazarlama yasağı) → canli kırpımı yeniden üret
- [ ] S1 601-1100 px mobil kaynaklı görseller dev → max-width + ortala · S2 320 px iletişim 1 px taşma · S3 320 px h1 4 satır
- [ ] S4 320 px canlı kart üst şeridi 2 satır · S5 mobil menü Kapat opacity geçişi · NIT: lead 60ch, SSS ilk soru cihaz, menü ayırıcı, footer
- [ ] Kapılar + Lighthouse (güncel üretim build'i)
