import { afterEach, describe, expect, it, vi } from "vitest";
import type { FunctionReturnType } from "convex/server";
import type { api } from "../_generated/api";
import type { QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import {
  getEmployeeAttendanceDetail, getMonthlyPayrollSheet, getPdksTableData,
} from "../cardReadings";
import { DEFAULT_OVERTIME_RATES, getEffectiveOvertimeRates } from "./pdksHelpers";
import { addWorkDate } from "./pdksWorkDay";
import { saveOvertime } from "../settings";

afterEach(() => vi.useRealTimers());

vi.mock("./customFunctions", () => {
  const register = (config: unknown) => config;
  return { authedQuery: register, optionalAuthQuery: register, authedMutation: register, employeeAuthedQuery: register, employeeAuthedMutation: register };
});
vi.mock("./auth", async (original) => ({
  ...(await original<typeof import("./auth")>()), getProjectIdsForUser: async () => ["p"],
}));

type Row = Record<string, unknown>;
/** In-memory mock only; index and filter predicates really restrict the rows. */
function fixture(extra: Record<string, Row[]> = {}) {
  const rows: Record<string, Row[]> = {
    employees: [{ _id: "e", projectId: "p", firstName: "Test", lastName: "Worker", cardNumber: "123", isActive: true, hourlyRate: 100 }],
    workSettings: [{ projectId: "p", overtimeStartToleranceMinutes: 0 }],
    ...extra,
  };
  const bounds: Array<{ table: string; field: string; value: string; operator: "gte" | "lte" }> = [];
  const query = (table: string) => {
    let selected = rows[table] ?? [];
    const index = {
      eq(field: string, value: unknown) { selected = selected.filter((r) => r[field] === value); return index; },
      gte(field: string, value: string) {
        bounds.push({ table, field, value, operator: "gte" });
        selected = selected.filter((r) => typeof r[field] === "string" && r[field] >= value);
        return index;
      },
      lte(field: string, value: string) {
        bounds.push({ table, field, value, operator: "lte" });
        selected = selected.filter((r) => typeof r[field] === "string" && r[field] <= value);
        return index;
      },
    };
    const expression = (row: Row) => ({
      field: (name: string) => row[name],
      eq: (a: unknown, b: unknown) => a === b,
      gte: (a: unknown, b: string) => typeof a === "string" && a >= b,
      lte: (a: unknown, b: string) => typeof a === "string" && a <= b,
      and: (...values: boolean[]) => values.every(Boolean),
    });
    const chain = {
      withIndex(_name: string, configure: (q: typeof index) => unknown) { configure(index); return chain; },
      filter(predicate: (q: ReturnType<typeof expression>) => boolean) {
        selected = selected.filter((row) => predicate(expression(row))); return chain;
      },
      order: () => chain,
      collect: async () => [...selected],
      first: async () => selected[0] ?? null,
      take: async (n: number) => selected.slice(0, n),
      [Symbol.asyncIterator]: async function* () { yield* selected; },
    };
    return chain;
  };
  const ctx = {
    user: { _id: "u", role: "super_admin" },
    db: { query, get: async (id: string) => Object.values(rows).flat().find((row) => row._id === id) ?? null,
      patch: async (id: string, patch: Row) => {
        const row = Object.values(rows).flat().find((r) => r._id === id);
        if (row) Object.assign(row, patch);
      },
      insert: async (table: string, value: Row) => {
        const id = `${table}_new`;
        (rows[table] ??= []).push({ ...value, _id: id });
        return id;
      },
    },
  } as unknown as QueryCtx;
  return { ctx, bounds, rows };
}
async function call<T>(fn: unknown, ctx: QueryCtx, args: object): Promise<T> {
  return (fn as { handler: (ctx: QueryCtx, args: object) => Promise<T> }).handler(ctx, args);
}
async function summaries(ctx: QueryCtx, month: number) {
  const startDate = `2026-${String(month).padStart(2, "0")}-01`;
  const endDate = `2026-${String(month).padStart(2, "0")}-${new Date(Date.UTC(2026, month, 0)).getUTCDate()}`;
  const payroll = await call<FunctionReturnType<typeof api.cardReadings.getMonthlyPayrollSheet>>(
    getMonthlyPayrollSheet, ctx, { projectId: "p", year: 2026, month },
  );
  const table = await call<FunctionReturnType<typeof api.cardReadings.getPdksTableData>>(
    getPdksTableData, ctx, { projectId: "p", startDate, endDate, viewMode: "matrix" },
  );
  const detail = await call<FunctionReturnType<typeof api.cardReadings.getEmployeeAttendanceDetail>>(
    getEmployeeAttendanceDetail, ctx, { projectId: "p", employeeId: "e", startDate, endDate },
  );
  return { payroll: payroll.rows[0]?.totals, table: table[0], detail: detail?.summary, detailDays: detail?.days, payrollDays: payroll.rows[0]?.cells };
}
const readingsFor = (date: string, entry = "09:00", exit = "20:00", exitDate = date) =>
  [[date, entry], [exitDate, exit]].map(([day, time], i) => ({
    _id: `${date}_${i}`, projectId: "p", employeeId: "e", cardNo: "123",
    accessTime: new Date(`${day}T${time}:00+03:00`).toISOString(),
    accessStatus: "izin_verildi", hikCurrentVerifyMode: "card",
  }));

describe("overtime loader boundary regression", () => {
  it.each(["readings", "manual"] as const)("loads preceding week dates for %s; old documents default to weekly45", async (source) => {
    const dates = [0, 1, 2, 3, 4].map((i) => addWorkDate("2026-06-29", i));
    const { ctx, bounds } = fixture(source === "readings"
      ? { cardReadings: dates.flatMap((d) => readingsFor(d)) }
      : { pdksRecords: dates.map((date) => ({ date, projectId: "p", employeeId: "e", manualEntry: true, entryTime: "09:00", exitTime: "20:00" })) });
    expect(await getEffectiveOvertimeRates(ctx, "p" as Id<"projects">))
      .toMatchObject({ overtimeBasis: "weekly45", nightShiftDayMode: "shiftStart" });
    const june = await summaries(ctx, 6);
    const july = await summaries(ctx, 7);
    for (const result of [june.payroll, june.table, june.detail])
      expect(result).toMatchObject({ totalMinutes: 1200, overtimeMinutes: 0, overtimePayTRY: 0 });
    for (const result of [july.payroll, july.table, july.detail])
      expect(result).toMatchObject({ totalMinutes: 1800, overtimeMinutes: 300, overtimePayTRY: 750 });
    expect(july.payrollDays).toHaveLength(31);
    expect(bounds.some((b) => b.table === "cardReadings" && b.field === "accessTime" && b.value.startsWith("2026-06-28T21:00"))).toBe(true);
    expect(bounds.some((b) => b.table === "pdksRecords" && b.field === "date" && b.value === "2026-06-29")).toBe(true);
  });

  it("persisted dailyShift books each date in its own month in all three handlers", async () => {
    const { ctx, bounds } = fixture({
      cardReadings: [0, 1, 2, 3, 4].flatMap((i) => readingsFor(addWorkDate("2026-06-29", i))),
      overtimeRates: [{ ...DEFAULT_OVERTIME_RATES, projectId: "p", overtimeBasis: "dailyShift" }],
    });
    const june = await summaries(ctx, 6);
    const juneBounds = bounds.splice(0);
    const july = await summaries(ctx, 7);
    for (const result of [june.payroll, june.table, june.detail])
      expect(result).toMatchObject({ overtimeMinutes: 240, overtimePayTRY: 600 });
    for (const result of [july.payroll, july.table, july.detail])
      expect(result).toMatchObject({ overtimeMinutes: 360, overtimePayTRY: 900 });
    for (const [loadedBounds, lower, upper] of [
      [juneBounds, "2026-05-31T21:00:00.000Z", "2026-07-01T20:59:59.999Z"],
      [bounds, "2026-06-30T21:00:00.000Z", "2026-08-01T20:59:59.999Z"],
    ] as const) {
      expect(loadedBounds.filter((b) => b.table === "cardReadings" && b.operator === "gte").every((b) => b.value >= lower)).toBe(true);
      expect(loadedBounds.filter((b) => b.table === "cardReadings" && b.operator === "lte").every((b) => b.value <= upper)).toBe(true);
    }
    expect(bounds.filter((b) => b.table === "pdksRecords" && b.operator === "gte").every((b) => b.value === "2026-07-01")).toBe(true);
  });

  it("Friday single-day, weekly row, detail and payroll agree", async () => {
    const { ctx, bounds } = fixture({ cardReadings: [0, 1, 2, 3, 4].flatMap((i) => readingsFor(addWorkDate("2026-06-22", i))) });
    const result = await summaries(ctx, 6);
    const rows = await call<FunctionReturnType<typeof api.cardReadings.getPdksTableData>>(
      getPdksTableData, ctx, { projectId: "p", startDate: "2026-06-26", endDate: "2026-06-26", statusFilter: "overtime" },
    );
    const row = result.table;
    expect(row).toBeDefined();
    if (!row) return;
    expect(row.days.filter((d) => d.overtimeMinutes > 0).map((d) => [d.date, d.overtimeMinutes])).toEqual([["2026-06-26", 300]]);
    expect(rows[0]).toMatchObject({ overtimeMinutes: 300, overtimePayTRY: 750 });
    expect(result.detailDays?.find((d) => d.date === "2026-06-26")?.overtimeMinutes).toBe(300);
    expect(result.payrollDays?.find((d) => d.date === "2026-06-26")).toMatchObject({ overtimeMinutes: 300, overtimePayTRY: 750 });
    expect(bounds.filter((b) => b.table === "cardReadings" && b.operator === "lte").slice(-1)[0]?.value).toBe("2026-06-27T20:59:59.999Z");
    const monday = await call<FunctionReturnType<typeof api.cardReadings.getPdksTableData>>(
      getPdksTableData, ctx, { projectId: "p", startDate: "2026-06-22", endDate: "2026-06-22", statusFilter: "overtime" },
    );
    expect(monday).toEqual([]);
  });

  it("October 29 holiday stays in October while Sunday November 1 premium stays in November", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-12-01T12:00:00Z"));
    const { ctx } = fixture({
      cardReadings: [0, 1, 2, 3, 4, 5, 6].flatMap((i) => readingsFor(addWorkDate("2026-10-26", i), "09:00", i === 6 ? "13:00" : "20:00")),
      generalSettings: [{ projectId: "p", workingDays: ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"] }],
      holidays: [{ projectId: "p", date: "2026-10-29", isHalfDay: false }],
    });
    const october = await summaries(ctx, 10);
    const november = await summaries(ctx, 11);
    for (const result of [october.payroll, october.table, october.detail])
      expect(result).toMatchObject({ overtimeMinutes: 900, overtimePayTRY: 2750 });
    for (const result of [november.payroll, november.table, november.detail])
      expect(result).toMatchObject({ overtimeMinutes: 225, overtimePayTRY: 750 });
    expect(october.payrollDays?.filter((d) => d.overtimeMinutes > 0).map((d) => [d.date, d.overtimeMinutes]))
      .toEqual([["2026-10-29", 600], ["2026-10-31", 300]]);
    expect(november.payrollDays?.filter((d) => d.overtimeMinutes > 0).map((d) => d.date)).toEqual(["2026-11-01"]);
  });

  it("six nine-hour days with overtime disabled on Saturday produce no pay", async () => {
    const { ctx } = fixture({
      employees: [{ _id: "e", projectId: "p", firstName: "Test", lastName: "Worker", cardNumber: "123", isActive: true, hourlyRate: 100, shiftId: "s" }],
      shifts: [
        { _id: "s", projectId: "p", startTime: "09:00", endTime: "19:00", overtimeEnabled: true },
        { _id: "disabled", projectId: "p", startTime: "09:00", endTime: "19:00", overtimeEnabled: false },
      ],
      shiftAssignments: [{ employeeId: "e", shiftId: "disabled", startDate: "2026-06-27", endDate: "2026-06-27", updatedAt: "2026-06-01" }],
      generalSettings: [{ projectId: "p", workingDays: ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"] }],
      cardReadings: [0, 1, 2, 3, 4, 5].flatMap((i) => readingsFor(addWorkDate("2026-06-22", i), "09:00", "19:00")),
    });
    const result = await summaries(ctx, 6);
    for (const value of [result.payroll, result.table, result.detail])
      expect(value).toMatchObject({ overtimeMinutes: 0, overtimePayTRY: 0 });
  });

  it("legacy saveOvertime calls preserve new modes; inserts alone receive defaults", async () => {
    const args = { projectId: "p", annualOvertimeLimitHours: 270, overtimeStartToleranceMinutes: 0, monthlyHoursBase: 225,
      weekdayMultiplier: 1.5, weekendMultiplier: 2, holidayMultiplier: 2, nightShiftMultiplier: 1.5,
      nightShiftStart: "22:00", nightShiftEnd: "06:00" };
    const existing = fixture({ overtimeRates: [{ _id: "rates", projectId: "p", overtimeBasis: "dailyShift", nightShiftDayMode: "splitAtMidnight", nightCombineMode: "multiply" }] });
    await call(saveOvertime, existing.ctx, args);
    expect(existing.rows.overtimeRates[0]).toMatchObject({ overtimeBasis: "dailyShift", nightShiftDayMode: "splitAtMidnight", nightCombineMode: "multiply" });
    const fresh = fixture();
    await call(saveOvertime, fresh.ctx, args);
    expect(fresh.rows.overtimeRates[0]).toMatchObject({ overtimeBasis: "weekly45", nightShiftDayMode: "shiftStart", nightCombineMode: "max" });
  });

  it.each(["weekly45", "dailyShift"] as const)("loads the next calendar day's holiday for %s midnight splitting", async (basis) => {
    const { ctx } = fixture({
      employees: [{ _id: "e", projectId: "p", firstName: "Night", lastName: "Worker", cardNumber: "123", isActive: true, hourlyRate: 100, shiftId: "s" }],
      shifts: [{ _id: "s", projectId: "p", startTime: "22:00", endTime: "06:00", overtimeStartToleranceMinutes: 0 }],
      cardReadings: readingsFor("2026-06-23", "22:00", "06:00", "2026-06-24"),
      holidays: [{ projectId: "p", date: "2026-06-24", isHalfDay: false }],
      overtimeRates: [{ ...DEFAULT_OVERTIME_RATES, projectId: "p", overtimeBasis: basis, nightShiftDayMode: "splitAtMidnight", holidayMultiplier: 3 }],
    });
    const june = await summaries(ctx, 6);
    for (const result of [june.payroll, june.table, june.detail])
      expect(result).toMatchObject({ totalMinutes: 420, overtimeMinutes: 315, overtimePayTRY: 1575 });
    expect(june.payrollDays?.find((d) => d.date === "2026-06-23")?.totalMinutes).toBe(420);
    expect(june.payrollDays?.find((d) => d.date === "2026-06-24")?.totalMinutes).toBe(0);
  });
});
