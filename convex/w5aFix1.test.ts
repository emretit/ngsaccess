// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Doc } from "./_generated/dataModel";
import { api } from "./_generated/api";
import schema from "./schema";
import { classifyPdksDay } from "./lib/pdksTable";
import { resolveAttendanceEvidence } from "./lib/pdksEvidence";
import { computePayrollCell } from "./lib/pdksPayroll";
import { computeAttendanceDetailDay } from "./lib/pdksDetail";
import { LEGACY_PDKS_POLICY, loadPdksPolicies, type PdksDayPolicy } from "./lib/pdksRules";
import { DEFAULT_OVERTIME_RATES, DEFAULT_WORK_SETTINGS } from "./lib/pdksHelpers";
import { pdksFirstRecordDate } from "./lib/pdksAvailability";
import { loadRuleReportDays } from "./lib/reportAttendance";
import { trDateKey } from "./lib/trDate";
const modules = import.meta.glob("./**/*.ts");
const requirements: PdksDayPolicy = { punchMode: "requirements", checkpointMode: "all", targets: [], requireCheckIn: true, requireCheckOut: true, missingRequiredPunch: "review", noPunch: "absent" };
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-01T12:00:00.000Z")); });
afterEach(() => vi.useRealTimers());

async function fixture(role: "project_admin" | "project_user" | "super_admin" = "project_admin", effectiveFrom: string | null = "2026-10-23") {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "A" });
    const foreignId = await ctx.db.insert("projects", { name: "B" });
    const userId = await ctx.db.insert("users", { role });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 365 * 86400000 });
    await ctx.db.insert("userProjects", { projectId, userId });
    const shiftId = await ctx.db.insert("shifts", { projectId, name: "Gündüz", startTime: "08:00", endTime: "17:00", earlyExitToleranceMinutes: 15, createdAt: "", updatedAt: "" });
    const employeeId = await ctx.db.insert("employees", { projectId, firstName: "Ada", lastName: "Test", email: "ada@test", cardNumber: "123", isActive: true, shiftId });
    const deviceId = await ctx.db.insert("devices", { projectId, name: "IDE", brand: "ide_smart", createdAt: "", updatedAt: "" });
    const versionId = effectiveFrom ? await ctx.db.insert("pdksRuleVersions", { projectId, effectiveFrom, punchMode: "requirements", checkpointMode: "all", requireCheckIn: true, requireCheckOut: true, missingRequiredPunch: "review", noPunch: "absent", createdAt: "", createdBy: userId }) : null;
    await ctx.db.insert("employeeAuth", { employeeId, passwordHash: "fixture", passwordVersion: 1, createdAt: "", updatedAt: "" });
    await ctx.db.insert("employeeSessions", { employeeId, token: "fix1-session", passwordVersion: 1, expiresAt: "2099-01-01T00:00:00.000Z", createdAt: "" });
    return { projectId, foreignId, userId, sessionId, shiftId, employeeId, deviceId, versionId };
  });
  const caller = t.withIdentity({ subject: `${ids.userId}|${ids.sessionId}` });
  const add = (accessTime: string, direction?: "entry" | "exit", extra: Partial<Doc<"cardReadings">> = {}) => t.run(ctx => ctx.db.insert("cardReadings", { projectId: ids.projectId, employeeId: ids.employeeId, deviceId: ids.deviceId, cardNo: "123", accessTime, accessStatus: "izin_verildi", direction, ...extra }));
  const manual = (date: string, times: { entryTime?: string; exitTime?: string } = {}) => t.run(ctx => ctx.db.insert("pdksRecords", { projectId: ids.projectId, employeeId: ids.employeeId, employeeFirstName: "Ada", employeeLastName: "Test", date, manualEntry: true, status: "present", createdAt: "", updatedAt: "", ...times }));
  const table = (date: string, endDate = date) => caller.query(api.cardReadings.getPdksTableData, { projectId: ids.projectId, startDate: date, endDate, viewMode: "matrix" });
  const sgk = () => caller.query(api.sgkExport.buildAphbForMonth, { projectId: ids.projectId, year: 2026, month: 10 });
  return { ...ids, t, caller, add, manual, table, sgk };
}

const base = { today: "2026-11-30", firstRecordDate: "2026-01-01", hasLeave: false, isLate: false, hasAttendance: false, dataAvailable: false };
describe("W5-A fix1 denetçi probu", () => {
  it.each([
    ["weekend", "2026-11-07", "weekend", false],
    ["holiday", "2026-11-10", "holiday", false],
    ["leave", "2026-11-11", "workday", true],
  ] as const)("ENGEL-1: %s veri yoktan önce döner", (expected, date, classification, hasLeave) => {
    expect(classifyPdksDay({ ...base, date, classification, hasLeave, attendanceDecision: "absent" })).toBe(expected);
  });
  it.each(["absent", "incomplete"] as const)("ENGEL-2: gündüz eksik yön %s bitiş+toleransa kadar bekler", attendanceDecision => {
    const input = { ...base, date: "2026-11-30", classification: "workday" as const, dataAvailable: true, attendanceDecision, shiftStart: "08:00", shiftEnd: "17:00", earlyExitTolerance: 15 };
    expect(classifyPdksDay({ ...input, now: Date.parse("2026-11-30T09:00:00Z") })).toBe("future");
    expect(classifyPdksDay({ ...input, now: Date.parse("2026-11-30T14:15:00Z") })).toBe("future");
    expect(classifyPdksDay({ ...input, now: Date.parse("2026-11-30T14:15:01Z") })).toBe(attendanceDecision);
  });
  it("ENGEL-2: dün başlayan gece vardiyası sabah bitiş+toleransa kadar bekler", () => {
    const input = { ...base, today: "2026-12-01", date: "2026-11-30", classification: "workday" as const, dataAvailable: true, attendanceDecision: "incomplete" as const, shiftStart: "22:00", shiftEnd: "06:00", earlyExitTolerance: 15 };
    expect(classifyPdksDay({ ...input, now: Date.parse("2026-12-01T00:00:00Z") })).toBe("future");
    expect(classifyPdksDay({ ...input, now: Date.parse("2026-12-01T03:16:00Z") })).toBe("incomplete");
  });
  it("ENGEL-1: noData yalnız absent adayıdır, noPunch review kararını örtmez", () => {
    expect(classifyPdksDay({ ...base, firstRecordDate: null, date: "2026-11-30", classification: "workday", attendanceDecision: "incomplete" })).toBe("incomplete");
    expect(classifyPdksDay({ ...base, firstRecordDate: null, date: "2026-11-30", classification: "workday", attendanceDecision: "absent" })).toBe("noData");
  });
  it("ENGEL-3: yönsüz ek okuma geçerli çifti veya manuel düzeltmeyi incelemeye çevirmez", () => {
    const entry = { accessTime: "2026-11-30T05:00:00.000Z", direction: "entry" };
    const exit = { accessTime: "2026-11-30T14:00:00.000Z", direction: "exit" };
    const unknown = { accessTime: "2026-11-30T06:00:00.000Z" };
    for (const [readings, manual] of [ [[entry, unknown, exit], undefined], [[unknown], { entryISO: entry.accessTime, exitISO: exit.accessTime }], [[entry, unknown], { exitISO: exit.accessTime }] ] as const) {
      expect(resolveAttendanceEvidence(readings, manual, requirements)).toMatchObject({ decision: "present", durationMeasured: true, punchQuality: "undirected" });
    }
    expect(resolveAttendanceEvidence([entry, unknown], undefined, { ...requirements, requireCheckOut: false })).toMatchObject({ decision: "present", durationMeasured: false });
    expect(resolveAttendanceEvidence([unknown], undefined, requirements).decision).toBe("incomplete");
  });
});

it("D2/ENGEL-1: izin/tatil/hafta sonu reviewDays olmaz, gerçek inceleme XML üretimini engeller", async () => {
  const f = await fixture("project_admin", "2026-10-01");
  await f.t.run(async ctx => {
    await ctx.db.insert("holidays", { projectId: f.projectId, name: "Tatil", date: "2026-10-26", type: "company", createdAt: "" });
    await ctx.db.insert("leaves", { projectId: f.projectId, employeeId: f.employeeId, startDate: "2026-10-01", endDate: "2026-10-31", leaveType: "unpaid", status: "approved", createdAt: "", updatedAt: "" });
  });
  const allowed = await f.sgk();
  expect(allowed).toMatchObject({ blockedByReview: false, filename: "aphb-taslak-resmi-sgk-formati-degildir-2026-10.xml", employees: [{ employeeId: f.employeeId, reviewDays: [] }] });
  expect(allowed.xml).toContain("<eksikGunNedeni>21</eksikGunNedeni>");
  expect(allowed.xml).toContain("<eksikGunSayisi>21</eksikGunSayisi>");
  expect((await f.table("2026-10-23", "2026-10-26"))[0]?.days.map(day => day.status)).toEqual(["leave", "weekend", "weekend", "holiday"]);
  await f.t.run(async ctx => {
    const leave = await ctx.db.query("leaves").withIndex("by_employee", q => q.eq("employeeId", f.employeeId)).first();
    if (leave) await ctx.db.patch(leave._id, { endDate: "2026-10-22" });
  });
  await f.add("2026-10-23T05:00:00.000Z", "entry");
  const blocked = await f.sgk();
  expect(blocked).toMatchObject({ blockedByReview: true, xml: "", filename: allowed.filename });
  expect(blocked.employees[0]?.reviewDays).toContain("2026-10-23");
  expect(blocked.employees[0]?.reviewDays).not.toContain("2026-10-24");
  expect(blocked.employees[0]?.reviewDays).not.toContain("2026-10-26");
  expect(blocked.warnings.some(warning => warning.includes("XML üretimi engellendi"))).toBe(true);
});

it("D3: yeni sürümün ilk sabahındaki çıkış önceki legacy iş gününde rapor/SGK/tabloyla aynı oturumu oluşturur", async () => {
  const f = await fixture();
  await f.t.run(async ctx => {
    await ctx.db.patch(f.shiftId, { startTime: "22:00", endTime: "06:00" });
    await ctx.db.insert("leaves", { projectId: f.projectId, employeeId: f.employeeId, startDate: "2026-10-23", endDate: "2026-10-31", leaveType: "unpaid", status: "approved", createdAt: "", updatedAt: "" });
  });
  await f.add("2026-10-22T19:00:00.000Z", "entry");
  await f.add("2026-10-23T03:00:00.000Z", "exit");
  const table = await f.table("2026-10-22");
  expect(table[0]?.days[0]).toMatchObject({ status: "present", firstEntry: "22:00", lastExit: "06:00", rawTotalMinutes: 480 });
  const report = await f.caller.query(api.reports.getSgkMonthlyReport, { projectId: f.projectId, year: 2026, month: 10 });
  expect(report.rows[0]).toMatchObject({ calismaGunu: 1, toplamSaat: 8 });
  const workDates = await f.t.run(async ctx => {
    const report = await loadRuleReportDays(ctx, [f.projectId], "2026-10-01", "2026-10-31");
    return report.readings.map(reading => report.workDate(reading));
  });
  expect(workDates).toEqual(["2026-10-22", "2026-10-22"]);
  const sgk = await f.sgk();
  expect(sgk.blockedByReview).toBe(false);
  expect(sgk.xml).toContain("<eksikGunSayisi>21</eksikGunSayisi>");
});

it("D4: saatsiz manuel kayıt legacy veri-yok sonucunu tablo/detay/bordroda korur", async () => {
  const f = await fixture("project_admin", null);
  await f.manual("2026-10-23");
  expect((await f.table("2026-10-23"))[0]?.days[0]?.status).toBe("noData");
  const detail = await f.caller.query(api.cardReadings.getEmployeeAttendanceDetail, { projectId: f.projectId, employeeId: f.employeeId, startDate: "2026-10-23", endDate: "2026-10-23" });
  expect(detail?.days[0]?.status).toBe("noData");
  const payroll = await f.caller.query(api.cardReadings.getMonthlyPayrollSheet, { projectId: f.projectId, year: 2026, month: 10 });
  expect(payroll.rows[0]?.cells.find(day => day.date === "2026-10-23")?.status).toBe("noData");
  const manual = await f.t.run(ctx => ctx.db.query("pdksRecords").withIndex("by_employee_date", q => q.eq("employeeId", f.employeeId)).first());
  if (!manual) throw new Error("Fixture kaydı yok");
  const input = { date: "2026-10-23", availableDateKeys: new Set<string>(), firstRecordDate: "2026-01-01", dayShift: null, dayReadings: [], manual, manualDay: manual, hasLeave: false, leaves: [], holiday: null, workingDays: ["Cuma"], workSettings: DEFAULT_WORK_SETTINGS, overtimeRates: DEFAULT_OVERTIME_RATES, empHourlyRate: null };
  expect(computePayrollCell({ ...input, policyFor: () => LEGACY_PDKS_POLICY }).status).toBe("noData");
  expect(computeAttendanceDetailDay({ ...input, policyFor: () => LEGACY_PDKS_POLICY }).status).toBe("noData");
  expect(computePayrollCell({ ...input, policyFor: () => requirements }).status).toBe("absent");
  expect(computeAttendanceDetailDay({ ...input, policyFor: () => requirements }).status).toBe("absent");
});

it("D5: mobil requirements manuel ve gece günlerini tabloyla aynı sayar, ham hareketler takvim gününde kalır", async () => {
  const f = await fixture();
  await f.t.run(ctx => ctx.db.patch(f.shiftId, { startTime: "22:00", endTime: "06:00" }));
  await f.add("2026-10-23T19:00:00.000Z", "entry");
  await f.add("2026-10-24T03:00:00.000Z", "exit");
  await f.manual("2026-10-26", { entryTime: "22:00", exitTime: "06:00" });
  const table = await f.table("2026-10-23", "2026-10-26");
  const summary = await f.t.query(api.mobileAttendance.summary, { sessionToken: "fix1-session", startDate: "2026-10-23", endDate: "2026-10-26" });
  expect(summary.totals.presentDays).toBe(table[0]?.days.filter(day => day.status === "present" || day.status === "late").length);
  expect(summary.totals.presentDays).toBe(2);
  expect(summary.days.find(day => day.date === "2026-10-24")?.exitCount).toBe(1);
  expect(summary.days.find(day => day.date === "2026-10-26")?.entryCount).toBe(0);
});

it("ENGEL-2: vardiyasız requirements çalışan çalışma ayarı bitişine kadar bekler; ham dashboard girişini sayar", async () => {
  const f = await fixture();
  await f.t.run(ctx => ctx.db.patch(f.employeeId, { shiftId: undefined }));
  await f.add("2026-10-23T05:00:00.000Z", "entry");
  vi.setSystemTime(new Date("2026-10-23T09:00:00.000Z"));
  expect((await f.table("2026-10-23"))[0]?.days[0]?.status).toBe("future");
  expect(await f.caller.query(api.dashboard.getActivitySummary, { projectId: f.projectId })).toMatchObject({ presentToday: 1, insideBuilding: 1, averageFirstEntry: "08:00", incompleteDays: 0 });
  vi.setSystemTime(new Date("2026-10-23T15:16:00.000Z"));
  expect((await f.table("2026-10-23"))[0]?.days[0]?.status).toBe("incomplete");
});

it("D6: karma dashboard geç gelen kişiyi birden çok geç okumada yalnız bir kere sayar", async () => {
  const f = await fixture("super_admin");
  const legacyEmployee = await f.t.run(ctx => ctx.db.insert("employees", { projectId: f.foreignId, firstName: "Lin", lastName: "Test", email: "lin@test", cardNumber: "456", isActive: true }));
  for (const time of ["10:00", "11:00", "12:00"]) await f.add(`2026-10-23T${time}:00.000Z`, "entry", { projectId: f.foreignId, employeeId: legacyEmployee, cardNo: "456" });
  vi.setSystemTime(new Date("2026-10-23T17:00:00.000Z"));
  expect(await f.caller.query(api.dashboard.getActivitySummary, {})).toMatchObject({ lateArrivals: 1, presentToday: 1 });
});

it("N-yetki: project_user kural/cihaz okuyamaz veya silemez; proje admin yabancı sürüm silemez", async () => {
  const user = await fixture("project_user");
  for (const query of [api.pdksRules.getRules, api.pdksRules.listCheckpointTargets]) await expect(user.caller.query(query, { projectId: user.projectId })).rejects.toThrow("yetkiniz");
  if (!user.versionId) throw new Error("Fixture sürümü yok");
  await expect(user.caller.mutation(api.pdksRules.deleteFutureRuleVersion, { ruleVersionId: user.versionId })).rejects.toThrow("yetkiniz");
  const f = await fixture();
  const foreignVersion = await f.t.run(ctx => ctx.db.insert("pdksRuleVersions", { projectId: f.foreignId, effectiveFrom: "2026-12-01", punchMode: "legacy", checkpointMode: "all", createdAt: "", createdBy: f.userId }));
  await expect(f.caller.mutation(api.pdksRules.deleteFutureRuleVersion, { ruleVersionId: foreignVersion })).rejects.toThrow("erişim");
});

it("N-ilk kayıt: dönem öncesi adayın eski selected sürümü iç kapı okumasını ilk kayıt saymaz", async () => {
  const f = await fixture("project_admin", "2026-10-01");
  await f.t.run(async ctx => {
    const oldVersion = await ctx.db.insert("pdksRuleVersions", { projectId: f.projectId, effectiveFrom: "2026-08-01", punchMode: "legacy", checkpointMode: "selected", createdAt: "", createdBy: f.userId });
    await ctx.db.insert("pdksCheckpointSelections", { projectId: f.projectId, ruleVersionId: oldVersion, targetType: "door", deviceId: f.deviceId, ioId: 2 });
  });
  await f.add("2026-08-05T05:00:00.000Z", "entry", { ideIoId: 1 });
  await f.add("2026-10-23T05:00:00.000Z", "entry");
  const first = await f.t.run(async ctx => {
    const employee = await ctx.db.get(f.employeeId);
    if (!employee) throw new Error("Fixture çalışanı yok");
    const policies = await loadPdksPolicies(ctx, [f.projectId], "2026-10-23", "2026-10-31");
    return pdksFirstRecordDate(ctx, employee, [], [], reading => trDateKey(reading.accessTime), policies);
  });
  expect(first).toBe("2026-10-23");
});

it("N-perf: kontrol noktası Map sayımı çok kapılı Hik cihazını doğru reddeder", async () => {
  const f = await fixture();
  await f.t.run(async ctx => {
    await ctx.db.patch(f.deviceId, { brand: "hikvision" });
    for (let index = 0; index < 3; index++) await ctx.db.insert("doors", { projectId: f.projectId, deviceId: f.deviceId, name: `Kapı ${index}` });
    await ctx.db.insert("doors", { projectId: f.projectId, name: "Bağsız" });
  });
  const targets = await f.caller.query(api.pdksRules.listCheckpointTargets, { projectId: f.projectId });
  expect(targets.doors).toHaveLength(4);
  expect(targets.doors.every(door => !door.selectable)).toBe(true);
  expect(targets.doors.filter(door => door.deviceId === f.deviceId).every(door => door.reason?.includes("Çok kapılı"))).toBe(true);
});

it("D1: karma kapsamda ek personel/vardiya/okuma yalnız sürümlü proje içindir", async () => {
  const f = await fixture();
  const queriedProjects: { table: string; projectId: unknown }[] = [];
  await f.t.run(async ctx => {
    const db = new Proxy(ctx.db, { get(target, key) {
      if (key !== "query") return Reflect.get(target, key);
      return (table: string) => {
        const query = Reflect.apply(target.query, target, [table]) as object;
        return new Proxy(query, { get(queryTarget, queryKey) {
          const method: unknown = Reflect.get(queryTarget, queryKey);
          if (queryKey !== "withIndex" || typeof method !== "function") return method;
          return (index: string, callback: (builder: object) => object) => Reflect.apply(method, queryTarget, [index, (builder: object) => callback(new Proxy(builder, { get(builderTarget, field) {
            const operation: unknown = Reflect.get(builderTarget, field);
            if (field !== "eq" || typeof operation !== "function") return operation;
            return (name: string, value: unknown) => {
              if (name === "projectId") queriedProjects.push({ table, projectId: value });
              return Reflect.apply(operation, builderTarget, [name, value]);
            };
          } }))]);
        } });
      };
    } });
    const report = await loadRuleReportDays({ ...ctx, db }, [f.projectId, f.foreignId], "2026-10-23", "2026-10-23", { includeLegacyReadings: false });
    expect(report.ruleEmployees.has(f.employeeId)).toBe(true);
  });
  expect(queriedProjects.some(query => query.table === "employees" && query.projectId === f.projectId)).toBe(true);
  expect(queriedProjects.some(query => ["employees", "cardReadings"].includes(query.table) && query.projectId === f.foreignId)).toBe(false);
});

it("D1: yalnız selected legacy sürümü de iş günü check point filtresini yükler", async () => {
  const f = await fixture();
  await f.t.run(async ctx => {
    if (!f.versionId) throw new Error("Fixture sürümü yok");
    await ctx.db.patch(f.versionId, { punchMode: "legacy", checkpointMode: "selected" });
    await ctx.db.insert("pdksCheckpointSelections", { projectId: f.projectId, ruleVersionId: f.versionId, targetType: "door", deviceId: f.deviceId, ioId: 2 });
  });
  await f.add("2026-10-23T05:00:00.000Z", "entry", { ideIoId: 1 });
  await f.add("2026-10-23T14:00:00.000Z", "exit", { ideIoId: 2 });
  const report = await f.t.run(async ctx => {
    const result = await loadRuleReportDays(ctx, [f.projectId], "2026-10-23", "2026-10-23");
    return { readings: result.readings.map(reading => reading.ideIoId), ruleCount: result.ruleRows.size };
  });
  expect(report).toEqual({ readings: [2], ruleCount: 0 });
});
