# Görev: Public P4 düzeltme — giriş/durum paketi (R-01, R-04, R-05, R-06, R-11, Q-03, Q-04, Q-05 auth, Q-09, Q-10 + eksik testler)

## Hedef (test edilebilir)
`docs/ui-scan/public/P4_FIXES.md` §Kabul tablosunda paketi **auth** olan bulgular kapanmış, eksik davranış testleri eklenmiş olsun; akış davranışı
(mutation/query çağrıları, argümanlar, yönlendirmeler, cooldown) DEĞİŞMESİN; kapılar yeşil ve testler başka makinede de çalışabilir olsun.

## Bağlam (önce oku)
Repo `/Users/emreaydin/ngsaccess` — React 19 + Vite + Tailwind 4 + shadcn/ui; backend Convex (`convex/**` DEĞİŞMEZ). Bulgular: `/tmp/pub-p4/REVIEW.md` (R-xx, file:line + düzeltme önerisi),
`/tmp/pub-p4/QA.md` (Q-xx, kanıt `/tmp/pub-p4/keyboard.json`, `checks.json`, `styles.json`); triage: `docs/ui-scan/public/P4_FIXES.md`; sözleşme:
`docs/ui-scan/public/DESIGN_PUBLIC.md` §Erişilebilirlik ve hareket, §Akış kuralları, §Metin. Kural: `CLAUDE.md`.
Koordinatör `src/hooks/usePublicTheme.ts`'i ekledi ve `AuthShell` + `StatusScreen`'de çağırıyor — KALIR.
Kod stili: tek tırnak, 110 sütun (`node_modules/.bin/prettier --write --single-quote --print-width 110 <dosya>`).

## Yapılacaklar
1. **R-01** `src/pages/Login.test.tsx`: `/Users/emreaydin/pafta/...playwright` import'u ve gerçek Chromium açan testi kaldır; davranışı jsdom/RTL ile ölç
   (proje deps'inde ne varsa: `grep -n "testing-library\|jsdom\|happy-dom" package.json`). Repo dışı mutlak yol hiçbir test dosyasında kalmaz.
2. **Q-03** `AuthShell`: skip-link Enter → odak `main#main`'e geçer (`tabIndex={-1}` + gerekirse `onClick` ile `focus()`), görünür odak halkası olmadan.
3. **Q-04 = R-03** `StatusScreen`: skip-link `main` dışında, `href="#main"`, `main` `tabIndex={-1}`; Enter → odak `main`. (`#status-content` kalkar ya da main olur.)
4. **Q-05** 390'da bağımsız bağlantılar ≥44px: AuthShell logo bağlantısı + "Ana sayfa" + alt bağlantılar, StatusScreen logo bağlantısı. Cümle içi bağlantı istisna.
5. **Q-10** Public birincil/ikincil eylem düğmeleri `font-semibold` (AuthShell formlarındaki submit'ler + StatusScreen `Action`); global `src/components/ui/button.tsx`'e DOKUNMA.
6. **Q-09** `Register.tsx`: Ad/Soyad 390'da da iki sütun (mockup `docs/ui-scan/public/directions/V2/register-390.png`); taşma 0.
7. **R-06** Register'daki 5 alan + Login'deki 2 alan: genel hata varken `aria-describedby="form-error"` (alanın kendi hata/ipucu id'leriyle birleşik) + `aria-invalid`; HEAD paritesi (`git show HEAD:src/pages/Register.tsx`).
8. **R-04** `CheckIn.tsx`: backend `success:false` reddinde `result.error` metni token kaynaklıysa (`convex/employeeCheckIn.ts:48,51,56`'daki "Geçersiz veya süresi dolmuş kod" / "Kodun süresi doldu")
   `invalid` sunumu ("güncel QR'ı tekrar tarayın" metni, DESIGN_PUBLIC §Metin), "Çalışan bulunamadı" → mevcut genel metin. Ham backend metni ekrana basılmaz; eşleme sabit sözlükle.
9. **R-05** `UserSetup.tsx`: `inviteData.type === 'reset'` başlığı ayrı ("Bu bağlantı hesap daveti değil." veya DESIGN_PUBLIC'te varsa oradaki metin).
10. **R-11** `VerifyEmail.tsx`: catch içindeki `expired` → `isExpired`.
11. **Testler** (yeni dosyalar, RTL + vitest; Convex/auth hook'ları `vi.mock`): `src/pages/CheckIn.test.tsx` (başarı yalnız backend success sonrası; `locationRecorded:false` → "Konum bilgisi eklenemedi.";
    token reddi → invalid metni; `catch` → belirsiz sonuç, tekrar gönder/yeniden tara düğmesi YOK; saat `Europe/Istanbul`), `src/pages/VerifyEmail.test.tsx` (token yok / EXPIRED / başarı / yeniden gönder cooldown),
    `src/pages/UserSetup.test.tsx` (existing modu: şifre tekrarı + kurallar gizli, e-posta disabled; reset başlığı), `src/hooks/usePublicTheme.test.tsx` (mount'ta `html.dark` kalkar),
    `StatusScreen.test.tsx`'e skip-link hedefinin var olduğu testi.

## Ownership (YALNIZ bunlar)
`src/components/public/{AuthShell,StatusScreen}.tsx` (+ `.test.tsx`) · `src/pages/{Login,Login.test,Register,VerifyEmail,UserSetup,AdminSetup,EmployeeSetup,CheckIn,NotFound}.tsx` ·
yeni `src/pages/{CheckIn,VerifyEmail,UserSetup}.test.tsx` · yeni `src/hooks/usePublicTheme.test.tsx`. Paralel worker'lar: landing worker `index.html`, `LandingPage`,
`src/components/landing/**`, `src/components/public/{PublicHeader,PublicFooter,Section,ProductShot}*`, `public.css`, `logo.tsx`; perf worker `vite.config.ts`, `src/App.tsx`,
`src/main.tsx`, `Layout.tsx` — DOKUNMA. `src/components/shared/**`, `src/components/ui/**`, `convex/**` kapsam dışı. Başka oturumların commit'siz dosyalarına dokunma.

## YASAK
Akış davranışı değişikliği (madde 8-9 hariç sunum) · commit/push/deploy · `npx convex …` · canlı DB/Convex/Supabase · gerçek form gönderme · `package.json` · arka planda açık sunucu.

## Kapılar (kendin koş, rapora yaz)
1. `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` → 0 · `node_modules/.bin/eslint src/pages src/components/public src/hooks` → 0.
2. `node_modules/.bin/vitest run src/pages src/components/public src/hooks` → yeşil; `grep -rn "/Users/" src --include=*.test.ts*` → 0.
3. Ekran + klavye: `/tmp/pub-p4/capture.cjs` ve `/tmp/pub-p4/focus.cjs`'i `/tmp/pub-p4-fix/` altına kopyalayıp 8081'de koş: login, register, verify-email, check-in, 404 × 1440/390 →
   h1=1, taşma 0, konsol 0; skip-link Enter → `document.activeElement` = `MAIN`; 390 bağımsız bağlantı yükseklikleri ≥44.
4. `git status --porcelain` → senin değiştirdiklerin yalnız Ownership.

## Rapor
`worker_done` ≤10 satır: bulgu başına file:line, eklenen test dosyaları + test sayısı, kapı sonuçları. Ayrıntı `/tmp/pub-p4-fix/auth.md`.
