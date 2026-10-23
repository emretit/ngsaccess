# Landing audit — 2026-10-23

**Özet:** Sayfa temiz ve erişilebilir, ama kalıp bir SaaS şablonu gibi duruyor. Şıklığı en çok üç şey düşürüyor:
ürün görselleri okunmayacak kadar küçük, başlıklar sistem fontuyla sıradan duruyor, metinler genel ve tekrar ediyor.
En büyük kazanç: görselleri okunur kırpımlara çevirmek, başlık fontu seçmek, hero'ya canlı geçiş akışı koymak.

Kaynak skill'ler: `frontend-design` (yerel + Pafta), `accessibility` (Pafta, WCAG 2.2), `remove-ai-slop`.
Bakılan: `src/pages/LandingPage.tsx`, `src/components/landing/*`, `src/components/public/*`, `public.css`;
yerel dev (localhost:8081) 1440 ve 390 px ekran görüntüleri → `landing-audit-2026-10-23/`.

## Checklist

### Önce (en çok fark yaratan)
- [ ] L1 Ürün görsellerini okunur kırpımlara çevir (masaüstü + mobil) — ~2 sa
- [ ] L2 Başlık fontu seç ve `--public-display`'e bağla — ~45 dk (K5 kararını yeniden açar)
- [ ] L3 Hero'ya canlı geçiş akışı bileşeni (HTML, görsel değil) — ~3-4 sa
- [ ] L4 Metinleri sadeleştir (tekrarlar, uyarı metni, başlıklar) — ~45 dk + onay

### Sonra (cila)
- [ ] L5 Başlık hiyerarşisi + çizgi genişlikleri + tek açık ton bant — ~1,5 sa
- [ ] L6 Özellikler bölümünde ritmi kır (4 aynı zigzag satır yerine 3 farklı düzen) — ~1,5 sa
- [ ] L7 Donanım şeridi: model adları + gerçek cihaz fotoğrafı — ~45 dk (fotoğraf Emre'den)
- [ ] L8 Güven: NGS Teknoloji künyesi + somut güvenlik bilgisi — ~30 dk
- [ ] L9 Hero görseli için 2400w kaynak (retina netliği) — ~15 dk

## Ne iyi (dokunma)

- Tek vurgu rengi (bordo), gradient/glow/blur süsleri yok, kart yığını yok.
- Kontrast geçiyor: bordo zemin üstü açık metin 7,85:1, gri gövde metni 5,79:1, ana metin 14,97:1 (AA ≥4,5:1).
- Atlama bağlantısı, görünür klavye odağı, 44 px dokunma alanı, `prefers-reduced-motion` var.
- Görseller WebP + `srcset`, hero `fetchPriority=high`, diğerleri lazy. Toplam görsel ~270 KB.
- 1-2-3 kurulum adımları gerçek bir sıra; numaralandırma yerinde.

## Bulgular

### L1 — Ürün görselleri okunmuyor (en büyük sorun)
1600 px genişliğindeki tam uygulama ekranı masaüstünde 650 px'e, mobilde ~350 px'e küçülüyor → ekrandaki yazılar
~5 px. Ziyaretçi ürünün ne gösterdiğini okuyamıyor; artık tıklayıp büyütme de yok.
→ Her özellik için tam ekran yerine **kırpım** (ilgili bölge, ~%80-100 ölçekte, 2x DPR): Canlı İzleme'de 4-5 satır
akış + "Reddedildi" nedeni, PDKS'te tablo + Excel/PDF düğmesi, Geçiş Kontrol'de kural satırları, Vardiya'da
haftalık takvim şeridi. Mobilde ayrı, daha dar kırpım. Kaynak: demo projeden Playwright `clip` ile yeniden çekim.
Alt metinler kırpımın gösterdiğini anlatsın ("Canlı İzleme: reddedilen geçiş ve nedeni"), şu anki genel
"örnek proje ekranı" yerine.

### L2 — Tipografi kişiliksiz
Her şey sistem fontu (`-apple-system`/Segoe UI/Roboto). Mac'te düzgün, Windows/Android'de sıradan.
`--public-display` değişkeni CSS'te zaten hazır ama tanımsız. 2026-10-19'da K5 kararıyla sistem fontunda
kalındı (öneri Plus Jakarta Sans'tı; o da çok kullanılan bir SaaS fontu).
→ Öneri: başlıklarda **Overpass 700** (yol/yönlendirme tabelası fontu Highway Gothic'ten türemiş; "kapı, giriş,
geçiş" konusuna bağlanıyor). Gövde, menü, form sistem fontunda kalır. Kendi sunucumuzdan woff2, latin + latin-ext
(Türkçe İ ı ş ğ), `font-display: swap`, ~30-45 KB, preload. Alternatif: Bricolage Grotesque (daha karakterli,
daha az ciddi).

### L3 — Hero durağan; ürünün "an"ı yok
Hero = başlık + ana sayfa ekran görüntüsü. Ürünün en karakteristik anı (kart okutuldu → ekrana düştü) görünmüyor.
→ Hero'ya gerçek HTML ile çizilmiş küçük **Canlı İzleme kartı**: ~3 sn'de bir üste yeni satır kayar
(saat, kişi, kapı, İzin verildi/Reddedildi). Sayfadaki **tek** otomatik hareket bu olur.
Zorunlu: "Durdur" düğmesi (WCAG 2.2.2: 5 sn'den uzun süren hareket durdurulabilmeli), reduced-motion'da sabit liste,
`aria-hidden` + tek cümlelik metin karşılığı (ekran okuyucu her satırı okumasın). Örnek veri; gerçek kişi adı yok.

### L4 — Metinler genel ve tekrar ediyor (`marketingFacts.ts`)
- "Hepsi bir arada" fikri 7 kez: "tek yerden" (hero başlık), "aynı yerde", "Aynı çalışma alanı", "aynı yönetim
  alanında", "aynı projede", "tek akışta", "bir arada".
- Hero başlığı "İşyerindeki hareketi tek yerden yönetin." İK, kamera, IoT ürünü için de yazılabilir; somut değil.
- "Bu işlem bir kullanıcı hesabı oluşturur. Satış talebi göndermez…" uyarısı 3 yerde (hero, SSS, son CTA),
  `planDescription`'da bir kez daha. Savunmacı ve hukuki duruyor.
- "NGS Plus ürün ekranı · Örnek proje ve kayıtlar" alt yazısı 5 kez aynı.
- Kesik iki cümleli başlık kalıbı: "Günün tamamı. Aynı çalışma alanı." / "Erişimi tanımlayın. İşlemleri izleyin."
- Güvenlik maddeleri kendini tekrar ediyor: "Denetim kaydı — Yönetim işlemlerinin kayıtlarını inceleyin."

Öneriler (gerçekliği Emre doğrulasın):
| Yer | Şimdi | Öneri |
|-----|-------|-------|
| Hero başlık | İşyerindeki hareketi tek yerden yönetin. | Kapıda okutulan her kart, Canlı İzleme'de. |
| Hero uyarı | (2 cümle) | Hesap oluşturmak ücretli plan satın almaz. *(yalnız burada)* |
| Son CTA alt metin | aynı uyarı | kaldır |
| Görsel alt yazısı | 5× aynı | her kırpıma özgü tek bilgi cümlesi ya da hiç |
| Özellikler başlığı | Günün tamamı. Aynı çalışma alanı. | Kapıdan puantaja, günün bütün kaydı. |
| Güvenlik maddesi | Denetim kaydı: …kayıtlarını inceleyin. | Kim, neyi, ne zaman değiştirdi: Denetim Kaydı'nda. |

### L5 — Görsel hiyerarşi ve ritim
- Özellik başlığı (h3, 36 px) bölüm başlığıyla (h2, 40 px) neredeyse aynı boyda → hiyerarşi düz. Öneri ölçek:
  h1 72 / h2 52 / h3 28 / gövde 17 px.
- Bölüm çizgileri (`.pub-section` border) iç boşluğu da kapsıyor: içerikten 32 px taşıyor, özellik satırı çizgileri
  taşmıyor → iki farklı çizgi genişliği yan yana.
- Hero'dan sonra 6.000 px boyunca hep aynı kırık beyaz + ince çizgi. Tek bir açık ton bant (Güvenlik bölümü,
  `#F6ECEA` zemin) sayfayı böler.
- SSS'de sol sütun 700 px boş; başlığı `position: sticky` yapmak boşluğu anlamlı kılar.

### L6 — Özellikler bölümü tekdüze
4 özellik aynı kalıpta (etiket, başlık, 3 madde, görsel; sağ-sol değişerek), toplam 2.545 px.
→ Canlı İzleme tam genişlik büyük kırpım; PDKS + Geçiş Kontrol iki sütun yan yana; Vardiya ve İzin tam genişlik
takvim şeridi. "İzinler ekranını incele" ham görsel bağlantısı kalkar (izin kırpımı vardiya şeridine girer).

### L7 — Donanım şeridi zayıf
"Hikvision  IDE Smart" düz yazı + "Model ve bağlantı uygunluğunu birlikte değerlendirelim." Ürünün fiziksel
dünyası (kapı, terminal, kart) sayfada hiç yok.
→ Test edilen model adları (ör. Hikvision DS-K1T804, DS-K1T807; IDE Smart panel; liste doğrulanmalı) + gerçek
cihazın kendi çekeceğimiz fotoğrafı (ofisteki NGS0002 terminali). Marka logosu kullanmadan, yalnız model adı.

### L8 — Güven sinyali yok
Footer "© 2026 NGS Plus"; şirket adı, adres, kuruluş yok. E-posta artık ngsteknoloji.com.
→ Footer'a "NGS Teknoloji" künyesi (unvan, şehir). Güvenlik bölümünde somut bilgi: "5 rol, 13 yetki, proje bazında"
(canlıdaki sabit roller), KVKK: puantajda biyometrik veri kullanılmaz (2026/921) — ikisi de doğrulanıp yazılmalı.
Gerçek müşteri referansı varsa ve izin alınırsa eklenir; uydurma referans/sayı yok.

### L9 — Hero görseli retina'da yumuşak
Hero görseli 1200 CSS px'te 1600w kaynakla gösteriliyor → 2x ekranda ~1,33x büyütülüyor. 2400w (WebP/AVIF) ekle.

## Önerilen tasarım yönü (frontend-design planı)

**Renk** (A2'den, değişmez):
| Ad | Hex | Rol |
|----|-----|-----|
| Bordo sahne | `#551919` | hero + son CTA zemini |
| Bordo vurgu | `#7A1F1F` | birincil düğme, bağlantı, modül adı |
| Kırık beyaz | `#FCFCFC` | sayfa zemini |
| Mürekkep | `#252523` | metin |
| Kemik pembe | `#F6ECEA` | sahne üstü metin + tek açık bant zemini |
| Sinyal | ürünün İzin verildi yeşili / Reddedildi kırmızısı | yalnız canlı akış verisinde |

**Tip:** Başlık Overpass 700, sıkı aralık (-0.02em); gövde sistem fontu 17 px / 1.6. Ölçek 72 / 52 / 28 / 17.

**Düzen:**
```
┌──────────────────────── bordo sahne ─────────────────────────┐
│ Logo                  Özellikler  Kurulum  Güvenlik  [Hesap] │
│                                                               │
│ Kapıda okutulan her       ┌─ Canlı İzleme (HTML) ──────────┐  │
│ kart, Canlı İzleme'de.    │ 09:12 Deniz A.  Otopark   ✕   │← yeni satır
│                           │ 09:06 Burak Y.  Ana Giriş ✓   │  │
│ [Hesap oluştur] [İncele]  │ 08:59 Selin K.  Ana Giriş ✓   │  │
│ Hesap oluşturmak ücretli… │ [Durdur]                      │  │
│                           └───────────────────────────────┘  │
├───────────── ana sayfa ekranı (bindirmeli, 2400w) ────────────┤
│ Test edilen cihazlar: DS-K1T804 · DS-K1T807 · IDE Smart  [foto]│
├───────────────────────────────────────────────────────────────┤
│ Canlı İzleme ─ tam genişlik okunur kırpım                    │
│ PDKS Kayıtları │ Geçiş Kontrol ─ iki sütun kırpım            │
│ Vardiya ve İzin ─ tam genişlik takvim şeridi                 │
├──────── Güvenlik (kemik pembe bant) ─────────────────────────┤
│ Kurulum 1-2-3 · İletişim · SSS (sticky başlık) · Son CTA     │
└───────────────────────────────────────────────────────────────┘
```
Hizalama: metin sola; hero iki sütun, metin ve canlı kart alt çizgide hizalı.

**İlkeler:**
1. Ürün kendini göstersin: küçültülmüş tam ekran değil, okunur kırpım.
2. Tek hareket: hero'daki canlı akış. Bölüm girişlerinde fade-in, kartlarda hover büyütme yok.
3. Somut ol: model adı, rol sayısı, gerçek yetenek. "Tek yerden / aynı yerde" yok.
4. Bordo yalnız başta ve sonda; ortada tek açık bant.

**Jenerik mi kontrolü:** Şu anki iskelet (koyu hero + bindirmeli ekran + zigzag özellikler + SSS + CTA bandı)
her SaaS sayfasında var. Bu planda ayırt eden üç şey konuya bağlı: canlı kapı akışı, tabela kökenli başlık fontu,
gerçek cihaz/model şeridi. Rakam bandı, ikon kartları, gradient ve "hepsi bir arada" söylemi bilinçli olarak yok.

## Emre'nin karar vermesi gerekenler
1. Başlık fontu: Overpass mı, sistem fontunda kalmak mı (K5'i yeniden açar)?
2. Hero başlık iddiası: "Kapıda okutulan her kart, Canlı İzleme'de." doğru ve kabul mü?
3. Cihaz fotoğrafı çekilebilir mi; test edilen model listesi hangisi?
4. Footer künyesi: NGS Teknoloji unvanı ve adresi.
