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
  availableDateKeys: new Set(["2026-06-22", "2026-06-23", "2026-06-24", "2026-06-27", "2026-06-28"]),
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
  it("UTC gece yarısını aşan aynı Türkiye günü tek hücrede kalır", () => {
    const resolvedDates: string[] = [];
    const row = computePdksTableRow(rowParams({
      empReadings: [
        reading("2026-06-21T21:00:00.000Z"),
        reading(`${MONDAY}T00:00:00.000Z`),
      ],
      periodDateKeys: [MONDAY, TUESDAY],
      isSingleDay: false,
      viewMode: "matrix",
      resolveShift: (_employeeId, date) => {
        resolvedDates.push(date);
        return null;
      },
    }));

    expect(row.totalHours).toBe("2h 45m");
    expect(row.days[0]).toMatchObject({ date: MONDAY, totalMinutes: 165 });
    expect(row.days[1]).toMatchObject({ date: TUESDAY, totalMinutes: 0 });
    expect(resolvedDates).toContain(MONDAY); // previous-day shift lookup is required for overnight attribution.
  });

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
      leaveType: "",
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

  it("geç giriş okuması → ortak net dakika + shift-duyarlı mesai", () => {
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
      totalHours: "7h 30m",
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

  it("manuel giriş/çıkış +03:00 olarak biçimlenir ve ortak net dakika döner", () => {
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
      totalHours: "10h 0m",
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
        totalMinutes: 600,
        rawTotalMinutes: 660,
        nightMinutes: 0,
        status: "present",
        isLate: false,
        lateMinutes: 0,
        leaveType: null,
        payrollCode: "N",
        overtimeMinutes: 105,
        detail: {
          dayType: "workday",
          shiftName: null,
          plannedStart: "09:00",
          plannedEnd: "18:00",
          isEarlyExit: false,
          earlyExitMinutes: 0,
          punches: [],
          plannedBreakStart: null,
          plannedBreakEnd: null,
          breakViolation: false,
          readingCount: 0,
          isManual: true,
        },
      },
      {
        date: TUESDAY,
        firstEntry: null,
        lastExit: null,
        totalMinutes: 0,
        rawTotalMinutes: 0,
        nightMinutes: 0,
        status: "leave",
        isLate: false,
        lateMinutes: 0,
        leaveType: "sick",
        payrollCode: "İZN",
        overtimeMinutes: 0,
        detail: {
          dayType: "workday",
          shiftName: null,
          plannedStart: "09:00",
          plannedEnd: "18:00",
          isEarlyExit: false,
          earlyExitMinutes: 0,
          punches: [],
          plannedBreakStart: null,
          plannedBreakEnd: null,
          breakViolation: false,
          readingCount: 0,
          isManual: false,
        },
      },
      {
        date: SATURDAY,
        firstEntry: null,
        lastExit: null,
        totalMinutes: 0,
        rawTotalMinutes: 0,
        nightMinutes: 0,
        status: "holiday",
        isLate: false,
        lateMinutes: 0,
        leaveType: null,
        payrollCode: "RT",
        overtimeMinutes: 0,
        detail: {
          dayType: "holiday",
          shiftName: null,
          plannedStart: "09:00",
          plannedEnd: "18:00",
          isEarlyExit: false,
          earlyExitMinutes: 0,
          punches: [],
          plannedBreakStart: null,
          plannedBreakEnd: null,
          breakViolation: false,
          readingCount: 0,
          isManual: false,
        },
      },
    ]);
  });
});

describe("pdksTable – rapor gün ayrıntısı", () => {
  it("vardiya planı, geç kalma ve erken çıkış dakikaları tolerans düşülerek hücrede", () => {
    const shift = {
      _id: "shift_1",
      name: "Sabah",
      startTime: "08:00",
      endTime: "17:00",
      lateToleranceMinutes: 10,
      earlyExitToleranceMinutes: 5,
    } as unknown as Doc<"shifts">;
    const row = computePdksTableRow(
      rowParams({
        empReadings: [
          reading(`${MONDAY}T05:30:00.000Z`), // TR 08:30
          reading(`${MONDAY}T13:00:00.000Z`), // TR 16:00
        ],
        isSingleDay: false,
        viewMode: "matrix",
        resolveShift: () => shift,
      }),
    );

    expect(row.days[0]).toMatchObject({
      status: "late",
      isLate: true,
      lateMinutes: 20,
      detail: {
        dayType: "workday",
        shiftName: "Sabah",
        plannedStart: "08:00",
        plannedEnd: "17:00",
        isEarlyExit: true,
        earlyExitMinutes: 55,
        readingCount: 2,
        isManual: false,
      },
    });
  });

  it("tek okumada çıkış yok: erken çıkış sayılmaz", () => {
    const row = computePdksTableRow(
      rowParams({
        empReadings: [reading(`${MONDAY}T06:00:00.000Z`)],
        isSingleDay: false,
        viewMode: "matrix",
      }),
    );
    expect(row.days[0]?.detail).toMatchObject({ isEarlyExit: false, earlyExitMinutes: 0, readingCount: 1 });
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


describe("C2 günlük sözleşme", () => {
  it.each([
    ["2026-06-23", "2026-06-22", new Map(), "future"],
    [SATURDAY, "2026-07-01", new Map(), "weekend"],
    [MONDAY, "2026-07-01", new Map([[MONDAY, holiday(MONDAY)]]), "holiday"],
    [MONDAY, "2026-07-01", new Map(), "absent"],
  ])("%s günlük ve matrix aynı sınıfı döner: %s", (date, today, holidayMap, status) => {
    const input = rowParams({ startDate: date, periodDateKeys: [date], today, holidayMap });
    const single = computePdksTableRow(input);
    const matrix = computePdksTableRow({ ...input, viewMode: "matrix" });
    expect(single.status).toBe(status);
    expect(matrix.days[0]?.status).toBe(status);
    if (status === "future") expect(matrix.days[0]?.payrollCode).toBe("—");
  });
  it("yüklenmeyen geçmiş hücre noData; yüklenmiş boş iş günü absent", () => {
    const row = computePdksTableRow(rowParams({ availableDateKeys: new Set(), viewMode: "matrix" }));
    expect(row.status).toBe("noData");
    expect(row.days[0]).toMatchObject({ status: "noData", payrollCode: "—" });
    expect(computePdksTableRow(rowParams()).status).toBe("absent");
  });

  it("kart numarası boşsa iç anahtar gösterilmez; bilinmeyen yön Giriş değildir", () => {
    const row = computePdksTableRow(rowParams({ employee: employee({ cardNumber: "" }), empReadings: [reading(`${MONDAY}T06:00:00Z`)] }));
    expect(row.employeeId).toBe("");
    expect(row.cardNumber).toBe("");
    expect(row.detailedLogs[0]).toMatchObject({ direction: "unknown", action: "Yön belirtilmemiş" });
  });
});


describe("pdksTable – punches and breaks", () => {
  const shift = { name: "Gündüz", startTime: "09:00", endTime: "18:00", breakStart: "12:00", breakEnd: "13:00" } as Doc<"shifts">;
  const matrix = (overrides: Partial<RowParams> = {}) => computePdksTableRow(rowParams({
    viewMode: "matrix", isSingleDay: false, includePunches: true, resolveShift: () => shift, ...overrides,
  })).days[0]?.detail;

  it("keeps sorted real granted punches even on manually overridden days", () => {
    const detail = matrix({
      empReadings: [
        reading(`${MONDAY}T15:00:00Z`, { direction: "exit" }),
        reading(`${MONDAY}T09:30:00Z`, { accessStatus: "reddedildi" }),
        reading(`${MONDAY}T06:00:00Z`, { direction: "entry" }),
        reading(`${TUESDAY}T06:00:00Z`),
      ],
      manualPdksByEmpDate: new Map([[`${EMP_ID}__${MONDAY}`, manual(MONDAY, "10:00", "15:00")]]),
    });
    expect(detail).toMatchObject({
      punches: [{ time: "09:00", direction: "entry" }, { time: "18:00", direction: "exit" }],
      plannedBreakStart: "12:00", plannedBreakEnd: "13:00", breakViolation: false, isManual: true,
    });
  });

  it.each([undefined, false, true])("only includes punches when requested (%s) while preserving other detail", (includePunches) => {
    const detail = matrix({ includePunches, empReadings: [reading(`${MONDAY}T06:00:00Z`), reading(`${MONDAY}T15:00:00Z`)] });
    expect(detail).toMatchObject({ readingCount: 2, breakViolation: true, plannedBreakStart: "12:00", plannedBreakEnd: "13:00" });
    expect(detail?.punches).toHaveLength(includePunches ? 2 : 0);
  });

  it("uses Istanbul minutes for break punches and falls back to unknown direction", () => {
    expect(matrix({ empReadings: [reading(`${MONDAY}T06:00:00Z`), reading(`${MONDAY}T09:00:00Z`), reading(`${MONDAY}T15:00:00Z`)] }))
      .toMatchObject({ breakViolation: false, punches: [{ time: "09:00", direction: "unknown" }, { time: "12:00", direction: "unknown" }, { time: "18:00", direction: "unknown" }] });
    expect(matrix({ resolveShift: () => null })).toMatchObject({ punches: [], plannedBreakStart: null, plannedBreakEnd: null, breakViolation: false });
  });

  it("caps the payload at the first 24 punches but checks the complete day for breaks", () => {
    const early = Array.from({ length: 25 }, (_, minute) => reading(`${MONDAY}T06:${String(minute).padStart(2, "0")}:00Z`));
    const detail = matrix({ empReadings: [reading(`${MONDAY}T15:00:00Z`), reading(`${MONDAY}T09:30:00Z`), ...early.reverse()] });
    expect(detail?.punches).toHaveLength(24);
    expect(detail?.punches[0]?.time).toBe("09:00");
    expect(detail?.punches[23]?.time).toBe("09:23");
    expect(detail?.readingCount).toBe(27);
    expect(detail?.breakViolation).toBe(false);
  });
});

describe("08-H1/O1 ve 11-H1", () => {
  it("proje okuması yoksa devamsızlık üretmez; ilk kayıttan önce puantaj ve sayaç dışıdır", () => {
    const row = computePdksTableRow(rowParams({ firstRecordDate: TUESDAY, viewMode: "matrix", availableDateKeys: new Set([MONDAY]) }));
    expect(row.status).toBe("notEmployed");
    expect(row.days[0]).toMatchObject({ status: "notEmployed", payrollCode: "—" });
    expect(computePdksTableRow(rowParams({ availableDateKeys: new Set() })).status).toBe("noData");
  });
  it("atanmış vardiya+tolerans sınırında henüz gelmedi; sonrasında veri varsa devamsız", () => {
    const shift = { startTime: "09:00", endTime: "18:00" } as Doc<"shifts">;
    const input = rowParams({ today: MONDAY, firstRecordDate: MONDAY, resolveShift: () => shift, viewMode: "matrix", workSettings: { ...DEFAULT_WORK_SETTINGS, maxLateMinutes: 10 } });
    const before = computePdksTableRow({ ...input, now: Date.parse(`${MONDAY}T09:10:00+03:00`) });
    expect(before.status).toBe("future");
    expect(computePdksTableRow({ ...input, firstRecordDate: null, now: Date.parse(`${MONDAY}T09:00:00+03:00`) }).status).toBe("future");
    expect(before.days[0]?.status).toBe("future");
    const after = computePdksTableRow({ ...input, now: Date.parse(`${MONDAY}T09:10:01+03:00`) });
    expect(after.status).toBe("absent");
    expect(after.days[0]?.status).toBe("absent");
    expect(computePdksTableRow({ ...input, availableDateKeys: new Set(), now: Date.parse(`${MONDAY}T09:10:01+03:00`) }).status).toBe("noData");
  });
  it("vardiya atanmayan kişiyi devamsız saymaz", () => {
    expect(computePdksTableRow(rowParams({ firstRecordDate: MONDAY })).status).toBe("noData");
  });
});

describe("R3B-E1: noData only suppresses absence", () => {
  it.each([null, TUESDAY])("leave survives missing/later first record (%s)", firstRecordDate => {
    const row = computePdksTableRow(rowParams({ firstRecordDate, availableDateKeys: new Set(), allLeaves: [leave(MONDAY, MONDAY)], viewMode: "matrix" }));
    expect(row.days[0]).toMatchObject({ status: "leave", payrollCode: "İZN" });
  });
  it.each([false, true])("public holiday survives no readings, including half day (%s)", isHalfDay => {
    const row = computePdksTableRow(rowParams({ firstRecordDate: null, availableDateKeys: new Set(), holidayMap: new Map([[MONDAY, { ...holiday(MONDAY), isHalfDay }]]), viewMode: "matrix" }));
    expect(row.days[0]).toMatchObject({ status: "holiday", payrollCode: "RT" });
  });
  it("Sunday remains HT and an ordinary workday remains noData", () => {
    const row = computePdksTableRow(rowParams({ firstRecordDate: null, availableDateKeys: new Set(), periodDateKeys: ["2026-06-28", MONDAY], viewMode: "matrix" }));
    expect(row.days[0]).toMatchObject({ status: "weekend", payrollCode: "HT" });
    expect(row.days[1]).toMatchObject({ status: "noData", payrollCode: "—" });
  });
});

it("R3B-E1: known attendance retains its status before the inferred first record, including holiday/leave days", () => {
  const row = computePdksTableRow(rowParams({
    firstRecordDate: TUESDAY, availableDateKeys: new Set(), viewMode: "matrix",
    empReadings: [reading(`${MONDAY}T06:00:00Z`)],
    allLeaves: [leave(MONDAY, MONDAY)], holidayMap: new Map([[MONDAY, holiday(MONDAY)]]),
  }));
  expect(row.days[0]).toMatchObject({ status: "present", payrollCode: "RT" });
});
