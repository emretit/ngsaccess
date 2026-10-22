// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import type { FunctionArgs } from "convex/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const now = "2026-10-19T09:00:00.000Z";
const uuid = "12345678-1234-1234-1234-123456789abc";
type Args = FunctionArgs<typeof internal.cardReadings.processCardReading>;
type Reading = Omit<Doc<"cardReadings">, "_id" | "_creationTime">;
const hikFields = {
  hikDevIndex: "dev-index", hikMajorEventType: 5, hikSubEventType: 1,
  hikCurrentVerifyMode: "card", hikSerialNo: 12, hikFrontSerialNo: 11,
  hikDateTime: "2026-10-19T11:59:00+03:00", hikPictureURL: "picture",
  hikMask: "yes", hikHelmet: "yes", hikTemperature: 36.5, hikEventState: "active",
};

async function fixture() {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(now));
  vi.stubEnv("NOTIFICATION_EMAIL", "");
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "First" });
    const otherProjectId = await ctx.db.insert("projects", { name: "Other" });
    const employeeId = await ctx.db.insert("employees", { projectId, firstName: "Ada", lastName: "Test", cardNumber: "CARD", email: "ada@example.test", isActive: true });
    const foreignEmployeeId = await ctx.db.insert("employees", { projectId: otherProjectId, firstName: "Foreign", lastName: "Person", cardNumber: "FOREIGN", email: "other@example.test", isActive: true });
    const deviceId = await ctx.db.insert("devices", { projectId, brand: "other", name: "Reader", deviceSerial: "SERIAL", deviceIp: "192.0.2.1", hikDevIndex: "dev-index", ehomeID: "ehome", ideUuid: "panel-uuid", accessDirection: "entry", isActive: true, createdAt: now, updatedAt: now });
    const foreignDeviceId = await ctx.db.insert("devices", { projectId: otherProjectId, brand: "other", name: "Foreign reader", deviceSerial: "FOREIGN-SERIAL", deviceIp: "192.0.2.2", isActive: true, createdAt: now, updatedAt: now });
    const ruleId = await ctx.db.insert("accessRules", { projectId, name: "Monday", isActive: true, days: ["Monday"], startTime: "09:00", endTime: "18:00" });
    const memberId = await ctx.db.insert("groupMembers", { projectId, groupId: ruleId, employeeId, createdAt: now });
    const groupDeviceId = await ctx.db.insert("groupDevices", { projectId, groupId: ruleId, deviceId, createdAt: now });
    const authId = await ctx.db.insert("employeeAuth", { employeeId, passwordHash: "hash", passwordVersion: 1, createdAt: now, updatedAt: now });
    const sessionId = await ctx.db.insert("employeeSessions", { employeeId, token: "session", passwordVersion: 1, expiresAt: "2030-01-01T00:00:00Z", createdAt: now });
    const tokenId = await ctx.db.insert("checkInTokens", { employeeId, projectId, sessionId, token: uuid, purpose: "reader", authVersion: 1, expiresAt: "2030-01-01T00:00:00Z", createdAt: now });
    return { projectId, otherProjectId, employeeId, foreignEmployeeId, deviceId, foreignDeviceId, ruleId, memberId, groupDeviceId, authId, sessionId, tokenId };
  });
  return { t, ...ids };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
function args(overrides: Partial<Args> = {}): Args {
  return { cardNo: "CARD", deviceSerial: "SERIAL", rawBody: "raw-event", ...hikFields, ...overrides };
}
function reading(f: Fixture, overrides: Partial<Reading> = {}): Reading {
  return { projectId: f.projectId, deviceId: f.deviceId, employeeId: f.employeeId, cardNo: "CARD", employeeName: "Ada Test", accessTime: now, accessStatus: "izin_verildi", direction: "entry", rawData: "raw-event", ...hikFields, createdAt: now, updatedAt: now, ...overrides };
}
// Compare the whole persisted payload (including absent fields), not just status.
function payload(row: Doc<"cardReadings">): Reading {
  const { _id, _creationTime, ...rest } = row;
  void _id; void _creationTime;
  return rest;
}
function defined(row: Reading): Reading {
  return Object.fromEntries(Object.entries(row).filter(([, value]) => value !== undefined)) as Reading;
}
async function effects(f: Fixture, rows: Reading[], scheduled: { name: string; args: unknown[]; scheduledTime: number; state: { kind: "pending" } }[] = []) {
  const result = await f.t.run(async ctx => ({
    readings: await ctx.db.query("cardReadings").collect(),
    audit: await ctx.db.query("auditLog").collect(),
    events: await ctx.db.query("deviceEvents").collect(),
    jobs: await ctx.db.system.query("_scheduled_functions").collect(),
  }));
  expect(result.readings.map(payload)).toEqual(rows.map(defined));
  expect(result.audit).toEqual([]);
  expect(result.events).toEqual([]);
  expect(result.jobs.map(({ name, args: jobArgs, scheduledTime, state }) => ({ name, args: jobArgs, scheduledTime, state }))).toEqual(scheduled);
}
async function run(f: Fixture, input: Args, granted: boolean, rows: Reading[]) {
  expect(await f.t.mutation(internal.cardReadings.processCardReading, input)).toEqual({ granted });
  await effects(f, rows);
}

afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("processCardReading HEAD characterization: device and employee resolution", () => {
  it.each(["serial", "devIndex", "ehome", "uuid", "ip"] as const)("resolves %s using the legacy fallback chain", async kind => {
    const f = await fixture();
    const lookup = { deviceSerial: kind === "serial" ? " SERIAL " : "missing", hikDevIndex: kind === "devIndex" ? " dev-index " : undefined, hikEhomeID: kind === "ehome" ? " ehome " : undefined, ideUuid: kind === "uuid" ? " panel-uuid " : undefined, deviceIp: kind === "ip" ? " 192.0.2.1 " : undefined };
    await run(f, args(lookup), true, [reading(f, { hikDevIndex: lookup.hikDevIndex })]);
  });
  it("pins authenticated device despite forged serial/IP/devIndex/uuid", async () => {
    const f = await fixture();
    await run(f, args({ authedDeviceId: f.deviceId, deviceSerial: "FOREIGN-SERIAL", deviceIp: "192.0.2.2", ideUuid: "forged" }), true, [reading(f)]);
  });
  it("does not fall back from a deleted authenticated device", async () => {
    const f = await fixture();
    await f.t.run(ctx => ctx.db.delete(f.foreignDeviceId));
    await run(f, args({ authedDeviceId: f.foreignDeviceId }), false, [reading(f, { deviceId: undefined, direction: undefined, accessStatus: "reddedildi" })]);
  });
  it("serial wins over conflicting later identifiers", async () => {
    const f = await fixture();
    await run(f, args({ deviceSerial: "FOREIGN-SERIAL", deviceIp: "192.0.2.1", ideUuid: "panel-uuid" }), false, [reading(f, { projectId: f.otherProjectId, deviceId: f.foreignDeviceId, employeeId: undefined, employeeName: undefined, direction: undefined, accessStatus: "reddedildi" })]);
  });
  // 2026-10-22 güvenlik düzeltmesi: terminatedActive/endedNoExpiry/visitorExpired/realVisitorExpired/
  // accessNotStarted/inactiveDevice bilinçli olarak izin → ret oldu (erişim penceresi + pasif cihaz token
  // yoluyla aynı; son çalışma günü yalnız kartta); endsToday son gün, accessStartsNow pencere başı dahil izinli.
  it.each(["unknownDevice", "unknownCard", "bothUnknown", "inactive", "missingActive", "terminatedInactive", "terminatedActive", "endedNoExpiry", "endsToday", "visitorExpired", "realVisitorExpired", "accessNotStarted", "accessStartsNow", "inactiveDevice", "foreignCard", "noGroup", "noMember", "inactiveRule", "deletedRule", "closedSchedule", "grant"] as const)("freezes %s return, row and scheduler", async kind => {
    const f = await fixture();
    const input = args();
    const expected = reading(f);
    const granted = kind === "grant" || kind === "endsToday" || kind === "accessStartsNow";
    await f.t.run(async ctx => {
      if (kind === "endedNoExpiry") await ctx.db.patch(f.employeeId, { employmentEndDate: "2026-10-18" });
      if (kind === "endsToday") await ctx.db.patch(f.employeeId, { employmentEndDate: "2026-10-19" });
      if (kind === "visitorExpired") await ctx.db.patch(f.employeeId, { accessExpiresAt: "2026-10-19T08:00:00.000Z" });
      if (kind === "inactiveDevice") await ctx.db.patch(f.deviceId, { isActive: false });
      if (kind === "realVisitorExpired") await ctx.db.patch(f.employeeId, { isVisitor: true, accessStartsAt: "2026-10-19T06:00:00.000Z", accessExpiresAt: "2026-10-19T08:00:00.000Z" });
      if (kind === "accessNotStarted") await ctx.db.patch(f.employeeId, { accessStartsAt: "2026-10-19T10:00:00.000Z" });
      if (kind === "accessStartsNow") await ctx.db.patch(f.employeeId, { accessStartsAt: now });
      if (["unknownDevice", "bothUnknown"].includes(kind)) { input.deviceSerial = "missing"; input.hikDevIndex = undefined; expected.deviceId = undefined; expected.hikDevIndex = undefined; }
      if (["unknownCard", "bothUnknown", "foreignCard"].includes(kind)) { input.cardNo = kind === "foreignCard" ? "FOREIGN" : "missing"; expected.cardNo = input.cardNo; expected.employeeId = undefined; expected.employeeName = undefined; }
      if (kind === "inactive" || kind === "terminatedInactive") await ctx.db.patch(f.employeeId, { isActive: false, ...(kind === "terminatedInactive" ? { employmentEndDate: "2026-10-01" } : {}) });
      if (kind === "missingActive") await ctx.db.patch(f.employeeId, { isActive: undefined });
      if (kind === "terminatedActive") await ctx.db.patch(f.employeeId, { employmentEndDate: "2026-10-01", accessExpiresAt: "2026-10-01T00:00:00Z" });
      if (kind === "noGroup") await ctx.db.delete(f.groupDeviceId);
      if (kind === "noMember") await ctx.db.delete(f.memberId);
      if (kind === "inactiveRule") await ctx.db.patch(f.ruleId, { isActive: false });
      if (kind === "deletedRule") await ctx.db.delete(f.ruleId);
      if (kind === "closedSchedule") { await ctx.db.patch(f.ruleId, { days: ["Tuesday"] }); expected.hikDenialReason = "Zaman penceresi dışında"; }
    });
    if (["unknownDevice", "unknownCard", "bothUnknown", "inactive", "missingActive", "terminatedInactive", "terminatedActive", "endedNoExpiry", "visitorExpired", "realVisitorExpired", "accessNotStarted", "inactiveDevice", "foreignCard"].includes(kind)) expected.direction = undefined;
    if (!granted) expected.accessStatus = "reddedildi";
    await run(f, input, granted, [expected]);
  });
  it("selects the same-project duplicate card even after a foreign candidate", async () => {
    const f = await fixture();
    await f.t.run(async ctx => {
      await ctx.db.patch(f.foreignEmployeeId, { cardNumber: "DUP" });
      const local = await ctx.db.insert("employees", { projectId: f.projectId, firstName: "Local", lastName: "Duplicate", cardNumber: "DUP", email: "dup@example.test", isActive: true });
      await ctx.db.insert("groupMembers", { projectId: f.projectId, groupId: f.ruleId, employeeId: local, createdAt: now });
      f.employeeId = local;
    });
    await run(f, args({ cardNo: "DUP" }), true, [reading(f, { cardNo: "DUP", employeeName: "Local Duplicate" })]);
  });
  it("preserves first-project row fallback for unknown card on an unscoped device", async () => {
    const f = await fixture();
    await f.t.run(ctx => ctx.db.patch(f.deviceId, { projectId: undefined }));
    await run(f, args({ cardNo: "missing" }), false, [reading(f, { employeeId: undefined, employeeName: undefined, cardNo: "missing", direction: undefined, accessStatus: "reddedildi" })]);
  });
});

describe("directions, repeats and notifications", () => {
  it.each(["entry", "exit", "both"] as const)("%s direction keeps two ordinary readings (no debounce)", async direction => {
    const f = await fixture();
    await f.t.run(ctx => ctx.db.patch(f.deviceId, { accessDirection: direction }));
    const first = reading(f, { direction: direction === "exit" ? "exit" : "entry" });
    await run(f, args(), true, [first]);
    await run(f, args(), true, [first, reading(f, { direction: direction === "entry" ? "entry" : "exit" })]);
  });
  it("denied readings do not toggle both direction", async () => {
    const f = await fixture();
    await f.t.run(async ctx => { await ctx.db.patch(f.deviceId, { accessDirection: "both" }); await ctx.db.delete(f.groupDeviceId); });
    const denied = reading(f, { accessStatus: "reddedildi" });
    await run(f, args(), false, [denied]);
    await run(f, args(), false, [denied, denied]);
  });
  it.each(["projectEmail", "environmentEmail", "disabled", "onTime", "exit"] as const)("late notification: %s", async kind => {
    const f = await fixture();
    vi.stubEnv("NOTIFICATION_EMAIL", "fallback@example.test");
    await f.t.run(async ctx => {
      if (kind !== "environmentEmail") await ctx.db.insert("generalSettings", { projectId: f.projectId, companyName: "Company", email: "project@example.test" });
      if (kind === "disabled") await ctx.db.insert("notificationSettings", { projectId: f.projectId, lateNotifications: false });
      if (kind === "exit") await ctx.db.patch(f.deviceId, { accessDirection: "exit" });
    });
    const accessTime = kind === "onTime" ? "2026-10-19T06:00:00.000Z" : now;
    vi.setSystemTime(new Date(accessTime));
    expect(await f.t.mutation(internal.cardReadings.processCardReading, args())).toEqual({ granted: true });
    const expected = reading(f, { accessTime, createdAt: accessTime, updatedAt: accessTime, direction: kind === "exit" ? "exit" : "entry" });
    await effects(f, [expected], ["disabled", "onTime"].includes(kind) ? [] : [{
      name: "actions/sendEmail:sendLateNotification", args: [{ to: kind === "environmentEmail" ? "fallback@example.test" : "project@example.test", employeeName: "Ada Test", lateTime: new Date(accessTime).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }), projectId: f.projectId }],
      scheduledTime: Date.parse(accessTime), state: { kind: "pending" },
    }]);
  });
});

describe("panel-authoritative audit paths", () => {
  it.each(["known", "unknown", "foreign", "inactive", "denied", "unclassified", "gap"] as const)("Hikvision %s", async kind => {
    const f = await fixture();
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    await f.t.run(async ctx => {
      await ctx.db.patch(f.deviceId, { brand: "hikvision", hikLastSerialNo: kind === "gap" ? 9 : 11 });
      if (kind === "inactive") await ctx.db.patch(f.employeeId, { isActive: false });
    });
    const cardNo = kind === "unknown" ? "missing" : kind === "foreign" ? "FOREIGN" : "CARD";
    const sub = kind === "denied" ? 9 : kind === "unclassified" ? 999999 : 1;
    const known = cardNo === "CARD";
    const granted = !["denied", "unclassified"].includes(kind);
    await run(f, args({ cardNo, hikSubEventType: sub }), granted, [reading(f, { cardNo, hikSubEventType: sub, employeeId: known ? f.employeeId : undefined, employeeName: known ? "Ada Test" : undefined, direction: known ? "entry" : undefined, accessStatus: granted ? "izin_verildi" : "reddedildi", hikDenialReason: kind === "denied" ? "Kart tanımlı değil" : undefined })]);
    expect((await f.t.run(ctx => ctx.db.get(f.deviceId)))?.hikLastSerialNo).toBe(12);
    expect(warning.mock.calls).toEqual(kind === "gap" ? [["[hik-event-gap] device=Reader expected front=9 got=11 current=12"]] : []);
  });
  it.each([0, 1, 2, 3, 4, undefined])("IDE result %s uses panel time/io direction without Hik metadata", async result => {
    const f = await fixture();
    await f.t.run(async ctx => { await ctx.db.patch(f.deviceId, { brand: "ide_smart" }); await ctx.db.patch(f.employeeId, { isActive: false }); });
    const granted = result === 1 || result === 2 || result === 3;
    const expected: Reading = { projectId: f.projectId, deviceId: f.deviceId, employeeId: f.employeeId, cardNo: "CARD", employeeName: "Ada Test", accessTime: "2026-10-18T07:11:12.000Z", accessStatus: granted ? "izin_verildi" : "reddedildi", direction: "exit", ideIoId: 1, rawData: "raw-event", createdAt: now, updatedAt: now };
    await run(f, args({ ideResult: result, ideIoId: 1, ideTime: "2026-10-18 10:11:12" }), granted, [expected]);
  });
  it.each(["missing", "FOREIGN"])("IDE unknown/foreign %s can be panel-granted; invalid time falls back", async cardNo => {
    const f = await fixture();
    await f.t.run(ctx => ctx.db.patch(f.deviceId, { brand: "ide_smart" }));
    await run(f, args({ cardNo, ideResult: 1, ideIoId: 0, ideTime: "invalid" }), true, [{ projectId: f.projectId, deviceId: f.deviceId, cardNo, accessTime: now, accessStatus: "izin_verildi", direction: "entry", ideIoId: 0, rawData: "raw-event", createdAt: now, updatedAt: now }]);
  });
});

describe("reader-purpose token guard and consumption", () => {
  it.each(["unauthed", "hikvision", "ide_smart", "missingToken", "purpose", "used", "expired", "invalidExpiry", "missingSession", "deletedSession", "sessionEmployee", "sessionExpiry", "sessionVersion", "missingEmployee", "tokenProject", "deviceProject", "missingAuth", "password", "authVersion", "inactiveEmployee", "inactiveDevice", "closedSchedule"] as const)("rejects %s with zero audit/scheduler effects", async kind => {
    const f = await fixture();
    await f.t.run(async ctx => {
      if (kind === "hikvision" || kind === "ide_smart") await ctx.db.patch(f.deviceId, { brand: kind });
      if (kind === "missingToken") await ctx.db.delete(f.tokenId);
      if (kind === "purpose") await ctx.db.patch(f.tokenId, { purpose: undefined });
      if (kind === "used") await ctx.db.patch(f.tokenId, { usedAt: now });
      if (kind === "expired" || kind === "invalidExpiry") await ctx.db.patch(f.tokenId, { expiresAt: kind === "expired" ? now : "invalid" });
      if (kind === "missingSession") await ctx.db.patch(f.tokenId, { sessionId: undefined });
      if (kind === "deletedSession") await ctx.db.delete(f.sessionId);
      if (kind === "sessionEmployee") await ctx.db.patch(f.sessionId, { employeeId: f.foreignEmployeeId });
      if (kind === "sessionExpiry") await ctx.db.patch(f.sessionId, { expiresAt: now });
      if (kind === "sessionVersion") await ctx.db.patch(f.sessionId, { passwordVersion: 2 });
      if (kind === "missingEmployee") await ctx.db.delete(f.employeeId);
      if (kind === "tokenProject") await ctx.db.patch(f.tokenId, { projectId: f.otherProjectId });
      if (kind === "deviceProject") await ctx.db.patch(f.deviceId, { projectId: f.otherProjectId });
      if (kind === "missingAuth") await ctx.db.delete(f.authId);
      if (kind === "password") await ctx.db.patch(f.authId, { passwordHash: "" });
      if (kind === "authVersion") await ctx.db.patch(f.authId, { passwordVersion: 2 });
      if (kind === "inactiveEmployee") await ctx.db.patch(f.employeeId, { isActive: false });
      if (kind === "inactiveDevice") await ctx.db.patch(f.deviceId, { isActive: false });
      if (kind === "closedSchedule") await ctx.db.patch(f.ruleId, { days: ["Tuesday"] });
    });
    const before = await f.t.run(ctx => ctx.db.get(f.tokenId));
    await run(f, args({ cardNo: uuid, ...(kind === "unauthed" ? {} : { authedDeviceId: f.deviceId }), ideResult: 1 }), false, []);
    expect(await f.t.run(ctx => ctx.db.get(f.tokenId))).toEqual(before);
  });
  it("consumes a token exactly once and writes only the QR reading", async () => {
    const f = await fixture();
    vi.stubEnv("NOTIFICATION_EMAIL", "late@example.test");
    const input = args({ authedDeviceId: f.deviceId, cardNo: uuid });
    const expected: Reading = { projectId: f.projectId, deviceId: f.deviceId, employeeId: f.employeeId, cardNo: "CARD", employeeName: "Ada Test", accessTime: now, accessStatus: "izin_verildi", direction: "entry", rawData: JSON.stringify({ source: "qr", protocol: "generic_reader" }), createdAt: now, updatedAt: now };
    await run(f, input, true, [expected]);
    expect(await f.t.run(ctx => ctx.db.get(f.tokenId))).toMatchObject({ usedAt: now, employeeName: "Ada Test", locationRecorded: false });
    await run(f, input, false, [expected]);
  });
});
