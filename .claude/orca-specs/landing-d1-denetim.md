# Landing D1 — Bağımsız denetim (salt okuma)

ÖNCE `.claude/orca-specs/landing-ortak.md` dosyasını oku: YASAK + kapılar aynen geçerli. Bu görev SALT OKUMA:
`src/`, `public/`, `scripts/`, `docs/` altında HİÇBİR dosyaya yazma. Yazabileceğin tek yer `/tmp/landing-d1/**`.
Rapor yolu: `/tmp/landing-d1/RAPOR.md`.

## Bağlam
Landing (`/`) üç Codex worker'ı tarafından yenilendi: W1 tipografi (`/tmp/landing-w1/RAPOR.md`), W2 görseller (`/tmp/landing-w2/RAPOR.md`),
W3 hero canlı akış + bölümler (`/tmp/landing-w3/RAPOR.md`). Plan: `docs/ui-scan/public/LANDING_PLAN_2026-10-23.md`.
Raporlara GÜVENME: diff'i oku, kapıları kendin koş, sayfayı kendin çek. Dev sunucu: `http://localhost:8081/`.

İncelenecek diff:
`git diff -- src/components/landing src/components/public src/pages/LandingPage.tsx index.html` +
yeni dosyalar `git status --short src/components/landing src/components/public public/marketing public/fonts scripts`.
Not: `ProductShot.tsx`, `AuthShell.tsx` (görsel tıklama kaldırma), e-posta adresi değişikliği ve `marketingFacts.ts` metinleri bu işten
önce koordinatörün yaptığı onaylı değişikliklerdir; yine de hata görürsen yaz.

## Kontrol listesi
1. Doğruluk: React hook kuralları, zamanlayıcı/IntersectionObserver/visibilitychange temizliği, SSR güvenliği, StrictMode'da çift
   zamanlayıcı, `key` kararlılığı, tip güvenliği (`any`/`!` yok), ölü CSS/ölü kod.
2. Erişilebilirlik (WCAG 2.2 AA): canlı kartta 2.2.2 (durdurulabilir hareket), `aria-hidden` + erişilebilir ad, klavye sırası ve odak
   görünürlüğü, kontrast (bant zemini, durum çipleri, bordo üstü metin), alt metinler, başlık hiyerarşisi (h1 tek, h2/h3 sırası),
   dokunma alanı ≥44 px, reduced-motion.
3. Performans: CLS (ilk 3 sn) < 0,05, LCP görselinin doğru `fetchpriority`/eager olması, lazy görseller, `srcset`/`sizes` doğruluğu
   (390'da `-m-` kaynağı, 1440'ta 2400w yalnız 2x'te), font yalnız public sayfada yükleniyor mu (`/login` dışındaki uygulama sayfalarında
   Overpass isteği olmamalı — oturum gerektirdiği için en azından `/` ve `/login` ağ isteklerini karşılaştır).
4. Görsel: 1440, 1024, 768, 390 tam sayfa ekran görüntüsü al ve İNCELE: taşma, üst üste binme, yetim satır, hizasız çizgi, boşluk ritmi,
   kırpımların netliği. Planın "Sayfa yapısı" wireframe'iyle farkları listele.
5. Metin: ekranda görünen metin `marketingFacts.ts` ile aynı mı; `marketingFacts.test.ts`'teki yasaklı ifadeler yok mu.
6. Kapılar: ortak dosyadaki üç kapı + tam `node_modules/.bin/vitest run` (convex/ altındaki başka oturum kırmızılarını ayrıca not et).

## Çıktı (RAPOR.md)
Üç başlık: **ENGEL** (yayın öncesi şart) · **DÜZELT** (yapılmalı, engel değil) · **NOT**. Her madde: file:line, kanıt (ekran görüntüsü
yolu / ölçüm / komut çıktısı), önerilen düzeltme tek cümle. En üstte 2 cümle genel karar. `worker_done`'da ≤10 satır.

## Koordinatörün kendi gözlemleri (doğrula, rapora dahil et; başkalarını da ara)
- Footer alt satırında sol "© 2026 NGS Plus" ile sağdaki e-posta/telefon satırı dikeyde hizasız görünüyor (1440).
- Son CTA bandının hemen üstünde, SSS bölümünün alt çizgisi gereksiz duruyor (Güvenlik bandında bu çizgi kaldırılmıştı).
- İkili özellik satırında (PDKS | Geçiş Kontrol) üst çizgiler iki parça; ortada boşluk var — kasıtlı mı, ritmi bozuyor mu değerlendir.
- `planDescription`'daki tekrar eden "ücretli plan satın almaz" cümlesi koordinatör tarafından kaldırıldı (bilinçli).
