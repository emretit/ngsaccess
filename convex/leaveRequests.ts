import { requirePermission } from "./lib/permissions";
import { paginationOptsValidator } from "convex/server";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { resolveProjectScope } from "./lib/projectScope";
import { calendarDays } from "./lib/leaveValidation";
import { leaveDecisionPatch } from "./lib/leaveRules";
import { assertNoLeaveOverlap } from "./leaves";
import { v, ConvexError } from "convex/values";
import {
  authedMutation,
  authedQuery,
  employeeAuthedMutation,
  employeeAuthedQuery,
} from "./lib/customFunctions";
import { istanbulToday, overlaps, validateLeaveRequestRange } from "./lib/requestRules";
import { writeAudit } from "./lib/audit";

const leaveType = v.union(v.literal("annual"), v.literal("sick"), v.literal("excuse"), v.literal("unpaid"), v.literal("parental"), v.literal("marriage"), v.literal("bereavement"), v.literal("paternity"), v.literal("lactation"), v.literal("compensatory"));
const SCAN_LIMIT = 5000;

export const submit = employeeAuthedMutation({
  args: { leaveType, startDate: v.string(), endDate: v.string(), notes: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const employee = ctx.employee;
    if (!employee.projectId) throw new ConvexError("Çalışanın proje bilgisi bulunamadı");
    if (args.notes !== undefined && args.notes.length > 500) throw new ConvexError("Not en fazla 500 karakter olabilir");
    validateLeaveRequestRange(args.startDate, args.endDate, istanbulToday());
    const rows = await ctx.db.query("leaves").withIndex("by_employee_start", q => q.eq("employeeId", employee._id)).order("desc").take(SCAN_LIMIT + 1);
    if (rows.length > SCAN_LIMIT) throw new ConvexError("İzin çakışması kontrol sınırına ulaştı");
    const pendingCount = rows.filter(row => row.status === "pending").length;
    if (pendingCount >= 10) throw new ConvexError("En fazla 10 bekleyen izin talebiniz olabilir");
    if (rows.some(row => row.status === "pending" && overlaps(args.startDate, args.endDate, row.startDate, row.endDate))) throw new ConvexError("Seçilen tarihler bekleyen başka bir izin talebiyle çakışıyor");
    if (rows.some(row => row.status === "approved" && overlaps(args.startDate, args.endDate, row.startDate, row.endDate))) throw new ConvexError("Seçilen tarihler onaylı başka bir izinle çakışıyor");
    const now = new Date().toISOString();
    const id = await ctx.db.insert("leaves", { employeeId: employee._id, projectId: employee.projectId, ...args, status: "pending", source: "employee", createdAt: now, updatedAt: now });
    await writeAudit(ctx, { user: null, projectId: employee.projectId, action: "create", targetTable: "leaves", targetId: id, newValue: { actorType: "employee", employeeId: employee._id, status: "pending" }, note: "Çalışan talebi" });
    return id;
  },
});

export const withdraw = employeeAuthedMutation({
  args: { leaveId: v.id("leaves") },
  handler: async (ctx, { leaveId }) => {
    const leave = await ctx.db.get(leaveId);
    if (!leave || leave.employeeId !== ctx.employee._id) throw new ConvexError("Bu izin talebine erişim yetkiniz yok");
    if (leave.status !== "pending" || leave.source !== "employee") throw new ConvexError("Yalnız bekleyen kendi izin talebinizi geri çekebilirsiniz");
    await ctx.db.delete(leaveId);
    await writeAudit(ctx, { user: null, projectId: leave.projectId, action: "delete", targetTable: "leaves", targetId: leaveId, oldValue: { actorType: "employee", employeeId: ctx.employee._id, status: leave.status }, note: "Çalışan talebi" });
    return null;
  },
});

export const listMine = employeeAuthedQuery({
  args: {},
  handler: async (ctx) => {
    const since = new Date(Date.now() - 365 * 86_400_000).toISOString().slice(0, 10);
    return await ctx.db.query("leaves").withIndex("by_employee_start", q => q.eq("employeeId", ctx.employee._id).gte("startDate", since)).order("desc").take(100);
  },
});
// Keep project authorization failures readable by clients as Convex errors.
async function requireProject(
  ctx: (QueryCtx | MutationCtx) & { user: Doc<"users"> },
  projectId: Id<"projects">,
) {
  try {
    if (ctx.user.role === "super_admin") {
      if (!(await ctx.db.get(projectId)))
        throw new Error("Proje bulunamadı");
      await requirePermission(ctx, ctx.user, projectId, "attendance.approve");
      return;
    }
    await resolveProjectScope(ctx, projectId);
  } catch {
    throw new ConvexError("Bu projeye erişim yetkiniz yok");
  }
  await requirePermission(ctx, ctx.user, projectId, "attendance.approve");
}

export const listPending = authedQuery({
  args: {
    projectId: v.id("projects"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, { projectId, paginationOpts }) => {
    await requireProject(ctx, projectId);
    const result = await ctx.db
      .query("leaves")
      .withIndex("by_project_status", (q) =>
        q.eq("projectId", projectId).eq("status", "pending"),
      )
      .order("desc")
      .paginate({
        ...paginationOpts,
        numItems: Math.max(1, Math.min(100, paginationOpts.numItems)),
      });
    const page = await Promise.all(
      result.page.map(async (leave) => {
        const employee = await ctx.db.get(leave.employeeId);
        const visible = employee?.projectId === projectId ? employee : null;
        const department = visible?.departmentId
          ? await ctx.db.get(visible.departmentId)
          : null;
        let days: number | null = null;
        try {
          days = calendarDays(leave.startDate, leave.endDate);
        } catch {
          // Legacy invalid dates must not break the approval queue.
        }
        return {
          ...leave,
          employeeName: visible
            ? `${visible.firstName} ${visible.lastName}`.trim()
            : "Personel bulunamadı",
          departmentName:
            department?.projectId === projectId ? department.name : undefined,
          calendarDays: days,
        };
      }),
    );
    return { ...result, page };
  },
});

export const pendingCount = authedQuery({
  args: {
    projectId: v.id("projects"),
    kind: v.union(v.literal("leaves"), v.literal("corrections")),
  },
  handler: async (ctx, { projectId, kind }) => {
    await requireProject(ctx, projectId);
    const rows = kind === "leaves"
      ? await ctx.db.query("leaves")
        .withIndex("by_project_status", (q) =>
          q.eq("projectId", projectId).eq("status", "pending"),
        ).take(101)
      : await ctx.db.query("attendanceCorrections")
        .withIndex("by_project_status", (q) =>
          q.eq("projectId", projectId).eq("status", "pending"),
        ).take(101);
    return { count: rows.length, capped: rows.length > 100 };
  },
});

async function decideLeave(
  ctx: MutationCtx & { user: Doc<"users"> },
  leaveId: Id<"leaves">,
  status: "approved" | "rejected",
  note?: string,
) {
  const leave = await ctx.db.get(leaveId);
  if (!leave?.projectId) throw new ConvexError("İzin talebi bulunamadı");
  await requireProject(ctx, leave.projectId);
  const employee = await ctx.db.get(leave.employeeId);
  if (!employee?.projectId || employee.projectId !== leave.projectId)
    throw new ConvexError("Çalışanın proje bilgisi izin talebiyle eşleşmiyor");
  await requireProject(ctx, employee.projectId);
  if (leave.status !== "pending")
    throw new ConvexError("Yalnız bekleyen izin talepleri işlenebilir");
  if (note !== undefined && note.trim().length > 500)
    throw new ConvexError("Karar notu en fazla 500 karakter olabilir");
  if (status === "approved")
    await assertNoLeaveOverlap(
      ctx,
      leave.employeeId,
      leave.startDate,
      leave.endDate,
      leaveId,
    );
  const now = new Date().toISOString();
  // Do not pass the decision note to leaveDecisionPatch: its legacy notes argument is the employee note.
  const patch = {
    ...await leaveDecisionPatch(
      ctx, ctx.user, leave.projectId,
      leave.status,
      status,
      ctx.user._id,
      now,
    ),
    decidedAt: now,
    decisionNote: note?.trim() || undefined,
  };
  await ctx.db.patch(leaveId, patch);
  await writeAudit(ctx, {
    user: ctx.user,
    projectId: leave.projectId,
    action: "update",
    targetTable: "leaves",
    targetId: leaveId,
    oldValue: { status: leave.status },
    newValue: patch,
    note: patch.decisionNote,
  });
  return null;
}

export const approve = authedMutation({
  args: { leaveId: v.id("leaves"), note: v.optional(v.string()) },
  handler: async (ctx, args) =>
    decideLeave(ctx, args.leaveId, "approved", args.note),
});
export const reject = authedMutation({
  args: { leaveId: v.id("leaves"), note: v.string() },
  handler: async (ctx, args) => {
    if (args.note.trim().length < 3 || args.note.trim().length > 500)
      throw new ConvexError("Red gerekçesi 3–500 karakter olmalı");
    return decideLeave(ctx, args.leaveId, "rejected", args.note);
  },
});
