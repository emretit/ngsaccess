// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { loadPdksRulePolicy } from "./lib/pdksRules";
const modules = import.meta.glob("./**/*.ts");
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-22T12:00:00Z")); });
afterEach(() => vi.useRealTimers());
async function fixture(role: "project_admin" | "project_user" | "super_admin" = "project_admin") {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "A" });
    const foreignId = await ctx.db.insert("projects", { name: "B" });
    const userId = await ctx.db.insert("users", { role });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 100 * 86400000 });
    await ctx.db.insert("userProjects", { userId, projectId });
    const shiftId = await ctx.db.insert("shifts", { projectId, name: "Gündüz", startTime: "08:00", endTime: "17:00", createdAt: "", updatedAt: "" });
    const employeeId = await ctx.db.insert("employees", { projectId, firstName: "Ada", lastName: "Test", email: "ada@test", cardNumber: "123", isActive: true, shiftId });
    const deviceId = await ctx.db.insert("devices", { projectId, name: "IDE", brand: "ide_smart", createdAt: "", updatedAt: "" });
    const doorId = await ctx.db.insert("doors", { projectId, name: "Dış kapı", deviceId, ioId: 2 });
    const otherDevice = await ctx.db.insert("devices", { projectId: foreignId, name: "Başka", createdAt: "", updatedAt: "" });
    return { projectId, foreignId, userId, sessionId, employeeId, shiftId, deviceId, doorId, otherDevice };
  });
  const caller = t.withIdentity({ subject: `${ids.userId}|${ids.sessionId}` });
  const args = { projectId: ids.projectId, effectiveFrom: "2026-10-23", punchMode: "requirements" as const, requireCheckIn: true, requireCheckOut: true, missingRequiredPunch: "review" as const, noPunch: "absent" as const, checkpointMode: "selected" as const, targets: [{ targetType: "door" as const, deviceId: ids.deviceId, doorId: ids.doorId }] };
  return { t, caller, args, ...ids };
}
describe("PDKS sürüm API", () => {
  it("yarından önceyi, geçersiz tarihi, eksik tercihleri ve boş seçimi reddeder", async () => {
    const f = await fixture();
    for (const effectiveFrom of ["2026-10-22", "2026-10-21", "2026-02-30", "2026-13-01", "x"]) await expect(f.caller.mutation(api.pdksRules.publishRuleVersion, { ...f.args, effectiveFrom })).rejects.toThrow();
    await expect(f.caller.mutation(api.pdksRules.publishRuleVersion, { ...f.args, requireCheckOut: undefined })).rejects.toThrow("zorunlu");
    await expect(f.caller.mutation(api.pdksRules.publishRuleVersion, { ...f.args, targets: [] })).rejects.toThrow("En az");
    await expect(f.caller.mutation(api.pdksRules.publishRuleVersion, { ...f.args, targets: Array.from({ length: 501 }, () => f.args.targets[0]) })).rejects.toThrow("500");
  });
  it("yetki, yabancı proje ve yabancı hedef reddi", async () => {
    const user = await fixture("project_user");
    await expect(user.caller.mutation(api.pdksRules.publishRuleVersion, user.args)).rejects.toThrow("yetkiniz");
    const f = await fixture();
    await expect(f.caller.query(api.pdksRules.getRules, { projectId: f.foreignId })).rejects.toThrow("erişim");
    await expect(f.caller.mutation(api.pdksRules.publishRuleVersion, { ...f.args, projectId: f.foreignId })).rejects.toThrow("erişim");
    await expect(f.caller.mutation(api.pdksRules.publishRuleVersion, { ...f.args, targets: [{ targetType: "device", deviceId: f.otherDevice }] })).rejects.toThrow("projeye");
    await expect(f.caller.mutation(api.pdksRules.publishRuleVersion, { ...f.args, targets: [{ targetType: "door", deviceId: f.deviceId, doorId: await f.t.run(ctx => ctx.db.insert("doors", { name: "Yabancı", projectId: f.foreignId, deviceId: f.deviceId, ioId: 1 })) }] })).rejects.toThrow("proje");
  });
  it("aynı gelecek tarihi atomik değiştirir, tek audit yazar, senkron işi başlatmaz", async () => {
    const f = await fixture();
    const id = await f.caller.mutation(api.pdksRules.publishRuleVersion, f.args);
    const replacement = await f.caller.mutation(api.pdksRules.publishRuleVersion, { ...f.args, requireCheckOut: false });
    expect(replacement).toBe(id);
    const rules = await f.caller.query(api.pdksRules.getRules, { projectId: f.projectId });
    expect(rules).toMatchObject({ current: null, history: [], future: [{ _id: id, requireCheckOut: false, targets: [{ ioId: 2 }] }] });
    expect(await f.t.run(ctx => ctx.db.query("pdksRuleVersions").collect())).toHaveLength(1);
    expect(await f.t.run(ctx => ctx.db.query("pdksCheckpointSelections").collect())).toHaveLength(1);
    expect(await f.t.run(ctx => ctx.db.query("auditLog").collect())).toHaveLength(2);
    expect(await f.t.run(ctx => ctx.db.system.query("_scheduled_functions").collect())).toHaveLength(0);
    await f.caller.mutation(api.pdksRules.deleteFutureRuleVersion, { ruleVersionId: id });
    expect(await f.t.run(ctx => ctx.db.query("pdksCheckpointSelections").collect())).toHaveLength(0);
  });
  it("yürürlükteki sürümü silemez/değiştiremez; super_admin yabancı projeye erişir", async () => {
    const f = await fixture("super_admin");
    const id = await f.caller.mutation(api.pdksRules.publishRuleVersion, f.args);
    await f.caller.mutation(api.pdksRules.publishRuleVersion, { ...f.args, projectId: f.foreignId, checkpointMode: "all", targets: [] });
    vi.setSystemTime(new Date("2026-10-23T12:00:00Z"));
    await expect(f.caller.mutation(api.pdksRules.deleteFutureRuleVersion, { ruleVersionId: id })).rejects.toThrow("Yürürlüğe");
    await expect(f.caller.mutation(api.pdksRules.publishRuleVersion, f.args)).rejects.toThrow("yarın");
    expect((await f.caller.query(api.pdksRules.getRules, { projectId: f.projectId })).current?._id).toBe(id);
  });
  it("çok kapılı Hik kapısını reddeder, cihaz hedefini kabul eder; sırları döndürmez", async () => {
    const f = await fixture();
    await f.t.run(async ctx => { await ctx.db.patch(f.deviceId, { brand: "hikvision", doorCount: 2, devicePassword: "SECRET" }); });
    const targets = await f.caller.query(api.pdksRules.listCheckpointTargets, { projectId: f.projectId });
    expect(targets.doors[0]).toMatchObject({ selectable: false, reason: expect.stringContaining("kapı numarası") });
    expect(JSON.stringify(targets)).not.toContain("SECRET");
    await expect(f.caller.mutation(api.pdksRules.publishRuleVersion, f.args)).rejects.toThrow("Çok kapılı");
    await f.caller.mutation(api.pdksRules.publishRuleVersion, { ...f.args, targets: [{ targetType: "device", deviceId: f.deviceId }] });
  });
  it("yükleyici 64 sürüm/500 hedef bütçesini uygular", async () => {
    const f = await fixture();
    await f.t.run(async ctx => {
      for (let i = 0; i < 65; i++) await ctx.db.insert("pdksRuleVersions", { projectId: f.projectId, effectiveFrom: `2026-${String(1 + Math.floor(i / 28)).padStart(2, "0")}-${String(1 + i % 28).padStart(2, "0")}`, punchMode: "legacy", checkpointMode: "all", createdAt: "", createdBy: f.userId });
    });
    await expect(f.t.run(ctx => loadPdksRulePolicy(ctx, f.projectId, "2026-01-01", "2026-12-31"))).rejects.toThrow("64");
    const version = await f.caller.mutation(api.pdksRules.publishRuleVersion, f.args);
    await f.t.run(async ctx => {
      for (let i = 0; i < 500; i++) await ctx.db.insert("pdksCheckpointSelections", { projectId: f.projectId, ruleVersionId: version, targetType: "device", deviceId: f.deviceId });
    });
    await expect(f.t.run(ctx => loadPdksRulePolicy(ctx, f.projectId, "2026-10-23", "2026-10-24"))).rejects.toThrow("500");
  });
  for (const mode of ["missing", "excluded", "manual", "complete", "undirected", "holiday", "ended"] as const) it(`tablo/detay/bordro/rapor/SGK ortak karar: ${mode}`, async () => {
    const f = await fixture();
    await f.caller.mutation(api.pdksRules.publishRuleVersion, f.args);
    await f.t.run(async ctx => {
      if (mode === "ended") await ctx.db.patch(f.employeeId, { employmentEndDate: "2026-10-22", isActive: false });
      if (mode === "holiday") await ctx.db.insert("holidays", { projectId: f.projectId, name: "Tatil", date: "2026-10-23", type: "company", createdAt: "" });
      if (mode === "manual") await ctx.db.insert("pdksRecords", { projectId: f.projectId, employeeId: f.employeeId, date: "2026-10-23", employeeFirstName: "Ada", employeeLastName: "Test", status: "present", createdAt: "", updatedAt: "", entryTime: "08:00", exitTime: "17:00", manualEntry: true });
      await ctx.db.insert("cardReadings", { projectId: f.projectId, employeeId: f.employeeId, cardNo: "123", deviceId: f.deviceId, ideIoId: mode === "excluded" || mode === "manual" ? 1 : 2, direction: mode === "undirected" ? undefined : "entry", accessTime: "2026-10-23T05:00:00.000Z", accessStatus: "izin_verildi" });
      if (mode === "complete") await ctx.db.insert("cardReadings", { projectId: f.projectId, employeeId: f.employeeId, cardNo: "123", deviceId: f.deviceId, ideIoId: 2, direction: "exit", accessTime: "2026-10-23T14:00:00.000Z", accessStatus: "izin_verildi" });
    });
    vi.setSystemTime(new Date("2026-11-01T12:00:00Z"));
    const [table, detail, payroll, report, sgk] = await Promise.all([
      f.caller.query(api.cardReadings.getPdksTableData, { projectId: f.projectId, startDate: "2026-10-23", endDate: "2026-10-23", viewMode: "matrix" }),
      f.caller.query(api.cardReadings.getEmployeeAttendanceDetail, { projectId: f.projectId, employeeId: f.employeeId, startDate: "2026-10-23", endDate: "2026-10-23" }),
      f.caller.query(api.cardReadings.getMonthlyPayrollSheet, { projectId: f.projectId, year: 2026, month: 10 }),
      f.caller.query(api.reports.getAttendanceSummaryReport, { projectId: f.projectId, year: 2026, month: 10 }),
      f.caller.query(api.sgkExport.buildAphbForMonth, { projectId: f.projectId, year: 2026, month: 10 }),
    ]);
    if (mode === "ended") { expect(table).toHaveLength(0); expect(report.rows[0]?.incompleteDays ?? 0).toBe(0); expect(payroll.rows[0]?.cells.some(c => c.date > "2026-10-22")).toBe(false); return; }
    const expected = mode === "excluded" ? "noData" : mode === "manual" || mode === "complete" ? "present" : mode === "holiday" ? "holiday" : "incomplete";
    expect(table[0]?.days[0]?.status).toBe(expected);
    expect(detail?.days[0]?.status).toBe(expected);
    expect(payroll.rows[0]?.cells.find(c => c.date === "2026-10-23")?.status).toBe(expected);
    if (expected === "incomplete") {
      expect(table[0]?.days[0]).toMatchObject({ durationMeasured: false, totalMinutes: 0, payrollCode: "—" });
      expect(await f.caller.query(api.cardReadings.getPdksTableData, { projectId: f.projectId, date: "2026-10-23", statusFilter: "incomplete" })).toHaveLength(1);
      expect(report.rows[0]?.incompleteDays).toBe(1);
      expect(sgk.employees[0]?.reviewDays).toContain("2026-10-23");
      expect(payroll.rows[0]?.totals.incompleteDays).toBe(1);
    } else if (expected !== "noData") expect(sgk.employees[0]?.reviewDays).not.toContain("2026-10-23");
  });
});

it("gece çıkışı yeni takvim sürümü yerine giriş gününün check point sürümünü taşır", async () => {
  const f = await fixture();
  await f.caller.mutation(api.pdksRules.publishRuleVersion, f.args);
  const secondDoor = await f.t.run(ctx => ctx.db.insert("doors", { name: "İç", projectId: f.projectId, deviceId: f.deviceId, ioId: 1 }));
  await f.caller.mutation(api.pdksRules.publishRuleVersion, { ...f.args, effectiveFrom: "2026-10-24", targets: [{ targetType: "door", deviceId: f.deviceId, doorId: secondDoor }] });
  await f.t.run(async ctx => {
    await ctx.db.patch(f.shiftId, { startTime: "22:00", endTime: "06:00" });
    for (const [accessTime, direction] of [["2026-10-23T19:00:00.000Z", "entry"], ["2026-10-24T03:00:00.000Z", "exit"]] as const) await ctx.db.insert("cardReadings", { projectId: f.projectId, employeeId: f.employeeId, cardNo: "123", deviceId: f.deviceId, ideIoId: 2, accessStatus: "izin_verildi", accessTime, direction });
  });
  vi.setSystemTime(new Date("2026-11-01T12:00:00Z"));
  const table = await f.caller.query(api.cardReadings.getPdksTableData, { projectId: f.projectId, startDate: "2026-10-23", endDate: "2026-10-23", viewMode: "matrix" });
  const detail = await f.caller.query(api.cardReadings.getEmployeeAttendanceDetail, { projectId: f.projectId, employeeId: f.employeeId, startDate: "2026-10-23", endDate: "2026-10-23" });
  expect(table[0]?.days[0]).toMatchObject({ firstEntry: "22:00", lastExit: "06:00", durationMeasured: true, punchQuality: "ok", status: "present" });
  expect(detail?.days[0]).toMatchObject({ durationMeasured: true, exitNextDay: true, status: "present" });
});
it("dashboard bugün geleni inceleme gününde de sayar", async () => {
  const f = await fixture();
  await f.caller.mutation(api.pdksRules.publishRuleVersion, f.args);
  await f.t.run(ctx => ctx.db.insert("cardReadings", { projectId: f.projectId, employeeId: f.employeeId, cardNo: "123", deviceId: f.deviceId, ideIoId: 2, accessStatus: "izin_verildi", accessTime: "2026-10-23T05:00:00.000Z", direction: "entry" }));
  vi.setSystemTime(new Date("2026-10-23T17:00:00Z"));
  expect(await f.caller.query(api.dashboard.getActivitySummary, { projectId: f.projectId })).toMatchObject({ presentToday: 1, incompleteDays: 1, insideBuilding: 1, averageFirstEntry: "08:00" });
});
