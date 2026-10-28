# Hik raporları — Faz 2 (Aylık Özet) SALT-OKUMA denetimi

Sen denetçisin: HİÇBİR dosyaya yazma (rapor dosyası hariç). `git add/commit/stash/checkout/reset/restore` YOK, `npx convex` YOK, DB YOK.
Ağaçta başka oturumların commit'siz işi ve paralel çalışan iki worker var (Faz 3: `src/lib/reports/excel/statusMatrix.ts` + `registry.ts`;
Faz 4: `src/lib/reports/excel/personSheets.ts`) — bu dosyalardaki DEVAM EDEN değişiklikleri denetleme, yalnız Faz 2'nin kendi işine bak.

## Kapsam
Faz 2 diff'i (Faz 1 Mola değişiklikleri zaten denetlendi; `git diff` çıktısında onları ayırt et):
`src/lib/reports/personMonth.ts` · `personMonth.test.ts` · `personMonthExcel.test.ts` · `src/lib/reports/excel/common.ts` · `excel/personBlocks.ts` ·
`src/lib/reports/{rows,registry,export}.ts` · `src/components/reports/{ReportScreen,ReportResults,ReportPage}.tsx` + testleri.
Worker raporu: `.claude/reports/hik-rapor-f2.md` (rapora değil koda ve kendi koştuğun kapıya güven). Spec: `.claude/orca-specs/hik-rapor-f2-aylik-ozet.md`.
Hik düzeni: `docs/hikconnect-reports/shots/attendance-summary.png`.

## Neye bak (öncelik sırasıyla)
1. **Toplam doğruluğu:** `PersonMonthTotals` mevcut `countAttendance` / ekran sayılarıyla çelişiyor mu (aynı gün iki kez, `incomplete`, `future`/`noData`/`notEmployed`, izin + hafta sonu, yarım gün tatil, fazla mesai dönem kuralı)?
2. **Ay filtresi:** `filters.includes('month')` genellemesi mevcut aylık (monthlyPayroll) ve günlük raporları bozuyor mu; ay değişince sorgu argümanları ve `queryKey` doğru mu; geçersiz ay; 31 gün sınırı.
3. **Excel (personBlocks):** birleştirme çakışması (exceljs aynı aralığı iki kez birleştirince hata atar), boş veri / tek kişi / 0 çift, departmansız kişi, izin türü kolonu yokken, 6+ çift "+k", formül nötrleştirme TÜM metin hücrelerinde (kişi adı, departman, vardiya adı, izin türü), dondurma/yazdırma, büyük veri (150 kişi × 31 gün) bellek/süre.
4. **Dağıtım:** `export.ts` ↔ `excel/*` döngüsel import (dinamik import yönü), exceljs'in statik import ile ana bundle'a girip girmediği (`import type` mı?), CSV'de `excelReportColumns` kullanımı, eski rapor çıktıları birebir aynı mı.
5. **Hacim:** `.claude/reports/hik-rapor-f2.md` hacim tablosunu `convex/lib/pdksTableQuery.ts` okuyarak (yazmadan) doğrula: 31 gün `includePunches` sorgusunda okuma sayısı ve dönüş boyutu Convex sınırlarına (`convex/_generated/ai/guidelines.md` + bilinen limitler) göre risk mi? Somut eşik öner.
6. Repo kuralları: `any`, `!`, `filter(Boolean)`, Türkçe metin, erişilebilirlik (yeni ay seçici etiketi).

## Kapılar (kendin koş)
`node_modules/.bin/tsc --noEmit -p tsconfig.app.json` · `node_modules/.bin/vitest run src/lib/reports src/components/reports` ·
`node_modules/.bin/vite build` (exceljs ayrı chunk'ta mı: build çıktısında ana `index-*.js` boyutunu ve exceljs chunk'ını yaz).

## Rapor
`.claude/reports/hik-rapor-f2-denetim.md`: her bulgu ENGEL / ÖNEMLİ / DÜŞÜK + file:line + somut senaryo (girdi → yanlış çıktı) + önerilen düzeltme.
Bulgu yoksa açıkça "ENGEL 0". `worker_done`'da ≤10 satır özet + `--report-path`.
