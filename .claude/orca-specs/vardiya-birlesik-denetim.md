# Vardiya Faz 2-4 — BİRLEŞİK son denetim (salt okuma, Claude)

## Hedef
A+B+C1+C2 commit'siz diff'ini (HEAD `8f57a2d9` üstü) tek parça olarak denetle; rapor `.claude/review-vardiya-birlesik.md`.
Ana soru: **planı olmayan / 0-1 vardiyalı projede canlıdaki davranış birebir korunuyor mu?** İkinci soru: yeni özellik uçtan uca tutarlı mı?

## Oku
1. `.claude/design/vardiya-model.md` (OTORİTER; §1 Emre kararları, §3-§4), gerekirse `.claude/design/vardiya-model-claude.md`.
2. Önceki denetimler + yanıtlar (tekrar raporlama, yalnız kapanmamışsa yaz): `.claude/review-vardiya-paketA.md`, `-paketB.md` (sonda "Worker yanıtı"), `-paketC.md`; C2 raporu `.claude/reports/vardiya-c2-report.md`.
3. Diff: `git diff -- convex src` + izlenmeyen yeni dosyalar (`git status --short convex src | grep '^??'`).
   KAPSAM DIŞI: `docs/**`, `brand/**`, `todo.md`, `.claude/**`. C2 hiç denetlenmedi → `src/components/pdks/**` ve `src/lib/shiftExport*` öncelikli.
4. `convex/_generated/ai/guidelines.md`, proje `CLAUDE.md`.

## Bak (öncelik sırası)
1. **Değişmezlik (en önemli):** plan/departman ataması olmayan projede tablo, detay, bordro, rapor, dashboard, mobil özet, okutma işleme (`processCardReadingCore`) eski kodla aynı sonucu mu veriyor? Altın/eşdeğerlik testleri gerçekten eski fixture + `toStrictEqual` mi? Mevcut test beklentisi değiştirilmiş/silinmiş mi (`git diff -- '*.test.ts*'` içinde `-  expect` satırları)?
2. **Yetki:** yeni/değişen mutation/query'ler (`convex/shiftPlans.ts`, `convex/shifts.ts`, `convex/departments.ts`, `convex/employees.ts`, `convex/lib/adminGuards.ts`) proje üyeliği + rol kontrolü yapıyor mu; başka projenin departmanına/vardiyasına referans verilebiliyor mu (IDOR (başkasının kaydına kimlik değiştirerek erişme))?
3. **Emre kararları:** döngü boş=weekend/dolu=workday; kaçırılan parça=incomplete, hepsi=absent; ≤8 vardiya, ara ≥30 dk; esnek+sabit aynı gün yasak; departman değişikliği uyarısı UI'da var mı.
4. **Tutarlılık:** aynı kişi-gün tablo = detay = bordro = rapor = dashboard = mobil aynı durumu ve süreyi mi veriyor? Kalan `.resolve(` çağıranları (`rg "\.resolve\(" convex`) plan/rest gününde yanlış sayıyor mu?
5. **UI (C1+C2):** form zod şeması ↔ backend validator uyumu; boş/yükleniyor/hata durumları; `PlanQueryBoundary`; segment gösterimi tek vardiyada gizli mi; Türkçe metin; `any`/`as any`/`!`; CLAUDE.md tablo satır tıklama kuralı (`src/lib/tableRowClick.ts`) yeni tablolarda uygulanmış mı.
6. Performans: gün başına DB okuması yok, bounded okumalar `take(limit+1)` sentinel; Node import yok (`"use node"` tuzağı).

## Koş
`node_modules/.bin/vitest run` ve `node scripts/find-node-leak.mjs` (tam kapıyı koordinatör de koştu: tsc×2 0, eslint 0 hata, vitest 374/4135, leak 0).

## Kurallar
Salt okuma: kod DEĞİŞTİRME. Yalnız `.claude/review-vardiya-birlesik.md` yaz.
YASAK: `git add/commit/stash/reset/checkout/switch/restore/worktree`, `npx convex` (codegen dahil), DB yazma, dev server başlatma.

## Rapor biçimi (dosya)
Türkçe, sade. Başta 1-2 cümle özet (commit'e hazır mı?). Bölümler: Engel / Önemli / Düşük (her madde `file:line` + sorun + somut düzeltme + hangi paket: A/B/C1/C2) / Kontrol edilenler (sorun yok).
`worker_done` ≤10 satır: bulgu sayıları + en kritik 3 madde.
