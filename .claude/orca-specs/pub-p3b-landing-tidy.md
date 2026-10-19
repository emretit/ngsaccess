# Görev: P3 takip — landing kodunu okunur hale getir (davranış/görünüm DEĞİŞMEZ)

## Hedef (test edilebilir)
Landing ve public bileşen kodu repo stilinde okunur olsun (çok satırlı JSX, satır başına bir CSS bildirimi, tekrar eden kural yok);
`/` ekran görüntüleri önceki `/tmp/pub-p3/landing-{1440,768,390}.png` ile piksel düzeyinde aynı kalsın (fark yalnız ihmal edilebilir).

## Yapılacaklar
1. `src/components/landing/public.css` → `src/components/public/public.css` taşı (public bileşenleri landing'e ters bağımlı olmasın); import'ları güncelle.
   Dosyayı satır başına bir bildirim olacak biçimde yaz, tekrar eden kural bloklarını birleştir (ör. `.pub-btn`, `.pub-btn:hover`, `.pub-btn.pub-secondary` iki kez tanımlı —
   sonraki tanım kazandığı için birleştirirken SONRAKİ değerleri koru). Kullanılmayan seçicileri `grep -rn "pub-<ad>" src` ile doğrulayıp sil.
2. Biçimlendirme: `node_modules/.bin/prettier --write --single-quote --print-width 110` YALNIZ şu dosyalara:
   `src/components/landing/*.{ts,tsx}`, `src/components/public/{PublicHeader,PublicFooter,Section,ProductShot}.tsx`, `src/components/public/PublicHeader.test.tsx`,
   `src/components/public/public.css`, `src/pages/LandingPage.tsx`, `src/components/ui/logo.tsx`.
3. `src/pages/LandingPage.tsx`: `usePageTitle('Personel ve geçiş yönetimi')` (DESIGN_PUBLIC rota tablosu; önceki spec'teki parametresiz talimat koordinatör hatasıydı).

## Ownership (YALNIZ bunlar)
Yukarıdaki dosyalar + `src/components/landing/public.css` (silme). Paralel çalışan giriş worker'ının dosyaları (`src/components/public/{AuthShell,StatusScreen}*`,
`src/pages/{Login,Register,VerifyEmail,UserSetup,AdminSetup,EmployeeSetup,CheckIn,NotFound}*`) — DOKUNMA, biçimlendirme dahil.

## YASAK
Görünüm/metin/davranış değişikliği · commit/push/deploy · `npx convex …` · canlı DB · arka planda açık sunucu.

## Kapılar
1. `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` → 0 · `node_modules/.bin/eslint src/pages/LandingPage.tsx src/components/public src/components/landing src/components/ui/logo.tsx` → 0.
2. `node_modules/.bin/vitest run src/components/public/PublicHeader.test.tsx src/components/landing` → yeşil · `node_modules/.bin/vite build` → OK.
3. `/` 1440/768/390 scroll'suz tam sayfa ekran görüntüsü (8081) → `/tmp/pub-p3b/`; önceki `/tmp/pub-p3/landing-*.png` ile görüntü yüksekliği aynı, gözle fark yok; `document.title` = "Personel ve geçiş yönetimi · NGS Plus".
4. `grep -c "^\s*\." src/components/public/public.css` ile kural sayısı önce/sonra rapora; `git status --porcelain` → yalnız Ownership.

## Rapor
`worker_done` ≤6 satır: taşınan/silinen dosyalar, birleştirilen kural sayısı, kapı sonuçları.
