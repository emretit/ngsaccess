import { getProjectIdsWithPermission, requirePermission } from "./lib/permissions";
import { v } from "convex/values";
import { authedMutation, authedQuery } from "./lib/customFunctions";
import { validateManualPdksInput, validateManualPdksNote } from "./lib/pdksManual";
import { findManualPdksRecord, validateManualPdksForEmployee, writeManualPdksRecord } from "./lib/pdksManualWrite";
import { buildShiftResolver } from "./lib/shiftResolver";
import { resolveProjectScope } from "./lib/projectScope";
import { isOvernightShift } from "./lib/pdksWorkDay";
import { writeAudit } from "./lib/audit";

export const upsertManual = authedMutation({
  args: {
    employeeId: v.id("employees"),
    date: v.string(),
    entryTime: v.optional(v.string()),
    exitTime: v.optional(v.string()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const employee = await ctx.db.get(args.employeeId);
    if (!employee) throw new Error("Çalışan bulunamadı");

    await requirePermission(ctx, ctx.user, employee.projectId, "attendance.approve");
    const input = await validateManualPdksForEmployee(ctx, employee, args);
    const existing = await findManualPdksRecord(ctx, args.employeeId, args.date);
    const { id } = await writeManualPdksRecord(ctx, { user: ctx.user, employee, date: args.date, existing, input, audit: true });
    return id;
  },
});

export const bulkUpsertManual = authedMutation({
  args: {
    note: v.string(),
    rows: v.array(
      v.object({
        employeeId: v.id("employees"),
        date: v.string(),
        entryTime: v.optional(v.string()),
        exitTime: v.optional(v.string()),
        // Legacy row notes are accepted; the mandatory batch reason always wins.
        note: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const batchNote = validateManualPdksNote(args.note);
    if (args.rows.length === 0) return { inserted: 0, updated: 0, errors: [] };
    if (args.rows.length > 500) {
      throw new Error("Tek seferde en fazla 500 satır gönderebilirsiniz");
    }

    const userProjectIds = ctx.user.role === "super_admin" ? null : new Set((await getProjectIdsWithPermission(ctx, ctx.user, "attendance.approve")).map(String));

    let inserted = 0;
    let updated = 0;
    const errors: { index: number; message: string }[] = [];
    const touchedIds: string[] = [];

    const employeeIds = [...new Set(args.rows.map(row => row.employeeId))];
    const employees = (await Promise.all(employeeIds.map(id => ctx.db.get(id))))
      .filter((employee): employee is NonNullable<typeof employee> => employee !== null);
    const employeeById = new Map(employees.map(employee => [employee._id, employee]));
    const resolver = await buildShiftResolver(ctx, employees.filter(employee => !userProjectIds || !employee.projectId || userProjectIds.has(String(employee.projectId))));

    for (let i = 0; i < args.rows.length; i++) {
      const row = args.rows[i];
      try {
        const employee = employeeById.get(row.employeeId);
        if (!employee) throw new Error("Çalışan bulunamadı");
        await requirePermission(ctx, ctx.user, employee.projectId, "attendance.approve");
        if (userProjectIds && employee.projectId) {
          if (!userProjectIds.has(String(employee.projectId))) {
            throw new Error("Projeye erişim yetkiniz yok");
          }
        }

        const shift = resolver.resolveLast(employee._id, row.date);
        const input = validateManualPdksInput({ ...row, note: batchNote }, shift?.projectId === employee.projectId ? shift : null);

        const existing = await findManualPdksRecord(ctx, row.employeeId, row.date);
        const { id, created } = await writeManualPdksRecord(ctx, { user: ctx.user, employee, date: row.date, existing, input, audit: false });
        if (created) inserted += 1;
        else updated += 1;
        touchedIds.push(String(id));
      } catch (e) {
        errors.push({
          index: i,
          message: e instanceof Error ? e.message : "Bilinmeyen hata",
        });
      }
    }

    // Keep batch summaries scoped even when a super admin edits multiple projects.
    const failedIndices = new Set(errors.map(error => error.index));
    const successfulRows = args.rows.filter((_row, index) => !failedIndices.has(index));
    if (successfulRows.length === 0) {
      // Başarısız denemeleri yalnız erişilebilir, bilinen projelere yaz.
      const errorsByProject = new Map<NonNullable<(typeof employees)[number]["projectId"]>, number>();
      for (const row of args.rows) {
        const projectId = employeeById.get(row.employeeId)?.projectId;
        if (!projectId || (userProjectIds && !userProjectIds.has(String(projectId)))) continue;
        errorsByProject.set(projectId, (errorsByProject.get(projectId) ?? 0) + 1);
      }
      for (const [projectId, errorCount] of [...errorsByProject].slice(0, 20)) {
        await writeAudit(ctx, {
          user: ctx.user,
          projectId,
          action: "update",
          targetTable: "pdksRecords",
          targetId: "bulk-upsert",
          newValue: { inserted: 0, updated: 0, errors: errorCount, touched: 0 },
          note: batchNote,
        });
      }
    }
    const projectIds = [...new Set(successfulRows.map(row => employeeById.get(row.employeeId)?.projectId))];
    for (const projectId of projectIds) {
      const touched = successfulRows.filter(row => employeeById.get(row.employeeId)?.projectId === projectId).length;
      await writeAudit(ctx, {
        user: ctx.user,
        projectId: projectId ?? null,
        action: "update",
        targetTable: "pdksRecords",
        targetId: "bulk-upsert",
        newValue: projectIds.length === 1
          ? { inserted, updated, errors: errors.length, touched: touchedIds.length }
          : { touched },
        note: batchNote,
      });
    }

    return { inserted, updated, errors };
  },
});


/** CSV preview resolves the same dated assignments as the manual mutation. */
export const previewManualShifts = authedQuery({
  args: {
    projectId: v.id("projects"),
    rows: v.array(v.object({ employeeId: v.id("employees"), date: v.string() })),
  },
  handler: async (ctx, args) => {
    await resolveProjectScope(ctx, args.projectId);
    if (args.rows.length > 500) throw new Error("Tek seferde en fazla 500 satır gönderebilirsiniz");
    const employees = (await Promise.all([...new Set(args.rows.map(row => row.employeeId))].map(id => ctx.db.get(id))))
      .filter((employee): employee is NonNullable<typeof employee> => employee !== null && employee.projectId === args.projectId);
    const employeeIds = new Set(employees.map(employee => employee._id));
    const resolver = await buildShiftResolver(ctx, employees);
    return args.rows.flatMap(row => {
      if (!employeeIds.has(row.employeeId)) return [];
      const shift = resolver.resolveLast(row.employeeId, row.date);
      return shift?.projectId === args.projectId && isOvernightShift(shift)
        ? [{ key: `${row.employeeId}__${row.date}`, startTime: shift.startTime, endTime: shift.endTime }] : [];
    });
  },
});
