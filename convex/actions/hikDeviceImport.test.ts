// @vitest-environment node
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../_generated/api";
import schema from "../schema";
import { decryptTemplate } from "../lib/fingerprintCrypto";
const wire = vi.hoisted(() => ({ persons: vi.fn(), cards: vi.fn(), fingers: vi.fn(), templates: vi.fn() }));
vi.mock("../lib/gateway/persons", async original => ({ ...await original<typeof import("../lib/gateway/persons")>(), searchPersonOnDevice: wire.persons }));
vi.mock("../lib/gateway/cards", () => ({ readImportCardsPage: wire.cards }));
vi.mock("../lib/gateway/biometrics", async original => ({ ...await original<typeof import("../lib/gateway/biometrics")>(), searchFingerprintsOnDevice: wire.fingers, readFingerprintTemplates: wire.templates }));
const modules = { ...Object.fromEntries(Object.entries(import.meta.glob("../**/*.ts")).map(([key, value]) => [key.replace(/^\.\.\//, "./"), value])), ...Object.fromEntries(Object.entries(import.meta.glob("./*.ts")).map(([key, value]) => [key.replace(/^\.\//, "./actions/"), value])) };
async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "ANKA" });
    const userId = await ctx.db.insert("users", { role: "project_admin" });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 86400000 });
    await ctx.db.insert("userProjects", { userId, projectId });
    await ctx.db.insert("projectPrivacySettings", { projectId, biometricEnabled: true, updatedAt: "now" });
    const deviceId = await ctx.db.insert("devices", { projectId, name: "ANKA", brand: "hikvision", hikTransport: "gateway", hikDevIndex: "ANKA001", hikDoorCount: 2, isActive: true, createdAt: "now", updatedAt: "now" });
    return { projectId, userId, sessionId, deviceId };
  });
  return { t, ...ids, caller: t.withIdentity({ subject: `${ids.userId}|${ids.sessionId}` }) };
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("FINGERPRINT_TEMPLATE_KEY", Buffer.alloc(32, 7).toString("base64"));
  wire.persons.mockResolvedValue({ ok: true, total: 1, persons: [{ employeeNo: "1", name: "Okan ISMAN" }], nextPosition: 1 });
  wire.cards.mockResolvedValue({ ok: true, cards: [], total: 0, numMatches: 0, nextPosition: 0, hasMore: false });
  wire.fingers.mockResolvedValue({ ok: true, fingerprints: [{ employeeNo: "1", fingerPrintID: "6" }], hasMore: false });
  wire.templates.mockResolvedValue([{ fingerPrintID: 6, fingerData: "sensitive-template" }]);
});
describe("Hik device import", () => {
  it("previews metadata only, with no database writes or template reads", async () => {
    const f = await fixture();
    const preview = await f.caller.action(api.actions.hikDeviceImport.previewDeviceImport, { deviceId: f.deviceId });
    expect(preview).toEqual({ rows: [{ employeeNo: "1", name: "Okan ISMAN", cards: [], fingerCount: 1, status: "new" }], totals: { persons: 1, cards: 0 } });
    expect(JSON.stringify(preview)).not.toContain("sensitive-template");
    expect(wire.templates).not.toHaveBeenCalled();
    expect(await f.t.run(ctx => ctx.db.query("employees").collect())).toEqual([]);
  });
  it("imports cardless person, consent, encrypted legacy slot 6, full device rule and source metadata; retry is idempotent", async () => {
    const f = await fixture();
    const args = { deviceId: f.deviceId, employeeNos: ["1", "1"], biometricConsentConfirmed: true };
    const first = await f.caller.action(api.actions.hikDeviceImport.importDevicePersons, args);
    expect(first).toMatchObject({ created: 1, matched: 0, fingerprintsStored: 1, fingerprintsSkipped: 0, consentsRecorded: 1 });
    const employees = await f.t.run(ctx => ctx.db.query("employees").collect());
    expect(employees).toHaveLength(1);
    const employee = employees[0];
    expect(employee).toMatchObject({ firstName: "Okan", lastName: "ISMAN", email: "", cardNumber: "1", hikCardless: true, isActive: true, projectId: f.projectId });
    const templates = await f.t.query(internal.employeeFingerprints.listInternal, { employeeId: employee._id });
    expect(templates).toHaveLength(1);
    expect(JSON.stringify(templates)).not.toContain("sensitive-template");
    expect(await decryptTemplate(templates[0], `${employee._id}:6`)).toBe("sensitive-template");
    const consent = await f.t.run(ctx => ctx.db.query("employeeConsents").first());
    expect(consent).toMatchObject({ grantedBy: f.userId, consentType: "biometric_fingerprint", notes: "Cihazdan aktarım: ANKA" });
    const rule = await f.t.run(ctx => ctx.db.query("accessRules").first());
    expect(rule).toMatchObject({ name: "ANKA mevcut kişiler", days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"], startTime: "00:00", endTime: "23:59" });
    expect(await f.t.run(ctx => ctx.db.query("groupDevices").first())).toMatchObject({ groupId: first.ruleId, deviceId: f.deviceId });
    expect(await f.t.run(ctx => ctx.db.query("deviceFingerprintEnrollments").first())).toMatchObject({ employeeId: employee._id, fingerNo: 6, enrolledEmployeeNo: "1", enrolledBy: f.userId });
    expect(await f.caller.action(api.actions.hikDeviceImport.importDevicePersons, args)).toMatchObject({ created: 0, matched: 1, fingerprintsStored: 0 });
  });
  it("without consent imports people and skips templates", async () => {
    const f = await fixture();
    expect(await f.caller.action(api.actions.hikDeviceImport.importDevicePersons, { deviceId: f.deviceId, employeeNos: ["1"], biometricConsentConfirmed: false })).toMatchObject({ created: 1, fingerprintsStored: 0, fingerprintsSkipped: 1, consentsRecorded: 0 });
    expect(wire.templates).not.toHaveBeenCalled();
  });
  it("re-reads names and refuses global numeric conflicts and manual mismatched cards", async () => {
    const f = await fixture();
    await f.t.run(async ctx => { const projectId = await ctx.db.insert("projects", { name: "Other" }); await ctx.db.insert("employees", { projectId, firstName: "Other", lastName: "", email: "", cardNumber: "0001" }); });
    expect(await f.caller.action(api.actions.hikDeviceImport.importDevicePersons, { deviceId: f.deviceId, employeeNos: ["1"], biometricConsentConfirmed: false })).toMatchObject({ created: 0, conflicts: 1 });
    wire.persons.mockResolvedValue({ ok: true, total: 1, persons: [{ employeeNo: "2", name: "Cinar ZONGUR" }], nextPosition: 1 });
    wire.cards.mockResolvedValue({ cards: [{ employeeNo: "2", cardNo: "987" }], total: 1, hasMore: false });
    expect(await f.caller.action(api.actions.hikDeviceImport.importDevicePersons, { deviceId: f.deviceId, employeeNos: ["2"], biometricConsentConfirmed: false })).toMatchObject({ created: 0, manual: 1 });
  });
  it("rejects unauthorized project and unsupported transport before device reads", async () => {
    const f = await fixture();
    await f.t.run(ctx => ctx.db.patch(f.deviceId, { hikTransport: "localBridge" }));
    await expect(f.caller.action(api.actions.hikDeviceImport.previewDeviceImport, { deviceId: f.deviceId })).rejects.toThrow("gateway");
    expect(wire.persons).not.toHaveBeenCalled();
    await f.t.run(ctx => ctx.db.patch(f.userId, { role: "project_user" }));
    await expect(f.caller.action(api.actions.hikDeviceImport.importDevicePersons, { deviceId: f.deviceId, employeeNos: ["1"], biometricConsentConfirmed: true })).rejects.toThrow("yetkiniz");
  });
  it("retains only five valid distinct device fingers and reports extras", async () => {
    const f = await fixture();
    wire.templates.mockResolvedValue([0, 6, 7, 8, 9, 10, 1, 11].map(fingerPrintID => ({ fingerPrintID, fingerData: `template-${fingerPrintID}` })));
    expect(await f.caller.action(api.actions.hikDeviceImport.importDevicePersons, { deviceId: f.deviceId, employeeNos: ["1"], biometricConsentConfirmed: true })).toMatchObject({ fingerprintsStored: 5, fingerprintsSkipped: 3 });
  });
});

it("users with device/person management but no biometric management import people and report skipped fingers", async () => {
  const f = await fixture();
  await f.t.run(async ctx => {
    const membership = await ctx.db.query("userProjects").first();
    if (membership) await ctx.db.patch(membership._id, { role: "technician" });
    await ctx.db.insert("projectRolePermissions", { projectId: f.projectId, role: "technician", permissions: ["devices.manage", "employees.manage"], updatedAt: Date.now(), updatedBy: f.userId });
  });
  expect(await f.caller.action(api.actions.hikDeviceImport.importDevicePersons, { deviceId: f.deviceId, employeeNos: ["1"], biometricConsentConfirmed: true })).toMatchObject({ created: 1, fingerprintsStored: 0, fingerprintsSkipped: 1, consentsRecorded: 0 });
  expect(wire.templates).not.toHaveBeenCalled();
  expect(await f.t.run(ctx => ctx.db.query("employeeConsents").collect())).toHaveLength(0);
});

it("one person's template failure does not stop the remaining people or their fingerprints", async () => {
  const f = await fixture();
  wire.persons.mockResolvedValue({ ok: true, total: 2, persons: [{ employeeNo: "1", name: "Okan ISMAN" }, { employeeNo: "2", name: "Cinar ZONGUR" }], nextPosition: 2 });
  wire.templates.mockImplementation(async (_devIndex: string, employeeNo: string) => {
    if (employeeNo === "1") throw new Error("Parmak izi okunamadı (HTTP 500)");
    return [{ fingerPrintID: 6, fingerData: "sensitive-template" }];
  });
  const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  expect(await f.caller.action(api.actions.hikDeviceImport.importDevicePersons, { deviceId: f.deviceId, employeeNos: ["1", "2"], biometricConsentConfirmed: true })).toMatchObject({ created: 2, fingerprintsStored: 1, fingerprintsSkipped: 1 });
  expect(JSON.stringify(warn.mock.calls)).not.toContain("sensitive-template");
  warn.mockRestore();
});

it("drains person and card pages of 30 and truncates only after the first 1000 people", async () => {
  const { readDevicePersons } = await import("./hikDeviceImport");
  wire.cards.mockImplementation(async (_index: string, position: number) => ({ cards: position ? [{ employeeNo: "31", cardNo: "31" }] : [], total: 1, hasMore: position === 0, nextPosition: position + 30 }));
  wire.persons.mockImplementation(async (_index: string, options: { searchResultPosition: number; maxResults: number }) => ({ ok: true, total: 1001, persons: Array.from({ length: Math.min(30, 1001 - options.searchResultPosition) }, (_, index) => ({ employeeNo: String(options.searchResultPosition + index + 1), name: "Person" })), nextPosition: options.searchResultPosition + 30 }));
  const data = await readDevicePersons("ANKA001");
  expect(data.persons).toHaveLength(1000);
  expect(data).toMatchObject({ totals: { persons: 1001, cards: 1 }, truncated: true });
  expect(data.persons[30]).toMatchObject({ employeeNo: "31", cards: ["31"] });
  expect(wire.persons).toHaveBeenCalledTimes(34);
  expect(wire.cards).toHaveBeenCalledTimes(2);
  expect(wire.persons.mock.calls.every(call => call[1].maxResults === 30)).toBe(true);
});
