import { Migrations } from "@convex-dev/migrations";
import type { DataModel } from "./_generated/dataModel";
import { components } from "./_generated/api";
import { seedDepartmentHistory } from "./lib/employeeDepartmentHistory";
import { employeeAuditValues } from "./lib/auditPrivacy";
import { auditSearchText } from "./lib/auditSearch";
import { internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { initializeHeartbeatMonitoring } from "./lib/deviceConnection";

const migrations = new Migrations<DataModel>(components.migrations);

export const previewEmployeeDepartments = internalQuery({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  handler: async (ctx, args) => {
    const page = await ctx.db.query("employees").paginate({ numItems: 100, cursor: args.cursor ?? null });
    let missing = 0;
    for (const employee of page.page) {
      if (!employee.projectId || employee.isVisitor) continue;
      const [history] = await ctx.db.query("employeeDepartmentHistory").withIndex("by_employee_validFrom", q => q.eq("employeeId", employee._id)).take(1);
      if (!history) missing++;
    }
    return { scanned: page.page.length, missing, isDone: page.isDone, continueCursor: page.continueCursor };
  },
});

/** Read-only dry run for audit cleanup: never print the old personal data in component logs. */
export const previewEmployeeAuditMinimization = internalQuery({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  handler: async (ctx, args) => {
    const page = await ctx.db.query("auditLog").paginate({ numItems: 100, cursor: args.cursor ?? null });
    let affected = 0;
    for (const row of page.page) if (row.targetTable === "employees") {
      const values = employeeAuditValues(row.oldValue, row.newValue, row.action);
      if (JSON.stringify(values.oldValue) !== JSON.stringify(row.oldValue) || JSON.stringify(values.newValue) !== JSON.stringify(row.newValue)) affected++;
    }
    return { scanned: page.page.length, affected, isDone: page.isDone, continueCursor: page.continueCursor };
  },
});

/** Explicit dryRun first. Baselines preserve the legacy fallback, never infer old moves. */
export const backfillEmployeeDepartments = migrations.define({
  table: "employees",
  migrateOne: async (ctx, employee) => { await seedDepartmentHistory(ctx, employee); },
});

export const removeShiftColors = migrations.define({
  table: "shifts",
  migrateOne: (_ctx, shift) => shift.color === undefined ? undefined : { color: undefined },
});

export const initializeDeviceHeartbeatChecks = migrations.define({
  table: "devices",
  migrateOne: async (ctx, device) => { await initializeHeartbeatMonitoring(ctx, device); },
});

export const minimizeEmployeeAudit = migrations.define({
  table: "auditLog",
  migrateOne: async (ctx, row) => {
    if (row.targetTable !== "employees") return;
    const values = employeeAuditValues(row.oldValue, row.newValue, row.action);
    const employeeId = ctx.db.normalizeId("employees", row.targetId);
    const removed = employeeId !== null && !(await ctx.db.get(employeeId));
    return { ...values, ...(removed ? { note: "Kişi kaydı silindi; geçmiş kişisel veri kopyası kaldırıldı" } : {}),
      searchText: auditSearchText({ ...row, ...values }) };
  },
});
