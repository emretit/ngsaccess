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
    return { projectId, foreignId, userId, sessionId, employeeId };
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
        for (const hour of [8, 8 + hours]) await ctx.db.insert("cardReadings", { projectId: ids.projectId, employeeId: ids.employeeId, cardNo: "123", accessStatus: "izin_verildi", accessTime: `${date}T${String(hour).padStart(2, "0")}:00:00+03:00` });
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
    expect(report.rows[0]).toMatchObject({ calismaGunu: 1, toplamSaat: 10, fazlaMesaiSaat: 2 });
    const after = await caller.query(api.sgkExport.buildAphbForMonth, args);
    const days = (xml: string) => Number(/<calismaGunu>(\d+)<\/calismaGunu>/.exec(xml)?.[1]);
    expect(days(after.xml) - days(before.xml)).toBe(1);
    expect(after.xml).toContain("<fazlaMesaiSaati>2.0</fazlaMesaiSaati>");
  });
  it("1000 manuel kayıt bütçesini aşınca eksik sonuç yerine açık hata verir", async () => {
    const { t, ids } = await fixture();
    await t.run(async ctx => {
      for (let i = 0; i < 1001; i++) await ctx.db.insert("pdksRecords", { projectId: ids.projectId, employeeId: ids.employeeId, employeeFirstName: "Test", employeeLastName: "Kişi", date: "2026-06-01", manualEntry: true, status: "present", createdAt: "", updatedAt: "" });
    });
    await expect(t.run(ctx => loadRuleReportDays(ctx, [ids.projectId], "2026-06-01", "2026-06-30"))).rejects.toThrow("Rapor manuel kayıt sınırı aşıldı");
  });
  it.each([
    ["22:00", "06:00", undefined, 8, 0],
    ["08:00", undefined, "exit", 9, 1],
    ["08:00", undefined, "entry", 0, 0],
  ] as const)("manuel %s–%s ve ham %s legacy SGK/APHB'ye doğru yansır", async (entryTime, exitTime, direction, hours, overtime) => {
    const { t, ids, caller } = await fixture();
    const args = { projectId: ids.projectId, year: 2026, month: 6 };
    const before = await caller.query(api.sgkExport.buildAphbForMonth, args);
    await t.run(async ctx => {
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
