# Faz C3 — ortak kurallar (süpürme + kapanış)
Repo: /Users/emreaydin/ngsaccess, HEAD `dca4da4` (C2c canlı; tüm 13 sayfa A2'de). ÖNCE `CLAUDE.md` ve Convex işi varsa
`convex/_generated/ai/guidelines.md` oku. Tasarım dili `docs/ui-scan/DESIGN_DIRECTION.md`; A2 ortak bileşenleri `docs/ux-audit/DESIGN_SYSTEM.md`.

- Paralel worker'lar aynı ağaçta; Ownership listeleri ayrık. Listende olmayan dosyaya YAZMA — gerekiyorsa `ask` ile sor.
  `convex/_generated/api.d.ts` ortak: yalnız kendi yeni modül satırlarını ekle. `convex/schema.ts` koordinatörde (gerekirse `ask` + TAM tanım).
- Canlıdaki frontend yeni backend'le de çalışmalı: mevcut query/mutation imzalarını KIRMA; yeni ihtiyaç = yeni fonksiyon veya OPSİYONEL arg.
- Ortak parçaları kullan, yeniden yazma: `notify` (`src/lib/notify.ts`), `useAsyncAction`, `ConfirmDestructive`, `useUnsavedChangesGuard`,
  `useProjectChangeGuard` (`src/contexts/ActiveProjectContext.tsx`, DEĞİŞMEZ), `QuerySectionBoundary`, `resolveProjectScope`, `nullablePatch/toPatch`.
- Yarış kontrolü kalıbı (C2c'de `convex/devices.ts` `expectedAssignedProjectId`): istemci açılıştaki değeri gönderir, sunucu canlı değerle
  karşılaştırır, farklıysa hiçbir şey yazmadan `ConvexError({ code, message })`; arg verilmezse eski davranış aynen.
- Router v7 dersi: URL↔state senkronlayan `useEffect` yeni açılan paneli kapatabilir; URL değişimini ref ile izle ya da tek kaynak URL.
- A2 yasakları: sabit renk/hex/palet sınıfı (`bg-red-500` vb. → token: `text-destructive`, `bg-muted`, `statusTone`), emoji, gradyan,
  kart-içinde-kart, `useToast` (→ `notify`). Durum renkleri için `src/lib/statusTone.ts`'e bak.
- Kapılar (hepsi yeşil olmadan worker_done YOK): `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` · `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` ·
  `node_modules/.bin/eslint src convex` 0 hata · `npx vitest run` yeşil (yeni saf mantık için test) · `npx vite build` · `git diff --check`.
- YASAK: commit/push/deploy/migration/DB yazma; `npx convex` koşma; paket kurma; uygulamaya giriş.
- Rapor: `.claude/orca-specs/reports/c3-<ad>.md` (değişen dosya:satır → ne değişti; yeni/değişen fonksiyonların TAM arg+dönüş tipi; koordinatörün
  gerçek oturumda 1440+390 bakması gereken akışlar; bilerek ertelenenler) + `worker_done` ≤10 satır.
