// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import schema from "../schema";
import { loadAttendanceReport, loadRuleReportDays } from "./reportAttendance";
import { flexibleReportProjects } from "./reportScope";

it("a plain weekly assignment keeps legacy report discovery and has no attendance calendar warning", async () => {
  const t = convexTest(schema, import.meta.glob("../**/*.ts"));
  await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "Weekly" });
    const shiftId = await ctx.db.insert("shifts", { projectId, name: "Saturday", startTime: "09:00", endTime: "17:00", createdAt: "", updatedAt: "" });
    const employeeId = await ctx.db.insert("employees", { projectId, firstName: "Ada", lastName: "Test", email: "a@test", cardNumber: "1", isActive: true });
    await ctx.db.insert("shiftAssignments", { projectId, employeeId, shiftId, weekPattern: ["SAT"], startDate: "2026-06-01", endDate: "2026-06-30", createdAt: "", updatedAt: "" });
    expect(await ctx.db.query("shiftPlanRefs").collect()).toEqual([]);
    expect(await flexibleReportProjects(ctx, [projectId], "2026-06-22", "2026-06-28")).toEqual(new Set());
    const managed = await loadRuleReportDays(ctx, [projectId], "2026-06-22", "2026-06-28");
    expect(managed.ruleRows.size).toBe(0);
    const report = await loadAttendanceReport(ctx, [projectId], 2026, 6);
    expect(report.rows[0]).toMatchObject({ reliabilityNote: "", expectedDays: 0, absentDays: 0 });
  });
});
