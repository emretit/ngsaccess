import { v } from "convex/values";
import { makeFunctionReference, paginationOptsValidator } from "convex/server";
import { internalMutation } from "./_generated/server";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { authedMutation, authedQuery } from "./lib/customFunctions";
import { requireSuperAdmin } from "./lib/auth";
import { getProjectRole } from "./lib/permissions";
import { resolveReadingScope, REPORT_READING_PERMISSIONS } from "./lib/readingAccess";
import { writeAudit } from "./lib/audit";
import { loadPayrollPeriod } from "./lib/pdksPayrollQuery";
import { canSeePayInProject } from "./lib/payVisibility";
import { addWorkDate } from "./lib/pdksWorkDay";
import { buildPeriodDateKeys } from "./lib/pdksCalc";
import { readPdksAvailableDateKeys } from "./lib/pdksAvailability";
import { loadPdksPolicies } from "./lib/pdksRules";
import { trDayRangeISO, trDateKey, trTodayKey } from "./lib/trDate";

const periodArgs = { projectId: v.id("projects"), period: v.string() };
const BATCH_SIZE = 10;
const ROW_BYTES = 200000;
const batchRef = makeFunctionReference<"mutation", { jobId: Id<"payrollSnapshotJobs"> }, null>("payrollPeriods:storeSnapshotBatch");
type PayrollCtx = QueryCtx & { user: Doc<"users"> };
type PayrollRow = Awaited<ReturnType<typeof loadPayrollPeriod>>["rows"][number];
function range(period: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period) || Number(period.slice(0, 4)) < 1000) throw new Error("Geçerli bir dönem seçin (YYYY-MM)");
  const [year, month] = period.split("-").map(Number);
  return { startDate: `${period}-01`, endDate: `${period}-${new Date(Date.UTC(year, month, 0)).getUTCDate()}` };
}
async function currentPeriod(ctx: QueryCtx, args: { projectId: Id<"projects">; period: string }) {
  return ctx.db.query("payrollPeriods").withIndex("by_projectId_and_period", q => q.eq("projectId", args.projectId).eq("period", args.period)).order("desc").first();
}
async function projectAvailableDates(ctx: QueryCtx, projectId: Id<"projects">, dates: ReturnType<typeof range>) {
  const start = addWorkDate(dates.startDate, -9), end = addWorkDate(dates.endDate, 2);
  const keys = buildPeriodDateKeys(start, end);
  const policies = await loadPdksPolicies(ctx, [projectId], start, end);
  const available = await readPdksAvailableDateKeys(ctx, projectId, keys, reading => trDateKey(reading.accessTime), policies);
  return keys.filter(date => available.has(date));
}
async function requireAdmin(ctx: PayrollCtx, projectId: Id<"projects">) {
  if (ctx.user.role !== "super_admin" && await getProjectRole(ctx, ctx.user, projectId) !== "admin") throw new Error("Proje yöneticisi yetkisi gerekli");
}
async function scheduleJob(ctx: MutationCtx, jobId: Id<"payrollSnapshotJobs">) {
  const scheduledId = await ctx.scheduler.runAfter(0, batchRef, { jobId });
  await ctx.db.patch(jobId, { scheduledId });
}

/** One small employee page per transaction; scheduler arguments contain only a job ID. */
export const closePayrollPeriod = authedMutation({
  args: periodArgs,
  handler: async (ctx, args) => {
    const dates = range(args.period);
    await requireAdmin(ctx, args.projectId);
    if (args.period >= trTodayKey().slice(0, 7)) throw new Error("Yalnız tamamlanmış geçmiş aylar kapatılabilir (İstanbul saati)");
    if (!await ctx.db.get(args.projectId)) throw new Error("Proje bulunamadı");
    if ((await currentPeriod(ctx, args))?.status === "closed") throw new Error("Dönem zaten kapalı; yarım kapanış için tekrar deneyin veya süper admin yeniden açsın");
    // Freeze project availability before any later reading arrives.
    const availableDates = await projectAvailableDates(ctx, args.projectId, dates);
    const periodId = await ctx.db.insert("payrollPeriods", { ...args, status: "closed", closedAt: Date.now(), closedBy: ctx.user._id, availableDates, snapshotReady: false, expectedRows: 0, storedRows: 0 });
    const jobId = await ctx.db.insert("payrollSnapshotJobs", { periodId, cursor: null, processedRows: 0, completed: false });
    await scheduleJob(ctx, jobId);
    await writeAudit(ctx, { user: ctx.user, projectId: args.projectId, action: "create", targetTable: "payrollPeriods", targetId: periodId, newValue: { period: args.period, status: "closed" }, note: "Bordro dönemi kapanışı başlatıldı" });
    return periodId;
  },
});

/** Read only the selected employees, including legacy card-only readings. */
async function employeePayroll(ctx: PayrollCtx, period: Doc<"payrollPeriods">, employees: Doc<"employees">[], snapshot: boolean) {
  const dates = range(period.period);
  const bounds = trDayRangeISO(addWorkDate(dates.startDate, -9), addWorkDate(dates.endDate, 2));
  const lists = await Promise.all(employees.flatMap(employee => [
    ctx.db.query("cardReadings").withIndex("by_project_employee_time", q => q.eq("projectId", period.projectId).eq("employeeId", employee._id).gte("accessTime", bounds.startISO).lte("accessTime", bounds.endISO)).take(1001),
    ctx.db.query("cardReadings").withIndex("by_project_card_time", q => q.eq("projectId", period.projectId).eq("cardNo", employee.cardNumber).gte("accessTime", bounds.startISO).lte("accessTime", bounds.endISO)).take(1001),
  ]));
  if (lists.some(list => list.length > 1000)) throw new Error("Personel okuma sınırı aşıldı; bordro kapanışını yeniden açıp okumaları inceleyin");
  const readings = [...new Map(lists.flat().filter(reading => !snapshot || reading._creationTime <= period._creationTime).map(reading => [reading._id, reading])).values()];
  const availableDates = snapshot ? period.availableDates : await projectAvailableDates(ctx, period.projectId, dates);
  return loadPayrollPeriod(ctx, { projectId: period.projectId, ...dates }, undefined, {
    employees, readings: { readings, ...bounds }, availableDates, ...(snapshot ? { snapshotAt: period._creationTime } : {}),
  });
}

export const storeSnapshotBatch = internalMutation({
  args: { jobId: v.id("payrollSnapshotJobs") },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job || job.completed) return null;
    const period = await ctx.db.get(job.periodId);
    if (!period || period.status !== "closed" || period.snapshotReady) return null;
    const user = await ctx.db.get(period.closedBy);
    if (!user) throw new Error("Kapanışı başlatan kullanıcı bulunamadı; süper admin dönemi yeniden açabilir");
    const page = await ctx.db.query("employees").withIndex("by_project", q => q.eq("projectId", period.projectId)).paginate({ numItems: BATCH_SIZE, cursor: job.cursor, maximumBytesRead: 500000 });
    const employees = page.page.filter(employee => employee._creationTime <= period._creationTime);
    const sheet = await employeePayroll({ ...ctx, user }, period, employees, true);
    for (const row of sheet.rows) {
      const rowJson = JSON.stringify(row);
      if (new TextEncoder().encode(rowJson).length > ROW_BYTES) throw new Error("Bordro satırı boyut sınırı aşıldı; süper admin dönemi yeniden açabilir");
      await ctx.db.insert("payrollPeriodRows", { periodId: period._id, employeeId: row.employeeId, companyId: employees.find(employee => employee._id === row.employeeId)?.companyId,
        formatVersion: 1, rowJson, workedDays: row.cells.filter(cell => cell.payrollCode === "N").length, totalMinutes: row.totals.totalMinutes });
    }
    const processedRows = job.processedRows + sheet.rows.length;
    await ctx.db.patch(job._id, { completed: true });
    if (page.isDone) {
      // Only the last job writes completion; ordinary batches never contend on the period.
      await ctx.db.patch(period._id, { snapshotReady: true, storedRows: processedRows, expectedRows: processedRows });
    } else {
      const nextId = await ctx.db.insert("payrollSnapshotJobs", { periodId: period._id, cursor: page.continueCursor, processedRows, completed: false });
      await scheduleJob(ctx, nextId);
    }
    return null;
  },
});

export const retryPayrollPeriod = authedMutation({
  args: periodArgs,
  handler: async (ctx, args) => {
    range(args.period);
    await requireAdmin(ctx, args.projectId);
    const period = await currentPeriod(ctx, args);
    if (!period || period.status !== "closed" || period.snapshotReady) throw new Error("Yarım kalan kapanış bulunamadı");
    const job = await ctx.db.query("payrollSnapshotJobs").withIndex("by_periodId", q => q.eq("periodId", period._id)).order("desc").first();
    if (!job || job.completed) throw new Error("Bu kapanış süper admin tarafından yeniden açılmalı");
    const scheduled = job.scheduledId ? await ctx.db.system.get(job.scheduledId) : null;
    if (scheduled?.state.kind === "inProgress" || scheduled?.state.kind === "pending") throw new Error("Kapanış işlemi devam ediyor");
    await scheduleJob(ctx, job._id);
    await writeAudit(ctx, { user: ctx.user, projectId: args.projectId, action: "update", targetTable: "payrollPeriods", targetId: period._id, note: "Yarım kalan bordro kapanışı tekrar denendi" });
    return null;
  },
});

export const reopenPayrollPeriod = authedMutation({
  args: periodArgs,
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    range(args.period);
    const period = await currentPeriod(ctx, args);
    if (!period || period.status !== "closed") throw new Error("Kapalı dönem bulunamadı");
    // Also the escape hatch for failed, old-format or half-written snapshots.
    await ctx.db.patch(period._id, { status: "reopened", reopenedAt: Date.now(), reopenedBy: ctx.user._id });
    await writeAudit(ctx, { user: ctx.user, projectId: args.projectId, action: "update", targetTable: "payrollPeriods", targetId: period._id, oldValue: { status: "closed" }, newValue: { status: "reopened" }, note: "Bordro dönemi yeniden açıldı" });
    return null;
  },
});

export const getPayrollPeriod = authedQuery({
  args: periodArgs,
  handler: async (ctx, args) => {
    range(args.period);
    await resolveReadingScope(ctx, args.projectId, REPORT_READING_PERMISSIONS);
    const period = await currentPeriod(ctx, args);
    if (!period || period.snapshotReady || period.status !== "closed") return period ? { ...period, snapshotError: null, snapshotProgressRows: period.storedRows } : null;
    const job = await ctx.db.query("payrollSnapshotJobs").withIndex("by_periodId", q => q.eq("periodId", period._id)).order("desc").first();
    const scheduled = job?.scheduledId ? await ctx.db.system.get(job.scheduledId) : null;
    const failed = !job || !scheduled || scheduled.state.kind === "failed" || scheduled.state.kind === "canceled" || scheduled.state.kind === "success";
    return { ...period, snapshotError: failed ? "Bordro sabitleme tamamlanamadı. Kapanışı tekrar deneyin veya süper admin dönemi yeniden açsın." : null, snapshotProgressRows: job?.processedRows ?? 0 };
  },
});

function maskRow(saved: Doc<"payrollPeriodRows">, payVisible: boolean): PayrollRow {
  const row = JSON.parse(saved.rowJson) as PayrollRow;
  return payVisible ? row : { ...row, hourlyRate: null, cells: row.cells.map(cell => ({ ...cell, overtimePayTRY: null })), totals: { ...row.totals, overtimePayTRY: null } };
}
export const listPayrollPeriodRows = authedQuery({
  args: { ...periodArgs, paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    range(args.period);
    await resolveReadingScope(ctx, args.projectId, REPORT_READING_PERMISSIONS);
    const period = await currentPeriod(ctx, args);
    if (!period || period.status !== "closed" || !period.snapshotReady) return { page: [], isDone: true, continueCursor: "" };
    const result = await ctx.db.query("payrollPeriodRows").withIndex("by_periodId_and_employeeId", q => q.eq("periodId", period._id)).paginate({ ...args.paginationOpts, numItems: Math.min(args.paginationOpts.numItems, 25), maximumBytesRead: 1000000 });
    const payVisible = await canSeePayInProject(ctx, ctx.user, args.projectId);
    return { ...result, page: result.page.map(row => maskRow(row, payVisible)) };
  },
});

async function diffPage(ctx: PayrollCtx, args: { projectId: Id<"projects">; period: string; cursor?: string | null }) {
  range(args.period);
  await resolveReadingScope(ctx, args.projectId, REPORT_READING_PERMISSIONS);
  const period = await currentPeriod(ctx, args);
  if (!period || period.status !== "closed" || !period.snapshotReady) return { page: [], isDone: true, continueCursor: "" };
  // After frozen employees, scan live employees without a snapshot (new hires/assignments).
  if (args.cursor?.startsWith("new:")) {
    const cursor = args.cursor.slice(4) || null;
    const employees = await ctx.db.query("employees").withIndex("by_project", q => q.eq("projectId", period.projectId)).paginate({ numItems: BATCH_SIZE, cursor, maximumBytesRead: 500000 });
    const missing: Doc<"employees">[] = [];
    for (const employee of employees.page) {
      const old = await ctx.db.query("payrollPeriodRows").withIndex("by_periodId_and_employeeId", q => q.eq("periodId", period._id).eq("employeeId", employee._id)).unique();
      if (!old) missing.push(employee);
    }
    const live = await employeePayroll(ctx, period, missing, false);
    return { page: live.rows.map(row => ({ employeeId: row.employeeId, name: row.name, oldDays: 0, newDays: row.cells.filter(cell => cell.payrollCode === "N").length, oldMinutes: 0, newMinutes: row.totals.totalMinutes })), isDone: employees.isDone, continueCursor: `new:${employees.continueCursor}` };
  }
  const saved = await ctx.db.query("payrollPeriodRows").withIndex("by_periodId_and_employeeId", q => q.eq("periodId", period._id)).paginate({ numItems: BATCH_SIZE, cursor: args.cursor ?? null, maximumBytesRead: 1000000 });
  const employees = (await Promise.all(saved.page.map(row => ctx.db.get(row.employeeId)))).filter((employee): employee is NonNullable<typeof employee> => employee !== null && employee.projectId === period.projectId);
  const live = await employeePayroll(ctx, period, employees, false);
  const newById = new Map(live.rows.map(row => [row.employeeId, row]));
  const page = saved.page.flatMap(old => {
    const row = newById.get(old.employeeId), oldRow = maskRow(old, false);
    const newDays = row?.cells.filter(cell => cell.payrollCode === "N").length ?? 0;
    const newMinutes = row?.totals.totalMinutes ?? 0;
    const cellsWithoutPay = (cells: PayrollRow["cells"] | undefined) => cells?.map(({ overtimePayTRY: _pay, ...cell }) => cell);
    const changed = JSON.stringify(cellsWithoutPay(oldRow.cells)) !== JSON.stringify(cellsWithoutPay(row?.cells));
    return changed || old.totalMinutes !== newMinutes || old.workedDays !== newDays ? [{ employeeId: old.employeeId, name: row?.name ?? oldRow.name, oldDays: old.workedDays, newDays, oldMinutes: old.totalMinutes, newMinutes }] : [];
  });
  return { ...saved, page, isDone: false, continueCursor: saved.isDone ? "new:" : saved.continueCursor };
}
export const listPayrollPeriodDiffs = authedQuery({
  args: { ...periodArgs, cursor: v.optional(v.union(v.string(), v.null())) },
  handler: async (ctx, args) => (await diffPage(ctx, args)).page,
});
export const listPayrollPeriodDiffsPage = authedQuery({
  args: { ...periodArgs, paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => diffPage(ctx, { ...args, cursor: args.paginationOpts.cursor }),
});
