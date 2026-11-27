// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { expect, it } from "vitest";
import { convexTest } from "convex-test";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { annualOvertimeRanges } from "./dashboard";
import { pdksReadBudget, readBoundedPdks } from "./lib/pdksTableQuery";

it("E1: weeks partition the entire year without splitting an ISO week", () => {
  const ranges = annualOvertimeRanges(2026);
  expect(ranges[0]?.startDate).toBe("2026-01-01");
  expect(ranges[ranges.length - 1]?.endDate).toBe("2026-12-31");
  expect(ranges).toHaveLength(53);
  for (const range of ranges) {
    expect((Date.parse(range.endDate) - Date.parse(range.startDate)) / 86400000).toBeLessThan(7);
    if (range.endDate !== "2026-12-31") expect(new Date(range.endDate).getUTCDay()).toBe(0);
  }
});
it.each(["E1", "E2", "E3", "E4", "E5", "D7"])("%s: 40,000 rows stop at a transaction-wide 31,001 reads", async () => {
  let reads = 0;
  async function* rows(count: number) {
    for (let i = 0; i < count; i++) { reads++; yield { value: i }; }
  }
  const budget = pdksReadBudget();
  await readBoundedPdks(rows(1000), budget);
  await expect(readBoundedPdks(rows(40000), budget)).rejects.toThrow("Okuma sınırı");
  expect(reads).toBe(31001);
});
it("E4: byte budget stops large raw readings before 16 MiB", async () => {
  let reads = 0;
  async function* rows() {
    for (let i = 0; i < 40000; i++) { reads++; yield { rawData: "x".repeat(512 * 1024) }; }
  }
  await expect(readBoundedPdks(rows())).rejects.toThrow("Okuma sınırı");
  expect(reads).toBe(30);
});
it("E1: weekly action equals the original single-range calculation including Sunday and year edges", async () => {
  const t = convexTest(schema, import.meta.glob("./**/*.ts"));
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "Scoped" });
    const userId = await ctx.db.insert("users", { role: "super_admin", verified: true });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 86400000 });
    const shiftId = await ctx.db.insert("shifts", { projectId, name: "Day", startTime: "08:00", endTime: "17:00", createdAt: "", updatedAt: "" });
    const employeeId = await ctx.db.insert("employees", { projectId, shiftId, firstName: "Ada", lastName: "Test", email: "ada@example.test", cardNumber: "1", isActive: true });
    for (const date of ["2026-01-01", "2026-06-22", "2026-06-23", "2026-06-24", "2026-06-25", "2026-06-26", "2026-06-27", "2026-06-28", "2026-06-29", "2026-12-31"]) {
      for (const [time, direction] of [["05:00", "entry"], ["18:00", "exit"]] as const) await ctx.db.insert("cardReadings", { projectId, employeeId, cardNo: "1", accessStatus: "izin_verildi", accessTime: `${date}T${time}:00.000Z`, direction });
    }
    return { projectId, userId, sessionId };
  });
  const user = t.withIdentity({ subject: `${ids.userId}|${ids.sessionId}` });
  const expected = await user.query(internal.dashboard.annualOvertimePart, { projectId: ids.projectId, year: 2026, startDate: "2026-01-01", endDate: "2026-12-31" });
  expect(await user.action(api.dashboard.getAnnualOvertimeBalance, { projectId: ids.projectId, year: 2026 })).toEqual(expected);
});

it("E2/E3/E5: old readings and another tenant's leaves/departments do not consume the scope budget", async () => {
  const t = convexTest(schema, import.meta.glob("./**/*.ts"));
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "Visible" });
    const otherId = await ctx.db.insert("projects", { name: "Hidden" });
    const userId = await ctx.db.insert("users", { role: "project_admin", verified: true });
    const adminId = await ctx.db.insert("users", { role: "super_admin", verified: true });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 86400000 });
    const adminSessionId = await ctx.db.insert("authSessions", { userId: adminId, expirationTime: Date.now() + 86400000 });
    await ctx.db.insert("userProjects", { userId, projectId });
    const employeeId = await ctx.db.insert("employees", { projectId, firstName: "Ada", lastName: "Test", email: "test@example.test", cardNumber: "1", isActive: true });
    return { projectId, otherId, employeeId, userId, sessionId, adminId, adminSessionId };
  });
  // Any full-history scan or full-tenant leave/department scan exceeds the shared budget.
  await t.run(async ctx => {
    for (let i = 0; i < 4100; i++) {
      await ctx.db.insert("cardReadings", { projectId: ids.projectId, cardNo: "1", accessTime: "2020-01-01T00:00:00Z", rawData: "x".repeat(4096) });
      await ctx.db.insert("departments", { projectId: ids.otherId, name: `Other ${i}` });
      await ctx.db.insert("leaves", { projectId: ids.otherId, employeeId: ids.employeeId, leaveType: "annual", status: "approved", startDate: "2020-01-01", endDate: "2020-01-02", createdAt: "", updatedAt: "" });
    }
  });
  const member = t.withIdentity({ subject: `${ids.userId}|${ids.sessionId}` });
  const admin = t.withIdentity({ subject: `${ids.adminId}|${ids.adminSessionId}` });
  await expect(member.query(api.dashboard.getActivitySummary, {})).resolves.toMatchObject({ presentToday: null });
  await expect(admin.query(api.dashboard.getActivitySummary, {})).resolves.toMatchObject({ presentToday: null });
});
it("D7: no-range history preserves 4,001 assignments that previously worked", async () => {
  const t = convexTest(schema, import.meta.glob("./**/*.ts"));
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "History" });
    const userId = await ctx.db.insert("users", { role: "super_admin", verified: true });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 86400000 });
    const shiftId = await ctx.db.insert("shifts", { projectId, name: "Day", startTime: "08:00", endTime: "17:00", createdAt: "", updatedAt: "" });
    const employeeId = await ctx.db.insert("employees", { projectId, firstName: "Ada", lastName: "Test", email: "test@example.test", cardNumber: "1", isActive: true });
    for (let i = 0; i < 4001; i++) await ctx.db.insert("shiftAssignments", { projectId, employeeId, shiftId, startDate: "2020-01-01", endDate: "2020-01-02", createdAt: "", updatedAt: "" });
    return { projectId, userId, sessionId };
  });
  await expect(t.withIdentity({ subject: `${ids.userId}|${ids.sessionId}` }).query(api.shifts.listAssignments, { projectId: ids.projectId })).resolves.toHaveLength(4001);
});
