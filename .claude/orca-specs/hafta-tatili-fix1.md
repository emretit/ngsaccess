# Fix1 — Hafta tatili denetim düzeltmeleri (2 DÜZELTİLMELİ + 1 NOT)

## Hedef (test edilebilir)
Denetim raporu `/tmp/hafta-tatili-denetim.md` "DÜZELTİLMELİ" 1–2 ve NOT 3'teki `shiftAssign` sapması düzeltilir; her biri
için test eklenir; TAM vitest + tsc (app + convex) + eslint yeşil kalır.

## Bağlam
Plan: `.claude/plan-calisma-gunleri-vardiya.md`. Önce denetim raporunu oku (DÜZELTİLMELİ + NOT 3).
Kural: eski davranış korunur, test beklentisi değiştirilmez (yalnız yeni test eklenir).

## Yapılacaklar
1. PDKS arayüzünde rest günü etiketi: `src/components/pdks/lib/presentation.ts` `planDayLabel` rest için
   "Boş gün (döngü)" yerine "Hafta tatili" (döngü ve haftalık rest ikisi de hafta tatilidir). `PdksPlanSummary.tsx:9`
   "Boş gün" → "Hafta tatili". `PDKSEmployeeDetailDrawer.tsx:167`: rest günü bağlam vardiyası varsa "Vardiya: X"
   satırı gizlenmesin ya da "Hafta tatili · X vardiyası kuralları" gibi kısa gösterim; sade tut. Aria etiketi (`presentation.ts:131`) aynı metni kullansın.
   İlgili src testlerini güncelle/ekle ("Boş gün (döngü)" metnini bekleyen testler varsa yeni metne).
2. `convex/lib/pdksMultiShift.ts:103` `mergePdksDays`: `attendanceDecision` silme koşulu eski davranışa dönsün —
   yalnız haftalık (`origin === "weekly"`) ve iş günü olmayan birleşik günde silinir; döngü/departman çoklu vardiyalı günde
   tatil/rest olsa da karar KALIR. Test: iki vardiyalı döngü planı + resmi tatil → `attendanceDecision` tanımlı;
   haftalık çoklu + rest → tanımsız.
3. `convex/lib/shiftAssign.ts:69`: silinen erken dönüşü geri getir — tarih aralığında seçili güne denk gelen hiç gün yoksa
   sonuç yine `skipped` ("Seçilen günlere denk gelen tarih yok"), atama oluşmaz. Test: Pzt–Cum desen + yalnız Cumartesi
   aralığı → skipped.

## Ownership
`src/components/pdks/lib/presentation.ts`, `src/components/pdks/PdksPlanSummary.tsx` (yolu doğrula),
`src/components/pdks/PDKSEmployeeDetailDrawer.tsx` (yolu doğrula), `convex/lib/pdksMultiShift.ts`, `convex/lib/shiftAssign.ts`
+ bunların test dosyaları.

## Kapılar
- `node_modules/.bin/tsc --noEmit -p convex` ve `node_modules/.bin/tsc --noEmit -p tsconfig.app.json`
- `node_modules/.bin/vitest run` (TAM)
- `node_modules/.bin/eslint <değişen dosyalar>`

## Rapor yolu
`/tmp/hafta-tatili-fix1-rapor.md`
## Bağlam (önce oku)
- Onaylı plan: `.claude/plan-calisma-gunleri-vardiya.md` ("Tasarım" + kendi W bölümün + "Kabul testleri"). Plan otoritedir.
- Audit raporları: `/tmp/calisma-gunleri-audit-codex.md`, `/tmp/calisma-gunleri-audit-claude.md`.
- Kararlar (Emre): K1 haftalık planda seçilmeyen gün HER ZAMAN hafta tatili (rest), alt atamaya/departmana düşmez.
  K2 tatil gününde okutma varsa hesap atanmış vardiyanın kurallarıyla (mola, FM açık/kapalı, gece, holidayWorkRequired) yapılır.
- Proje kuralları: `CLAUDE.md` (any/as any yasak, `!` yerine erken return, Convex alanları camelCase,
  `filter((p): p is NonNullable<typeof p> => p !== null)`), Convex kodu için önce `convex/_generated/ai/guidelines.md`.
- Aynı çalışma dizininde başka worker'lar paralel çalışıyor: YALNIZ kendi ownership listendeki dosyalara yaz.
  Ownership dışı bir dosyada değişiklik gerekiyorsa yazma, `ask` ile koordinatöre sor.

## Yasaklar
- `git add`, `git commit`, `git stash`, `git reset`, `git checkout`, `git restore` ÇALIŞTIRMA.
- `npx convex dev|deploy|run|import|codegen` ÇALIŞTIRMA; DB yazma yok; Supabase/MCP araçlarını KULLANMA.
- Yeni npm paketi ekleme.

## Rapor
- Ayrıntılı rapor dosyası (yol aşağıda): değişen dosyalar, her davranış değişikliği file:line, eklenen testler,
  kapı çıktılarının son satırları, açık kalan sorular.
- `worker_done` özeti ≤10 satır, file:line ile; `--report-path` ver.
