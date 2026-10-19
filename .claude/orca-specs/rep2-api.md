# Raporlar Dalga 2 — Worker API (gün okutmaları + mola + kaynak filtresi)
ÖNCE `.claude/orca-specs/rep1-common.md` oku (kurallar aynen geçerli; HEAD artık `73061a6`, D1 `c235651`'de commit'li ve canlı). İSTİSNA: rep1-common'daki `convex/lib/{pdksCalc,pdksTable,pdksTable.test}.ts` yazma yasağı bu iş için KALKAR (aşağıdaki Ownership geçerli).

**Hedef:** `getPdksTableData` matris hücresinin `detail`'i günün okutma listesini ve mola bilgisini taşır; `listReportTransactions` opsiyonel kaynak filtresi alır;
saf mantık testli. Mevcut çağıranlar (PDKS Kayıtları, D1 raporları) değişmeden çalışır.

## Ownership (yalnız bunlara yaz)
- `convex/lib/pdksTable.ts` (+ `convex/lib/pdksTable.test.ts`) — yalnız `PdksDayDetail` tipi + `computePdksTableRow` içinde `detail` doldurma.
- `convex/lib/pdksCalc.ts` (+ `convex/lib/pdksCalc.test.ts`) — yeni saf yardımcılar buraya (YENİ convex dosyası AÇMA: codegen gerektirir).
- `convex/cardReadings.ts` — yalnız `listReportTransactions` (yeni opsiyonel arg + sayfa süzgeci). Diğer fonksiyonlara DOKUNMA.
- `convex/lib/reportAttendance.ts` (+ test) — kaynak süzgeç yardımcısı.
- `src/lib/reports/testFixtures.ts` — YALNIZ `dailyCell` içindeki `detail` varsayılan nesnesine yeni zorunlu alanları ekle (tsc kırılmasın). Başka satıra dokunma.

## Sözleşme (frontend buna göre yazılacak — DEĞİŞTİRME; zorunlu değişiklik = `ask`)
```ts
// convex/lib/pdksTable.ts — PdksDayDetail'e EKLENİR (mevcut alanlar aynen kalır)
punches: Array<{ time: string /* "HH:MM" İstanbul */; direction: "entry" | "exit" | "unknown" }>; // yalnız izin_verildi, artan, en fazla 24
plannedBreakStart: string | null;   // günün vardiyası shifts.breakStart ("HH:MM"), yoksa null
plannedBreakEnd: string | null;
breakViolation: boolean;            // dashboard.getBreakViolations ile AYNI kural (aşağıda)

// convex/lib/pdksCalc.ts
export function computeBreakViolation(params: { punchMinutes: readonly number[]; breakStart?: string | null; breakEnd?: string | null }): boolean;

// convex/cardReadings.ts — listReportTransactions args'a EKLENİR
sources: v.optional(v.array(v.union(v.literal("card"), v.literal("pin"), v.literal("qr"), v.literal("mobile"), v.literal("manual"), v.literal("unknown")))),
// dönüş şekli DEĞİŞMEZ. "biometric" literal'i YOK (zaten hiç dönmez).

// convex/lib/reportAttendance.ts
export function matchesReadingSources(source: PdksReadingSource, sources: readonly PdksReadingSource[] | undefined): boolean; // undefined/boş = hepsi
```

## Davranış
1. `punches`: `computePdksTableRow` içinde gün okutmalarından (`dayReadings`, zaten KVKK süzgeçli) yalnız `accessStatus === "izin_verildi"` olanlar; `formatIstanbulTime` ile "HH:MM";
   artan zaman; 24'ten fazlaysa ilk 24 (payload sınırı — 31 gün × yüzlerce kişi). Manuel gün (`manualDay`) varsa punches yine gerçek okutmalardır.
2. `breakViolation` kuralı (`convex/dashboard.ts` `getBreakViolations` satır ~558-588 ile birebir): izinli okutma ≥2, ilk–son arası ≥450 dk, vardiyada `breakStart` VE `breakEnd` var,
   mola penceresi [breakStart, breakEnd] (dahil) içinde hiç izinli okutma YOK → true; aksi false. Dakikalar `isoTimeToTRMinutes`. Gece yarısını aşan mola penceresini (start > end)
   ihlal SAYMA (false) — `getBreakViolations` bunu desteklemiyor; testte belgele. `dashboard.ts`'e DOKUNMA (ortaklaştırma kapsam dışı).
3. `plannedBreakStart/End`: `dayShift?.breakStart ?? null` / `dayShift?.breakEnd ?? null` (`settingsForShift` mola taşımıyor; doğrudan shift dokümanı).
4. `sources`: sayfa `splitPdksEligible` sonrası, enrich'ten ÖNCE `classifyReadingSource` + `matchesReadingSources` ile süzülür (enrich maliyeti düşer). `hiddenBiometricCount` anlamı değişmez.
   Okunan satır ≤200/çağrı kuralı aynı.

## Testler
`pdksCalc.test.ts`: `computeBreakViolation` — pencere içinde okutma var/yok, 449/450 dk sınırı, tek okutma, mola tanımsız, gece yarısı penceresi.
`pdksTable.test.ts`: matris hücresinde `punches` (reddedilen hariç, sıralı, 24 sınırı), `plannedBreak*`, `breakViolation` true/false örneği.
`reportAttendance.test.ts`: `matchesReadingSources` (undefined, boş dizi, eşleşme, eşleşmeme).

## Kapsam dışı
Frontend (ayrı worker). `getBreakViolations` refaktörü. Şema değişikliği. `listFiltered`.
Rapor: `.claude/orca-specs/reports/rep2-api.md` + `worker_done` ≤10 satır.
