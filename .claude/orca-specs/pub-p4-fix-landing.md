# Görev: Public P4 düzeltme — landing paketi (Q-07, R-02, Q-05 landing, R-08, R-09)

## Hedef (test edilebilir)
`docs/ui-scan/public/P4_FIXES.md` §Kabul tablosunda paketi **landing** olan 5 bulgu kapanmış olsun; landing 1440/768/390 ekranı görsel olarak
yalnız dokunma alanı büyütmesi kadar değişsin; kapılar yeşil.

## Bağlam (önce oku)
Repo `/Users/emreaydin/ngsaccess` — React 19 + Vite + Tailwind 4 + shadcn/ui. Bulgu ayrıntıları: `/tmp/pub-p4/QA.md` (Q-xx) ve `/tmp/pub-p4/REVIEW.md` (R-xx);
triage + kapsam: `docs/ui-scan/public/P4_FIXES.md`; tasarım sözleşmesi: `docs/ui-scan/public/DESIGN_PUBLIC.md`. Kural: `CLAUDE.md` (any yasak, `!` yerine optional chaining).
Kod stili: tek tırnak, 110 sütun (`node_modules/.bin/prettier --write --single-quote --print-width 110 <dosya>` değiştirdiğin her dosyaya).

## Yapılacaklar
1. **Q-07** `index.html`: `meta description`, `og:description`, `twitter:description` (varsa JSON-LD `description`) = `src/components/landing/marketingFacts.ts`
   `heroDescription` metni birebir; `og:title`/`twitter:title` = "Personel ve geçiş yönetimi · NGS Plus". Başka satıra dokunma.
2. **R-02** `src/pages/LandingPage.tsx`: hash kaydırma efekti aynı bağlantıya ikinci tıklamada da çalışsın (`useLocation().key` bağımlılığı).
   Koordinatörün eklediği `usePublicTheme()` çağrısı KALIR.
3. **Q-05** 390'da bağımsız bağlantılar ≥44px dokunma alanı (`min-h-11 inline-flex items-center` veya `public.css`'te eşdeğer): header logo, header/mobil menü
   bağlantıları, footer nav bağlantıları, footer logo. Cümle içindeki bağlantı (WCAG 2.5.8 inline istisnası, ör. metin içi e-posta) hariç.
   Ölçüm: QA `checks.json` alanları (`/tmp/pub-p4/checks.json`, `/tmp/pub-p4/capture.cjs` betiğini kopyalayıp kullanabilirsin).
4. **R-08** `marketingFacts.ts`: hiçbir yerde okunmayan export'ları (`grep -rn "<ad>" src` ile 0 kullanım doğrula) sil; `marketingFacts.test.ts` yeşil kalsın.
5. **R-09** Kullanılmayan varyantlar: `PublicHeader variant="auth"` (+ testi), `PublicFooter variant="compact"`, `src/components/ui/logo.tsx` varyant/boyut/tonları —
   YALNIZ `grep -rn` ile TÜM `src` içinde 0 kullanım doğrulanırsa sil. Logo uygulama kabuğunda da kullanılıyor; kullanılan prop değerine dokunma.

## Ownership (YALNIZ bunlar)
`index.html` · `src/pages/LandingPage.tsx` · `src/components/landing/**` · `src/components/public/{PublicHeader,PublicFooter,Section,ProductShot}.tsx` ·
`src/components/public/PublicHeader.test.tsx` · `src/components/public/public.css` · `src/components/ui/logo.tsx`.
Paralel worker'lar: auth worker `src/components/public/{AuthShell,StatusScreen}*` + `src/pages/{Login,Register,VerifyEmail,UserSetup,AdminSetup,EmployeeSetup,CheckIn,NotFound}*` + `src/hooks/usePublicTheme*`;
perf worker `vite.config.ts`, `src/App.tsx`, `src/main.tsx`, `src/components/Layout.tsx` — DOKUNMA. Çalışma ağacında başka oturumların commit'siz dosyaları var; dokunma.

## YASAK
Metin/görünüm değişikliği (madde 1 ve 3 hariç) · commit/push/deploy · `npx convex …` · canlı DB/Convex/Supabase · `package.json` · arka planda açık sunucu (8081 mevcut dev sunucusunu kullan, kapatma).

## Kapılar (kendin koş, rapora yaz)
1. `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` → 0 · `node_modules/.bin/eslint src/pages/LandingPage.tsx src/components/public src/components/landing src/components/ui/logo.tsx` → 0.
2. `node_modules/.bin/vitest run src/components/public src/components/landing` → yeşil.
3. `/` 1440/768/390 tam sayfa ekran (8081) → `/tmp/pub-p4-fix/landing-*.png`; 390'da bağımsız bağlantıların yükseklik tablosu (hepsi ≥44); `h1`=1, taşma 0, konsol 0.
   Aynı bağlantıya iki kez tıklama testi (Playwright): ikinci tıklamada `scrollY` hedef bölüme döner.
4. `grep -n 'description' index.html` çıktısı rapora · `git status --porcelain` → senin değiştirdiklerin yalnız Ownership.

## Rapor
`worker_done` ≤8 satır: bulgu başına file:line, silinen export/varyant listesi, kapı sonuçları. Ayrıntı `/tmp/pub-p4-fix/landing.md`.
