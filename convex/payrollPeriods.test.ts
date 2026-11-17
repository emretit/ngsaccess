// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import type { FunctionArgs, FunctionReturnType, ApiFromModules } from "convex/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import type * as periods from "./payrollPeriods";
type PeriodApi = ApiFromModules<{ payrollPeriods: typeof periods }>["payrollPeriods"];
const close = makeFunctionReference<"mutation", FunctionArgs<PeriodApi["closePayrollPeriod"]>, FunctionReturnType<PeriodApi["closePayrollPeriod"]>>("payrollPeriods:closePayrollPeriod");
const reopen = makeFunctionReference<"mutation", FunctionArgs<PeriodApi["reopenPayrollPeriod"]>, FunctionReturnType<PeriodApi["reopenPayrollPeriod"]>>("payrollPeriods:reopenPayrollPeriod");
const getPeriod = makeFunctionReference<"query", FunctionArgs<PeriodApi["getPayrollPeriod"]>, FunctionReturnType<PeriodApi["getPayrollPeriod"]>>("payrollPeriods:getPayrollPeriod");
const retry = makeFunctionReference<"mutation", FunctionArgs<PeriodApi["retryPayrollPeriod"]>, FunctionReturnType<PeriodApi["retryPayrollPeriod"]>>("payrollPeriods:retryPayrollPeriod");
const rowsQuery = makeFunctionReference<"query", FunctionArgs<PeriodApi["listPayrollPeriodRows"]>, FunctionReturnType<PeriodApi["listPayrollPeriodRows"]>>("payrollPeriods:listPayrollPeriodRows");
const diffs = makeFunctionReference<"query", FunctionArgs<PeriodApi["listPayrollPeriodDiffs"]>, FunctionReturnType<PeriodApi["listPayrollPeriodDiffs"]>>("payrollPeriods:listPayrollPeriodDiffs");
vi.setConfig({ testTimeout: 30000 });
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-07-05T20:00:00Z")); });
afterEach(() => vi.useRealTimers());
async function fixture() {
  const t = convexTest(schema, import.meta.glob("./**/*.ts"));
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "Bordro" });
    const adminId = await ctx.db.insert("users", { role: "project_admin" });
    const superId = await ctx.db.insert("users", { role: "super_admin" });
    const adminSession = await ctx.db.insert("authSessions", { userId: adminId, expirationTime: Date.now() + 86400000 });
    const superSession = await ctx.db.insert("authSessions", { userId: superId, expirationTime: Date.now() + 86400000 });
    await ctx.db.insert("userProjects", { projectId, userId: adminId, role: "admin" });
    const shiftId = await ctx.db.insert("shifts", { projectId, name: "Gündüz", startTime: "08:00", endTime: "17:00", createdAt: "", updatedAt: "" });
    const employeeId = await ctx.db.insert("employees", { projectId, shiftId, firstName: "Ada", lastName: "Test", email: "ada@example.test", cardNumber: "1", isActive: true });
    await ctx.db.insert("shiftAssignments", { projectId, employeeId, shiftId, startDate: "2026-06-01", endDate: "2026-06-30", createdAt: "", updatedAt: "" });
    for (const [time, direction] of [["08:00", "entry"], ["17:00", "exit"]] as const) await ctx.db.insert("cardReadings", { projectId, employeeId, cardNo: "1", accessTime: new Date(`2026-06-22T${time}:00+03:00`).toISOString(), direction, accessStatus: "izin_verildi" });
    return { projectId, employeeId, adminId, superId, adminSession, superSession };
  });
  return { t, ...ids, args: { projectId: ids.projectId, period: "2026-06" }, admin: t.withIdentity({ subject: `${ids.adminId}|${ids.adminSession}` }), root: t.withIdentity({ subject: `${ids.superId}|${ids.superSession}` }) };
}
async function closeAndFinish(f: Awaited<ReturnType<typeof fixture>>) {
  const id = await f.admin.mutation(close, f.args);
  await f.t.finishAllScheduledFunctions(() => vi.runAllTimers());
  return id;
}
it("freezes payroll despite late readings and lists employee differences", async () => {
  const f = await fixture();
  const sheetArgs = { projectId: f.projectId, year: 2026, month: 6 };
  const before = await f.admin.query(api.cardReadings.getMonthlyPayrollSheet, sheetArgs);
  expect(before.rows).toHaveLength(1);
  await closeAndFinish(f);
  expect(await f.admin.query(diffs, f.args)).toEqual([]);
  await f.t.run(ctx => ctx.db.insert("cardReadings", { projectId: f.projectId, employeeId: f.employeeId, cardNo: "1", accessTime: "2026-06-22T16:00:00.000Z", direction: "exit", accessStatus: "izin_verildi" }));
  const after = await f.admin.query(api.cardReadings.getMonthlyPayrollSheet, sheetArgs);
  expect(after.isClosed).toBe(true);
  expect(after.rows).toEqual(before.rows);
  const changes = await f.admin.query(diffs, f.args);
  expect(changes).toHaveLength(1);
  expect(changes[0].oldMinutes).toBe(before.rows[0].totals.totalMinutes);
  expect(changes[0].newMinutes).toBeGreaterThan(changes[0].oldMinutes);
});
it("only super_admin reopens and both transitions write audit records", async () => {
  const f = await fixture();
  const periodId = await closeAndFinish(f);
  await expect(f.admin.mutation(reopen, f.args)).rejects.toThrow("süper admin");
  await f.root.mutation(reopen, f.args);
  const period = await f.t.run(ctx => ctx.db.get(periodId));
  expect(period).toMatchObject({ status: "reopened", reopenedBy: f.superId });
  const audits = await f.t.run(ctx => ctx.db.query("auditLog").collect());
  expect(audits.filter(row => row.targetTable === "payrollPeriods")).toHaveLength(2);
  await closeAndFinish(f);
  expect((await f.admin.query(api.cardReadings.getMonthlyPayrollSheet, { projectId: f.projectId, year: 2026, month: 6 })).isClosed).toBe(true);
});
it("rejects manual correction in a closed month", async () => {
  const f = await fixture();
  await closeAndFinish(f);
  await expect(f.admin.mutation(api.pdksRecords.upsertManual, { employeeId: f.employeeId, date: "2026-06-22", entryTime: "08:00", exitTime: "18:00", note: "Düzeltme" })).rejects.toThrow(/[Dd]önem kapalı/);
  expect(await f.t.run(ctx => ctx.db.query("pdksRecords").collect())).toEqual([]);
});
it("rejects non-admin closing", async () => {
  const f = await fixture();
  await f.t.run(async ctx => {
    const membership = await ctx.db.query("userProjects").first();
    if (membership) await ctx.db.patch(membership._id, { role: "viewer" });
  });
  await expect(f.admin.mutation(close, f.args)).rejects.toThrow("Proje yöneticisi");
});
it("scheduled batches store only rows frozen at closure and preserve history", async () => {
  const f = await fixture();
  await f.t.run(async ctx => {
    const original = await ctx.db.get(f.employeeId);
    if (!original?.shiftId) throw new Error("Missing fixture shift");
    for (let i = 0; i < 51; i++) {
      const employeeId = await ctx.db.insert("employees", { projectId: f.projectId, firstName: "Batch", lastName: String(i), cardNumber: String(i + 100), email: `batch${i}@example.test`, isActive: true });
      await ctx.db.insert("shiftAssignments", { projectId: f.projectId, employeeId, shiftId: original.shiftId, startDate: "2026-06-01", endDate: "2026-06-30", createdAt: "", updatedAt: "" });
    }
  });
  const periodId = await f.admin.mutation(close, f.args);
  expect(await f.t.run(ctx => ctx.db.get(periodId))).toMatchObject({ snapshotReady: false, storedRows: 0 });
  // A reading inserted before the employee's scheduled page runs is still excluded.
  await f.t.run(ctx => ctx.db.insert("cardReadings", { projectId: f.projectId, employeeId: f.employeeId, cardNo: "1", accessTime: "2026-06-22T16:00:00.000Z", direction: "exit", accessStatus: "izin_verildi" }));
  await f.t.finishAllScheduledFunctions(() => vi.runAllTimers());
  expect(await f.t.run(ctx => ctx.db.get(periodId))).toMatchObject({ snapshotReady: true, storedRows: 52 });
  const sheet = await f.admin.query(api.cardReadings.getMonthlyPayrollSheet, { projectId: f.projectId, year: 2026, month: 6 });
  expect(sheet.rows.length).toBeLessThanOrEqual(25);
  expect(sheet.snapshotTruncated).toBe(true);
  const allRows: FunctionReturnType<PeriodApi["listPayrollPeriodRows"]>["page"] = [];
  let cursor: string | null = null;
  for (;;) {
    const page: FunctionReturnType<PeriodApi["listPayrollPeriodRows"]> = await f.admin.query(rowsQuery, { ...f.args, paginationOpts: { numItems: 25, cursor } });
    allRows.push(...page.page);
    if (page.isDone) break;
    cursor = page.continueCursor;
  }
  expect(allRows).toHaveLength(52);
  expect(new Set(allRows.map(row => row.employeeId)).size).toBe(52);
  expect((await f.admin.query(diffs, f.args)).length).toBeGreaterThan(0);
});
it("masks frozen salary data according to the reader's current permissions", async () => {
  const f = await fixture();
  await f.t.run(ctx => ctx.db.patch(f.employeeId, { hourlyRate: 100 }));
  await closeAndFinish(f);
  await f.t.run(async ctx => {
    const membership = await ctx.db.query("userProjects").first();
    if (membership) await ctx.db.patch(membership._id, { role: "viewer" });
  });
  const sheet = await f.admin.query(api.cardReadings.getMonthlyPayrollSheet, { projectId: f.projectId, year: 2026, month: 6 });
  expect(sheet.rows[0].hourlyRate).toBeNull();
  expect(sheet.rows[0].totals.overtimePayTRY).toBeNull();
  expect(sheet.rows[0].cells.every(cell => cell.overtimePayTRY === null)).toBe(true);
});
it("reports permanent batch failure, lets admin retry it, and completes without duplicating rows", async () => {
  const f = await fixture();
  const extras = await f.t.run(async ctx => {
    const ids = [];
    for (let i = 0; i < 1001; i++) ids.push(await ctx.db.insert("cardReadings", { projectId: f.projectId, employeeId: f.employeeId, cardNo: "1", accessTime: "2026-06-22T06:00:00.000Z", direction: "entry", accessStatus: "izin_verildi" }));
    return ids;
  });
  await f.admin.mutation(close, f.args);
  const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
  try { await f.t.finishAllScheduledFunctions(() => vi.runAllTimers()); } finally { errorLog.mockRestore(); }
  expect((await f.admin.query(getPeriod, f.args))?.snapshotError).toContain("tamamlanamadı");
  await f.t.run(async ctx => { for (const id of extras) await ctx.db.delete(id); });
  await f.admin.mutation(retry, f.args);
  await f.t.finishAllScheduledFunctions(() => vi.runAllTimers());
  expect(await f.admin.query(getPeriod, f.args)).toMatchObject({ snapshotReady: true, storedRows: 1, snapshotError: null });
  expect(await f.t.run(ctx => ctx.db.query("payrollPeriodRows").collect())).toHaveLength(1);
});
it("super_admin can reopen an unfinished close and stale scheduled work cannot relock it", async () => {
  const f = await fixture();
  const periodId = await f.admin.mutation(close, f.args);
  await expect(f.admin.mutation(reopen, f.args)).rejects.toThrow("süper admin");
  await f.root.mutation(reopen, f.args);
  await f.t.finishAllScheduledFunctions(() => vi.runAllTimers());
  expect(await f.t.run(ctx => ctx.db.get(periodId))).toMatchObject({ status: "reopened", snapshotReady: false });
  await expect(f.admin.mutation(api.pdksRecords.upsertManual, { employeeId: f.employeeId, date: "2026-06-22", entryTime: "08:00", exitTime: "18:00", note: "Kurtarılan dönem" })).resolves.toBeDefined();
});
it.each(["2026-07", "2026-08"])("rejects current and future month %s using the Istanbul calendar", async period => {
  const f = await fixture();
  // Still June in UTC, already July in Istanbul.
  vi.setSystemTime(new Date("2026-06-30T21:00:00Z"));
  await expect(f.root.mutation(close, { ...f.args, period })).rejects.toThrow("geçmiş aylar");
  await f.root.mutation(close, f.args);
  await f.root.mutation(reopen, f.args);
  await f.t.finishAllScheduledFunctions(() => vi.runAllTimers());
});
it("one job schedules one successor with an ID-only payload and ordinary pages do not patch the period", async () => {
  const f = await fixture();
  await f.t.run(async ctx => {
    for (let i = 0; i < 11; i++) await ctx.db.insert("employees", { projectId: f.projectId, firstName: "Page", lastName: String(i), cardNumber: `page-${i}`, email: `p${i}@test.example` });
  });
  const periodId = await f.admin.mutation(close, f.args);
  const first = await f.t.run(ctx => ctx.db.query("payrollSnapshotJobs").withIndex("by_periodId", q => q.eq("periodId", periodId)).first());
  if (!first?.scheduledId) throw new Error("Missing scheduled job");
  await f.t.run(ctx => ctx.scheduler.cancel(first.scheduledId as NonNullable<typeof first.scheduledId>));
  const ref = makeFunctionReference<"mutation", { jobId: typeof first._id }, null>("payrollPeriods:storeSnapshotBatch");
  await f.t.mutation(ref, { jobId: first._id });
  const jobs = await f.t.run(ctx => ctx.db.query("payrollSnapshotJobs").withIndex("by_periodId", q => q.eq("periodId", periodId)).collect());
  expect(jobs).toHaveLength(2);
  expect(await f.t.run(ctx => ctx.db.get(periodId))).toMatchObject({ snapshotReady: false, storedRows: 0 });
  for (const job of jobs) {
    if (!job.scheduledId) throw new Error("Missing scheduler ID");
    expect((await f.t.run(ctx => ctx.db.system.get(job.scheduledId as NonNullable<typeof job.scheduledId>)))?.args).toEqual([{ jobId: job._id }]);
  }
  await f.t.mutation(ref, { jobId: first._id });
  expect(await f.t.run(ctx => ctx.db.query("payrollSnapshotJobs").collect())).toHaveLength(2);
  await f.t.finishAllScheduledFunctions(() => vi.runAllTimers());
  expect(await f.t.run(ctx => ctx.db.get(periodId))).toMatchObject({ snapshotReady: true });
});
it("bounds snapshot reads for a project with over 1500 employees instead of returning the entire snapshot", async () => {
  const f = await fixture();
  const periodId = await closeAndFinish(f);
  const source = await f.t.run(ctx => ctx.db.query("payrollPeriodRows").first());
  if (!source) throw new Error("Missing snapshot fixture");
  const original = JSON.parse(source.rowJson) as { name: string; employeeId: string };
  // Seed in bounded transactions: the aggregate snapshot exceeds the 16 MiB query limit.
  for (let offset = 0; offset < 1600; offset += 100) await f.t.run(async ctx => {
    for (let i = offset; i < offset + 100; i++) {
      const employeeId = await ctx.db.insert("employees", { projectId: f.projectId, firstName: "Large", lastName: String(i), email: `large${i}@test.example`, cardNumber: `large${i}` });
      await ctx.db.insert("payrollPeriodRows", { periodId, employeeId, formatVersion: 1, rowJson: JSON.stringify({ ...original, name: `${i}:${"x".repeat(12000)}`, employeeId }), workedDays: source.workedDays, totalMinutes: source.totalMinutes });
    }
  });
  let cursor: string | null = null, count = 0;
  for (;;) {
    const page: FunctionReturnType<PeriodApi["listPayrollPeriodRows"]> = await f.admin.query(rowsQuery, { ...f.args, paginationOpts: { cursor, numItems: 10000 } });
    expect(page.page.length).toBeLessThanOrEqual(25);
    count += page.page.length;
    if (page.isDone) break;
    cursor = page.continueCursor;
  }
  expect(count).toBe(1601);
  const legacy = await f.admin.query(api.cardReadings.getMonthlyPayrollSheet, { projectId: f.projectId, year: 2026, month: 6 });
  expect(legacy.snapshotTruncated).toBe(true);
  expect(legacy.rows.length).toBeLessThanOrEqual(25);
});
it("paginated difference review also finds employees missing from the original snapshot", async () => {
  const f = await fixture();
  await closeAndFinish(f);
  const employeeId = await f.t.run(async ctx => {
    const original = await ctx.db.get(f.employeeId);
    if (!original?.shiftId) throw new Error("Missing shift");
    const id = await ctx.db.insert("employees", { projectId: f.projectId, firstName: "New", lastName: "Employee", email: "new@test.example", cardNumber: "new", isActive: true });
    await ctx.db.insert("shiftAssignments", { projectId: f.projectId, employeeId: id, shiftId: original.shiftId, startDate: "2026-06-01", endDate: "2026-06-30", createdAt: "", updatedAt: "" });
    for (const [time, direction] of [["08:00", "entry"], ["17:00", "exit"]] as const) await ctx.db.insert("cardReadings", { projectId: f.projectId, employeeId: id, cardNo: "new", accessTime: new Date(`2026-06-22T${time}:00+03:00`).toISOString(), direction, accessStatus: "izin_verildi" });
    return id;
  });
  const ref = makeFunctionReference<"query", FunctionArgs<PeriodApi["listPayrollPeriodDiffsPage"]>, FunctionReturnType<PeriodApi["listPayrollPeriodDiffsPage"]>>("payrollPeriods:listPayrollPeriodDiffsPage");
  const first = await f.admin.query(ref, { ...f.args, paginationOpts: { cursor: null, numItems: 10 } });
  expect(first.page).toEqual([]);
  expect(first.isDone).toBe(false);
  const found: FunctionReturnType<PeriodApi["listPayrollPeriodDiffsPage"]>["page"] = [];
  let cursor = first.continueCursor;
  for (let attempt = 0; attempt < 10; attempt++) {
    const next: FunctionReturnType<PeriodApi["listPayrollPeriodDiffsPage"]> = await f.admin.query(ref, { ...f.args, paginationOpts: { cursor, numItems: 10 } });
    found.push(...next.page);
    if (next.isDone) break;
    cursor = next.continueCursor;
  }
  expect(found).toEqual([expect.objectContaining({ employeeId, oldDays: 0, oldMinutes: 0, newDays: 1 })]);
});
