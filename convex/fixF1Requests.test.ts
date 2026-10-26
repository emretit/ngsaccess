// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import type { Doc } from "./_generated/dataModel";

const modules = import.meta.glob("./**/*.ts");
async function fixture(role: Doc<"users">["role"] = "project_admin") {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "Merkez" });
    const otherProjectId = await ctx.db.insert("projects", { name: "Diğer" });
    const userId = await ctx.db.insert("users", { role });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 86400000 });
    await ctx.db.insert("userProjects", { userId, projectId });
    const employeeId = await ctx.db.insert("employees", { projectId, firstName: "Ada", lastName: "Test", email: "ada@test", cardNumber: "123", isActive: true });
    const otherEmployeeId = await ctx.db.insert("employees", { projectId: otherProjectId, firstName: "Diğer", lastName: "Test", email: "other@test", cardNumber: "456", isActive: true });
    const correction = { employeeId, projectId, date: "2026-10-20", correctionType: "both" as const, requestedCheckIn: "09:00", requestedCheckOut: "18:00", reason: "Kartımı unuttum", status: "pending" as const, createdAt: "now", updatedAt: "now" };
    const correctionId = await ctx.db.insert("attendanceCorrections", correction);
    const rejectedCorrectionId = await ctx.db.insert("attendanceCorrections", { ...correction, status: "rejected", decisionNote: "Geçmiş karar" });
    const otherCorrectionId = await ctx.db.insert("attendanceCorrections", { ...correction, employeeId: otherEmployeeId, projectId: otherProjectId });
    const leave = { employeeId, projectId, leaveType: "annual" as const, startDate: "2026-11-01", endDate: "2026-11-02", source: "employee" as const, status: "pending" as const, createdAt: "now", updatedAt: "now" };
    const leaveId = await ctx.db.insert("leaves", leave);
    const approvedLeaveId = await ctx.db.insert("leaves", { ...leave, status: "approved" });
    const adminLeaveId = await ctx.db.insert("leaves", { ...leave, source: "admin" });
    const rejectedLeaveId = await ctx.db.insert("leaves", { ...leave, status: "rejected" });
    return { projectId, otherProjectId, userId, sessionId, employeeId, correctionId, rejectedCorrectionId, otherCorrectionId, leaveId, approvedLeaveId, adminLeaveId, rejectedLeaveId };
  });
  return { t, ...ids, caller: t.withIdentity({ subject: `${ids.userId}|${ids.sessionId}` }) };
}

describe("F1 talep kuyruğu ve kişi silme", () => {
  it("yönetici kuyruğu/sayacı görür, onay PDKS yazar ve red kuyruğu boşaltır", async () => {
    const f = await fixture();
    const args = { projectId: f.projectId, paginationOpts: { cursor: null, numItems: 25 } };
    expect((await f.caller.query(api.attendanceCorrections.listPending, args)).page).toMatchObject([{ _id: f.correctionId, employeeName: "Ada Test" }]);
    expect(await f.caller.query(api.leaveRequests.pendingCount, { projectId: f.projectId, kind: "corrections" })).toMatchObject({ count: 1 });
    await f.caller.mutation(api.attendanceCorrections.approve, { id: f.correctionId });
    expect(await f.t.run(ctx => ctx.db.query("pdksRecords").withIndex("by_employee", q => q.eq("employeeId", f.employeeId)).first())).toMatchObject({ entryTime: "09:00", exitTime: "18:00", manualEntry: true });
    await f.t.run(ctx => ctx.db.patch(f.correctionId, { status: "pending" }));
    await expect(f.caller.mutation(api.attendanceCorrections.reject, { id: f.correctionId, note: "Az" })).rejects.toThrow();
    await f.caller.mutation(api.attendanceCorrections.reject, { id: f.correctionId, note: "Uygun değil" });
    expect(await f.t.run(ctx => ctx.db.get(f.correctionId))).toMatchObject({ status: "rejected", decisionNote: "Uygun değil" });
    expect((await f.caller.query(api.attendanceCorrections.listPending, args)).page).toEqual([]);
    expect(await f.caller.query(api.leaveRequests.pendingCount, { projectId: f.projectId, kind: "corrections" })).toMatchObject({ count: 0 });
  });
  it("rol ve proje dışı kuyruğu/kararı reddeder", async () => {
    for (const role of ["project_user", "project_admin"] as const) {
      const f = await fixture(role);
      const projectId = role === "project_user" ? f.projectId : f.otherProjectId;
      const id = role === "project_user" ? f.correctionId : f.otherCorrectionId;
      await expect(f.caller.query(api.attendanceCorrections.listPending, { projectId, paginationOpts: { cursor: null, numItems: 25 } })).rejects.toThrow();
      await expect(f.caller.query(api.leaveRequests.pendingCount, { projectId, kind: "corrections" })).rejects.toThrow();
      await expect(f.caller.mutation(api.attendanceCorrections.approve, { id })).rejects.toThrow();
      await expect(f.caller.mutation(api.attendanceCorrections.reject, { id, note: "Uygun değil" })).rejects.toThrow();
    }
  });
  it("kişi silinince bekleyen talepleri kapatır; karar geçmişini ve diğer kişiyi korur", async () => {
    const f = await fixture();
    await f.caller.mutation(api.employees.remove, { employeeId: f.employeeId });
    const rows = await f.t.run(async ctx => ({ employee: await ctx.db.get(f.employeeId), correction: await ctx.db.get(f.correctionId), rejected: await ctx.db.get(f.rejectedCorrectionId), other: await ctx.db.get(f.otherCorrectionId), leave: await ctx.db.get(f.leaveId), approved: await ctx.db.get(f.approvedLeaveId), admin: await ctx.db.get(f.adminLeaveId), rejectedLeave: await ctx.db.get(f.rejectedLeaveId) }));
    expect(rows.employee).toBeNull();
    expect(rows.correction).toMatchObject({ status: "withdrawn", decisionNote: "Kişi kaydı silindi", decidedAt: expect.any(String) });
    expect(rows.correction?.decidedBy).toBeUndefined();
    expect(rows.rejected).toMatchObject({ status: "rejected", decisionNote: "Geçmiş karar" });
    expect(rows.other).toMatchObject({ status: "pending" });
    expect(rows.leave).toBeNull();
    expect(rows.approved?.status).toBe("approved");
    expect(rows.admin?.status).toBe("pending");
    expect(rows.rejectedLeave?.status).toBe("rejected");
  });
  it.each(["attendanceCorrections", "leaves"] as const)("%s okuma sınırını aşınca silmeyi atomik reddeder", async table => {
    const f = await fixture();
    await f.t.run(async ctx => {
      if (table === "attendanceCorrections") {
        for (let i = 0; i < 1000; i++) await ctx.db.insert(table, { employeeId: f.employeeId, projectId: f.projectId, date: "2026-10-20", correctionType: "checkIn", reason: "Geçmiş", status: "approved", createdAt: "now", updatedAt: "now" });
      } else {
        for (let i = 0; i < 1000; i++) await ctx.db.insert(table, { employeeId: f.employeeId, projectId: f.projectId, leaveType: "annual", startDate: "2026-11-01", endDate: "2026-11-02", status: "approved", createdAt: "now", updatedAt: "now" });
      }
    });
    await expect(f.caller.mutation(api.employees.remove, { employeeId: f.employeeId })).rejects.toThrow("silme sınırını");
    expect(await f.t.run(ctx => ctx.db.get(f.employeeId))).not.toBeNull();
    expect(await f.t.run(ctx => ctx.db.get(f.correctionId))).toMatchObject({ status: "pending" });
    expect(await f.t.run(ctx => ctx.db.get(f.leaveId))).not.toBeNull();
  });
});
