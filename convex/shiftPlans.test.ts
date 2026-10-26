// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import { resolveDirection } from "./lib/cardReadingProcess";
const modules = import.meta.glob("./**/*.ts");
const range = { startDate: "2026-06-01", endDate: "2026-06-14" };
async function fixture(role: "project_admin" | "project_user" = "project_admin") {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "Test" });
    const foreignProjectId = await ctx.db.insert("projects", { name: "Other" });
    const userId = await ctx.db.insert("users", { role });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 86400000 });
    await ctx.db.insert("userProjects", { userId, projectId });
    const parentId = await ctx.db.insert("departments", { projectId, name: "Root", createdAt: "", updatedAt: "" });
    const departmentId = await ctx.db.insert("departments", { projectId, parentId, name: "Child", createdAt: "", updatedAt: "" });
    const foreignDepartmentId = await ctx.db.insert("departments", { projectId: foreignProjectId, name: "Other", createdAt: "", updatedAt: "" });
    const employeeId = await ctx.db.insert("employees", { projectId, departmentId, firstName: "Ada", lastName: "Test", email: "a@test.test", cardNumber: "1" });
    const otherEmployeeId = await ctx.db.insert("employees", { projectId, departmentId: parentId, firstName: "Other", lastName: "Test", email: "b@test.test", cardNumber: "2" });
    const foreignEmployeeId = await ctx.db.insert("employees", { projectId: foreignProjectId, firstName: "Foreign", lastName: "Test", email: "f@test.test", cardNumber: "3" });
    const morning = await ctx.db.insert("shifts", { projectId, name: "Morning", startTime: "08:00", endTime: "12:00", isActive: true, createdAt: "", updatedAt: "" });
    const evening = await ctx.db.insert("shifts", { projectId, name: "Evening", startTime: "14:00", endTime: "18:00", isActive: true, createdAt: "", updatedAt: "" });
    const night = await ctx.db.insert("shifts", { projectId, name: "Night", startTime: "22:00", endTime: "06:00", isActive: true, createdAt: "", updatedAt: "" });
    const foreignShift = await ctx.db.insert("shifts", { projectId: foreignProjectId, name: "Foreign", startTime: "08:00", endTime: "12:00", isActive: true, createdAt: "", updatedAt: "" });
    return { projectId, foreignProjectId, userId, sessionId, parentId, departmentId, foreignDepartmentId, employeeId, otherEmployeeId, foreignEmployeeId, morning, evening, night, foreignShift };
  });
  const caller = t.withIdentity({ subject: `${ids.userId}|${ids.sessionId}` });
  const bulk = { projectId: ids.projectId, employeeIds: [ids.employeeId], shiftId: ids.morning, ...range };
  const department = { projectId: ids.projectId, departmentId: ids.departmentId, shiftId: ids.morning, ...range };
  const cells = { projectId: ids.projectId, employeeIds: [ids.employeeId], rangeStart: range.startDate, rangeEnd: "2026-06-02" };
  const weekly = { kind: "weekly" as const, shiftIds: [ids.evening, ids.morning] };
  return { t, caller, ...ids, bulk, department, cells, weekly };
}

it("department preview ignores 300 employees' 20 historical leaves and future assignments", async () => {
  const f = await fixture();
  await f.t.run(async ctx => {
    for (let index = 0; index < 300; index++) {
      const employeeId = index === 0 ? f.employeeId : await ctx.db.insert("employees", { projectId: f.projectId, departmentId: f.departmentId, firstName: "Test", lastName: String(index), email: `scale${index}@test`, cardNumber: `scale${index}` });
      for (let history = 0; history < 20; history++) await ctx.db.insert("leaves", { projectId: f.projectId, employeeId, startDate: "2025-01-01", endDate: "2025-01-02", leaveType: "annual", status: "approved", createdAt: "", updatedAt: "" });
      await ctx.db.insert("shiftAssignments", { projectId: f.projectId, employeeId, shiftId: f.evening, startDate: "2027-01-01", endDate: "2027-12-31", createdAt: "", updatedAt: "" });
    }
    await ctx.db.insert("leaves", { projectId: f.projectId, employeeId: f.employeeId, startDate: "2026-05-31", endDate: range.startDate, leaveType: "annual", status: "approved", createdAt: "", updatedAt: "" });
    await ctx.db.insert("shiftAssignments", { projectId: f.projectId, employeeId: f.employeeId, shiftId: f.evening, ...range, createdAt: "", updatedAt: "" });
  });
  expect(await f.caller.query(api.shiftPlans.previewDepartmentAssign, f.department)).toMatchObject({ employeeCount: 300, personalOverrideCount: 1, leaveCount: 1 });
});

it.each([1, 2])("department preview retains per-read and shared sentinel budgets with %i employees", async count => {
  const f = await fixture();
  await f.t.run(async ctx => {
    await ctx.db.patch(f.otherEmployeeId, { departmentId: f.departmentId });
    const employeeIds = [f.employeeId, f.otherEmployeeId].slice(0, count);
    for (const employeeId of employeeIds) {
      for (let index = 0; index < Math.ceil(5001 / count); index++) await ctx.db.insert("leaves", { projectId: f.projectId, employeeId, ...range, leaveType: "annual", status: "approved", createdAt: "", updatedAt: "" });
    }
  });
  await expect(f.caller.query(api.shiftPlans.previewDepartmentAssign, f.department)).rejects.toThrow("Departman önizleme okuma sınırı aşıldı; tarih aralığını daraltın");
});
describe("employee plan API and transactional refs", () => {
  it("sorts plan ids, hides planned rows from old clients, and preserves plan on legacy update", async () => {
    const f = await fixture();
    expect((await f.caller.query(api.shifts.previewBulkAssign, { ...f.bulk, plan: f.weekly })).summary.willAssign).toBe(1);
    const result = await f.caller.mutation(api.shifts.bulkAssignShift, { ...f.bulk, plan: f.weekly });
    const assignmentId = result.results[0].assignmentId;
    if (!assignmentId) throw new Error("fixture");
    expect(await f.caller.query(api.shifts.listAssignments, { projectId: f.projectId })).toEqual([]);
    expect(await f.caller.query(api.shifts.listAssignments, { projectId: f.projectId, rangeStart: range.startDate, rangeEnd: range.endDate })).toEqual([]);
    const planned = await f.caller.query(api.shifts.listAssignments, { projectId: f.projectId, includePlans: true });
    expect(planned).toHaveLength(1);
    expect(planned[0]).toMatchObject({ shiftId: f.morning, plan: { kind: "weekly", shiftIds: [f.morning, f.evening] } });
    expect(await f.caller.query(api.shifts.listAssignments, { projectId: f.projectId, includePlans: true, shiftId: f.evening, rangeStart: range.startDate, rangeEnd: range.endDate })).toHaveLength(1);
    await f.caller.mutation(api.shifts.updateAssignment, { assignmentId, endDate: "2026-06-15" });
    expect((await f.t.run(ctx => ctx.db.get(assignmentId)))?.plan).toEqual(planned[0].plan);
    expect((await f.t.run(ctx => ctx.db.query("shiftPlanRefs").collect())).map(ref => ref.shiftId).sort()).toEqual([f.morning, f.evening].sort());
  });
  it("replaces secondary refs, rejects invalid update atomically and removes all refs", async () => {
    const f = await fixture();
    const result = await f.caller.mutation(api.shifts.bulkAssignShift, { ...f.bulk, plan: f.weekly });
    const assignmentId = result.results[0].assignmentId;
    if (!assignmentId) throw new Error("fixture");
    await f.caller.mutation(api.shifts.updateAssignment, { assignmentId, plan: { kind: "weekly", shiftIds: [f.night, f.morning] } });
    const read = () => f.t.run(async ctx => ({ assignment: await ctx.db.get(assignmentId), refs: await ctx.db.query("shiftPlanRefs").collect() }));
    const before = await read();
    expect(before.refs.map(ref => ref.shiftId).sort()).toEqual([f.morning, f.night].sort());
    await expect(f.caller.mutation(api.shifts.updateAssignment, { assignmentId, endDate: "2026-06-20", plan: { kind: "weekly", shiftIds: [f.morning, f.morning] } })).rejects.toThrow("iki kez");
    expect(await read()).toStrictEqual(before);
    await f.caller.mutation(api.shifts.removeAssignment, { assignmentId });
    expect(await read()).toEqual({ assignment: null, refs: [] });
  });
  it("downgrades single weekly plans to legacy rows and clears refs", async () => {
    const f = await fixture();
    const result = await f.caller.mutation(api.shifts.bulkAssignShift, { ...f.bulk, plan: f.weekly });
    const assignmentId = result.results[0].assignmentId;
    if (!assignmentId) throw new Error("fixture");
    await f.caller.mutation(api.shifts.updateAssignment, { assignmentId, plan: { kind: "weekly", shiftIds: [f.evening] } });
    expect(await f.t.run(ctx => ctx.db.get(assignmentId))).toMatchObject({ shiftId: f.evening });
    expect(await f.t.run(ctx => ctx.db.get(assignmentId))).not.toHaveProperty("plan");
    expect(await f.t.run(ctx => ctx.db.query("shiftPlanRefs").collect())).toEqual([]);
    expect(await f.caller.query(api.shifts.listAssignments, { projectId: f.projectId })).toHaveLength(1);
  });
  it("preserves cycle anchor and rebuilds refs when clear splits, then cleans deleted halves", async () => {
    const f = await fixture();
    const plan = { kind: "dayCycle" as const, anchorDate: range.startDate, slots: [[f.morning], [], [f.evening]] };
    await f.caller.mutation(api.shifts.bulkAssignShift, { ...f.bulk, plan });
    await f.caller.mutation(api.shifts.clearAssignments, { projectId: f.projectId, employeeIds: [f.employeeId], startDate: "2026-06-05", endDate: "2026-06-07" });
    const state = await f.t.run(async ctx => ({ rows: await ctx.db.query("shiftAssignments").collect(), refs: await ctx.db.query("shiftPlanRefs").collect() }));
    expect(state.rows).toHaveLength(2);
    for (const row of state.rows) expect(row.plan).toEqual(plan);
    expect(state.refs).toHaveLength(4);
    expect(state.rows.every(row => state.refs.filter(ref => ref.assignmentId === row._id).length === 2)).toBe(true);
    await f.caller.mutation(api.shifts.clearAssignments, { projectId: f.projectId, employeeIds: [f.employeeId], ...range });
    expect(await f.t.run(ctx => ctx.db.query("shiftPlanRefs").collect())).toEqual([]);
  });
  it("blocks secondary-definition deletion and counts each assignment only once", async () => {
    const f = await fixture();
    await f.caller.mutation(api.shifts.bulkAssignShift, { ...f.bulk, plan: f.weekly });
    await f.caller.mutation(api.shiftPlans.assignDepartment, { ...f.department, plan: f.weekly });
    await expect(f.caller.mutation(api.shifts.remove, { shiftId: f.evening })).rejects.toThrow("plan veya departman");
    const impacts = await f.caller.query(api.shifts.definitionImpacts, { projectId: f.projectId });
    expect(impacts.find(row => row.shiftId === f.evening)).toMatchObject({ assignmentCount: 2, employeeCount: 1, hasAssignments: true });
    expect(impacts.find(row => row.shiftId === f.morning)).toMatchObject({ assignmentCount: 2, employeeCount: 1 });
    expect(await f.caller.query(api.shifts.assignmentDeleteImpact, { shiftId: f.evening })).toMatchObject({ assignmentCount: 2, employeeCount: 1 });
  });
  it("counts future cyclic secondary references in definitionUsage beyond the first week", async () => {
    const f = await fixture();
    const startDate = "2099-06-01";
    await f.caller.mutation(api.shifts.bulkAssignShift, { ...f.bulk, startDate, endDate: "2099-07-01", plan: { kind: "dayCycle", anchorDate: startDate, slots: [...Array.from({ length: 20 }, () => []), [f.evening]] } });
    expect(await f.caller.query(api.shifts.definitionUsage, { shiftId: f.evening })).toMatchObject({ assignmentCount: 1, employeeCount: 1 });
  });
  it("does not count another slot as future use of a referenced definition", async () => {
    const f = await fixture();
    const startDate = "2099-06-01";
    await f.caller.mutation(api.shifts.bulkAssignShift, { ...f.bulk, startDate, endDate: startDate,
      plan: { kind: "dayCycle", anchorDate: startDate, slots: [[f.morning], [f.evening]] } });
    expect(await f.caller.query(api.shifts.definitionUsage, { shiftId: f.evening })).toMatchObject({ assignmentCount: 0 });
    expect(await f.caller.query(api.shifts.definitionUsage, { shiftId: f.morning })).toMatchObject({ assignmentCount: 1 });
  });
  it("uses all intervals for preview and rejects flexible + fixed and foreign shifts", async () => {
    const f = await fixture();
    await f.caller.mutation(api.shifts.bulkAssignShift, { ...f.bulk, shiftId: f.evening });
    expect((await f.caller.query(api.shifts.previewBulkAssign, { ...f.bulk, plan: f.weekly })).summary.conflict).toBe(1);
    const flex = await f.t.run(ctx => ctx.db.insert("shifts", { projectId: f.projectId, name: "Flexible", startTime: "05:00", endTime: "22:00", scheduleType: "flexible", isActive: true, createdAt: "", updatedAt: "" }));
    for (const shiftIds of [[f.morning, flex], [f.morning, f.foreignShift]]) {
      await expect(f.caller.query(api.shifts.previewBulkAssign, { ...f.bulk, plan: { kind: "weekly", shiftIds } })).rejects.toThrow();
      await expect(f.caller.mutation(api.shifts.bulkAssignShift, { ...f.bulk, plan: { kind: "weekly", shiftIds } })).rejects.toThrow();
    }
  });
});

describe("department assignments and calendar cells", () => {
  it("previews descendants and personal overrides and requires same-department conflict confirmation", async () => {
    const f = await fixture();
    await f.caller.mutation(api.shifts.bulkAssignShift, f.bulk);
    const args = { ...f.department, departmentId: f.parentId };
    expect(await f.caller.query(api.shiftPlans.previewDepartmentAssign, args)).toMatchObject({ employeeCount: 2, personalOverrideCount: 1, sameDepartmentConflicts: [], leaveCount: 0, holidayCount: 0 });
    const departmentAssignmentId = await f.caller.mutation(api.shiftPlans.assignDepartment, args);
    expect(await f.caller.query(api.shiftPlans.previewDepartmentAssign, args)).toMatchObject({ sameDepartmentConflicts: [{ departmentAssignmentId }] });
    await expect(f.caller.mutation(api.shiftPlans.assignDepartment, args)).rejects.toThrow("çakışan");
    await f.caller.mutation(api.shiftPlans.assignDepartment, { ...args, forceConfirm: true });
    expect(await f.caller.query(api.shiftPlans.listDepartmentAssignments, { projectId: f.projectId })).toHaveLength(2);
  });
  it("counts only worked dates for leave and holiday preview, including overnight tails", async () => {
    const f = await fixture();
    await f.t.run(async ctx => {
      await ctx.db.insert("leaves", { projectId: f.projectId, employeeId: f.employeeId, startDate: "2026-06-02", endDate: "2026-06-02", leaveType: "annual", status: "approved", createdAt: "", updatedAt: "" });
      await ctx.db.insert("holidays", { projectId: f.projectId, date: "2026-06-02", name: "Tail", createdAt: "" });
      await ctx.db.insert("holidays", { projectId: f.projectId, date: "2026-06-03", name: "Rest", createdAt: "" });
    });
    const preview = await f.caller.query(api.shiftPlans.previewDepartmentAssign, { ...f.department, endDate: "2026-06-03", plan: { kind: "dayCycle", anchorDate: range.startDate, slots: [[f.night], [], []] } });
    expect(preview).toMatchObject({ leaveCount: 1, holidayCount: 1 });
  });
  it("updates, preserves or replaces plans and atomically removes department refs", async () => {
    const f = await fixture();
    const departmentAssignmentId = await f.caller.mutation(api.shiftPlans.assignDepartment, { ...f.department, plan: f.weekly });
    await f.caller.mutation(api.shiftPlans.updateDepartmentAssignment, { departmentAssignmentId, endDate: "2026-06-15" });
    expect((await f.t.run(ctx => ctx.db.get(departmentAssignmentId)))?.plan).toEqual({ kind: "weekly", shiftIds: [f.morning, f.evening] });
    await f.caller.mutation(api.shiftPlans.updateDepartmentAssignment, { departmentAssignmentId, plan: { kind: "dayCycle", anchorDate: range.startDate, slots: [[], [f.night]] } });
    expect((await f.t.run(ctx => ctx.db.query("shiftPlanRefs").collect())).map(row => row.shiftId)).toEqual([f.night]);
    await f.caller.mutation(api.shiftPlans.removeDepartmentAssignment, { departmentAssignmentId });
    expect(await f.t.run(ctx => ctx.db.query("shiftPlanRefs").collect())).toEqual([]);
    expect(await f.caller.query(api.shiftPlans.listDepartmentAssignments, { projectId: f.projectId })).toEqual([]);
  });
  it("blocks removal of an otherwise empty department with an assignment", async () => {
    const f = await fixture();
    await f.t.run(ctx => ctx.db.patch(f.employeeId, { departmentId: undefined }));
    const departmentAssignmentId = await f.caller.mutation(api.shiftPlans.assignDepartment, f.department);
    await expect(f.caller.mutation(api.departments.remove, { departmentId: f.departmentId })).rejects.toThrow("vardiya ataması");
    await expect(f.caller.mutation(api.shifts.remove, { shiftId: f.morning })).rejects.toThrow("departman ataması");
    await f.caller.mutation(api.shiftPlans.removeDepartmentAssignment, { departmentAssignmentId });
    await f.caller.mutation(api.departments.remove, { departmentId: f.departmentId });
    expect(await f.t.run(ctx => ctx.db.get(f.departmentId))).toBeNull();
  });
  it("returns exact employee, inherited department and no-plan source fields", async () => {
    const f = await fixture();
    expect(await f.caller.query(api.shiftPlans.planCells, f.cells)).toEqual([
      { employeeId: f.employeeId, date: "2026-06-01", kind: "none", source: "project", shiftIds: [] },
      { employeeId: f.employeeId, date: "2026-06-02", kind: "none", source: "project", shiftIds: [] },
    ]);
    await f.t.run(ctx => ctx.db.patch(f.employeeId, { shiftId: f.evening }));
    expect((await f.caller.query(api.shiftPlans.planCells, f.cells))[0]).toEqual({ employeeId: f.employeeId, date: "2026-06-01", kind: "none", source: "project", shiftIds: [] });
    const departmentAssignmentId = await f.caller.mutation(api.shiftPlans.assignDepartment, { ...f.department, departmentId: f.parentId, plan: { kind: "dayCycle", anchorDate: range.startDate, slots: [[], [f.morning, f.night]] } });
    expect(await f.caller.query(api.shiftPlans.planCells, f.cells)).toEqual([
      { employeeId: f.employeeId, date: "2026-06-01", kind: "rest", source: "department", shiftIds: [], departmentId: f.parentId, departmentAssignmentId },
      { employeeId: f.employeeId, date: "2026-06-02", kind: "shifts", source: "department", shiftIds: [f.morning, f.night], departmentId: f.parentId, departmentAssignmentId },
    ]);
    const result = await f.caller.mutation(api.shifts.bulkAssignShift, { ...f.bulk, plan: f.weekly });
    expect((await f.caller.query(api.shiftPlans.planCells, f.cells))[0]).toEqual({ employeeId: f.employeeId, date: "2026-06-01", kind: "shifts", source: "employee", shiftIds: [f.morning, f.evening], assignmentId: result.results[0].assignmentId });
  });
  it("enforces the 50 employee/42 day bounds and project scope", async () => {
    const f = await fixture();
    expect(await f.caller.query(api.shiftPlans.planCells, { ...f.cells, rangeEnd: "2026-07-12" })).toHaveLength(42);
    for (const patch of [{ rangeEnd: "2026-07-13" }, { employeeIds: Array.from({ length: 51 }, () => f.employeeId) }, { employeeIds: [f.foreignEmployeeId] }, { rangeStart: "2026-02-30" }]) {
      await expect(f.caller.query(api.shiftPlans.planCells, { ...f.cells, ...patch })).rejects.toThrow();
    }
    await expect(f.caller.query(api.shiftPlans.listDepartmentAssignments, { projectId: f.foreignProjectId })).rejects.toThrow("erişim");
    await expect(f.caller.mutation(api.shiftPlans.assignDepartment, { ...f.department, departmentId: f.foreignDepartmentId })).rejects.toThrow("seçili projeye");
    await expect(f.caller.mutation(api.shiftPlans.assignDepartment, { ...f.department, shiftId: f.foreignShift })).rejects.toThrow("seçili projeye");
  });
  it("permits project-scoped reads and denies writes without schedule.manage", async () => {
    const f = await fixture("project_user");
    expect(await f.caller.query(api.shiftPlans.previewDepartmentAssign, f.department)).toMatchObject({ employeeCount: 1 });
    await expect(f.caller.mutation(api.shiftPlans.assignDepartment, f.department)).rejects.toThrow("yetkiniz yok");
    const departmentAssignmentId = await f.t.run(ctx => ctx.db.insert("departmentShiftAssignments", { ...f.department, createdAt: "", updatedAt: "" }));
    await expect(f.caller.mutation(api.shiftPlans.updateDepartmentAssignment, { departmentAssignmentId, endDate: "2026-06-15" })).rejects.toThrow("yetkiniz yok");
    await expect(f.caller.mutation(api.shiftPlans.removeDepartmentAssignment, { departmentAssignmentId })).rejects.toThrow("yetkiniz yok");
  });
  it("uses the last inherited split shift for next-day reader direction", async () => {
    const f = await fixture();
    await f.caller.mutation(api.shiftPlans.assignDepartment, { ...f.department, plan: { kind: "weekly", shiftIds: [f.morning, f.night] } });
    await f.t.run(async ctx => {
      const deviceId = await ctx.db.insert("devices", { projectId: f.projectId, name: "Reader", accessDirection: "both", createdAt: "", updatedAt: "" });
      await ctx.db.insert("cardReadings", { projectId: f.projectId, employeeId: f.employeeId, deviceId, cardNo: "1", accessTime: "2026-06-01T19:00:00Z", accessStatus: "izin_verildi", direction: "entry" });
      expect(await resolveDirection(ctx, { device: await ctx.db.get(deviceId), employeeId: f.employeeId, nowISO: "2026-06-02T03:00:00Z" })).toBe("exit");
    });
  });
});
