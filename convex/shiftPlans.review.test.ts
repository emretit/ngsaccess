// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it, vi } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import { buildBoundedShiftResolver, buildShiftResolver } from "./lib/shiftResolver";
import { projectDeletionCounts, projectDeletionImpactRows } from "./lib/adminGuards";
const modules = import.meta.glob("./**/*.ts");
const dates = { startDate: "2026-06-01", endDate: "2026-06-14" };
async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "Review" });
    const userId = await ctx.db.insert("users", { role: "project_admin" });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 86400000 });
    await ctx.db.insert("userProjects", { userId, projectId });
    const departmentId = await ctx.db.insert("departments", { projectId, name: "Department", createdAt: "", updatedAt: "" });
    const morning = await ctx.db.insert("shifts", { projectId, name: "Morning", startTime: "08:00", endTime: "12:00", createdAt: "", updatedAt: "" });
    const evening = await ctx.db.insert("shifts", { projectId, name: "Evening", startTime: "14:00", endTime: "18:00", createdAt: "", updatedAt: "" });
    const employeeId = await ctx.db.insert("employees", { projectId, departmentId, shiftId: morning, firstName: "Ada", lastName: "Test", email: "test@test", cardNumber: "1" });
    return { projectId, userId, sessionId, departmentId, morning, evening, employeeId };
  });
  const caller = t.withIdentity({ subject: `${ids.userId}|${ids.sessionId}` });
  const plan = { kind: "weekly" as const, shiftIds: [ids.morning, ids.evening] };
  const bulk = { projectId: ids.projectId, employeeIds: [ids.employeeId], shiftId: ids.morning, ...dates, plan };
  const department = { projectId: ids.projectId, departmentId: ids.departmentId, shiftId: ids.morning, ...dates, plan };
  return { t, caller, ...ids, bulk, department };
}

describe("review: assignment lifecycle", () => {
  it.each(["remove", "bulkDelete"] as const)("employee %s removes secondary refs before the assignment", async method => {
    vi.useFakeTimers();
    try {
      const f = await fixture();
      await f.caller.mutation(api.shifts.bulkAssignShift, f.bulk);
      expect(await f.t.run(ctx => ctx.db.query("shiftPlanRefs").collect())).toHaveLength(2);
      if (method === "remove") await f.caller.mutation(api.employees.remove, { employeeId: f.employeeId });
      else await f.caller.mutation(api.employees.bulkDelete, { employeeIds: [f.employeeId] });
      expect(await f.t.run(ctx => ctx.db.query("shiftAssignments").collect())).toEqual([]);
      expect(await f.t.run(ctx => ctx.db.query("shiftPlanRefs").collect())).toEqual([]);
      await f.caller.mutation(api.shifts.remove, { shiftId: f.evening });
      expect(await f.t.run(ctx => ctx.db.get(f.evening))).toBeNull();
      await f.t.finishAllScheduledFunctions(() => vi.runAllTimers());
    } finally { vi.useRealTimers(); }
  });
  it("repairs multiple orphan employee and department refs while deleting the shift", async () => {
    const f = await fixture();
    await f.t.run(async ctx => {
      const assignmentId = await ctx.db.insert("shiftAssignments", { employeeId: f.employeeId, shiftId: f.morning, projectId: f.projectId, ...dates, createdAt: "", updatedAt: "" });
      const departmentAssignmentId = await ctx.db.insert("departmentShiftAssignments", { ...f.department, createdAt: "", updatedAt: "" });
      await ctx.db.insert("shiftPlanRefs", { projectId: f.projectId, shiftId: f.evening, assignmentId });
      await ctx.db.insert("shiftPlanRefs", { projectId: f.projectId, shiftId: f.evening, departmentAssignmentId });
      await ctx.db.delete(assignmentId);
      await ctx.db.delete(departmentAssignmentId);
    });
    await f.caller.mutation(api.shifts.remove, { shiftId: f.evening });
    expect(await f.t.run(ctx => ctx.db.query("shiftPlanRefs").collect())).toEqual([]);
    expect(await f.t.run(ctx => ctx.db.get(f.evening))).toBeNull();
  });
  it("does not mistake a live secondary owner for an orphan", async () => {
    const f = await fixture();
    await f.caller.mutation(api.shifts.bulkAssignShift, f.bulk);
    await expect(f.caller.mutation(api.shifts.remove, { shiftId: f.evening })).rejects.toThrow("plan veya departman");
    expect(await f.t.run(ctx => ctx.db.query("shiftPlanRefs").collect())).toHaveLength(2);
  });
  it("rejects shiftId-only edits for both plan owners but accepts dates/weekPattern without plan", async () => {
    const f = await fixture();
    const assignmentId = (await f.caller.mutation(api.shifts.bulkAssignShift, f.bulk)).results[0].assignmentId;
    if (!assignmentId) throw new Error("fixture");
    const departmentAssignmentId = await f.caller.mutation(api.shiftPlans.assignDepartment, f.department);
    for (const shiftId of [f.morning, f.evening]) {
      await expect(f.caller.mutation(api.shifts.updateAssignment, { assignmentId, shiftId })).rejects.toThrow("Planlı atamada vardiyayı plan üzerinden değiştirin");
      await expect(f.caller.mutation(api.shiftPlans.updateDepartmentAssignment, { departmentAssignmentId, shiftId })).rejects.toThrow("Planlı atamada vardiyayı plan üzerinden değiştirin");
    }
    await f.caller.mutation(api.shifts.updateAssignment, { assignmentId, endDate: "2026-06-15", weekPattern: ["MON"] });
    await f.caller.mutation(api.shiftPlans.updateDepartmentAssignment, { departmentAssignmentId, endDate: "2026-06-15", weekPattern: ["MON"] });
    for (const id of [assignmentId, departmentAssignmentId]) expect(await f.t.run(ctx => ctx.db.get(id))).toMatchObject({ endDate: "2026-06-15", weekPattern: ["MON"], plan: f.bulk.plan });
    await f.caller.mutation(api.shifts.updateAssignment, { assignmentId, shiftId: f.evening, plan: { kind: "weekly", shiftIds: [f.evening] } });
    await f.caller.mutation(api.shiftPlans.updateDepartmentAssignment, { departmentAssignmentId, shiftId: f.evening, plan: { kind: "weekly", shiftIds: [f.evening] } });
    for (const id of [assignmentId, departmentAssignmentId]) expect(await f.t.run(ctx => ctx.db.get(id))).not.toHaveProperty("plan");
  });
  it("writes create/update/delete audits with the same target, actor and project", async () => {
    const f = await fixture();
    const departmentAssignmentId = await f.caller.mutation(api.shiftPlans.assignDepartment, f.department);
    await f.caller.mutation(api.shiftPlans.updateDepartmentAssignment, { departmentAssignmentId, endDate: "2026-06-15" });
    await f.caller.mutation(api.shiftPlans.removeDepartmentAssignment, { departmentAssignmentId });
    const logs = await f.t.run(ctx => ctx.db.query("auditLog").collect());
    expect(logs.map(log => log.action)).toEqual(["create", "update", "delete"]);
    for (const log of logs) expect(log).toMatchObject({ projectId: f.projectId, userId: f.userId, targetTable: "departmentShiftAssignments", targetId: departmentAssignmentId });
    expect(logs[0].newValue).toMatchObject({ plan: f.department.plan, endDate: dates.endDate });
    expect(logs[1].oldValue).toMatchObject({ endDate: dates.endDate });
    expect(logs[1].newValue).toMatchObject({ endDate: "2026-06-15" });
    expect(logs[2].oldValue).toMatchObject({ endDate: "2026-06-15" });
  });
});

describe("review: bounded reads and project blockers", () => {
  it.each([0, 1, 2])("returns honest impact counts with %i reads remaining for plan links", async remaining => {
    const f = await fixture();
    await f.t.run(async ctx => {
      for (let i = 0; i < 5000 - remaining; i++) await ctx.db.insert("shiftAssignments", { employeeId: f.employeeId, projectId: f.projectId, shiftId: f.morning, ...dates, createdAt: "", updatedAt: "" });
      const departmentAssignmentId = await ctx.db.insert("departmentShiftAssignments", { ...f.department, createdAt: "", updatedAt: "" });
      for (const shiftId of [f.morning, f.evening]) await ctx.db.insert("shiftPlanRefs", { projectId: f.projectId, shiftId, departmentAssignmentId });
    });
    const impacts = await f.caller.query(api.shifts.definitionImpacts, { projectId: f.projectId });
    const first = impacts.find(impact => impact.shiftId === f.morning);
    expect(first).toMatchObject({ truncated: remaining < 2, countLabel: remaining < 2 ? "En az" : "Toplam", hasAssignments: true });
    expect(first?.assignmentCount).toBe(5000 - remaining + (remaining > 0 ? 1 : 0));
    expect(impacts.find(impact => impact.shiftId === f.evening)).toMatchObject({ truncated: true, countLabel: "Hesaplanamadı", hasAssignments: true, assignmentCount: null });
  });
  it("does not read or reject a 2001-department tree with no assignments", async () => {
    const f = await fixture();
    await f.t.run(async ctx => {
      for (let i = 0; i < 2000; i++) await ctx.db.insert("departments", { projectId: f.projectId, name: `D${i}`, createdAt: "", updatedAt: "" });
      const employee = await ctx.db.get(f.employeeId);
      if (!employee) throw new Error("fixture");
      const spy = vi.spyOn(ctx.db, "query");
      for (const build of [buildShiftResolver, buildBoundedShiftResolver]) {
        const resolver = await build(ctx, [employee]);
        expect(resolver.resolve(f.employeeId, dates.startDate)).toStrictEqual(await ctx.db.get(f.morning));
        expect(resolver.resolvePlan(f.employeeId, dates.startDate)).toMatchObject({ source: "default" });
      }
      expect(spy.mock.calls.filter(([table]) => table === "departments")).toEqual([]);
      spy.mockRestore();
    });
  });
  it("counts orphan plan refs and department assignments as indexed project deletion blockers", async () => {
    const f = await fixture();
    await f.t.run(async ctx => {
      const departmentAssignmentId = await ctx.db.insert("departmentShiftAssignments", { ...f.department, createdAt: "", updatedAt: "" });
      await ctx.db.insert("shiftPlanRefs", { projectId: f.projectId, shiftId: f.morning, departmentAssignmentId });
      await ctx.db.delete(f.departmentId);
      await ctx.db.delete(f.morning);
      await ctx.db.delete(f.evening);
      await ctx.db.delete(f.employeeId);
      const counts = await projectDeletionCounts(ctx, f.projectId);
      expect(counts).toMatchObject({ departmentShiftAssignments: 1, shiftPlanRefs: 1 });
      const impact = projectDeletionImpactRows(counts);
      expect(impact.canDelete).toBe(false);
      expect(impact.blockers.map(row => row.table).sort()).toEqual(["departmentShiftAssignments", "shiftPlanRefs"]);
    });
  });
});
