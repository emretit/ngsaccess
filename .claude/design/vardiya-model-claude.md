# Vardiya Faz 2-4 — birleşik planlama modeli (Claude tasarımı, 2026-10-23)

## Checklist
- [x] Kod okundu: shiftResolver, pdksDay/WorkDay/Flexible/PunchPairs/Table/Payroll/Detail, reportAttendance, shifts.ts, shiftAssign/shiftUx, calendar, mobil
- [x] 1 Veri modeli · 2 Çözümleme · 3 Hesap motoru · 4 Arayüz · 5 Mobil · 6 Paketler · 7 Test + risk
- [ ] Emre kararları (en altta "Açık sorular")

## 0. Üç ana karar
1. **Yalnız genişletme (widen), backfill YOK.** `shiftAssignments` tablosuna tek opsiyonel alan `plan` + yeni tablo
   `departmentShiftAssignments` + referans tablosu `shiftPlanRefs`. `plan` yoksa satırın anlamı bugünküyle aynı:
   `[shiftId]`, `weekPattern` günlerinde. `employeeId` zorunlu kalır (opsiyonel yapmak ~15 dosyayı bozardı).
2. **Tek giriş noktası `resolvePlan(emp, date) → DayPlan`; eski `resolve()` aynen kalır** (= planın ilk vardiyası, boş gün → null).
   Mevcut 30+ çağıran (dashboard, pdksWorkDay, notifyLateReading…) değişmeden derlenir; çoklu vardiyayı yalnız 3 hesap girişi kullanır.
3. **Çoklu vardiya = günü böl, her parçayı mevcut `computePdksDay` ile hesapla, sonuçları birleştir.**
   Planda 0-1 vardiya varsa `computePdksDay` doğrudan çağrılır → tek vardiyalı sonuçlar birebir aynı (yapısal olarak).

---

## 1. Veri modeli

### 1.1 Ortak validator — yeni `convex/lib/shiftPlan.ts`
```ts
import { v, type Infer } from "convex/values";

export const MAX_SHIFTS_PER_DAY = 8;      // Hik parity (günde ≤8 timetable)
export const MIN_SPLIT_GAP_MINUTES = 30;  // bölünmüş vardiyalar arası en az boşluk
export const MAX_DAY_CYCLE = 31;          // Hik: 1–31 gün
export const MAX_WEEK_CYCLE = 52;         // Hik: 1–52 hafta

/** Bir günün vardiyaları; [] = boş gün (dinlenme). Başlangıca göre sıralı, çakışmasız. */
export const daySlotValidator = v.array(v.id("shifts"));

export const shiftPlanValidator = v.union(
  // Haftalık desen + günde çok vardiya. Gün seçimi mevcut `weekPattern` alanında kalır.
  v.object({ kind: v.literal("weekly"), shiftIds: v.array(v.id("shifts")) }),
  // N günlük döngü: slots.length = N (1..31). "2 sabah · 2 akşam · 2 boş" = [[S],[S],[A],[A],[],[]]
  v.object({ kind: v.literal("dayCycle"), anchorDate: v.string(), slots: v.array(daySlotValidator) }),
  // N haftalık döngü: slots.length = 7*N (1..52 hafta), anchorDate = başlangıç haftasının Pazartesi'si.
  v.object({ kind: v.literal("weekCycle"), anchorDate: v.string(), slots: v.array(daySlotValidator) }),
);
export type ShiftPlan = Infer<typeof shiftPlanValidator>;

/** Atama satırlarının ortak alanları (kişi + departman tablosu). */
export const shiftPlanFields = {
  shiftId: v.id("shifts"),                      // birincil vardiya: by_shift index'i + eski istemciler
  projectId: v.optional(v.id("projects")),
  startDate: v.string(),
  endDate: v.string(),
  weekPattern: v.optional(v.array(v.string())), // yalnız plan yok / plan.kind === "weekly"
  plan: v.optional(shiftPlanValidator),
  createdAt: v.string(),
  updatedAt: v.string(),
};
```

### 1.2 `convex/schema.ts`
```ts
shiftAssignments: defineTable({
  employeeId: v.id("employees"),
  ...shiftPlanFields,            // mevcut alanlar aynı + yeni opsiyonel `plan`
})
  .index("by_employee", ["employeeId"])
  .index("by_shift", ["shiftId"])
  .index("by_project", ["projectId"])
  .index("by_dates", ["startDate", "endDate"])
  .index("by_project_end", ["projectId", "endDate"])
  .index("by_employee_end", ["employeeId", "endDate"]),

// Faz 2: departman ataması (alt departmanlar miras alır; en yakın departman kazanır)
departmentShiftAssignments: defineTable({
  departmentId: v.id("departments"),
  ...shiftPlanFields,
  projectId: v.id("projects"),   // yeni tabloda zorunlu
})
  .index("by_department_end", ["departmentId", "endDate"])
  .index("by_project_end", ["projectId", "endDate"])
  .index("by_shift", ["shiftId"]),

// `plan` içindeki TÜM vardiyalar (birincil dahil) → silme/etki kontrolü index'le bulur.
shiftPlanRefs: defineTable({
  projectId: v.id("projects"),
  shiftId: v.id("shifts"),
  assignmentId: v.optional(v.id("shiftAssignments")),
  departmentAssignmentId: v.optional(v.id("departmentShiftAssignments")),
})
  .index("by_shift", ["shiftId"])
  .index("by_assignment", ["assignmentId"])
  .index("by_department_assignment", ["departmentAssignmentId"]),
```
Kurallar (mutasyonda doğrulanır, `validateShiftPlan` → `shiftPlan.ts`):
- `plan.kind === "weekly"`: `shiftIds[0] === shiftId`, 1..8 vardiya. Tek vardiyada `plan` YAZILMAZ (eski biçim korunur).
- Döngü: `weekPattern` boş olmalı; `shiftId` = slotlarda geçen ilk vardiya; en az bir dolu slot; `weekCycle` için `anchorDate` Pazartesi ve `slots.length % 7 === 0`.
- Gün içi: ≤8 vardiya, başlangıca göre sıralı, aralar ≥30 dk, yalnız SON vardiya gece taşabilir, ilk başlangıç → son bitiş ≤ 1440 dk.
- Esnek vardiya yalnız TEK başına bir günde olabilir (çoklu günde esnek → ConvexError "Esnek vardiya başka vardiyayla aynı güne konamaz").
- Tüm vardiyalar aynı proje + aktif. `plan` yazılan her satır için `shiftPlanRefs` aynı mutasyonda senkron (sil + yaz).

### 1.3 Widen → migrate → narrow
| Adım | Ne | Backfill |
|---|---|---|
| Widen | Yukarıdaki şema (yalnız ekleme) | Yok |
| Migrate | Yok: `plan` yok = bugünkü anlam; `employees.shiftId` yerinde kalır (öncelik 3) | Yok |
| Narrow | Yok; `plan` hiçbir zaman zorunlu olmaz | — |
`@convex-dev/migrations` gerekmez (kurulu da değil: `convex/convex.config.ts` yalnız rateLimiter). Yeni index'ler deploy'da kurulur.

Eski web + yeni backend: `listAssignments` yeni arg `includePlans?: boolean`; verilmezse `plan` taşıyan satırlar dönmez
(eski takvim döngü satırını "her gün birincil vardiya" diye yanlış çizmesin). `updateAssignment` arg'ında `plan` yoksa saklı `plan` korunur ve doğrulamada kullanılır.

---

## 2. Çözümleme algoritması — `convex/lib/shiftResolver.ts`

### 2.1 Tip
```ts
export type DayPlan =
  | { kind: "shifts"; shifts: Doc<"shifts">[]; source: "employee" | "department" | "default";
      calendar: "project" | "plan"; assignmentId?: Id<"shiftAssignments">;
      departmentAssignmentId?: Id<"departmentShiftAssignments">; departmentId?: Id<"departments"> }
  | { kind: "rest"; source: "employee" | "department"; calendar: "plan";
      assignmentId?: Id<"shiftAssignments">; departmentAssignmentId?: Id<"departmentShiftAssignments">; departmentId?: Id<"departments"> }
  | { kind: "none"; source: "project" };   // proje saatleri (bugünkü null)

export interface ShiftResolver {
  resolve(employeeId: Id<"employees">, dateISO: string): Doc<"shifts"> | null;       // ESKİ: ilk vardiya / null
  resolveLast(employeeId: Id<"employees">, dateISO: string): Doc<"shifts"> | null;   // gece kuyruğu için son vardiya
  resolvePlan(employeeId: Id<"employees">, dateISO: string): DayPlan;
  shifts: Map<string, Doc<"shifts">>;
}
```
`calendar: "plan"` yalnız döngü planlarında (gün tipi plandan gelir, bkz. 3.2). Haftalık/eski satırlar `"project"`.

### 2.2 Satır → gün (saf, `shiftPlan.ts`)
```ts
export function slotForDate(row: { startDate; endDate; weekPattern?; shiftId; plan? }, date: string): Id<"shifts">[] | null {
  if (date < row.startDate || date > row.endDate) return null;            // eşleşmez
  const p = row.plan;
  if (!p || p.kind === "weekly") {
    if (row.weekPattern?.length && !row.weekPattern.includes(weekdayCodeForDate(date))) return null; // eşleşmez → alt katmana düş (bugünkü davranış)
    return p ? p.shiftIds : [row.shiftId];
  }
  const n = p.slots.length;
  const i = ((daysBetween(p.anchorDate, date) % n) + n) % n;
  return p.slots[i];                                                       // [] = boş gün = EŞLEŞİR (alt katmana düşmez)
}
```

### 2.3 Öncelik (her tarih için ayrı)
1. **Kişi ataması:** kişinin satırları `updatedAt` azalan (bugünkü `shiftResolver.ts:65-68`); `slotForDate !== null` olan ilk satır kazanır.
2. **Departman ataması:** `chain = [kişinin departmanı, üstü, üstünün üstü…]` (önceden hesaplanır, derinlik ≤16, döngü koruması).
   Zincirde sırayla: o departmanın satırları `updatedAt` azalan, ilk eşleşen kazanır; eşleşen yoksa bir üst departmana geç.
3. **Kişi varsayılanı:** `employees.shiftId` → `{kind:"shifts", shifts:[s], source:"default", calendar:"project"}`.
4. **Proje saatleri:** `{kind:"none"}`.
Departmanın `projectId`'si kişi ile aynı değilse zincir orada kesilir. Vardiya Map'te yoksa (silinmiş) o satır atlanır (bugünkü `if (s)` davranışı).

Çakışma: aynı katmanda üst üste binen satırlar → en son güncellenen kazanır (bugünkü kural; atama anında `forceConfirm` akışı aynen).
Farklı katmanlar çakışmaz (tasarım gereği ezer); önizlemede "N kişide kişisel atama öncelikli" gösterilir.

### 2.4 Okuma sınırları
| Kaynak | Sorgu | Sınır |
|---|---|---|
| Kişi satırları | `by_employee` (bugünkü) / bounded: `take(1001)` | değişmez |
| Departmanlar | proje başına `departments.by_project` bir kez | `take(2001)`, aşarsa hata |
| Departman satırları | proje başına `departmentShiftAssignments.by_project_end` `gte(endDate, rangeStart-1)` | `take(2001)`; aralık yoksa `by_project_end` tamamı `take(2001)` |
| Vardiyalar | `buildShiftResolver`: bugünkü `shifts.collect()`; bounded: kişi + departman satırlarının `shiftId` + `plan` id'leri | — |
`buildShiftResolver(ctx, employees, range?)` / `buildBoundedShiftResolver(ctx, employees, range?)` opsiyonel `range` alır; vermeyen çağıranlar bugünkü gibi çalışır.

Performans (`pdksTable` 500 kişi × 62 gün): `resolvePlan` sonucu `Map<"emp|date", DayPlan>` memo'da tutulur
(`pdksWorkDay` her okutmada önceki/bugün için tekrar çağırıyor). Zincir departman başına bir kez hesaplanır. Döngü O(1). Ek DB okuması proje başına 2 sorgu.

---

## 3. Hesap motoru

### 3.1 Giriş noktaları (tek vardiya yolu dokunulmaz)
Yeni `convex/lib/pdksMultiShift.ts`:
```ts
export function computePdksPlannedDay(params: Omit<PdksDayParams, "shift"> & { plan: DayPlan }) {
  const shifts = params.plan.kind === "shifts" ? params.plan.shifts : [];
  const dayKind = params.plan.kind === "rest" ? "rest" : params.plan.kind === "shifts" && params.plan.calendar === "plan" ? "work" : undefined;
  if (shifts.length <= 1) return computePdksDay({ ...params, shift: shifts[0] ?? null, dayKind }); // BİREBİR eski yol
  const buckets = splitReadingsByShift(params.readings, params.date, shifts);
  const parts = shifts.map((shift, i) => computePdksDay({
    ...params, dayKind, shift, readings: buckets[i],
    manual: manualForSegment(params.manual, i, shifts.length), // giriş → ilk parça, çıkış → son parça
  }));
  return mergePdksDays(parts, shifts);
}
```
Değişecek çağrılar (her biri `plan` varsa yeni fonksiyonu, yoksa bugünküyle aynı):
| Yer | Bugün | Değişiklik |
|---|---|---|
| `convex/lib/pdksTable.ts:286-305` | `resolveShift` + `computePdksDay` | opsiyonel `resolvePlan` param; varsa `computePdksPlannedDay` |
| `convex/lib/pdksPayroll.ts:32` | `dayShift` | opsiyonel `dayPlan` |
| `convex/lib/pdksDetail.ts` (`computeAttendanceDetailDay`) | `dayShift` | opsiyonel `dayPlan` |
| `convex/lib/pdksDay.ts:198` (Faz 1 sonrası satır) | `classifyDay(date, workingDays, holiday)` | yeni opsiyonel `dayKind`: tatil yoksa `"rest"`→`"weekend"`, `"work"`→`"workday"`; `undefined` → bugünkü |
| `convex/lib/pdksWorkDay.ts:36` | `previous = resolve(emp, prevDate)` | opsiyonel `resolveLast`; `previous = (resolveLast ?? resolve)(…)`. Tek vardiyada first===last |
| `pdksWorkDay.ts:52,185` (`groupPdksWorkDays`, `buildPdksWorkDateResolver`) | — | `resolveLast` parametresini taşır |
| `convex/lib/pdksTableQuery.ts:113` | vardiya filtresi yalnız `e.shiftId` | aralıkta `resolvePlan` içinde vardiya geçen kişiler |
| `convex/cardReadings.ts:660`, `pdksPayrollQuery.ts:190` | `dayShift: resolve()` | `dayPlan: resolvePlan()` |
| `convex/lib/reportAttendance.ts:68-75` | `hasUnsupportedShiftCalendar` latest satır + weekPattern | `calendar === "plan"` günlerde uyarı yok |
| `convex/lib/cardReadingProcess.ts:44-60` (`directionShift`) | kendi kopya çözümleyicisi | ortak saf `resolveDayPlan` + departman satırları (bounded) → `last` vardiya |
| `convex/lib/processCardReadingCore.ts:465` (`notifyLateReading`) | ilk vardiya | okutma anına en yakın parçanın vardiyası (`shiftForInstant`) |
| `convex/dashboard.ts:267,312,331,416,478,548,649` | `resolve()` | boş gün sayımı için `resolvePlan().kind === "rest"` → devamsız sayma; geç sayımı `shiftForInstant` |

### 3.2 Boş gün / döngü gün tipi
Döngüde boş slot = hafta tatili: `classification = "weekend"` (tatil > boş gün; Faz 1 `holidayWorkRequired` tatil kuralı önce).
Döngüde dolu slot proje hafta sonuna denk gelse de `"workday"` (vardiyalı çalışanın takvimi plandır; hafta sonu primi uygulanmaz).
Haftalık planlar (eski + yeni çoklu) `dayKind = undefined` → proje `workingDays` aynen (bugünkü davranış ve uyarı).

### 3.3 Okutmaları parçalara bölme — `splitReadingsByShift`
Zaman çizgisi `pdksDay` ile aynı (vardiya günü 00:00 TR, gece bitişi +1440).
1. Faz 1 `validWindow` olan parçada: okutma o pencerenin içindeyse o parçaya.
2. İki parça arasındaki boşlukta: yön `exit` → önceki parça, `entry` → sonraki parça.
3. Yönsüz / pencere dışı: sınır = `önceki.bitiş + (sonraki.başlangıç − önceki.bitiş) / 2` (bugünkü gece kuralı `pdksWorkDay.ts:48` ile aynı orta nokta).
4. Pencere dışı kalan okutma parçaya yine girer; parça hesabı Faz 1 kuralıyla "incelenecek" işaretler (okutma silinmez).

### 3.4 Birleştirme — `mergePdksDays`
| Alan | Kural |
|---|---|
| `rawTotalMinutes, breakMinutes, totalMinutes, nightMinutes, rawNightMinutes, overtimeMinutes, nightOvertimeMinutes, lateMinutes, earlyExitMinutes` | toplam |
| `overtimeSegments` | birleştir (dönem fazla mesaisi `calculatePeriodOvertime` aynen çalışır) |
| `multiplier`, `overtimePayTRY` | ağırlıklı / toplam (hepsi null → null) |
| `firstISO` / `lastISO` | ilk dolu parçanın girişi / son dolu parçanın çıkışı |
| `isLate`, `isEarlyExit`, `exitNextDay`, `hasAttendance` | herhangi biri |
| `isOvernightShift` | son vardiya |
| `durationMeasured` | hepsi |
| `attendanceDecision` | parça kararı (`attendanceDecision ?? (hasAttendance ? durationMeasured ? present : incomplete : absent)`); hepsi present → `present`, hepsi absent → `absent`, karışık → `incomplete` (incelenecek) |
| `classification` | aynı (tarihe bağlı) |
| `segments` (YENİ, yalnız ≥2 vardiya) | `{shiftId, shiftName, plannedStart, plannedEnd, firstISO, lastISO, totalMinutes, lateMinutes, earlyExitMinutes, overtimeMinutes, decision}` |
Mola: her parça kendi vardiyasının molasını düşer; molası tanımsız parçada yasal mola parça süresine göre (bölünmüş vardiyanın arası zaten dinlenme).
Fazla mesai: her parça kendi `endTime + overtimeStartTolerance` eşiğinden; parçalar arası okutma 3.3 ile bir parçaya düşer, çift sayılmaz.
`classifyPdksDay` çağrısı (`pdksTable.ts:306`): `shiftStart` = ilk parça, `shiftEnd` = son parça, tolerans son parçanınki.
Manuel kayıt (`pdksRecords`): giriş ilk parçaya, çıkış son parçaya; `pdksManualWrite.ts:17` gece taşma kontrolü `resolveLast` ile.

### 3.5 Değişmezlik garantisi
- `plan.shifts.length ≤ 1` → `computePdksDay` aynı argümanlarla (yalnız `dayKind` undefined) → aynı nesne.
- `PdksDayDetail.segments` ve gün sonucu `segments` yalnız ≥2 vardiyada eklenir (DTO snapshot'ları değişmez; `flexibleMinuteFields` deseni).
- `resolve()` eski davranış: kişi satırı yoksa departman → varsayılan; departman satırı yoksa bugünkü sonuç birebir.

---

## 4. Arayüz

### 4.1 Atama diyaloğu — `AssignShiftDialog.tsx` (3 adım, mevcut önizleme akışı korunur)
1. **Kime:** segment kontrol `[Kişiler | Departman]`. Kişiler = bugünkü çoklu seçim (≤100).
   Departman = departman ağacından tek seçim; altında "Alt departmanlar da alır · 42 kişi · 5 kişide kişisel atama öncelikli".
2. **Desen:** `[Haftalık | Gün döngüsü | Hafta döngüsü]`
   - Haftalık: bugünkü `WeekdaySelection` + "Günün vardiyaları" çoklu seçici (1..8 satır, "+ Vardiya ekle"; çakışma/30 dk uyarısı satır altında).
   - Gün döngüsü: "Döngü uzunluğu" (1–31) + hızlı kurucu satırlar `[Vardiya ▾] × [2] gün` / `[Boş] × [2] gün` → slot şeridi (her slot tıklanınca vardiya(lar)/Boş).
     Örnek düğme: "2 sabah · 2 akşam · 2 boş".
   - Hafta döngüsü: "Hafta sayısı" (1–52) → N satır × 7 sütun ızgara (Pzt–Paz), hücre = vardiya(lar)/Boş.
   - Hepsinde canlı önizleme: başlangıç tarihinden itibaren 14 günlük renkli şerit.
3. **Önizleme:** Kişiler → bugünkü kişi bazlı karar listesi. Departman → özet (kişi sayısı, ezilen kişi, izin/tatil günü sayısı) + aynı departmanda çakışan satır varsa onay.

### 4.2 Takvim hücresi — `calendar/ShiftCalendarPlan.tsx`, `lib/planning.ts:cellData`
Veri: yeni sorgu `shifts.planCells({ projectId, employeeIds (≤50), rangeStart, rangeEnd })` → hücre başına
`{ employeeId, date, kind, source, shiftIds, assignmentId?, departmentAssignmentId?, departmentId?, conflict }` (≤50×42 = 2100 hücre).
İstemci kendi çözümleyicisini yazmaz (departman + döngü sunucuda).
| Durum | Görünüm |
|---|---|
| Kişi ataması | bugünkü dolu renkli çip |
| Departmandan | aynı renk, kesikli kenar + tooltip "Departmandan: Üretim" |
| Varsayılan vardiya | soluk çip |
| Boş gün (döngü) | gri tarama, "Boş" |
| Çoklu vardiya | ilk 2 çip + "+N"; tooltip'te tüm saatler |
| Çakışma | bugünkü kırmızı işaret (yalnız kişi katmanı) |
Hücre tıklaması: kaynağa göre kişi atamasını ya da departman atamasını düzenle (departman için "Bu kişi için değiştir" = kişi ataması oluşturur).
`ShiftTree.tsx`: vardiya seçiliyken PDKS filtresi `resolvePlan` tabanlı olur (3.1 tablo). `ShiftPlanSheet.tsx`: yeni "Departman atamaları" listesi (departman, desen özeti, tarih, sil/düzenle).

### 4.3 PDKS tablosu / gün detayı — `src/components/pdks/dashboard/*`
- Tablo hücresi (`PDKSTableView.tsx`, `PDKSHeatmapView.tsx`, `PDKSMobileCardList.tsx`): ≥2 vardiyada vardiya adı `"Sabah + Akşam"`, giriş/çıkış = ilk/son; küçük "2 vardiya" rozeti; karışık karar → "İncelenecek".
- Gün detayı (`PDKSEmployeeDetailDrawer.tsx`): `detail.segments` varsa parça başına satır: plan saatleri · giriş/çıkış · net · geç/erken · durum. Boş gün: "Boş gün (döngü)".
- `statusMeta.ts`: yeni durum YOK (karışık = mevcut `incomplete`).

---

## 5. Mobil etkisi
Kanıt (grep): `mobile/lib` vardiya API'si çağırmıyor; yalnız yorum/stub: `mobile/lib/providers/attendance_provider.dart:501-508`
(`hasShiftSummary => false`), `mobile/lib/core/attendance_date.dart:6`. Kullanılan API'ler: `mobileAttendance:listPage`, `mobileAttendance:summary`, `mobileAccess:*`, `mobileVisitors:*`.
- `mobileAttendance:summary` (`convex/mobileAttendance.ts:124-182`) sunucuda `buildBoundedShiftResolver` + `computePdksTableRow` kullanıyor; `returns` validator'ı sabit, dönen yalnız `presentDays`/`days` sayıları → **şema bozulmaz**.
- Gerekli: `buildBoundedShiftResolver` departman satırlarını (bounded, proje başına 1 sorgu) yüklemeli ve `resolvePlan` geçirilmeli; yoksa departman/döngü çalışanı mobilde farklı "geldi" günü görür.
- Flutter değişikliği YOK, mobil yayın gerekmez.

---

## 6. Uygulama paketleri (dosya ownership'i ayrık)
| Paket | Kapsam | Ownership | Bağımlılık | Süre |
|---|---|---|---|---|
| **A — Model + çözümleyici** | şema, `shiftPlan.ts`, `resolvePlan`/`resolveLast`/memo, departman atama CRUD + önizleme, `plan`'lı kişi ataması, `planCells`, `listAssignments.includePlans`, silme/etki kontrolleri (`shiftPlanRefs`), `directionShift` | `convex/schema.ts` (yalnız shiftAssignments + 2 yeni tablo), `convex/lib/shiftPlan.ts` (yeni), `convex/lib/shiftResolver.ts`, `convex/lib/shiftAssign.ts`, `convex/lib/shiftUx.ts` (plan-aware `scheduleIntervals`), `convex/shifts.ts`, `convex/departments.ts` (silme kontrolü), `convex/lib/adminGuards.ts`, `convex/lib/reportScope.ts`, `convex/lib/cardReadingProcess.ts`, testleri | Faz 1 commit'lendikten sonra (shiftResolver/shiftUx ortak) | ~6 sa |
| **B — Hesap motoru** | boş gün `dayKind`, `computePdksPlannedDay`, bölme/birleştirme, `resolveLast` taşıma, tüm hesap çağıranları, PDKS vardiya filtresi, dashboard, mobil özet | `convex/lib/pdksDay.ts`, `pdksMultiShift.ts` (yeni), `pdksWorkDay.ts`, `pdksTable.ts`, `pdksPayroll.ts`, `pdksDetail.ts`, `pdksTableQuery.ts`, `pdksPayrollQuery.ts`, `pdksManualWrite.ts`, `reportAttendance.ts`, `processCardReadingCore.ts`, `convex/cardReadings.ts`, `convex/pdksRecords.ts`, `convex/dashboard.ts`, `convex/mobileAttendance.ts`, testleri | A'nın `DayPlan` arayüzü (A bitince) | ~8 sa |
| **C — Arayüz** | diyalog 3 adım, döngü editörü, çoklu vardiya seçici, takvim hücresi, plan sheet departman listesi, PDKS hücre + gün detayı | `src/components/shifts/AssignShiftDialog.tsx`, `assignmentFormSchema.ts`, `WeekdaySelection.tsx`, yeni `RotationEditor.tsx` + `DayShiftsPicker.tsx` + `DepartmentTargetPicker.tsx`, `calendar/**`, `lib/planning.ts`, `lib/calendarOverlays.ts`, `ShiftTree.tsx`, `ShiftPlanSheet.tsx`, `src/components/pdks/dashboard/*`, `src/components/pdks/lib/presentation.ts`, testleri | A (API); gün detayı segment DTO'su için B | ~7 sa |
Sıra: A → (B ∥ C). Yayın: Convex (A+B birlikte) → web (C). A tek başına yayınlansa da güvenli (UI veri üretmez); ama döngü verisi B olmadan boş günü devamsız sayar → A+B ayrı yayınlanmaz.
Faz 2 erken istenirse: A + C'nin departman kısmı yeterli (departman ataması tek vardiyalı haftalık desende B'ye gerek yok).

---

## 7. Test planı
**Değişmezlik (en önemli):**
- Mevcut tüm vitest (tam `vitest run`, yalnız `convex` değil) değişmeden geçer.
- Altın test: mevcut `pdksDay`/`pdksTable` fixture'larında `computePdksPlannedDay({plan: {kind:"shifts", shifts:[s]}})` ≡ `computePdksDay({shift: s})` (`toStrictEqual`), `plan: none` ≡ `shift: null`.
- `computePdksTableRow` `resolvePlan` verilerek ve verilmeden aynı satır (departman/döngü yokken).
**Çözümleme (A):** kişi > departman > varsayılan > proje; alt departman miras; en yakın departman kazanır; yakın departmanın weekPattern'i o güne uymuyorsa üst departmana düşer;
departmana yeni giren kişi atama yazılmadan alır; dayCycle "2S·2A·2B" 12 gün; anchor öncesi tarih (negatif mod); weekCycle 2 hafta; boş slot alt katmana düşmez;
silinmiş vardiya atlanır; departman döngüsü (parent zinciri) sonsuz döngü yapmaz; okuma sınırı aşımı hata; `includePlans` yokken plan satırı dönmez; vardiya silinirken `shiftPlanRefs` engeller.
**Hesap (B):** 08-12 + 14-18 iki parça: tam katılım present, yalnız sabah → incomplete + segment absent; parça arası 13:00 yönsüz okutma orta nokta; exit/entry yön önceliği;
son parça gece (22-06) + ertesi gün kuyruğu `resolveLast`; fazla mesai parça bazlı + haftalık dönem; manuel giriş/çıkış ilk/son parçaya; Faz 1 `validWindow` parçada → incelenecek;
döngü boş günü weekend (devamsız değil), döngü dolu cumartesi workday; esnek + sabit aynı gün ConvexError; mobil `summary` departman çalışanında presentDays.
**Arayüz (C):** döngü kurucusu slot üretimi, 14 gün önizleme, departman önizleme özeti, hücre kaynak görünümü, Orca turu (takvim + PDKS detay).
Kapılar: `tsc -p tsconfig.app.json`, `tsc -p convex`, `eslint src convex`, `vitest run`, `node scripts/find-node-leak.mjs`.

## 8. Riskler (5)
1. **Departman geçmişi yok** (`employees.departmentId` anlık) → kişi departman değiştirince geçmiş günler yeni departmanın vardiyasıyla yeniden hesaplanır. Önlem: departman değiştirirken uyarı + kapanmış dönem için kişi atamasıyla sabitleme önerisi; gerekirse sonra `employeeDepartmentHistory`.
2. **Döngüde gün tipi plandan gelir** → hafta sonu primi/devamsızlık sonucu değişir. Önlem: yalnız döngü planlarında; haftalık/eski satırlar `dayKind` undefined; altın test + Emre kararı.
3. **Eski `resolve()` çağıranları çoklu günde yalnız ilk vardiyayı görür** (tsc yakalamaz). Önlem: B'deki çağıran tablosu (3.1) tam grep listesi; denetimde `rg "\.resolve\("` her satır işaretlenir.
4. **Bölünmüş vardiyada okutma belirsizliği.** Önlem: ≥30 dk ara zorunlu, yön önceliği, belirsizde incelenecek; parça detayı ekranda.
5. **Geniş aralık okuma/CPU** (`pdksTable` 500×62 + departman zinciri). Önlem: memo, proje başına bounded tek sorgu, `take(2001)` sınırı; 500×62 sentetik performans testi.

## Açık sorular (Emre)
1. Döngüde boş slot = hafta tatili, dolu slot = iş günü (proje çalışma günlerini ezer) — onay? (öneri: evet)
2. Çoklu vardiyada bir parça kaçırılırsa gün: "İncelenecek" (öneri) mi, "Devamsız" mı, "Geldi + eksik süre" mi?
3. Günde azami vardiya 8 (Hik) yeterli mi, ara en az 30 dk kuralı uygun mu?
4. Departman değişince geçmiş günlerin yeniden hesaplanması kabul mü (risk 1)?
