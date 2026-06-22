import { describe, it, expect } from "vitest";
import {
  computeAttendanceDetailDay,
  summarizeAttendanceDays,
} from "./pdksDetail";
import { DEFAULT_WORK_SETTINGS } from "./pdksHelpers";
import type { Doc } from "../_generated/dataModel";

// Minimal fixture'lar — fonksiyon ctx-free, yalnız kullanılan alanlar gerekli.
const reading = (
  accessTime: string,
  accessStatus = "izin_verildi",
): Doc<"cardReadings"> =>
  ({
    _id: `r_${accessTime}`,
    accessTime,
    accessStatus,
    direction: "entry",
    deviceId: undefined,
  }) as unknown as Doc<"cardReadings">;

const manual = (
  entryTime?: string,
  exitTime?: string,
  manualNote?: string,
): Doc<"pdksRecords"> =>
  ({ entryTime, exitTime, manualNote }) as unknown as Doc<"pdksRecords">;

const leave = (
  startDate: string,
  endDate: string,
  leaveType = "yıllık",
): Doc<"leaves"> =>
  ({ startDate, endDate, leaveType }) as unknown as Doc<"leaves">;

const WORKING_DAYS = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma"];
const MONDAY = "2026-06-22"; // Pazartesi (workday)
const SATURDAY = "2026-06-27"; // Cumartesi (weekend)

type DayParams = Parameters<typeof computeAttendanceDetailDay>[0];
const day = (overrides: Partial<DayParams>): DayParams => ({
  date: MONDAY,
  dayReadings: [],
  manualDay: undefined,
  leaves: [],
  holiday: null,
  dayShift: null,
  workSettings: DEFAULT_WORK_SETTINGS,
  workingDays: WORKING_DAYS,
  ...overrides,
});

describe("pdksDetail – computeAttendanceDetailDay", () => {
  it("iş günü, okuma/manuel/izin yok → absent / DV / 0", () => {
    const r = computeAttendanceDetailDay(day({}));
    expect(r).toMatchObject({
      date: MONDAY,
      firstEntry: null,
      lastExit: null,
      totalMinutes: 0,
      totalHours: "0h 0m",
      status: "absent",
      isLate: false,
      isEarlyExit: false,
      payrollCode: "DV",
      overtimeMinutes: 0,
      isManual: false,
      manualNote: null,
      leaveType: null,
    });
    expect(r.rawReadings).toEqual([]);
  });

  it("manuel giriş/çıkış geç başlangıç → late / N, 8h altı mesai 0", () => {
    const r = computeAttendanceDetailDay(
      day({ manualDay: manual("10:00", "19:00", "elle düzeltme") }),
    );
    // override 540dk → ≥450 mola 60 → net 480 → mesai max(0,480-480)=0
    expect(r).toMatchObject({
      firstEntry: "10:00",
      lastExit: "19:00",
      totalMinutes: 480,
      totalHours: "8h 0m",
      status: "late",
      isLate: true,
      isEarlyExit: false,
      payrollCode: "N",
      overtimeMinutes: 0,
      isManual: true,
      manualNote: "elle düzeltme",
    });
  });

  it("manuel uzun gün → sabit 8h kuralı mesai üretir (R8 farkı)", () => {
    const r = computeAttendanceDetailDay(
      day({ manualDay: manual("08:00", "20:00") }),
    );
    // override 720dk → mola 60 → net 660 → mesai max(0,660-480)=180
    expect(r).toMatchObject({
      totalMinutes: 660,
      totalHours: "11h 0m",
      status: "present",
      isLate: false,
      payrollCode: "N",
      overtimeMinutes: 180,
    });
  });

  it("granted okumalar → ilk giriş/son çıkış + rawReadings eşlemesi", () => {
    const r = computeAttendanceDetailDay(
      day({
        dayReadings: [
          reading(`${MONDAY}T06:00:00.000Z`), // TR 09:00
          reading(`${MONDAY}T15:00:00.000Z`), // TR 18:00
        ],
      }),
    );
    // 540dk → net 480 → mesai 0; 09:00 ≤ 09:15 tolerans → geç değil
    expect(r).toMatchObject({
      firstEntry: "09:00",
      lastExit: "18:00",
      totalMinutes: 480,
      status: "present",
      isLate: false,
      isEarlyExit: false,
      payrollCode: "N",
      overtimeMinutes: 0,
      isManual: false,
    });
    expect(r.rawReadings).toEqual([
      {
        id: `r_${MONDAY}T06:00:00.000Z`,
        time: "09:00:00",
        accessStatus: "izin_verildi",
        direction: "entry",
        deviceId: null,
      },
      {
        id: `r_${MONDAY}T15:00:00.000Z`,
        time: "18:00:00",
        accessStatus: "izin_verildi",
        direction: "entry",
        deviceId: null,
      },
    ]);
  });

  it("reddedilen okuma granted sayılmaz → attendance yok", () => {
    const r = computeAttendanceDetailDay(
      day({ dayReadings: [reading(`${MONDAY}T06:00:00.000Z`, "reddedildi")] }),
    );
    expect(r.firstEntry).toBeNull();
    expect(r.status).toBe("absent");
    expect(r.payrollCode).toBe("DV");
  });

  it("hafta sonu → weekend / HT", () => {
    const r = computeAttendanceDetailDay(day({ date: SATURDAY }));
    expect(r.status).toBe("weekend");
    expect(r.payrollCode).toBe("HT");
  });

  it("izinli gün, devam yok → leave / İZN + leaveType", () => {
    const r = computeAttendanceDetailDay(
      day({ leaves: [leave("2026-06-20", "2026-06-25", "yıllık")] }),
    );
    expect(r.status).toBe("leave");
    expect(r.payrollCode).toBe("İZN");
    expect(r.leaveType).toBe("yıllık");
  });
});

describe("pdksDetail – summarizeAttendanceDays", () => {
  it("statülere göre sayaçları toplar", () => {
    const summary = summarizeAttendanceDays([
      { status: "present", totalMinutes: 480, overtimeMinutes: 0 },
      { status: "late", totalMinutes: 500, overtimeMinutes: 20 },
      { status: "absent", totalMinutes: 0, overtimeMinutes: 0 },
      { status: "leave", totalMinutes: 0, overtimeMinutes: 0 },
      { status: "weekend", totalMinutes: 0, overtimeMinutes: 0 },
    ]);
    expect(summary).toEqual({
      totalMinutes: 980,
      workedDays: 2,
      lateDays: 1,
      absentDays: 1,
      leaveDays: 1,
      overtimeMinutes: 20,
    });
  });

  it("boş liste → sıfır özet", () => {
    expect(summarizeAttendanceDays([])).toEqual({
      totalMinutes: 0,
      workedDays: 0,
      lateDays: 0,
      absentDays: 0,
      leaveDays: 0,
      overtimeMinutes: 0,
    });
  });
});
