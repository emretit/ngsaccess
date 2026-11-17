# Plan — Hafta tatili vardiya planından gelsin (Çalışma günleri ayarı kalkar)

## Checklist
### Faz 0 — Hazırlık (~10 dk)
- [x] Audit: Claude + bağımsız Codex K3 (`/tmp/calisma-gunleri-audit-{claude,codex}.md`); canlı veri 2 atama, 0 departman ataması
- [x] Kararlar: **K1** seçilmeyen gün her zaman hafta tatili · **K2** tatil gününde çalışma atanmış vardiyanın kurallarıyla
- [x] Kompakt PDKS Ayarları commit: 1b1be4ee (2026-10-30)
- [x] Orca run run_94ca9aae5f1b + spec dosyaları `.claude/orca-specs/hafta-tatili-W{1,2,3}.md`

### Faz 1 — Uygulama (Orca worker'ları, ~3–4 sa)
- [x] **W1** Backend semantiği — BİTTİ (tsc convex 0, kabul 1–5 yeşil) · ctx_388c8bc00964
- [x] **W3** Arayüz — BİTTİ (src tsc 0, vitest 336/336) · ctx_bcd606619b97
- [x] **W2** SGK + raporlar + temizlik + migration — BİTTİ (vitest 5278/5278, tsc 0, eslint 0) · ctx_f1f9de79ed68

### Faz 2 — Kapı + denetim (~1 sa) · BİTTİ: son kapı vitest 485/5284, tsc 0/0, eslint 0, leak 0
- [x] Koordinatör kapısı: tsc app 0 · tsc convex 0 · eslint 0 · reflog temiz · TAM vitest 485/5278 · find-node-leak temiz
- [x] Claude `sonnet medium` denetçi — ENGEL yok, 2 düzeltilmeli (/tmp/hafta-tatili-denetim.md)
- [x] Düzeltmeler: Fix1 BİTTİ (rest etiketi, mergePdksDays, shiftAssign skipped), vitest 5284

### Faz 3 — Yayın (Emre onayıyla, ~20 dk)
- [x] Commit 4a7c1004 → export /tmp/ngs-pub-b5211bc9 → `npx convex dev --once` (2026-11-04 11:36 TR)
- [x] Migration `backfillWeeklyWorkingDays` 2/2, tekrar dryRun 0
- [x] Netlify deploy 2026-11-04 11:38 TR (index-DFBpOIyA.js)
- [x] Orca canlı tur 5/5 GEÇTİ (2026-11-04) + memory/doküman güncel — BİTTİ

---

## Context
Bugün "hafta tatili" iki yerden geliyor. Döngü planlarında boş gün tatil sayılıyor. Haftalık planda ise vardiya
her güne uygulanıyor; Cumartesi/Pazar'ı proje geneli "Çalışma günleri" ayarı belirliyor
(`convex/lib/shiftResolver.ts:138` calendar "project"). Bu ikilik iki hataya yol açıyor:
- SGK eksik gün, döngü planındaki tatili eksik gün sayabiliyor (`convex/lib/sgkEksikGun.ts:41-50`).
- Raporlar "vardiya gün düzeni kullanılmıyor" uyarısı basıyor (`convex/lib/reportAttendance.ts:70-84`).

Hedef: Hik'teki gibi kişinin haftalık düzeni vardiya planında olsun. Seçilmeyen gün hafta tatili olsun,
proje ayarı kalksın. Canlı veride bordro değişmesin.

## Tasarım (tek kural)
- **Haftalık plan haftanın tamamına sahip (K1).** `weekPattern` içindeki gün iş günüdür (`calendar: "plan"`).
  Seçilmeyen gün `{ kind: "rest" }` olur; artık null dönüp sonraki kişisel atamaya ya da departmana düşmez.
- **Tatil gününün hesap bağlamı (K2):** `DayPlan` rest varyantına `shifts: Doc<"shifts">[]` eklenir.
  - Haftalık plan: o planın vardiyaları.
  - Döngü planı: tüm dolu slotlar aynı vardiya setiyse o set, değilse `[]` (bugünkü davranış).
  - Tatil gününde okutma olursa hesap bu vardiyalarla, `dayKind: "rest"` ile yapılır. Bu, bugünkü haftalık
    Cumartesi hesabının birebir aynısı (mola, FM açık/kapalı, gece, `holidayWorkRequired` korunur).
- **`calendar: "project"` kalkar.** Gün türü artık yalnız tatil takvimi + plan `dayKind`'ından gelir;
  `workingDays` hiçbir hesapta okunmaz.
- **Gece yarısında böl modu korunur:** `nightShiftDayMode = splitAtMidnight` iken gece yarısından sonraki kısmın
  gün türü, ertesi tarihin plan türünden (rest → hafta tatili) alınır. Bugünkü anchor davranışı
  (`pdksDay.ts:208` yorumu) yalnız `shiftStart` modunda kalır.
- **Boş `weekPattern` yazımı reddedilir:** yeni haftalık atamada en az bir gün seçilmeli; 7 gün = her gün çalışma.
  Eski boş satırlar migration ile Pzt–Cum'a çevrilir.

## W1 — Backend semantiği (ownership)
`convex/lib/shiftPlan.ts`, `convex/lib/shiftResolver.ts`, `convex/lib/pdksMultiShift.ts`, `convex/lib/pdksDay.ts`,
`convex/lib/pdksTable.ts`, `convex/lib/pdksDetail.ts`, `convex/lib/pdksPayroll.ts`, `convex/lib/cardReadingProcess.ts`,
`convex/shiftPlans.ts` (planCells), `convex/lib/shiftAssign.ts` + bu dosyaların testleri.
1. `slotForDate` (`shiftPlan.ts:31`): haftalık/eski satırda seçilmeyen gün `[]` döner. Boş pattern = 7 gün.
   `validatePlanStructure`/normalizasyon: haftalık yazımda boş `weekPattern` hata verir.
2. `rowPlan` (`shiftResolver.ts:129-139`): rest varyantına bağlam `shifts` eklenir; haftalık dolu gün `calendar: "plan"`.
   `DayPlan` tipinden `"project"` çıkar. `resolve`/`resolveLast` rest'te bağlam vardiyasını döner (bugünkü
   haftalık Cumartesi davranışı); `resolvePlan.kind` rest kalır.
3. `computePdksPlannedDay` (`pdksMultiShift.ts:110-130`): rest + bağlam vardiyası → aynı tekli/çoklu yol,
   `dayKind: "rest"`, sonuçta `planKind: "rest"`. `mergePdksDays:103` rest'te `attendanceDecision` silinir.
4. `pdksDay.ts:207-215`: `classify` = tatil ? tatil sınıfı : dayKind; `workingDays` param kalkar.
   splitAtMidnight için `nextDayKind` paramı (çağıran `resolvePlan(date+1)` ile verir).
5. `cardReadingProcess.ts:65`: rest'te bağlam vardiyasının sonuncusu döner (gece yön çıkarımı korunur).
6. `shiftAssign.ts` çakışma: aynı kişide tarih aralığı kesişen iki haftalık atama artık "üstünü örtme" uyarısı verir
   (yalnız saat kesişimi değil). Departman önizleme sayacı (`shiftPlans.ts:53-65`) rest'i override sayar.

## W3 — Arayüz (ownership, W1 ile paralel)
`src/components/shifts/{AssignmentPatternEditor,AssignShiftDialog,AssignmentEditDialog,ShiftDayDetails,WeekdaySelection}.tsx`,
`src/components/shifts/assignmentFormSchema.ts`, `src/components/shifts/lib/{planForm,calendarOverlays,planning}.ts`,
`src/components/pdks/settings/{PdksSettingsPanel,WorkingDaysSettings}.tsx`, `src/components/settings/sections/hooks/useGeneralSettings.ts` + testleri.
1. Atama formu: "Belirli günler" kutusu + "Her gün uygulanır" kalkar. `WeekdaySelection` hep görünür, varsayılan Pzt–Cum.
   Açıklama: "Seçilmeyen günler hafta tatili sayılır." `specificDays` alanı kalkar, `weekPattern` zorunlu (≥1 gün).
2. 14 günlük önizleme: seçilmeyen gün "Uygulanmaz" yerine "Hafta tatili".
3. `ShiftDayDetails.tsx:65`: "Boş gün (döngü)" → "Hafta tatili"; seri özeti "Her gün" yerine seçili günler.
4. `calendarOverlays`: çalışma aralığı (gece kuyruğu) ile takvim sahipliği ayrı fonksiyon; çakışma uyarısı sahipliği kullanır.
5. PDKS Ayarları: `WorkingDaysSettings` kartı ve dosyası kalkar. Sağ sütunda yalnız Tatil takvimi kalır.
   Sol üstte tek satır not: "Hafta tatili günleri vardiya planında seçilir." (Vardiya planı linki `?plan=1`.)
6. `auditLabels.ts` `workingDays` etiketi geçmiş loglar için KALIR.

## W2 — SGK + raporlar + temizlik + migration (ownership, W1'den sonra)
`convex/lib/sgkEksikGun.ts`, `convex/sgkExport.ts`, `convex/lib/reportAttendance.ts`, `convex/lib/reportScope.ts`,
`convex/dashboard.ts`, `convex/mobileAttendance.ts`, `convex/cardReadings.ts`, `convex/lib/pdksTableQuery.ts`,
`convex/lib/pdksPayrollQuery.ts`, `convex/settings.ts`, `convex/schema.ts` (yalnız index), `convex/migrations.ts` + testleri.
1. SGK: `calculateSgkEksikGun` `workingDays` yerine `restDays: ReadonlySet<string>` alır. Plan rest günü,
   tatil ve çalışılan gün eksik sayılmaz. Vardiyasız gün mevcut kuralla çalışılmış sayılır (`sgkExport.ts:104-110`).
2. Raporlar: `hasUnsupportedShiftCalendar` ve uyarı metni silinir (`reportAttendance.ts:70-84,131`).
   **2026-10-30 DARALTMA:** keşif değişikliği uygulanmadı (43 legacy test kırığı); legacy yol korunur, eski rapor sayıları değişmez.
   Keşif (`reportScope.ts:111`): projede tarih aralığında herhangi bir `shiftAssignments` varsa yönetilen motora girer.
   Yeni index `shiftAssignments.by_project_end ["projectId","endDate"]`.
3. `dashboard.ts:363-381`: sabit Pzt–Cum `classifyDay` kalkar. Planlı günler zaten `usesPlanDayRules` ile yönetilir;
   kalan döngü plan dışı günleri atlar.
4. `workingDays` parametre zinciri kalkar: `pdksTableQuery.ts:147`, `pdksPayrollQuery.ts:101`, `cardReadings.ts:661`,
   `mobileAttendance.ts:168`, `reportAttendance.ts:101,372`, `sgkExport.ts:113`. Test fixture'ları güncellenir.
5. `settings.ts`: `getWorkingDays`/`saveWorkingDays` kalkar; genel ayar mutation'ı `workingDays` kabul etmez.
   Şema alanı `generalSettings.workingDays` optional olarak KALIR (narrow sonra, ayrı iş).
6. Migration `migrations:backfillWeeklyWorkingDays({ dryRun })` (`convex/migrations.ts` kalıbı):
   - Kapsam: `shiftAssignments` + `departmentShiftAssignments` içinde plan yok ya da `weekly` olan ve `weekPattern` boş satırlar.
   - Yazılan değer: projenin `workingDays`'i kod formatında (Pazartesi→MON …), boşsa MON..FRI.
   - `updatedAt` DEĞİŞMEZ (öncelik sırası korunur). İdempotent. Dönüş: `{ scanned, wouldUpdate, updated, rows }`.

## Yeniden kullanılacaklar
- `storedWorkingDays`, `WEEKDAY_NAMES` (`convex/lib/workingDays.ts`): migration'da proje günlerini okumak için.
- `WEEKDAYS` kodları (`convex/lib/shiftPlan.ts:10`), `WeekdaySelection` bileşeni (zaten var).
- `usesPlanDayRules` (`pdksMultiShift.ts:28`): değişmeden tüm planlı günleri yönetilen motora alır.
- Migration kalıbı: `convex/migrations.ts` `clearShiftColors` (dryRun + sayım).

## Kabul testleri (W1/W2 yazar, denetçi okur)
1. Pzt–Cum plan, Cumartesi okutma yok → HT, DV değil. Cumartesi 09–17, vardiya molası 30 dk → 450 dk hafta tatili FM
   (bugünkü fixture ile aynı sonuç).
2. `overtimeEnabled=false` vardiya, Cumartesi çalışma → FM 0 (korunur).
3. Cuma 22–06 gece vardiyası: `shiftStart` modunda tamamı Cuma; `splitAtMidnight` modunda 00–06 hafta tatili.
4. Tatil Cumartesiye denk → RT; `holidayWorkRequired` bağlam vardiyasından okunur.
5. Kişisel Pzt–Cum plan + departman planı → Cumartesi kişinin tatili (departmana düşmez). İki kişisel atama
   kesişince uyarı çıkar.
6. SGK: döngüde Çarşamba tatil → eksik gün değil; çalışılmayan iş günü (Pazartesi) → eksik gün.
7. Düz haftalık atamalı proje raporlarda yönetilen motora girer; uyumsuzluk uyarısı yok.
8. Migration: dry-run 2 satır, gerçek koşum sonrası tekrar 0 (idempotent), `updatedAt` aynı.

## Doğrulama
- Kapılar: `node_modules/.bin/tsc --noEmit -p tsconfig.app.json`, `node_modules/.bin/tsc --noEmit -p convex`,
  `node_modules/.bin/eslint src convex`, `node_modules/.bin/vitest run` (TAM), `node scripts/find-node-leak.mjs`.
- Yayın sonrası Orca turu (kendi sekmem):
  - "emre" projesinde PDKS tablosunda Cumartesi/Pazar HT görünüyor.
  - Vardiya planı Sheet'inde haftalık seride Cumartesi/Pazar "Hafta tatili".
  - Atama formu Pzt–Cum seçili açılıyor.
  - PDKS Ayarları'nda Çalışma günleri kartı yok.
  - Raporlar → Aylık Durum'da uyarı yok.

## Riskler (kabul edildi)
- Hesap canlı yapılıyor; geçmiş aylar yeni kuralla yeniden hesaplanır. Migration Pzt–Cum'u koruduğu ve K2 bağlamı
  aynı olduğu için canlıdaki 2 atamada fark yok. Bu yüzden tarihli sürümleme yapılmıyor (Codex önerisi, veriye göre gereksiz).
- Convex yayını ile migration arasındaki ~1 dk'da boş pattern'li 2 satır 7 gün iş günü görünür; kalıcı yazım yok.
- Eski web istemcisi (web yayınına kadar) boş pattern gönderirse backend reddeder; yayınlar arka arkaya yapılır.
- Kapsam dışı: eski legacy rapor yolunun silinmesi, `generalSettings.workingDays` alanının şemadan kaldırılması,
  departman/grup bazlı hafta sonu kuralı.
