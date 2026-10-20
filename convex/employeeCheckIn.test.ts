// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const now = "2026-10-19T09:00:00.000Z";

async function fixture() {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(now));
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "Synthetic A" });
    const otherProjectId = await ctx.db.insert("projects", { name: "Synthetic B" });
    const employeeId = await ctx.db.insert("employees", { projectId, firstName: "Synthetic", lastName: "A", cardNumber: "synthetic-card", email: "a@example.test", isActive: true });
    const otherEmployeeId = await ctx.db.insert("employees", { projectId: otherProjectId, firstName: "Synthetic", lastName: "B", cardNumber: "synthetic-card-b", email: "b@example.test", isActive: true });
    const authId = await ctx.db.insert("employeeAuth", { employeeId, passwordHash: "synthetic-hash", passwordVersion: 1, createdAt: now, updatedAt: now });
    await ctx.db.insert("employeeAuth", { employeeId: otherEmployeeId, passwordHash: "synthetic-hash-b", passwordVersion: 1, createdAt: now, updatedAt: now });
    const sessionId = await ctx.db.insert("employeeSessions", { employeeId, token: "session-a", passwordVersion: 1, expiresAt: "2030-01-01T00:00:00Z", createdAt: now });
    await ctx.db.insert("employeeSessions", { employeeId: otherEmployeeId, token: "session-b", passwordVersion: 1, expiresAt: "2030-01-01T00:00:00Z", createdAt: now });
    const deviceId = await ctx.db.insert("devices", { projectId, brand: "other", name: "Generic A", deviceSerial: "synthetic-serial-a", isActive: true, createdAt: now, updatedAt: now });
    const foreignDeviceId = await ctx.db.insert("devices", { projectId: otherProjectId, name: "Foreign device", deviceSerial: "synthetic-serial-b", isActive: true, createdAt: now, updatedAt: now });
    const ruleId = await ctx.db.insert("accessRules", { projectId, name: "Reader schedule", isActive: true, days: ["Monday"], startTime: "09:00", endTime: "18:00" });
    await ctx.db.insert("groupMembers", { projectId, groupId: ruleId, employeeId, createdAt: now });
    await ctx.db.insert("groupDevices", { projectId, groupId: ruleId, deviceId, createdAt: now });
    return { projectId, otherProjectId, employeeId, otherEmployeeId, authId, sessionId, deviceId, foreignDeviceId, ruleId };
  });
  return { t, ...ids };
}

afterEach(() => vi.useRealTimers());

describe("reader-purpose token trust boundary using real wrappers", () => {
  it("never grants unused tokens through the public browser/phone endpoint, even with location", async () => {
    const { t } = await fixture();
    const issued = await t.mutation(api.employeeCheckIn.createMyCheckInToken, { sessionToken: "session-a" });
    expect(issued).toMatchObject({ purpose: "reader", serverTime: now, expiresAt: "2026-10-19T09:01:00.000Z" });
    const results = await Promise.all(Array.from({ length: 10 }, () => t.mutation(api.employeeCheckIn.checkInWithToken, { token: issued.token, latitude: 0, longitude: 0 })));
    expect(results.every(result => !result.success && result.code === "READER_REQUIRED")).toBe(true);
    expect(await t.run(ctx => ctx.db.query("cardReadings").take(10))).toEqual([]);
    expect((await t.run(ctx => ctx.db.query("checkInTokens").first()))?.usedAt).toBeUndefined();
  });

  it("reports own active/consumed/expired status without leaking foreign token existence", async () => {
    const { t } = await fixture();
    const issued = await t.mutation(api.employeeCheckIn.createMyCheckInToken, { sessionToken: "session-a" });
    expect(await t.query(api.employeeCheckIn.getMyCheckInTokenStatus, { sessionToken: "session-a", token: issued.token })).toEqual({ status: "active", expiresAt: issued.expiresAt, serverTime: now });
    await expect(t.query(api.employeeCheckIn.getMyCheckInTokenStatus, { sessionToken: "session-b", token: issued.token })).rejects.toThrow("TOKEN_NOT_FOUND");
    vi.advanceTimersByTime(60_000);
    expect(await t.query(api.employeeCheckIn.getMyCheckInTokenStatus, { sessionToken: "session-a", token: issued.token })).toMatchObject({ status: "expired" });
  });

  it("consumes exactly once on an authenticated generic reader and replays only the original snapshot", async () => {
    const { t, deviceId, employeeId } = await fixture();
    const issued = await t.mutation(api.employeeCheckIn.createMyCheckInToken, { sessionToken: "session-a" });
    const readerArgs = { cardNo: issued.token, deviceSerial: "synthetic-serial-a", authedDeviceId: deviceId };
    const results = await Promise.all(Array.from({ length: 10 }, () => t.mutation(internal.cardReadings.processCardReading, readerArgs)));
    expect(results.filter(result => result.granted)).toHaveLength(1);
    const readings = await t.run(ctx => ctx.db.query("cardReadings").take(20));
    expect(readings).toHaveLength(1);
    expect(readings[0]).toMatchObject({ employeeId, deviceId, accessTime: now, accessStatus: "izin_verildi", rawData: JSON.stringify({ source: "qr", protocol: "generic_reader" }) });
    expect(await t.query(api.employeeCheckIn.getMyCheckInTokenStatus, { sessionToken: "session-a", token: issued.token })).toMatchObject({ status: "consumed" });
    await t.run(ctx => ctx.db.delete(employeeId));
    vi.advanceTimersByTime(120_000);
    expect(await t.mutation(api.employeeCheckIn.checkInWithToken, { token: issued.token, latitude: 99, longitude: 99 })).toEqual({ success: true, employeeName: "Synthetic A", accessTime: now, locationRecorded: false });
    expect(await t.run(ctx => ctx.db.query("cardReadings").take(20))).toHaveLength(1);
  });

  it.each(["employee", "device", "schedule", "epoch", "password", "project", "foreign", "unauthed", "expired", "legacyPurpose", "hik", "ide"] as const)("rejects first reader consumption after %s invalidation without marking used or granting", async kind => {
    const { t, employeeId, deviceId, authId, projectId, ruleId, foreignDeviceId } = await fixture();
    const issued = await t.mutation(api.employeeCheckIn.createMyCheckInToken, { sessionToken: "session-a" });
    await t.run(async ctx => {
      if (kind === "employee") await ctx.db.patch(employeeId, { isActive: false });
      if (kind === "device") await ctx.db.patch(deviceId, { isActive: false });
      if (kind === "schedule") await ctx.db.patch(ruleId, { days: ["Tuesday"] });
      if (kind === "epoch") await ctx.db.patch(employeeId, { accessExpiresAt: now });
      if (kind === "password") await ctx.db.patch(authId, { passwordVersion: 2 });
      if (kind === "project") await ctx.db.patch(projectId, { isActive: false });
      if (kind === "hik") await ctx.db.patch(deviceId, { brand: "hikvision" });
      if (kind === "ide") await ctx.db.patch(deviceId, { brand: "ide_smart" });
      if (kind === "legacyPurpose") {
        const token = await ctx.db.query("checkInTokens").first();
        if (token) await ctx.db.patch(token._id, { purpose: undefined });
      }
    });
    if (kind === "expired") vi.advanceTimersByTime(60_000);
    expect(await t.mutation(internal.cardReadings.processCardReading, {
      cardNo: issued.token, deviceSerial: "synthetic-serial-a",
      ...(kind === "unauthed" ? {} : { authedDeviceId: kind === "foreign" ? foreignDeviceId : deviceId }),
      ...(kind === "hik" ? { hikMajorEventType: 5, hikSubEventType: 1 } : {}),
      ...(kind === "ide" ? { ideResult: 0, ideIoId: 0 } : {}),
    })).toEqual({ granted: false });
    expect((await t.run(ctx => ctx.db.query("checkInTokens").first()))?.usedAt).toBeUndefined();
    expect(await t.run(ctx => ctx.db.query("cardReadings").take(20))).toEqual([]);
  });

  it("preserves completed legacy token snapshots but never creates new legacy movement", async () => {
    const { t, employeeId } = await fixture();
    await t.run(ctx => ctx.db.insert("checkInTokens", { employeeId, token: "synthetic-completed", expiresAt: "2020-01-01T00:00:00Z", usedAt: now, employeeName: "Previous snapshot", locationRecorded: true, createdAt: now }));
    expect(await t.mutation(api.employeeCheckIn.checkInWithToken, { token: "synthetic-completed" })).toEqual({ success: true, employeeName: "Previous snapshot", accessTime: now, locationRecorded: true });
    expect(await t.mutation(api.employeeCheckIn.checkInWithToken, { token: "missing" })).toMatchObject({ success: false, code: "invalid_token" });
    expect(await t.run(ctx => ctx.db.query("cardReadings").take(20))).toEqual([]);
  });
  it("revokes an unconsumed reader token after real signOut and reports expired after re-login", async () => {
    const { t, deviceId, employeeId } = await fixture();
    const issued = await t.mutation(api.employeeCheckIn.createMyCheckInToken, { sessionToken: "session-a" });
    await t.mutation(api.employeeAuth.signOut, { sessionToken: "session-a" });
    expect(await t.mutation(internal.cardReadings.processCardReading, { cardNo: issued.token, deviceSerial: "synthetic-serial-a", authedDeviceId: deviceId })).toEqual({ granted: false });
    await t.run(ctx => ctx.db.insert("employeeSessions", { employeeId, token: "new-session", passwordVersion: 1, expiresAt: "2030-01-01T00:00:00Z", createdAt: now }));
    expect(await t.query(api.employeeCheckIn.getMyCheckInTokenStatus, { sessionToken: "new-session", token: issued.token })).toMatchObject({ status: "expired" });
    expect((await t.run(ctx => ctx.db.query("checkInTokens").first()))?.usedAt).toBeUndefined();
    expect(await t.run(ctx => ctx.db.query("cardReadings").take(20))).toEqual([]);
  });

  it("rejects expired issuing sessions and legacy reader tokens without an issuing session", async () => {
    const { t, deviceId, sessionId } = await fixture();
    const issued = await t.mutation(api.employeeCheckIn.createMyCheckInToken, { sessionToken: "session-a" });
    await t.run(ctx => ctx.db.patch(sessionId, { expiresAt: now }));
    expect(await t.mutation(internal.cardReadings.processCardReading, { cardNo: issued.token, deviceSerial: "synthetic-serial-a", authedDeviceId: deviceId })).toEqual({ granted: false });
    await t.run(async ctx => {
      await ctx.db.patch(sessionId, { expiresAt: "2030-01-01T00:00:00Z" });
      const token = await ctx.db.query("checkInTokens").first();
      if (token) await ctx.db.patch(token._id, { sessionId: undefined });
    });
    expect(await t.mutation(internal.cardReadings.processCardReading, { cardNo: issued.token, deviceSerial: "synthetic-serial-a", authedDeviceId: deviceId })).toEqual({ granted: false });
    expect(await t.run(ctx => ctx.db.query("cardReadings").take(20))).toEqual([]);
  });

});
