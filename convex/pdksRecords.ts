import { v } from "convex/values";
import { adminMutation } from "./lib/customFunctions";
import { validateManualPdksInput, validateManualPdksNote } from "./lib/pdksManual";
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
    const { note, entryTime, exitTime } = validateManualPdksInput(args);

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

    for (let i = 0; i < args.rows.length; i++) {
      const row = args.rows[i];
      try {
        const { note, entryTime, exitTime } = validateManualPdksInput({ ...row, note: batchNote });

        const employee = await ctx.db.get(row.employeeId);
        if (!employee) throw new Error("Çalışan bulunamadı");
        if (userProjectIds && employee.projectId) {
          if (!userProjectIds.has(String(employee.projectId))) {
            throw new Error("Projeye erişim yetkiniz yok");
          }
        }

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

