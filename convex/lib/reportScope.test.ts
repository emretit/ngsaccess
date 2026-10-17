import { afterEach, describe, expect, it, vi } from "vitest";
import type { Doc, Id } from "../_generated/dataModel";
import { selectProjectScope } from "./projectScope";
import type { QueryCtx } from "../_generated/server";
import * as pdksSource from "./pdksSource";
import { getPdksTableData, getPdksChartData, getMonthlyPayrollSheet, getEmployeeAttendanceDetail } from "../cardReadings";
import { readReportReadings, reportPeriod, selectScheduleProjectIds } from "./reportScope";

describe("rapor proje kapsamı ve dönem", () => {
  it("seçili kapsamı izinli kümeyle doğrular; seçim yoksa yalnız erişilebilir projeleri döner", () => {
    const a = "a" as Id<"projects">;
    const b = "b" as Id<"projects">;
    expect(selectProjectScope([a, b], a)).toEqual([a]);
    expect(selectProjectScope([a, b])).toEqual([a, b]);
    expect(selectProjectScope([])).toEqual([]);
    expect(() => selectProjectScope([a], b)).toThrow("erişim yetkiniz yok");
  });
  it("zamanlamada güncel sahip rolünü, doğrulamayı ve geri alınan proje üyeliğini denetler", () => {
    const a = "a" as Id<"projects">;
    const b = "b" as Id<"projects">;
    const user: Doc<"users"> = { _id: "u" as Id<"users">, _creationTime: 0, role: "project_admin", verified: true };
    expect(selectScheduleProjectIds(user, [a, b], a)).toEqual([a]);
    expect(selectScheduleProjectIds(user, [a, b])).toEqual([a, b]);
    expect(selectScheduleProjectIds(user, [a], b)).toBeNull();
    expect(selectScheduleProjectIds({ ...user, role: "project_user" }, [a], a)).toBeNull();
    expect(selectScheduleProjectIds({ ...user, verified: false }, [a], a)).toBeNull();
    expect(selectScheduleProjectIds(null, [a], a)).toBeNull();
    expect(selectScheduleProjectIds(user, [])).toBeNull();
  });
  it("ay/yıl sınırlarını doğrular", () => {
    expect(reportPeriod(2024, 2)).toEqual({ startDate: "2024-02-01", endDate: "2024-02-29" });
    expect(reportPeriod(2026)).toEqual({ startDate: "2026-01-01", endDate: "2026-12-31" });
    for (const month of [0, 13, 1.5, NaN]) expect(() => reportPeriod(2026, month)).toThrow();
  });
});

// Exercise the real loader and public handlers; only the auth wrapper is replaced.
// Query fixtures return already scoped rows, as the DB indexes do in production.

vi.mock("./customFunctions", () => ({ authedQuery: (config: unknown) => config, employeeAuthedQuery: (config: unknown) => config, employeeAuthedMutation: (config: unknown) => config }));
afterEach(() => vi.restoreAllMocks());

const projectId = "project" as Id<"projects">;
const employeeId = "employee" as Id<"employees">;
const reportEmployee = {
  _id: employeeId, _creationTime: 0, projectId, firstName: "Test", lastName: "Personel",
  cardNumber: "CARD", isActive: true,
} as Doc<"employees">;
const reportReadings: Doc<"cardReadings">[] = ["06:00", "19:00"].map((time, i) => ({
  _id: `reading${i}` as Id<"cardReadings">, _creationTime: 0, projectId, employeeId,
  cardNo: "CARD", accessStatus: "izin_verildi", accessTime: `2026-06-22T${time}:00Z`,
  hikCurrentVerifyMode: "face",
}));
function readingContext(readings: Doc<"cardReadings">[]) {
  const user = { _id: "admin", role: "super_admin" };
  const query = (table: string) => {
    const rows = table === "cardReadings" ? readings : table === "employees" ? [reportEmployee] : [];
    const chain = {
      withIndex: () => chain, filter: () => chain,
      collect: async () => rows, first: async () => rows[0] ?? null,
    };
    return chain;
  };
  return {
    user,
    auth: { getUserIdentity: async () => ({ subject: "admin|session" }) },
    db: { query, get: async (id: string) => id === employeeId ? reportEmployee : id === "admin" ? user : null },
  } as unknown as QueryCtx;
}
async function invoke(fn: unknown, ctx: QueryCtx, args: object) {
  return (fn as { handler: (ctx: QueryCtx, args: object) => Promise<unknown> }).handler(ctx, args);
}

describe("PDKS source filtering at loader/handler boundaries", () => {
  it("rapor yükleyicisi biyometriyi dışlar, kartı korur ve bir kez süzer", async () => {
    const card = { ...reportReadings[0], hikCurrentVerifyMode: "card" };
    const raw = [...reportReadings, card];
    const spy = vi.spyOn(pdksSource, "filterPdksReadings");
    expect(await readReportReadings(readingContext(raw), [projectId], "start", "end")).toEqual([card]);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(raw).toHaveLength(3);
  });
  it.each([
    ["table", getPdksTableData, { startDate: "2026-06-22", endDate: "2026-06-22", viewMode: "matrix" }],
    ["chart", getPdksChartData, { startDate: "2026-06-22", endDate: "2026-06-22" }],
    ["payroll", getMonthlyPayrollSheet, { year: 2026, month: 6 }],
    ["detail", getEmployeeAttendanceDetail, { employeeId, startDate: "2026-06-22", endDate: "2026-06-22" }],
  ])("%s: biyometri devam/süre/mesai/hareket üretmez; tek süzme kartı korur", async (_name, fn, args) => {
    const empty = await invoke(fn, readingContext([]), args);
    const spy = vi.spyOn(pdksSource, "filterPdksReadings");
    expect(await invoke(fn, readingContext(reportReadings), args)).toEqual(empty);
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockClear();
    const cards = reportReadings.map(reading => ({ ...reading, hikCurrentVerifyMode: "card" }));
    const cardOnly = await invoke(fn, readingContext(cards), args);
    expect(cardOnly).not.toEqual(empty);
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockClear();
    expect(await invoke(fn, readingContext([...reportReadings, ...cards]), args)).toEqual(cardOnly);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
