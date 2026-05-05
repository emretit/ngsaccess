import { v } from "convex/values";
import { adminMutation, authedQuery } from "./lib/customFunctions";
import { writeAudit } from "./lib/audit";

const HHMM_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const upsertManual = adminMutation({
  args: {
    employeeId: v.id("employees"),
    date: v.string(),
    entryTime: v.optional(v.string()),
    exitTime: v.optional(v.string()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!DATE_REGEX.test(args.date)) {
      throw new Error("Geçersiz tarih formatı (YYYY-MM-DD)");
    }
    if (args.entryTime && !HHMM_REGEX.test(args.entryTime)) {
      throw new Error("Geçersiz giriş saati (HH:MM)");
    }
    if (args.exitTime && !HHMM_REGEX.test(args.exitTime)) {
      throw new Error("Geçersiz çıkış saati (HH:MM)");
    }
    if (
      args.entryTime &&
      args.exitTime &&
      args.entryTime >= args.exitTime
    ) {
      throw new Error("Çıkış saati giriş saatinden sonra olmalı");
    }

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
    const status =
      args.entryTime && args.exitTime
        ? "present"
        : args.entryTime
        ? "present"
        : "absent";

    if (existing) {
      const oldSnapshot = {
        entryTime: existing.entryTime,
        exitTime: existing.exitTime,
        status: existing.status,
        manualNote: existing.manualNote,
      };
      await ctx.db.patch(existing._id, {
        entryTime: args.entryTime,
        exitTime: args.exitTime,
        status,
        manualEntry: true,
        manualNote: args.note,
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
          entryTime: args.entryTime,
          exitTime: args.exitTime,
          status,
          manualNote: args.note,
        },
        note: args.note,
      });
      return existing._id;
    }

    const id = await ctx.db.insert("pdksRecords", {
      projectId: employee.projectId,
      employeeId: args.employeeId,
      employeeFirstName: employee.firstName,
      employeeLastName: employee.lastName,
      date: args.date,
      entryTime: args.entryTime,
      exitTime: args.exitTime,
      status,
      manualEntry: true,
      manualNote: args.note,
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
        entryTime: args.entryTime,
        exitTime: args.exitTime,
        status,
        manualNote: args.note,
      },
      note: args.note,
    });
    return id;
  },
});

export const removeManual = adminMutation({
  args: { id: v.id("pdksRecords") },
  handler: async (ctx, args) => {
    const old = await ctx.db.get(args.id);
    if (!old) return;
    await ctx.db.delete(args.id);
    await writeAudit(ctx, {
      user: ctx.user,
      projectId: old.projectId ?? null,
      action: "delete",
      targetTable: "pdksRecords",
      targetId: args.id,
      oldValue: {
        date: old.date,
        entryTime: old.entryTime,
        exitTime: old.exitTime,
        status: old.status,
      },
    });
  },
});

export const getManualForEmployeeDate = authedQuery({
  args: {
    employeeId: v.id("employees"),
    date: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("pdksRecords")
      .withIndex("by_employee_date", (q) =>
        q.eq("employeeId", args.employeeId).eq("date", args.date)
      )
      .first();
  },
});

export const listAuditForRecord = authedQuery({
  args: {
    targetId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("auditLog")
      .withIndex("by_target", (q) =>
        q.eq("targetTable", "pdksRecords").eq("targetId", args.targetId)
      )
      .order("desc")
      .take(50);
  },
});
