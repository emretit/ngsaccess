import { describe, expect, it } from "vitest";
import type { Doc, Id } from "../_generated/dataModel";
import {
  DEFAULT_OVERTIME_RATES,
  DEFAULT_WORK_SETTINGS,
} from "./pdksHelpers";
import {
  buildPdksEmployeeReadingMap,
  computePdksTableRow,
  filterPdksTableRows,
} from "./pdksTable";

const WORKING_DAYS = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma"];
const MONDAY = "2026-06-22";
const TUESDAY = "2026-06-23";
const SATURDAY = "2026-06-27";
const EMP_ID = "emp_1" as Id<"employees">;

const employee = (
  overrides: Partial<Doc<"employees">> = {},
): Doc<"employees"> =>
  ({
    _id: EMP_ID,
    firstName: "Ada",
    lastName: "Lovelace",
    cardNumber: "CARD-1",
    payrollCode: "P-001",
    hourlyRate: 100,
    monthlySalary: undefined,
    ...overrides,
  }) as unknown as Doc<"employees">;

const reading = (
  accessTime: string,
  overrides: Partial<Doc<"cardReadings">> = {},
): Doc<"cardReadings"> =>
  ({
    _id: `reading_${accessTime}`,
    accessTime,
    accessStatus: "izin_verildi",
    employeeId: EMP_ID,
    cardNo: "CARD-1",
    ...overrides,
  }) as unknown as Doc<"cardReadings">;

const manual = (
  date: string,
  entryTime: string,
  exitTime: string,
  manualNote?: string,
): Doc<"pdksRecords"> =>
  ({
    date,
    entryTime,
    exitTime,
    manualEntry: true,
    manualNote,
  }) as unknown as Doc<"pdksRecords">;

const leave = (
  startDate: string,
  endDate: string,
  leaveType = "annual",
): Doc<"leaves"> =>
  ({
    employeeId: EMP_ID,
    startDate,
    endDate,
    leaveType,
  }) as unknown as Doc<"leaves">;

const holiday = (date: string): Doc<"holidays"> =>
  ({ date, isHalfDay: false }) as unknown as Doc<"holidays">;

type RowParams = Parameters<typeof computePdksTableRow>[0];
const rowParams = (overrides: Partial<RowParams> = {}): RowParams => ({
  empKey: String(EMP_ID),
  empReadings: [],
  employee: employee(),
  departmentName: "Ar-Ge",
  periodDateKeys: [MONDAY],
  startDate: MONDAY,
  isSingleDay: true,
  viewMode: "single",
  manualPdksByEmpDate: new Map(),
  allLeaves: [],
  holidayMap: new Map(),
  workingDays: WORKING_DAYS,
  workSettings: DEFAULT_WORK_SETTINGS,
  overtimeRates: DEFAULT_OVERTIME_RATES,
  resolveShift: () => null,
  manualEditedBy: null,
  ...overrides,
});

describe("pdksTable – buildPdksEmployeeReadingMap", () => {
  it("employeeId öncelikli, cardNo fallback ve bilinmeyen okuma atılır", () => {
    const employees = [employee()];
    const map = buildPdksEmployeeReadingMap({
      employees,
      readings: [
        reading(`${MONDAY}T06:00:00.000Z`, { employeeId: EMP_ID }),
        reading(`${MONDAY}T07:00:00.000Z`, {
          employeeId: undefined,
          cardNo: "CARD-1",
        }),
        reading(`${MONDAY}T08:00:00.000Z`, {
          employeeId: undefined,
          cardNo: "OTHER",
        }),
      ],
    });

    expect(map.get(String(EMP_ID))?.map((r) => r.accessTime)).toEqual([
      `${MONDAY}T06:00:00.000Z`,
      `${MONDAY}T07:00:00.000Z`,
    ]);
  });
});

describe("pdksTable – computePdksTableRow", () => {
  it("tek gün okuma/manuel/izin yok → absent / DV", () => {
    const row = computePdksTableRow(rowParams());

    expect(row).toMatchObject({
      id: String(EMP_ID),
      name: "Ada Lovelace",
      employeeId: "CARD-1",
      payrollCode: "DV",
      department: "Ar-Ge",
      firstEntry: "-",
      lastExit: "-",
      totalHours: "0h 0m",
      overtime: "0m",
      overtimeHours: 0,
      overtimeMultiplier: 0,
      overtimePayTRY: null,
      hourlyRate: 100,
      leaveType: "-",
      status: "absent",
      isLate: false,
      isEarlyExit: false,
      isManual: false,
      manualNote: null,
      manualEditedBy: null,
      days: [],
    });
  });

  it("tek gün izin, devam yok → leave / İZN + etiketli izin tipi", () => {
    const row = computePdksTableRow(
      rowParams({ allLeaves: [leave(MONDAY, MONDAY)] }),
    );

    expect(row).toMatchObject({
      payrollCode: "İZN",
      leaveType: "Yıllık",
      status: "leave",
    });
  });

  it("geç giriş okuması → raw dakika + shift-duyarlı mesai (R8 tablo varyantı)", () => {
    const row = computePdksTableRow(
      rowParams({
        empReadings: [
          reading(`${MONDAY}T07:00:00.000Z`), // TR 10:00
          reading(`${MONDAY}T15:30:00.000Z`), // TR 18:30
        ],
      }),
    );

    expect(row).toMatchObject({
      firstEntry: "10:00",
      lastExit: "18:30",
      totalHours: "8h 30m",
      overtime: "15m",
      overtimeHours: 0.25,
      overtimeMultiplier: 1.5,
      overtimePayTRY: 37.5,
      status: "late",
      isLate: true,
      isEarlyExit: false,
      payrollCode: "N",
    });
  });

  it("manuel giriş/çıkış +03:00 olarak biçimlenir ve mola düşmeden ham dakika döner", () => {
    const manualByDate = new Map<string, Doc<"pdksRecords">>([
      [`${EMP_ID}__${MONDAY}`, manual(MONDAY, "09:00", "20:00", "elle")],
    ]);
    const row = computePdksTableRow(
      rowParams({
        manualPdksByEmpDate: manualByDate,
        manualEditedBy: "Editör",
      }),
    );

    expect(row).toMatchObject({
      firstEntry: "09:00",
      lastExit: "20:00",
      totalHours: "11h 0m",
      overtime: "105m",
      overtimePayTRY: 262.5,
      status: "present",
      isManual: true,
      manualNote: "elle",
      manualEditedBy: "Editör",
    });
  });

  it("matrix hücreleri izin/hafta sonu/tatil/statü/mesai değerlerini pinler", () => {
    const manualByDate = new Map<string, Doc<"pdksRecords">>([
      [`${EMP_ID}__${MONDAY}`, manual(MONDAY, "09:00", "20:00")],
    ]);
    const row = computePdksTableRow(
      rowParams({
        periodDateKeys: [MONDAY, TUESDAY, SATURDAY],
        isSingleDay: false,
        viewMode: "matrix",
        manualPdksByEmpDate: manualByDate,
        allLeaves: [leave(TUESDAY, TUESDAY, "sick")],
        holidayMap: new Map([[SATURDAY, holiday(SATURDAY)]]),
      }),
    );

    expect(row.payrollCode).toBe("—");
    expect(row.days).toEqual([
      {
        date: MONDAY,
        firstEntry: "09:00",
        lastExit: "20:00",
        totalMinutes: 660,
        status: "present",
        isLate: false,
        lateMinutes: 0,
        payrollCode: "N",
        overtimeMinutes: 105,
      },
      {
        date: TUESDAY,
        firstEntry: null,
        lastExit: null,
        totalMinutes: 0,
        status: "leave",
        isLate: false,
        lateMinutes: 0,
        payrollCode: "İZN",
        overtimeMinutes: 0,
      },
      {
        date: SATURDAY,
        firstEntry: null,
        lastExit: null,
        totalMinutes: 0,
        status: "holiday",
        isLate: false,
        lateMinutes: 0,
        payrollCode: "RT",
        overtimeMinutes: 0,
      },
    ]);
  });
});

describe("pdksTable – filterPdksTableRows", () => {
  it("overtime filtresi yalnız mesaili satırları döner", () => {
    const rows = [
      computePdksTableRow(rowParams()),
      computePdksTableRow(
        rowParams({
          empReadings: [
            reading(`${MONDAY}T06:00:00.000Z`),
            reading(`${MONDAY}T16:00:00.000Z`),
          ],
        }),
      ),
    ];

    expect(filterPdksTableRows(rows, "overtime")).toHaveLength(1);
  });
});
