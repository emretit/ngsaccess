import { requirePermission } from "./lib/permissions";
import { scheduleFingerprintPurge } from "./lib/employeeCardChange";
import { ConvexError, v } from "convex/values";
import { internalMutation, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { authedMutation } from "./lib/customFunctions";
import { getProjectIdsForUser } from "./lib/auth";
import { resolveEmployeeIdeDeviceIds } from "./lib/accessGraph";
import { writeAudit } from "./lib/audit";
import { trTodayKey } from "./lib/trDate";

async function accessibleEmployee(ctx: MutationCtx & { user: Doc<"users"> }, employeeId: Id<"employees">) {
  const employee = await ctx.db.get(employeeId);
  if (!employee) throw new ConvexError("Çalışan bulunamadı.");
  const projectIds = await getProjectIdsForUser(ctx);
  if (employee.projectId && !projectIds.includes(employee.projectId)) {
    throw new ConvexError("Bu çalışana erişim yetkiniz yok.");
  }
  await requirePermission(ctx, ctx.user, employee.projectId, "employees.manage");
  if (employee.isVisitor) throw new ConvexError("Ziyaretçiler için işten ayrılma işlemi yapılamaz.");
  return employee;
}

async function closeAccess(ctx: MutationCtx, employee: Doc<"employees">, now: string) {
  // Panelleri aktif erişim grafından, pasife çekmeden önce çöz.
  const deviceIds = await resolveEmployeeIdeDeviceIds(ctx, employee._id, employee.projectId);
  await ctx.db.patch(employee._id, { isActive: false, updatedAt: now });
  await scheduleFingerprintPurge(ctx, employee._id, employee.cardNumber, { deleteTemplates: true });
  await ctx.scheduler.runAfter(0, internal.actions.hikvisionSync.syncEmployeeToDevicesInternal, {
    employeeId: employee._id,
  });
  if (deviceIds.length) {
    await ctx.scheduler.runAfter(0, internal.actions.ideGatewayDevice.deleteIdeUserFromPanels, {
      cardNumber: employee.cardNumber, deviceIds, projectId: employee.projectId,
    });
  }
}

export const terminate = authedMutation({
  args: {
    employeeId: v.id("employees"), employmentEndDate: v.string(),
    terminationType: v.union(v.literal("resignation"), v.literal("employerTermination"), v.literal("retirement"), v.literal("contractEnd"), v.literal("other")),
    terminationReason: v.optional(v.string()), sgkExitCode: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const employee = await accessibleEmployee(ctx, args.employeeId);
    if (employee.employmentEndDate) throw new ConvexError("Bu kişi zaten işten çıkarılmış.");
    if (employee.isActive !== true) throw new ConvexError("Pasif kişi işten çıkarılamaz; önce aktif yapın.");
    const date = new Date(`${args.employmentEndDate}T00:00:00.000Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(args.employmentEndDate) ||
        Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== args.employmentEndDate) {
      throw new ConvexError("Geçerli bir son çalışma günü girin.");
    }
    const today = trTodayKey();
    const earliest = new Date(`${today}T00:00:00.000Z`);
    earliest.setUTCDate(earliest.getUTCDate() - 62);
    if (args.employmentEndDate < earliest.toISOString().slice(0, 10)) {
      throw new ConvexError("Son çalışma günü en fazla 62 gün geriye girilebilir.");
    }
    const latest = new Date(`${today}T00:00:00.000Z`);
    latest.setUTCDate(latest.getUTCDate() + 365);
    if (args.employmentEndDate > latest.toISOString().slice(0, 10)) {
      throw new ConvexError("Son çalışma günü en fazla 365 gün ileride olabilir.");
    }
    if ((args.terminationReason?.length ?? 0) > 500) throw new ConvexError("Ayrılış nedeni en fazla 500 karakter olabilir.");
    if (args.sgkExitCode !== undefined && !/^\d{2}$/.test(args.sgkExitCode)) throw new ConvexError("SGK çıkış kodu 2 haneli rakam olmalıdır.");
    const now = new Date().toISOString();
    const { employeeId, ...details } = args;
    const updates = { ...details, terminatedAt: now, terminatedBy: ctx.user._id, updatedAt: now };
    await ctx.db.patch(employeeId, updates);
    if (args.employmentEndDate < today) await closeAccess(ctx, employee, now);
    await writeAudit(ctx, { user: ctx.user, projectId: employee.projectId, action: "update", targetTable: "employees", targetId: employeeId, oldValue: employee, newValue: { ...updates, isActive: args.employmentEndDate < today ? false : employee.isActive }, note: "İşten ayrılma" });
    return null;
  },
});

export const reinstate = authedMutation({
  args: { employeeId: v.id("employees") },
  returns: v.null(),
  handler: async (ctx, { employeeId }) => {
    const employee = await accessibleEmployee(ctx, employeeId);
    if (!employee.employmentEndDate) throw new ConvexError("Bu kişi işten ayrılmamış.");
    await ctx.db.patch(employeeId, {
      employmentEndDate: undefined, terminationType: undefined, terminationReason: undefined,
      sgkExitCode: undefined, terminatedAt: undefined, terminatedBy: undefined,
      isActive: true, updatedAt: new Date().toISOString(),
    });
    await ctx.scheduler.runAfter(0, internal.actions.hikvisionSync.syncEmployeeToDevicesInternal, { employeeId });
    await ctx.scheduler.runAfter(0, internal.actions.ideGatewayDevice.syncEmployeeToIdePanels, { employeeId });
    await writeAudit(ctx, { user: ctx.user, projectId: employee.projectId, action: "update", targetTable: "employees", targetId: employeeId, oldValue: employee, newValue: await ctx.db.get(employeeId), note: "İşten ayrılma geri alındı" });
    return null;
  },
});

export const closeEndedEmployments = internalMutation({
  args: { cursor: v.optional(v.string()) },
  returns: v.object({ closed: v.number() }),
  handler: async (ctx, args) => {
    const today = trTodayKey();
    const batch = await ctx.db.query("employees")
      .withIndex("by_active_employment_end", q => q.eq("isActive", true).gt("employmentEndDate", "").lt("employmentEndDate", today))
      .paginate({ numItems: 50, cursor: args.cursor ?? null });
    const ended = batch.page.filter(employee => employee.isVisitor !== true);
    for (const employee of ended) await closeAccess(ctx, employee, new Date().toISOString());
    if (!batch.isDone) await ctx.scheduler.runAfter(0, internal.employeeTermination.closeEndedEmployments, { cursor: batch.continueCursor });
    return { closed: ended.length };
  },
});
