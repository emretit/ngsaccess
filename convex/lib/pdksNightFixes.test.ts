// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Doc, Id } from "../_generated/dataModel";
import { api } from "../_generated/api";
import schema from "../schema";
import { computePdksDay } from "./pdksDay";
import { addWorkDate, buildPdksWorkDateResolver, groupPdksWorkDays, manualPdksTimes } from "./pdksWorkDay";
import { DEFAULT_FLEXIBLE, validateFlexible } from "./pdksFlexible";
import { DEFAULT_WORK_SETTINGS } from "./pdksHelpers";
import { LEGACY_PDKS_POLICY } from "./pdksRules";
import { classifyPdksDay } from "./pdksTable";
import { createShiftResolver } from "./shiftResolver";
import { manualValidationShift } from "./pdksManualWrite";

const modules = import.meta.glob("../**/*.ts");
const date = "2026-12-31", next = addWorkDate(date, 1);
const employeeId = "e" as Id<"employees">;
const projectId = "p" as Id<"projects">;
const shift: Doc<"shifts"> = {
  _id: "s" as Id<"shifts">, _creationTime: 0, projectId, name: "Gece",
  startTime: "22:00", endTime: "06:00", createdAt: "", updatedAt: "",
};
const window = { checkInStart: "21:00", checkInEnd: "23:00", checkOutStart: "00:00", checkOutEnd: "07:00", checkOutEndDayOffset: 1 as const };
const fixed = { ...shift, validWindow: window };
const flexible: Doc<"shifts"> = { ...shift, scheduleType: "flexible", flexible: {
  ...DEFAULT_FLEXIBLE, ...window, requiredNetMinutes: 360, breakMinutes: 0,
} };
const policy = { ...LEGACY_PDKS_POLICY, punchMode: "requirements" as const, calculationMode: "eachPunch" as const,
  requireCheckIn: true, requireCheckOut: true, missingRequiredPunch: "review" as const, noPunch: "absent" as const };
const employee: Doc<"employees"> = { _id: employeeId, _creationTime: 0, projectId, firstName: "Test", lastName: "Gece", email: "test@test", cardNumber: "e" };
function reading(day: string, time: string, direction: "entry" | "exit"): Doc<"cardReadings"> {
  return { _id: `${day}${time}` as Id<"cardReadings">, _creationTime: 0, employeeId, projectId, cardNo: "e",
    accessStatus: "izin_verildi", accessTime: new Date(`${day}T${time}:00+03:00`).toISOString(), direction };
}
const visits = [reading(date, "22:00", "entry"), reading(next, "02:00", "exit"), reading(next, "03:00", "entry"), reading(next, "06:00", "exit")];
function run(schedule: Doc<"shifts">, rows = visits, calculationMode: "eachPunch" | "firstLast" = "eachPunch") {
  const dayPolicy = { ...policy, calculationMode };
  const grouped = groupPdksWorkDays(rows, employeeId, () => schedule, undefined, undefined, undefined, () => dayPolicy);
  return computePdksDay({ date, readings: grouped.get(date) ?? [], shift: schedule, policy: dayPolicy, workSettings: DEFAULT_WORK_SETTINGS });
}
afterEach(() => vi.useRealTimers());

describe("night visit windows preserve session boundaries", () => {
  it.each([fixed, flexible])("N1/N2: two visits on year boundary retain 420 minutes ($scheduleType)", schedule => {
    if (schedule.flexible) validateFlexible(schedule.flexible);
    expect(run(schedule)).toMatchObject({ rawTotalMinutes: 420, totalMinutes: 420, breakMinutes: 0,
      exitNextDay: true, punchQuality: "ok", attendanceDecision: "present" });
  });
  it.each([fixed, flexible])("a first entry outside its window cannot open a return session", schedule => {
    const rows = [reading(date, "23:30", "entry"), ...visits.slice(1)];
    expect(run(schedule, rows)).toMatchObject({ totalMinutes: 0, durationMeasured: false, attendanceDecision: schedule.scheduleType === "flexible" ? "absent" : "incomplete" });
  });
  it.each([fixed, flexible])("a return beyond checkout cutoff is excluded", schedule => {
    const rows = visits.slice(0, 2).concat(reading(next, "07:01", "entry"), reading(next, "08:00", "exit"));
    const day = run(schedule, rows);
    expect(day.rawTotalMinutes).toBe(240);
    expect(day.lastISO).toBe(visits[1]?.accessTime);
    const expectedBreak = schedule.scheduleType === "flexible" ? 0 : 15;
    expect(day.breakMinutes).toBe(expectedBreak);
    expect(day.totalMinutes).toBe(240 - expectedBreak);
  });
  it("N2: maxSpan still excludes an otherwise in-window return", () => {
    const limited = { ...flexible, flexible: { ...flexible.flexible ?? DEFAULT_FLEXIBLE, maxSpanMinutes: 240, requiredNetMinutes: 120 } };
    validateFlexible(limited.flexible);
    expect(run(limited)).toMatchObject({ totalMinutes: 240, punchQuality: "ok" });
    const grouped = groupPdksWorkDays(visits, employeeId, () => limited, undefined, undefined, undefined, () => policy);
    expect(grouped.get(next)?.map(r => r.direction)).toEqual(["entry", "exit"]);
  });
  it("N2: a next-day flexible assignment competing for a return is a visible conflict", () => {
    const morning = { ...flexible, flexible: { ...DEFAULT_FLEXIBLE, checkInStart: "03:00", checkInEnd: "04:00" } };
    const resolve = (_id: Id<"employees">, day: string) => day === date ? flexible : morning;
    const grouped = groupPdksWorkDays(visits, employeeId, resolve, undefined, undefined, undefined, () => policy);
    const day = computePdksDay({ date, readings: grouped.get(date) ?? [], shift: flexible, policy, workSettings: DEFAULT_WORK_SETTINGS });
    expect(day).toMatchObject({ attendanceDecision: "incomplete", punchQuality: "undirected", durationMeasured: false });
    expect(grouped.get(next)?.some(r => r.accessTime === visits[2]?.accessTime)).toBe(true);
    expect(classifyPdksDay({ date, today: next, now: Date.parse(`${next}T04:00:00+03:00`), dataAvailable: true,
      classification: day.classification, hasAttendance: day.hasAttendance, hasLeave: false, isLate: false,
      pendingUntil: day.pendingUntil, durationMeasured: day.durationMeasured, punchQuality: day.punchQuality, attendanceDecision: day.attendanceDecision })).toBe("incomplete");
  });
  it("N2: a next-day fixed assignment keeps its actual entry", () => {
    const morning = { ...shift, startTime: "03:00", endTime: "10:00" };
    const resolve = (_id: Id<"employees">, day: string) => day === date ? flexible : morning;
    const grouped = groupPdksWorkDays(visits, employeeId, resolve, undefined, undefined, undefined, () => policy);
    expect(grouped.get(next)?.map(r => r.direction)).toEqual(["entry", "exit"]);
    const day = computePdksDay({ date, readings: grouped.get(date) ?? [], shift: flexible, policy, workSettings: DEFAULT_WORK_SETTINGS });
    expect(day.punchQuality).toBe("undirected");
  });
  it("N2: firstLast retains its existing overnight return semantics", () => {
    expect(run(flexible, visits, "firstLast")).toMatchObject({ rawTotalMinutes: 480, totalMinutes: 480 });
    expect(run(fixed, visits, "firstLast").attendanceDecision).toBe("incomplete");
  });
  it("N2: excluded checkpoint entries cannot create or reopen a session", () => {
    const allowed = "allowed" as Id<"devices">, excluded = "excluded" as Id<"devices">;
    const sourcePolicy = { ...policy, checkpointMode: "selected" as const, targets: [{ targetType: "device" as const, deviceId: allowed }] };
    const rows = visits.map((r, i) => ({ ...r, deviceId: i === 2 ? excluded : allowed }));
    const resolve = buildPdksWorkDateResolver([employee], () => flexible, { readings: rows }, () => sourcePolicy);
    expect(rows.map(resolve)).toEqual([date, date, next, date]);
  });
});

describe("N3: date-only manual night exit", () => {
  it("anchors a dated fixed assignment across the year without inventing entry evidence", () => {
    const dayShift = { ...shift, _id: "day" as Id<"shifts">, startTime: "09:00", endTime: "18:00" };
    const assignment = { _id: "a" as Id<"shiftAssignments">, _creationTime: 0, projectId, employeeId, shiftId: shift._id,
      startDate: date, endDate: date, createdAt: "", updatedAt: "" };
    const resolver = createShiftResolver([{ ...employee, shiftId: dayShift._id }], [shift, dayShift], [[assignment]]);
    const dated = manualValidationShift(resolver, employee, date);
    expect(dated?._id).toBe(shift._id);
    const manual: Doc<"pdksRecords"> = { _id: "m" as Id<"pdksRecords">, _creationTime: 0, employeeId, date,
      employeeFirstName: "Test", employeeLastName: "Gece", exitTime: "06:00", status: "present", manualEntry: true, createdAt: "", updatedAt: "" };
    const day = computePdksDay({ date, readings: [], manual, shift: dated, policy, workSettings: DEFAULT_WORK_SETTINGS });
    expect(day).toMatchObject({ firstISO: null, exitNextDay: true, punchQuality: "missingEntry", totalMinutes: 0 });
    expect(Date.parse(day.lastISO ?? "")).toBe(Date.parse(`${next}T06:00:00+03:00`));
  });
  it("does not shift an entryless flexible manual exit to tomorrow", () => {
    expect(manualPdksTimes(date, { exitTime: "06:00" }, flexible)).toMatchObject({ exitNextDay: false, entryISO: undefined, exitISO: `${date}T06:00:00.000+03:00` });
  });
});

it("N4: measured overnight visit stays pending while required final exit is open", () => {
  const schedule = { ...flexible, flexible: { ...flexible.flexible ?? DEFAULT_FLEXIBLE, checkInEnd: "23:59" } };
  validateFlexible(schedule.flexible);
  const day = run(schedule, [reading(date, "22:00", "entry"), reading(date, "23:00", "exit"), reading(date, "23:30", "entry")]);
  expect(day).toMatchObject({ totalMinutes: 60, durationMeasured: true, punchQuality: "missingExit" });
  const input = { date, today: next, dataAvailable: true, firstRecordDate: date, classification: day.classification,
    hasAttendance: day.hasAttendance, hasLeave: false, isLate: false, pendingUntil: day.pendingUntil,
    durationMeasured: day.durationMeasured, punchQuality: day.punchQuality, attendanceDecision: day.attendanceDecision };
  expect(classifyPdksDay({ ...input, now: Date.parse(`${next}T01:00:00+03:00`) })).toBe("future");
  expect(classifyPdksDay({ ...input, now: Date.parse(`${next}T07:00:01+03:00`) })).toBe("incomplete");
  expect(classifyPdksDay({ ...input, now: Date.parse(`${next}T01:00:00+03:00`), punchQuality: "undirected" })).toBe("incomplete");
});

async function fixture(schedule: Doc<"shifts">) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-12-01T12:00:00Z"));
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const project = await ctx.db.insert("projects", { name: "Audit" });
    const user = await ctx.db.insert("users", { role: "super_admin" });
    const session = await ctx.db.insert("authSessions", { userId: user, expirationTime: Date.now() + 100 * 86400000 });
    const { _id: _shiftId, _creationTime: _created, ...fields } = schedule;
    const shiftId = await ctx.db.insert("shifts", { ...fields, projectId: project });
    const eid = await ctx.db.insert("employees", { projectId: project, firstName: "Audit", lastName: "Night", email: "audit@test", cardNumber: "audit", isActive: true });
    await ctx.db.insert("shiftAssignments", { projectId: project, employeeId: eid, shiftId, startDate: date, endDate: next, createdAt: "", updatedAt: "" });
    const deviceId = await ctx.db.insert("devices", { projectId: project, name: "Panel", brand: "ide_smart", createdAt: "", updatedAt: "" });
    return { project, user, session, eid, deviceId };
  });
  const caller = t.withIdentity({ subject: `${ids.user}|${ids.session}` });
  await caller.mutation(api.pdksRules.publishRuleVersion, { projectId: ids.project, effectiveFrom: date, ...policy, targets: [...policy.targets] });
  const put = (rows: Doc<"cardReadings">[]) => t.run(async ctx => {
    for (const r of rows) await ctx.db.insert("cardReadings", { projectId: ids.project, employeeId: ids.eid,
      deviceId: ids.deviceId, cardNo: "audit", accessTime: r.accessTime, accessStatus: r.accessStatus, direction: r.direction });
  });
  const query = async () => {
    const args = { projectId: ids.project, startDate: date, endDate: date };
    const [table, detail, payroll] = await Promise.all([
      caller.query(api.cardReadings.getPdksTableData, { ...args, viewMode: "matrix" }),
      caller.query(api.cardReadings.getEmployeeAttendanceDetail, { ...args, employeeId: ids.eid }),
      caller.query(api.cardReadings.getMonthlyPayrollSheet, { projectId: ids.project, year: 2026, month: 12 }),
    ]);
    return { table: table[0]?.days[0], detail: detail?.days[0], payroll: payroll.rows[0]?.cells.find(c => c.date === date) };
  };
  return { t, ids, caller, put, query };
}
it.each([fixed, flexible])("N1/N2: normal table/detail/payroll retain both night visits ($scheduleType)", async schedule => {
  const f = await fixture(schedule);
  await f.put(visits);
  vi.setSystemTime(new Date("2027-01-02T12:00:00Z"));
  const result = await f.query();
  for (const cell of Object.values(result)) expect(cell).toMatchObject({ totalMinutes: 420, rawTotalMinutes: 420, punchQuality: "ok", status: "present" });
  expect(result.detail).toMatchObject({ exitNextDay: true, plannedExitReferenceTime: schedule.scheduleType === "flexible" ? null : "22:00" });
});
it("N4: all status callers preserve partial minutes before and after pending deadline", async () => {
  const f = await fixture({ ...flexible, flexible: { ...flexible.flexible ?? DEFAULT_FLEXIBLE, checkInEnd: "23:59" } });
  await f.put([reading(date, "22:00", "entry"), reading(date, "23:00", "exit"), reading(date, "23:30", "entry")]);
  vi.setSystemTime(new Date(`${next}T01:00:00+03:00`));
  for (const cell of Object.values(await f.query())) expect(cell).toMatchObject({ totalMinutes: 60, status: "future", punchQuality: "missingExit" });
  vi.setSystemTime(new Date(`${next}T07:00:01+03:00`));
  for (const cell of Object.values(await f.query())) expect(cell).toMatchObject({ totalMinutes: 60, status: "incomplete", punchQuality: "missingExit" });
});
it("N3: exit-only upsert uses the dated night and leaves missing entry visible in all DTOs", async () => {
  const f = await fixture(shift);
  vi.setSystemTime(new Date("2027-01-02T12:00:00Z"));
  await f.caller.mutation(api.pdksRecords.upsertManual, { employeeId: f.ids.eid, date, exitTime: "06:00", note: "Çıkış düzeltmesi" });
  const result = await f.query();
  for (const cell of Object.values(result)) expect(cell).toMatchObject({ totalMinutes: 0, punchQuality: "missingEntry", status: "incomplete" });
  expect(result.detail).toMatchObject({ exitNextDay: true, firstEntry: null, lastExit: "06:00", plannedExitReferenceTime: "22:00" });
});
it("N2: the start-day source version owns returns even when tomorrow excludes that device", async () => {
  const f = await fixture(flexible);
  const tomorrowDevice = await f.t.run(ctx => ctx.db.insert("devices", { projectId: f.ids.project, name: "Tomorrow", brand: "ide_smart", createdAt: "", updatedAt: "" }));
  await f.caller.mutation(api.pdksRules.publishRuleVersion, { projectId: f.ids.project, effectiveFrom: next,
    ...policy, calculationMode: "firstLast", checkpointMode: "selected",
    targets: [{ targetType: "device", deviceId: tomorrowDevice, pointType: "entry" }] });
  await f.put(visits);
  vi.setSystemTime(new Date("2027-01-02T12:00:00Z"));
  for (const cell of Object.values(await f.query())) expect(cell).toMatchObject({ totalMinutes: 420, rawTotalMinutes: 420, status: "present", punchQuality: "ok" });
});
it("N2: a caller-excluded entry never opens yesterday's session", () => {
  const resolve = buildPdksWorkDateResolver([employee], () => flexible, { readings: visits, eligibleEntry: () => false }, () => policy);
  expect(visits.map(resolve)).toEqual([date, next, next, next]);
});

it("N2: a visit closed before midnight can reopen on its original night", async () => {
  const f = await fixture(flexible);
  await f.put([reading(date, "22:00", "entry"), reading(date, "23:00", "exit"), reading(next, "03:00", "entry"), reading(next, "06:00", "exit")]);
  vi.setSystemTime(new Date("2027-01-02T12:00:00Z"));
  for (const cell of Object.values(await f.query())) expect(cell).toMatchObject({ totalMinutes: 240, rawTotalMinutes: 240, status: "present", punchQuality: "ok" });
});
it("N2: a next-day orphan exit still cannot extend a visit closed before midnight", () => {
  const rows = [reading(date, "22:00", "entry"), reading(date, "23:00", "exit"), reading(next, "06:00", "exit")];
  expect(run(flexible, rows)).toMatchObject({ totalMinutes: 60, punchQuality: "ok", attendanceDecision: "present" });
  const grouped = groupPdksWorkDays(rows, employeeId, () => flexible, undefined, undefined, undefined, () => policy);
  expect(grouped.get(next)?.map(r => r.direction)).toEqual(["exit"]);
});
it("N2: firstLast still closes its original day before midnight", () => {
  expect(run(flexible, [reading(date, "22:00", "entry"), reading(date, "23:00", "exit"), reading(next, "03:00", "entry"), reading(next, "06:00", "exit")], "firstLast")).toMatchObject({ totalMinutes: 60, rawTotalMinutes: 60 });
});
