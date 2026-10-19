# Görev: Oturumsuz sayfalar P3 — Landing yeniden (V2) + `/demo-request` yönlendirme + ölü kod temizliği

## Hedef (test edilebilir)
`/` sayfası `docs/ui-scan/public/directions/V2/landing.html` mockup'ıyla yan yana bakıldığında aynı bölüm sırası, düzen ve metinde olsun;
içerik varsayılan görünür olsun (scroll'suz tam sayfa ekran görüntüsünde boş bölüm yok); `/demo-request` `/register`'a yönlensin; kapılar yeşil.

## Spec kaynakları (önce oku)
1. `docs/ui-scan/public/DESIGN_PUBLIC.md` — token, tipografi, `PublicHeader`/`PublicFooter`/`Section`/`ProductShot` prop'ları, logo kullanımı, TÜM metinler (kelimesi kelimesine).
2. `docs/ui-scan/public/directions/V2/landing.html` + `landing-1440.png`/`landing-390.png` — görsel hedef. (`landing-font.html` yalnız font önerisi; display font EKLEME, sistem fontu kalır.)
3. `docs/ui-scan/public/AUDIT.md` — bu işin kapattığı bulgular: P-10, P-11 (hero), P-12 (logo), P-13 (whileInView), P-14 (mobilde ürün görseli), P-15, P-17 (ölü kod),
   P-20/21/22 (iddialar), P-24 (mobil bölüm), P-32 (demo sayfası), P-33 (başlık). `docs/ui-scan/public/PLAN.md` §Landing bölüm sırası.
4. Ürün görselleri hazır: `public/marketing/*.webp`.

## Koordinatörün hazırladığı ortak zemin (değiştirme, kullan)
- Public sayfalar HER ZAMAN açık tema: `.dark` sınıfı artık yalnız uygulama kabuğunda uygulanıyor (`src/components/Layout.tsx` → `useDarkMode()`, kabuktan çıkınca kaldırılır).
  Public bileşenlerde `dark:` varyantı YAZMA; DESIGN_PUBLIC §Token'lar "açık tema" kuralı böyle karşılandı.
- `src/index.css`'te `--public-max/--public-gutter/--public-section/--public-hero-overlap/--public-form-max/--public-status-max/--public-shot-shadow` var
  (≤600px mobil değerleriyle). Kullanım: `max-w-[var(--public-max)]`, `px-[var(--public-gutter)]`, `shadow-[var(--public-shot-shadow)]`.
- Renk yardımcıları (Tailwind): `bg-canvas`, `bg-surface`, `bg-subtle`, `border-line`, `border-control`, `text-text`, `bg-side-bg`, `text-side-text`, `text-side-muted`,
  `outline-side-indicator`, `bg-primary`, `hover:bg-primary-hover`, `text-muted-foreground`, `text-danger`, `bg-danger-bg`, `text-success`. HEX yazma.
- `src/hooks/usePageTitle.ts` hazır; başlıklar DESIGN_PUBLIC §Akış kuralları tablosundaki metinler ("Giriş yap" → "Giriş yap · NGS Plus" hook ekler).
- Display font EKLENMEZ; sistem fontu (DESIGN_PUBLIC `--public-display`).

## Yapılacaklar
1. `src/components/public/{PublicHeader,PublicFooter,Section,ProductShot}.tsx`: DESIGN_PUBLIC prop'larıyla.
   - `PublicHeader`: logo · bölüm bağlantıları · Giriş · Hesap oluştur; mobil Sheet menü; menü düğmesi ve masaüstü nav aynı kırılımda (768-1023 boşluk yok);
     skip-link `#main`; farklı sayfadan bölüm bağlantısı `/#features` gibi gerçek gezinme (bugünkü `handleAnchor` davranışını koru).
   - `ProductShot`: `<picture>`/`<img>` + `srcset` (800w/1600w) + `sizes` + Türkçe `alt` + `width/height` (CLS yok); hero görseli `fetchpriority="high"`, diğerleri `loading="lazy"`.
2. `src/pages/LandingPage.tsx` + `src/components/landing/**`: PLAN.md §Landing sırası ve mockup. Sekmeli özellik bloğu, renkli ikon kutuları, sahte gösterge kartları
   (`HeroMockup`), telefon çizimi, sahte mağaza rozetleri, gradyan/glow/nokta desenleri kalkar. Mobil uygulama = tek satır not (K2).
   Metinler `marketingFacts.ts`'te tek kaynak (DESIGN_PUBLIC metinleriyle güncelle); yasak iddialar (aşağıda) hiçbir yerde kalmaz.
3. Hareket: landing'den `framer-motion` importlarının hepsi kalkar; en fazla hero'da `motion-reduce:` ile kapanan tek CSS fade. `package.json`'a DOKUNMA.
4. `src/components/ui/logo.tsx`: DESIGN_PUBLIC logo kullanımı ("Plus" kontrastı ≥4,5:1, açık/bordo zemin). Mevcut prop API'si (`size`, `variant`, `tone`, `className`)
   GERİYE UYUMLU kalmalı (giriş worker'ı `<Logo variant="compact" tone="dark|light" size="md" />` kullanıyor); yeni prop eklenebilir.
5. `/demo-request` (K1): `src/App.tsx`'te rota `<Navigate to="/register" replace />` olur, `DemoRequest` lazy importu kalkar; `src/pages/DemoRequest.tsx` ve
   `src/components/demo/**` silinir. Landing'de satış iletişimi mailto/tel bandı (DESIGN_PUBLIC metni).
6. Ölü kod sil (önce `grep -rn` ile başka kullanıcı olmadığını doğrula): `StatsSection.tsx`, `TestimonialsSection.tsx`, `publicCopy.ts` (importları `marketingFacts`'e çevir),
   `src/index.css`'teki `.burgundy-gradient` YALNIZ başka kullanıcı yoksa — `src/components/Layout.tsx` kullanıyorsa dokunma ve rapora yaz. `index.css`'e başka bir şey yazma.
7. `usePageTitle()` (başlıksız → "NGS Plus") `LandingPage`'de çağrılır (`src/hooks/usePageTitle.ts` hazır, değiştirme).
8. Test: `src/components/public/PublicHeader.test.tsx` (mobil menü açılır/kapanır, bölüm bağlantısı) + `src/components/landing/marketingFacts.test.ts`
   (yasak iddia regex'i `marketingFacts` ve landing bileşen kaynaklarında 0 — `fs.readFileSync` ile).

## Yasak iddialar (metinde 0)
Excel'den personel içe aktarma · push bildirim · çevrimdışı çalışma · biyometrik PDKS · deneme süresi / fiyat / müşteri sayısı / referans ·
"Türkiye'nin …" · "IT ekibine gerek yok" · "tek satır kod" · "KVKK uyumlu" garantisi · "5 dakika" / "14 gün".

## Ownership (YALNIZ bunlar)
`src/components/public/{PublicHeader,PublicFooter,Section,ProductShot}.tsx` (+ `.test.tsx`), `src/pages/LandingPage.tsx`, `src/pages/DemoRequest.tsx` (silme),
`src/components/landing/**`, `src/components/demo/**` (silme), `src/components/ui/logo.tsx`, `src/App.tsx` (yalnız `/demo-request` satırı + import), `src/index.css` (yalnız madde 6).
Paralel çalışan giriş worker'ı `src/components/public/{AuthShell,StatusScreen}.tsx` ve `src/pages/{Login,Register,VerifyEmail,UserSetup,AdminSetup,EmployeeSetup,CheckIn,NotFound}.tsx`'in sahibi — onlara yazma.

## Kapsam dışı
`convex/**`, `mobile/**`, `src/components/auth/**`, `src/components/shared/**`, diğer `src/components/ui/**`, `index.html`, `public/**`.
Çalışma ağacında başka oturumların commit'siz dosyaları var (mobile/**, src/components/leaves/**, employees/**, admin/**, PaginationBar vb.): DOKUNMA.

## Kurallar
React 19 + Vite + Tailwind 4 + shadcn/ui. `any`/`as any` yasak; `!` yerine optional chaining + erken return. Metin Türkçe.
A2 yasakları: gradyan, glow, blur daire, nokta deseni, renkli ikon kutusu + kart tekrarı, kart içinde kart, rounded-2xl her yerde, gölge (ürün görseli çerçevesinde tek hafif gölge hariç),
emoji, BÜYÜK HARF etiket, ✨ rozet, hover'da zıplayan kart. Sabit `bg-white`/`bg-black`/HEX yok; token kullan.

## YASAK
commit / push / deploy · `npx convex …` · canlı DB okuma/yazma (Convex/Supabase MCP dahil) · arka planda açık bırakılan sunucu · formları gerçekten gönderme.

## Kapılar (kendin koş, sonuçları rapora yaz)
1. `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` → 0 hata.
2. `node_modules/.bin/eslint src/pages src/components/public src/components/landing src/App.tsx` → 0 hata.
3. `node_modules/.bin/vitest run src/components/public src/components/landing` → yeşil.
4. `node_modules/.bin/vite build` → OK; `grep -rn "framer-motion" src/components/landing src/pages/LandingPage.tsx` → 0.
5. Yerel sunucu (`http://localhost:8081` açıksa onu kullan; değilse `npx vite --port 5198` başlat, işin sonunda KAPAT): `/` 1440/768/390 SCROLL'SUZ tam sayfa Playwright ekran görüntüsü → `/tmp/pub-p3/`; boş bölüm yok, yatay taşma yok, konsol hatası 0;
   `/demo-request` → URL `/register`. Playwright: `require('/Users/emreaydin/pafta/node_modules/playwright')`.
6. `git status --porcelain` → senin değiştirdiğin dosyalar yalnız Ownership listesinde.

## Rapor
`worker_done` özetinde ≤10 satır, file:line ile: değişen/silinen dosyalar, kapatılan P-xx'ler, kapı sonuçları, açık sorular.
