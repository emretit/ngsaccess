# Görev: Public P4 — düzeltme turu (W3) yeniden denetimi (SALT-OKUR; kodu Codex yazdı, denetçi Claude)

## Hedef (test edilebilir)
`/tmp/pub-p4-fix/REREVIEW.md` üretilmiş olsun: W3'te değişen kod okunmuş; her sorun `RR-xx | önem | file:line | sorun | senaryo | düzeltme` satırı;
"commit'e engel var mı" sorusuna tek satırlık net cevap. KOD DÜZELTME.

## Bağlam
Repo `/Users/emreaydin/ngsaccess` (React 19 + Vite + Tailwind 4; Convex backend DEĞİŞMEDİ). Public sayfalar V2'ye geçti; ilk denetim `/tmp/pub-p4/REVIEW.md`,
QA `/tmp/pub-p4/QA.md`, triage `docs/ui-scan/public/P4_FIXES.md`. W3'te üç Codex worker düzeltme yaptı; raporları:
`/tmp/pub-p4-fix/{perf,landing,auth}.md`. Önceki (W3 öncesi) kopyalar kısmen var: `/tmp/pub-p4-fix/{App.before.tsx,vite.before.ts,AuthShell.tsx,StatusScreen.tsx}`;
geri kalanında `git show HEAD:<yol>` ile karşılaştır ve raporlardaki file:line'lara odaklan.

## Odak (öncelik sırası)
1. **Perf** — `vite.config.ts` (manualChunks tamamen kaldırıldı) + `src/App.tsx` (`Layout` artık `lazy`): oturum açmış kullanıcı akışı bozulur mu?
   `Layout` lazy yüklenirken `Suspense` fallback'i (`PageFallback`) her authed rotada mı; `Layout` içindeki `useDarkMode` ve `Outlet` davranışı aynı mı;
   koordinatörün `AppContent` kaydırma efekti korunmuş mu; chunk yükleme hatası (deploy sonrası eski chunk) için mevcut `ErrorBoundary` kapsıyor mu.
2. **Davranış korunumu (refactor'lar)** — `src/pages/CheckIn.tsx` (backend sonucu → sunum saf fonksiyonu, satır ~17/94), `src/pages/VerifyEmail.tsx` (hata sınıflandırma saf fonksiyonu ~14/47):
   mutation çağrısı + argümanları, `running` ref çift-gönderim koruması, konum bekleme, `catch` → belirsiz sonuç (tekrar gönder/yeniden tara YOK), `locationRecorded`, `Europe/Istanbul` saat,
   token reddi eşlemesi (`convex/employeeCheckIn.ts:48,51,56` metinleri) HEAD ile eşdeğer mi.
3. **Erişilebilirlik** — `AuthShell.tsx` / `StatusScreen.tsx` skip-link (`#main`, `tabIndex=-1`, `focus()`), `main` outline kaldırma odak görünürlüğünü bozuyor mu;
   `Register.tsx` 5 alanda `aria-describedby` birleşimi (FormFieldWrapper'ın kendi id'leriyle çakışma/çift id), `aria-invalid`.
4. **Landing** — `LandingPage.tsx` `[hash, key]` efekti (ilk yüklemede/geri tuşunda istenmeyen kaydırma?), `index.html` meta, `logo.tsx` silinen varyantlar
   (uygulama kabuğunda kullanılan prop kaldı mı: `grep -rn "<Logo" src`), `PublicHeader/PublicFooter` silinen varyantlar, `marketingFacts` silinen export'lar (kırık import yok mu).
5. **Testler** — yeni `src/pages/{CheckIn,VerifyEmail,UserSetup}.test.tsx`: gerçekten sayfanın kullandığı fonksiyonu mu test ediyor (kopyası değil); mock'lar sızdırıyor mu.
6. **Kurallar** — `CLAUDE.md`: any/`as`/`!`, HEX, `dark:` (public), repo dışı mutlak yol.

## Kapılar (KENDİN koş)
`node_modules/.bin/tsc --noEmit -p tsconfig.app.json` · `node_modules/.bin/eslint src convex` · `node_modules/.bin/vitest run` · `node_modules/.bin/vite build`.
Not: başka oturumlar eşzamanlı çalışıyor; şu an bilinen kapsam dışı kırmızı: `convex/lib/auditLogQuery.test.ts` (KVKK oturumu). Kapsam dışı hatayı bulgu yapma, ayrı listele.

## Ownership
YALNIZ `/tmp/pub-p4-fix/REREVIEW.md` (+ `/tmp/pub-p4-fix/rr-*` yardımcı dosyalar). Repo'ya yazma.

## YASAK
Kod düzeltme · commit/push/deploy · `npx convex …` · canlı DB/Convex/Supabase · arka planda açık sunucu.

## Rapor
`worker_done` ≤8 satır: önem bazında bulgu sayısı, en kritik 3 bulgu file:line, 4 kapı sonucu, "commit'e engel: var/yok", `reportPath`.
