import { v } from "convex/values";
import { adminMutation, authedQuery } from "./lib/customFunctions";
import { validateManualPdksInput, validateManualPdksNote } from "./lib/pdksManual";
import { findManualPdksRecord, validateManualPdksForEmployee, writeManualPdksRecord } from "./lib/pdksManualWrite";
import { buildShiftResolver } from "./lib/shiftResolver";
import { resolveProjectScope } from "./lib/projectScope";
import { isOvernightShift } from "./lib/pdksWorkDay";
import { writeAudit } from "./lib/audit";

export const upsertManual = adminMutation({
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

    if (ctx.user.role === "project_admin" && employee.projectId) {
      const userProjects = await ctx.db
        .query("userProjects")
        .withIndex("by_user", (q) => q.eq("userId", ctx.user._id))
        .collect();
      const hasAccess = userProjects.some(
        (up) => up.projectId === employee.projectId
      );
      if (!hasAccess) {
        throw new Error("Bu çalışanın projesine erişim yetkiniz yok");
      }
    }

    const input = await validateManualPdksForEmployee(ctx, employee, args);
    const existing = await findManualPdksRecord(ctx, args.employeeId, args.date);
    const { id } = await writeManualPdksRecord(ctx, { user: ctx.user, employee, date: args.date, existing, input, audit: true });
    return id;
  },
});

export const bulkUpsertManual = adminMutation({
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

    const userProjectIds =
      ctx.user.role === "project_admin"
        ? new Set(
            (
              await ctx.db
                .query("userProjects")
                .withIndex("by_user", (q) => q.eq("userId", ctx.user._id))
                .collect()
            ).map((up) => String(up.projectId)),
          )
        : null;

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
        if (userProjectIds && employee.projectId) {
          if (!userProjectIds.has(String(employee.projectId))) {
            throw new Error("Projeye erişim yetkiniz yok");
          }
        }

        const shift = resolver.resolve(employee._id, row.date);
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

    await writeAudit(ctx, {
      user: ctx.user,
      projectId: null,
      action: "update",
      targetTable: "pdksRecords",
      targetId: "bulk-upsert",
      newValue: {
        inserted,
        updated,
        errors: errors.length,
        touched: touchedIds.length,
      },
      note: batchNote,
    });

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
      const shift = resolver.resolve(row.employeeId, row.date);
      return shift?.projectId === args.projectId && isOvernightShift(shift)
        ? [{ key: `${row.employeeId}__${row.date}`, startTime: shift.startTime, endTime: shift.endTime }] : [];
    });
  },
});
