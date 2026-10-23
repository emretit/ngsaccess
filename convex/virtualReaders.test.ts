// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import rateLimiterTest from "@convex-dev/rate-limiter/test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { VIRTUAL_READER_TYPE } from "./lib/virtualReader";

const modules = import.meta.glob("./**/*.ts");
const now = "2026-10-23T06:00:00.000Z";

async function fixture() {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(now));
  const t = convexTest(schema, modules);
  rateLimiterTest.register(t);
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "Proje A" });
    const otherProjectId = await ctx.db.insert("projects", { name: "Proje B" });
    const employeeId = await ctx.db.insert("employees", { projectId, firstName: "Ada", lastName: "Test", cardNumber: "card-a", email: "a@example.test", isActive: true });
    const foreignEmployeeId = await ctx.db.insert("employees", { projectId: otherProjectId, firstName: "Bora", lastName: "Test", cardNumber: "card-b", email: "b@example.test", isActive: true });
    await ctx.db.insert("employeeAuth", { employeeId, passwordHash: "hash", passwordVersion: 1, createdAt: now, updatedAt: now });
    await ctx.db.insert("employeeAuth", { employeeId: foreignEmployeeId, passwordHash: "hash-b", passwordVersion: 1, createdAt: now, updatedAt: now });
    await ctx.db.insert("employeeSessions", { employeeId, token: "session-a", passwordVersion: 1, expiresAt: "2030-01-01T00:00:00Z", createdAt: now });
    await ctx.db.insert("employeeSessions", { employeeId: foreignEmployeeId, token: "session-b", passwordVersion: 1, expiresAt: "2030-01-01T00:00:00Z", createdAt: now });
    return { projectId, otherProjectId, employeeId };
  });
  async function member(role: "admin" | "viewer") {
    const { userId, sessionId } = await t.run(async ctx => {
      const userId = await ctx.db.insert("users", { role: "project_user", verified: true });
      await ctx.db.insert("userProjects", { userId, projectId: ids.projectId, role });
      const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 86400000 });
      return { userId, sessionId };
    });
    return t.withIdentity({ subject: `${userId}|${sessionId}` });
  }
  return { t, member, ...ids };
}

afterEach(() => vi.useRealTimers());

describe("sanal okuyucu", () => {
  it("cihaz olarak oluşur, okuyucu token'ı ile bağlanır ve mobil QR'ı tek kez tüketir", async () => {
    const { t, member, projectId, employeeId } = await fixture();
    const admin = await member("admin");
    const { deviceId, readerToken } = await admin.mutation(api.virtualReaders.create, { projectId, name: "  Ana giriş  " });
    const device = await t.run(ctx => ctx.db.get(deviceId));
    expect(device).toMatchObject({ projectId, name: "Ana giriş", brand: "other", deviceType: VIRTUAL_READER_TYPE, isActive: true, apiToken: readerToken });
    expect(device?.accessDirection).toBeUndefined();

    expect(await t.mutation(api.virtualReaders.connect, { readerToken })).toEqual({ name: "Ana giriş", isActive: true, projectName: "Proje A" });
    expect((await t.run(ctx => ctx.db.get(deviceId)))?.lastSeen).toBe(now);

    // Erişim kuralı tanımlı olmasa da projenin aktif çalışanı okutabilir (kapı açmaz, yalnız kayıt).
    const issued = await t.mutation(api.employeeCheckIn.createMyCheckInToken, { sessionToken: "session-a" });
    const results = await Promise.all(Array.from({ length: 5 }, () => t.mutation(api.virtualReaders.scan, { readerToken, code: ` ${issued.token} ` })));
    expect(results.filter(result => result.status === "granted")).toEqual([{ status: "granted", employeeName: "Ada Test", direction: "entry", accessTime: now }]);
    expect(results.filter(result => result.status === "denied")).toHaveLength(4);
    expect(results.find(result => result.status === "denied")).toEqual({ status: "denied", reason: "TOKEN_USED" });

    const readings = await t.run(ctx => ctx.db.query("cardReadings").take(10));
    expect(readings).toHaveLength(1);
    expect(readings[0]).toMatchObject({ projectId, deviceId, employeeId, cardNo: "card-a", accessStatus: "izin_verildi", direction: "entry", rawData: JSON.stringify({ source: "qr", protocol: "virtual_reader" }) });
    expect(await t.query(api.employeeCheckIn.getMyCheckInTokenStatus, { sessionToken: "session-a", token: issued.token })).toMatchObject({ status: "consumed" });
  });

  it("başka projenin çalışanını, süresi dolan kodu ve pasif okuyucuyu kayıtsız reddeder", async () => {
    const { t, member, projectId } = await fixture();
    const admin = await member("admin");
    const { deviceId, readerToken } = await admin.mutation(api.virtualReaders.create, { projectId, name: "Kapı" });

    const foreign = await t.mutation(api.employeeCheckIn.createMyCheckInToken, { sessionToken: "session-b" });
    expect(await t.mutation(api.virtualReaders.scan, { readerToken, code: foreign.token })).toEqual({ status: "denied", reason: "NOT_ALLOWED" });

    const expired = await t.mutation(api.employeeCheckIn.createMyCheckInToken, { sessionToken: "session-a" });
    vi.advanceTimersByTime(61_000);
    expect(await t.mutation(api.virtualReaders.scan, { readerToken, code: expired.token })).toEqual({ status: "denied", reason: "TOKEN_EXPIRED" });
    expect(await t.mutation(api.virtualReaders.scan, { readerToken, code: "kart-123" })).toEqual({ status: "denied", reason: "TOKEN_INVALID" });

    const fresh = await t.mutation(api.employeeCheckIn.createMyCheckInToken, { sessionToken: "session-a" });
    await t.run(ctx => ctx.db.patch(deviceId, { isActive: false, status: "inactive" }));
    expect(await t.mutation(api.virtualReaders.scan, { readerToken, code: fresh.token })).toEqual({ status: "denied", reason: "READER_INACTIVE" });
    expect(await t.run(ctx => ctx.db.query("cardReadings").take(10))).toEqual([]);
  });

  it("geçersiz ya da sanal olmayan cihaz token'ını okuyucu olarak kabul etmez", async () => {
    const { t, projectId } = await fixture();
    const panelToken = crypto.randomUUID();
    await t.run(ctx => ctx.db.insert("devices", { projectId, brand: "other", name: "ESP32", apiToken: panelToken, isActive: true, createdAt: now, updatedAt: now }));
    expect(await t.mutation(api.virtualReaders.connect, { readerToken: panelToken })).toBeNull();
    expect(await t.mutation(api.virtualReaders.connect, { readerToken: "yok" })).toBeNull();
    const issued = await t.mutation(api.employeeCheckIn.createMyCheckInToken, { sessionToken: "session-a" });
    expect(await t.mutation(api.virtualReaders.scan, { readerToken: panelToken, code: issued.token })).toEqual({ status: "reader_invalid" });
  });

  it("yalnız cihaz yönetebilen rol oluşturur", async () => {
    const { member, projectId, otherProjectId } = await fixture();
    const viewer = await member("viewer");
    await expect(viewer.mutation(api.virtualReaders.create, { projectId, name: "Kapı" })).rejects.toThrow();
    const admin = await member("admin");
    await expect(admin.mutation(api.virtualReaders.create, { projectId: otherProjectId, name: "Kapı" })).rejects.toThrow();
    await expect(admin.mutation(api.virtualReaders.create, { projectId, name: "   " })).rejects.toThrow("Okuyucu adı zorunlu");
  });

  it("aynı token /card-reader yolunda da erişim kuralı aramadan kabul edilir; yön sırayla belirlenir", async () => {
    const { t, member, projectId } = await fixture();
    const admin = await member("admin");
    const { deviceId, readerToken } = await admin.mutation(api.virtualReaders.create, { projectId, name: "Kapı" });
    const issued = await t.mutation(api.employeeCheckIn.createMyCheckInToken, { sessionToken: "session-a" });
    expect(await t.mutation(internal.cardReadings.processCardReading, { cardNo: issued.token, deviceSerial: "", authedDeviceId: deviceId })).toEqual({ granted: true });
    const second = await t.mutation(api.employeeCheckIn.createMyCheckInToken, { sessionToken: "session-a" });
    expect(await t.mutation(api.virtualReaders.scan, { readerToken, code: second.token })).toMatchObject({ status: "granted", direction: "exit" });
    expect((await t.run(ctx => ctx.db.query("cardReadings").take(10))).map(row => row.direction)).toEqual(["entry", "exit"]);
  });
});
