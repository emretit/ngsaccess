# S0 denetimi — zaman şablonlarının kaldırılması

**Karar: Geçti** (Engel/Önemli bulgu yok; yalnız 3 küçük temizlik notu).

Kendi koşum: `vitest run convex/lib/accessSchedule.test.ts convex/doorPlans.test.ts convex/accessGrantStatus.test.ts src/components/access-control` → 29 dosya / 231 test yeşil. `eslint` (S0 dosyaları) → 0 hata, 0 uyarı. Repo geneli grep (docs/.claude hariç) şablon sembolleri → 0.

## Doğrulananlar
- `effectiveSchedule(rule)` (`convex/lib/accessSchedule.ts:46`): eski şablonsuz dal birebir korunmuş; yalnız `scheduleTemplateId` dalı ve `ScheduleTemplate` tipi kalkmış. `ideRuleSegments`, `defaultRuleSchedule` (hikSync.ts:55), `hikSyncEmployee.ts`, `hikQueueWorker.ts:211`, `grantRuleScope` (grantStatus.ts:39) aynı fonksiyonu şablonsuz çağırıyor → Hik hafta planı / IDE segmenti çıktısı değişmez.
- `isRuleOpenAt` / `mobileRuleAllows`: şablonsuz yol (saat/gün karşılaştırması) değişmedi; yalnız şablon dalı silindi.
- `grantStale` artık yalnız `rules.map(updatedAt)`; şablon tarihleri hesaptan çıktı (istenen davranış).
- `accessRules.ts` create/update/saveWithGroups, `accessRuleWrite.ts`: `assertIdeScheduleCapacity` ve `validateScheduleBinding` HEAD'de yalnız şablon koşullu çağrılıyordu → şablonsuz kural akışı aynı. `update` içindeki `planAffected` / IDE yeniden-sync koşullarından yalnız `scheduleTemplateId` terimi çıkmış.
- `doors.ts updatePlans/update/listPlanTargets`: şablon dalları temiz silinmiş; `statusChanged` artık yalnız plan karşılaştırması. Web `bulk.ts` `hikDoorStatusTemplateId: null` göndermeyi bırakmış (aksi halde arg doğrulama hatası verirdi).
- `convex/lib/ruleDevices.ts`: `boundedScheduleRows` + `scheduleRuleDevices` HEAD'deki kodla birebir (diff yok); `ideSync.ts` ve `deviceSyncRuns.ts` yeni yoldan import ediyor.
- `api.d.ts`: tam 2 sil (`accessScheduleTemplates` import + map) / 2 ekle (`lib_ruleDevices` import + map).
- `schema.ts`: tablo, `by_template`, `hikDoorStatusTemplate*`, `templateId`, `template_sync` kalkmış; `deviceSyncRuns.ts`'te `createTemplateRun/loadTemplateTarget/enqueueTemplateTarget/executeTemplateTarget` ve `latestForRule` dalı silinmiş; `adminGuards` proje-silme matrisinden tablo satırı çıkmış (tablo yok → tutarlı).
- Web: `useRuleForm.ts` / `useAccessRuleSchema.ts` payload'ında `scheduleMode/scheduleTemplateId` yok; `loadRuleEditor` testi uyumlu. Eski `?tab=templates` linki `UnifiedAccessControl.tsx:17-20` fallback'iyle varsayılan sekmeye düşer (kırık sayfa yok).
- "Ziyaretçi şablonu" (`isTemplate`, `RuleRow`/`AccessRuleDetails` metinleri) ve parmak izi şablonuna dokunulmamış.
- Veri kaybı riski: şablon tablosu/alanları canlıda 0 satır (koordinatör teyidi); deploy'da şema doğrulaması bu yüzden geçer. Not: deploy öncesi bu sayım tekrar alınmalı — alan bir satırda kalmışsa `convex dev --once` şema hatasıyla durur.

## Bulgular

| # | Önem | file:line | Sorun | Öneri |
|---|------|-----------|-------|-------|
| 1 | Küçük | `src/components/access-control/door-plans/DoorPlanDialog.tsx` (tüm dosya, ~245 satır) | Şablon silmeyle ilgisiz Prettier yeniden biçimlendirmesi (holiday listesi, butonlar, `formatHolidayDate`); diff'i okunmaz hale getiriyor. | Commit'te olduğu gibi bırak ya da ayrı `chore:` commit'e böl; davranış farkı yok. |
| 2 | Küçük | `src/components/access-control/unified/rules-list/RuleRow.tsx:78,103,172` | Şablon dalı kalkınca artık gereksiz `<>…</>` fragment'leri ve ilgisiz `SheetTitle` yeniden biçimlendirmesi kaldı. | Fragment'leri aç (`<>` sar yok); davranış etkilenmez. |
| 3 | Küçük | `src/components/access-control/door-plans/CopyDoorPlansDialog.tsx` (önizleme `<section>`, ~satır 195) | Aynı: tek çocuklu gereksiz `<>` fragment. | Fragment'i kaldır. |

Başka kırık/ölü kod bulunmadı (`MAX_MEMBERS`, `refreshDelay`, `skippedReason` vb. `deviceSyncRuns.ts`'te hâlâ kullanılıyor).
