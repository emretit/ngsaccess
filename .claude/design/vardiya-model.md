# Vardiya Faz 2-4 — SENTEZ tasarım (otoriter) · 2026-10-23

Kaynaklar: `vardiya-model-claude.md` (TEMEL — ayrıntılar orada), `vardiya-model-codex.md` (aşağıdaki "Codex'ten alınanlar").
Bu dosya ikisiyle çelişirse bu dosya kazanır. Faz 1 commit'li: `8f57a2d9`.

## Checklist
- [x] Faz 1 commit `8f57a2d9`
- [x] Emre kararları (4 soru → öneriler kabul, 2026-10-23)
- [x] Sentez + paket sözleşmesi (bu dosya)
- [ ] Paket A — model + çözümleyici + atama API'si (Codex) → kapı → Claude denetim
- [ ] Paket B — hesap motoru (Codex) ∥ Paket C — arayüz (Codex) → kapı → denetim
- [ ] Birleştirme: tam kapı + Orca turu → commit (Emre) → yayın Convex (A+B birlikte) → web (C)

## 1. Emre kararları (kesin)
1. Döngüde boş slot = hafta tatili (`weekend`), dolu slot = iş günü (proje çalışma günlerini ezer). Haftalık/eski atamada proje `workingDays` aynen.
2. Çoklu vardiyada bir parça kaçırılırsa gün = **İncelenecek** (`incomplete`); hepsi kaçırılırsa `absent`; çalışılan parçanın süresi silinmez.
3. Günde **≤8 vardiya**, ardışık vardiyalar arası **≥30 dk** boşluk.
4. Departman geçmişi tutulmaz: kişi departman değiştirince geçmiş günler yeni departmanın planıyla hesaplanır. Departman değişikliği UI'ında uyarı (C).

## 2. Model kararı: Claude modeli (widen), Codex'in ayrı tablosu DEĞİL
- `shiftAssignments.plan?` (opsiyonel) + yeni `departmentShiftAssignments` + `shiftPlanRefs`. Backfill yok, narrow yok.
- Neden: mevcut atama CRUD'u, çakışma kontrolü, `clearAssignments`, takvim ve 30+ `resolve()` çağıranı tek tabloda kalır;
  Codex'in kendi riski #3 (iki kaynak → yönetim ekranında eksik liste, atomik dönüşüm) hiç doğmaz.
- Şema, validator, `slotForDate`, öncelik, `DayPlan` tipi: Claude tasarımı §1-§2 aynen; aşağıdaki farklarla.

## 3. Codex'ten alınanlar (Claude tasarımına ek/fark)
| Konu | Karar |
|---|---|
| Okuma sınırı | Her bounded okuma `take(limit+1)` sentinel; aşınca Türkçe ConvexError. **Kesik sonuç doğruymuş gibi dönmez.** |
| Departman zinciri | `parentId` boyunca derinlik ≤32, ziyaret kümesiyle döngü koruması; farklı projeye geçen parent'ta zincir durur. `level` alanına güvenilmez. |
| Slot içi sıra | Sunucu, günün vardiyalarını `startTime`'a göre (eşitse `_id`) sıralar; istemci sırası önemsiz. Birincil `shiftId` = sıralı ilk vardiya. Aynı vardiya bir günde iki kez olamaz. |
| Net süre | Parça netlerinin toplamı; ilk giriş–son çıkış farkı DEĞİL. Vardiyalar arası boşluk çalışma/mola sayılmaz. |
| Fazla mesai | Parça bazlı eşik; `overtimeSegments` birleşir, `calculatePeriodOvertime` kişi/dönem başına BİR kez. |
| Eşit `updatedAt` | Bugünkü davranış korunur (index sırasında stable sort) — test ile sabitlenir. |
| Mobil | Flutter değişmez; `mobileAttendance:summary` return validator'ı değişmez; `days[].date` takvim günü kalır. |

## 4. Bilinçli olarak ERTELENENLER (bu turda yapılmaz)
- Parça bazlı manuel düzeltme tablosu (`pdksShiftCorrections`). v1: manuel giriş → ilk parça, çıkış → son parça (Claude §3.4). Bilinen sınır, gün detayında not.
- Esnek + sabit aynı gün: **yasak** (ConvexError "Esnek vardiya başka vardiyayla aynı güne konamaz").
- Çoklu sabitte `validWindow` zorunluluğu: **yok**. Bölme sırası: pencere → yön (exit önceki/entry sonraki) → orta nokta (Claude §3.3). Belirsiz/pencere dışı → parça incelenecek, okutma silinmez.
- Planlı dinlenme gününde okutma: bugünkü hafta sonu çalışması davranışı (ayrı `unplannedWork` yok).
- `shifts.collect()` kaldırma, sayfalı yeni PDKS endpoint'i, departman üyelik geçmişi.

## 5. Paket sözleşmesi (A'nın B ve C'ye verdiği arayüz — değişmez)
### 5.1 `convex/lib/shiftPlan.ts` (yeni, saf)
`MAX_SHIFTS_PER_DAY=8`, `MIN_SPLIT_GAP_MINUTES=30`, `MAX_DAY_CYCLE=31`, `MAX_WEEK_CYCLE=52`, `shiftPlanValidator`, `ShiftPlan`, `daySlotValidator`,
`slotForDate(row, date): Id<"shifts">[] | null` (null = eşleşmez → alt katman; `[]` = dinlenme), `validateDayShifts(shifts)`, `validateShiftPlan(...)`,
`planShiftIds(plan)` (refs için tekilleştirilmiş liste).

### 5.2 `convex/lib/shiftResolver.ts`
```ts
export type DayPlan =
  | { kind: "shifts"; shifts: Doc<"shifts">[]; source: "employee" | "department" | "default"; calendar: "project" | "plan";
      assignmentId?: Id<"shiftAssignments">; departmentAssignmentId?: Id<"departmentShiftAssignments">; departmentId?: Id<"departments"> }
  | { kind: "rest"; source: "employee" | "department"; calendar: "plan";
      assignmentId?: Id<"shiftAssignments">; departmentAssignmentId?: Id<"departmentShiftAssignments">; departmentId?: Id<"departments"> }
  | { kind: "none"; source: "project" };
export interface ShiftResolver {
  resolve(employeeId, dateISO): Doc<"shifts"> | null;      // planın İLK vardiyası; rest/none → null (eski imza)
  resolveLast(employeeId, dateISO): Doc<"shifts"> | null;  // planın SON vardiyası (gece kuyruğu)
  resolvePlan(employeeId, dateISO): DayPlan;               // memo'lu (emp|date)
  shifts: Map<string, Doc<"shifts">>;
}
```
`buildShiftResolver` / `buildBoundedShiftResolver` imzaları geriye uyumlu (opsiyonel `range?: {start,end}` eklenebilir), departman katmanını içerir.
`calendar: "plan"` yalnız dayCycle/weekCycle günlerinde.

### 5.3 Public API (A yazar, C tüketir)
Mevcut `convex/shifts.ts`:
- `listAssignments` + `includePlans?: boolean` (verilmezse `plan` taşıyan satırlar DÖNMEZ — eski web güvenliği).
- `previewBulkAssign` / `bulkAssignShift` / `updateAssignment` + `plan?: ShiftPlan` (update'te verilmezse saklı plan korunur).
- `remove` (vardiya tanımı silme) ve `definitionImpacts`/`definitionUsage`: `shiftPlanRefs` + departman atamalarını da sayar.
Yeni `convex/shiftPlans.ts` (`_generated/api.d.ts`'e elle import + fullApi satırı):
- `listDepartmentAssignments({ projectId })` · `previewDepartmentAssign({ projectId, departmentId, shiftId, startDate, endDate, weekPattern?, plan? })`
  → `{ employeeCount, personalOverrideCount, sameDepartmentConflicts: [...], leaveCount, holidayCount }`
- `assignDepartment({ ...aynı, forceConfirm? })` · `updateDepartmentAssignment({ departmentAssignmentId, ...opsiyonel alanlar, forceConfirm? })` · `removeDepartmentAssignment({ departmentAssignmentId })`
- `planCells({ projectId, employeeIds (≤50), rangeStart, rangeEnd (≤42 gün) })` → `{ employeeId, date, kind: "shifts"|"rest"|"none", source, shiftIds, assignmentId?, departmentAssignmentId?, departmentId? }[]`
Hepsi `schedule.manage` (yazma) / proje kapsamı (okuma); `departments.remove` departman ataması varsa engeller.

## 6. Paketler ve ownership (ayrık)
| Paket | Ownership | Not |
|---|---|---|
| A | `convex/schema.ts` (yalnız shiftAssignments + 2 yeni tablo), `convex/lib/shiftPlan.ts` (yeni), `convex/lib/shiftResolver.ts`, `convex/lib/shiftAssign.ts`, `convex/lib/shiftUx.ts`, `convex/shifts.ts`, `convex/shiftPlans.ts` (yeni), `convex/departments.ts`, `convex/lib/cardReadingProcess.ts` (`directionShift` → ortak çözümleyici), `convex/_generated/api.d.ts` (yalnız 2 satır), testleri | Faz 2+3+4'ün şema/çözümleme kısmının tamamı |
| B | `convex/lib/pdksDay.ts`, `pdksMultiShift.ts` (yeni), `pdksWorkDay.ts`, `pdksTable.ts`, `pdksPayroll.ts`, `pdksDetail.ts`, `pdksTableQuery.ts`, `pdksPayrollQuery.ts`, `pdksManualWrite.ts`, `reportAttendance.ts`, `reportScope.ts`, `processCardReadingCore.ts`, `convex/cardReadings.ts`, `convex/pdksRecords.ts`, `convex/dashboard.ts`, `convex/mobileAttendance.ts`, testleri | Claude §3 tablosu; `segments` DTO'su |
| C | `src/components/shifts/**` (definitions hariç), `src/components/pdks/dashboard/*`, `src/components/pdks/lib/presentation.ts`, departman düzenleme ekranındaki uyarı, testleri | Claude §4 |
Sıra: A → (B ∥ C). A+B aynı Convex yayınında (döngü verisi B'siz boş günü devamsız sayar). C, B'nin `segments` DTO'su için B'den sonra son entegrasyon yapar.
