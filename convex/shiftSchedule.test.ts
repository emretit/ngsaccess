// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import { scheduleForAssignment } from "./lib/shiftSchedule";
import { slotForDate } from "./lib/shiftPlan";

async function fixture() {
  const t = convexTest(schema, import.meta.glob("./**/*.ts"));
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "Desen" });
    const userId = await ctx.db.insert("users", { role: "project_admin" });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 86_400_000 });
    await ctx.db.insert("userProjects", { userId, projectId });
    const employeeId = await ctx.db.insert("employees", { projectId, firstName: "Ada", lastName: "Test", email: "pattern@test", cardNumber: "1" });
    return { projectId, userId, sessionId, employeeId };
  });
  return { t, ...ids, caller: t.withIdentity({ subject: `${ids.userId}|${ids.sessionId}` }) };
}

it("saves a cycle on the shift and snapshots it into a real assignment without changing it on later definition edits", async () => {
  const f = await fixture();
  const shiftId = await f.caller.mutation(api.shifts.create, { projectId: f.projectId, name: "2 çalış 2 tatil", startTime: "09:00", endTime: "18:00", scheduleMode: "cycle", dayPlan: [true, true, false, false] });
  const shift = await f.t.run(ctx => ctx.db.get(shiftId));
  if (!shift) throw new Error("Vardiya bulunamadı");
  const range = { startDate: "2026-11-11", endDate: "2026-11-18" };
  const pattern = scheduleForAssignment(shift, range.startDate);
  await f.caller.mutation(api.shifts.bulkAssignShift, { projectId: f.projectId, shiftId, employeeIds: [f.employeeId], ...range, ...pattern, resultMode: "detailed" });
  const rows = await f.t.run(ctx => ctx.db.query("shiftAssignments").collect());
  expect(rows).toHaveLength(1);
  expect(slotForDate(rows[0], "2026-11-11")).toEqual([shiftId]);
  expect(slotForDate(rows[0], "2026-11-13")).toEqual([]);
  expect(slotForDate(rows[0], "2026-11-15")).toEqual([shiftId]);
  await f.caller.mutation(api.shifts.update, { shiftId, scheduleMode: "weekly", dayPlan: [true, true, true, true, true, false, false] });
  const saved = await f.t.run(ctx => ctx.db.get(shiftId));
  expect(saved).toMatchObject({ scheduleMode: "weekly", dayPlan: [true, true, true, true, true, false, false] });
  expect(await f.t.run(ctx => ctx.db.query("shiftAssignments").collect())).toEqual(rows);
  expect(await f.t.run(ctx => ctx.db.query("shiftVersions").collect())).toEqual([]);
});

it("rejects malformed or empty work patterns on create and update", async () => {
  const f = await fixture();
  const fields = { projectId: f.projectId, name: "Gündüz", startTime: "09:00", endTime: "18:00" };
  await expect(f.caller.mutation(api.shifts.create, { ...fields, scheduleMode: "weekly", dayPlan: [true] })).rejects.toThrow("7 gün");
  await expect(f.caller.mutation(api.shifts.create, { ...fields, scheduleMode: "cycle", dayPlan: [false, false] })).rejects.toThrow("çalışma günü");
  const shiftId = await f.caller.mutation(api.shifts.create, fields);
  await expect(f.caller.mutation(api.shifts.update, { shiftId, scheduleMode: "cycle", dayPlan: Array.from({ length: 32 }, () => true) })).rejects.toThrow("2–31");
});

it("previews and saves unlimited cycles, reads a far future week and splits the series on a bounded clear", async () => {
  const f = await fixture();
  const shiftId = await f.caller.mutation(api.shifts.create, { projectId: f.projectId, name: "Döngü", startTime: "09:00", endTime: "18:00", scheduleMode: "cycle", dayPlan: [true, false] });
  const shift = await f.t.run(ctx => ctx.db.get(shiftId));
  if (!shift) throw new Error("Vardiya bulunamadı");
  const range = { startDate: "2026-11-11", endDate: "9999-12-31" };
  const request = { projectId: f.projectId, shiftId, employeeIds: [f.employeeId], ...range, ...scheduleForAssignment(shift, range.startDate) };
  const preview = await f.caller.query(api.shifts.previewBulkAssign, request);
  expect(preview.summary.willAssign).toBe(1);
  await f.caller.mutation(api.shifts.bulkAssignShift, { ...request, resultMode: "detailed" });
  const cells = await f.caller.query(api.shiftPlans.planCells, { projectId: f.projectId, employeeIds: [f.employeeId], rangeStart: "2040-01-01", rangeEnd: "2040-01-07" });
  expect(cells).toHaveLength(7);
  expect(cells.some(cell => cell.kind === "shifts")).toBe(true);
  await f.caller.mutation(api.shifts.clearAssignments, { projectId: f.projectId, employeeIds: [f.employeeId], startDate: "2040-01-01", endDate: "2040-01-07" });
  const assignments = await f.t.run(ctx => ctx.db.query("shiftAssignments").collect());
  expect(assignments).toHaveLength(2);
  expect(assignments.map(row => row.endDate)).toContain("9999-12-31");
});
