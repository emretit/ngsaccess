import { v } from "convex/values";
import { adminMutation, authedQuery } from "./lib/customFunctions";
import { validateManualPdksInput, validateManualPdksNote } from "./lib/pdksManual";
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

    const resolver = await buildShiftResolver(ctx, [employee]);
    const shift = resolver.resolve(employee._id, args.date);
    const { note, entryTime, exitTime } = validateManualPdksInput(args, shift?.projectId === employee.projectId ? shift : null);

    const existing = await ctx.db
      .query("pdksRecords")
      .withIndex("by_employee_date", (q) =>
        q.eq("employeeId", args.employeeId).eq("date", args.date)
      )
      .first();

    const now = new Date().toISOString();
    const status = "present" as const;

    if (existing) {
      const oldSnapshot = {
        entryTime: existing.entryTime,
        exitTime: existing.exitTime,
        status: existing.status,
        manualNote: existing.manualNote,
      };
      await ctx.db.patch(existing._id, {
        entryTime,
        exitTime,
        status,
        manualEntry: true,
        manualNote: note,
        editedBy: ctx.user._id,
        editedAt: Date.now(),
        updatedAt: now,
      });
      await writeAudit(ctx, {
        user: ctx.user,
        projectId: employee.projectId ?? null,
        action: "update",
        targetTable: "pdksRecords",
        targetId: existing._id,
        oldValue: oldSnapshot,
        newValue: {
          entryTime,
          exitTime,
          status,
          manualNote: note,
        },
        note,
      });
      return existing._id;
    }

    const id = await ctx.db.insert("pdksRecords", {
      projectId: employee.projectId,
      employeeId: args.employeeId,
      employeeFirstName: employee.firstName,
      employeeLastName: employee.lastName,
      date: args.date,
      entryTime,
      exitTime,
      status,
      manualEntry: true,
      manualNote: note,
      editedBy: ctx.user._id,
      editedAt: Date.now(),
      createdAt: now,
      updatedAt: now,
    });
    await writeAudit(ctx, {
      user: ctx.user,
      projectId: employee.projectId ?? null,
      action: "create",
      targetTable: "pdksRecords",
      targetId: id,
      newValue: {
        date: args.date,
        entryTime,
        exitTime,
        status,
        manualNote: note,
      },
      note,
    });
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
    const now = new Date().toISOString();

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
        const { note, entryTime, exitTime } = validateManualPdksInput({ ...row, note: batchNote }, shift?.projectId === employee.projectId ? shift : null);

        const existing = await ctx.db
          .query("pdksRecords")
          .withIndex("by_employee_date", (q) =>
            q.eq("employeeId", row.employeeId).eq("date", row.date),
          )
          .first();

        const status = "present" as const;

        if (existing) {
          await ctx.db.patch(existing._id, {
            entryTime,
            exitTime,
            status,
            manualEntry: true,
            manualNote: note,
            editedBy: ctx.user._id,
            editedAt: Date.now(),
            updatedAt: now,
          });
          updated += 1;
          touchedIds.push(String(existing._id));
        } else {
          const id = await ctx.db.insert("pdksRecords", {
            projectId: employee.projectId,
            employeeId: row.employeeId,
            employeeFirstName: employee.firstName,
            employeeLastName: employee.lastName,
            date: row.date,
            entryTime,
            exitTime,
            status,
            manualEntry: true,
            manualNote: note,
            editedBy: ctx.user._id,
            editedAt: Date.now(),
            createdAt: now,
            updatedAt: now,
          });
          inserted += 1;
          touchedIds.push(String(id));
        }
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
