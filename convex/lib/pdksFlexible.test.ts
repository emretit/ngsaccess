// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import schema from "../schema";
import { api } from "../_generated/api";
import { describe, expect, it } from "vitest";
import type { Doc, Id } from "../_generated/dataModel";
import { computePdksDay } from "./pdksDay";
import { classifyPdksDay, computePdksTableRow, filterPdksTableRows } from "./pdksTable";
import { computeAttendanceDetailDay } from "./pdksDetail";
import { computePayrollCell } from "./pdksPayroll";
import { calculatePeriodOvertime } from "./overtimeCalc";
import { DEFAULT_OVERTIME_RATES, DEFAULT_WORK_SETTINGS } from "./pdksHelpers";
import { addWorkDate, buildPdksWorkDateResolver, groupPdksWorkDays, manualPdksTimes } from "./pdksWorkDay";
import { DEFAULT_FLEXIBLE, validateFlexible, type FlexibleSchedule } from "./pdksFlexible";
import { scheduleIntervals, schedulesOverlap, shiftTimeLabel, validateShift } from "./shiftUx";
import { thresholdsForShift } from "./shiftResolver";
import { evaluateShiftAssignment } from "./shiftAssign";
import { LEGACY_PDKS_POLICY, type PdksDayPolicy } from "./pdksRules";

const date = "2026-06-22";
const workingDays = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma"];
const employeeId = "emp" as Id<"employees">;
const policy: PdksDayPolicy = { punchMode: "requirements", checkpointMode: "all", targets: [], requireCheckIn: true, requireCheckOut: true, missingRequiredPunch: "review", noPunch: "absent" };
const rates = { ...DEFAULT_OVERTIME_RATES, overtimeBasis: "dailyShift" as const };
function shift(extra: Partial<Doc<"shifts">> = {}): Doc<"shifts"> {
  return { _id: "shift" as Id<"shifts">, _creationTime: 0, name: "Esnek", startTime: "05:00", endTime: "22:00", scheduleType: "flexible", flexible: { ...DEFAULT_FLEXIBLE }, createdAt: "", updatedAt: "", overtimeStartToleranceMinutes: 0, ...extra };
}
function reading(time: string, direction: "entry" | "exit", day = date): Doc<"cardReadings"> {
  return { _id: `${day}-${time}-${direction}` as Id<"cardReadings">, _creationTime: 0, cardNo: "1", accessTime: new Date(`${day}T${time}:00+03:00`).toISOString(), accessStatus: "izin_verildi", direction };
}
/** Legacy card readings carry no entry/exit direction. */
function undirected(...items: Doc<"cardReadings">[]) {
  return items.map(r => ({ ...r, direction: undefined }));
}
function run(readings: Doc<"cardReadings">[], extra: Partial<Parameters<typeof computePdksDay>[0]> = {}) {
  return computePdksDay({ date, readings, shift: shift(), policy, workSettings: DEFAULT_WORK_SETTINGS, workingDays, overtimeRates: rates, ...extra });
}
function status(day: ReturnType<typeof run>, hasLeave = false, now = Date.parse("2026-07-01")) {
  return classifyPdksDay({ date: day.date, today: "2026-07-01", now, dataAvailable: true, firstRecordDate: date, hasAssignedShift: true, classification: day.classification, hasAttendance: day.hasAttendance, hasLeave, isLate: day.isLate, attendanceDecision: day.attendanceDecision, pendingUntil: day.pendingUntil, durationMeasured: day.durationMeasured });
}

describe("tasarım §1 on iki senaryo", () => {
  it.each([
    ["Normal", "08:00", "17:00", 480, 0, 0],
    ["Geç başlayıp tam süre", "12:00", "21:00", 480, 0, 0],
    ["Eski plana göre erken çıkış", "05:00", "14:00", 480, 0, 0],
    ["Eksik süre", "09:00", "16:00", 360, 120, 0],
    ["Fazla süre", "08:00", "18:00", 540, 0, 60],
  ] as const)("%s", (_, entry, exit, totalMinutes, shortfallMinutes, overtimeMinutes) => {
    const day = run([reading(entry, "entry"), reading(exit, "exit")]);
    expect(day).toMatchObject({ totalMinutes, shortfallMinutes, overtimeMinutes, isLate: false, isEarlyExit: false, lateMinutes: 0, earlyExitMinutes: 0, durationMeasured: true });
    expect(status(day)).toBe("present");
  });
  it("Pencere dışı giriş", () => {
    const day = run([reading("04:30", "entry"), reading("13:30", "exit")]);
    expect(day).toMatchObject({ firstISO: null, durationMeasured: false, shortfallMinutes: null, totalMinutes: 0, overtimeMinutes: 0, punchQuality: "missingEntry" });
    expect(status(day)).toBe("incomplete");
  });
  it("Gece geçen", () => {
    const readings = [reading("21:00", "entry"), reading("06:00", "exit", addWorkDate(date, 1))];
    const grouped = groupPdksWorkDays(readings, employeeId, () => shift());
    expect(grouped.size).toBe(1);
    const day = run(grouped.get(date) ?? []);
    expect(day).toMatchObject({ totalMinutes: 480, shortfallMinutes: 0, overtimeMinutes: 0, exitNextDay: true });
    expect(day.nightMinutes).toBe(427);
  });
  it("Yalnız giriş", () => {
    const day = run([reading("09:00", "entry")]);
    expect(day).toMatchObject({ durationMeasured: false, shortfallMinutes: null, totalMinutes: 0, punchQuality: "missingExit" });
    expect(status(day, false, Date.parse(`${date}T21:00:00+03:00`))).toBe("future");
    expect(status(day)).toBe("incomplete");
  });
  it("Yalnız çıkış", () => {
    const day = run([reading("17:00", "exit")]);
    expect(day).toMatchObject({ firstISO: null, durationMeasured: false, shortfallMinutes: null, totalMinutes: 0, punchQuality: "missingEntry" });
    expect(status(day)).toBe("incomplete");
  });
  it("Hiç okutma", () => {
    const day = run([]);
    expect(day).toMatchObject({ durationMeasured: false, shortfallMinutes: null, totalMinutes: 0, punchQuality: "noPunch" });
    expect(status(day, false, Date.parse(`${date}T23:59:00+03:00`))).toBe("future");
    expect(status(day)).toBe("absent");
  });
  it("Tam gün izin", () => {
    const day = run([], { hasLeave: true });
    expect(day).toMatchObject({ requiredNetMinutes: 0, shortfallMinutes: 0, overtimeMinutes: 0 });
    expect(status(day, true)).toBe("leave");
  });
  it("Tatilde çalışma", () => {
    const holiday = { date, name: "Tatil" } as Doc<"holidays">;
    const day = run([reading("08:00", "entry"), reading("17:00", "exit")], { holiday });
    expect(day).toMatchObject({ totalMinutes: 480, requiredNetMinutes: 0, shortfallMinutes: 0, overtimeMinutes: 480 });
    expect(status(day)).toBe("holiday");
  });
});

describe("esnek gün kuralları (sabitle ortak)", () => {
  it("en az net çalışmanın altında kalan esnek gün devamsız sayılır; eşikte kalan sayılmaz", () => {
    const readings = [reading("09:00", "entry"), reading("16:00", "exit")];
    const short = run(readings, { shift: shift({ minWorkMinutes: 400 }) });
    expect(short).toMatchObject({ totalMinutes: 360, shortfallMinutes: 120, attendanceDecision: "absent", hasAttendance: false });
    expect(status(short)).toBe("absent");
    expect(run(readings, { shift: shift({ minWorkMinutes: 360 }) })).toMatchObject({ hasAttendance: true });
    expect(run([reading("09:00", "entry")], { shift: shift({ minWorkMinutes: 400 }) }).attendanceDecision).not.toBe("absent");
  });
  it("resmi tatilde çalışma zorunluysa esnek hedef tam kalır ve tatil mesaisi yazılmaz", () => {
    const holiday = { date, name: "Tatil" } as Doc<"holidays">;
    const day = run([reading("08:00", "entry"), reading("17:00", "exit")], { holiday, shift: shift({ holidayWorkRequired: true }) });
    expect(day).toMatchObject({ classification: "workday", requiredNetMinutes: 480, shortfallMinutes: 0, overtimeMinutes: 0 });
    expect(status(day)).toBe("present");
    expect(run([], { holiday, shift: shift({ holidayWorkRequired: true, minWorkMinutes: 60 }) }).classification).toBe("workday");
  });
});

describe("esnek eşleme, mola ve mesai", () => {
  it("toleransı hedeften sonra düşer, dailyShift ve weekly45 çift ödeme yapmaz", () => {
    const day = run([reading("08:00", "entry"), reading("18:00", "exit")], { shift: shift({ overtimeStartToleranceMinutes: 15 }) });
    expect(day).toMatchObject({ excessMinutes: 60, overtimeMinutes: 45 });
    expect(calculatePeriodOvertime([day], { startDate: date, endDate: date, overtimeBasis: "weekly45" }).overtimeMinutes).toBe(0);
    expect(calculatePeriodOvertime(Array.from({ length: 6 }, (_, i) => ({ ...day, date: addWorkDate(date, i) })), { startDate: date, endDate: addWorkDate(date, 6), overtimeBasis: "weekly45" }).overtimeMinutes).toBe(540);
    expect(run([reading("08:00", "entry"), reading("18:00", "exit")], { shift: shift({ overtimeEnabled: false }) }).overtimeMinutes).toBe(0);
  });
  it("okumayı iki güne yazmaz; kapanmış gece oturumu yeni gün girişini yutmaz", () => {
    const next = addWorkDate(date, 1);
    const readings = [reading("21:00", "entry"), reading("06:00", "exit", next), reading("08:00", "entry", next), reading("17:00", "exit", next)];
    const grouped = groupPdksWorkDays(readings, employeeId, () => shift());
    expect([...grouped.values()].flat()).toHaveLength(4);
    expect(new Set([...grouped.values()].flat().map(r => r._id)).size).toBe(4);
    expect(grouped.get(date)).toHaveLength(2);
    expect(grouped.get(next)).toHaveLength(2);
  });
  it("aynı gündeki ara hareketler ilk giriş/son çıkışı genişletir, mola bir kez düşer", () => {
    const day = run([reading("08:00", "entry"), reading("12:00", "exit"), reading("13:00", "entry"), reading("18:00", "exit")]);
    expect(day).toMatchObject({ totalMinutes: 540, breakMinutes: 60, overtimeMinutes: 60 });
  });
  it("azami oturum ve çıkış penceresi dışındaki çift ölçülmez; manuel pencereye tabidir", () => {
    expect(run([reading("05:00", "entry"), reading("22:00", "exit")])).toMatchObject({ totalMinutes: 0, shortfallMinutes: null, punchQuality: "missingExit" });
    expect(run([], { manual: { entryTime: "04:30", exitTime: "13:30" } as Doc<"pdksRecords"> })).toMatchObject({ durationMeasured: false, firstISO: null });
  });
  it("çakışan açık oturumları keyfi çiftlemez", () => {
    const next = addWorkDate(date, 1);
    const grouped = groupPdksWorkDays([reading("21:00", "entry"), reading("05:00", "entry", next), reading("06:00", "exit", next)], employeeId, () => shift());
    for (const [date, readings] of grouped) expect(run(readings, { date })).toMatchObject({ attendanceDecision: "incomplete", durationMeasured: false, shortfallMinutes: null });
  });
  it("hafta/ay sınırında splitAtMidnight net, gece ve mola dakikalarını korur", () => {
    const date = "2026-05-31"; // Sunday -> Monday / next month
    const day = run([reading("21:00", "entry", date), reading("06:00", "exit", "2026-06-01")], { date, workingDays: [...workingDays, "Pazar"], overtimeRates: { ...rates, nightShiftDayMode: "splitAtMidnight" } });
    expect(day.overtimeSegments.reduce((sum, s) => sum + s.netMinutes, 0)).toBe(480);
    expect(day.overtimeSegments.filter(s => s.calendarDate === date).reduce((sum, s) => sum + s.netMinutes, 0)).toBe(160);
    const preceding = { date: "2026-05-30", totalMinutes: 2700, overtimeSegments: [{ netMinutes: 2700, dailyOvertimeMinutes: 0, eligible: false, classification: "workday" as const, multiplier: 1.5 }] };
    expect(calculatePeriodOvertime([preceding, day], { startDate: date, endDate: "2026-06-01", overtimeBasis: "weekly45" }).overtimeMinutes).toBe(160);
  });
  it("gece/tatil segmentlerinde süre molasını oranlar; existingLegal ve yarım tatil desteklenir", () => {
    const day = run([reading("21:00", "entry"), reading("07:01", "exit", addWorkDate(date, 1))], { shift: shift({ flexible: { ...DEFAULT_FLEXIBLE, breakMinutes: 61 } }), overtimeRates: { ...rates, nightShiftDayMode: "splitAtMidnight" } });
    expect(day.breakMinutes + day.totalMinutes).toBe(601);
    expect(day.overtimeSegments.reduce((sum, s) => sum + s.netMinutes, 0)).toBe(day.totalMinutes);
    expect(run([reading("09:00", "entry"), reading("13:00", "exit")], { shift: shift({ flexible: { ...DEFAULT_FLEXIBLE, breakMode: "existingLegal" } }) })).toMatchObject({ totalMinutes: 225, breakMinutes: 15 });
    expect(run([], { holiday: { isHalfDay: true } as Doc<"holidays"> }).requiredNetMinutes).toBe(240);
  });
  it("legacy kurala da ortak kanıt çözümleyicisini uygular", () => {
    const day = run([reading("09:00", "entry")], { policy: LEGACY_PDKS_POLICY });
    expect(day).toMatchObject({ hasAttendance: true, totalMinutes: 0, durationMeasured: false, shortfallMinutes: null });
  });
});

describe("doğrulama ve atama", () => {
  it.each([
    { requiredNetMinutes: 0 }, { requiredNetMinutes: 1.5 }, { maxSpanMinutes: 1441 }, { maxSpanMinutes: 0 },
    { breakMinutes: -1 }, { breakMinutes: 960 }, { breakMinutes: 2.5 }, { breakMinutes: undefined },
    { checkInStart: "22:00", checkInEnd: "05:00" }, { checkInEnd: "24:00" },
    { checkOutEndDayOffset: 2 }, { checkOutEndDayOffset: 0, checkOutEnd: "23:59" },
    { requiredNetMinutes: 950 }, { breakMode: "existingLegal", requiredNetMinutes: 950 },
  ])("geçersiz tanımı reddeder: %j", patch => {
    expect(() => validateFlexible({ ...DEFAULT_FLEXIBLE, ...patch } as FlexibleSchedule)).toThrow();
  });
  it("fixed ve esnek uyumluluk saatlerini ayırır", () => {
    expect(() => validateShift(shift({ startTime: "05:00", endTime: "05:00" }))).not.toThrow();
    expect(() => validateShift({ startTime: "05:00", endTime: "05:00" })).toThrow("aynı");
    expect(shiftTimeLabel(shift())).toBe("Esnek · 8 sa");
  });
  it("çıkış penceresi ve azami oturum atama çakışmasına katılır", () => {
    const range = { startDate: date, endDate: date };
    const flex = shift({ flexible: { ...DEFAULT_FLEXIBLE, checkInStart: "08:00", checkInEnd: "09:00", checkOutEnd: "12:00", maxSpanMinutes: 600 } });
    expect(scheduleIntervals(range, flex)[0][1] - scheduleIntervals(range, flex)[0][0]).toBe(660);
    const fixed = { startTime: "18:00", endTime: "20:00" };
    expect(schedulesOverlap(range, flex, range, fixed)).toBe(true);
    expect(evaluateShiftAssignment({ range, shift: fixed, existing: [{ ...range, assignmentId: "a" as Id<"shiftAssignments">, shiftId: flex._id, shiftName: flex.name, shift: flex }], leaves: [], holidays: [] }).status).toBe("conflict");
  });
});

it("tablo, detay ve bordro aynı esnek alanları döndürür; geç/erken filtresine düşmez", () => {
  const readings = [reading("09:00", "entry"), reading("16:00", "exit")];
  const employee = { _id: employeeId, firstName: "Ada", lastName: "Test", cardNumber: "1", isActive: true } as Doc<"employees">;
  const common = { date, workSettings: DEFAULT_WORK_SETTINGS, workingDays, overtimeRates: rates, availableDateKeys: new Set([date]), policyFor: () => policy, firstRecordDate: date };
  const table = computePdksTableRow({ ...common, empKey: employeeId, empReadings: readings, employee, departmentName: "", periodDateKeys: [date], startDate: date, isSingleDay: true, viewMode: "matrix", manualPdksByEmpDate: new Map(), allLeaves: [], holidayMap: new Map(), resolveShift: () => shift({ breakStart: "12:00", breakEnd: "13:00" }), manualEditedBy: null });
  const detail = computeAttendanceDetailDay({ ...common, dayReadings: readings, manualDay: undefined, leaves: [], holiday: null, dayShift: shift() });
  const payroll = computePayrollCell({ ...common, dayReadings: readings, manual: undefined, hasLeave: false, holiday: null, dayShift: shift(), empHourlyRate: null });
  for (const value of [table, table.days[0], detail, payroll]) expect(value).toMatchObject({ requiredNetMinutes: 480, shortfallMinutes: 120, excessMinutes: 0, totalMinutes: 360, isLate: false });
  expect(table.days[0].detail?.breakViolation).toBe(false);
  expect(filterPdksTableRows([table], "late")).toHaveLength(0);
});


it("tam okuma resolver'ı giriş gününü bulur, dışlanan giriş oturum açamaz", () => {
  const next = addWorkDate(date, 1);
  const employee = { _id: employeeId, cardNumber: "1" } as Doc<"employees">;
  const readings = [reading("21:00", "entry"), reading("06:00", "exit", next), reading("08:00", "entry", next), reading("13:00", "exit", next)];
  const resolver = buildPdksWorkDateResolver([employee], () => shift(), { readings });
  // Arrival order at the resolver does not affect day attribution.
  expect([...readings].reverse().map(resolver)).toEqual([next, next, date, date]);
  const excluded = buildPdksWorkDateResolver([employee], () => shift(), { readings: readings.slice(0, 2), eligibleEntry: () => false });
  expect(excluded(readings[1])).toBe(next);
});

it("manuel gece girişini gerçek ertesi gün çıkışı tamamlar", () => {
  const next = addWorkDate(date, 1);
  const readings = [reading("06:00", "exit", next)];
  const grouped = groupPdksWorkDays(readings, employeeId, () => shift(), (_id, day) => day === date ? "21:00" : undefined);
  expect(grouped.get(date)).toHaveLength(1);
  const day = run(grouped.get(date) ?? [], { manual: { entryTime: "21:00" } as Doc<"pdksRecords"> });
  expect(day).toMatchObject({ durationMeasured: true, totalMinutes: 480, shortfallMinutes: 0 });
});

const modules = import.meta.glob("../**/*.ts");
async function handlerFixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "Esnek testi" });
    const userId = await ctx.db.insert("users", { role: "project_admin" });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 86400000 });
    await ctx.db.insert("userProjects", { projectId, userId });
    await ctx.db.insert("pdksRuleVersions", { projectId, effectiveFrom: "2026-01-01", punchMode: "requirements", checkpointMode: "all", requireCheckIn: true, requireCheckOut: true, missingRequiredPunch: "review", noPunch: "absent", createdAt: "", createdBy: userId });
    return { projectId, userId, sessionId };
  });
  const caller = t.withIdentity({ subject: `${ids.userId}|${ids.sessionId}` });
  return { t, caller, ...ids };
}

it("create doğrular ve uyumluluk saatlerini yazar; esnek update geçmişi sürüme yazar", async () => {
  const f = await handlerFixture();
  const args = { projectId: f.projectId, name: "Esnek", startTime: "00:00", endTime: "00:00", scheduleType: "flexible" as const, flexible: DEFAULT_FLEXIBLE };
  const id = await f.caller.mutation(api.shifts.create, args);
  expect(await f.t.run(ctx => ctx.db.get(id))).toMatchObject({ startTime: "05:00", endTime: "22:00", flexible: DEFAULT_FLEXIBLE });
  await expect(f.caller.mutation(api.shifts.create, { ...args, flexible: { ...DEFAULT_FLEXIBLE, checkInEnd: "24:00" } })).rejects.toThrow("HH:MM");
  await f.caller.mutation(api.shifts.update, { shiftId: id, flexible: { ...DEFAULT_FLEXIBLE, requiredNetMinutes: 420 } });
  expect(await f.t.run(ctx => ctx.db.query("shiftVersions").collect())).toMatchObject([{ shiftId: id, rules: { flexible: { requiredNetMinutes: 480 } } }]);
  const fixedId = await f.caller.mutation(api.shifts.create, { projectId: f.projectId, name: "Sabit", startTime: "08:00", endTime: "17:00" });
  await f.caller.mutation(api.shifts.update, { shiftId: fixedId, endTime: "18:00" });
  expect(await f.t.run(ctx => ctx.db.get(fixedId))).toMatchObject({ endTime: "18:00" });
});

it("gerçek tablo/detay/bordro handler'ları manuel gece girişini aynı gün hesaplar", async () => {
  const f = await handlerFixture();
  const employeeId = await f.t.run(async ctx => {
    const { _id: _unused, _creationTime: _creation, ...fields } = shift();
    const shiftId = await ctx.db.insert("shifts", { ...fields, projectId: f.projectId });
    const employeeId = await ctx.db.insert("employees", { projectId: f.projectId, shiftId, firstName: "Ada", lastName: "Test", email: "ada@test", cardNumber: "1", isActive: true });
    await ctx.db.insert("shiftAssignments", { projectId: f.projectId, employeeId, shiftId, startDate: "2026-01-01", endDate: "2026-12-31", createdAt: "", updatedAt: "" });
    await ctx.db.insert("pdksRecords", { projectId: f.projectId, employeeId, employeeFirstName: "Ada", employeeLastName: "Test", date, entryTime: "21:00", manualEntry: true, status: "present", createdAt: "", updatedAt: "" });
    const { _id: _readingId, _creationTime: _readingCreation, ...raw } = reading("06:00", "exit", addWorkDate(date, 1));
    await ctx.db.insert("cardReadings", { ...raw, employeeId, projectId: f.projectId });
    return employeeId;
  });
  const table = await f.caller.query(api.cardReadings.getPdksTableData, { projectId: f.projectId, startDate: date, endDate: date, viewMode: "matrix" });
  const detail = await f.caller.query(api.cardReadings.getEmployeeAttendanceDetail, { projectId: f.projectId, employeeId, startDate: date, endDate: date });
  const payroll = await f.caller.query(api.cardReadings.getMonthlyPayrollSheet, { projectId: f.projectId, year: 2026, month: 6 });
  for (const cell of [table[0]?.days[0], detail?.days[0], payroll.rows[0]?.cells.find(c => c.date === date)]) expect(cell).toMatchObject({ totalMinutes: 480, requiredNetMinutes: 480, shortfallMinutes: 0, excessMinutes: 0, durationMeasured: true });
});

it("gece son çıkışı kullanır; süresi dolan önceki oturum yeni günü incelemeye çevirmez", () => {
  const next = addWorkDate(date, 1);
  const grouped = groupPdksWorkDays([reading("21:00", "entry"), reading("06:00", "exit", next), reading("07:00", "exit", next)], employeeId, () => shift());
  expect(run(grouped.get(date) ?? [])).toMatchObject({ totalMinutes: 540, overtimeMinutes: 60 });
  const later = groupPdksWorkDays([reading("05:00", "entry"), reading("09:00", "entry", next), reading("18:00", "exit", next)], employeeId, () => shift());
  expect(run(later.get(next) ?? [], { date: next })).toMatchObject({ attendanceDecision: "present", totalMinutes: 480 });
});

it("legacy yönsüz çifti de azami oturum sınırını aşamaz", () => {
  const readings = undirected(reading("05:00", "entry"), reading("22:00", "exit"));
  expect(run(readings, { policy: LEGACY_PDKS_POLICY })).toMatchObject({ durationMeasured: false, totalMinutes: 0, shortfallMinutes: null });
});

it("24 saatlik oturumda iki gece parçasının yuvarlaması net dakikayı korur", () => {
  const day = run([reading("05:00", "entry"), reading("05:00", "exit", addWorkDate(date, 1))], { shift: shift({ flexible: { ...DEFAULT_FLEXIBLE, maxSpanMinutes: 1440, breakMinutes: 61 } }), overtimeRates: { ...rates, nightShiftMultiplier: 3 } });
  expect(day.totalMinutes).toBe(1379);
  const nightNet = day.overtimeSegments.filter(segment => segment.multiplier === 3).reduce((sum, segment) => sum + segment.netMinutes, 0);
  expect(day.nightMinutes).toBe(nightNet);
});


it("dashboard geç/erken eşikleri esnek pencere saatlerini vardiya saati saymaz", () => {
  const thresholds = thresholdsForShift(shift(), DEFAULT_WORK_SETTINGS);
  expect(thresholds.lateThresholdMin).toBeGreaterThanOrEqual(1440);
  expect(thresholds.earlyThresholdMin).toBeLessThanOrEqual(0);
});

it.each(["sabit-esnek", "esnek-sabit"] as const)("D1: %s gece geçişinde giriş ve çıkış D'de kalır", transition => {
  const next = addWorkDate(date, 1);
  const fixed = shift({ scheduleType: "fixed", flexible: undefined, startTime: "22:00", endTime: "06:00" });
  const resolve = (_id: Id<"employees">, day: string) => (day === date) === (transition === "sabit-esnek") ? fixed : shift();
  const readings = [reading("22:00", "entry"), reading("06:00", "exit", next)];
  const grouped = groupPdksWorkDays(readings, employeeId, resolve);
  expect(grouped.get(date)).toEqual(readings);
  expect(grouped.has(next)).toBe(false);
});

it("D2: giriş penceresi dışındaki yönsüz gece çıkışı açık legacy oturumu bir kez kapatır", () => {
  const next = addWorkDate(date, 1);
  const flex = shift({ flexible: { ...DEFAULT_FLEXIBLE, checkInStart: "08:00" } });
  const readings = undirected(reading("22:00", "entry"), reading("06:30", "exit", next));
  const grouped = groupPdksWorkDays(readings, employeeId, () => flex);
  expect(grouped.size).toBe(1);
  expect(grouped.get(date)).toEqual(readings);
  expect(run(grouped.get(date) ?? [], { shift: flex, policy: LEGACY_PDKS_POLICY }))
    .toMatchObject({ attendanceDecision: "present", durationMeasured: true, totalMinutes: 450, breakMinutes: 60, exitNextDay: true });
});

it.each([["06:31", 451], ["07:00", 480]] as const)("D2: yönsüz gece kuyruğundaki tekrar okutma (%s) D'de kalır, D+1'e sahte gün yazmaz", (repeat, totalMinutes) => {
  const next = addWorkDate(date, 1);
  const flex = shift({ flexible: { ...DEFAULT_FLEXIBLE, checkInStart: "08:00" } });
  const readings = undirected(reading("22:00", "entry"), reading("06:30", "exit", next), reading(repeat, "exit", next));
  const grouped = groupPdksWorkDays(readings, employeeId, () => flex);
  expect(grouped.size).toBe(1);
  expect(grouped.get(date)).toEqual(readings);
  expect(grouped.has(next)).toBe(false);
  expect(run(grouped.get(date) ?? [], { shift: flex, policy: LEGACY_PDKS_POLICY }))
    .toMatchObject({ attendanceDecision: "present", durationMeasured: true, totalMinutes, exitNextDay: true });
});

it("D2: kapanmış yönsüz gece kuyruğundan sonra D+1 giriş penceresindeki okuma yeni günü açar, D'yi incelemeye almaz", () => {
  const next = addWorkDate(date, 1);
  const flex = shift({ flexible: { ...DEFAULT_FLEXIBLE, checkInStart: "08:00" } });
  const readings = undirected(reading("22:00", "entry"), reading("06:30", "exit", next), reading("08:30", "entry", next));
  const grouped = groupPdksWorkDays(readings, employeeId, () => flex);
  expect(grouped.get(date)).toEqual(readings.slice(0, 2));
  expect(grouped.get(next)).toEqual(readings.slice(2));
  expect([...grouped.values()].flat().some(r => "flexibleConflict" in r)).toBe(false);
});

it.each(["legacy", "requirements"] as const)("D2: belirsiz yönsüz gece okuması iki %s gününü incelemeye alır", punchMode => {
  const next = addWorkDate(date, 1);
  const readings = undirected(reading("22:00", "entry"), reading("06:30", "exit", next));
  const grouped = groupPdksWorkDays(readings, employeeId, () => shift());
  expect(grouped.size).toBe(2);
  for (const day of [date, next]) {
    expect(grouped.get(day)).toHaveLength(1);
    expect(grouped.get(day)?.[0]).toHaveProperty("flexibleConflict", true);
    expect(run(grouped.get(day) ?? [], { date: day, policy: { ...policy, punchMode } }))
      .toMatchObject({ attendanceDecision: "incomplete", hasAttendance: false, durationMeasured: false, shortfallMinutes: null, totalMinutes: 0 });
  }
});

it("N2: kendi gününde kapanan esnek oturum maxSpan 1400 iken D+1 girişsiz çıkışı yutmaz", () => {
  const next = addWorkDate(date, 1);
  const flex = shift({ flexible: { ...DEFAULT_FLEXIBLE, maxSpanMinutes: 1400 } });
  const readings = [reading("09:00", "entry"), reading("18:00", "exit"), reading("07:00", "exit", next)];
  const grouped = groupPdksWorkDays(readings, employeeId, () => flex);
  expect(grouped.get(date)).toEqual(readings.slice(0, 2));
  expect(run(grouped.get(date) ?? [], { shift: flex })).toMatchObject({ totalMinutes: 480, durationMeasured: true });
  expect(grouped.get(next)).toEqual(readings.slice(2));
  expect(run(grouped.get(next) ?? [], { date: next, shift: flex })).toMatchObject({ punchQuality: "missingEntry", attendanceDecision: "incomplete" });
});

it("N2: D+1'de kapanan gece kuyruğunun ardışık çıkışları son çıkışı korur", () => {
  const next = addWorkDate(date, 1);
  const flex = shift({ flexible: { ...DEFAULT_FLEXIBLE, maxSpanMinutes: 1400 } });
  const readings = [reading("22:00", "entry"), reading("06:00", "exit", next), reading("07:00", "exit", next)];
  const grouped = groupPdksWorkDays(readings, employeeId, () => flex);
  expect(grouped.get(date)).toEqual(readings);
  expect(grouped.has(next)).toBe(false);
  expect(run(grouped.get(date) ?? [], { shift: flex })).toMatchObject({ totalMinutes: 480, durationMeasured: true });
});

it("N3: yalnız manuel 10:00 çıkışı kayıt tarihinde kalır", () => {
  const manual = { exitTime: "10:00", manualEntry: true } as Doc<"pdksRecords">;
  expect(manualPdksTimes(date, manual, shift())).toEqual({ entryISO: undefined, exitISO: `${date}T10:00:00.000+03:00`, exitNextDay: false });
  expect(run([], { manual })).toMatchObject({ firstISO: null, lastISO: new Date(`${date}T10:00:00+03:00`).toISOString(), exitNextDay: false, punchQuality: "missingEntry" });
});

it("D2: dışlanan yönsüz giriş önceki gece oturumu açamaz", () => {
  const next = addWorkDate(date, 1);
  const employee = { _id: employeeId, cardNumber: "1" } as Doc<"employees">;
  const flex = shift({ flexible: { ...DEFAULT_FLEXIBLE, checkInStart: "08:00" } });
  const readings = undirected(reading("22:00", "entry"), reading("06:30", "exit", next));
  const resolver = buildPdksWorkDateResolver([employee], () => flex, { readings, eligibleEntry: () => false });
  expect(readings.map(resolver)).toEqual([date, next]);
});
