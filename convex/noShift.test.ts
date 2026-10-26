// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, expect, it, vi } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import { loadRuleReportDays } from "./lib/reportAttendance";
import { buildAphbForMonth } from "./sgkExport";
import type { QueryCtx } from "./_generated/server";
import { getActivitySummary, computePdksCoreInMemory } from "./dashboard";
import { buildShiftResolver } from "./lib/shiftResolver";
import { DEFAULT_WORK_SETTINGS } from "./lib/pdksHelpers";
const modules = import.meta.glob("./**/*.ts");
afterEach(() => vi.useRealTimers());

async function fixture() {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-07-01T12:00:00Z"));
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "Plan" });
    const userId = await ctx.db.insert("users", { role: "super_admin" });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 86400000 });
    const shiftId = await ctx.db.insert("shifts", { projectId, name: "Gündüz", startTime: "09:00", endTime: "18:00", createdAt: "", updatedAt: "" });
    const employeeId = await ctx.db.insert("employees", { projectId, shiftId, firstName: "Plansız", lastName: "Kişi", email: "test@example.test", cardNumber: "1", isActive: true });
    await ctx.db.insert("employeeAuth", { employeeId, passwordHash: "fixture", passwordVersion: 1, createdAt: "", updatedAt: "" });
    await ctx.db.insert("employeeSessions", { employeeId, token: "no-shift-session", passwordVersion: 1, expiresAt: "2099-01-01T00:00:00Z", createdAt: "" });
    for (const date of ["2026-06-14", "2026-06-15"]) {
      for (const [time, direction] of [["10:00", "entry"], ["20:00", "exit"]] as const) await ctx.db.insert("cardReadings", { projectId, employeeId, cardNo: "1", accessStatus: "izin_verildi", direction, accessTime: `${date}T${time}:00+03:00` });
    }
    return { projectId, employeeId, shiftId, userId, sessionId };
  });
  const caller = t.withIdentity({ subject: `${ids.userId}|${ids.sessionId}` });
  return { t, caller, ...ids };
}

it("no dated plan suppresses manual/leave/holiday PDKS and exports while retaining raw movements", async () => {
  const f = await fixture();
  await f.t.run(async ctx => {
    await ctx.db.insert("pdksRecords", { projectId: f.projectId, employeeId: f.employeeId, employeeFirstName: "Plansız", employeeLastName: "Kişi", date: "2026-06-15", manualEntry: true, entryTime: "08:00", exitTime: "21:00", status: "present", createdAt: "", updatedAt: "" });
    await ctx.db.insert("leaves", { projectId: f.projectId, employeeId: f.employeeId, startDate: "2026-06-14", endDate: "2026-06-15", leaveType: "annual", status: "approved", createdAt: "", updatedAt: "" });
    await ctx.db.insert("holidays", { projectId: f.projectId, date: "2026-06-15", name: "Tatil", createdAt: "" });
  });
  await f.caller.mutation(api.pdksRecords.upsertManual, { employeeId: f.employeeId, date: "2026-06-15", entryTime: "08:00", exitTime: "21:00", note: "Plansız güne elle giriş akışı korunur" });
  const args = { projectId: f.projectId, startDate: "2026-06-14", endDate: "2026-06-15", viewMode: "matrix" as const };
  const rows = await f.caller.query(api.cardReadings.getPdksTableData, args);
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ noShift: true, totalMinutes: 0, overtimeMinutes: 0, isLate: false, isManual: false, status: "noData", leaveType: "", totalHours: "—", detailedLogs: [] });
  for (const day of rows[0]?.days ?? []) expect(day).toMatchObject({ noShift: true, totalMinutes: 0, overtimeMinutes: 0, firstEntry: null, lastExit: null, leaveType: null, payrollCode: "—", status: "noData" });
  for (const statusFilter of ["absent", "late", "leave", "holiday", "noData"] as const) expect(await f.caller.query(api.cardReadings.getPdksTableData, { ...args, statusFilter })).toEqual([]);
  const monthly = { projectId: f.projectId, year: 2026, month: 6 };
  expect((await f.caller.query(api.cardReadings.getMonthlyPayrollSheet, monthly)).rows).toEqual([]);
  expect((await f.caller.query(api.reports.getAttendanceSummaryReport, monthly)).rows).toEqual([]);
  expect((await f.caller.query(api.reports.getSgkMonthlyReport, monthly)).rows).toEqual([]);
  const aphb = await f.caller.query(api.sgkExport.buildAphbForMonth, monthly);
  // SGK istihdama bağlı: vardiyasız kişi tam prim günüyle bildirilir, PDKS verisi olmadığı uyarılır.
  expect(aphb.employees).toEqual([{ employeeId: f.employeeId, reviewDays: [] }]);
  expect(aphb.xml).toContain("<calismaGunu>30</calismaGunu>");
  expect(aphb.warnings).toContain("Plansız Kişi: vardiya atanmamış; PDKS verisi yok, prim günü devamsızlık düşülmeden istihdam günlerinden hesaplandı, bildirimden önce kontrol edin.");
  const summary = await f.t.query(api.mobileAttendance.summary, { sessionToken: "no-shift-session", startDate: args.startDate, endDate: args.endDate });
  expect(summary.totals).toEqual({ entryCount: 2, exitCount: 2, deniedCount: 0, unknownCount: 0, presentDays: 2, pdksPresentDays: 0 });
  expect(Object.keys(summary).sort()).toEqual(["days", "endDate", "generatedAt", "startDate", "timeZone", "totals"]);
  expect(Object.keys(summary.days[0] ?? {}).sort()).toEqual(["date", "deniedCount", "entryCount", "exitCount", "firstEntry", "lastDirection", "lastEntry", "lastExit", "unknownCount"]);
  expect((await f.t.query(api.mobileAttendance.listPage, { sessionToken: "no-shift-session" })).page).toHaveLength(4);
  vi.setSystemTime(new Date("2026-06-15T12:00:00Z"));
  expect(await f.caller.query(api.dashboard.getActivitySummary, { projectId: f.projectId })).toMatchObject({ presentToday: 0, lateArrivals: 0, incompleteDays: 0, averageFirstEntry: "10:00", averageLastExit: "20:00" });
  await f.t.run(async ctx => {
    const employee = await ctx.db.get(f.employeeId);
    if (!employee) throw new Error("fixture");
    const shifts = await buildShiftResolver(ctx, [employee]);
    const raw = await ctx.db.query("cardReadings").collect();
    const leaves = await ctx.db.query("leaves").collect();
    expect(computePdksCoreInMemory([employee], raw, leaves, { start: "2026-06-15T00:00:00+03:00", end: "2026-06-15T23:59:59+03:00" }, new Map(), shifts, DEFAULT_WORK_SETTINGS).core).toMatchObject({ totalEmployees: 0, presentToday: 0, lateArrivals: 0, overtimeHours: 0, leaveToday: 0, devamOrani: 0 });
  });
});

it("unassigned mobile JSON satisfies the published Flutter summary parser invariants", async () => {
  const f = await fixture();
  const summary = await f.t.query(api.mobileAttendance.summary, { sessionToken: "no-shift-session", startDate: "2026-06-14", endDate: "2026-06-16" });
  expect(summary.timeZone).toBe("Europe/Istanbul");
  expect(Number.isFinite(Date.parse(summary.generatedAt))).toBe(true);
  expect(summary.days.map(day => day.date)).toEqual(["2026-06-14", "2026-06-15", "2026-06-16"]);
  expect(summary.days.length).toBeLessThanOrEqual(93);
  for (const key of ["entryCount", "exitCount", "deniedCount", "unknownCount"] as const) {
    expect(summary.totals[key]).toBe(summary.days.reduce((sum, day) => sum + day[key], 0));
    for (const day of summary.days) {
      expect(Number.isInteger(day[key])).toBe(true);
      expect(day[key]).toBeGreaterThanOrEqual(0);
    }
  }
  expect(summary.totals.presentDays).toBe(summary.days.filter(day => day.entryCount > 0).length);
  expect(summary.totals.pdksPresentDays).toBe(0);
  for (const day of summary.days) {
    expect(["entry", "exit", "unknown"]).toContain(day.lastDirection);
    expect(day).not.toHaveProperty("status");
    expect(day.entryCount === 0).toBe(day.firstEntry === null && day.lastEntry === null);
    if (day.entryCount > 0) { expect(day.firstEntry).not.toBeNull(); expect(day.lastEntry).not.toBeNull(); }
    expect(day.exitCount === 0).toBe(day.lastExit === null);
    if (day.lastDirection === "entry") expect(day.entryCount).toBeGreaterThan(0);
    if (day.lastDirection === "exit") expect(day.exitCount).toBeGreaterThan(0);
    for (const key of ["firstEntry", "lastEntry", "lastExit"] as const) {
      expect(day).toHaveProperty(key);
      const time = day[key];
      if (time !== null) {
        expect(Number.isFinite(Date.parse(time))).toBe(true);
        expect(new Date(Date.parse(time) + 3 * 60 * 60 * 1000).toISOString().slice(0, 10)).toBe(day.date);
      }
    }
    if (day.firstEntry && day.lastEntry) expect(Date.parse(day.firstEntry)).toBeLessThanOrEqual(Date.parse(day.lastEntry));
  }
});

it("partial personal and inherited department assignments include only their inclusive dated days", async () => {
  for (const source of ["personal", "department"] as const) {
    const f = await fixture();
    await f.t.run(async ctx => {
      const fields = { projectId: f.projectId, shiftId: f.shiftId, startDate: "2026-06-15", endDate: "2026-06-15", createdAt: "", updatedAt: "" };
      if (source === "personal") await ctx.db.insert("shiftAssignments", { ...fields, employeeId: f.employeeId });
      else {
        const parent = await ctx.db.insert("departments", { projectId: f.projectId, name: "Parent", createdAt: "", updatedAt: "" });
        const child = await ctx.db.insert("departments", { projectId: f.projectId, parentId: parent, name: "Child", createdAt: "", updatedAt: "" });
        await ctx.db.patch(f.employeeId, { departmentId: child });
        await ctx.db.insert("departmentShiftAssignments", { ...fields, departmentId: parent });
      }
    });
    const rows = await f.caller.query(api.cardReadings.getPdksTableData, { projectId: f.projectId, startDate: "2026-06-14", endDate: "2026-06-16", viewMode: "matrix" });
    expect(rows[0]?.noShift).toBeUndefined();
    expect(rows[0]?.durationMeasured).toBe(true);
    expect(rows[0]?.days.map(day => !!day.noShift)).toEqual([true, false, true]);
    expect(rows[0]?.totalMinutes).toBe(rows[0]?.days[1]?.totalMinutes);
    const monthly = { projectId: f.projectId, year: 2026, month: 6 };
    const payroll = await f.caller.query(api.cardReadings.getMonthlyPayrollSheet, monthly);
    expect(payroll.rows[0]?.cells).toHaveLength(30);
    expect(payroll.rows[0]?.cells.filter(day => !day.noShift).map(day => day.date)).toEqual(["2026-06-15"]);
    expect(payroll.rows[0]?.cells[13]).toMatchObject({ noShift: true, payrollCode: "—", totalMinutes: 0 });
    const report = await f.caller.query(api.reports.getAttendanceSummaryReport, monthly);
    expect(report.rows[0]).toMatchObject({ expectedDays: 1, presentDays: 1, absentDays: 0 });
    const aphb = await f.caller.query(api.sgkExport.buildAphbForMonth, monthly);
    expect(aphb.xml).toContain("<calismaGunu>30</calismaGunu>");
    expect(aphb.warnings).toContain("Plansız Kişi: 29 gün vardiya atanmamış; bu günler devamsızlık sayılmadan prim gününe dahil edildi, bildirimden önce kontrol edin.");
  }
});

it.each([{ ranges: [[15, 30]] }, { ranges: [[1, 10], [20, 30]] }])("payroll retains every calendar cell for partial assignments $ranges", async ({ ranges }) => {
  const f = await fixture();
  await f.t.run(async ctx => {
    for (const [start, end] of ranges) await ctx.db.insert("shiftAssignments", { projectId: f.projectId, employeeId: f.employeeId, shiftId: f.shiftId, startDate: `2026-06-${String(start).padStart(2, "0")}`, endDate: `2026-06-${String(end).padStart(2, "0")}`, createdAt: "", updatedAt: "" });
  });
  const payroll = await f.caller.query(api.cardReadings.getMonthlyPayrollSheet, { projectId: f.projectId, year: 2026, month: 6 });
  const row = payroll.rows[0];
  expect(row?.cells.map(cell => cell.date)).toEqual(payroll.days);
  for (const cell of row?.cells ?? []) {
    const day = Number(cell.date.slice(-2));
    if (!ranges.some(([start, end]) => day >= start && day <= end)) expect(cell).toMatchObject({ noShift: true, payrollCode: "—", totalMinutes: 0, overtimeMinutes: 0, isLate: false, isManual: false });
  }
  expect(row?.totals.totalMinutes).toBe(row?.cells.filter(cell => !cell.noShift).reduce((sum, cell) => sum + cell.totalMinutes, 0));
});

it("SGK monthly leave counts only the planned part of approved leave", async () => {
  const f = await fixture();
  await f.t.run(async ctx => {
    await ctx.db.insert("shiftAssignments", { projectId: f.projectId, employeeId: f.employeeId, shiftId: f.shiftId, startDate: "2026-06-15", endDate: "2026-06-30", createdAt: "", updatedAt: "" });
    for (const [startDate, endDate] of [["2026-06-03", "2026-06-05"], ["2026-06-14", "2026-06-16"]]) await ctx.db.insert("leaves", { projectId: f.projectId, employeeId: f.employeeId, startDate, endDate, leaveType: "annual", status: "approved", createdAt: "", updatedAt: "" });
  });
  const report = await f.caller.query(api.reports.getSgkMonthlyReport, { projectId: f.projectId, year: 2026, month: 6 });
  expect(report.rows).toHaveLength(1);
  expect(report.rows[0]?.izinGunu).toBe(2);
});

it("foreign project shift assignments do not grant dashboard or SGK attendance", async () => {
  const f = await fixture();
  await f.t.run(async ctx => {
    const foreign = await ctx.db.insert("projects", { name: "Foreign" });
    await ctx.db.patch(f.shiftId, { projectId: foreign });
    await ctx.db.insert("shiftAssignments", { projectId: f.projectId, employeeId: f.employeeId, shiftId: f.shiftId, startDate: "2026-06-01", endDate: "2026-06-30", createdAt: "", updatedAt: "" });
  });
  expect((await f.caller.query(api.sgkExport.buildAphbForMonth, { projectId: f.projectId, year: 2026, month: 6 })).warnings)
    .toContain("Plansız Kişi: vardiya atanmamış; PDKS verisi yok, prim günü devamsızlık düşülmeden istihdam günlerinden hesaplandı, bildirimden önce kontrol edin.");
  vi.setSystemTime(new Date("2026-06-15T12:00:00Z"));
  expect(await f.caller.query(api.dashboard.getActivitySummary, { projectId: f.projectId })).toMatchObject({ presentToday: 0, lateArrivals: 0 });
});

it("over 10000 expired personal and 2000 department assignments do not break reports or dashboard; each resolver loads once", async () => {
  const f = await fixture();
  await f.t.run(async ctx => {
    const departmentId = await ctx.db.insert("departments", { projectId: f.projectId, name: "Old", createdAt: "", updatedAt: "" });
    await ctx.db.patch(f.employeeId, { departmentId });
    for (let i = 0; i < 10001; i++) await ctx.db.insert("shiftAssignments", { projectId: f.projectId, employeeId: f.employeeId, shiftId: f.shiftId, startDate: "2025-01-01", endDate: "2025-01-02", createdAt: "", updatedAt: "" });
    for (let i = 0; i < 2001; i++) await ctx.db.insert("departmentShiftAssignments", { projectId: f.projectId, departmentId, shiftId: f.shiftId, startDate: "2025-01-01", endDate: "2025-01-02", createdAt: "", updatedAt: "" });
    await ctx.db.insert("shiftAssignments", { projectId: f.projectId, employeeId: f.employeeId, shiftId: f.shiftId, startDate: "2026-06-01", endDate: "2026-06-30", createdAt: "", updatedAt: "" });
  });
  vi.setSystemTime(new Date("2026-06-15T12:00:00Z"));
  for (const target of ["adapter", "dashboard", "sgk"] as const) await f.caller.run(async ctx => {
    const tables = new Map<string, number>();
    const db = new Proxy(ctx.db, { get(object, key) {
      if (key !== "query") return Reflect.get(object, key);
      return (table: string) => { tables.set(table, (tables.get(table) ?? 0) + 1); return Reflect.apply(object.query, object, [table]); };
    } });
    if (target === "adapter") {
      const report = await loadRuleReportDays({ ...ctx, db }, [f.projectId], "2026-06-01", "2026-06-30");
      expect(report.readings).toHaveLength(4);
    } else if (target === "dashboard") {
      const handler = getActivitySummary as unknown as { _handler: (ctx: QueryCtx, args: { projectId: typeof f.projectId }) => Promise<unknown> };
      expect(await handler._handler({ ...ctx, db }, { projectId: f.projectId })).toMatchObject({ presentToday: 1 });
    } else {
      const handler = buildAphbForMonth as unknown as { _handler: (ctx: QueryCtx, args: { projectId: typeof f.projectId; year: number; month: number }) => Promise<unknown> };
      expect(await handler._handler({ ...ctx, db }, { projectId: f.projectId, year: 2026, month: 6 })).toMatchObject({ employees: [{ employeeId: f.employeeId }] });
    }
    expect(tables.get("shiftAssignments")).toBe(1);
    expect(tables.get("employees")).toBe(1);
    expect(tables.get("departmentShiftAssignments")).toBeLessThanOrEqual(2);
  });
}, 30000);

it("SGK deducts planned-day absence and unpaid leave on unplanned days, never bare unplanned days", async () => {
  const f = await fixture();
  await f.t.run(async ctx => {
    // 16 Haziran 2026 Salı: vardiyalı ama okutma yok → devamsızlık. 17 Haziran Çarşamba: vardiyasız + ücretsiz izin → eksik gün.
    await ctx.db.insert("shiftAssignments", { projectId: f.projectId, employeeId: f.employeeId, shiftId: f.shiftId, startDate: "2026-06-16", endDate: "2026-06-16", createdAt: "", updatedAt: "" });
    await ctx.db.insert("leaves", { projectId: f.projectId, employeeId: f.employeeId, startDate: "2026-06-17", endDate: "2026-06-17", leaveType: "unpaid", status: "approved", createdAt: "", updatedAt: "" });
  });
  const aphb = await f.caller.query(api.sgkExport.buildAphbForMonth, { projectId: f.projectId, year: 2026, month: 6 });
  expect(aphb.xml).toContain("<calismaGunu>28</calismaGunu>");
  expect(aphb.xml).toContain("<eksikGunSayisi>2</eksikGunSayisi>");
  expect(aphb.warnings).toContain("Plansız Kişi: 29 gün vardiya atanmamış; bu günler devamsızlık sayılmadan prim gününe dahil edildi, bildirimden önce kontrol edin.");
});
