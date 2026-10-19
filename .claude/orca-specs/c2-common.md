# Faz C2 — ortak kurallar (A2 yeni arayüz: sayfalar)
Repo: /Users/emreaydin/ngsaccess (main; son commit 84b9663 = C1 canlı). Plan: `docs/ui-scan/PLAN.md` (Faz C2), sentez
`docs/ui-scan/00_OZET.md` (§4 dosya sahipliği, §5 ürün varsayılanları).
- Tasarım dili kesin: `docs/ui-scan/DESIGN_DIRECTION.md` (token, ölçek, kabuk, sayfa kalıbı, YASAKLAR). Sayfa hedefi:
  `docs/ui-scan/pages/NN-slug/REPORT.md` + `mockup.html` (A2'de etkileşimli; dosyayı tarayıcıda açıp bakabilirsin).
- **C1 hazır, YENİDEN YAZMA:** kabuk (Layout, sidebar, üst çubuk, ⌘K, mobil Sheet) ve ortak bileşenler PageHeader, StatInline,
  FilterBar, BulkBar, SaveBar, RowActions, StatusBadge, EmptyState, ErrorState, SectionSkeleton, Sheet, DatePicker,
  PasswordField, UnsavedChangesDialog/useUnsavedChangesGuard, QuerySectionBoundary, FormFieldWrapper. API'leri:
  `docs/ux-audit/DESIGN_SYSTEM.md` ("A2 bileşenleri" ve öncesi). Ortak bileşen eksikse kendi sayfa klasöründe yerel
  bileşen yaz; `src/components/ui/**`, `src/components/shared/**`, `src/components/layout/**`, `src/index.css` DEĞİŞMEZ
  (gerekiyorsa DUR, `ask`).
- Kademeli canlıya çıkış: sayfan bitince tek başına canlıya çıkar; diğer sayfalar eski halinde kalır. Paylaşılan hook/bileşen
  sözleşmesini (başka sayfanın import ettiği) kırma.
- Önceki dalgaların veri doğruluğu düzeltmelerini (proje kapsamı, nullable patch, ConfirmDestructive, notify, useAsyncAction,
  pending/çift gönderim koruması, URL state) GERİ ALMA. Görsel refactor ≠ davranış silme.
- Proje kuralları CLAUDE.md: `any`/`as any` yok, `!` yok, Convex sonuç tipi `FunctionReturnType<typeof api.X.Y>`, form tipi
  `z.infer`, backend camelCase, `filter((p): p is NonNullable<typeof p> => p !== null)`. Toast = `notify` (sonner); yeni
  `useToast` yok. Sabit renk (`text-red-500`, `bg-blue-50`, hex) ve emoji yok → A2 semantik token'ları.
  Convex koduna dokunacaksan önce `convex/_generated/ai/guidelines.md` oku.
- Metinler Türkçe, düz; teknik ayrıntı ikinci seviyede. Erişilebilirlik: label↔input, ikon düğmelerine aria-label, görünür
  focus, klavye ile açılan satır/hücre, `role=status`/`role=alert`.
- Aynı çalışma ağacında paralel başka worker'lar var; YALNIZ kendi Ownership listene yaz. Liste dışı dosya gerekiyorsa DUR,
  `ask`. Ara tsc'de başkasının dosyasından gelen hata seninki değil; raporda "kendi/diğerleri" ayır.
- `convex/schema.ts` koordinatörde; index/alan gerekiyorsa `ask` (gerekçe + tam index tanımı). `convex/_generated/api.d.ts`:
  yeni Convex modülü eklersen ilgili import/satırları elle ekleyebilirsin (yalnız kendi modülün).
- commit/push/deploy/migration/DB yazma YOK. Ağdan paket kurma YOK.
- Kapılar (kendin koş): `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` · `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` ·
  `node_modules/.bin/eslint src convex` · `npx vitest run` · (frontend) `npx vite build`.
- Görsel kontrol (frontend): dev sunucu localhost:8081 çalışıyor olabilir ama oturum yok; mockup ile kıyası koordinatör
  gerçek oturumla yapar. Sen 1440 ve 390 genişlikte yatay taşma olmadığını kod düzeyinde garanti et (min-w-0, overflow
  yalnız tablo kabında).
- Rapor: `worker_done` ≤10 satır: ne yapıldı (file:line), kapı sonuçları, koordinatörün ekranda bakması gerekenler, açık riskler.
