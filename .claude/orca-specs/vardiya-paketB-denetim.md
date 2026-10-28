# Vardiya Paket B (hesap motoru) — denetim (salt okuma, Claude)

## Hedef
Paket B diff'ini sözleşmeye, Emre kararlarına ve değişmezliğe göre denetle; rapor `.claude/review-vardiya-paketB.md`.

## Oku
1. `.claude/design/vardiya-model.md` (OTORİTER), `.claude/orca-specs/vardiya-paketB-motor.md` (spec), `.claude/design/vardiya-model-claude.md` §3, §5, §7.
2. Diff: `git diff -- convex/lib/pdks* convex/lib/reportAttendance.ts convex/lib/reportScope.ts convex/lib/processCardReadingCore.ts convex/cardReadings.ts convex/pdksRecords.ts convex/dashboard.ts convex/mobileAttendance.ts`
   + yeni `convex/lib/pdksMultiShift.ts` ve yeni testler. Paket A (commit'siz, kabul edildi) ve C1 (`src/**`) dosyalarını denetleme.
3. `convex/_generated/ai/guidelines.md`, proje `CLAUDE.md`.

## Bak (öncelik sırası)
1. **Değişmezlik:** 0-1 vardiyalı günde sonuç birebir mi (altın testler gerçekten `toStrictEqual` ve eski fixture ile mi)? Mevcut test beklentisi değişmiş/silinmiş mi?
2. **Emre kararları:** döngü boş gün = weekend (devamsız değil), dolu gün = workday; kaçırılan parça = incomplete; hepsi kaçırılırsa absent; çalışılan parça süresi korunuyor mu.
3. **Bölme/birleştirme:** pencere → yön → orta nokta; bir okutma iki parçaya girmiyor; net süre = parça toplamı; mola parça bazlı; `calculatePeriodOvertime` kişi/dönem başına bir kez.
4. **Tutarlılık:** tablo = detay = bordro = rapor = dashboard = mobil aynı günü aynı sayıyor mu? Kalan `.resolve(` çağıranları (`rg "\.resolve\("`) çoklu/rest gününde yanlış sayıyor mu?
5. **DTO:** `segments`/`planKind` yalnız ≥2 vardiyada/rest gününde; mobil `summary` return validator değişmemiş; validator'lı query dönüşleri opsiyonel alanla uyumlu.
6. Ownership dışı dosya; `any`/`as any`/`!`; Node import; performans (resolvePlan memo, gün başına DB okuması yok).

## Koş
`node_modules/.bin/vitest run convex` ve `node scripts/find-node-leak.mjs`. Tam kapıyı koordinatör koşar.

## Kurallar
Salt okuma: kod DEĞİŞTİRME. Yalnız `.claude/review-vardiya-paketB.md` yaz. git yazma komutu ve `npx convex` YASAK.

## Rapor biçimi (dosya)
Türkçe, sade. Başta 1-2 cümle özet. Bölümler: Engel / Önemli / Düşük (her madde `file:line` + sorun + somut düzeltme) / Kontrol edilenler (sorun yok).
`worker_done` ≤10 satır: bulgu sayıları + en kritik 3 madde.
