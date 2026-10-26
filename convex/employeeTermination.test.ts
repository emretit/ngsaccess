// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-21T12:00:00Z")); });
afterEach(() => vi.useRealTimers());
async function fixture(role: "project_admin" | "project_user" | "super_admin" = "project_admin") {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "A" });
    const foreignId = await ctx.db.insert("projects", { name: "B" });
    const userId = await ctx.db.insert("users", { role });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 86400000 });
    await ctx.db.insert("userProjects", { userId, projectId });
    const employeeId = await ctx.db.insert("employees", { projectId, firstName: "Ada", lastName: "Test", email: "test@example.test", cardNumber: "123", isActive: true });
    const datedShiftId = await ctx.db.insert("shifts", { projectId, name: "Plan", startTime: "09:00", endTime: "18:00", createdAt: "", updatedAt: "" });
    await ctx.db.insert("shiftAssignments", { projectId, employeeId, shiftId: datedShiftId, startDate: "2026-01-01", endDate: "2026-12-31", createdAt: "", updatedAt: "" });
    const deviceId = await ctx.db.insert("devices", { projectId, name: "IDE", brand: "ide_smart", isActive: true, createdAt: "2026-10-01", updatedAt: "2026-10-01" });
    const ruleId = await ctx.db.insert("accessRules", { projectId, name: "Rule", isActive: true });
    await ctx.db.insert("groupMembers", { projectId, groupId: ruleId, employeeId, createdAt: "2026-10-01" });
    await ctx.db.insert("groupDevices", { projectId, groupId: ruleId, deviceId, createdAt: "2026-10-01" });
    return { projectId, foreignId, userId, sessionId, employeeId, deviceId };
  });
  return { t, caller: t.withIdentity({ subject: `${ids.userId}|${ids.sessionId}` }), ...ids };
}
const termination = { employmentEndDate: "2026-10-15", terminationType: "resignation" as const, terminationReason: "Taşınma", sgkExitCode: "03" };

describe("employeeTermination", () => {
  it("rejects unauthenticated, non-admin and foreign project callers for both mutations", async () => {
    const f = await fixture("project_user");
    await expect(f.t.mutation(api.employeeTermination.terminate, { employeeId: f.employeeId, ...termination })).rejects.toThrow("Giriş");
    await expect(f.caller.mutation(api.employeeTermination.terminate, { employeeId: f.employeeId, ...termination })).rejects.toThrow("yetkiniz");
    const a = await fixture();
    await a.t.run(ctx => ctx.db.patch(a.employeeId, { projectId: a.foreignId }));
    await expect(a.caller.mutation(api.employeeTermination.terminate, { employeeId: a.employeeId, ...termination })).rejects.toThrow("erişim");
    await expect(a.caller.mutation(api.employeeTermination.reinstate, { employeeId: a.employeeId })).rejects.toThrow("erişim");
  });
  it("rejects visitors and invalid calendar dates/reason/code without writes", async () => {
    const f = await fixture();
    for (const employmentEndDate of ["2026-02-30", "2026-13-01", "2026-1-01", "2027-10-22", "invalid"]) {
      await expect(f.caller.mutation(api.employeeTermination.terminate, { employeeId: f.employeeId, ...termination, employmentEndDate })).rejects.toThrow();
    }
    await expect(f.caller.mutation(api.employeeTermination.terminate, { employeeId: f.employeeId, ...termination, terminationReason: "x".repeat(501) })).rejects.toThrow("500");
    for (const sgkExitCode of ["3", "abc", ""]) await expect(f.caller.mutation(api.employeeTermination.terminate, { employeeId: f.employeeId, ...termination, sgkExitCode })).rejects.toThrow("2 haneli");
    await f.t.run(ctx => ctx.db.patch(f.employeeId, { isVisitor: true }));
    await expect(f.caller.mutation(api.employeeTermination.terminate, { employeeId: f.employeeId, ...termination })).rejects.toThrow("Ziyaretçi");
    expect((await f.t.run(ctx => ctx.db.get(f.employeeId)))?.employmentEndDate).toBeUndefined();
  });
  it("closes past termination immediately, schedules physical IDE deletion and audits once", async () => {
    const f = await fixture();
    await f.caller.mutation(api.employeeTermination.terminate, { employeeId: f.employeeId, ...termination });
    expect(await f.t.run(ctx => ctx.db.get(f.employeeId))).toMatchObject({ ...termination, isActive: false, terminatedBy: f.userId, terminatedAt: new Date().toISOString() });
    const jobs = await f.t.run(ctx => ctx.db.system.query("_scheduled_functions").collect());
    expect(jobs.map(job => job.name)).toEqual(["actions/hikvisionSync:syncEmployeeToDevicesInternal", "actions/ideGatewayDevice:deleteIdeUserFromPanels"]);
    expect(jobs[1].args).toEqual([{ cardNumber: "123", deviceIds: [f.deviceId], projectId: f.projectId }]);
    await expect(f.caller.mutation(api.employeeTermination.terminate, { employeeId: f.employeeId, ...termination })).rejects.toThrow("Bu kişi zaten işten çıkarılmış.");
    expect(await f.t.run(ctx => ctx.db.query("auditLog").collect())).toHaveLength(1);
  });
  it.each(["2026-10-21", "2027-10-21"])("leaves %s active until its day has ended in Turkey", async employmentEndDate => {
    const f = await fixture();
    await f.caller.mutation(api.employeeTermination.terminate, { employeeId: f.employeeId, ...termination, employmentEndDate });
    expect((await f.t.run(ctx => ctx.db.get(f.employeeId)))?.isActive).toBe(true);
    const jobs = await f.t.run(ctx => ctx.db.system.query("_scheduled_functions").collect());
    expect(jobs.map(job => job.name)).toEqual(["actions/hikvisionSync:syncEmployeeToDevicesInternal", "actions/ideGatewayDevice:syncEmployeeToIdePanels"]);
    expect(jobs.map(job => job.args)).toEqual([[{ employeeId: f.employeeId }], [{ employeeId: f.employeeId }]]);
    expect(await f.t.mutation(internal.employeeTermination.closeEndedEmployments, {})).toEqual({ closed: 0 });
  });
  it("cron excludes undefined dates/today/future/inactive/visitors and closes at TR midnight", async () => {
    const f = await fixture();
    await f.caller.mutation(api.employeeTermination.terminate, { employeeId: f.employeeId, ...termination, employmentEndDate: "2026-10-21" });
    await f.t.run(async ctx => {
      for (const extra of [{}, { employmentEndDate: "2026-10-22" }, { employmentEndDate: "2026-10-20", isActive: false }, { employmentEndDate: "2026-10-20", isVisitor: true }]) {
        await ctx.db.insert("employees", { projectId: f.projectId, firstName: "Other", lastName: "Test", email: "other@test", cardNumber: "999", isActive: true, ...extra });
      }
    });
    vi.setSystemTime(new Date("2026-10-21T21:05:00Z"));
    expect(await f.t.mutation(internal.employeeTermination.closeEndedEmployments, {})).toEqual({ closed: 1 });
    expect((await f.t.run(ctx => ctx.db.get(f.employeeId)))?.isActive).toBe(false);
    expect(await f.t.mutation(internal.employeeTermination.closeEndedEmployments, {})).toEqual({ closed: 0 });
  });
  it("cron paginates 50 records and schedules continuation", async () => {
    const f = await fixture();
    await f.t.run(async ctx => {
      for (let i = 0; i < 51; i++) await ctx.db.insert("employees", { projectId: f.projectId, firstName: "Other", lastName: "Test", email: "other@test", cardNumber: `${i}`, isActive: true, employmentEndDate: "2026-10-15" });
    });
    expect(await f.t.mutation(internal.employeeTermination.closeEndedEmployments, {})).toEqual({ closed: 50 });
    const continuation = (await f.t.run(ctx => ctx.db.system.query("_scheduled_functions").collect())).find(job => job.name === "employeeTermination:closeEndedEmployments");
    expect(continuation).toBeDefined();
    const nextArgs: unknown = continuation?.args[0];
    const cursor = typeof nextArgs === "object" && nextArgs !== null && "cursor" in nextArgs ? nextArgs.cursor : undefined;
    expect(typeof cursor).toBe("string");
    if (typeof cursor !== "string") throw new Error("cursor missing");
    expect(await f.t.mutation(internal.employeeTermination.closeEndedEmployments, { cursor })).toEqual({ closed: 1 });
  });
  it("reinstate clears all six termination fields, restores access and audits", async () => {
    const f = await fixture();
    await expect(f.caller.mutation(api.employeeTermination.reinstate, { employeeId: f.employeeId })).rejects.toThrow("ayrılmamış");
    await f.caller.mutation(api.employeeTermination.terminate, { employeeId: f.employeeId, ...termination });
    await f.caller.mutation(api.employeeTermination.reinstate, { employeeId: f.employeeId });
    const employee = await f.t.run(ctx => ctx.db.get(f.employeeId));
    for (const field of ["employmentEndDate", "terminationType", "terminationReason", "sgkExitCode", "terminatedAt", "terminatedBy"] as const) expect(employee?.[field]).toBeUndefined();
    expect(employee?.isActive).toBe(true);
    const jobs = await f.t.run(ctx => ctx.db.system.query("_scheduled_functions").collect());
    expect(jobs.slice(-2).map(job => job.name)).toEqual(["actions/hikvisionSync:syncEmployeeToDevicesInternal", "actions/ideGatewayDevice:syncEmployeeToIdePanels"]);
    expect(await f.t.run(ctx => ctx.db.query("auditLog").collect())).toHaveLength(2);
  });
});

it("keeps terminated employees in PDKS/payroll/details only through the inclusive end day and in APHB", async () => {
  const f = await fixture();
  await f.t.run(async ctx => {
    const shiftId = await ctx.db.insert("shifts", { projectId: f.projectId, name: "Gündüz", startTime: "09:00", endTime: "18:00", createdAt: "2026-10-01", updatedAt: "2026-10-01" });
    await ctx.db.patch(f.employeeId, { shiftId });
    for (let day = 1; day <= 31; day++) {
      const date = `2026-10-${String(day).padStart(2, "0")}`;
      await ctx.db.insert("cardReadings", { projectId: f.projectId, employeeId: f.employeeId, cardNo: "123", accessTime: `${date}T06:00:00Z`, accessStatus: "izin_verildi", direction: "entry" });
    }
  });
  await f.caller.mutation(api.employeeTermination.terminate, { employeeId: f.employeeId, ...termination });
  const dates = { projectId: f.projectId, startDate: "2026-10-01", endDate: "2026-10-31" };
  const table = await f.caller.query(api.cardReadings.getPdksTableData, { ...dates, viewMode: "matrix" });
  expect(table.map(row => row.id)).toContain(f.employeeId);
  expect(table[0].days).toHaveLength(15);
  expect(table[0].days[table[0].days.length - 1]?.date).toBe("2026-10-15");
  const payroll = await f.caller.query(api.cardReadings.getMonthlyPayrollSheet, { projectId: f.projectId, year: 2026, month: 10 });
  expect(payroll.rows).toHaveLength(1);
  expect(payroll.rows[0].cells).toHaveLength(15);
  const detail = await f.caller.query(api.cardReadings.getEmployeeAttendanceDetail, { ...dates, employeeId: f.employeeId });
  expect(detail?.days).toHaveLength(15);
  expect(detail?.summary.absentDays).toBe(0);
  const aphb = await f.caller.query(api.sgkExport.buildAphbForMonth, { projectId: f.projectId, year: 2026, month: 10 });
  expect(aphb.xml).toContain("Ada Test");
  expect(aphb.xml).toContain("<calismaGunu>15</calismaGunu>");
  expect(aphb.xml).toContain("<eksikGunSayisi>0</eksikGunSayisi>");
  expect(await f.caller.query(api.cardReadings.getPdksTableData, { ...dates, startDate: "2026-10-16" })).toHaveLength(0);
});


describe("termination audit regressions", () => {
  it("rejects dates older than 62 TR calendar days without writes", async () => {
    vi.setSystemTime(new Date("2026-10-20T21:05:00Z"));
    const f = await fixture();
    await expect(f.caller.mutation(api.employeeTermination.terminate, { employeeId: f.employeeId, ...termination, employmentEndDate: "2026-08-19" })).rejects.toThrow("Son çalışma günü en fazla 62 gün geriye girilebilir.");
    expect((await f.t.run(ctx => ctx.db.get(f.employeeId)))?.employmentEndDate).toBeUndefined();
    expect(await f.t.run(ctx => ctx.db.query("auditLog").collect())).toHaveLength(0);
    expect(await f.t.run(ctx => ctx.db.system.query("_scheduled_functions").collect())).toHaveLength(0);
  });
  it("accepts the inclusive 62-day lower bound", async () => {
    const f = await fixture();
    await f.caller.mutation(api.employeeTermination.terminate, { employeeId: f.employeeId, ...termination, employmentEndDate: "2026-08-20" });
    expect(await f.t.run(ctx => ctx.db.get(f.employeeId))).toMatchObject({ employmentEndDate: "2026-08-20", isActive: false });
  });
  it.each([false, undefined])("rejects inactive employees (%s) without scheduling or auditing", async isActive => {
    const f = await fixture();
    await f.t.run(ctx => ctx.db.patch(f.employeeId, { isActive }));
    await expect(f.caller.mutation(api.employeeTermination.terminate, { employeeId: f.employeeId, ...termination })).rejects.toThrow("Pasif kişi işten çıkarılamaz; önce aktif yapın.");
    expect((await f.t.run(ctx => ctx.db.get(f.employeeId)))?.employmentEndDate).toBeUndefined();
    expect(await f.t.run(ctx => ctx.db.query("auditLog").collect())).toHaveLength(0);
    expect(await f.t.run(ctx => ctx.db.system.query("_scheduled_functions").collect())).toHaveLength(0);
  });
  it("blocks generic reactivation and rolls back other form fields", async () => {
    const f = await fixture();
    await f.caller.mutation(api.employeeTermination.terminate, { employeeId: f.employeeId, ...termination });
    await expect(f.caller.mutation(api.employees.update, { employeeId: f.employeeId, isActive: true, firstName: "Changed" })).rejects.toThrow("İşten ayrılan kişiyi aktifleştirmek için 'Geri al' kullanın.");
    expect(await f.t.run(ctx => ctx.db.get(f.employeeId))).toMatchObject({ firstName: "Ada", isActive: false, employmentEndDate: termination.employmentEndDate });
  });
  it.each([false, true])("allows unchanged isActive=%s in a terminated employee form", async isActive => {
    const f = await fixture();
    await f.t.run(ctx => ctx.db.patch(f.employeeId, { ...termination, isActive }));
    await f.caller.mutation(api.employees.update, { employeeId: f.employeeId, isActive, firstName: "Changed" });
    expect(await f.t.run(ctx => ctx.db.get(f.employeeId))).toMatchObject({ firstName: "Changed", isActive, employmentEndDate: termination.employmentEndDate });
  });
  it.each(["project_user", "project_admin", "super_admin"] as const)("masks termination details for %s in list and getById", async role => {
    const f = await fixture(role);
    await f.t.run(ctx => ctx.db.patch(f.employeeId, { ...termination, terminatedBy: f.userId }));
    const rows = await f.caller.query(api.employees.list, { projectId: f.projectId });
    const employee = await f.caller.query(api.employees.getById, { employeeId: f.employeeId });
    expect(rows).toHaveLength(1);
    for (const row of [rows[0], employee]) {
      expect(row).toMatchObject({ employmentEndDate: termination.employmentEndDate, terminationType: termination.terminationType });
      expect(row?.terminationReason).toBe(role === "project_user" ? undefined : termination.terminationReason);
      expect(row?.sgkExitCode).toBe(role === "project_user" ? undefined : termination.sgkExitCode);
      expect(row?.terminatedBy).toBe(role === "project_user" ? undefined : f.userId);
    }
  });
  it.each([
    ["2026-02-28", false, 11, 19],
    ["2026-02-14", false, 5, 9],
    [undefined, false, 11, 19],
  ] as const)("APHB preserves premium days for end=%s active=%s", async (employmentEndDate, isActive, premiumDays, missingDays) => {
    const f = await fixture();
    await f.t.run(async ctx => {
      await ctx.db.patch(f.employeeId, { employmentEndDate, isActive });
      await ctx.db.insert("cardReadings", { projectId: f.projectId, employeeId: f.employeeId, cardNo: "123", accessTime: "2026-02-02T06:00:00Z", accessStatus: "izin_verildi", direction: "entry" });
    });
    const aphb = await f.caller.query(api.sgkExport.buildAphbForMonth, { projectId: f.projectId, year: 2026, month: 2 });
    expect(aphb.xml).toContain("Ada Test");
    expect(aphb.xml).toContain(`<calismaGunu>${premiumDays}</calismaGunu>`);
    expect(aphb.xml).toContain(`<eksikGunSayisi>${missingDays}</eksikGunSayisi>`);
  });
});
