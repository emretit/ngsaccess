# Worker API — Ham Okutmalar rapor sorgusu (KVKK süzgeçli)
ÖNCE `.claude/orca-specs/rep1-common.md` oku (zorunlu).

**Hedef:** `api.cardReadings.listReportTransactions` sayfalı sorgusu, seçili projenin okutmalarını tarih/sonuç/kişi filtresiyle, biyometrik kaynaklıları
DIŞARIDA bırakarak, rapor satırı şeklinde döner; saf satır/etiket mantığı `convex/lib/reportAttendance.ts`'te testli.

## Ownership (yalnız bunlara yaz)
- `convex/cardReadings.ts` — YALNIZ dosya sonuna yeni `listReportTransactions` export'u + gereken import'lar. Var olan fonksiyonlara (özellikle `listFiltered`) DOKUNMA.
- `convex/lib/reportAttendance.ts` (YENİ) + `convex/lib/reportAttendance.test.ts` (YENİ)

## Sözleşme (frontend buna göre yazılıyor — imzayı DEĞİŞTİRME; zorunlu değişiklik = `ask`)
```ts
// convex/lib/reportAttendance.ts
export type ReportTransactionResult = "granted" | "denied" | "unknown";
export type ReportTransactionRow = {
  _id: Id<"cardReadings">;
  accessTime: string;              // ISO (UTC) — UI İstanbul saatine çevirir
  employeeId: Id<"employees"> | null;
  employeeName: string | null;     // çalışan kaydı yoksa reading.employeeName, o da yoksa null
  department: string | null;
  cardNo: string;
  deviceName: string | null;
  doorName: string | null;         // IDE kapı eşlemesi (enrichReadingsForList.door?.name)
  direction: "entry" | "exit" | "unknown";
  result: ReportTransactionResult; // izin_verildi→granted, reddedildi→denied, yok→unknown
  denialReason: string | null;     // hikDenialReason
  source: PdksReadingSource;       // classifyReadingSource; biyometrik satır ASLA dönmez
  sourceLabel: string;             // Türkçe: Kart · Şifre · QR · Mobil · Manuel · Bilinmiyor
};
export function readingResult(status: Doc<"cardReadings">["accessStatus"]): ReportTransactionResult;
export const READING_SOURCE_LABELS: Record<PdksReadingSource, string>; // biometric: "Biyometrik" (sayaç/not için)
export function toReportTransactionRow(enriched: <enrichReadingsForList satırı>): ReportTransactionRow;
export function splitPdksEligible<T extends PdksSourceReading>(rows: readonly T[]): { eligible: T[]; hiddenBiometricCount: number };

// convex/cardReadings.ts
export const listReportTransactions = authedQuery({
  args: {
    projectId: v.id("projects"),
    startDate: v.optional(v.string()),   // YYYY-MM-DD (TR günü), cardReadingDateBounds ile
    endDate: v.optional(v.string()),
    employeeId: v.optional(v.id("employees")),
    result: v.optional(v.union(v.literal("granted"), v.literal("denied"), v.literal("unknown"))),
    paginationOpts: paginationOptsValidator,
  },
  // dönüş: { page: ReportTransactionRow[]; isDone; continueCursor; splitCursor?; pageStatus?;
  //          scannedCount: number; hiddenBiometricCount: number }
});
```

## Davranış
1. `resolveProjectScope(ctx, args.projectId)` ZORUNLU (yetkisiz proje = hata). `employeeId` verilirse çalışan aynı projede olmalı (yoksa `ConvexError`, `listFiltered` kalıbı).
   `numItems` pozitif tam sayı kontrolü (`listFiltered` kalıbı).
2. İndeks seçimi `listFiltered`'daki kalıpla (kopyala, ortaklaştırmak için `listFiltered`'ı DEĞİŞTİRME): employeeId → `by_project_employee_time`;
   result granted/denied → `by_project_status_time`; diğer → `scopedCardReadingQuery`. Tarih sınırları `cardReadingDateBounds`.
   `result:"unknown"` için `matchesReadingResult` ile sayfa-içi süz (indeks yok; `listFiltered` aynı şeyi yapıyor).
3. `.order("desc").paginate({ ...paginationOpts, numItems: Math.min(numItems, 200), maximumRowsRead: 200 })`.
4. Sayfayı önce proje/kişi/sonuç süzgecinden, sonra `splitPdksEligible` (= `isPdksEligibleReading`) geçir; `hiddenBiometricCount` o sayfada gizlenen biyometrik sayısı.
   Sonra `enrichReadingsForList` → `toReportTransactionRow`. Sayfa `numItems`'tan kısa (hatta boş) olabilir; `isDone/continueCursor` paginate'ten aynen.
5. `.filter()` yok, `.collect()` yok; okunan satır ≤200/çağrı.

## Testler (`convex/lib/reportAttendance.test.ts`)
`readingResult` 3 durum · `splitPdksEligible`: kart/pin/qr/mobil/manuel geçer, Hik yüz/parmak izi minor'ları (`pdksSource.ts` aralıkları: ör. 0x26, 0x4b) gizlenir ve sayılır ·
`toReportTransactionRow`: kişi yok → `employeeName` reading.employeeName'e düşer; direction yok → "unknown"; `sourceLabel` Türkçe. (Fixture'ı `convex/lib/pdksSource.test.ts`'ten örnek al.)

## Kapsam dışı
UI (Worker UI). `listFiltered` refaktörü. Biyometrik satırları gösteren ayrı mod (yok). Şema/indeks değişikliği (gerekirse `ask`).
