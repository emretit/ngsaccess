# Görev: Public P4 düzeltme — mobil performans (Q-02), kök sebep + düzeltme

## Hedef (test edilebilir)
Prod build'de `dist/index.html` entry'si `excel-pdf`, `charts`, `html2canvas` chunk'larını modulepreload ETMESİN; Lighthouse 12 mobil
`/` performans ≥90 (ölçülemezse elde edilen skor + kalan darboğaz kanıtla raporlansın); uygulama içi rotaların hepsi build'de çözülsün.

## Bağlam
Repo `/Users/emreaydin/ngsaccess` — React 19 + Vite (rolldown) + Tailwind 4; backend Convex. Oturumsuz sayfalar (landing, giriş, durum ekranları) yeni tasarıma geçti.
QA ölçümü (`/tmp/pub-p4/QA.md` Q-02, `/tmp/pub-p4/lh-landing-mobile-final.json`): landing mobil perf 66, login 64; FCP 5,1 sn, LCP 5,6 sn,
~508 KiB kullanılmayan JS. Bugünkü `dist/index.html` modulepreload listesi: rolldown-runtime, **excel-pdf (1,33 MB)**, **charts (357 KB)**,
convex-vendor, api, radix, dist, utils, react-vendor, notify, AuthProvider, x, button.
Şüpheliler (doğrula, varsayma): `vite.config.ts` `manualChunks` paylaşılan küçük modülleri (ör. ortak helper/polyfill) büyük vendor chunk'ına
çekip entry'yi ona bağımlı yapıyor olabilir; `src/App.tsx` `Layout`'u statik import ediyor (Layout → AppSidebar/AppHeader/SyncIssuesBanner zinciri);
`src/main.tsx` veya AuthProvider zinciri ağır modül çekiyor olabilir. Önce `vite build` çıktısında hangi entry modülünün o chunk'lara bağlandığını bul
(ör. `npx vite-bundle-visualizer` YASAK değil ama package.json'a ekleme; `rolldown`/`rollup` meta çıktısı veya chunk içeriğini grep'leyerek).

## Yapılacaklar
1. Kök sebebi bul, rapora file:line ile yaz (hangi import zinciri entry'yi excel-pdf/charts'a bağlıyor).
2. Düzelt: tercih sırası (a) `manualChunks` sadeleştirme/kaldırma (yalnız gerçekten büyük ve tembel yüklenen vendor'lar ayrı chunk),
   (b) `Layout`'u `lazy()` yapma (Suspense fallback mevcut `PageFallback`), (c) ağır modülü kullanan yerde dinamik `import()`.
   Davranış değişmez; route listesi, provider sırası aynı kalır.
3. `src/App.tsx`'te koordinatörün eklediği kaydırma efekti (`AppContent` içindeki `useEffect` + `useLocation`) KORUNUR.

## Ownership (YALNIZ bunlar)
`vite.config.ts` · `src/App.tsx` · `src/main.tsx` · `src/components/Layout.tsx` (yalnız import biçimi; `useDarkMode` çağrısı kalır) ·
dinamik import'a çevirmen gereken modül varsa önce koordinatöre `ask` ile sor (dosya adı + neden). Paralel worker'lar: landing worker
`index.html`, `src/pages/LandingPage.tsx`, `src/components/{landing,public}/**`, `src/components/ui/logo.tsx`'in; auth worker
`src/components/public/{AuthShell,StatusScreen}*`, `src/pages/{Login,Register,VerifyEmail,UserSetup,AdminSetup,EmployeeSetup,CheckIn,NotFound}*`'in sahibi — DOKUNMA.
`package.json`/lockfile DEĞİŞMEZ.

## YASAK
commit/push/deploy · `npx convex …` · canlı DB/Convex/Supabase okuma-yazma · arka planda açık bırakılan sunucu (8081'deki mevcut dev sunucusunu kapatma).

## Kapılar (kendin koş, rapora yaz)
1. `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` → 0 · `node_modules/.bin/eslint src/App.tsx src/main.tsx src/components/Layout.tsx vite.config.ts` → 0.
2. `node_modules/.bin/vitest run` (tümü) → yeşil.
3. `node_modules/.bin/vite build` → OK; `grep -o 'modulepreload[^>]*' dist/index.html` → excel-pdf/charts/html2canvas YOK; önce/sonra chunk boyut tablosu.
4. `node_modules/.bin/vite preview --port 5199 --strictPort` (işin sonunda KAPAT) + Lighthouse 12 mobil ve `--preset=desktop`, `/` ve `/login`:
   `CHROME_PATH="$HOME/Library/Caches/ms-playwright/chromium-1248/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing" npx -y lighthouse@12 <url> --quiet --chrome-flags="--headless=new --host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost" --output=json --output-path=/tmp/pub-p4-fix/lh-<ad>.json`.
   Önce/sonra perf skorları tablosu (önce: landing mobil 66, login mobil 64, masaüstü 96/95).
5. Uygulama rotaları: build sonrası preview'de `/home`, `/settings`, `/pdks-records` açıldığında (oturumsuz → `/login`'e yönlenmesi beklenir) konsolda chunk yükleme hatası 0 (Playwright `require('/Users/emreaydin/pafta/node_modules/playwright')`).
6. `lsof -nP -iTCP:5199 -sTCP:LISTEN` boş · `git status --porcelain` → senin değiştirdiklerin yalnız Ownership.

## Rapor
`worker_done` ≤10 satır: kök sebep file:line, yapılan değişiklik, önce/sonra Lighthouse + entry preload listesi, kapı sonuçları. Ayrıntı `/tmp/pub-p4-fix/perf.md`.
