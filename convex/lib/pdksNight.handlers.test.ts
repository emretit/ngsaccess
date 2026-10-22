import { afterEach, describe, expect, it, vi } from "vitest";
import type { FunctionReturnType } from "convex/server";
import type { api } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx, MutationCtx } from "../_generated/server";
import {
  getPdksTableData,
  getMonthlyPayrollSheet,
  getEmployeeAttendanceDetail,
} from "../cardReadings";
import { upsertManual, bulkUpsertManual, previewManualShifts } from "../pdksRecords";
import { loadAttendanceReport } from "./reportAttendance";
import * as availability from "./pdksAvailability";
import * as workDays from "./pdksWorkDay";
import { pdksAvailableDateKeys } from "./pdksAvailability";
import { combineNightMultiplier, computePdksDay } from "./pdksDay";
import {
  buildPdksWorkDateResolver,
  groupPdksWorkDays,
  manualPdksTimes,
  pdksWorkDay,
  pdksWorkDayRange,
} from "./pdksWorkDay";
import {
  DEFAULT_OVERTIME_RATES,
  DEFAULT_WORK_SETTINGS,
  type NightCombineMode,
} from "./pdksHelpers";

vi.mock("./customFunctions", () => {
  const register = (config: unknown) => config;
  return {
    authedQuery: register,
    authedMutation: register,
    employeeAuthedQuery: register,
    employeeAuthedMutation: register,
  };
});
vi.mock("./auth", async (original) => ({
  ...(await original<typeof import("./auth")>()),
  getProjectIdsForUser: async () => ["p"],
}));
vi.mock("./audit", () => ({ writeAudit: vi.fn() }));
afterEach(() => vi.restoreAllMocks());
const projectId = "p" as Id<"projects">;
const employeeId = "e" as Id<"employees">;
const date = "2026-06-30";
const employee = {
  _id: employeeId,
  _creationTime: 0,
  projectId,
  firstName: "Ada",
  lastName: "Test",
  email: "ada@example.com",
  cardNumber: "123",
  isActive: true,
  hourlyRate: 100,
} satisfies Doc<"employees">;
const shift = {
  _id: "s" as Id<"shifts">,
  _creationTime: 0,
  projectId,
  name: "Gece",
  startTime: "22:00",
  endTime: "06:00",
  createdAt: "",
  updatedAt: "",
  overtimeStartToleranceMinutes: 0,
} satisfies Doc<"shifts">;
const reading = (time: string, i: number): Doc<"cardReadings"> => ({
  _id: `r${i}` as Id<"cardReadings">,
  _creationTime: 0,
  projectId,
  employeeId,
  cardNo: "123",
  accessStatus: "izin_verildi",
  accessTime: new Date(time).toISOString(),
  hikCurrentVerifyMode: "card",
});
const punches = [
  reading(`${date}T22:00:00+03:00`, 1),
  reading("2026-07-01T06:00:00+03:00", 2),
];
const workingDays = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma"];
function fixture(readings = punches, assigned = true, extraRows: Record<string, Record<string, unknown>[]> = {}) {
  const rows: Record<string, Record<string, unknown>[]> = {
    employees: [employee],
    cardReadings: readings,
    shifts: assigned ? [shift] : [],
    shiftAssignments: assigned
      ? [
          {
            _id: "a",
            employeeId,
            shiftId: shift._id,
            startDate: date,
            endDate: date,
            updatedAt: "",
          },
        ]
      : [],
  };
  Object.assign(rows, extraRows);
  const insert = vi.fn(async () => "manual" as Id<"pdksRecords">);
  const visits: { table: string; index?: string; method: string }[] = [];
  const query = vi.fn((table: string) => {
    let indexName: string | undefined;
    let selected = rows[table] ?? [];
    const index = {
      eq: (field: string, value: unknown) => {
        selected = selected.filter((row) => row[field] === value);
        return index;
      },
      gte: (field: string, value: string) => {
        selected = selected.filter(
          (row) => typeof row[field] === "string" && row[field] >= value,
        );
        return index;
      },
      lte: (field: string, value: string) => {
        selected = selected.filter(
          (row) => typeof row[field] === "string" && row[field] <= value,
        );
        return index;
      },
    };
    const chain = {
      withIndex: (_name: string, configure: (q: typeof index) => unknown) => {
        indexName = _name;
        configure(index);
        return chain;
      },
      filter: () => chain,
      order: () => chain,
      [Symbol.asyncIterator]: async function* () { for (const row of selected) { visits.push({ table, index: indexName, method: "yield" }); yield row; } },
      collect: async () => { visits.push({ table, index: indexName, method: "collect" }); return [...selected]; },
      take: async (n: number) => selected.slice(0, n),
      first: async () => selected[0] ?? null,
    };
    return chain;
  });
  const ctx = {
    user: { _id: "u", role: "super_admin" },
    db: {
      query,
      get: async (id: string) =>
        Object.values(rows)
          .flat()
          .find((row) => row._id === id) ?? null,
      insert,
      patch: vi.fn(),
    },
  } as unknown as QueryCtx & MutationCtx;
  return { ctx, insert, query, visits };
}
async function call<T>(
  fn: unknown,
  ctx: QueryCtx | MutationCtx,
  args: object,
): Promise<T> {
  return (
    fn as {
      handler: (context: QueryCtx | MutationCtx, args: object) => Promise<T>;
    }
  ).handler(ctx, args);
}
async function threePaths(readings = punches, assigned = true) {
  const { ctx } = fixture(readings, assigned);
  const table = await call<
    FunctionReturnType<typeof api.cardReadings.getPdksTableData>
  >(getPdksTableData, ctx, {
    projectId,
    startDate: date,
    endDate: date,
    viewMode: "matrix",
  });
  const payroll = await call<
    FunctionReturnType<typeof api.cardReadings.getMonthlyPayrollSheet>
  >(getMonthlyPayrollSheet, ctx, { projectId, year: 2026, month: 6 });
  const detail = await call<
    FunctionReturnType<typeof api.cardReadings.getEmployeeAttendanceDetail>
  >(getEmployeeAttendanceDetail, ctx, {
    projectId,
    employeeId,
    startDate: date,
    endDate: date,
  });
  return {
    table: table[0],
    cell: payroll.rows[0]?.cells.find((cell) => cell.date === date),
    payroll: payroll.rows[0],
    detail: detail?.days[0],
    ctx,
  };
}

describe("08-H2 / 11-H2 real query paths", () => {
  it("month-end overnight punches form one 8-hour gross work day in table, payroll, detail and scheduled loader", async () => {
    const result = await threePaths();
    for (const day of [result.table?.days[0], result.cell, result.detail]) {
      expect(day).toMatchObject({
        date,
        rawTotalMinutes: 480,
        totalMinutes: 420,
        overtimeMinutes: 0,
        nightMinutes: 420,
      });
    }
    expect(result.table).toMatchObject({
      firstEntry: "22:00",
      lastExit: "06:00",
      totalMinutes: 420,
      overtimeMinutes: 0,
    });
    expect(result.detail).toMatchObject({
      exitNextDay: true,
      isOvernightShift: true,
      isLate: false,
      isEarlyExit: false,
    });
    expect(result.payroll?.totals).toMatchObject({
      totalMinutes: 420,
      overtimeMinutes: 0,
    });
    expect(result.payroll?.department).toBe("Departmansız");
    const report = await loadAttendanceReport(result.ctx, [projectId], 2026, 6);
    expect(report.rows[0]).toMatchObject({
      presentDays: 1,
      department: "Departmansız",
    });
    expect(pdksWorkDayRange(date, date).endISO).toBe(
      "2026-07-01T20:59:59.999Z",
    );
  });
  it("unassigned overnight readings stay on separate calendar days", async () => {
    const result = await threePaths(punches, false);
    for (const day of [result.table?.days[0], result.cell, result.detail])
      expect(day).toMatchObject({
        totalMinutes: 0,
        overtimeMinutes: 0,
        rawTotalMinutes: 0,
      });
    expect(pdksWorkDay(punches[1].accessTime, employeeId, () => null)).toBe(
      "2026-07-01",
    );
  });
  it("8-minute late pair cannot generate 42 minutes overtime; all paths use the same net calculation", async () => {
    const result = await threePaths(
      [
        reading(`${date}T18:49:00+03:00`, 1),
        reading(`${date}T18:57:00+03:00`, 2),
      ],
      false,
    );
    for (const day of [result.table?.days[0], result.cell, result.detail])
      expect(day).toMatchObject({
        rawTotalMinutes: 8,
        totalMinutes: 0,
        overtimeMinutes: 0,
      });
    expect(result.payroll?.totals.overtimeMinutes).toBe(
      result.table?.overtimeMinutes,
    );
  });
  it("daily cells and monthly total agree under the weekly rule", async () => {
    const result = await threePaths(
      [
        reading(`${date}T09:00:00+03:00`, 1),
        reading(`${date}T20:00:00+03:00`, 2),
      ],
      false,
    );
    for (const day of [result.table?.days[0], result.cell, result.detail])
      expect(day).toMatchObject({ totalMinutes: 600, overtimeMinutes: 0 });
    expect(result.payroll?.totals.overtimeMinutes).toBe(0);
  });
  it("previous overnight shift remains authoritative when today's assignment changes", () => {
    const resolve = (_id: Id<"employees">, day: string) =>
      day === date ? shift : { ...shift, startTime: "09:00", endTime: "18:00" };
    expect(
      groupPdksWorkDays(punches, employeeId, resolve).get(date),
    ).toHaveLength(2);
    expect(pdksWorkDay("2026-07-01T09:00:00+03:00", employeeId, resolve)).toBe(
      "2026-07-01",
    );
  });
});

describe("13-H1 night minutes and overtime pay", () => {
  it.each([
    ["max", 1400],
    ["multiply", 2100],
    ["additive", 1750],
    [undefined, 1400],
  ] as const)(
    "%s: uses the configured combination, default=max",
    (mode, pay) => {
      const day = computePdksDay({
        date: "2026-06-27",
        readings: [],
        manual: { entryTime: "22:00", exitTime: "06:00" } as Doc<"pdksRecords">,
        shift,
        workSettings: DEFAULT_WORK_SETTINGS,
        workingDays,
        overtimeRates: { ...DEFAULT_OVERTIME_RATES, nightCombineMode: mode },
        hourlyRate: 100,
      });
      expect(day).toMatchObject({
        rawTotalMinutes: 480,
        totalMinutes: 420,
        nightMinutes: 420,
        overtimeMinutes: 420,
        nightOvertimeMinutes: 420,
        overtimePayTRY: pay,
      });
    },
  );
  it("combination function covers three modes and missing mode", () => {
    const modes: Array<NightCombineMode | undefined> = [
      "max",
      "multiply",
      "additive",
      undefined,
    ];
    expect(modes.map((mode) => combineNightMultiplier(2, 1.5, mode))).toEqual([
      2, 3, 2.5, 2,
    ]);
  });
  it("ordinary night work is visible without overtime premium; configured window controls minutes", () => {
    const day = computePdksDay({
      date,
      readings: punches,
      shift,
      workSettings: DEFAULT_WORK_SETTINGS,
      workingDays,
      overtimeRates: {
        ...DEFAULT_OVERTIME_RATES,
        nightShiftStart: "23:00",
        nightShiftEnd: "05:00",
      },
      hourlyRate: 100,
    });
    expect(day).toMatchObject({
      nightMinutes: 315,
      overtimeMinutes: 0,
      overtimePayTRY: null,
    });
  });
  it("daytime overtime uses only the day rate even with a large night multiplier", () => {
    const day = computePdksDay({
      date,
      readings: [
        reading(`${date}T09:00:00+03:00`, 1),
        reading(`${date}T20:00:00+03:00`, 2),
      ],
      shift: null,
      workSettings: DEFAULT_WORK_SETTINGS,
      workingDays,
      overtimeRates: {
        ...DEFAULT_OVERTIME_RATES,
        nightShiftMultiplier: 10,
        nightCombineMode: "multiply",
      },
      hourlyRate: 100,
    });
    expect(day).toMatchObject({
      nightMinutes: 0,
      overtimeMinutes: 105,
      overtimePayTRY: 262.5,
    });
  });
});

describe("08-H2 manual server boundary", () => {
  it.each([upsertManual, bulkUpsertManual])(
    "only an assigned overnight shift permits exit before entry",
    async (mutation) => {
      const args = {
        employeeId,
        date,
        entryTime: "22:00",
        exitTime: "06:00",
        note: "Kart unutuldu",
      };
      const callArgs =
        mutation === upsertManual ? args : { rows: [args], note: args.note };
      const night = fixture();
      await call(mutation, night.ctx, callArgs);
      expect(night.insert).toHaveBeenCalledWith(
        "pdksRecords",
        expect.objectContaining({
          date,
          entryTime: "22:00",
          exitTime: "06:00",
        }),
      );
      const unassigned = fixture([], false);
      if (mutation === upsertManual)
        await expect(call(mutation, unassigned.ctx, callArgs)).rejects.toThrow(
          "Çıkış saati giriş saatinden sonra olmalı",
        );
      else
        expect(await call(mutation, unassigned.ctx, callArgs)).toMatchObject({
          inserted: 0,
          errors: [
            {
              index: 0,
              message: expect.stringContaining(
                "Çıkış saati giriş saatinden sonra olmalı",
              ),
            },
          ],
        });
      expect(unassigned.insert).not.toHaveBeenCalled();
      expect(manualPdksTimes(date, args, shift).exitISO).toBe(
        "2026-07-01T06:00:00.000+03:00",
      );
    },
  );
});

it("overnight exits do not manufacture next-day data availability", () => {
  const workDate = buildPdksWorkDateResolver([employee], () => shift);
  expect([...pdksAvailableDateKeys(punches, workDate)]).toEqual([date]);
});

it("scheduled midnight break is removed from night minutes once", () => {
  const day = computePdksDay({
    date,
    readings: punches,
    shift: { ...shift, breakStart: "23:30", breakEnd: "00:30" },
    workSettings: DEFAULT_WORK_SETTINGS,
    workingDays,
    overtimeRates: DEFAULT_OVERTIME_RATES,
  });
  expect(day).toMatchObject({
    rawTotalMinutes: 480,
    totalMinutes: 420,
    nightMinutes: 420,
    overtimeMinutes: 0,
  });
});

it("only the overtime segment inside the night window receives the night rate", () => {
  const day = computePdksDay({
    date,
    readings: [],
    manual: { entryTime: "18:00", exitTime: "23:00" } as Doc<"pdksRecords">,
    shift: {
      ...shift,
      startTime: "18:00",
      endTime: "20:00",
      breakStart: "19:00",
      breakEnd: "19:30",
    },
    workSettings: DEFAULT_WORK_SETTINGS,
    workingDays,
    overtimeRates: {
      ...DEFAULT_OVERTIME_RATES,
      nightShiftMultiplier: 2,
      nightCombineMode: "multiply",
    },
    hourlyRate: 100,
  });
  expect(day).toMatchObject({
    totalMinutes: 270,
    nightMinutes: 60,
    overtimeMinutes: 180,
    nightOvertimeMinutes: 60,
    multiplier: 2,
    overtimePayTRY: 600,
  });
});

it("a scheduled break inside night overtime receives no overtime or night pay", () => {
  const day = computePdksDay({
    date,
    readings: [],
    manual: { entryTime: "18:00", exitTime: "23:00" } as Doc<"pdksRecords">,
    shift: {
      ...shift,
      startTime: "18:00",
      endTime: "20:00",
      breakStart: "22:15",
      breakEnd: "22:45",
    },
    workSettings: DEFAULT_WORK_SETTINGS,
    workingDays,
    overtimeRates: {
      ...DEFAULT_OVERTIME_RATES,
      nightShiftMultiplier: 2,
      nightCombineMode: "multiply",
    },
    hourlyRate: 100,
  });
  expect(day).toMatchObject({
    totalMinutes: 270,
    nightMinutes: 30,
    overtimeMinutes: 150,
    nightOvertimeMinutes: 30,
    overtimePayTRY: 450,
  });
});

it("equal start/end assigned shift permits a full next-day interval", () => {
  const fullDay = { ...shift, startTime: "22:00", endTime: "22:00" };
  const entry = { ...reading(`${date}T22:00:00+03:00`, 1), direction: "entry" };
  const exit = {
    ...reading("2026-07-01T22:00:00+03:00", 2),
    direction: "exit",
  };
  expect(
    groupPdksWorkDays([entry, exit], employeeId, () => fullDay).get(date),
  ).toHaveLength(2);
  expect(
    manualPdksTimes(date, { entryTime: "22:00", exitTime: "22:00" }, fullDay)
      .exitNextDay,
  ).toBe(true);
});

describe("R3B regression paths", () => {
  it.each([undefined, projectId, "foreign" as Id<"projects">])("E1/D5: legacy and scoped leave agree in every loader (%s)", async leaveProjectId => {
    const { ctx } = fixture([], false, { leaves: [{ _id: "leave", employeeId, projectId: leaveProjectId, startDate: date, endDate: date, status: "approved", leaveType: "annual" }] });
    const table = await call<FunctionReturnType<typeof api.cardReadings.getPdksTableData>>(getPdksTableData, ctx, { projectId, startDate: date, endDate: date, viewMode: "matrix" });
    const payroll = await call<FunctionReturnType<typeof api.cardReadings.getMonthlyPayrollSheet>>(getMonthlyPayrollSheet, ctx, { projectId, year: 2026, month: 6 });
    const detail = await call<FunctionReturnType<typeof api.cardReadings.getEmployeeAttendanceDetail>>(getEmployeeAttendanceDetail, ctx, { projectId, employeeId, startDate: date, endDate: date });
    const report = await loadAttendanceReport(ctx, [projectId], 2026, 6);
    const allowed = leaveProjectId !== "foreign";
    const code = allowed ? "İZN" : "—";
    expect(table[0]?.days[0]?.payrollCode).toBe(code);
    expect(payroll.rows[0]?.cells.find(cell => cell.date === date)?.payrollCode).toBe(code);
    expect(detail?.days[0]?.status).toBe(allowed ? "leave" : "noData");
    expect(payroll.rows[0]?.totals.leaveDays).toBe(allowed ? 1 : 0);
    expect(report.rows[0]?.leaveDays).toBe(allowed ? 1 : 0);
  });

  it("D1: project availability and work-date resolver are built once for 300 people in each loader", async () => {
    const employees = Array.from({ length: 300 }, (_, index) => ({ ...employee, _id: `e${index}` as Id<"employees">, cardNumber: `card${index}` }));
    const readings = employees.flatMap((emp, index) => punches.map(punch => ({ ...punch, employeeId: emp._id, cardNo: emp.cardNumber, _id: `${index}-${punch._id}` as Id<"cardReadings"> })));
    const { ctx } = fixture(readings, false, { employees });
    const resolver = vi.spyOn(workDays, "buildPdksWorkDateResolver");
    const projects = vi.spyOn(availability, "pdksAvailableDatesByProject");
    const manual = vi.spyOn(availability, "pdksManualDatesByEmployee");
    const reportDates = vi.spyOn(availability, "pdksAvailableDateKeys");
    await call(getPdksTableData, ctx, { projectId, startDate: date, endDate: date });
    expect(resolver).toHaveBeenCalledTimes(1);
    expect(projects).toHaveBeenCalledTimes(1);
    expect(manual).toHaveBeenCalledTimes(1);
    await call(getMonthlyPayrollSheet, ctx, { projectId, year: 2026, month: 6 });
    expect(resolver).toHaveBeenCalledTimes(2);
    expect(projects).toHaveBeenCalledTimes(2);
    expect(manual).toHaveBeenCalledTimes(2);
    await loadAttendanceReport(ctx, [projectId], 2026, 6);
    expect(resolver).toHaveBeenCalledTimes(3);
    expect(reportDates).toHaveBeenCalledTimes(1);
  });

  it("D2: another employee's night exit does not create next-day availability, including a filtered table", async () => {
    const otherId = "other" as Id<"employees">;
    const dayShift = { ...shift, _id: "day" as Id<"shifts">, startTime: "09:00", endTime: "18:00" };
    const target = { ...employee, shiftId: dayShift._id };
    const other = { ...employee, _id: otherId, cardNumber: "other", shiftId: shift._id };
    const readings = [reading("2026-06-29T09:00:00+03:00", 1), { ...reading(`${date}T06:00:00+03:00`, 2), employeeId: otherId, cardNo: "other" }];
    const { ctx, visits } = fixture(readings, false, { employees: [target, other], shifts: [shift, dayShift] });
    const table = await call<FunctionReturnType<typeof api.cardReadings.getPdksTableData>>(getPdksTableData, ctx, { projectId, employeeId, startDate: date, endDate: date, viewMode: "matrix" });
    visits.length = 0;
    const detail = await call<FunctionReturnType<typeof api.cardReadings.getEmployeeAttendanceDetail>>(getEmployeeAttendanceDetail, ctx, { projectId, employeeId, startDate: date, endDate: date });
    expect(table[0]?.days[0]?.status).toBe("noData");
    expect(detail?.days[0]?.status).toBe(table[0]?.days[0]?.status);
    expect(visits.filter(visit => visit.table === "cardReadings" && visit.index === "by_project_access_time" && visit.method === "collect")).toHaveLength(0);
    expect(visits.filter(visit => visit.table === "cardReadings" && visit.method === "collect").every(visit => visit.index === "by_project_employee_time")).toBe(true);
  });

  it("D2: availability stops reading dense project data after the first matching row", async () => {
    const { ctx, visits } = fixture(Array.from({ length: 500 }, (_, index) => reading(`${date}T09:00:00+03:00`, index)), false);
    expect(await availability.readPdksAvailableDateKeys(ctx, projectId, [date], row => row.accessTime.slice(0, 10))).toEqual(new Set([date]));
    expect(visits.filter(visit => visit.method === "yield")).toHaveLength(1);
    expect(visits.filter(visit => visit.method === "collect")).toHaveLength(0);
  });

  it("D4: 50-hour week allocates all 300 overtime minutes to Friday", async () => {
    const readings = Array.from({ length: 5 }, (_, index) => `2026-06-${22 + index}`).flatMap(day => [reading(`${day}T09:00:00+03:00`, 1), reading(`${day}T20:00:00+03:00`, 2)]);
    const { ctx } = fixture(readings, false);
    const result = await call<FunctionReturnType<typeof api.cardReadings.getMonthlyPayrollSheet>>(getMonthlyPayrollSheet, ctx, { projectId, year: 2026, month: 6 });
    expect(result.rows[0]?.totals).toMatchObject({ totalMinutes: 3000, overtimeMinutes: 300 });
    expect(result.rows[0]?.cells.filter(cell => cell.totalMinutes > 0).map(cell => cell.overtimeMinutes)).toEqual([0, 0, 0, 0, 300]);
  });

  it("D6: N manual rows load shifts once and assignments once per unique employee", async () => {
    const { ctx, query } = fixture();
    const rows = Array.from({ length: 30 }, () => ({ employeeId, date, entryTime: "22:00", exitTime: "06:00" }));
    const result = await call(bulkUpsertManual, ctx, { note: "CSV gerekçesi", rows });
    expect(result).toMatchObject({ inserted: 30, errors: [] });
    expect(query.mock.calls.filter(([table]) => table === "shifts")).toHaveLength(1);
    expect(query.mock.calls.filter(([table]) => table === "shiftAssignments")).toHaveLength(1);
  });

  it("D7: preview resolves the dated assignment and excludes employees outside the selected project", async () => {
    const { ctx } = fixture();
    expect(await call(previewManualShifts, ctx, { projectId, rows: [{ employeeId, date }, { employeeId, date: "2026-07-01" }] })).toEqual([{ key: `${employeeId}__${date}`, startTime: "22:00", endTime: "06:00" }]);
    const foreign = fixture([], true, { employees: [{ ...employee, projectId: "foreign" }] });
    expect(await call(previewManualShifts, foreign.ctx, { projectId, rows: [{ employeeId, date }] })).toEqual([]);
  });
});

it("R3B-D2: indexed detail preserves legacy card-only punches and matches the table", async () => {
  const result = await threePaths(punches.map(punch => ({ ...punch, employeeId: undefined })));
  expect(result.table?.days[0]).toMatchObject({ status: "present", totalMinutes: 420 });
  expect(result.detail).toMatchObject({ status: "present", totalMinutes: 420 });
});
