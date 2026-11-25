// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import rateLimiterTest from "@convex-dev/rate-limiter/test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { VIRTUAL_READER_TYPE } from "./lib/virtualReader";
import { hashVisitorSecret } from "./lib/visitorPass";
import * as visitorPassHelpers from "./lib/visitorPass";
import { cascadeRemoveEmployeePII } from "./lib/employeeCascade";
import { purgeDeviceCascade } from "./lib/deviceHelpers";

const modules = import.meta.glob("./**/*.ts");
const now = "2026-11-25T09:00:00.000Z";

async function fixture() {
  vi.useFakeTimers(); vi.setSystemTime(new Date(now));
  const t = convexTest(schema, modules); rateLimiterTest.register(t);
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "A" });
    const otherProjectId = await ctx.db.insert("projects", { name: "B" });
    const userId = await ctx.db.insert("users", { role: "super_admin" });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 86_400_000 });
    const visitorId = await ctx.db.insert("employees", { projectId, firstName: "Ada", lastName: "Visitor", email: "ada@example.test", cardNumber: "123456", isVisitor: true, visitorCredential: "pass", isActive: true, accessStartsAt: "2026-11-25T08:00:00Z", accessExpiresAt: "2026-11-25T18:00:00Z" });
    const readerToken = crypto.randomUUID();
    const deviceId = await ctx.db.insert("devices", { projectId, name: "Kiosk", brand: "other", deviceType: VIRTUAL_READER_TYPE, apiToken: readerToken, isActive: true, accessDirection: "entry", createdAt: now, updatedAt: now });
    return { projectId, otherProjectId, userId, sessionId, visitorId, deviceId, readerToken };
  });
  const admin = t.withIdentity({ subject: `${ids.userId}|${ids.sessionId}` });
  return { t, admin, ...ids, scan: (code: string) => t.mutation(api.virtualReaders.scan, { readerToken: ids.readerToken, code }),
    pin: (pin: string) => t.mutation(api.virtualReaders.scanPin, { readerToken: ids.readerToken, pin }) };
}

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe("visitorPasses lifecycle", () => {
  it("issues secrets once, persists only hashes and returns safe metadata/audit", async () => {
    const f = await fixture();
    const issued = await f.admin.mutation(api.visitorPasses.issue, { visitorId: f.visitorId });
    expect(issued.token).toMatch(/^NGSV1\.[\w-]{22}$/); expect(issued.pin).toMatch(/^\d{6}$/);
    const row = await f.t.run(ctx => ctx.db.get(issued.passId));
    expect(row).toMatchObject({ tokenHash: await hashVisitorSecret(issued.token), pinHash: await hashVisitorSecret(`${f.projectId}:${issued.pin}`), status: "active", usedCount: 0 });
    const meta = await f.admin.query(api.visitorPasses.getForVisitor, { visitorId: f.visitorId });
    expect(meta).toMatchObject({ passId: issued.passId, maxUses: null, usedCount: 0 });
    expect(meta).not.toHaveProperty("tokenHash"); expect(meta).not.toHaveProperty("pinHash");
    const data = JSON.stringify(await f.t.run(async ctx => ({ passes: await ctx.db.query("visitorPasses").take(10), audit: await ctx.db.query("auditLog").take(10) })));
    expect(data).not.toContain(issued.token); expect(data).not.toContain(`"${issued.pin}"`);
    await expect(f.admin.mutation(api.visitorPasses.issue, { visitorId: f.visitorId })).rejects.toThrow("Kod zaten var");
  });

  it("atomically exhausts at two entries, records the third denial and returns W2 door identifiers", async () => {
    const f = await fixture();
    const issued = await f.admin.mutation(api.visitorPasses.issue, { visitorId: f.visitorId, maxUses: 2 });
    const results = await Promise.all(Array.from({ length: 3 }, () => f.scan(issued.token)));
    expect(results.filter(row => row.status === "granted")).toHaveLength(2);
    expect(results).toContainEqual({ status: "denied", reason: "EXHAUSTED" });
    expect(results[0]).toMatchObject({ visitorPassId: issued.passId, visitorId: f.visitorId, projectId: f.projectId, doorId: null });
    expect(await f.t.run(ctx => ctx.db.get(issued.passId))).toMatchObject({ usedCount: 2, status: "exhausted" });
    const readings = await f.t.run(ctx => ctx.db.query("cardReadings").take(10));
    expect(readings).toHaveLength(3); expect(readings.filter(row => row.accessStatus === "reddedildi")).toHaveLength(1);
    expect(JSON.parse(readings[2].rawData ?? "{}")).toMatchObject({ source: "qr", protocol: "visitor_pass", passId: issued.passId, reason: "EXHAUSTED" });
    expect(JSON.stringify(readings)).not.toContain(issued.token);
    expect(readings.every(reading => reading.cardNo === "")).toBe(true);
    expect(await f.pin(issued.pin)).toEqual({ status: "denied", reason: "EXHAUSTED" });
  });

  it("counts only entries and keeps unlimited passes active", async () => {
    const f = await fixture();
    const issued = await f.admin.mutation(api.visitorPasses.issue, { visitorId: f.visitorId });
    await f.t.run(ctx => ctx.db.patch(f.deviceId, { accessDirection: "both" }));
    expect(await f.scan(issued.token)).toMatchObject({ status: "granted", direction: "entry" });
    vi.advanceTimersByTime(1000);
    expect(await f.pin(issued.pin)).toMatchObject({ status: "granted", direction: "exit" });
    expect(await f.t.run(ctx => ctx.db.get(issued.passId))).toMatchObject({ usedCount: 1, status: "active" });
    vi.advanceTimersByTime(1000);
    expect(await f.pin(issued.pin)).toMatchObject({ status: "granted", direction: "entry" });
    expect(await f.t.run(ctx => ctx.db.get(issued.passId))).toMatchObject({ usedCount: 2, status: "active" });
  });

  it("permits an inferred exit after exhaustion while rejecting the next inferred entry", async () => {
    const f = await fixture();
    await f.t.run(ctx => ctx.db.patch(f.deviceId, { accessDirection: "both" }));
    const issued = await f.admin.mutation(api.visitorPasses.issue, { visitorId: f.visitorId, maxUses: 1 });
    expect(await f.scan(issued.token)).toMatchObject({ status: "granted", direction: "entry" });
    vi.advanceTimersByTime(1000);
    expect(await f.pin(issued.pin)).toMatchObject({ status: "granted", direction: "exit" });
    expect(await f.t.run(ctx => ctx.db.get(issued.passId))).toMatchObject({ status: "exhausted", usedCount: 1 });
    vi.advanceTimersByTime(1000);
    expect(await f.scan(issued.token)).toEqual({ status: "denied", reason: "EXHAUSTED" });
  });

  it("rejects outside validity, inactive, revoked, and rotated secrets", async () => {
    const f = await fixture();
    const issued = await f.admin.mutation(api.visitorPasses.issue, { visitorId: f.visitorId, maxUses: 2 });
    await f.t.run(ctx => ctx.db.patch(f.visitorId, { accessStartsAt: "2026-11-25T10:00:00Z" }));
    expect(await f.scan(issued.token)).toEqual({ status: "denied", reason: "NOT_STARTED" });
    await f.t.run(ctx => ctx.db.patch(f.visitorId, { accessStartsAt: "2026-11-25T08:00:00Z", accessExpiresAt: now }));
    expect(await f.scan(issued.token)).toEqual({ status: "denied", reason: "EXPIRED" });
    await f.t.run(ctx => ctx.db.patch(f.visitorId, { accessExpiresAt: "2026-11-25T18:00:00Z", isActive: false }));
    expect(await f.scan(issued.token)).toEqual({ status: "denied", reason: "NOT_ACTIVE" });
    await f.t.run(ctx => ctx.db.patch(f.visitorId, { isActive: true }));
    await f.admin.mutation(api.visitorPasses.revoke, { visitorId: f.visitorId });
    expect(await f.scan(issued.token)).toEqual({ status: "denied", reason: "REVOKED" });
    const rotated = await f.admin.mutation(api.visitorPasses.regenerate, { visitorId: f.visitorId });
    expect(rotated.passId).toBe(issued.passId); expect(rotated.token).not.toBe(issued.token); expect(rotated.pin).not.toBe(issued.pin);
    expect(await f.scan(issued.token)).toEqual({ status: "denied", reason: "TOKEN_INVALID" });
    expect(await f.pin(issued.pin)).toEqual({ status: "denied", reason: "TOKEN_INVALID" });
    expect(await f.scan(rotated.token)).toMatchObject({ status: "granted" });
  });

  it("locks each reader for five minutes after five wrong PINs, without storing guesses", async () => {
    const f = await fixture();
    const issued = await f.admin.mutation(api.visitorPasses.issue, { visitorId: f.visitorId });
    const wrong = issued.pin === "000000" ? "999999" : "000000";
    for (let i = 0; i < 4; i++) expect(await f.pin(wrong)).toEqual({ status: "denied", reason: "TOKEN_INVALID" });
    expect(await f.pin(wrong)).toEqual({ status: "denied", reason: "PIN_LOCKED" });
    expect(await f.pin(issued.pin)).toEqual({ status: "denied", reason: "PIN_LOCKED" });
    for (let i = 0; i < 20; i++) expect(await f.pin(wrong)).toEqual({ status: "denied", reason: "PIN_LOCKED" });
    const lockedReadings = await f.t.run(ctx => ctx.db.query("cardReadings").take(100));
    expect(lockedReadings).toHaveLength(5);
    expect(lockedReadings.filter(row => JSON.parse(row.rawData ?? "{}").reason === "PIN_LOCKED")).toHaveLength(1);
    const secondReader = await f.admin.mutation(api.virtualReaders.create, { projectId: f.projectId, name: "Other kiosk" });
    expect(await f.t.mutation(api.virtualReaders.scanPin, { readerToken: secondReader.readerToken, pin: issued.pin })).toMatchObject({ status: "granted" });
    expect(await f.scan(issued.token)).toMatchObject({ status: "granted" });
    const attempts = await f.t.run(ctx => ctx.db.query("visitorPassAttempts").take(10));
    expect(attempts).toHaveLength(1); expect(attempts[0].failures).toBe(5);
    expect(JSON.stringify(attempts)).not.toContain(`"${wrong}"`);
    vi.advanceTimersByTime(5 * 60_000);
    expect(await f.pin(issued.pin)).toMatchObject({ status: "granted" });
    expect(await f.pin(wrong)).toEqual({ status: "denied", reason: "TOKEN_INVALID" });
    expect((await f.t.run(ctx => ctx.db.query("visitorPassAttempts").take(10)))[0].failures).toBe(1);
  });

  it("scopes QR and PIN to project and protects management operations", async () => {
    const f = await fixture();
    const issued = await f.admin.mutation(api.visitorPasses.issue, { visitorId: f.visitorId });
    await f.t.run(ctx => ctx.db.patch(f.deviceId, { projectId: f.otherProjectId }));
    expect(await f.scan(issued.token)).toEqual({ status: "denied", reason: "NOT_ALLOWED" });
    expect(await f.pin(issued.pin)).toEqual({ status: "denied", reason: "TOKEN_INVALID" });
    await expect(f.t.mutation(api.visitorPasses.issue, { visitorId: f.visitorId })).rejects.toThrow();
    const reader = await f.t.run(async ctx => {
      const userId = await ctx.db.insert("users", { role: "project_user" });
      const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 86_400_000 });
      await ctx.db.insert("userProjects", { userId, projectId: f.projectId, role: "viewer" });
      return { userId, sessionId };
    });
    const viewer = f.t.withIdentity({ subject: `${reader.userId}|${reader.sessionId}` });
    await expect(viewer.query(api.visitorPasses.getForVisitor, { visitorId: f.visitorId })).rejects.toThrow();
    await expect(viewer.mutation(api.visitorPasses.regenerate, { visitorId: f.visitorId })).rejects.toThrow();
    await expect(viewer.mutation(api.visitorPasses.revoke, { visitorId: f.visitorId })).rejects.toThrow();
  });

  it("enforces the bound door scope without writing cloud-only pass identities to hardware", async () => {
    const f = await fixture();
    const target = await f.t.run(async ctx => {
      const panelId = await ctx.db.insert("devices", { projectId: f.projectId, name: "IDE", brand: "ide_smart", ideUuid: "visitor-panel", isActive: true, createdAt: now, updatedAt: now });
      const hikId = await ctx.db.insert("devices", { projectId: f.projectId, name: "Hik", brand: "hikvision", isActive: true, createdAt: now, updatedAt: now });
      const doorId = await ctx.db.insert("doors", { projectId: f.projectId, deviceId: panelId, name: "Entry", ioId: 0 });
      const wrongDoorId = await ctx.db.insert("doors", { projectId: f.projectId, deviceId: panelId, name: "Other", ioId: 1 });
      const ruleId = await ctx.db.insert("accessRules", { projectId: f.projectId, name: "Visitor", targetType: "visitor", idePermissionNo: 10, days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"], isActive: true });
      await ctx.db.insert("groupDoors", { projectId: f.projectId, groupId: ruleId, doorId, createdAt: now });
      for (const deviceId of [panelId, hikId]) await ctx.db.insert("groupDevices", { projectId: f.projectId, groupId: ruleId, deviceId, createdAt: now });
      await ctx.db.insert("groupMembers", { projectId: f.projectId, groupId: ruleId, employeeId: f.visitorId, createdAt: now });
      const otherVisitorId = await ctx.db.insert("employees", { projectId: f.projectId, firstName: "Other", lastName: "Visitor", cardNumber: "654321", email: "other@test.test", isVisitor: true, isActive: true });
      await ctx.db.insert("groupMembers", { projectId: f.projectId, groupId: ruleId, employeeId: otherVisitorId, createdAt: now });
      await ctx.db.patch(f.visitorId, { accessRuleId: ruleId });
      await ctx.db.patch(f.deviceId, { virtualReaderDoorId: wrongDoorId });
      return { doorId, wrongDoorId, otherVisitorId };
    });
    const issued = await f.admin.mutation(api.visitorPasses.issue, { visitorId: f.visitorId, maxUses: 1 });
    expect(await f.scan(issued.token)).toEqual({ status: "denied", reason: "NOT_ALLOWED" });
    expect((await f.t.run(ctx => ctx.db.get(issued.passId)))?.usedCount).toBe(0);
    await f.t.run(ctx => ctx.db.patch(f.deviceId, { virtualReaderDoorId: target.doorId }));
    expect(await f.scan(issued.token)).toMatchObject({ status: "granted", doorId: target.doorId, visitorPassId: issued.passId });
    const jobs = await f.t.run(ctx => ctx.db.system.query("_scheduled_functions").collect());
    const removals = jobs.filter(job => job.name.includes("deleteEmployeeFromDevicesInternal") || job.name.includes("deleteIdeUserFromPanels"));
    expect(removals).toHaveLength(0);
    expect(JSON.stringify(removals)).not.toContain(target.otherVisitorId);
    expect(await f.t.action(internal.actions.hikvisionSync.syncEmployeeToDevicesInternal, { employeeId: f.visitorId })).toMatchObject({ synced: 0, failed: 0 });
    expect(await f.t.action(internal.actions.ideGatewayDevice.syncEmployeeToIdePanels, { employeeId: f.visitorId })).toMatchObject({ ok: true, queued: 0 });
    expect(await f.t.run(ctx => ctx.db.query("hikPendingOperations").take(10))).toEqual([]);
    expect(await f.t.run(ctx => ctx.db.query("idePendingOperations").take(10))).toEqual([]);
    const readings = await f.t.run(ctx => ctx.db.query("cardReadings").take(10));
    expect(readings.every(reading => reading.cardNo === "")).toBe(true);
  });

  it("deletes pass credentials through the employee cascade and attempt rows through device cascade", async () => {
    const f = await fixture();
    const issued = await f.admin.mutation(api.visitorPasses.issue, { visitorId: f.visitorId });
    await f.pin("invalid");
    await f.t.run(async ctx => { await cascadeRemoveEmployeePII({ ...ctx, user: null }, f.visitorId); });
    expect(await f.t.run(ctx => ctx.db.get(issued.passId))).toBeNull();
    await f.t.run(ctx => purgeDeviceCascade(ctx, f.deviceId, f.projectId));
    expect(await f.t.run(ctx => ctx.db.query("visitorPassAttempts").take(10))).toEqual([]);
  });

  it("reserves active and exhausted PINs with at most five collision retries", async () => {
    const f = await fixture();
    const issued = await f.admin.mutation(api.visitorPasses.issue, { visitorId: f.visitorId });
    const otherId = await f.t.run(ctx => ctx.db.insert("employees", { projectId: f.projectId, firstName: "Other", lastName: "Pass", cardNumber: "777777", email: "pass@test.test", isVisitor: true, visitorCredential: "pass" }));
    const randomPin = vi.spyOn(visitorPassHelpers, "generateVisitorPin").mockReturnValue(issued.pin);
    await expect(f.admin.mutation(api.visitorPasses.issue, { visitorId: otherId })).rejects.toThrow("PIN üretilemedi");
    expect(randomPin).toHaveBeenCalledTimes(5);
    expect(await f.admin.query(api.visitorPasses.getForVisitor, { visitorId: otherId })).toBeNull();
    await f.t.run(ctx => ctx.db.patch(issued.passId, { status: "exhausted", maxUses: 1, usedCount: 1 }));
    randomPin.mockClear();
    await expect(f.admin.mutation(api.visitorPasses.issue, { visitorId: otherId })).rejects.toThrow("PIN üretilemedi");
    expect(randomPin).toHaveBeenCalledTimes(5);
    await f.admin.mutation(api.visitorPasses.revoke, { visitorId: f.visitorId });
    const reused = await f.admin.mutation(api.visitorPasses.issue, { visitorId: otherId });
    expect(reused.pin).toBe(issued.pin);
  });

  it("creates a cardless visitor with a unique uint32 card and validates card mode/limits", async () => {
    const f = await fixture();
    const ruleId = await f.t.run(ctx => ctx.db.insert("accessRules", { projectId: f.projectId, name: "Visitor", targetType: "visitor", isActive: true }));
    const args = { projectId: f.projectId, firstName: "New", lastName: "Visitor", credential: "pass" as const, presetRuleId: ruleId, accessExpiresAt: "2026-11-25T18:00:00Z" };
    const id = await f.admin.mutation(api.visitors.create, args);
    const visitor = await f.t.run(ctx => ctx.db.get(id));
    expect(visitor?.visitorCredential).toBe("pass");
    expect(Number(visitor?.cardNumber)).toBeGreaterThan(0); expect(Number(visitor?.cardNumber)).toBeLessThanOrEqual(4294967295);
    const id2 = await f.admin.mutation(api.visitors.create, args);
    expect((await f.t.run(ctx => ctx.db.get(id2)))?.cardNumber).not.toBe(visitor?.cardNumber);
    await f.admin.mutation(api.visitors.update, { visitorId: id, accessExpiresAt: "2026-11-25T19:00:00Z" });
    const cloudJobs = await f.t.run(ctx => ctx.db.system.query("_scheduled_functions").collect());
    expect(cloudJobs).toEqual([]);
    await f.admin.mutation(api.visitors.create, { ...args, credential: "card", cardNumber: "87654321" });
    const cardJobs = await f.t.run(ctx => ctx.db.system.query("_scheduled_functions").collect());
    expect(cardJobs.map(job => job.name).sort()).toEqual(["actions/hikvisionSync:syncEmployeeToDevicesInternal", "actions/ideGatewayDevice:syncEmployeeToIdePanels"].sort());
    await expect(f.admin.mutation(api.visitors.create, { ...args, credential: "card" })).rejects.toThrow();
    for (const maxUses of [0, -1, 1.5]) await expect(f.admin.mutation(api.visitorPasses.issue, { visitorId: id, maxUses })).rejects.toThrow("pozitif tam sayı");
  });

  it("treats an already missing bound door as unbound and repairs the dangling reference", async () => {
    const f = await fixture();
    await f.t.run(async ctx => {
      const doorId = await ctx.db.insert("doors", { projectId: f.projectId, name: "Removed" });
      await ctx.db.patch(f.deviceId, { virtualReaderDoorId: doorId });
      await ctx.db.delete(doorId);
    });
    const issued = await f.admin.mutation(api.visitorPasses.issue, { visitorId: f.visitorId });
    expect(await f.scan(issued.token)).toMatchObject({ status: "granted", doorId: null });
    expect((await f.t.run(ctx => ctx.db.get(f.deviceId)))?.virtualReaderDoorId).toBeUndefined();
  });

  it.each(["door", "device"] as const)("clears virtual reader bindings when the owning %s is removed", async mode => {
    const f = await fixture();
    const target = await f.t.run(async ctx => {
      const panelId = await ctx.db.insert("devices", { projectId: f.projectId, name: "Panel", brand: "other", createdAt: now, updatedAt: now });
      const doorId = await ctx.db.insert("doors", { projectId: f.projectId, name: "Delete", deviceId: panelId });
      await ctx.db.patch(f.deviceId, { virtualReaderDoorId: doorId });
      return { panelId, doorId };
    });
    if (mode === "door") await f.admin.mutation(api.doors.remove, { doorId: target.doorId });
    else await f.t.run(ctx => purgeDeviceCascade(ctx, target.panelId, f.projectId));
    expect(await f.t.run(ctx => ctx.db.get(target.doorId))).toBeNull();
    expect((await f.t.run(ctx => ctx.db.get(f.deviceId)))?.virtualReaderDoorId).toBeUndefined();
    expect(await f.t.run(ctx => ctx.db.get(f.deviceId))).not.toBeNull();
  });
});
