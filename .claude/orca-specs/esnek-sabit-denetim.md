# Denetim — Esnek↔Sabit vardiya eşitleme + renk kaldırma + geçerlilik tarihli sürüm (READ-ONLY)

## Hedef
Çalışma dizinindeki commit'lenmemiş değişikliği doğruluk açısından denetle ve bulguları
`/tmp/esnek-sabit-denetim.md` dosyasına yaz (Engel / Önemli / Düşük; her bulgu: file:line, somut senaryo → yanlış sonuç, önerilen düzeltme).

## Ownership
YALNIZ `/tmp/esnek-sabit-denetim.md` yazılır. Kaynak dosyalara, testlere, şemaya YAZMA.

## YASAK (açık komut yasağı)
`git add`, `git commit`, `git stash`, `git reset`, `git checkout`, `git restore` ÇALIŞTIRMA.
`npx convex dev|deploy|run|codegen`, `npm install`, DB yazma, Supabase MCP YOK. Commit/push/deploy/migration YOK.

## Kapsam (diff: `git diff HEAD -- <dosya>`; yeni dosyalar untracked)
- Backend: convex/schema.ts, convex/shifts.ts, convex/migrations.ts (clearShiftColors), convex/lib/shiftVersions.ts (YENİ),
  convex/lib/shiftResolver.ts, convex/lib/cardReadingProcess.ts, convex/lib/pdksDay.ts, convex/lib/pdksFixedRules.ts,
  convex/lib/pdksFlexible.ts, convex/lib/shiftPlan.ts, convex/lib/shiftUx.ts, convex/lib/auditLogQuery.ts
- Frontend: src/components/shifts/** (AddShiftDialog, shiftFormSchema, useShiftDefinitionActions, ShiftTree, ShiftCalendarCell,
  RotationEditor, AssignmentPatternEditor, lib/shiftColors.ts SİLİNDİ), src/components/pdks/dashboard/{PDKSTableView,PDKSMobileCardList,
  PDKSEmployeeDetailDrawer,PdksFlexibleTarget(YENİ)}.tsx, src/components/pdks/lib/presentation.ts,
  src/lib/reports/{personMonth,rows,registry}.ts, src/lib/reports/excel/{personBlocks,personSheets}.ts
- Testler: convex/shiftVersions.integration.test.ts (YENİ), convex/lib/shiftVersions.test.ts (YENİ), değişen *.test.ts dosyaları
- Plan/karar: .claude/plan-esnek-sabit.md

## Kapsam dışı
src/components/devices/DeviceAddMenu.tsx, src/components/shared/PageHeader.tsx (başka oturumun işi) ve diğer ilgisiz değişiklikler.

## Odak (öncelik sırası)
1. **Geçerlilik tarihli sürüm**: `shifts` belgesi = bugünden itibaren geçerli değerler; `shiftVersions.validUntil` (dahil) eski değerlerin anlık görüntüsü.
   `update` (effectiveFrom yoksa bugün; gelecek reddedilir; son sınırdan geriye dönülemez; aynı başlangıçla ikinci düzenleme yeni sürüm açmaz;
   tür değişikliği reddedilir; esnekte startTime/endTime pencereden türetilir; stableJson karşılaştırması). Kenar durumları ve yarış koşulları.
2. **Çözümleyiciyi atlayan okumalar**: PDKS tablo/detay/bordro/rapor/dashboard/mobil/yön tahmini/geç e-postası/elle giriş yollarında vardiya
   belgesini doğrudan okuyup GEÇMİŞ günü GÜNCEL kuralla hesaplayan yer var mı? (`resolver.shifts` haritası güncel belgedir; `shiftAt` tarihli.)
   Kapılar: `hasFixedShiftRules` artık `versionedUntil` varsa true — bunun yan etkisi/eksik kalan kapı var mı?
3. **Esnekte en az net çalışma + resmi tatil kuralı** (pdksDay `absentByFixedRule`, `holidayFor`; `validateFixedRules`): esnekte başka bir
   yerin "esnekte sabit kural yok" varsayımı bozuldu mu?
4. **Plan doğrulaması** (`shiftPlan.validateNextDay`): esnek → sabit ardışık gün kontrolü doğru mu, ters yön/çok vardiyalı gün atlanıyor mu?
5. **Renk kaldırma geçişi**: eski web (renk gönderen) yeni backend'de bozulur mu; şemada `color` geçiş için duruyor; migration idempotent mi.
6. **UI/rapor**: dialogdaki tarih alanı ve tür değişikliği akışı; rapor/Excel esnek toplamları; sabit-yalnız projede boş sütun.

## Kapılar (isteğe bağlı, salt-okuma)
`node_modules/.bin/vitest run <dosya>` ve `node_modules/.bin/tsc --noEmit -p convex` koşabilirsin (dosya yazmazlar).

## Rapor
`worker_done` özetinde ≤10 satır: Engel/Önemli/Düşük sayıları + en kritik 3 bulgu file:line. Ayrıntı `/tmp/esnek-sabit-denetim.md`'de.
