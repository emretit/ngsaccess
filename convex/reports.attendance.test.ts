// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { loadRuleReportDays } from "./lib/reportAttendance";
import { APHB_DRAFT_WARNING } from "./lib/sgkCodes";
const modules = import.meta.glob("./**/*.ts");

async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "Legacy" });
    const foreignId = await ctx.db.insert("projects", { name: "Diğer" });
    const userId = await ctx.db.insert("users", { role: "project_admin" });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 86400000 });
    await ctx.db.insert("userProjects", { userId, projectId });
    const employeeId = await ctx.db.insert("employees", { projectId, firstName: "Test", lastName: "Kişi", email: "test@example.com", cardNumber: "123", isActive: true, tcNo: "11111111111", hourlyRate: 100 });
    const datedShiftId = await ctx.db.insert("shifts", { projectId, name: "Plan", startTime: "09:00", endTime: "18:00", createdAt: "", updatedAt: "" });
    await ctx.db.insert("shiftAssignments", { projectId, employeeId, shiftId: datedShiftId, startDate: "2026-01-01", endDate: "2026-12-31", createdAt: "", updatedAt: "" });
    return { projectId, foreignId, userId, sessionId, employeeId, datedShiftId };
  });
  const caller = t.withIdentity({ subject: `${ids.userId}|${ids.sessionId}` });
  return { t, ids, caller };
}

describe("legacy SGK/APHB ortak manuel ve haftalık hesap", () => {
  it.each([40, 50])("4 hafta; ilk hafta %i saat: üç rapor ve APHB aynı fazla mesaiyi verir", async firstWeekHours => {
    const { t, ids, caller } = await fixture();
    await t.run(async ctx => {
      for (let i = 0; i < 20; i++) {
        const date = new Date(Date.UTC(2026, 5, 1 + Math.floor(i / 5) * 7 + i % 5)).toISOString().slice(0, 10);
        const hours = i < 5 ? firstWeekHours / 5 : 8;
        // Keep the original 40/50 NET-hour scenario: each shift includes one hour of break.
        for (const hour of [8, 8 + hours + 1]) await ctx.db.insert("cardReadings", { projectId: ids.projectId, employeeId: ids.employeeId, cardNo: "123", accessStatus: "izin_verildi", accessTime: `${date}T${String(hour).padStart(2, "0")}:00:00+03:00` });
      }
    });
    const args = { projectId: ids.projectId, year: 2026, month: 6 };
    const expected = firstWeekHours === 50 ? 5 : 0;
    const summary = await caller.query(api.reports.getSgkMonthlyReport, args);
    expect(summary.rows[0]).toMatchObject({ calismaGunu: 20, toplamSaat: firstWeekHours + 120, fazlaMesaiSaat: expected });
    expect((await caller.query(api.reports.getOvertimeSummaryReport, args)).totalOvertimeHours).toBe(expected);
    const department = await caller.query(api.reports.getDepartmentCostReport, args);
    expect(department.rows.reduce((sum, row) => sum + row.overtimeHours, 0)).toBe(expected);
    const aphb = await caller.query(api.sgkExport.buildAphbForMonth, args);
    expect(aphb.xml).toContain(`<fazlaMesaiSaati>${expected.toFixed(1)}</fazlaMesaiSaati>`);
    expect(aphb.xml).toContain(APHB_DRAFT_WARNING);
    expect(aphb.warnings).toContain(APHB_DRAFT_WARNING);
    expect(aphb.filename).toBe("aphb-taslak-resmi-sgk-formati-degildir-2026-06.xml");
  });
  it("yalnız manuel legacy gün raporda ve APHB prim gününde yer alır; yabancı proje kaydı sayılmaz", async () => {
    const { t, ids, caller } = await fixture();
    const args = { projectId: ids.projectId, year: 2026, month: 6 };
    const before = await caller.query(api.sgkExport.buildAphbForMonth, args);
    await t.run(async ctx => {
      for (const [projectId, date, exitTime] of [[ids.projectId, "2026-06-01", "18:00"], [ids.foreignId, "2026-06-02", "23:00"]] as const) {
        await ctx.db.insert("pdksRecords", { projectId, employeeId: ids.employeeId, employeeFirstName: "Test", employeeLastName: "Kişi", date, entryTime: "08:00", exitTime, manualEntry: true, status: "present", createdAt: "", updatedAt: "" });
      }
    });
    const report = await caller.query(api.reports.getSgkMonthlyReport, args);
    expect(report.rows).toHaveLength(1);
    expect(report.rows[0]).toMatchObject({ calismaGunu: 1, toplamSaat: 9, fazlaMesaiSaat: 0 });
    const after = await caller.query(api.sgkExport.buildAphbForMonth, args);
    const days = (xml: string) => Number(/<calismaGunu>(\d+)<\/calismaGunu>/.exec(xml)?.[1]);
    expect(days(after.xml) - days(before.xml)).toBe(1);
    // 10 raw hours - 1 break hour; weekly45 does not grant daily 8-hour overtime.
    expect(after.xml).toContain("<fazlaMesaiSaati>0.0</fazlaMesaiSaati>");
  });
  it("1000 manuel kayıt bütçesini aşınca eksik sonuç yerine açık hata verir", async () => {
    const { t, ids } = await fixture();
    await t.run(async ctx => {
      for (let i = 0; i < 1001; i++) await ctx.db.insert("pdksRecords", { projectId: ids.projectId, employeeId: ids.employeeId, employeeFirstName: "Test", employeeLastName: "Kişi", date: "2026-06-01", manualEntry: true, status: "present", createdAt: "", updatedAt: "" });
    });
    await expect(t.run(ctx => loadRuleReportDays(ctx, [ids.projectId], "2026-06-01", "2026-06-30"))).rejects.toThrow("Rapor manuel kayıt sınırı aşıldı");
  });
  it.each([
    ["22:00", "06:00", undefined, 7, 0],
    ["08:00", undefined, "exit", 8, 0],
    ["08:00", undefined, "entry", 0, 0],
  ] as const)("manuel %s–%s ve ham %s legacy SGK/APHB'ye doğru yansır", async (entryTime, exitTime, direction, hours, overtime) => {
    const { t, ids, caller } = await fixture();
    const args = { projectId: ids.projectId, year: 2026, month: 6 };
    const before = await caller.query(api.sgkExport.buildAphbForMonth, args);
    await t.run(async ctx => {
      // Overnight manual endpoints follow the assigned shift, as they do in payroll.
      if (exitTime === "06:00") await ctx.db.patch(ids.datedShiftId, { startTime: "22:00", endTime: "06:00" });
      await ctx.db.insert("pdksRecords", { projectId: ids.projectId, employeeId: ids.employeeId, employeeFirstName: "Test", employeeLastName: "Kişi", date: "2026-06-01", entryTime, exitTime, manualEntry: true, status: "present", createdAt: "", updatedAt: "" });
      if (direction) await ctx.db.insert("cardReadings", { projectId: ids.projectId, employeeId: ids.employeeId, cardNo: "123", accessStatus: "izin_verildi", direction, accessTime: "2026-06-01T14:00:00Z" });
    });
    const report = await caller.query(api.reports.getSgkMonthlyReport, args);
    expect(report.rows[0]).toMatchObject({ calismaGunu: 1, toplamSaat: hours, fazlaMesaiSaat: overtime });
    const aphb = await caller.query(api.sgkExport.buildAphbForMonth, args);
    const days = (xml: string) => Number(/<calismaGunu>(\d+)<\/calismaGunu>/.exec(xml)?.[1]);
    expect(days(aphb.xml) - days(before.xml)).toBe(1);
    expect(aphb.xml).toContain(`<fazlaMesaiSaati>${overtime.toFixed(1)}</fazlaMesaiSaati>`);
  });
});


it("RAP-001: 100 TL saat ücreti ve 60 net dakika tatil mesaisi tüm çıktılarda 200 TL", async () => {
  const { t, ids, caller } = await fixture();
  await t.run(async ctx => {
    await ctx.db.patch(ids.datedShiftId, { minWorkMinutes: 0 });
    await ctx.db.insert("holidays", { projectId: ids.projectId, date: "2026-06-01", name: "Tatil", createdAt: "" });
    // 75 raw minutes minus the engine's 15-minute statutory break = 60 net minutes.
    for (const [time, direction] of [["09:00", "entry"], ["10:15", "exit"]] as const) await ctx.db.insert("cardReadings", { projectId: ids.projectId, employeeId: ids.employeeId, cardNo: "123", accessStatus: "izin_verildi", direction, accessTime: `2026-06-01T${time}:00+03:00` });
  });
  const args = { projectId: ids.projectId, year: 2026, month: 6 };
  const payroll = await caller.query(api.cardReadings.getMonthlyPayrollSheet, args);
  expect(payroll.rows[0].totals).toMatchObject({ overtimeMinutes: 60, overtimePayTRY: 200 });
  expect((await caller.query(api.reports.getOvertimeSummaryReport, args)).rows[0]).toMatchObject({ overtimeHours: 1, overtimePayTRY: 200 });
  expect((await caller.query(api.reports.getDepartmentCostReport, args)).rows[0]).toMatchObject({ overtimeHours: 1, cost: 200 });
});

it("RAP-001: tatil ve gece ağırlığı ile departman yedek ücreti korunur", async () => {
  const { t, ids, caller } = await fixture();
  await t.run(async ctx => {
    await ctx.db.patch(ids.datedShiftId, { startTime: "22:00", endTime: "23:15", minWorkMinutes: 0 });
    await ctx.db.insert("overtimeRates", { projectId: ids.projectId, weekdayMultiplier: 1.5, weekendMultiplier: 2, holidayMultiplier: 2, nightShiftMultiplier: 3, nightShiftStart: "22:00", nightShiftEnd: "06:00", nightCombineMode: "multiply", overtimeBasis: "weekly45", updatedAt: "" });
    await ctx.db.insert("holidays", { projectId: ids.projectId, date: "2026-06-01", name: "Tatil", createdAt: "" });
    for (const [time, direction] of [["22:00", "entry"], ["23:15", "exit"]] as const) await ctx.db.insert("cardReadings", { projectId: ids.projectId, employeeId: ids.employeeId, cardNo: "123", accessStatus: "izin_verildi", direction, accessTime: `2026-06-01T${time}:00+03:00` });
  });
  const args = { projectId: ids.projectId, year: 2026, month: 6 };
  expect((await caller.query(api.cardReadings.getMonthlyPayrollSheet, args)).rows[0].totals).toMatchObject({ overtimeMinutes: 60, overtimePayTRY: 600 });
  expect((await caller.query(api.reports.getOvertimeSummaryReport, args)).rows[0].overtimePayTRY).toBe(600);
  expect((await caller.query(api.reports.getDepartmentCostReport, args)).rows[0].cost).toBe(600);
  await t.run(ctx => ctx.db.patch(ids.employeeId, { hourlyRate: undefined }));
  expect((await caller.query(api.reports.getOvertimeSummaryReport, args)).rows[0].overtimePayTRY).toBeNull();
  expect((await caller.query(api.reports.getDepartmentCostReport, { ...args, hourlyRate: 50 })).rows[0].cost).toBe(300);
});

it.each(["manual", "readings"] as const)("RAP-002: ay öncesi hafta bağlamı ve yıllık hesap aynı net mesaiyi taşır (%s)", async source => {
  const { t, ids, caller } = await fixture();
  await t.run(async ctx => {
    for (const date of ["2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02"]) {
      // Each manual day is 11 raw hours minus one break: 50 net hours in this week.
      if (source === "manual") {
      await ctx.db.insert("pdksRecords", { projectId: ids.projectId, employeeId: ids.employeeId, employeeFirstName: "Test", employeeLastName: "Kişi", date, entryTime: "08:00", exitTime: "19:00", manualEntry: true, status: "present", createdAt: "", updatedAt: "" });
      } else {
        for (const [time, direction] of [["08:00", "entry"], ["19:00", "exit"]] as const) await ctx.db.insert("cardReadings", { projectId: ids.projectId, employeeId: ids.employeeId, cardNo: "123", accessStatus: "izin_verildi", direction, accessTime: `${date}T${time}:00+03:00` });
      }
    }
  });
  const args = { projectId: ids.projectId, year: 2026, month: 10 };
  expect((await caller.query(api.cardReadings.getMonthlyPayrollSheet, args)).rows[0].totals).toMatchObject({ totalMinutes: 1200, overtimeMinutes: 300, overtimePayTRY: 750 });
  expect((await caller.query(api.reports.getSgkMonthlyReport, args)).rows[0]).toMatchObject({ toplamSaat: 20, fazlaMesaiSaat: 5 });
  expect((await caller.query(api.reports.getOvertimeSummaryReport, args)).rows[0]).toMatchObject({ overtimeHours: 5, overtimePayTRY: 750 });
  expect((await caller.query(api.reports.getDepartmentCostReport, args)).rows[0]).toMatchObject({ overtimeHours: 5, cost: 750 });
  expect((await caller.query(api.sgkExport.buildAphbForMonth, args)).xml).toContain("<fazlaMesaiSaati>5.0</fazlaMesaiSaati>");
  expect((await caller.query(api.reports.getOvertimeSummaryReport, { projectId: ids.projectId, year: 2026 })).rows[0]).toMatchObject({ overtimeHours: 5, overtimePayTRY: 750 });
});
