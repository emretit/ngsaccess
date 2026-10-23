// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";

const date = "2026-06-22";
const next = "2026-06-23";
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(`${date}T16:00:00Z`)); });
afterEach(() => vi.useRealTimers());
async function fixture(patch: Partial<Doc<"shifts">> = {}) {
  const t = convexTest(schema, import.meta.glob("./**/*.ts"));
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "Sabit kurallar" });
    const userId = await ctx.db.insert("users", { role: "project_admin" });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 86400000 });
    await ctx.db.insert("userProjects", { userId, projectId });
    const shiftId = await ctx.db.insert("shifts", { projectId, name: "Sabit", startTime: "09:00", endTime: "17:00", minWorkMinutes: 500, createdAt: "", updatedAt: "", ...patch });
    const employeeId = await ctx.db.insert("employees", { projectId, shiftId, firstName: "Ada", lastName: "Test", email: "fixed@example.test", cardNumber: "1", isActive: true });
    await ctx.db.insert("employeeAuth", { employeeId, passwordHash: "fixture", passwordVersion: 1, createdAt: "", updatedAt: "" });
    await ctx.db.insert("employeeSessions", { employeeId, token: "fixed-session", passwordVersion: 1, expiresAt: "2099-01-01T00:00:00Z", createdAt: "" });
    return { projectId, employeeId, shiftId, userId, sessionId };
  });
  const caller = t.withIdentity({ subject: `${ids.userId}|${ids.sessionId}` });
  const add = (time: string, direction: "entry" | "exit", day = date) => t.run(ctx => ctx.db.insert("cardReadings", {
    projectId: ids.projectId, employeeId: ids.employeeId, cardNo: "1", accessTime: new Date(`${day}T${time}:00+03:00`).toISOString(), accessStatus: "izin_verildi", direction,
  }));
  return { t, caller, add, ...ids };
}
it("fixed minimum and late rules agree across dashboard and mobile under a legacy policy", async () => {
  const f = await fixture();
  await f.add("09:00", "entry");
  await f.add("17:00", "exit");
  const summary = () => f.t.query(api.mobileAttendance.summary, { sessionToken: "fixed-session", startDate: date, endDate: date });
  const dashboard = () => f.caller.query(api.dashboard.getActivitySummary, { projectId: f.projectId });
  expect((await summary()).totals.presentDays).toBe(0);
  expect(await dashboard()).toMatchObject({ presentToday: 0 });
  await f.t.run(ctx => ctx.db.patch(f.shiftId, { minWorkMinutes: 300 }));
  expect((await summary()).totals.presentDays).toBe(1);
  expect(await dashboard()).toMatchObject({ presentToday: 1 });
});
it("detail and mobile attribute an extended fixed night exit to the preceding work day", async () => {
  vi.setSystemTime(new Date(`${next}T16:00:00Z`));
  const f = await fixture({ startTime: "22:00", endTime: "06:00", minWorkMinutes: undefined,
    validWindow: { checkInStart: "21:00", checkInEnd: "23:00", checkOutStart: "05:00", checkOutEnd: "15:00", checkOutEndDayOffset: 1 } });
  await f.add("22:00", "entry");
  await f.add("15:00", "exit", next);
  const detail = await f.caller.query(api.cardReadings.getEmployeeAttendanceDetail, { projectId: f.projectId, employeeId: f.employeeId, startDate: date, endDate: next });
  expect(detail?.days.find(day => day.date === date)).toMatchObject({ firstEntry: "22:00", lastExit: "15:00", exitNextDay: true, durationMeasured: true });
  const mobile = await f.t.query(api.mobileAttendance.summary, { sessionToken: "fixed-session", startDate: date, endDate: next });
  expect(mobile.totals.presentDays).toBe(1);
});
