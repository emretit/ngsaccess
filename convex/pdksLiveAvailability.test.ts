// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import schema from "./schema";
import { pdksBatchRefs, loadPdksTable, loadPdksPayroll } from "../src/lib/pdksBatches";
import { convexTestClient } from "../src/test-utils/convexClient";
import { isPdksIncludedReading } from "./lib/pdksSource";
import { trDayRangeISO } from "./lib/trDate";

const modules = import.meta.glob("./**/*.ts");
const date = "2026-11-27";
async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "Availability" });
    const otherProjectId = await ctx.db.insert("projects", { name: "Other" });
    const userId = await ctx.db.insert("users", { role: "super_admin", verified: true });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 86400000 });
    const shiftId = await ctx.db.insert("shifts", { projectId, name: "Day", startTime: "08:00", endTime: "17:00", createdAt: "", updatedAt: "" });
    const currentId = await ctx.db.insert("employees", { projectId, shiftId, firstName: "Current", lastName: "Person", email: "current@local.test", cardNumber: "current", isActive: true });
    const formerId = await ctx.db.insert("employees", { projectId, shiftId, firstName: "Former", lastName: "Person", email: "former@local.test", cardNumber: "former", isActive: false, employmentEndDate: "2026-11-26" });
    for (const employeeId of [currentId, formerId]) await ctx.db.insert("shiftAssignments", { projectId, employeeId, shiftId, startDate: "2026-11-01", endDate: "2026-11-30", createdAt: "", updatedAt: "" });
    for (const [time, direction] of [["05:00", "entry"], ["14:00", "exit"]] as const) await ctx.db.insert("cardReadings", { projectId, employeeId: currentId, cardNo: "current", accessTime: `2026-11-26T${time}:00Z`, accessStatus: "izin_verildi", direction });
    return { projectId, otherProjectId, userId, sessionId, currentId, formerId };
  });
  const user = t.withIdentity({ subject: `${ids.userId}|${ids.sessionId}` });
  const roster = [{ employeeId: ids.currentId, cardNumber: "current" }];
  return { t, user, ids, roster };
}

it("matches the former full-day scan for extant project employees and unlinked badges", async () => {
  const { t, user, ids, roster } = await fixture();
  const base = { projectId: ids.projectId, accessTime: `${date}T08:00:00Z`, accessStatus: "izin_verildi" as const, direction: "entry" as const };
  const cases = [
    { ...base, employeeId: ids.currentId, cardNo: "current" },
    { ...base, employeeId: ids.formerId, cardNo: "former" },
    { ...base, employeeId: ids.formerId, cardNo: "current" },
    { ...base, cardNo: "unlinked" },
    { ...base, cardNo: "current" },
    { ...base, employeeId: ids.formerId, cardNo: "former", accessTime: "2026-11-26T08:00:00Z" },
    { ...base, employeeId: ids.formerId, cardNo: "former", accessTime: "2026-11-26T22:00:00Z" },
    { ...base, employeeId: ids.formerId, cardNo: "former", accessTime: "2026-11-27T22:00:00Z" },
    { ...base, employeeId: ids.formerId, cardNo: "former", hikDevIndex: "unproven-hik-event" },
  ];
  for (const reading of cases) {
    const readingId = await t.run(ctx => ctx.db.insert("cardReadings", reading));
    const legacy = await t.run(async ctx => {
      const { startISO, endISO } = trDayRangeISO(date, date);
      for await (const row of ctx.db.query("cardReadings").withIndex("by_project_access_time", q => q.eq("projectId", ids.projectId).gte("accessTime", startISO).lte("accessTime", endISO))) {
        if (row.employeeId === ids.currentId || row.cardNo === "current") continue;
        if (isPdksIncludedReading(row, ids.projectId)) return [date];
      }
      return [];
    });
    expect(await user.query(pdksBatchRefs.todayAvailability, { projectId: ids.projectId, date, roster })).toEqual(legacy);
    await t.run(ctx => ctx.db.delete(readingId));
  }
});

it.each(["deleted", "moved"])("%s employee's same-day reading stops contributing only to the live hint", async disposition => {
  const { t, user, ids, roster } = await fixture();
  const readingId = await t.run(ctx => ctx.db.insert("cardReadings", { projectId: ids.projectId, employeeId: ids.formerId, cardNo: "former", accessTime: `${date}T08:00:00Z`, accessStatus: "izin_verildi", direction: "entry" }));
  const client = convexTestClient(user);
  const args = { projectId: ids.projectId, date, viewMode: "matrix" as const };
  const tableBefore = await loadPdksTable(client, args);
  const payrollBefore = await loadPdksPayroll(client, { projectId: ids.projectId, year: 2026, month: 11 });
  expect(await user.query(pdksBatchRefs.todayAvailability, { projectId: ids.projectId, date, roster })).toEqual([date]);
  await t.run(ctx => disposition === "deleted" ? ctx.db.delete(ids.formerId) : ctx.db.patch(ids.formerId, { projectId: ids.otherProjectId }));
  expect(await user.query(pdksBatchRefs.todayAvailability, { projectId: ids.projectId, date, roster })).toEqual([]);
  // The original source endpoint still carries orphan/moved linked readings.
  const source = await user.query(pdksBatchRefs.dates, { request: { kind: "table", args }, roster, cursor: null });
  expect(source.readings.some(reading => reading._id === readingId && reading.unassignedDate === date)).toBe(true);
  const tableAfter = await loadPdksTable(client, args);
  const payrollAfter = await loadPdksPayroll(client, { projectId: ids.projectId, year: 2026, month: 11 });
  expect(tableAfter).toEqual(tableBefore);
  expect(tableAfter.find(row => row.id === ids.currentId)?.days[0].status).toBe("absent");
  expect(payrollAfter.rows.find(row => row.employeeId === ids.currentId)).toEqual(payrollBefore.rows.find(row => row.employeeId === ids.currentId));
});
