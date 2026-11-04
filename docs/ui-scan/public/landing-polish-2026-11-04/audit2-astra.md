# Landing ikinci audit — Astra — 2026-11-04

**Kapsam:** `main f72382bf`, `http://localhost:8081/`, Chromium; kaynaklara müdahale edilmedi. Başlık metni son Emre kararı olarak korundu; alternatif başlık önerilmiyor.
**Sonuç:** 1 MUST, 3 SHOULD, 1 NIT. Bulguların bir kısmı önceden mevcut; hepsi yeni commitlerin sebep olduğu gerileme değildir.
**Kanıt kökü:** `/tmp/landing-polish/audit2-astra/`; aşağıdaki kısa dosya adlarının tamamı bu dizindedir. Başka modelin bu tur raporu okunmadı.

## MUST — yayın engeli

**M1 — Ürün görseli yasaklanan biyometrik kaynak ifadesini yayımlıyor.**
- Yer: `src/components/landing/FeaturesSection.tsx:16`, `src/components/landing/marketingFacts.test.ts:7`; görseli üreten örnek satır `docs/ui-scan/pages/07-canli-izleme/mockup.html:82`.
- Kanıt: `1440-live-shot.png` içinde Elif Şahin satırının kaynak hücresinde “Biyometrik · PDKS dışı” okunuyor. Bu, biyometrinin PDKS için kullanıldığını söylemiyor; yine de pazarlama kapsamındaki açık biyometri yasağını görsel üzerinden aşıyor. Test yalnız kaynak metinlerini tarıyor (`marketingFacts.test.ts:13`), WebP piksellerini taramıyor; 7/7 test geçmesi bunu yakalayamıyor.
- Düzeltme: landing'e özel kırpımı bu kaynak hücresini göstermeyecek biçimde yeniden üret veya doğrulanmış kart senaryosu içeren pazarlama örneği kullan; uygulamanın gerçek kayıt anlamını değiştirme. Masaüstü görsel adaylarını birlikte kontrol et; görsel içerik kontrolünü yayın kontrolüne ekle. **Efor: 30–60 dk.**

## SHOULD — düzeltme önerilir

**S1 — 320 px iletişim kartı kapsayıcıdan taşıyor.**
- Yer: `src/components/public/public.css:463`, `src/components/public/public.css:479`, `src/components/public/public.css:847`, `src/components/public/public.css:853`.
- Kanıt: `followup.json` → `width320`: viewport 320, document scrollWidth **321**, iletişim kartı x=20 / genişlik=301 / sağ kenar=321. `320-iletisim.png`: hedeflenen 20 px sağ boşluk kayboluyor; görünür metin kaybı saptamadım. 390–1440 kontrollerinde yatay taşma yok.
- Düzeltme: dar ekranda grid sütununu `minmax(0,1fr)` yap, metin taşıyıcısına `min-width:0`, uzun e-posta için uygun kırılma ekle; 44 px ikon alanını koru. [320 CSS px reflow kontrolünü](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) yeniden çalıştır. **Efor: 20–30 dk.**

**S2 — Tablet kırpımı çözümü 1100 px'e yaklaşırken gereğinden büyük ürün panelleri oluşturuyor.**
- Yer: `src/components/landing/FeaturesSection.tsx:37`, `src/components/landing/FeaturesSection.tsx:52`, `src/components/public/public.css:699`.
- Kanıt: `final-checks-result.txt`: 1100 px'te PDKS resmi **1034×1157**, geçiş resmi **1034×806**; 1101 px'te sırasıyla 502×430 ve 502×326. Toplam sayfa yüksekliği 8755 → 6800 px; `1100-pdks.png` ve `768-ozellikler.png` görsel ağırlığı gösteriyor. Bu, font kaynaklı CLS değildir; breakpoint/ürün sunumu tercihidir.
- Düzeltme: tablet portre görsellerine ölçülü azami genişlik koyup ortala veya tablet için daha az boşluk/satır içeren kırpım üret; mobil kaynağı erken masaüstü kaynağına çevirerek eski okunurluk sorununu geri getirme. Önceki önerdiğim okunurluk düzeltmesini koruyup ölçeklemeyi sınırlandırıyorum. **Efor: 45–90 dk.**

**S3 — Mobil menünün kapatma düğmesinde izin verilen hareket kapsamı dışında geçiş kalmış.**
- Yer: `src/components/ui/sheet.tsx:101`, `src/components/public/PublicHeader.tsx:63`.
- Kanıt: `followup.json` → `closeStyle`, `closeAnims`: `opacity 0.15s`, 0.7 → 1 ve gerçek `CSSTransition: opacity`. Overlay/menü girişinde animasyon yok; bu yalnız kullanıcı hover'ında tetikleniyor, otomatik hareket veya WCAG ihlali olarak sunulmamalı. Karar ise ek geçişi yalnız 140 ms renk/zeminle sınırlıyor.
- Düzeltme: sadece public menü kapatma düğmesinde opaklığı sabitle ve `transition-none` uygula; ortak Sheet davranışını bütün uygulama için değiştirme. **Efor: 10–15 dk.**

## NIT — bakım tutarlılığı

**N1 — Karar belgesinin güncel görünen başlık kararı artık yanlış.**
- Yer: `docs/ui-scan/public/landing-polish-2026-11-04/SENTEZ.md:12`, `docs/ui-scan/public/landing-polish-2026-11-04/SENTEZ.md:23`.
- Kanıt: bu satırlar hâlâ hibrit kararı tamamlandı olarak gösteriyor; `final-checks-result.txt` tek h1'in geri alınmış kategori başlığı olduğunu doğruluyor. Sonraki çalışmada istenmeyen başlık yeniden uygulanabilir.
- Düzeltme: belgeye f72382bf ve Emre'nin geri dönüş kararını işle; eski tartışmayı tarihsel olarak işaretle, mevcut başlığı değiştirme. **Efor: 5 dk.**

## Geçen kontroller ve sınırlar

- **Görsel kapsam:** 320 / 390 / 768 / 1024 / 1100 / 1440 px hero ve tam sayfa görüntüleri `{genişlik}-hero.png`, `{genişlik}-full.png`; ek breakpoint ölçümleri 1023 ve 1101 px. `visuals.json` ölçümleri; `final-checks-result.txt` kaynak değişimi tamamlanmış sınır ölçümleridir (`followup.json` içindeki erken `boundary` okumaları esas alınmadı).
- **Header/hero:** h1 ile iki cümlelik alt metin ve canlı kartın hiyerarşisi çalışıyor; başlık 320'de 4, 390'da 3, 768'de 2, 1024'te 3, 1100'de 2, 1440'ta 3 satır. 320'de ikinci CTA iki satır olsa da içerik kesilmiyor; yeniden başlık yazımı gerekmiyor.
- **Font:** `src/components/public/public.css:23` 96.1% fallback; altı genişlikte WOFF2 isteğini geciktirerek font öncesi/sonrası ölçtüm (`checks.json` → font deneyi). H1 yüksekliği/konumu aynı; ölçülen CLS **0**. Bu sonuç aynı Chromium/font ortamı içindir, bütün platformlar için garanti değildir.
- **LiveFeedDemo:** örnek veri ve kontrol üstte, dört satır 320/390'da okunuyor; durağan canlı noktası ve onaylanan gölge dengeli. `checks.json`: Durdur sonrası `aria-pressed=true`, 3.2 sn satırlar sabit; Sürdür sonrası false ve satırlar değişiyor. Reduced-motion'da kontrol görünmüyor, satırlar sabit, etkin animasyon yok, CTA geçişi 0 ms.
- **Klavye:** skip link Enter ile `main#main` odağına gidiyor; desktop sırada logo/nav/auth/hero/akış kontrolü var. Mobil menü odağı Kapat'a alıyor, Tab menü içinde dönüyor; Escape sonrası Menü'ye dönüyor (`followup.json`, `390-menu-return-focus.png`). `checks.json` ilk anlık kapanış okuması React güncellemesinden önce alınmış; nihai değerlendirme beklemeli followup ölçümüdür.
- **FAQ/odak/başlık:** Enter FAQ'yi açıp kapatıyor, +/− değişimi animasyonsuz; `390-faq-keyboard.png`. Örneklenen klavye hedeflerinde 2 px görünür outline / 3 px offset var. Tek h1 ve h2→h3 sırası mantıklı (`final-checks-result.txt`); bu tur ekran okuyucu ile uçtan uca test yapılmadı.
- **Kontrast:** `checks.json` hesaplanan renk/zemin oranlarında 13 px örnek etiketi 5.94:1, 13 px caption/footer 5.79:1, 13 px güvenlik notu 5.12:1, 14 px donanım bağlantısı 14.97:1, final bağlantısı 11.76:1; örneklenen küçük metinler [4.5:1 eşiğini](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) geçiyor. Tüm piksel/etkileşim durumlarının WCAG sertifikasyonu değildir.
- **Donanım/kurulum/güvenlik:** renkli, kutusuz logo şeridi ve iletişim bağlantısı daha derli toplu; üç adım ve güvenlik sütunlarında yeni kesilme yok. Gölge ürün panelleriyle canlı kartta tutarlı; hareketsiz kartlara yanıltıcı hover hareketi gözlemlenmedi.
- **İletişim/final/footer:** tekrar azaltımı ve finalde ana hesap CTA'sı + ikincil e-posta bağlantısı yerinde; final ve footer'ın 390/768/1440 düzenleri okunuyor. 320 iletişim istisnası S1; footer'da yeni görsel hata bulunmadı.
- **Metin:** marketingFacts ve LiveFeed testleri **2 dosya / 7 test geçti** (`tests.txt`); görünür metinlerde yeni yazım veya yasak iddia bulmadım, görseldeki M1 istisnadır. Sayısal ürün yetkilerini bu tur backend'e karşı yeniden doğrulamadım.
- **Ortak CSS:** `/login`, `/register`, `/verify-email` ve bilinmeyen rota/404 için 390 ve 1440 ekran görüntüleri alındı (`{genişlik}-login.png`, `-register.png`, `-verify-email.png`, `-audit2-not-found.png`). Tek h1, yatay taşma yok, açık tema ve form/status görünümü korunuyor; form gönderimi yapılmadı, tüm hata durumları taranmadı.
- **Performans:** bu tur güncel production Lighthouse ölçümü yapılmadı; dev ekran ölçümünden performans puanı çıkarılamaz. `SENTEZ.md:26` önceki 62c63ea5 için 88 bildiriyor; bu, başlangıçtaki ≥89 şartının karşılandığı kanıtı değildir. Yayın öncesi f72382bf üretim build'inde aynı koşullarla yeniden ölçüm gerekir.

**Yayına hazır mı:** Hayır; M1 giderilmeden ve güncel üretim build'inde ≥89 mobil performans koşulu doğrulanmadan yayına hazır onayı vermiyorum.
