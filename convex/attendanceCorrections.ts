import { paginationOptsValidator } from "convex/server";
import type { MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { ConvexError, v } from "convex/values";
import { adminMutation, adminQuery, employeeAuthedMutation, employeeAuthedQuery } from "./lib/customFunctions";
import { getProjectIdsForUser, isProjectAllowed, canAccessEmployeeProject } from "./lib/auth";
import { validateManualPdksInput } from "./lib/pdksManual";
import { buildShiftResolver } from "./lib/shiftResolver";
import { writeAudit } from "./lib/audit";
import { istanbulToday, validateCorrectionDate } from "./lib/requestRules";

const correctionType = v.union(v.literal("checkIn"), v.literal("checkOut"), v.literal("both"));
const hhmm = /^([01]\d|2[0-3]):[0-5]\d$/;

export const submit = employeeAuthedMutation({
  args: { date: v.string(), correctionType, requestedCheckIn: v.optional(v.string()), requestedCheckOut: v.optional(v.string()), reason: v.string() },
  handler: async (ctx, args) => {
    const { employee } = ctx;
    if (!employee.projectId) throw new ConvexError("Çalışanın proje bilgisi bulunamadı");
    validateCorrectionDate(args.date, istanbulToday());
    if (args.reason.trim().length < 5 || args.reason.trim().length > 300) throw new ConvexError("Gerekçe 5–300 karakter olmalı");
    const needsIn = args.correctionType !== "checkOut";
    const needsOut = args.correctionType !== "checkIn";
    if ((needsIn && !args.requestedCheckIn) || (needsOut && !args.requestedCheckOut) || (!needsIn && args.requestedCheckIn) || (!needsOut && args.requestedCheckOut)) throw new ConvexError("Düzeltme türüne uygun giriş ve çıkış saatlerini belirtin");
    if (args.requestedCheckIn && !hhmm.test(args.requestedCheckIn)) throw new ConvexError("Geçersiz giriş saati (HH:mm)");
    if (args.requestedCheckOut && !hhmm.test(args.requestedCheckOut)) throw new ConvexError("Geçersiz çıkış saati (HH:mm)");
    const sameDay = await ctx.db.query("attendanceCorrections").withIndex("by_employee_date", q => q.eq("employeeId", employee._id).eq("date", args.date)).take(100);
    if (sameDay.some(item => item.status === "pending")) throw new ConvexError("Bu gün için bekleyen bir düzeltme talebiniz var");
    const now = new Date().toISOString();
    const id = await ctx.db.insert("attendanceCorrections", { ...args, reason: args.reason.trim(), employeeId: employee._id, projectId: employee.projectId, status: "pending", createdAt: now, updatedAt: now });
    await writeAudit(ctx, { user: null, projectId: employee.projectId, action: "create", targetTable: "attendanceCorrections", targetId: id, newValue: { actorType: "employee", employeeId: employee._id, status: "pending" }, note: "Çalışan talebi" });
    return id;
  },
});

export const withdraw = employeeAuthedMutation({
  args: { id: v.id("attendanceCorrections") },
  handler: async (ctx, { id }) => {
    const row = await ctx.db.get(id);
    if (!row || row.employeeId !== ctx.employee._id) throw new ConvexError("Bu düzeltme talebine erişim yetkiniz yok");
    if (row.status !== "pending") throw new ConvexError("Yalnız bekleyen düzeltme talebinizi geri çekebilirsiniz");
    await ctx.db.patch(id, { status: "withdrawn", updatedAt: new Date().toISOString() });
    await writeAudit(ctx, { user: null, projectId: row.projectId, action: "update", targetTable: "attendanceCorrections", targetId: id, oldValue: { actorType: "employee", employeeId: ctx.employee._id, status: row.status }, newValue: { actorType: "employee", employeeId: ctx.employee._id, status: "withdrawn" }, note: "Çalışan talebi" });
    return null;
  },
});

export const listMine = employeeAuthedQuery({
  args: {},
  handler: async (ctx) => {
    const since = istanbulToday(Date.now() - 90 * 86_400_000);
    return await ctx.db.query("attendanceCorrections").withIndex("by_employee_date", q => q.eq("employeeId", ctx.employee._id).gte("date", since)).order("desc").take(100);
  },
});

export const listPending = adminQuery({
  args: { paginationOpts: paginationOptsValidator, projectId: v.optional(v.id("projects")) },
  handler: async (ctx, args) => {
    const allowed = await getProjectIdsForUser(ctx);
    if (args.projectId && !isProjectAllowed(allowed, args.projectId)) throw new ConvexError("Bu projeye erişim yetkiniz yok");
    const projects = args.projectId ? [args.projectId] : allowed;
    // Proje başına en fazla 200 kayıt okunur; sınıra ulaşan projeler için hasMore kesilmeyi bildirir.
    const projectRows = await Promise.all(projects.map(projectId => ctx.db.query("attendanceCorrections").withIndex("by_project_status", q => q.eq("projectId", projectId).eq("status", "pending")).order("desc").take(200)));
    const hasMore = projectRows.some(rows => rows.length === 200);
    const all = projectRows.flat().sort((a, b) => b._creationTime - a._creationTime);
    const start = args.paginationOpts.cursor ? Number(args.paginationOpts.cursor) : 0;
    const page = all.slice(start, start + Math.min(args.paginationOpts.numItems, 100));
    const employees = await Promise.all(page.map(row => ctx.db.get(row.employeeId)));
    return { page: page.map((row, index) => ({ ...row, employeeName: employees[index] ? `${employees[index].firstName} ${employees[index].lastName}` : "Silinmiş çalışan" })), isDone: start + page.length >= all.length && !hasMore, hasMore, continueCursor: String(start + page.length) };
  },
});

async function decision(ctx: MutationCtx & { user: Doc<"users"> }, id: Id<"attendanceCorrections">, approve: boolean, note?: string) {
  const row = await ctx.db.get(id);
  if (!row || !row.projectId) throw new ConvexError("Düzeltme talebi bulunamadı");
  const allowed = await getProjectIdsForUser(ctx);
  const employee = await ctx.db.get(row.employeeId);
  if (!isProjectAllowed(allowed, row.projectId) || !employee || !canAccessEmployeeProject(ctx.user.role, allowed, employee.projectId) || employee.projectId !== row.projectId) throw new ConvexError("Bu düzeltme talebine erişim yetkiniz yok");
  if (row.status !== "pending") throw new ConvexError("Yalnız bekleyen düzeltme talepleri işlenebilir");
  const now = new Date().toISOString();
  if (approve) {
    const existing = await ctx.db.query("pdksRecords").withIndex("by_employee_date", q => q.eq("employeeId", row.employeeId).eq("date", row.date)).first();
    // upsertManual ile aynı vardiya çözümü/doğrulama akışı. Not kaynağı bilinçli olarak farklıdır: burada yönetici notu yoksa çalışan gerekçesi kullanılır.
    const resolver = await buildShiftResolver(ctx, [employee]);
    const shift = resolver.resolve(employee._id, row.date);
    const input = validateManualPdksInput({ date: row.date, entryTime: row.requestedCheckIn ?? existing?.entryTime, exitTime: row.requestedCheckOut ?? existing?.exitTime, note: note ?? row.reason }, shift?.projectId === employee.projectId ? shift : null);
    const status = "present" as const;
    if (existing) {
      await ctx.db.patch(existing._id, { entryTime: input.entryTime, exitTime: input.exitTime, status, manualEntry: true, manualNote: input.note, editedBy: ctx.user._id, editedAt: Date.now(), updatedAt: now });
      await writeAudit(ctx, { user: ctx.user, projectId: employee.projectId, action: "update", targetTable: "pdksRecords", targetId: existing._id, oldValue: { entryTime: existing.entryTime, exitTime: existing.exitTime, status: existing.status, manualNote: existing.manualNote }, newValue: { date: row.date, entryTime: input.entryTime, exitTime: input.exitTime, status, manualNote: input.note }, note: input.note });
    } else {
      // upsertManual ile aynı yazım: pdksRecords.ts:78
      const recordId = await ctx.db.insert("pdksRecords", { projectId: employee.projectId, employeeId: row.employeeId, employeeFirstName: employee.firstName, employeeLastName: employee.lastName, date: row.date, entryTime: input.entryTime, exitTime: input.exitTime, status, manualEntry: true, manualNote: input.note, editedBy: ctx.user._id, editedAt: Date.now(), createdAt: now, updatedAt: now });
      await writeAudit(ctx, { user: ctx.user, projectId: employee.projectId, action: "create", targetTable: "pdksRecords", targetId: recordId, newValue: { date: row.date, entryTime: input.entryTime, exitTime: input.exitTime, status, manualNote: input.note }, note: input.note });
    }
  }
  await ctx.db.patch(id, { status: approve ? "approved" : "rejected", decidedBy: ctx.user._id, decidedAt: now, decisionNote: note, updatedAt: now });
  await writeAudit(ctx, { user: ctx.user, projectId: row.projectId, action: "update", targetTable: "attendanceCorrections", targetId: id, oldValue: { status: row.status }, newValue: { status: approve ? "approved" : "rejected", date: row.date }, note });
}

export const approve = adminMutation({ args: { id: v.id("attendanceCorrections"), note: v.optional(v.string()) }, handler: async (ctx, args) => { await decision(ctx, args.id, true, args.note); return null; } });
export const reject = adminMutation({ args: { id: v.id("attendanceCorrections"), note: v.string() }, handler: async (ctx, args) => { if (args.note.trim().length < 3 || args.note.length > 500) throw new ConvexError("Red gerekçesi en az 3 karakter olmalı"); await decision(ctx, args.id, false, args.note.trim()); return null; } });
