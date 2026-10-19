import { v, ConvexError } from "convex/values";
import { employeeAuthedMutation, employeeAuthedQuery } from "./lib/customFunctions";
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
