import { describe, it, expect } from "vitest";
import { computePayrollCell } from "./pdksPayroll";
import {
  DEFAULT_WORK_SETTINGS,
  type EffectiveOvertimeRates,
} from "./pdksHelpers";
import type { Doc } from "../_generated/dataModel";

const reading = (
  accessTime: string,
  accessStatus = "izin_verildi",
): Doc<"cardReadings"> =>
  ({ _id: `r_${accessTime}`, accessTime, accessStatus }) as unknown as Doc<"cardReadings">;

const manual = (
  entryTime?: string,
  exitTime?: string,
): Doc<"pdksRecords"> =>
  ({ entryTime, exitTime, manualEntry: true }) as unknown as Doc<"pdksRecords">;

const WORKING_DAYS = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma"];
const MONDAY = "2026-06-22"; // Pazartesi (workday)
const SATURDAY = "2026-06-27"; // Cumartesi (weekend)

const RATES: EffectiveOvertimeRates = {
  weekdayMultiplier: 1.5,
  weekendMultiplier: 2,
  holidayMultiplier: 2,
  nightShiftMultiplier: 2,
  nightShiftStart: "20:00",
  nightShiftEnd: "06:00",
};

type CellParams = Parameters<typeof computePayrollCell>[0];
const cell = (overrides: Partial<CellParams>): CellParams => ({
  date: MONDAY,
  manual: undefined,
  dayReadings: [],
  hasLeave: false,
  holiday: null,
  workingDays: WORKING_DAYS,
  dayShift: null,
  workSettings: DEFAULT_WORK_SETTINGS,
  overtimeRates: RATES,
  empHourlyRate: 100,
  ...overrides,
});

describe("pdksPayroll – computePayrollCell", () => {
  it("iş günü, devam yok → DV / 0 mesai / pay null", () => {
    const r = computePayrollCell(cell({}));
    expect(r).toMatchObject({
      date: MONDAY,
      payrollCode: "DV",
      totalMinutes: 0,
      overtimeMinutes: 0,
      multiplier: 0,
      overtimePayTRY: null,
      isLate: false,
      isEarlyExit: false,
      isManual: false,
      classification: "workday",
    });
  });

  it("manuel 09:00-20:00 → shift-duyarlı mesai çıkış-bazlı (R8 bordro varyantı)", () => {
    const r = computePayrollCell(cell({ manual: manual("09:00", "20:00") }));
    // ham 660 → mola 60 → net 600; mesai = max(0, 1200 − (1080+15)) = 105 (8h kuralı DEĞİL)
    expect(r).toMatchObject({
      payrollCode: "N",
      totalMinutes: 600,
      overtimeMinutes: 105,
      multiplier: 1.5, // weekdayMultiplier
      overtimePayTRY: 262.5, // (105/60)*1.5*100
      isManual: true,
      classification: "workday",
    });
  });

  it("hafta sonu, 2 okuma → tüm net mesai (premium) × weekendMultiplier", () => {
    const r = computePayrollCell(
      cell({
        date: SATURDAY,
        dayReadings: [
          reading(`${SATURDAY}T06:00:00.000Z`), // TR 09:00
          reading(`${SATURDAY}T15:00:00.000Z`), // TR 18:00
        ],
      }),
    );
    // raw 540 → mola 60 → net 480; hafta sonu → mesai = net = 480; pay (480/60)*2*100
    expect(r).toMatchObject({
      payrollCode: "HT",
      totalMinutes: 480,
      overtimeMinutes: 480,
      multiplier: 2,
      overtimePayTRY: 1600,
      isLate: false,
      isEarlyExit: false,
      classification: "weekend",
    });
  });

  it("iş günü geç giriş okuması (Z-offset) → isLate true, mesai eşiğin altında 0", () => {
    const r = computePayrollCell(
      cell({
        dayReadings: [
          reading(`${MONDAY}T07:00:00.000Z`), // TR 10:00 > 09:15 tolerans → geç
          reading(`${MONDAY}T15:00:00.000Z`), // TR 18:00
        ],
      }),
    );
    // raw 480 → net 420; çıkış 18:00=1080 < eşik 1095 → mesai 0 → pay null
    expect(r).toMatchObject({
      payrollCode: "N",
      totalMinutes: 420,
      overtimeMinutes: 0,
      multiplier: 0,
      overtimePayTRY: null,
      isLate: true,
      isEarlyExit: false,
    });
  });

  it("saatlik ücret null → mesai>0 olsa da overtimePayTRY null", () => {
    const r = computePayrollCell(
      cell({
        date: SATURDAY,
        empHourlyRate: null,
        dayReadings: [
          reading(`${SATURDAY}T06:00:00.000Z`),
          reading(`${SATURDAY}T15:00:00.000Z`),
        ],
      }),
    );
    expect(r.overtimeMinutes).toBe(480);
    expect(r.multiplier).toBe(2);
    expect(r.overtimePayTRY).toBeNull();
  });

  it("tek okuma → devam yok (en az 2 gerekli) → DV", () => {
    const r = computePayrollCell(
      cell({ dayReadings: [reading(`${MONDAY}T06:00:00.000Z`)] }),
    );
    expect(r.payrollCode).toBe("DV");
    expect(r.totalMinutes).toBe(0);
  });

  it("izinli gün, devam yok → İZN", () => {
    const r = computePayrollCell(cell({ hasLeave: true }));
    expect(r.payrollCode).toBe("İZN");
  });
});
