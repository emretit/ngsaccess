// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import type { Doc } from "./_generated/dataModel";
import type { Permission } from "./lib/roleCatalog";
import { CARD_CAPTURE_PERMISSIONS } from "./lib/readingAccess";
import { PERMISSION_DENIED } from "./lib/permissions";

const modules = import.meta.glob("./**/*.ts");
const startedAt = "2026-10-27T12:00:00.000Z";
const receivedAt = "2026-10-27T12:00:01.000Z";

async function fixture(permissions: Permission[] = ["visitors.manage"]) {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "Capture" });
    const otherProjectId = await ctx.db.insert("projects", { name: "Other" });
    const userId = await ctx.db.insert("users", { role: "project_user", verified: true });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 86400000 });
    await ctx.db.insert("userProjects", { userId, projectId, role: "security" });
    await ctx.db.insert("projectRolePermissions", { projectId, role: "security", permissions, updatedAt: 0, updatedBy: userId });
    const deviceId = await ctx.db.insert("devices", { projectId, name: "Reader", createdAt: startedAt, updatedAt: startedAt });
    const otherDeviceId = await ctx.db.insert("devices", { projectId: otherProjectId, name: "Other", createdAt: startedAt, updatedAt: startedAt });
    return { projectId, otherProjectId, userId, sessionId, deviceId, otherDeviceId };
  });
  const caller = t.withIdentity({ subject: `${ids.userId}|${ids.sessionId}` });
  const addReading = (patch: Partial<Doc<"cardReadings">> = {}) => t.run(ctx => ctx.db.insert("cardReadings", {
    projectId: ids.projectId, deviceId: ids.deviceId, cardNo: "123456",
    accessTime: "2026-10-27T11:58:01.000Z", createdAt: receivedAt, ...patch,
  }));
  const addPerson = (patch: Partial<Doc<"employees">> = {}) => t.run(ctx => ctx.db.insert("employees", {
    projectId: ids.projectId, firstName: "Ada", lastName: "Test", email: "test@example.invalid",
    cardNumber: "123456", isVisitor: true, isActive: false, ...patch,
  }));
  const query = (includeInactiveVisitorCards = false) => caller.query(api.cardReadings.getLastUnknownByDevice, {
    projectId: ids.projectId, deviceId: ids.deviceId, sinceTime: startedAt, includeInactiveVisitorCards,
  });
  return { t, caller, ...ids, addReading, addPerson, query };
}

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(startedAt)); });
afterEach(() => vi.useRealTimers());

describe("sunucu zamanıyla kart yakalama", () => {
  it("başlangıç zamanını sunucu belirler ve her başlatmada yeniler", async () => {
    const f = await fixture();
    const args = { projectId: f.projectId, deviceId: f.deviceId };
    expect(await f.caller.mutation(api.cardReadings.startCardCapture, args)).toBe(startedAt);
    vi.setSystemTime(new Date(receivedAt));
    expect(await f.caller.mutation(api.cardReadings.startCardCapture, args)).toBe(receivedAt);
  });
  it.each(["2026-10-27T11:58:01.000Z", "2026-10-20T12:00:01.000Z", "2026-10-27T12:05:00.000Z"])("cihaz saati %s iken yeni okuma yakalanır", async accessTime => {
    const f = await fixture();
    vi.setSystemTime(new Date(receivedAt));
    await f.addReading({ accessTime });
    expect(await f.query()).toEqual({ cardNo: "123456", accessTime });
  });
  it.each(["2026-10-27T11:59:59.000Z", startedAt])("alım zamanı %s olan eski okuma yakalanmaz", async createdAt => {
    const f = await fixture();
    vi.setSystemTime(new Date(receivedAt));
    await f.addReading({ createdAt, accessTime: "2026-10-27T12:05:00.000Z" });
    expect(await f.query()).toBeNull();
  });
  it("eski belgelerde sunucunun _creationTime alanını kullanır", async () => {
    const f = await fixture();
    await f.addReading({ createdAt: undefined, cardNo: "old" });
    vi.setSystemTime(new Date(receivedAt));
    await f.addReading({ createdAt: undefined });
    expect((await f.query())?.cardNo).toBe("123456");
  });
  it("son okumayı cihaz saatine göre sıralamaz", async () => {
    const f = await fixture();
    vi.setSystemTime(new Date(receivedAt));
    await f.addReading({ cardNo: "old", accessTime: "2026-10-27T12:05:00.000Z" });
    vi.setSystemTime(new Date("2026-10-27T12:00:02.000Z"));
    await f.addReading({ createdAt: "2026-10-27T12:00:02.000Z" });
    expect((await f.query())?.cardNo).toBe("123456");
  });
  it("okuma taramasını 50 kayıtla sınırlar", async () => {
    const f = await fixture();
    const employeeId = await f.addPerson({ isVisitor: false, isActive: true });
    vi.setSystemTime(new Date(receivedAt));
    await f.addReading({ cardNo: "older-unknown" });
    for (let index = 0; index < 50; index += 1) await f.addReading({ employeeId });
    expect(await f.query(true)).toBeNull();
  });
});

describe("yalnız ziyaretçiye yeniden verilebilen kart", () => {
  it("pasif ziyaretçi kartını ziyaretçi yakalamasına verir, toplu kişi atamasına vermez", async () => {
    const f = await fixture();
    const employeeId = await f.addPerson();
    vi.setSystemTime(new Date(receivedAt));
    await f.addReading({ employeeId });
    expect((await f.query(true))?.cardNo).toBe("123456");
    expect(await f.query()).toBeNull();
  });
  it.each([
    { isVisitor: true, isActive: true },
    { isVisitor: true, isActive: undefined },
    { isVisitor: false, isActive: true },
    { isVisitor: false, isActive: false },
    { cardNumber: "IADE:123456:old" },
    { cardNumber: "different" },
  ])("uygun olmayan kişiyi yakalamaz: %j", async patch => {
    const f = await fixture();
    const employeeId = await f.addPerson(patch);
    vi.setSystemTime(new Date(receivedAt));
    await f.addReading({ employeeId });
    expect(await f.query(true)).toBeNull();
  });
  it("başka projedeki pasif ziyaretçiyi veya okumayı yakalamaz", async () => {
    const f = await fixture();
    const employeeId = await f.addPerson({ projectId: f.otherProjectId });
    vi.setSystemTime(new Date(receivedAt));
    await f.addReading({ employeeId });
    await f.addReading({ projectId: f.otherProjectId });
    expect(await f.query(true)).toBeNull();
    expect(await f.caller.query(api.cardReadings.getLastUnknownByDevice, { projectId: f.projectId, deviceId: f.otherDeviceId })).toBeNull();
    await expect(f.caller.mutation(api.cardReadings.startCardCapture, { projectId: f.projectId, deviceId: f.otherDeviceId })).rejects.toThrow("Okuyucu seçili projede bulunamadı");
  });
  it("bilinmeyen okumanın kartı sonradan personele atanmışsa artık yakalamaz", async () => {
    const f = await fixture();
    vi.setSystemTime(new Date(receivedAt));
    await f.addReading();
    expect((await f.query())?.cardNo).toBe("123456");
    await f.addPerson({ isVisitor: false, isActive: true });
    expect(await f.query()).toBeNull();
    expect(await f.query(true)).toBeNull();
  });
});

describe("kart yakalama yetkileri", () => {
  it.each(CARD_CAPTURE_PERMISSIONS)("%s tek başına başlatabilir ve yakalayabilir", async permission => {
    const f = await fixture([permission]);
    await expect(f.caller.mutation(api.cardReadings.startCardCapture, { projectId: f.projectId, deviceId: f.deviceId })).resolves.toBe(startedAt);
    vi.setSystemTime(new Date(receivedAt));
    await f.addReading();
    expect((await f.query(true))?.cardNo).toBe("123456");
  });
  it("yetki kaldırıldığında hem başlangıcı hem yakalamayı reddeder", async () => {
    const f = await fixture([]);
    await expect(f.caller.mutation(api.cardReadings.startCardCapture, { projectId: f.projectId, deviceId: f.deviceId })).rejects.toThrow(PERMISSION_DENIED);
    await expect(f.query(true)).rejects.toThrow(PERMISSION_DENIED);
  });
});
