# Görev: P5 — QR giriş sonuç sözleşmesi (RR-04 + SHL-26 kalan)

## Hedef (test edilebilir)
`checkInWithToken` başarısız sonuçlarda kararlı bir `code` döndürsün ve kullanılmış token'ın tekrar yanıtı ilk yanıtla eşdeğer olsun
(`locationRecorded` dahil, çalışan sonradan silinse bile); `src/pages/CheckIn.tsx` sunumu metne değil `code`'a dayansın (alan yoksa bugünkü metin eşlemesine düşsün).

## Bağlam (önce oku)
Repo `/Users/emreaydin/ngsaccess`. Convex kodundan önce `convex/_generated/ai/guidelines.md`. Audit: `/tmp/pub-p5/AUDIT-flows.md` §SHL-26 ve RR-04 (satır ~60-80),
plan `docs/ui-scan/public/P5_PLAN.md`. Kod: `convex/employeeCheckIn.ts` (`checkInWithToken`), `convex/lib/checkInUx.ts` (`checkInTokenState`, TTL), `src/pages/CheckIn.tsx`
(`checkInPresentation`), `src/pages/CheckIn.test.tsx`. Kural: `CLAUDE.md`.

## Yapılacaklar
1. Backend: başarısız dönüşler `{ success:false, code:'invalid_token'|'expired_token'|'employee_not_found', error:<bugünkü Türkçe metin aynen> }` (eski web metinle çalışmaya devam eder).
   `returns` validator'ı tanımlıysa güncelle; yoksa ekleme zorunlu değil.
2. Tekrar yanıtı: ilk tüketimde konum bilgisini ve çalışan adını token kaydına yaz (ör. `checkInTokens`'a opsiyonel `locationRecorded`, `employeeName` alanı — `convex/schema.ts`'te OPSİYONEL alan olarak; mevcut kayıtlar bozulmaz),
   `state==='completed'` dalı bu alanlardan yanıt versin ve çalışan lookup'ından ÖNCE dönsün. Yeni tüketim yolunun davranışı (usedAt patch + tek cardReadings insert) aynı kalsın.
3. Frontend: `checkInPresentation` önce `code`'a baksın (`invalid_token`/`expired_token` → invalid sunumu, `employee_not_found` → rejected), `code` yoksa bugünkü metin eşlemesi.
4. Test: `convex/employeeCheckIn.test.ts` (repo'da convex test deseni varsa onu kullan: `ls convex/**/*.test.ts`, ör. `convex/lib/*.test.ts`) — saf mantık için `convex/lib/checkInUx.ts`'e
   sonuç kurucu yardımcı çıkarıp test etmek kabul; `src/pages/CheckIn.test.tsx`'e `code` eşleme testleri.

## Ownership (YALNIZ bunlar)
`convex/employeeCheckIn.ts`, `convex/lib/checkInUx.ts` (+ test), `convex/schema.ts` (YALNIZ `checkInTokens` tablosuna opsiyonel alan — başka oturumlar bu dosyada çalışıyor: yalnız kendi satırlarını ekle,
mevcut satırlara dokunma, `git diff convex/schema.ts`'te yalnız senin hunk'ın olmalı), `src/pages/CheckIn.tsx`, `src/pages/CheckIn.test.tsx`, yeni `convex/employeeCheckIn.test.ts`.
Paralel worker: W-ui `index.html`, `src/hooks/useDarkMode.ts`, `src/main.tsx`, `src/lib/themeBootstrap*`, `src/pages/Register.tsx`, `src/components/ui/logo.tsx`, `src/components/public/*` — DOKUNMA.

## YASAK
`npx convex …` (deploy/codegen dahil — deploy koordinatörde, Emre onayıyla) · commit/push · canlı DB/Convex/Supabase · `package.json` · arka planda açık sunucu.

## Kapılar (kendin koş)
1. `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` + `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` (varsa) → Ownership'te 0 hata (kapsam dışı hatayı düzeltme, raporla).
2. `node_modules/.bin/eslint convex/employeeCheckIn.ts convex/lib src/pages/CheckIn.tsx` → 0. 3. `node_modules/.bin/vitest run convex src/pages/CheckIn.test.tsx` → Ownership testleri yeşil.
4. Geriye uyumluluk notu: eski web ↔ yeni backend, yeni web ↔ eski backend davranışı (rapora).

## Rapor
`worker_done` ≤8 satır: file:line değişiklikler, şema eki, test sayısı, kapılar, uyumluluk notu. Ayrıntı `/tmp/pub-p5/fix-qr.md`.
