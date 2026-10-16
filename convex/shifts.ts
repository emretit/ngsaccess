import { toPatch } from "./lib/nullablePatch";
import { validateRange, validateShift, schedulesOverlap, appliesOn, type ScheduleRange } from "./lib/shiftUx";
import type { MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";

import { v } from "convex/values";
import { authedQuery, authedMutation } from "./lib/customFunctions";
import { getProjectIdsForUser } from "./lib/auth";

async function validateAssignment(ctx: MutationCtx, employee: Doc<"employees">, shift: Doc<"shifts">, range: ScheduleRange, force = false, excludeId?: string, calendarConfirmed = false) {
  validateRange(range.startDate, range.endDate);
  if (employee.projectId !== shift.projectId) throw new Error("Çalışan ve vardiya aynı projede olmalıdır");
  if (shift.isActive === false) throw new Error("Pasif vardiya atanamaz");
  if (range.weekPattern?.some(code => !["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].includes(code))) throw new Error("Geçersiz tekrar günü");
  const leaves = await ctx.db.query("leaves").withIndex("by_employee", q => q.eq("employeeId", employee._id)).collect();
  const holidays = await ctx.db.query("holidays").withIndex("by_project", q => q.eq("projectId", employee.projectId)).collect();
  const globalHolidays = employee.projectId ? await ctx.db.query("holidays").withIndex("by_project", q => q.eq("projectId", undefined)).collect() : [];
  const conflicts = [
    ...leaves.filter(l => l.status === "approved" && l.startDate <= range.endDate && l.endDate >= range.startDate).map(l => `İzin: ${l.startDate}–${l.endDate}`),
    ...[...holidays, ...globalHolidays].filter(h => appliesOn(range, h.date)).map(h => `${h.date}: ${h.name}`),
  ];
  if (conflicts.length && !calendarConfirmed) throw new Error(`CALENDAR: ${conflicts.join("; ")}. İzin/tatil günlerinde atama için açık onay verin.`);
  const existing = await ctx.db.query("shiftAssignments").withIndex("by_employee", q => q.eq("employeeId", employee._id)).collect();
  const overlaps: string[] = [];
  for (const item of existing) {
    if (item._id === excludeId) continue;
    const other = await ctx.db.get(item.shiftId);
    if (other && schedulesOverlap(range, shift, item, other)) overlaps.push(`${other.name} ${other.startTime}–${other.endTime} (${item.startDate}–${item.endDate})`);
  }
  if (!force && overlaps.length) throw new Error(`OVERLAP:${overlaps.length} ${overlaps.join("; ")}`);
}

export const listAssignments = authedQuery({
  args: {
    employeeId: v.optional(v.id("employees")),
    shiftId: v.optional(v.id("shifts")),
  },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    if (args.employeeId) {
      const emp = await ctx.db.get(args.employeeId);
      if (!emp || (emp.projectId && !allowedProjectIds.some((id) => id === emp.projectId))) {
        return [];
      }
      return await ctx.db
        .query("shiftAssignments")
        .withIndex("by_employee", (q) => q.eq("employeeId", emp._id))
        .collect();
    }
    if (args.shiftId) {
      const shift = await ctx.db.get(args.shiftId);
      if (!shift || (shift.projectId && !allowedProjectIds.some((id) => id === shift.projectId))) {
        return [];
      }
      return await ctx.db
        .query("shiftAssignments")
        .withIndex("by_shift", (q) => q.eq("shiftId", shift._id))
        .collect();
    }
    if (ctx.user.role === "super_admin") {
      return await ctx.db.query("shiftAssignments").collect();
    }
    if (allowedProjectIds.length > 0) {
      const results = await Promise.all(
        allowedProjectIds.map((pid) =>
          ctx.db
            .query("shiftAssignments")
            .withIndex("by_project", (q) => q.eq("projectId", pid))
            .collect()
        )
      );
      return results.flat();
    }
    return [];
  },
});

export const assignShift = authedMutation({
  args: {
    employeeId: v.id("employees"),
    shiftId: v.id("shifts"),
    projectId: v.optional(v.id("projects")),
    startDate: v.string(),
    endDate: v.string(),
    weekPattern: v.optional(v.array(v.string())),
    forceConfirm: v.optional(v.boolean()),
    calendarConfirmed: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    if (args.projectId && !allowedProjectIds.some((id) => id === args.projectId)) {
      throw new Error("Bu projeye erişim yetkiniz yok");
    }
    const emp = await ctx.db.get(args.employeeId);
    if (!emp || (emp.projectId && !allowedProjectIds.some((id) => id === emp.projectId))) {
      throw new Error("Bu çalışana erişim yetkiniz yok");
    }
    const shift = await ctx.db.get(args.shiftId);
    if (!shift || (shift.projectId && !allowedProjectIds.some((id) => id === shift.projectId))) {
      throw new Error("Bu vardiyaya erişim yetkiniz yok");
    }
    await validateAssignment(ctx, emp, shift, args, args.forceConfirm, undefined, args.calendarConfirmed);
    const now = new Date().toISOString();
    const { forceConfirm: _force, calendarConfirmed: _calendar, ...rest } = args;
    return await ctx.db.insert("shiftAssignments", {
      ...rest,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateAssignment = authedMutation({
  args: {
    assignmentId: v.id("shiftAssignments"),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    shiftId: v.optional(v.id("shifts")),
    weekPattern: v.optional(v.array(v.string())),
    forceConfirm: v.optional(v.boolean()),
    calendarConfirmed: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    const assignment = await ctx.db.get(args.assignmentId);
    if (!assignment) throw new Error("Atama bulunamadı");
    if (assignment.projectId && !allowedProjectIds.some((id) => id === assignment.projectId)) {
      throw new Error("Bu atamaya erişim yetkiniz yok");
    }
    const nextStart = args.startDate ?? assignment.startDate;
    const nextEnd = args.endDate ?? assignment.endDate;
    const employee = await ctx.db.get(assignment.employeeId);
    const nextShift = await ctx.db.get(args.shiftId ?? assignment.shiftId);
    if (!employee || !nextShift) throw new Error("Çalışan veya vardiya bulunamadı");
    await validateAssignment(ctx, employee, nextShift, { startDate: nextStart, endDate: nextEnd, weekPattern: args.weekPattern ?? assignment.weekPattern }, args.forceConfirm, assignment._id, args.calendarConfirmed);
    const { assignmentId, forceConfirm: _force, calendarConfirmed: _calendar, ...updates } = args;
    const clean: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    for (const [k, val] of Object.entries(updates)) {
      if (val !== undefined) clean[k] = val;
    }
    await ctx.db.patch(assignmentId, clean);
  },
});

export const bulkAssignShift = authedMutation({
  args: {
    employeeIds: v.array(v.id("employees")),
    shiftId: v.id("shifts"),
    startDate: v.string(),
    endDate: v.string(),
    weekPattern: v.optional(v.array(v.string())),
    forceConfirm: v.optional(v.boolean()),
    calendarConfirmed: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    validateRange(args.startDate, args.endDate);
    if (args.employeeIds.length === 0) {
      throw new Error("En az bir çalışan seçin");
    }
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    const shift = await ctx.db.get(args.shiftId);
    if (!shift) throw new Error("Vardiya bulunamadı");
    if (shift.projectId && !allowedProjectIds.some((id) => id === shift.projectId)) {
      throw new Error("Bu vardiyaya erişim yetkiniz yok");
    }

    const now = new Date().toISOString();
    const inserted: string[] = [];
    const skipped: { employeeId: string; reason: string }[] = [];
    let overlapCount = 0;

    for (const employeeId of args.employeeIds) {
      const emp = await ctx.db.get(employeeId);
      if (!emp) {
        skipped.push({ employeeId, reason: "Çalışan bulunamadı" });
        continue;
      }
      if (emp.projectId && !allowedProjectIds.some((id) => id === emp.projectId)) {
        skipped.push({ employeeId, reason: "Erişim yok" });
        continue;
      }
      try {
        await validateAssignment(ctx, emp, shift, args, args.forceConfirm, undefined, args.calendarConfirmed);
      } catch (error: unknown) {
        const reason = error instanceof Error ? error.message : "Atama doğrulanamadı";
        if (reason.includes("OVERLAP:")) overlapCount++;
        skipped.push({ employeeId, reason });
        continue;
      }
      const id = await ctx.db.insert("shiftAssignments", {
        employeeId,
        shiftId: args.shiftId,
        projectId: emp.projectId,
        startDate: args.startDate,
        endDate: args.endDate,
        weekPattern: args.weekPattern,
        createdAt: now,
        updatedAt: now,
      });
      inserted.push(String(id));
    }

    if (!args.forceConfirm && overlapCount > 0 && inserted.length === 0) {
      throw new Error(`OVERLAP:${overlapCount}`);
    }

    return { insertedCount: inserted.length, skipped, overlapCount };
  },
});

export const removeAssignment = authedMutation({
  args: { assignmentId: v.id("shiftAssignments") },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    const assignment = await ctx.db.get(args.assignmentId);
    if (!assignment) throw new Error("Atama bulunamadı");
    if (assignment.projectId && !allowedProjectIds.some((id) => id === assignment.projectId)) {
      throw new Error("Bu atamaya erişim yetkiniz yok");
    }
    await ctx.db.delete(args.assignmentId);
  },
});

export const bulkRemoveAssignment = authedMutation({
  args: { assignmentIds: v.array(v.id("shiftAssignments")) },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    let deleted = 0;
    for (const id of args.assignmentIds) {
      const assignment = await ctx.db.get(id);
      if (!assignment) continue;
      if (
        assignment.projectId &&
        !allowedProjectIds.some((pid) => pid === assignment.projectId)
      ) {
        continue;
      }
      await ctx.db.delete(id);
      deleted += 1;
    }
    return { deleted };
  },
});

export const list = authedQuery({
  args: {},
  handler: async (ctx) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    if (ctx.user.role === "super_admin") return await ctx.db.query("shifts").collect();
    if (allowedProjectIds.length === 0) return [];
    const results = await Promise.all(
      allowedProjectIds.map((pid) =>
        ctx.db
          .query("shifts")
          .withIndex("by_project", (q) => q.eq("projectId", pid))
          .collect()
      )
    );
    return results.flat();
  },
});

export const create = authedMutation({
  args: {
    name: v.string(),
    projectId: v.optional(v.id("projects")),
    startTime: v.string(),
    endTime: v.string(),
    breakStart: v.optional(v.union(v.null(), v.string())),
    breakEnd: v.optional(v.union(v.null(), v.string())),
    lateToleranceMinutes: v.optional(v.union(v.null(), v.number())),
    earlyExitToleranceMinutes: v.optional(v.union(v.null(), v.number())),
    overtimeStartToleranceMinutes: v.optional(v.union(v.null(), v.number())),
    overtimeEnabled: v.optional(v.boolean()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    if (args.projectId && !allowedProjectIds.some((id) => id === args.projectId)) {
      throw new Error("Bu projeye erişim yetkiniz yok");
    }
    const now = new Date().toISOString();
    const fields = { ...toPatch(args), name: args.name, startTime: args.startTime, endTime: args.endTime };
    validateShift(fields);
    return await ctx.db.insert("shifts", {
      ...fields,
      isActive: args.isActive ?? true,
      overtimeEnabled: args.overtimeEnabled ?? true,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = authedMutation({
  args: {
    shiftId: v.id("shifts"),
    name: v.optional(v.string()),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    breakStart: v.optional(v.union(v.null(), v.string())),
    breakEnd: v.optional(v.union(v.null(), v.string())),
    lateToleranceMinutes: v.optional(v.union(v.null(), v.number())),
    earlyExitToleranceMinutes: v.optional(v.union(v.null(), v.number())),
    overtimeStartToleranceMinutes: v.optional(v.union(v.null(), v.number())),
    overtimeEnabled: v.optional(v.boolean()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    const shift = await ctx.db.get(args.shiftId);
    if (!shift) throw new Error("Vardiya bulunamadı");
    if (shift.projectId && !allowedProjectIds.some((id) => id === shift.projectId)) {
      throw new Error("Bu vardiyaya erişim yetkiniz yok");
    }
    const { shiftId, ...updates } = args;
    const patch = toPatch(updates);
    validateShift({ ...shift, ...patch });
    await ctx.db.patch(shiftId, { ...patch, updatedAt: new Date().toISOString() });
  },
});

export const remove = authedMutation({
  args: { shiftId: v.id("shifts") },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    const shift = await ctx.db.get(args.shiftId);
    if (!shift) throw new Error("Vardiya bulunamadı");
    if (shift.projectId && !allowedProjectIds.some((id) => id === shift.projectId)) {
      throw new Error("Bu vardiyaya erişim yetkiniz yok");
    }
    const linkedAssignments = await ctx.db
      .query("shiftAssignments")
      .withIndex("by_shift", (q) => q.eq("shiftId", args.shiftId))
      .collect();
    await Promise.all(linkedAssignments.map((a) => ctx.db.delete(a._id)));
    await ctx.db.delete(args.shiftId);
    return { removedAssignments: linkedAssignments.length };
  },
});
