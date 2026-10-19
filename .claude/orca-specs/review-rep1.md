# Denetim — Raporlar Dalga 1 (SALT OKUMA)
Repo: /Users/emreaydin/ngsaccess. Önce `CLAUDE.md`, `.claude/orca-specs/rep1-common.md`, `rep1-api.md`, `rep1-ui.md` oku; worker raporları `.claude/orca-specs/reports/rep1-{api,ui}.md`.
Kod Codex worker'larınca yazıldı; sen bağımsız denetçisin. Raporlara değil DİFF'e ve kendi koştuğun kapılara dayan.

**Hedef:** Raporlar D1 değişikliğindeki gerçek hataları (doğruluk, güvenlik/yetki, KVKK, kota, erişilebilirlik) önem sırasıyla, dosya:satır + somut senaryo ile raporla.

## Kapsam (yalnız bunları denetle)
- `git diff -- convex/cardReadings.ts convex/lib/reportAttendance.ts convex/lib/reportAttendance.test.ts src/App.tsx src/components/Layout.tsx src/components/layout/AppSidebarNav.tsx src/components/layout/navigationSearch.test.ts src/lib/routeMeta.ts`
- Yeni dosyalar: `src/lib/reports/**`, `src/components/reports/**`, `src/pages/Reports.tsx`
- Bağlam için okunur (denetim dışı): `convex/lib/pdksTable.ts` (gün hücresi `detail`), `convex/lib/pdksSource.ts`, `convex/lib/pdksPayroll.ts`, `src/lib/pdksDateRanges.ts`, `src/lib/date.ts`.

## Odak
1. **Yetki/kapsam:** `listReportTransactions` başka projenin satırını sızdırabilir mi; `resolveProjectScope`; employeeId/proje uyumu; Resmi grubu rol kontrolü.
2. **KVKK:** biyometrik okuma Ham Okutmalar'a veya günlük/aylık raporlara herhangi bir yoldan girebilir mi; metinler hukuki iddia kuruyor mu.
3. **Tarih/saat:** TR günü (UTC+3) — presetler, `from/to` → sorgu argümanı, `formatTransactionTime`, ay sınırları, hafta başı Pazartesi; tarayıcı TZ'si UTC olsa da doğru mu; ≤31 gün engeli gerçekten sorguyu durduruyor mu.
4. **Cursor snapshot reducer** (`src/lib/reports/transactions.ts` + kullanımı): yinelenen/kaybolan satır, sonsuz döngü, filtre değişince eski sayfa karışması, `isDone` yanlışlığı, boş aday sayfada "Daha fazla" takılması.
5. **Kota/performans:** gereksiz abonelik, her render'da yeni args objesi → yeniden abonelik, aylık+günlük sorgular aynı anda açık mı, 31 gün × kişi sayısı tabloda render maliyeti.
6. **Export:** CSV formül enjeksiyonu (`=,+,-,@` koruması), BOM/ayraç, yalnız görünür kolon; PDF canvas yaklaşımı büyük tabloda bellek/sayfa sorunları.
7. **Tip/kurallar:** `any`/`as any`, `!`, `filter(Boolean)`, `as` ile tip zorlama; A2 dili (token renk, `useToast` yok); 390px; erişilebilirlik (`th scope`, klavye, `aria-current`, `nav aria-label`).
8. **Sidebar** (koordinatör yazdı — aynı titizlikle denetle): alt menü aktiflik, mobilde kapanma, ikon modunda davranış.

## Kapılar (kendin koş, çıktısını rapora koy)
`node_modules/.bin/tsc --noEmit -p tsconfig.app.json` · `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` · `node_modules/.bin/eslint src/lib/reports src/components/reports src/pages/Reports.tsx src/components/layout convex/cardReadings.ts convex/lib/reportAttendance.ts` ·
`node_modules/.bin/vitest run src/lib/reports src/components/reports src/components/layout convex/lib/reportAttendance.test.ts`.

## Kurallar
- SALT OKUMA: hiçbir dosyaya yazma (rapor dosyası hariç). commit/push/deploy YOK, `npx convex` YOK, canlı DB YOK, paket kurma YOK, dev server açma YOK.
- Bulgu formatı: `[KRİTİK|YÜKSEK|ORTA|DÜŞÜK] dosya:satır — sorun — somut senaryo (girdi → yanlış çıktı) — önerilen düzeltme (1-2 satır)`. Emin olmadığını "OLASI" diye işaretle.
  Stil/zevk bulgusu yazma; yalnız davranışı etkileyenler. En fazla 15 bulgu, önem sırasıyla.
- Rapor: `.claude/orca-specs/reports/review-rep1.md` + `worker_done` ≤10 satır (KRİTİK/YÜKSEK sayısı + ilk 3 bulgu).
