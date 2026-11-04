// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

it("6: SGK excludes cycle Wednesday rest and unassigned dates, while absent Monday reduces premium days", async () => {
  const t = convexTest(schema, import.meta.glob("./**/*.ts"));
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "SGK" });
    const userId = await ctx.db.insert("users", { role: "super_admin" });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 86400000 });
    const shiftId = await ctx.db.insert("shifts", { projectId, name: "Day", startTime: "09:00", endTime: "17:00", createdAt: "", updatedAt: "" });
    const employeeId = await ctx.db.insert("employees", { projectId, firstName: "Ada", lastName: "Test", email: "a@test", cardNumber: "1", isActive: true });
    await ctx.db.insert("shiftAssignments", { projectId, employeeId, shiftId, startDate: "2026-06-01", endDate: "2026-06-03", plan: { kind: "dayCycle", anchorDate: "2026-06-01", slots: [[shiftId], [shiftId], []] }, createdAt: "", updatedAt: "" });
    for (const [time, direction] of [["09:00", "entry"], ["17:00", "exit"]] as const) await ctx.db.insert("cardReadings", { projectId, employeeId, cardNo: "1", accessStatus: "izin_verildi", direction, accessTime: `2026-06-02T${time}:00+03:00` });
    return { projectId, userId, sessionId };
  });
  const caller = t.withIdentity({ subject: `${ids.userId}|${ids.sessionId}` });
  const report = await caller.query(api.sgkExport.buildAphbForMonth, { projectId: ids.projectId, year: 2026, month: 6 });
  expect(report.xml).toContain("<eksikGunSayisi>1</eksikGunSayisi>");
  expect(report.xml).toContain("<eksikGunNedeni>15</eksikGunNedeni>");
  expect(report.xml).toContain("<calismaGunu>29</calismaGunu>");
  expect(report.warnings.some(warning => warning.includes("27 gün vardiya atanmamış"))).toBe(true);
  await t.run(ctx => ctx.db.insert("holidays", { projectId: ids.projectId, date: "2026-06-01", name: "Holiday", createdAt: "" }));
  const holiday = await caller.query(api.sgkExport.buildAphbForMonth, { projectId: ids.projectId, year: 2026, month: 6 });
  expect(holiday.xml).toContain("<eksikGunSayisi>0</eksikGunSayisi>");
});
