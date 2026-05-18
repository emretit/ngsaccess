/**
 * Türkiye resmi tatil takvimi.
 * - Sabit (national): 1 Ocak, 23 Nisan, 1 Mayıs, 19 Mayıs, 15 Temmuz, 30 Ağustos, 29 Ekim
 * - Yarım gün (national, halfDay): 29 Ekim arefesi (28 Ekim öğleden sonra) — politik
 * - Dini (religious): Ramazan Bayramı (3.5 gün), Kurban Bayramı (4.5 gün)
 *   Aşağıda 2024-2030 arası tarih tablosu hardcoded; sonraki yıllar için kullanıcı
 *   manuel girer veya tablo genişletilir.
 */

export type HolidayKind = "national" | "religious" | "company";

export interface PredefinedHoliday {
  date: string; // YYYY-MM-DD
  name: string;
  type: HolidayKind;
  isHalfDay?: boolean;
}

const FIXED_NATIONAL: Array<{ md: string; name: string }> = [
  { md: "01-01", name: "Yılbaşı" },
  { md: "04-23", name: "Ulusal Egemenlik ve Çocuk Bayramı" },
  { md: "05-01", name: "Emek ve Dayanışma Günü" },
  { md: "05-19", name: "Atatürk'ü Anma, Gençlik ve Spor Bayramı" },
  { md: "07-15", name: "Demokrasi ve Milli Birlik Günü" },
  { md: "08-30", name: "Zafer Bayramı" },
  { md: "10-29", name: "Cumhuriyet Bayramı" },
];

const HALF_DAYS: Array<{ md: string; name: string }> = [
  { md: "10-28", name: "Cumhuriyet Bayramı Arefesi" },
];

interface ReligiousHolidayRange {
  start: string;
  end: string;
  name: string;
  arefeStart?: string;
}

const RELIGIOUS_HOLIDAYS: Record<number, ReligiousHolidayRange[]> = {
  2024: [
    { start: "2024-04-10", end: "2024-04-12", name: "Ramazan Bayramı", arefeStart: "2024-04-09" },
    { start: "2024-06-16", end: "2024-06-19", name: "Kurban Bayramı", arefeStart: "2024-06-15" },
  ],
  2025: [
    { start: "2025-03-30", end: "2025-04-01", name: "Ramazan Bayramı", arefeStart: "2025-03-29" },
    { start: "2025-06-06", end: "2025-06-09", name: "Kurban Bayramı", arefeStart: "2025-06-05" },
  ],
  2026: [
    { start: "2026-03-20", end: "2026-03-22", name: "Ramazan Bayramı", arefeStart: "2026-03-19" },
    { start: "2026-05-27", end: "2026-05-30", name: "Kurban Bayramı", arefeStart: "2026-05-26" },
  ],
  2027: [
    { start: "2027-03-09", end: "2027-03-11", name: "Ramazan Bayramı", arefeStart: "2027-03-08" },
    { start: "2027-05-16", end: "2027-05-19", name: "Kurban Bayramı", arefeStart: "2027-05-15" },
  ],
  2028: [
    { start: "2028-02-26", end: "2028-02-28", name: "Ramazan Bayramı", arefeStart: "2028-02-25" },
    { start: "2028-05-05", end: "2028-05-08", name: "Kurban Bayramı", arefeStart: "2028-05-04" },
  ],
  2029: [
    { start: "2029-02-14", end: "2029-02-16", name: "Ramazan Bayramı", arefeStart: "2029-02-13" },
    { start: "2029-04-24", end: "2029-04-27", name: "Kurban Bayramı", arefeStart: "2029-04-23" },
  ],
  2030: [
    { start: "2030-02-04", end: "2030-02-06", name: "Ramazan Bayramı", arefeStart: "2030-02-03" },
    { start: "2030-04-13", end: "2030-04-16", name: "Kurban Bayramı", arefeStart: "2030-04-12" },
  ],
};

function eachDateInRange(start: string, end: string): string[] {
  const result: string[] = [];
  const s = new Date(`${start}T00:00:00.000Z`);
  const e = new Date(`${end}T00:00:00.000Z`);
  for (let d = new Date(s); d <= e; d.setUTCDate(d.getUTCDate() + 1)) {
    result.push(d.toISOString().split("T")[0]);
  }
  return result;
}

export function getTurkishHolidaysForYear(year: number): PredefinedHoliday[] {
  const out: PredefinedHoliday[] = [];
  for (const f of FIXED_NATIONAL) {
    out.push({ date: `${year}-${f.md}`, name: f.name, type: "national" });
  }
  for (const h of HALF_DAYS) {
    out.push({ date: `${year}-${h.md}`, name: h.name, type: "national", isHalfDay: true });
  }
  const religious = RELIGIOUS_HOLIDAYS[year] ?? [];
  for (const r of religious) {
    if (r.arefeStart) {
      out.push({
        date: r.arefeStart,
        name: `${r.name} Arefesi`,
        type: "religious",
        isHalfDay: true,
      });
    }
    for (const d of eachDateInRange(r.start, r.end)) {
      out.push({ date: d, name: r.name, type: "religious" });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export function hasReligiousData(year: number): boolean {
  return Boolean(RELIGIOUS_HOLIDAYS[year]);
}
