// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import { DEFAULT_FLEXIBLE } from "./lib/pdksFlexible";
import { DEFAULT_OVERTIME_RATES } from "./lib/pdksHelpers";
import { loadRuleReportDays } from "./lib/reportAttendance";
import { flexibleReportProjects, readReportReadings } from "./lib/reportScope";
import { trDayRangeISO } from "./lib/trDate";
import type { Doc } from "./_generated/dataModel";

const modules = import.meta.glob("./**/*.ts");
const date = "2026-06-22";
const nextDate = "2026-06-23";
const iso = (day: string, time: string) => new Date(`${day}T${time}:00+03:00`).toISOString();
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-06-23T12:00:00Z")); });
afterEach(() => vi.useRealTimers());

async function fixture(versioned: boolean, assignmentOnly = false, globalShift = false) {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "W5.3" });
    const userId = await ctx.db.insert("users", { role: "project_admin" });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 86400000 });
    await ctx.db.insert("userProjects", { userId, projectId });
    await ctx.db.insert("overtimeRates", { ...DEFAULT_OVERTIME_RATES, projectId, overtimeBasis: "dailyShift", updatedAt: "" });
    const shiftId = await ctx.db.insert("shifts", {
      projectId: globalShift ? undefined : projectId, name: "Esnek", startTime: "05:00", endTime: "22:00", scheduleType: "flexible", flexible: DEFAULT_FLEXIBLE,
      overtimeStartToleranceMinutes: 0, createdAt: "", updatedAt: "",
    });
    const employeeId = await ctx.db.insert("employees", {
      projectId, firstName: "Ada", lastName: "Test", email: "w53@example.test", cardNumber: "53", isActive: true,
      shiftId: assignmentOnly ? undefined : shiftId, employmentEndDate: date,
    });
    if (assignmentOnly) await ctx.db.insert("shiftAssignments", { projectId, employeeId, shiftId, startDate: "2026-01-01", endDate: "2026-12-31", createdAt: "", updatedAt: "" });
    const deviceId = await ctx.db.insert("devices", { projectId, name: "A", createdAt: "", updatedAt: "" });
    const otherDeviceId = await ctx.db.insert("devices", { projectId, name: "B", createdAt: "", updatedAt: "" });
    if (versioned) await ctx.db.insert("pdksRuleVersions", {
      projectId, effectiveFrom: "2026-01-01", punchMode: "requirements", checkpointMode: "all", requireCheckIn: true, requireCheckOut: true,
      missingRequiredPunch: "review", noPunch: "absent", createdAt: "", createdBy: userId,
    });
    const sessionToken = "w53-mobile-session";
    await ctx.db.insert("employeeAuth", { employeeId, passwordHash: "fixture", passwordVersion: 1, createdAt: "", updatedAt: "" });
    await ctx.db.insert("employeeSessions", { employeeId, token: sessionToken, passwordVersion: 1, expiresAt: "2099-01-01T00:00:00Z", createdAt: "" });
    return { projectId, userId, sessionId, employeeId, shiftId, deviceId, otherDeviceId, sessionToken };
  });
  const caller = t.withIdentity({ subject: `${ids.userId}|${ids.sessionId}` });
  const add = (time: string, direction: "entry" | "exit", day = date, extra: Partial<Doc<"cardReadings">> = {}) => t.run(ctx => ctx.db.insert("cardReadings", {
    projectId: ids.projectId, employeeId: ids.employeeId, cardNo: "53", deviceId: ids.deviceId, accessTime: iso(day, time), accessStatus: "izin_verildi", direction, ...extra,
  }));
  const manual = (entryTime: string) => t.run(ctx => ctx.db.insert("pdksRecords", {
    projectId: ids.projectId, employeeId: ids.employeeId, employeeFirstName: "Ada", employeeLastName: "Test", date, entryTime,
    manualEntry: true, status: "present", createdAt: "", updatedAt: "",
  }));
  const checkpointChange = () => t.run(async ctx => {
    for (const [effectiveFrom, deviceId] of [[date, ids.deviceId], [nextDate, ids.otherDeviceId]] as const) {
      const ruleVersionId = await ctx.db.insert("pdksRuleVersions", {
        projectId: ids.projectId, effectiveFrom, punchMode: "requirements", checkpointMode: "selected", requireCheckIn: true, requireCheckOut: true,
        missingRequiredPunch: "review", noPunch: "absent", createdAt: "", createdBy: ids.userId,
      });
      await ctx.db.insert("pdksCheckpointSelections", { projectId: ids.projectId, ruleVersionId, targetType: "device", deviceId });
    }
  });
  const adapter = (start: string, end: string) => t.run(async ctx => {
    const result = await loadRuleReportDays(ctx, [ids.projectId], start, end);
    return { days: result.ruleRows.get(ids.employeeId)?.days ?? [], readings: result.readings.map(reading => ({ ...reading, workDate: result.workDate(reading) })) };
  });
  return { t, caller, ...ids, add, manual, checkpointChange, adapter };
}

describe.each([false, true])("W5.3 legacy/versioned=%s", versioned => {
  it.each([
    ["eksik", "09:00", "16:00", date, 360, 120, 0],
    ["fazla", "08:00", "18:00", date, 540, 0, 60],
    ["gece", "22:00", "06:30", nextDate, 450, 30, 0],
  ] as const)("%s: gerçek tablo, rapor, SGK/APHB, dashboard ve mobil aynı günü bir kez sayar", async (_, entry, exit, exitDate, minutes, shortfall, excess) => {
    const f = await fixture(versioned);
    await f.add(entry, "entry");
    await f.add(exit, "exit", exitDate);
    const table = await f.caller.query(api.cardReadings.getPdksTableData, { projectId: f.projectId, startDate: "2026-06-01", endDate: date, viewMode: "matrix" });
    const cell = table[0]?.days.find(day => day.date === date);
    expect(cell).toMatchObject({ status: "present", payrollCode: "N", totalMinutes: minutes, requiredNetMinutes: 480, shortfallMinutes: shortfall, excessMinutes: excess });
    const adapter = await f.adapter("2026-06-01", "2026-06-30");
    expect(adapter.days.find(day => day.date === date)).toEqual(cell);
    const report = await f.caller.query(api.reports.getAttendanceSummaryReport, { projectId: f.projectId, year: 2026, month: 6 });
    expect(report.rows[0]).toMatchObject({ presentDays: 1, absentDays: 0, requiredNetMinutes: table[0]?.requiredNetMinutes, shortfallMinutes: table[0]?.shortfallMinutes, excessMinutes: table[0]?.excessMinutes });
    const sgk = await f.caller.query(api.reports.getSgkMonthlyReport, { projectId: f.projectId, year: 2026, month: 6 });
    expect(sgk.rows).toHaveLength(1);
    expect(sgk.rows[0]).toMatchObject({ calismaGunu: 1, toplamSaat: Math.round(minutes / 60 * 10) / 10, fazlaMesaiSaat: excess / 60 });
    const aphb = await f.caller.query(api.sgkExport.buildAphbForMonth, { projectId: f.projectId, year: 2026, month: 6 });
    expect(aphb.blockedByReview).toBe(false);
    expect(aphb.employees[0]?.reviewDays).toEqual([]);
    expect(aphb.xml).toContain("<calismaGunu>7</calismaGunu>");
    const annual = await f.caller.query(api.dashboard.getAnnualOvertimeBalance, { projectId: f.projectId, year: 2026 });
    expect(annual[0]?.totalOvertimeMinutes).toBe(excess);
    const mobile = await f.t.query(api.mobileAttendance.summary, { sessionToken: f.sessionToken, startDate: date, endDate: date });
    expect(mobile.totals.presentDays).toBe(1);
    expect(mobile.totals.exitCount).toBe(exitDate === date ? 1 : 0);
    vi.setSystemTime(new Date(iso(date, "23:59")));
    const dashboard = await f.caller.query(api.dashboard.getActivitySummary, { projectId: f.projectId });
    expect(dashboard).toMatchObject({ presentToday: 1, lateArrivals: 0, incompleteDays: 0 });
  });

  it("yalnız manuel giriş + tek ham gece çıkışı tablo/rapor/SGK'da 450 dk ölçülür", async () => {
    const f = await fixture(versioned);
    await f.manual("22:00");
    await f.add("06:30", "exit", nextDate);
    const table = await f.caller.query(api.cardReadings.getPdksTableData, { projectId: f.projectId, startDate: date, endDate: date, viewMode: "matrix" });
    expect(table[0]?.days[0]).toMatchObject({ totalMinutes: 450, shortfallMinutes: 30, status: "present" });
    expect((await f.adapter(date, date)).days[0]).toEqual(table[0]?.days[0]);
    const sgk = await f.caller.query(api.reports.getSgkMonthlyReport, { projectId: f.projectId, year: 2026, month: 6 });
    expect(sgk.rows[0]).toMatchObject({ calismaGunu: 1, toplamSaat: 7.5 });
    expect((await f.t.query(api.mobileAttendance.summary, { sessionToken: f.sessionToken, startDate: date, endDate: date })).totals.presentDays).toBe(1);
  });

  it("assignment-only esnek vardiyayı keşfeder ve geceyi mobil/rapor/SGK adaptörüne dahil eder", async () => {
    const f = await fixture(versioned, true);
    await f.add("22:00", "entry");
    await f.add("06:30", "exit", nextDate);
    const adapter = await f.adapter(date, date);
    expect(adapter.days[0]).toMatchObject({ totalMinutes: 450, shortfallMinutes: 30, status: "present" });
    const mobile = await f.t.query(api.mobileAttendance.summary, { sessionToken: f.sessionToken, startDate: date, endDate: date });
    expect(mobile.totals.presentDays).toBe(1);
    const report = await f.caller.query(api.reports.getSgkMonthlyReport, { projectId: f.projectId, year: 2026, month: 6 });
    expect(report.rows[0]).toMatchObject({ calismaGunu: 1, toplamSaat: 7.5 });
  });
});

it("manuel D girişi + D+1 çıkışı checkpoint sürümü değişse de tablo/bordro/detay/rapor/mobilde D'ye gider", async () => {
  const f = await fixture(true);
  await f.checkpointChange();
  await f.manual("22:00");
  await f.add("06:30", "exit", nextDate);
  const table = await f.caller.query(api.cardReadings.getPdksTableData, { projectId: f.projectId, startDate: date, endDate: nextDate, viewMode: "matrix" });
  const payroll = await f.caller.query(api.cardReadings.getMonthlyPayrollSheet, { projectId: f.projectId, year: 2026, month: 6 });
  const detail = await f.caller.query(api.cardReadings.getEmployeeAttendanceDetail, { projectId: f.projectId, employeeId: f.employeeId, startDate: date, endDate: nextDate });
  const adapter = await f.adapter(date, nextDate);
  for (const cell of [table[0]?.days.find(day => day.date === date), payroll.rows[0]?.cells.find(day => day.date === date), detail?.days.find(day => day.date === date), adapter.days.find(day => day.date === date)]) {
    expect(cell).toMatchObject({ status: "present", totalMinutes: 450, requiredNetMinutes: 480, shortfallMinutes: 30, durationMeasured: true });
  }
  const report = await f.caller.query(api.reports.getAttendanceSummaryReport, { projectId: f.projectId, year: 2026, month: 6 });
  expect(report.rows[0]?.presentDays).toBe(1);
  const range = trDayRangeISO(date, nextDate);
  const raw = await f.t.run(ctx => readReportReadings(ctx, [f.projectId], range.startISO, range.endISO));
  expect(raw).toHaveLength(1);
  vi.setSystemTime(new Date(iso(date, "23:59")));
  expect(await f.caller.query(api.dashboard.getActivitySummary, { projectId: f.projectId })).toMatchObject({ presentToday: 1, incompleteDays: 0 });
  const mobile = await f.t.query(api.mobileAttendance.summary, { sessionToken: f.sessionToken, startDate: date, endDate: nextDate });
  expect(mobile.totals).toMatchObject({ presentDays: 1, exitCount: 1, unknownCount: 0 });
});

it("gerçek giriş D politikasıyla açılır; yeni gün çıkış politikası geçerli gece çiftini bozmaz", async () => {
  const f = await fixture(true);
  await f.checkpointChange();
  await f.add("22:00", "entry");
  const exitId = await f.add("06:30", "exit", nextDate);
  const { startISO, endISO } = trDayRangeISO(date, nextDate);
  const raw = await f.t.run(ctx => readReportReadings(ctx, [f.projectId], startISO, endISO));
  expect(raw.some(reading => reading._id === exitId)).toBe(true);
  const adapter = await f.adapter(date, nextDate);
  expect(adapter.days[0]).toMatchObject({ status: "present", totalMinutes: 450 });
});

it.each(["yok", "azami süre", "checkpoint", "biyometrik"] as const)("%s giriş erken sabah çıkışını önceki güne taşımaz", async kind => {
  const f = await fixture(true);
  await f.checkpointChange();
  if (kind !== "yok") await f.add(kind === "azami süre" ? "05:00" : "22:00", "entry", date,
    kind === "checkpoint" ? { deviceId: f.otherDeviceId } : kind === "biyometrik" ? { hikCurrentVerifyMode: "face" } : {});
  const exitId = await f.add("06:30", "exit", nextDate, { deviceId: f.otherDeviceId });
  const adapter = await f.adapter(date, nextDate);
  const exit = adapter.readings.find(reading => reading._id === exitId);
  expect(exit).toBeDefined();
  if (exit) expect(exit.workDate).toBe(nextDate);
  expect(adapter.days.find(day => day.date === date)?.totalMinutes).toBe(0);
});

it("projectId'siz esnek tanımı keşif kapısından geçer; tablo/rapor/mobil aynı global vardiyayı kullanır", async () => {
  const f = await fixture(false, true, true);
  await f.add("22:00", "entry");
  await f.add("06:30", "exit", nextDate);
  const table = await f.caller.query(api.cardReadings.getPdksTableData, { projectId: f.projectId, startDate: date, endDate: date, viewMode: "matrix" });
  expect(table[0]?.days[0]).toMatchObject({ totalMinutes: 450, shortfallMinutes: 30 });
  expect((await f.adapter(date, date)).days[0]).toEqual(table[0]?.days[0]);
  expect((await f.caller.query(api.reports.getAttendanceSummaryReport, { projectId: f.projectId, year: 2026, month: 6 })).rows[0]?.presentDays).toBe(1);
  expect((await f.t.query(api.mobileAttendance.summary, { sessionToken: f.sessionToken, startDate: date, endDate: date })).totals.presentDays).toBe(1);
});

it("aynı legacy projedeki sabit vardiyanın takvim günleri ve brüt eski SGK hesabı korunur", async () => {
  const f = await fixture(false);
  await f.add("09:00", "entry");
  await f.add("16:00", "exit");
  await f.t.run(async ctx => {
    const shiftId = await ctx.db.insert("shifts", { projectId: f.projectId, name: "Sabit gece", startTime: "22:00", endTime: "06:00", createdAt: "", updatedAt: "" });
    const employeeId = await ctx.db.insert("employees", { projectId: f.projectId, firstName: "Sabit", lastName: "Test", email: "fixed@example.test", cardNumber: "54", isActive: true, shiftId });
    for (const [day, time, direction] of [[date, "22:00", "entry"], [nextDate, "06:00", "exit"]] as const) await ctx.db.insert("cardReadings", { projectId: f.projectId, employeeId, cardNo: "54", direction, accessStatus: "izin_verildi", accessTime: iso(day, time) });
  });
  const sgk = await f.caller.query(api.reports.getSgkMonthlyReport, { projectId: f.projectId, year: 2026, month: 6 });
  expect(sgk.rows).toHaveLength(2);
  expect(sgk.rows.find(row => row.adSoyad === "Ada Test")).toMatchObject({ calismaGunu: 1, toplamSaat: 6 });
  expect(sgk.rows.find(row => row.adSoyad === "Sabit Test")).toMatchObject({ calismaGunu: 2, toplamSaat: 0 });
});

it("legacy keşif ek okumaları: sabitte iki bounded metadata sorgusu; esnekte yalnız gerekli indeksli yüklemeler", async () => {
  const f = await fixture(false);
  await f.add("22:00", "entry");
  await f.add("06:30", "exit", nextDate);
  const counts = () => f.t.run(async ctx => {
    const tables: Record<string, number> = {};
    let gets = 0;
    const db = new Proxy(ctx.db, { get(target, key) {
      if (key === "query") return (table: string) => {
        tables[table] = (tables[table] ?? 0) + 1;
        return Reflect.apply(target.query, target, [table]);
      };
      if (key === "get") return (...args: unknown[]) => { gets++; return Reflect.apply(target.get, target, args); };
      return Reflect.get(target, key);
    } });
    await loadRuleReportDays({ ...ctx, db }, [f.projectId], date, date);
    return { tables, gets };
  });
  expect(await counts()).toEqual({ tables: {
    pdksRuleVersions: 2, shifts: 2, employees: 1, shiftAssignments: 1, pdksRecords: 1,
    cardReadings: 2, workSettings: 1, overtimeRates: 1, holidays: 2, generalSettings: 1, leaves: 1,
  }, gets: 1 });
  await f.t.run(ctx => ctx.db.patch(f.shiftId, { scheduleType: "fixed", flexible: undefined }));
  expect(await counts()).toEqual({ tables: { pdksRuleVersions: 2, shifts: 2, cardReadings: 1 }, gets: 0 });
});

it.each(["ham", "manuel"] as const)("dashboard D+1 ham çıkışı D'nin %s giriş politikasını taşır; bugünkü devamı artırmaz", async kind => {
  const f = await fixture(true);
  await f.t.run(ctx => ctx.db.patch(f.employeeId, { employmentEndDate: undefined }));
  await f.checkpointChange();
  if (kind === "manuel") await f.manual("22:00");
  else await f.add("22:00", "entry");
  await f.add("06:30", "exit", nextDate);
  expect(await f.caller.query(api.dashboard.getActivitySummary, { projectId: f.projectId })).toMatchObject({
    averageLastExit: "06:30", presentToday: 0, insideBuilding: 0, lateArrivals: 0,
  });
});

it.each([false, true])("E1: ay başı gece kuyruğu önceki ayda kalır, legacy/versioned=%s", async versioned => {
  const f = await fixture(versioned);
  await f.add("22:00", "entry", "2026-05-31");
  await f.add("06:30", "exit", "2026-06-01");
  const table = await f.caller.query(api.cardReadings.getPdksTableData, { projectId: f.projectId, startDate: "2026-06-01", endDate: "2026-06-01", viewMode: "matrix" });
  const payroll = await f.caller.query(api.cardReadings.getMonthlyPayrollSheet, { projectId: f.projectId, year: 2026, month: 6 });
  const detail = await f.caller.query(api.cardReadings.getEmployeeAttendanceDetail, { projectId: f.projectId, employeeId: f.employeeId, startDate: "2026-06-01", endDate: "2026-06-01" });
  const adapter = await f.adapter("2026-06-01", "2026-06-30");
  for (const cell of [table[0]?.days[0], payroll.rows[0]?.cells[0], detail?.days[0], adapter.days[0]]) {
    expect(cell).toMatchObject({ date: "2026-06-01", totalMinutes: 0, durationMeasured: false });
    expect(cell?.status).toBe("noData");
  }
  expect(table[0]?.days).toHaveLength(1);
  expect(detail?.days).toHaveLength(1);
  expect(adapter.days.every(day => day.date >= "2026-06-01")).toBe(true);
  expect(adapter.readings).toEqual([]);
  const report = await f.caller.query(api.reports.getAttendanceSummaryReport, { projectId: f.projectId, year: 2026, month: 6 });
  expect(report.rows[0]).toMatchObject({ presentDays: 0, absentDays: 0 });
  const sgk = await f.caller.query(api.reports.getSgkMonthlyReport, { projectId: f.projectId, year: 2026, month: 6 });
  expect(sgk.rows[0]).toMatchObject({ calismaGunu: 0, toplamSaat: 0 });
  const previous = await f.caller.query(api.cardReadings.getPdksTableData, { projectId: f.projectId, startDate: "2026-05-31", endDate: "2026-05-31", viewMode: "matrix" });
  expect(previous[0]?.days[0]).toMatchObject({ totalMinutes: 450, durationMeasured: true });
});

it("D2: legacy yönsüz gece çifti tek 510 dk brüt oturum ve SGK'da bir gün üretir", async () => {
  const f = await fixture(false);
  await f.t.run(async ctx => {
    await ctx.db.patch(f.shiftId, { flexible: { ...DEFAULT_FLEXIBLE, checkInStart: "08:00" } });
    await ctx.db.patch(f.employeeId, { employmentEndDate: nextDate });
  });
  await f.add("22:00", "entry", date, { direction: undefined });
  await f.add("06:30", "exit", nextDate, { direction: undefined });
  const table = await f.caller.query(api.cardReadings.getPdksTableData, { projectId: f.projectId, startDate: date, endDate: nextDate, viewMode: "matrix" });
  const day = table[0]?.days.find(day => day.date === date);
  expect(day).toMatchObject({ status: "present", totalMinutes: 450, requiredNetMinutes: 480, shortfallMinutes: 30, durationMeasured: true });
  expect(day?.detail?.readingCount).toBe(2);
  expect(table[0]?.days.find(day => day.date === nextDate)?.totalMinutes).toBe(0);
  const adapter = await f.adapter(date, date);
  expect(adapter.days[0]).toEqual(day);
  expect(adapter.readings).toHaveLength(2);
  expect(adapter.readings.every(reading => reading.workDate === date)).toBe(true);
  const sgk = await f.caller.query(api.reports.getSgkMonthlyReport, { projectId: f.projectId, year: 2026, month: 6 });
  expect(sgk.rows[0]).toMatchObject({ calismaGunu: 1, toplamSaat: 7.5 });
});

it.each([false, true])("D2: belirsiz yönsüz gece penceresi iki günü incelemeye alır, versioned=%s", async versioned => {
  const f = await fixture(versioned);
  await f.t.run(ctx => ctx.db.patch(f.employeeId, { employmentEndDate: undefined }));
  await f.add("22:00", "entry", date, { direction: undefined });
  await f.add("06:30", "exit", nextDate, { direction: undefined });
  vi.setSystemTime(new Date(iso("2026-06-25", "12:00")));
  await f.t.run(ctx => ctx.db.patch(f.sessionId, { expirationTime: Date.now() + 86400000 }));
  const table = await f.caller.query(api.cardReadings.getPdksTableData, { projectId: f.projectId, startDate: date, endDate: nextDate, viewMode: "matrix" });
  expect(table[0]?.days).toHaveLength(2);
  for (const day of table[0]?.days ?? []) expect(day).toMatchObject({ status: "incomplete", durationMeasured: false, totalMinutes: 0, shortfallMinutes: null });
  const aphb = await f.caller.query(api.sgkExport.buildAphbForMonth, { projectId: f.projectId, year: 2026, month: 6 });
  expect(aphb.blockedByReview).toBe(true);
  expect(aphb.employees[0]?.reviewDays).toEqual(expect.arrayContaining([date, nextDate]));
});

it("N1: kapalı ayın tüm günleri ölçülür; günlük ve non-null satır hedef/eksik/fazla raporla eşittir", async () => {
  const f = await fixture(true);
  await f.t.run(ctx => ctx.db.patch(f.employeeId, { employmentEndDate: "2026-06-30" }));
  for (let d = 1; d <= 30; d++) {
    const day = `2026-06-${String(d).padStart(2, "0")}`;
    await f.add(d === 1 ? "09:00" : "08:00", "entry", day);
    await f.add(d === 1 ? "16:00" : d === 2 ? "18:00" : "17:00", "exit", day);
  }
  vi.setSystemTime(new Date(iso("2026-07-02", "12:00")));
  await f.t.run(ctx => ctx.db.patch(f.sessionId, { expirationTime: Date.now() + 86400000 }));
  const table = await f.caller.query(api.cardReadings.getPdksTableData, { projectId: f.projectId, startDate: "2026-06-01", endDate: "2026-06-30", viewMode: "matrix" });
  const adapter = await f.adapter("2026-06-01", "2026-06-30");
  const row = table[0];
  expect(row).toBeDefined();
  expect(row?.days).toHaveLength(30);
  expect(adapter.days).toEqual(row?.days);
  for (const day of row?.days ?? []) {
    expect(day.durationMeasured).toBe(true);
    expect(day.requiredNetMinutes).toBeTypeOf("number");
    expect(day.shortfallMinutes).toBeTypeOf("number");
    expect(day.excessMinutes).toBeTypeOf("number");
  }
  expect(row?.days[0]).toMatchObject({ requiredNetMinutes: 480, shortfallMinutes: 120, excessMinutes: 0 });
  expect(row?.days[1]).toMatchObject({ requiredNetMinutes: 480, shortfallMinutes: 0, excessMinutes: 60 });
  expect(row?.shortfallMinutes).toBeTypeOf("number");
  expect(row?.shortfallMinutes).toBe(120);
  const report = await f.caller.query(api.reports.getAttendanceSummaryReport, { projectId: f.projectId, year: 2026, month: 6 });
  expect(report.rows[0]?.shortfallMinutes).toBeTypeOf("number");
  expect(report.rows[0]).toMatchObject({ requiredNetMinutes: row?.requiredNetMinutes, shortfallMinutes: row?.shortfallMinutes, excessMinutes: row?.excessMinutes });
});

it("D3: 500 kişilik sabit projede kullanılmayan global esnek tanım kişi başı sorgusuz, iki ek bounded keşif sorgusu açar", async () => {
  const f = await fixture(false);
  await f.t.run(async ctx => {
    await ctx.db.patch(f.shiftId, { scheduleType: "fixed", flexible: undefined, startTime: "08:00", endTime: "17:00" });
    for (let i = 1; i < 500; i++) await ctx.db.insert("employees", {
      projectId: f.projectId, firstName: `Sabit ${i}`, lastName: "Test", email: `fixed${i}@example.test`, cardNumber: `fixed${i}`, isActive: true, shiftId: f.shiftId,
    });
  });
  const counts = () => f.t.run(async ctx => {
    const tables: Record<string, number> = {};
    let gets = 0;
    const db = new Proxy(ctx.db, { get(target, key) {
      if (key === "query") return (table: string) => {
        tables[table] = (tables[table] ?? 0) + 1;
        return Reflect.apply(target.query, target, [table]);
      };
      if (key === "get") return (...args: unknown[]) => { gets++; return Reflect.apply(target.get, target, args); };
      return Reflect.get(target, key);
    } });
    const result = await loadRuleReportDays({ ...ctx, db }, [f.projectId], date, date);
    return { tables, gets, readings: result.readings, rows: [...result.ruleRows] };
  });
  const before = await counts();
  expect(before).toEqual({ tables: { pdksRuleVersions: 2, shifts: 2, cardReadings: 1 }, gets: 0, readings: [], rows: [] });
  const globalId = await f.t.run(ctx => ctx.db.insert("shifts", { name: "Atanmamış global", startTime: "05:00", endTime: "22:00", scheduleType: "flexible", flexible: DEFAULT_FLEXIBLE, createdAt: "", updatedAt: "" }));
  const after = await counts();
  expect(after).toEqual({ ...before, tables: { ...before.tables, employees: 1, shiftAssignments: 1 } });
  expect(Object.values(after.tables).reduce((sum, n) => sum + n, 0) - Object.values(before.tables).reduce((sum, n) => sum + n, 0)).toBe(2);
  await f.t.run(async ctx => {
    const otherProject = await ctx.db.insert("projects", { name: "Globali kullanan başka proje" });
    const otherEmployee = await ctx.db.insert("employees", { projectId: otherProject, firstName: "Başka", lastName: "Kişi", email: "global-other@test", cardNumber: "global-other", isActive: true });
    await ctx.db.insert("shiftAssignments", { projectId: otherProject, employeeId: otherEmployee, shiftId: globalId, startDate: "2026-01-01", endDate: "2026-12-31", createdAt: "", updatedAt: "" });
    await ctx.db.insert("shiftAssignments", { projectId: f.projectId, employeeId: f.employeeId, shiftId: globalId, startDate: "2026-06-01", endDate: "2026-06-20", createdAt: "", updatedAt: "" });
  });
  expect(await counts()).toEqual(after);
});

it("D3: 1000'den fazla eski atamalı esnek tanım keşfi hata vermez; kullanım kanıtlanamayınca esnek yola düşer", async () => {
  const f = await fixture(false);
  await f.t.run(async ctx => {
    await ctx.db.patch(f.shiftId, { scheduleType: "fixed", flexible: undefined, startTime: "08:00", endTime: "17:00" });
    const globalId = await ctx.db.insert("shifts", { name: "Çok atamalı global", startTime: "05:00", endTime: "22:00", scheduleType: "flexible", flexible: DEFAULT_FLEXIBLE, createdAt: "", updatedAt: "" });
    const otherProject = await ctx.db.insert("projects", { name: "Eski atamalı başka proje" });
    const otherEmployee = await ctx.db.insert("employees", { projectId: otherProject, firstName: "Eski", lastName: "Atama", email: "old-assign@test", cardNumber: "old-assign", isActive: true });
    for (let i = 0; i < 1001; i++) await ctx.db.insert("shiftAssignments", { projectId: otherProject, employeeId: otherEmployee, shiftId: globalId, startDate: "2025-01-01", endDate: "2025-01-07", createdAt: "", updatedAt: "" });
  });
  const flexible = await f.t.run(async ctx => [...await flexibleReportProjects(ctx, [f.projectId], date, date)]);
  expect(flexible).toEqual([f.projectId]);
  const sabit = await f.t.run(async ctx => [...(await loadRuleReportDays(ctx, [f.projectId], date, date)).ruleRows]);
  expect(sabit).toEqual([]);
});

it.each([false, true])("D3: global sabit/esnek create yalnız super_admin'e açık, esnek=%s", async flexible => {
  const f = await fixture(false);
  const args = { name: "Global", startTime: "08:00", endTime: "17:00", ...(flexible ? { scheduleType: "flexible" as const, flexible: DEFAULT_FLEXIBLE } : {}) };
  await expect(f.caller.mutation(api.shifts.create, args)).rejects.toThrow("yetkiniz yok");
  await expect(f.caller.mutation(api.shifts.create, { ...args, projectId: f.projectId })).resolves.toBeTypeOf("string");
  await f.t.run(ctx => ctx.db.patch(f.userId, { role: "super_admin" }));
  await expect(f.caller.mutation(api.shifts.create, args)).resolves.toBeTypeOf("string");
});
