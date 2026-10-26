// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { effectiveDirection, LEGACY_PDKS_POLICY, loadPdksRulePolicy, matchesPdksCheckpoint, resolvePdksCheckpoint, type PdksDayPolicy } from "./lib/pdksRules";
import { filterPdksReadings } from "./lib/pdksSource";
import { DEFAULT_FLEXIBLE } from "./lib/pdksFlexible";
import { resolveAttendanceEvidence } from "./lib/pdksEvidence";
import { computePdksDay } from "./lib/pdksDay";
import { DEFAULT_WORK_SETTINGS } from "./lib/pdksHelpers";
import type { Doc } from "./_generated/dataModel";
import { summarizeMovements } from "./lib/mobileAttendance";
import { parseCardReaderBody } from "./lib/cardReaderParse";

const modules = import.meta.glob("./**/*.ts");
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-22T12:00:00Z")); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
const deviceId = "device" as Id<"devices">;
const policy: PdksDayPolicy = { ...LEGACY_PDKS_POLICY, checkpointMode: "selected", targets: [
  { targetType: "device", deviceId, pointType: "entry" },
  { targetType: "door", deviceId, ioId: 2, pointType: "exit" },
  { targetType: "reader", deviceId, hikReaderNo: 4, pointType: "both" },
] };
it("reader > door > device, both masks a broader override, and unmatched reader fails closed", () => {
  const reading = { deviceId, ideIoId: 2, hikCardReaderNo: 4, direction: "entry" as const };
  for (const targets of [policy.targets, [...policy.targets].reverse()]) {
    expect(resolvePdksCheckpoint(reading, { ...policy, targets })?.targetType).toBe("reader");
    expect(effectiveDirection(reading, { ...policy, targets })).toBe("entry");
  }
  expect(effectiveDirection({ ...reading, hikCardReaderNo: 3 }, policy)).toBe("exit");
  expect(effectiveDirection({ ...reading, hikCardReaderNo: 3, ideIoId: 1, direction: "exit" }, policy)).toBe("entry");
  const readerOnly = { ...policy, targets: [policy.targets[2]] };
  expect(matchesPdksCheckpoint({ deviceId }, readerOnly)).toBe(false);
  expect(matchesPdksCheckpoint({ deviceId: "other", hikCardReaderNo: 4 }, readerOnly)).toBe(false);
  expect(matchesPdksCheckpoint({ deviceId, ideIoId: 2 }, { ...policy, targets: [{ targetType: "reader", deviceId, ioId: 2 }] })).toBe(true);
});
it("all, untyped and both preserve entry/exit/undefined without mutating stored readings", () => {
  for (const direction of ["entry", "exit", undefined] as const) {
    const reading = { deviceId, direction, cardNo: "test" };
    for (const unchanged of [LEGACY_PDKS_POLICY, { ...policy, checkpointMode: "all" as const }, { ...policy, targets: [{ targetType: "device" as const, deviceId }] }]) {
      expect(effectiveDirection(reading, unchanged)).toBe(direction);
      expect(filterPdksReadings([reading], undefined, () => unchanged)[0]).toBe(reading);
    }
    const result = filterPdksReadings([reading], undefined, () => ({ ...policy, targets: [{ targetType: "device", deviceId, pointType: "exit" }] }));
    expect(result[0]?.direction).toBe("exit");
    expect(reading.direction).toBe(direction);
  }
});
async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "Test" });
    const userId = await ctx.db.insert("users", { role: "super_admin" });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 100 * 86400000 });
    const shiftId = await ctx.db.insert("shifts", { projectId, name: "Vardiya", startTime: "08:00", endTime: "17:00", createdAt: "", updatedAt: "" });
    const employeeId = await ctx.db.insert("employees", { projectId, firstName: "Test", lastName: "Test", email: "test@example.test", cardNumber: "TEST", isActive: true, shiftId });
    await ctx.db.insert("shiftAssignments", { projectId, employeeId, shiftId, startDate: "2026-01-01", endDate: "2026-12-31", createdAt: "", updatedAt: "" });
    const deviceId = await ctx.db.insert("devices", { projectId, name: "Panel", brand: "hikvision", doorCount: 2, hikDevIndex: "dev-test", apiToken: "test-token", createdAt: "", updatedAt: "" });
    const doorId = await ctx.db.insert("doors", { projectId, deviceId, name: "Kapı" });
    const readerId = await ctx.db.insert("readers", { projectId, deviceId, doorId, name: "İç okuyucu", direction: "exit", hikReaderNo: 2, createdAt: "", updatedAt: "" });
    return { projectId, userId, sessionId, shiftId, employeeId, deviceId, doorId, readerId };
  });
  const caller = t.withIdentity({ subject: `${ids.userId}|${ids.sessionId}` });
  const args = { projectId: ids.projectId, effectiveFrom: "2026-10-23", punchMode: "requirements" as const, requireCheckIn: true, requireCheckOut: true, missingRequiredPunch: "review" as const, noPunch: "absent" as const, checkpointMode: "selected" as const, targets: [
    { targetType: "device" as const, deviceId: ids.deviceId, pointType: "both" as const },
    { targetType: "reader" as const, deviceId: ids.deviceId, doorId: ids.doorId, readerId: ids.readerId, pointType: "exit" as const },
  ] };
  return { t, caller, args, ...ids };
}
it("publishes reader metadata, rejects duplicate and foreign readers, preloads matching without per-reading DB queries", async () => {
  const f = await fixture();
  await f.caller.mutation(api.pdksRules.publishRuleVersion, f.args);
  expect((await f.caller.query(api.pdksRules.listCheckpointTargets, { projectId: f.projectId })).readers).toMatchObject([{ readerId: f.readerId, hikReaderNo: 2, direction: "exit", selectable: true }]);
  await expect(f.caller.mutation(api.pdksRules.publishRuleVersion, { ...f.args, targets: [f.args.targets[1], f.args.targets[1]] })).rejects.toThrow("birden fazla");
  const doorless = { targetType: "door" as const, deviceId: f.deviceId, pointType: "entry" as const };
  await expect(f.caller.mutation(api.pdksRules.publishRuleVersion, { ...f.args, targets: [doorless, doorless] })).rejects.toThrow("Kapı seçimi zorunludur");
  await f.t.run(async ctx => {
    const policyFor = await loadPdksRulePolicy(ctx, f.projectId, "2026-10-23", "2026-10-24");
    expect(effectiveDirection({ deviceId: f.deviceId, hikCardReaderNo: 2, direction: "entry" }, policyFor("2026-10-23"))).toBe("exit");
    const foreign = await ctx.db.insert("projects", { name: "Other" });
    await ctx.db.patch(f.readerId, { projectId: foreign });
  });
  await expect(f.caller.mutation(api.pdksRules.publishRuleVersion, f.args)).rejects.toThrow("Okuyucu bu proje");
});
it.each(["day", "night", "flexibleNight"] as const)("entry stored on exit-only reader is exit across table/detail/payroll/report: %s", async mode => {
  const f = await fixture();
  await f.caller.mutation(api.pdksRules.publishRuleVersion, f.args);
  if (mode !== "day") {
    // Next calendar day's rule must not override the shift-start day's reader type.
    await f.caller.mutation(api.pdksRules.publishRuleVersion, { ...f.args, effectiveFrom: "2026-10-24", targets: [{ targetType: "device", deviceId: f.deviceId, pointType: "entry" }] });
    await f.t.run(ctx => ctx.db.patch(f.shiftId, { startTime: "22:00", endTime: "06:00", ...(mode === "flexibleNight" ? { scheduleType: "flexible" as const, flexible: { ...DEFAULT_FLEXIBLE } } : {}) }));
  }
  const entry = mode === "day" ? "2026-10-23T05:00:00.000Z" : "2026-10-23T19:00:00.000Z";
  const exit = mode === "day" ? "2026-10-23T14:00:00.000Z" : "2026-10-24T03:00:00.000Z";
  await f.t.run(async ctx => {
    for (const [accessTime, hikCardReaderNo] of [[entry, 1], [exit, 2]] as const) await ctx.db.insert("cardReadings", { projectId: f.projectId, employeeId: f.employeeId, deviceId: f.deviceId, cardNo: "TEST", hikMajorEventType: 5, hikSubEventType: 1, hikCardReaderNo, accessTime, accessStatus: "izin_verildi", direction: "entry" });
  });
  vi.setSystemTime(new Date("2026-11-01T12:00:00Z"));
  const [table, detail, payroll, report] = await Promise.all([
    f.caller.query(api.cardReadings.getPdksTableData, { projectId: f.projectId, startDate: "2026-10-23", endDate: "2026-10-23", viewMode: "matrix" }),
    f.caller.query(api.cardReadings.getEmployeeAttendanceDetail, { projectId: f.projectId, employeeId: f.employeeId, startDate: "2026-10-23", endDate: "2026-10-23" }),
    f.caller.query(api.cardReadings.getMonthlyPayrollSheet, { projectId: f.projectId, year: 2026, month: 10 }),
    f.caller.query(api.reports.getAttendanceSummaryReport, { projectId: f.projectId, year: 2026, month: 10 }),
  ]);
  expect(table[0]?.days[0]).toMatchObject({ durationMeasured: true, punchQuality: "ok", lastExit: mode === "day" ? "17:00" : "06:00" });
  expect(detail?.days[0]).toMatchObject({ durationMeasured: true, punchQuality: "ok", exitNextDay: mode !== "day" });
  expect(payroll.rows[0]?.cells.find(cell => cell.date === "2026-10-23")).toMatchObject({ status: "present" });
  expect(report.rows[0]?.incompleteDays).toBe(0);
  expect((await f.t.run(ctx => ctx.db.query("cardReadings").collect())).map(row => row.direction)).toEqual(["entry", "entry"]);
});
it("HTTP live event and daily backfill persist cardReaderNo", async () => {
  const f = await fixture();
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  const response = await f.t.fetch("/card-reader", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer test-token" }, body: JSON.stringify({ EventNotificationAlert: { devIndex: "dev-test", eventType: "AccessControllerEvent", AccessControllerEvent: { cardNo: "TEST", majorEventType: 5, subEventType: 1, cardReaderNo: 2 } } }) });
  expect(response.status).toBe(200);
  await f.t.mutation(internal.cardReadings.backfillHikEventRow, { deviceId: f.deviceId, event: { time: "2026-10-21T17:00:00+03:00", cardNo: "TEST", major: 5, minor: 1, serialNo: 50, cardReaderNo: 4 } });
  const rows = await f.t.run(ctx => ctx.db.query("cardReadings").collect());
  expect(rows.map(row => row.hikCardReaderNo).sort()).toEqual([2, 4]);
});
it("JSON and XML parser carry reader number independently of card credentials", () => {
  expect(parseCardReaderBody(JSON.stringify({ AccessControllerEvent: { cardNo: "TEST", cardReaderNo: "2" } }), "application/json")).toMatchObject({ user_id: "TEST", hikCardReaderNo: 2 });
  expect(parseCardReaderBody('<EventNotificationAlert><cardNo>TEST</cardNo><cardReaderNo>4</cardReaderNo></EventNotificationAlert>', "application/xml")).toMatchObject({ user_id: "TEST", hikCardReaderNo: 4 });
});
it("IDE readers use snapshotted IO even with incidental Hik metadata; duplicate physical addresses are rejected", async () => {
  const f = await fixture();
  const duplicateId = await f.t.run(async ctx => {
    await ctx.db.patch(f.deviceId, { brand: "ide_smart" });
    await ctx.db.patch(f.doorId, { ioId: 3 });
    await ctx.db.patch(f.readerId, { ioId: 3 });
    return ctx.db.insert("readers", { projectId: f.projectId, deviceId: f.deviceId, doorId: f.doorId, name: "Diğer okuyucu", direction: "entry", ioId: 3, createdAt: "", updatedAt: "" });
  });
  await f.caller.mutation(api.pdksRules.publishRuleVersion, { ...f.args, targets: [f.args.targets[1]] });
  await f.t.run(async ctx => {
    const policyFor = await loadPdksRulePolicy(ctx, f.projectId, "2026-10-23", "2026-10-24");
    expect(effectiveDirection({ deviceId: f.deviceId, ideIoId: 3, direction: "entry" }, policyFor("2026-10-23"))).toBe("exit");
    expect(matchesPdksCheckpoint({ deviceId: f.deviceId, hikCardReaderNo: 2 }, policyFor("2026-10-23"))).toBe(false);
  });
  await expect(f.caller.mutation(api.pdksRules.publishRuleVersion, { ...f.args, targets: [f.args.targets[1], { ...f.args.targets[1], readerId: duplicateId }] })).rejects.toThrow("fiziksel okuyucu");
});

it("mobile movement summary counts the effective exit while retaining its calendar date", async () => {
  const f = await fixture();
  await f.caller.mutation(api.pdksRules.publishRuleVersion, f.args);
  await f.t.run(async ctx => {
    const id = await ctx.db.insert("cardReadings", { projectId: f.projectId, employeeId: f.employeeId, deviceId: f.deviceId, cardNo: "TEST", hikCardReaderNo: 2, hikMajorEventType: 5, hikSubEventType: 1, accessTime: "2026-10-24T03:00:00.000Z", accessStatus: "izin_verildi", direction: "entry" });
    const reading = await ctx.db.get(id);
    if (!reading) throw new Error("Test reading missing");
    const policyFor = await loadPdksRulePolicy(ctx, f.projectId, "2026-10-23", "2026-10-24");
    const summary = summarizeMovements([reading], "2026-10-24", "2026-10-24", f.projectId, "2026-10-24T12:00:00Z", policyFor, { workDate: () => "2026-10-23", presentDates: new Set(["2026-10-23"]) });
    expect(summary.days[0]).toMatchObject({ date: "2026-10-24", entryCount: 0, exitCount: 1, lastDirection: "exit" });
    expect(reading.direction).toBe("entry");
  });
});

it("legacy point types select endpoints: both remains first/last, one-way never supplies the opposite endpoint", () => {
  const entryDevice = "in" as Id<"devices">;
  const exitDevice = "out" as Id<"devices">;
  const bothDevice = "both" as Id<"devices">;
  const typed: PdksDayPolicy = { ...LEGACY_PDKS_POLICY, checkpointMode: "selected", targets: [
    { targetType: "device", deviceId: entryDevice, pointType: "entry" },
    { targetType: "device", deviceId: exitDevice, pointType: "exit" },
    { targetType: "device", deviceId: bothDevice, pointType: "both" },
  ] };
  const reading = (deviceId: Id<"devices">, hour: string, direction: "entry" | "exit" = "entry"): Doc<"cardReadings"> => ({ _id: `${deviceId}-${hour}` as Id<"cardReadings">, _creationTime: 0, deviceId, cardNo: "TEST", accessStatus: "izin_verildi", accessTime: `2026-10-23T${hour}:00:00.000Z`, direction });
  const run = (rows: Doc<"cardReadings">[], policy = typed) => computePdksDay({ policy, date: "2026-10-23", readings: filterPdksReadings(rows, undefined, () => policy), shift: null, workSettings: DEFAULT_WORK_SETTINGS, workingDays: ["Cuma"] });
  expect(run([reading(exitDevice, "05"), reading(exitDevice, "14")])).toMatchObject({ firstISO: null, lastISO: "2026-10-23T14:00:00.000Z", durationMeasured: false, punchQuality: "missingEntry", totalMinutes: 0 });
  expect(run([reading(entryDevice, "05"), reading(entryDevice, "14")])).toMatchObject({ firstISO: "2026-10-23T05:00:00.000Z", lastISO: null, durationMeasured: false, punchQuality: "missingExit" });
  expect(run([reading(exitDevice, "04"), reading(bothDevice, "05", "exit"), reading(entryDevice, "15"), reading(bothDevice, "14", "entry")])).toMatchObject({ firstISO: "2026-10-23T05:00:00.000Z", lastISO: "2026-10-23T14:00:00.000Z", durationMeasured: true });
  const bothRows = [reading(bothDevice, "05", "exit"), reading(bothDevice, "14", "entry")];
  const baseline = run(bothRows, LEGACY_PDKS_POLICY);
  for (const pointType of [undefined, "both"] as const) {
    expect(run(bothRows, { ...typed, targets: [{ targetType: "device", deviceId: bothDevice, pointType }] })).toEqual(baseline);
  }
  expect(resolveAttendanceEvidence([reading(exitDevice, "14")], { entryISO: "2026-10-23T08:00:00+03:00" }, typed)).toMatchObject({ durationMeasured: true, punchQuality: "ok" });
});
it("legacy two exit-only punches never manufacture entry or duration in table/detail/payroll/report", async () => {
  const f = await fixture();
  await f.caller.mutation(api.pdksRules.publishRuleVersion, { ...f.args, punchMode: "legacy" });
  await f.t.run(async ctx => {
    for (const accessTime of ["2026-10-23T05:00:00.000Z", "2026-10-23T14:00:00.000Z"]) await ctx.db.insert("cardReadings", { projectId: f.projectId, employeeId: f.employeeId, deviceId: f.deviceId, cardNo: "TEST", hikCardReaderNo: 2, hikMajorEventType: 5, hikSubEventType: 1, accessTime, accessStatus: "izin_verildi", direction: "entry" });
  });
  vi.setSystemTime(new Date("2026-11-01T12:00:00Z"));
  const [table, detail, payroll, report] = await Promise.all([
    f.caller.query(api.cardReadings.getPdksTableData, { projectId: f.projectId, startDate: "2026-10-23", endDate: "2026-10-23", viewMode: "matrix" }),
    f.caller.query(api.cardReadings.getEmployeeAttendanceDetail, { projectId: f.projectId, employeeId: f.employeeId, startDate: "2026-10-23", endDate: "2026-10-23" }),
    f.caller.query(api.cardReadings.getMonthlyPayrollSheet, { projectId: f.projectId, year: 2026, month: 10 }),
    f.caller.query(api.reports.getSgkMonthlyReport, { projectId: f.projectId, year: 2026, month: 10 }),
  ]);
  expect(table[0]?.days[0]).toMatchObject({ firstEntry: null, lastExit: "17:00", punchQuality: "missingEntry", durationMeasured: false, totalMinutes: 0 });
  expect(detail?.days[0]).toMatchObject({ firstEntry: null, lastExit: "17:00", punchQuality: "missingEntry", durationMeasured: false, totalMinutes: 0 });
  expect(payroll.rows[0]?.cells.find(cell => cell.date === "2026-10-23")).toMatchObject({ totalMinutes: 0 });
  expect(report.rows[0]?.toplamSaat).toBe(0);
});
