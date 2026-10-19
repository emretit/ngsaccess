# Görev: Oturumsuz sayfalar P4 — görsel + erişilebilirlik + performans QA (SALT-OKUR, kod değiştirme)

## Hedef (test edilebilir)
`/tmp/pub-p4/QA.md` üretilmiş olsun: 10 public rota ve durum varyantları 1440/768/390'da ölçülmüş, her sapma `Q-xx` satırı olarak
(önem · rota · genişlik · kanıt PNG · önerilen düzeltme dosyası:satır) listelenmiş; Lighthouse skorları tabloda.
Bu worker KOD DÜZELTMEZ — bulgu üretir; düzeltmeyi sonraki worker yapacak.

## Bağlam (önce oku)
Repo `/Users/emreaydin/ngsaccess` — React 19 + Vite + Tailwind 4; backend Convex. Public sayfalar V2 "Bordo sahne" tasarımına geçirildi (commit yok).
1. `docs/ui-scan/public/DESIGN_PUBLIC.md` — §Erişilebilirlik ve hareket, §Akış kuralları ve rota başlıkları (title tablosu), §Metin, §Yasaklar.
2. Mockup'lar (hedef görünüm): `docs/ui-scan/public/directions/V2/{landing,login,register,status}.html` + `*-1440.png`/`*-390.png`.
3. `docs/ui-scan/public/AUDIT.md` (P-01…P-34) — kapanmış sayılan bulgular gerçekten kapandı mı.
4. Önceki ekran betiği (yeniden kullan, kopyala): `/tmp/pub-p2/capture.cjs` — 8081 dev sunucusunda `main.tsx`, `AuthProvider`, `convex/react`,
   `@convex-dev/auth/react` modüllerini Playwright `route.fulfill` ile mock'lar; dış ağ abort. Landing için `/tmp/pub-p3b/` ekranları var.
5. Sayfalar: `src/pages/{LandingPage,Login,Register,VerifyEmail,UserSetup,AdminSetup,EmployeeSetup,CheckIn,NotFound}.tsx`,
   bileşenler `src/components/public/**`, `src/components/landing/**`.

## Yapılacaklar
1. **Rota × genişlik turu** — 1440/768/390 (yükseklik 900, tam sayfa, scroll'suz): `/`, `/login`, `/login?confirmEmail=true`, `/register`,
   `/verify-email`, `/user-setup`, `/admin-setup`, `/employee-setup`, `/check-in`, `/olmayan-sayfa`, `/demo-request` (→ URL `/register`).
   **Durum varyantları:** mock'u genişlet (`useQuery`/`useMutation`/`useAction` dönüşünü rota+query'ye göre değiştir) ve her sayfanın kodda
   görünen sunum dallarını çek: verify-email yükleniyor/başarı/hata · user-setup geçersiz/yeni hesap formu/mevcut hesap formu · admin-setup zaten
   kurulu/form · employee-setup geçersiz/form/başarı · check-in yükleniyor/başarı (`locationRecorded` true ve false)/hata/belirsiz.
   Dalları sayfa kaynağından oku; ulaşamadığın dalı rapora "ulaşılamadı + neden" diye yaz.
   Her ekran için ölç: `h1` sayısı = 1 · `document.title` = DESIGN_PUBLIC tablosu · `scrollWidth <= innerWidth` · konsol/pageerror 0 ·
   kırık `img` 0 (`naturalWidth === 0`) · ilk render'da `opacity: 0` görünür metin/görsel 0 · dokunma hedefleri 390'da ≥44px (buton/bağlantı).
   PNG'ler → `/tmp/pub-p4/shots/<rota>-<varyant>-<genişlik>.png`; ölçümler → `/tmp/pub-p4/checks.json`.
2. **Mockup karşılaştırması** — landing/login/register/status: canlı ekranı mockup PNG'si ile yan yana gözle karşılaştır; yalnız anlamlı farkları yaz
   (düzen, sıra, metin, token/renk, boşluk ritmi). Piksel kayması bulgu değildir.
3. **Tema izolasyonu (P-34)** — `colorScheme: 'dark'` context + sayfa açılmadan önce `document.documentElement.classList.add('dark')` ve
   `localStorage`'a varsa tema anahtarı (kaynakta `grep -rn localStorage src/hooks src/components/settings`): her public rotada `html.dark` yok ve
   `body` arka planı açık (`--canvas`). Sonucu tabloya yaz.
4. **Reduced-motion** — `reducedMotion: 'reduce'`: hero dahil `animation-name`/`transition-duration` > 0 olan öğe 0; `scroll-behavior` `auto`.
5. **Klavye turu** (1440 ve 390): ilk Tab skip-link'i görünür yapar, Enter odağı `#main`'e taşır · landing mobil menü açılır, Esc kapatır, odak menü
   düğmesine döner · `/login`'de Tab sırası e-posta → şifre → göster/gizle → "Şifremi unuttum" → gönder (gerçek sırayı yaz) · odak halkası görünür.
6. **Lighthouse** — `node_modules/.bin/vite build` → `node_modules/.bin/vite preview --port 5199 --strictPort` (işin sonunda KAPAT) →
   `CHROME_PATH="$HOME/Library/Caches/ms-playwright/chromium-1248/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing" npx -y lighthouse@12 <url>
   --quiet --chrome-flags="--headless=new" --output=json --output-path=/tmp/pub-p4/lh-<ad>.json` (mobil varsayılan + `--preset=desktop`):
   `/` ve `/login`. Tablo: performance / accessibility / best-practices / seo; başarısız audit'lerin id'leri. Hedef: landing perf ≥90, a11y ≥95; login a11y ≥95.
   Lighthouse kurulamazsa nedenini yaz ve bu adımı atla (diğer adımları sürdür).
7. **Paket taraması** — `dist/` içinde `grep -rlE "gptengineer|Excel ile içe|push bildirim|çevrimdışı|biyometr|14 gün|ücretsiz deneme|Türkiye'nin|NGS ACCESS"` → 0;
   `dist/index.html` meta description = `marketingFacts` hero metni; `public/marketing/*.webp` boyutları + hero LCP görseli `fetchpriority=high` mı.

## Ownership
YALNIZ `/tmp/pub-p4/**` (betikler, PNG, JSON, `QA.md`). Repo içinde HİÇBİR dosyaya yazma (src, docs, package.json dahil); `dist/` build çıktısı serbest.
Çalışma ağacında başka oturumların commit'siz değişiklikleri var — dokunma.

## YASAK
Kod düzeltme · commit/push/deploy · `npx convex …` · canlı DB/Convex/Supabase okuma-yazma · gerçek form gönderme (mock dışı ağ abort) ·
arka planda açık bırakılan sunucu (8081'deki mevcut dev sunucusunu KAPATMA; 5199 preview'i sen açtın, sen kapat).

## Kapılar (kendin koş, rapora yaz)
1. `/tmp/pub-p4/checks.json` her satırda `h1`, `title`, `overflow`, `errors`, `brokenImages`, `hiddenOnLoad` alanları; ekran sayısı ≥ 33 (11 rota × 3) + varyantlar.
2. `QA.md` her bulgu: `Q-xx | 🔴/🟠/🟡/⚪ | rota | genişlik | kanıt | beklenen (DESIGN_PUBLIC §) | önerilen düzeltme file:line`.
3. `lsof -nP -iTCP:5199 -sTCP:LISTEN` → boş (preview kapandı). `git status --porcelain` başta ve sonda aynı (repo'ya yazmadın).

## Rapor
`worker_done` ≤10 satır: bulgu sayısı önem bazında, Lighthouse 4 skor (landing mobil/masaüstü, login), ulaşılamayan varyantlar, `reportPath=/tmp/pub-p4/QA.md`.
