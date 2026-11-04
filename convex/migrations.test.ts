// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import schema from "./schema";
import { internal } from "./_generated/api";

it("8: dry-run previews two weekly rows, real backfill is idempotent and preserves updatedAt", async () => {
  const t = convexTest(schema, import.meta.glob("./**/*.ts"));
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "Default" });
    const shiftId = await ctx.db.insert("shifts", { projectId, name: "Day", startTime: "09:00", endTime: "17:00", createdAt: "old", updatedAt: "old" });
    const employeeId = await ctx.db.insert("employees", { projectId, firstName: "Ada", lastName: "Test", email: "a@test", cardNumber: "1" });
    const departmentId = await ctx.db.insert("departments", { projectId, name: "Department" });
    const values = { projectId, shiftId, startDate: "2026-01-01", endDate: "2026-12-31", createdAt: "old", updatedAt: "priority" };
    const personal = await ctx.db.insert("shiftAssignments", { ...values, employeeId });
    const department = await ctx.db.insert("departmentShiftAssignments", { ...values, departmentId, plan: { kind: "weekly", shiftIds: [shiftId] }, weekPattern: [] });
    await ctx.db.insert("shiftAssignments", { ...values, employeeId, weekPattern: ["SAT"] });
    await ctx.db.insert("shiftAssignments", { ...values, employeeId, plan: { kind: "dayCycle", anchorDate: "2026-01-01", slots: [[shiftId], []] } });
    await ctx.db.insert("departmentShiftAssignments", { ...values, departmentId, plan: { kind: "weekCycle", anchorDate: "2026-01-05", slots: [[shiftId], [], [], [], [], [], []] } });
    return { projectId, personal, department };
  });
  const preview = await t.mutation(internal.migrations.backfillWeeklyWorkingDays, { dryRun: true });
  expect(preview).toMatchObject({ scanned: 5, wouldUpdate: 2, updated: 0 });
  expect(preview.rows).toEqual([
    { table: "shiftAssignments", id: ids.personal, projectId: ids.projectId, weekPattern: ["MON", "TUE", "WED", "THU", "FRI"] },
    { table: "departmentShiftAssignments", id: ids.department, projectId: ids.projectId, weekPattern: ["MON", "TUE", "WED", "THU", "FRI"] },
  ]);
  await t.run(async ctx => {
    expect((await ctx.db.get(ids.personal))?.weekPattern).toBeUndefined();
    expect((await ctx.db.get(ids.department))?.weekPattern).toEqual([]);
  });
  expect(await t.mutation(internal.migrations.backfillWeeklyWorkingDays, { dryRun: false })).toEqual({ ...preview, updated: 2 });
  await t.run(async ctx => {
    for (const id of [ids.personal, ids.department]) expect(await ctx.db.get(id))
      .toMatchObject({ updatedAt: "priority", weekPattern: ["MON", "TUE", "WED", "THU", "FRI"] });
  });
  for (const dryRun of [true, false]) expect(await t.mutation(internal.migrations.backfillWeeklyWorkingDays, { dryRun }))
    .toEqual({ scanned: 5, wouldUpdate: 0, updated: 0, rows: [] });
});

it("snapshots project weekday names in canonical code order and defaults missing/invalid settings", async () => {
  const t = convexTest(schema, import.meta.glob("./**/*.ts"));
  await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "Custom" });
    const shiftId = await ctx.db.insert("shifts", { name: "Day", startTime: "09:00", endTime: "17:00", createdAt: "", updatedAt: "" });
    const employeeId = await ctx.db.insert("employees", { firstName: "Ada", lastName: "Test", email: "a@test", cardNumber: "1" });
    const settingsId = await ctx.db.insert("generalSettings", { projectId, companyName: "Custom", workingDays: ["Pazar", "Çarşamba", "Pazartesi", "Pazar"], createdAt: "", updatedAt: "" });
    const values = { employeeId, shiftId, startDate: "2026-01-01", endDate: "2026-12-31", createdAt: "", updatedAt: "unchanged" };
    await ctx.db.insert("shiftAssignments", { ...values, projectId });
    await ctx.db.insert("shiftAssignments", values);
    const preview = await ctx.runMutation(internal.migrations.backfillWeeklyWorkingDays, { dryRun: true });
    expect(preview.rows.find(row => row.projectId === projectId)?.weekPattern).toEqual(["MON", "WED", "SUN"]);
    expect(preview.rows.find(row => row.projectId === null)?.weekPattern).toEqual(["MON", "TUE", "WED", "THU", "FRI"]);
    for (const workingDays of [[], ["invalid"]]) {
      await ctx.db.patch(settingsId, { workingDays });
      const fallback = await ctx.runMutation(internal.migrations.backfillWeeklyWorkingDays, { dryRun: true });
      expect(fallback.rows.every(row => row.weekPattern.join() === "MON,TUE,WED,THU,FRI")).toBe(true);
    }
  });
});
