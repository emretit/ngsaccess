# Görev: Public P5 audit — koyu tema yanıp sönmesi + login mobil performans + küçük kalanlar (SALT-OKUR)

## Hedef (test edilebilir)
`/tmp/pub-p5/AUDIT-ui.md` üretilmiş olsun: her madde için durum (AÇIK/KAPALI) + kanıt (file:line, ölçüm JSON'u) + kök sebep + 1-2 düzeltme seçeneği
(artı/eksi, tahmini kazanç) + önerilen seçenek. Düzeltme YAPMA.

## Bağlam
Repo `/Users/emreaydin/ngsaccess` — React 19 + Vite (rolldown) + Tailwind 4; Convex backend. Public sayfalar commit `77b25ea` ile canlı (https://ngsplus.app,
Netlify, elle deploy). Önceki ölçümler: `/tmp/pub-p4/QA.md`, `/tmp/pub-p4-fix/perf.md`, `/tmp/pub-p4-fix/REREVIEW.md` (RR-xx). Çalışma ağacında başka oturumların
commit'siz değişiklikleri var → ölçümü **temiz HEAD worktree**'de yap: `git worktree add --detach /tmp/pub-p5/wt HEAD` + `ln -s /Users/emreaydin/ngsaccess/node_modules /tmp/pub-p5/wt/node_modules`;
iş bitince symlink'i sil + `git worktree remove --force /tmp/pub-p5/wt`.

## Maddeler
1. **RR-02 koyu tema yanıp sönmesi** — koyu tema tercihi Convex'te proje ayarı (`convex/settings.ts:236 getDarkMode`), uygulama `src/hooks/useDarkMode.ts` ile `Layout` içinde
   sorgu dönünce `.dark` ekliyor; public sayfalar `src/hooks/usePublicTheme.ts` ile kaldırıyor; `GeneralSettings.tsx:24-25` önizleme.
   Oturumlu bir uygulama rotasında (ör. `/home`) sayfa yenilemede hangi aşamalar açık temada boyanıyor (boş HTML → `PageFallback` → `Layout` "Sistem hazırlanıyor" → kabuk)?
   Kanıt: kod yolu + mümkünse Playwright ile mock'lu ölçüm (`/tmp/pub-p4/capture.cjs` mock desenini kopyala; AuthProvider/convex modüllerini route ile mock'la, `getDarkMode` → true).
   Seçenekleri karşılaştır: (a) `index.html` `<head>` inline betik + localStorage önbelleği (yalnız uygulama yollarında; yol listesi tek kaynaktan, ör. `src/lib/routeMeta.ts`),
   (b) `main.tsx`'te render öncesi uygulama, (c) `useDarkMode` içinde `useLayoutEffect` + önbellek. Çoklu kullanıcı/proje, çıkış, public sayfa etkileşimi, CSP (bugün yok) açısından.
2. **Login mobil Lighthouse 89** — temiz HEAD build (`node_modules/.bin/vite build`) + `vite preview --port 5199 --strictPort` (KAPAT) + Lighthouse 12 mobil ×3 `/login` ve `/`:
   `CHROME_PATH="$HOME/Library/Caches/ms-playwright/chromium-1248/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing" npx -y lighthouse@12 <url> --quiet --only-categories=performance --chrome-flags="--headless=new --host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost" --output=json --output-path=/tmp/pub-p5/lh-<ad>-<n>.json`.
   Medyan skor, FCP/LCP, LCP öğesi, kritik istek zinciri (`network-dependency-tree-insight`), entry + `/login` lazy chunk boyutları. Kök sebep: render'ı geciktiren zincir
   (entry → AuthProvider/Convex istemcisi → lazy Login chunk?) — `src/main.tsx`, `src/App.tsx`, `AuthProvider` render koşulu. Seçenek + tahmini kazanç.
3. **Canlı ölçüm** — aynı Lighthouse komutunu `https://ngsplus.app/` ve `https://ngsplus.app/login` için mobil ×2 (host-resolver bayrağı OLMADAN; yalnız GET). Yerel ile farkı yaz.
4. **RR-05** `src/pages/Register.tsx` genel hata varken 5 alanın hepsi `aria-invalid` — hangi hatalar genel, hangileri alana özgü (Convex/AuthProvider hata metinleri); öneri.
5. **RR-08** `src/components/ui/logo.tsx` kullanılmayan `variant` prop'u (`grep -rn "<Logo" src`). **RR-09** `src/pages/VerifyEmail.test.tsx` token'sız hata dalı test edilmiyor.

## Ownership
YALNIZ `/tmp/pub-p5/**` (geçici worktree dahil). Ana repo dosyalarına yazma.

## YASAK
Kod düzeltme · commit/push/deploy · `npx convex …` · canlı DB/Convex/Supabase · arka planda açık sunucu (8081'deki mevcut dev sunucusunu kapatma; 5199'u sen açtın, sen kapat).

## Kapılar
1. Lighthouse JSON'ları `/tmp/pub-p5/lh-*.json`; tabloda medyanlar. 2. `lsof -nP -iTCP:5199 -sTCP:LISTEN` boş; `git worktree list` içinde `/tmp/pub-p5/wt` yok.
3. Ana repo `git status --porcelain` başta/sonda senin yüzünden değişmedi.

## Rapor
`worker_done` ≤8 satır: madde başına durum + önerilen seçenek, yerel/canlı login mobil medyan, `reportPath=/tmp/pub-p5/AUDIT-ui.md`.
