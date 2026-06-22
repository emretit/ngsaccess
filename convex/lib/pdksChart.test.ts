import { describe, expect, it } from "vitest";
import type { Doc, Id } from "../_generated/dataModel";
import { DEFAULT_WORK_SETTINGS } from "./pdksHelpers";
import { computePdksChartData, emptyPdksChartData } from "./pdksChart";

const MONDAY = "2026-06-22";
const TUESDAY = "2026-06-23";
const EMP_A = "emp_a" as Id<"employees">;
const EMP_B = "emp_b" as Id<"employees">;

const reading = (
  accessTime: string,
  employeeId: Id<"employees"> | undefined,
  cardNo: string,
  accessStatus: "izin_verildi" | "reddedildi" = "izin_verildi",
): Doc<"cardReadings"> =>
  ({
    _id: `reading_${accessTime}_${cardNo}`,
    accessTime,
    accessStatus,
    employeeId,
    cardNo,
  }) as unknown as Doc<"cardReadings">;

const shift = (
  overrides: Partial<Doc<"shifts">> = {},
): Doc<"shifts"> =>
  ({
    _id: "shift_1" as Id<"shifts">,
    startTime: "10:00",
    endTime: "18:00",
    lateToleranceMinutes: 5,
    ...overrides,
  }) as unknown as Doc<"shifts">;

type ChartParams = Parameters<typeof computePdksChartData>[0];
const chartParams = (overrides: Partial<ChartParams> = {}): ChartParams => ({
  readings: [],
  startDate: MONDAY,
  endDate: TUESDAY,
  chartSettings: DEFAULT_WORK_SETTINGS,
  employeeDepartmentByKey: new Map(),
  resolveShift: () => null,
  ...overrides,
});

describe("pdksChart – emptyPdksChartData", () => {
  it("erişim yokken handler'ın boş shape'ini üretir", () => {
    expect(emptyPdksChartData()).toEqual({
      dailyAttendance: [],
      departmentAbsence: [],
      lateDistribution: [],
      hourlyTrend: [],
      lateMinutesSamples: [],
    });
  });
});

describe("pdksChart – computePdksChartData", () => {
  it("boş reading ama geçerli tarih aralığı → günler sıfır sayaçla döner", () => {
    const result = computePdksChartData(chartParams());

    expect(result).toMatchObject({
      departmentAbsence: [],
      lateDistribution: [],
      hourlyTrend: [],
      lateMinutesSamples: [],
    });
    expect(result.dailyAttendance).toEqual([
      {
        name: "Pazartesi",
        date: MONDAY,
        present: 0,
        late: 0,
        absent: 0,
        rate: 0,
      },
      {
        name: "Salı",
        date: TUESDAY,
        present: 0,
        late: 0,
        absent: 0,
        rate: 0,
      },
    ]);
  });

  it("daily attendance, absent departmanları ve saat serilerini mevcut formatta toplar", () => {
    const result = computePdksChartData(
      chartParams({
        readings: [
          reading(`${MONDAY}T07:10:00.000Z`, EMP_A, "CARD-A"),
          reading(`${TUESDAY}T06:00:00.000Z`, EMP_B, "CARD-B"),
          reading(`${TUESDAY}T08:00:00.000Z`, EMP_B, "CARD-B", "reddedildi"),
        ],
        employeeDepartmentByKey: new Map([
          [String(EMP_A), "Ar-Ge"],
          [String(EMP_B), "Operasyon"],
        ]),
        resolveShift: (employeeId) =>
          employeeId === EMP_A ? shift() : null,
      }),
    );

    expect(result.dailyAttendance).toEqual([
      {
        name: "Pazartesi",
        date: MONDAY,
        present: 1,
        late: 1,
        absent: 1,
        rate: 50,
      },
      {
        name: "Salı",
        date: TUESDAY,
        present: 1,
        late: 0,
        absent: 1,
        rate: 50,
      },
    ]);
    expect([...result.departmentAbsence].sort((a, b) => a.name.localeCompare(b.name))).toEqual([
      { name: "Ar-Ge", absences: 1 },
      { name: "Operasyon", absences: 1 },
    ]);
    expect(result.lateMinutesSamples).toEqual([5]);
    expect(result.lateDistribution).toEqual([
      { hour: `${new Date(`${MONDAY}T07:10:00.000Z`).getHours()}:00`, count: 1 },
    ]);
    expect(result.hourlyTrend).toEqual([
      { hour: "06:00", checkins: 1 },
      { hour: "07:00", checkins: 1 },
    ]);
  });

  it("employeeId olmayan kartta fallback threshold kullanır, departmanı Bilinmiyor olur", () => {
    const result = computePdksChartData(
      chartParams({
        readings: [reading(`${MONDAY}T07:00:00.000Z`, undefined, "CARD-X")],
        employeeDepartmentByKey: new Map(),
      }),
    );

    expect(result.dailyAttendance[0]).toMatchObject({
      present: 1,
      late: 1,
      absent: 0,
      rate: 100,
    });
    expect(result.dailyAttendance[1]).toMatchObject({
      present: 0,
      late: 0,
      absent: 1,
      rate: 0,
    });
    expect(result.departmentAbsence).toEqual([
      { name: "Bilinmiyor", absences: 1 },
    ]);
    expect(result.lateMinutesSamples).toEqual([45]);
    expect(result.lateDistribution).toEqual([]);
  });
});
