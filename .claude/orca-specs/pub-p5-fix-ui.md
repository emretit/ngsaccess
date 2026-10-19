# Görev: P5 — koyu tema yanıp sönmesi (RR-02) + Register ARIA (RR-05) + Logo prop (RR-08)

## Hedef (test edilebilir)
Koyu tema seçili bir kullanıcı uygulama rotasını (ör. `/home`) yenilediğinde ilk boyamadan itibaren koyu zemin görsün (önbellekte tercih varsa); public rotalar
her zaman açık kalsın; başka kullanıcı/proje önbelleği uygulanmasın. Register'da genel hata yalnız form uyarısında, `aria-invalid` yalnız gerçekten hatalı alanda.

## Bağlam (önce oku)
Repo `/Users/emreaydin/ngsaccess`. Audit: `/tmp/pub-p5/AUDIT-ui.md` §1 (RR-02 seçenekleri, öneri (a)), §4 (RR-05 öneri A), §5 (RR-08 öneri A); plan `docs/ui-scan/public/P5_PLAN.md`.
Kod: `src/hooks/useDarkMode.ts` (Layout içinde Convex `getDarkMode` sorgusu), `src/hooks/usePublicTheme.ts` (public sayfalar `.dark`'ı kaldırır — KALIR),
`src/components/settings/sections/GeneralSettings.tsx:24-25` (önizleme; DOKUNMA), `src/lib/routeMeta.ts` (uygulama rotaları; başka oturum değiştiriyor — YALNIZ OKU), `index.html`, `src/main.tsx`.

## Yapılacaklar
1. **RR-02:** `useDarkMode` sorgu sonucu geldiğinde tercihi localStorage'a yazsın: anahtar sürümlü, değer `{ v:1, userId, projectId, dark, at }` + "son aktif kapsam" işareti.
   `index.html` `<head>` içinde küçük inline betik: yol bir uygulama rotasıysa (routeMeta'daki `href`'lerden derlenmiş bir öneklere göre — betik routeMeta'yı import edemez; listeyi
   `src/lib/themeBootstrap.ts`'te tek kaynak yap ve index.html betiğini build'de üretmek zorunda değilsin: kısa, elle yazılmış ve testle routeMeta'ya karşı doğrulanan bir önek listesi kabul)
   ve önbellek kapsamı son aktif kapsamla eşleşiyorsa `document.documentElement.classList.add('dark')`. Sorgu `false` dönerse önbellek güncellenir; çıkışta / kullanıcı değişince
   önbellek kapsamı geçersiz sayılır. Hata/bozuk JSON'da sessizce açık temada kal. Önbellek yetki vermez, yalnız görsel ipucu.
2. **RR-05:** `src/pages/Register.tsx` — genel `error` yalnız `role=alert` form uyarısı; `aria-invalid` + alan açıklaması yalnız `fieldErrors` olan alanda; genel hatada odak uyarı kutusuna (`tabIndex=-1`).
3. **RR-08:** `src/components/ui/logo.tsx` kullanılmayan `variant` prop'unu ve 4 çağrıdaki argümanı kaldır (`grep -rn "<Logo" src`).
4. Test: `src/lib/themeBootstrap.test.ts` (kapsam eşleşmesi, bozuk JSON, public yol → uygulanmaz, routeMeta önekleriyle tutarlılık).

## Ownership (YALNIZ bunlar)
`index.html` (yalnız `<head>` inline tema betiği), `src/hooks/useDarkMode.ts`, `src/main.tsx` (gerekirse), yeni `src/lib/themeBootstrap.ts` (+ test), `src/pages/Register.tsx`,
`src/components/ui/logo.tsx`, `src/components/public/{AuthShell,StatusScreen,PublicHeader,PublicFooter}.tsx` (yalnız `<Logo variant=…>` argümanı).
Paralel W-qr: `convex/**`, `src/pages/CheckIn*` — DOKUNMA. `src/components/Layout.tsx`, `src/lib/routeMeta.ts` başka oturumda — DOKUNMA.

## YASAK
commit/push/deploy · `npx convex …` · canlı DB · `package.json` · arka planda açık sunucu (8081 mevcut dev sunucusunu kullan).

## Kapılar (kendin koş)
1. `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` → Ownership'te 0 · `node_modules/.bin/eslint src/hooks src/lib/themeBootstrap.ts src/pages/Register.tsx src/components/ui/logo.tsx src/components/public` → 0.
2. `node_modules/.bin/vitest run src/lib src/pages src/components/public` → yeşil.
3. Playwright (`require('/Users/emreaydin/pafta/node_modules/playwright')`, 8081, dış ağ abort, AuthProvider/convex mock deseni `/tmp/pub-p4/capture.cjs`): önbellekte dark=true kapsamlı kayıt varken
   `/home` ilk boyamada `html.dark` (DOMContentLoaded'da ölç) · aynı önbellekle `/login` → `html.dark` yok · farklı kapsam → uygulanmaz · bozuk JSON → hata yok. Register genel hata: `aria-invalid` sayısı 0, odak alert'te.

## Rapor
`worker_done` ≤8 satır: file:line, önbellek şeması, Playwright sonuçları, kapılar. Ayrıntı `/tmp/pub-p5/fix-ui.md`.
