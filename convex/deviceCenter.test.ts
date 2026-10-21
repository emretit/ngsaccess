// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { getOverview } from "./deviceCenter";
import { internalMutation, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";

const gateway = vi.hoisted(() => ({
  addDeviceToGateway: vi.fn(), deleteDeviceFromGateway: vi.fn(), linkDoorStatusPlan: vi.fn(), linkVerifyPlan: vi.fn(),
  openDoor: vi.fn(), rebootDeviceOnGateway: vi.fn(), captureCardOnDevice: vi.fn(),
  fetchHikCapabilitySnapshot: vi.fn(), getAcsWorkStatus: vi.fn(), fetchCardReaderSnapshot: vi.fn(), searchAcsEventsOnDevice: vi.fn(),
  searchCardsOnDevice: vi.fn(), searchFacesOnDevice: vi.fn(), searchFingerprintsOnDevice: vi.fn(),
}));
vi.mock("./lib/hikGateway", async importOriginal => ({
  ...await importOriginal<typeof import("./lib/hikGateway")>(), ...gateway,
}));
const modules = import.meta.glob("./**/*.ts");
const now = new Date("2026-10-21T12:00:00Z");
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(now); vi.resetAllMocks();
  gateway.fetchHikCapabilitySnapshot.mockResolvedValue({ version: 1, updatedAt: Date.now(), probes: [] });
  gateway.getAcsWorkStatus.mockResolvedValue({ ok: true, status: {} });
  gateway.fetchCardReaderSnapshot.mockResolvedValue({ version: 1, readerNo: 1, updatedAt: Date.now(), summary: { readerNo: 1 }, results: [] });
  gateway.searchAcsEventsOnDevice.mockResolvedValue({ ok: true, events: [], numMatches: 0, totalMatches: 0, hasMore: false });
  gateway.addDeviceToGateway.mockResolvedValue({ ok: false, error: "Gateway kapalı" });
  gateway.deleteDeviceFromGateway.mockResolvedValue({ ok: true });
  gateway.linkDoorStatusPlan.mockResolvedValue({ ok: true });
  gateway.linkVerifyPlan.mockResolvedValue({ ok: true });
  gateway.openDoor.mockResolvedValue({ ok: true });
  gateway.rebootDeviceOnGateway.mockResolvedValue({ ok: true });
  gateway.captureCardOnDevice.mockResolvedValue({ ok: true, cardNo: "secret-captured-card" });
  gateway.searchCardsOnDevice.mockResolvedValue({ ok: true, cards: [{ cardNo: "secret-device-card" }], numMatches: 1, nextPosition: 1, hasMore: false });
  gateway.searchFacesOnDevice.mockResolvedValue({ ok: true, faces: [], numMatches: 0, nextPosition: 0, hasMore: false });
  gateway.searchFingerprintsOnDevice.mockResolvedValue({ ok: true, fingerprints: [], numMatches: 0, nextPosition: 0, hasMore: false });
});
afterEach(() => vi.useRealTimers());
async function fixture(role: "project_user" | "project_admin" | "super_admin" = "project_admin", auditFails = false, enqueueFails = false) {
  const t = convexTest(schema, auditFails ? {
    ...modules,
    ...(enqueueFails ? { "./ideSync.ts": async () => ({
      ...await import("./ideSync"),
      enqueueIdeOp: internalMutation({
        args: { deviceId: v.id("devices"), projectId: v.optional(v.id("projects")), opType: v.literal("openDoor"), payload: v.object({ ioId: v.number(), keep: v.number() }) },
        handler: async () => { throw new Error("Asıl kuyruk istisnası 123456789"); },
      }),
    }) } : {}),
    "./deviceEvents.ts": async () => ({
      ...await import("./deviceEvents"),
      recordOperationInternal: internalMutation({
        args: { deviceId: v.id("devices"), label: v.string(), ok: v.boolean(), summary: v.optional(v.string()) },
        handler: async () => { throw new Error("Audit yazımı başarısız"); },
      }),
    }),
  } : modules);
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "A" });
    await ctx.db.insert("projectPrivacySettings", { projectId, biometricEnabled: true, updatedAt: now.toISOString() });
    const foreignProjectId = await ctx.db.insert("projects", { name: "B" });
    const userId = await ctx.db.insert("users", { role });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 86400000 });
    await ctx.db.insert("userProjects", { userId, projectId });
    const base = { projectId, name: "Panel", isActive: true, createdAt: now.toISOString(), updatedAt: now.toISOString() };
    const hikId = await ctx.db.insert("devices", { ...base, brand: "hikvision", hikTransport: "gateway", hikDevIndex: "hik-index", ehomeID: "test-ehome" });
    const ideId = await ctx.db.insert("devices", { ...base, brand: "ide_smart", ideUuid: "123456789012345" });
    const doorId = await ctx.db.insert("doors", { name: "Kapı", projectId, deviceId: hikId, hikDoorNo: 1 });
    const ideDoorId = await ctx.db.insert("doors", { name: "IDE Kapı", projectId, deviceId: ideId, ioId: 0 });
    const readerId = await ctx.db.insert("readers", { name: "Okuyucu", projectId, deviceId: hikId, doorId, direction: "entry", hikReaderNo: 1, createdAt: now.toISOString(), updatedAt: now.toISOString() });
    return { projectId, foreignProjectId, userId, sessionId, hikId, ideId, doorId, ideDoorId, readerId };
  });
  return { t, caller: t.withIdentity({ subject: `${ids.userId}|${ids.sessionId}` }), ...ids };
}
async function events(f: Awaited<ReturnType<typeof fixture>>) {
  return await f.t.run(ctx => ctx.db.query("deviceEvents").collect());
}

describe("drawer commands authorization and server audit", () => {
  it("rejects project_user from all eight manager commands and both device mutations without audit", async () => {
    const f = await fixture("project_user");
    const commands = [
      f.caller.action(api.actions.hikGatewayDevice.fetchDeviceCapabilities, { deviceId: f.hikId }),
      f.caller.action(api.actions.hikGatewayDevice.rebootDevice, { deviceId: f.hikId }),
      f.caller.action(api.actions.hikGatewayDevice.fetchDeviceWorkStatus, { deviceId: f.hikId }),
      f.caller.action(api.actions.hikGatewayDevice.backfillDeviceEvents, { deviceId: f.hikId }),
      f.caller.action(api.actions.hikGatewayDevice.reconcileDevice, { deviceId: f.hikId }),
      f.caller.action(api.actions.hikGatewayDevice.captureCardFromDevice, { deviceId: f.hikId }),
      f.caller.action(api.actions.hikGatewayDevice.fetchReaderCfg, { readerId: f.readerId }),
      f.caller.action(api.actions.ideGatewayDevice.triggerPanelSync, { deviceId: f.ideId }),
    ];
    for (const result of await Promise.all(commands)) expect(result).toMatchObject({ ok: false, error: "Bu işlem için yönetici yetkisi gerekiyor" });
    await expect(f.caller.mutation(api.devices.update, { deviceId: f.hikId, name: "Changed" })).rejects.toThrow("yetkiniz");
    await expect(f.caller.mutation(api.devices.remove, { deviceId: f.hikId })).rejects.toThrow("yetkiniz");
    expect(await events(f)).toEqual([]);
    expect(gateway.rebootDeviceOnGateway).not.toHaveBeenCalled();
    expect(gateway.captureCardOnDevice).not.toHaveBeenCalled();
  });
  it("rejects project_user from all six additional Hik actions before execution or audit", async () => {
    const f = await fixture("project_user");
    const results = await Promise.all([
      f.caller.action(api.actions.hikGatewayDevice.registerDeviceOnGateway, { deviceId: f.hikId }),
      f.caller.action(api.actions.hikGatewayDevice.removeDeviceFromGateway, { deviceId: f.hikId }),
      f.caller.action(api.actions.hikGatewayDevice.captureFaceFromDevice, { deviceId: f.hikId }),
      f.caller.action(api.actions.hikGatewayDevice.applyDoorStatusPlan, { doorId: f.doorId }),
      f.caller.action(api.actions.hikGatewayDevice.applyVerifyPlan, { doorId: f.doorId }),
    ]);
    for (const result of results) expect(result).toEqual({ ok: false, error: "Bu işlem için yönetici yetkisi gerekiyor" });
    await expect(f.caller.action(api.actions.hikGatewayDevice.refreshGatewayDeviceStatus, {})).rejects.toThrow("yönetici yetkisi");
    expect(await events(f)).toEqual([]);
    expect(gateway.addDeviceToGateway).not.toHaveBeenCalled();
    expect(gateway.deleteDeviceFromGateway).not.toHaveBeenCalled();
    expect(gateway.linkDoorStatusPlan).not.toHaveBeenCalled();
    expect(gateway.linkVerifyPlan).not.toHaveBeenCalled();
  });
  it("rejects all three create mutations for project_user without writes", async () => {
    const f = await fixture("project_user");
    await expect(f.caller.mutation(api.devices.create, { name: "Yeni", projectId: f.projectId })).rejects.toThrow("yetkiniz");
    await expect(f.caller.mutation(api.devices.createIdePanel, { name: "Yeni", projectId: f.projectId })).rejects.toThrow("yetkiniz");
    await expect(f.caller.mutation(api.devices.createHikDevice, { name: "Yeni", projectId: f.projectId, doorCount: 1, readersPerDoor: 1 })).rejects.toThrow("yetkiniz");
    expect(await f.t.run(ctx => ctx.db.query("devices").collect())).toHaveLength(2);
  });
  it("audits the four newly wrapped writes exactly once", async () => {
    const f = await fixture();
    await f.caller.action(api.actions.hikGatewayDevice.registerDeviceOnGateway, { deviceId: f.hikId });
    await f.caller.action(api.actions.hikGatewayDevice.applyDoorStatusPlan, { doorId: f.doorId });
    await f.caller.action(api.actions.hikGatewayDevice.applyVerifyPlan, { doorId: f.doorId });
    await f.caller.action(api.actions.hikGatewayDevice.removeDeviceFromGateway, { deviceId: f.hikId });
    expect((await events(f)).map(e => e.label)).toEqual(["Gateway'e kaydet: başarısız", "Kapı durum planı uygula: komut iletildi", "Doğrulama planı uygula: komut iletildi", "Gateway'den kaldır: komut iletildi"]);
  });
  it("preserves Hik results and original exceptions when the audit mutation throws", async () => {
    const f = await fixture("project_admin", true);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      expect(await f.caller.action(api.actions.hikGatewayDevice.rebootDevice, { deviceId: f.hikId })).toEqual({ ok: true });
      gateway.rebootDeviceOnGateway.mockResolvedValue({ ok: false, error: "Asıl hata" });
      expect(await f.caller.action(api.actions.hikGatewayDevice.rebootDevice, { deviceId: f.hikId })).toEqual({ ok: false, error: "Asıl hata" });
      gateway.openDoor.mockRejectedValue(new Error("Asıl istisna"));
      await expect(f.caller.action(api.actions.hikGatewayDevice.remoteOpenDoor, { deviceId: f.hikId })).rejects.toThrow("Asıl istisna");
      expect(warn).toHaveBeenCalledTimes(3);
    } finally { warn.mockRestore(); }
  });
  it("preserves IDE results and original exceptions when the audit mutation throws", async () => {
    const f = await fixture("project_admin", true);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      expect(await f.caller.action(api.actions.ideGatewayDevice.openIdeDoor, { deviceId: f.ideId, doorId: f.ideDoorId })).toEqual({ ok: true, queued: true });
      const broken = await fixture("project_admin", true, true);
      await expect(broken.caller.action(api.actions.ideGatewayDevice.openIdeDoor, { deviceId: broken.ideId, doorId: broken.ideDoorId })).rejects.toThrow("Asıl kuyruk istisnası");
      expect(warn).toHaveBeenCalled();
    } finally { warn.mockRestore(); }
  });
  it("masks long digit sequences and bounds result and thrown error summaries", async () => {
    const f = await fixture();
    const message = "Kart 123456789 hatası " + "x".repeat(210) + " 987654321";
    gateway.rebootDeviceOnGateway.mockResolvedValue({ ok: false, error: message });
    await f.caller.action(api.actions.hikGatewayDevice.rebootDevice, { deviceId: f.hikId });
    gateway.openDoor.mockRejectedValue(new Error(message));
    await expect(f.caller.action(api.actions.hikGatewayDevice.remoteOpenDoor, { deviceId: f.hikId })).rejects.toThrow("Kart");
    for (const event of await events(f)) {
      expect(event.rawData).toBe(("Kart … hatası " + "x".repeat(210) + " …").slice(0, 200));
      expect(event.rawData).not.toMatch(/\d{6,}/);
    }
  });
  it("allows project_user to open both brands and audits actions without a client write", async () => {
    const f = await fixture("project_user");
    expect(await f.caller.action(api.actions.hikGatewayDevice.remoteOpenDoor, { deviceId: f.hikId })).toMatchObject({ ok: true });
    expect(await f.caller.action(api.actions.ideGatewayDevice.openIdeDoor, { deviceId: f.ideId, doorId: f.ideDoorId })).toEqual({ ok: true, queued: true });
    expect((await events(f)).map(e => e.label)).toEqual(["Kapı aç: komut iletildi", "Kapı aç: sıraya alındı"]);
  });
  it.each(["project_admin", "super_admin"] as const)("allows %s manager execution and queues IDE sync audit", async role => {
    const f = await fixture(role);
    expect(await f.caller.action(api.actions.hikGatewayDevice.rebootDevice, { deviceId: f.hikId })).toEqual({ ok: true });
    expect(await f.caller.action(api.actions.ideGatewayDevice.triggerPanelSync, { deviceId: f.ideId })).toEqual({ ok: true, queued: true });
    expect((await events(f)).map(e => e.label)).toEqual(["Yeniden başlat: komut iletildi", "Panel senkronu: sıraya alındı"]);
  });
  it("audits each diagnostic command and the local bridge door queue", async () => {
    const f = await fixture();
    expect(await f.caller.action(api.actions.hikGatewayDevice.fetchDeviceCapabilities, { deviceId: f.hikId })).toMatchObject({ ok: true });
    expect(await f.caller.action(api.actions.hikGatewayDevice.fetchDeviceWorkStatus, { deviceId: f.hikId })).toMatchObject({ ok: true });
    expect(await f.caller.action(api.actions.hikGatewayDevice.fetchReaderCfg, { readerId: f.readerId })).toMatchObject({ ok: true });
    expect(await f.caller.action(api.actions.hikGatewayDevice.backfillDeviceEvents, { deviceId: f.hikId })).toMatchObject({ ok: true });
    await f.t.run(ctx => ctx.db.patch(f.hikId, { hikTransport: "localBridge" }));
    expect(await f.caller.action(api.actions.hikGatewayDevice.remoteOpenDoor, { deviceId: f.hikId })).toMatchObject({ ok: true, queued: true });
    expect((await events(f)).map(e => e.label)).toEqual([
      "Özellikleri tara: komut iletildi", "Çalışma durumu: komut iletildi", "Okuyucu ayarlarını oku: komut iletildi", "Olayları tara: komut iletildi", "Kapı aç: sıraya alındı",
    ]);
  });
  it("audits short failure reasons without gateway payloads", async () => {
    const f = await fixture();
    gateway.rebootDeviceOnGateway.mockResolvedValue({ ok: false, error: "private gateway error" });
    await f.caller.action(api.actions.hikGatewayDevice.rebootDevice, { deviceId: f.hikId });
    gateway.openDoor.mockRejectedValue(new Error("private thrown error"));
    await expect(f.caller.action(api.actions.hikGatewayDevice.remoteOpenDoor, { deviceId: f.hikId })).rejects.toThrow("private thrown error");
    expect((await events(f)).map(e => [e.label, e.severity, e.rawData])).toEqual([
      ["Yeniden başlat: başarısız", "warning", "private gateway error"], ["Kapı aç: başarısız", "warning", "private thrown error"],
    ]);
  });
  it("never audits project rejection, missing devices or missing readers", async () => {
    const f = await fixture();
    await f.t.run(ctx => ctx.db.patch(f.hikId, { projectId: f.foreignProjectId }));
    expect(await f.caller.action(api.actions.hikGatewayDevice.rebootDevice, { deviceId: f.hikId })).toMatchObject({ ok: false });
    await f.t.run(ctx => ctx.db.delete(f.hikId));
    expect(await f.caller.action(api.actions.hikGatewayDevice.remoteOpenDoor, { deviceId: f.hikId })).toMatchObject({ ok: false, error: "Cihaz bulunamadı" });
    expect(await events(f)).toEqual([]);
  });
  it("reconcile audit contains counts alone and capture audit excludes card numbers", async () => {
    const f = await fixture();
    const result = await f.caller.action(api.actions.hikGatewayDevice.reconcileDevice, { deviceId: f.hikId });
    expect(result).toMatchObject({ ok: true, onDeviceCount: 1, onDeviceNotExpected: ["secret-device-card"] });
    await f.caller.action(api.actions.hikGatewayDevice.captureCardFromDevice, { deviceId: f.hikId });
    const rows = await events(f);
    expect(rows[0].rawData).toBe("cihazda 1, eksik 0, fazla 1");
    expect(JSON.stringify(rows)).not.toContain("secret-");
  });
  it("bounds the internal summary at 2000 characters", async () => {
    const f = await fixture();
    await f.t.mutation(internal.deviceEvents.recordOperationInternal, { deviceId: f.hikId, label: "Test: komut iletildi", ok: true, summary: "x".repeat(2100) });
    expect((await events(f))[0].rawData).toHaveLength(2000);
  });
});

describe("getOverview bounded data", () => {
  it.each(["hikvision", "ide_smart"] as const)("counts only %s queues, caps at 100 and projects events", async brand => {
    const f = await fixture();
    const deviceId = brand === "hikvision" ? f.hikId : f.ideId;
    await f.t.run(async ctx => {
      for (const status of ["pending", "processing", "failed", "done"] as const) {
        for (let i = 0; i < 102; i++) await ctx.db.insert("hikPendingOperations", { deviceId, status, operation: "openDoor", payload: {}, attemptCount: 0, createdAt: Date.now() });
      }
      for (const status of ["pending", "sent", "failed", "acked"] as const) {
        for (let i = 0; i < 102; i++) await ctx.db.insert("idePendingOperations", { deviceId, status, opType: "openDoor", payload: {}, attempts: 0, idempotencyKey: `${status}-${i}`, createdAt: Date.now() });
      }
      await ctx.db.insert("deviceEvents", { deviceId, label: "Test", source: "system", category: "operation", severity: "info", eventTime: now.toISOString(), createdAt: now.toISOString(), updatedAt: now.toISOString(), cardNo: "123", rawData: "private blob" });
    });
    const overview = await f.caller.query(api.deviceCenter.getOverview, { deviceId });
    expect(overview).not.toBeNull();
    if (!overview) throw new Error("overview missing");
    const active = brand === "hikvision" ? overview.queues.hikvision : overview.queues.ideSmart;
    const inactive = brand === "hikvision" ? overview.queues.ideSmart : overview.queues.hikvision;
    for (const status of Object.values(active)) expect(status).toEqual({ count: 100, capped: true });
    for (const status of Object.values(inactive)) expect(status).toEqual({ count: 0, capped: false });
    expect(overview.queues.hikvision).not.toHaveProperty("done");
    expect(overview.queues.ideSmart).not.toHaveProperty("acked");
    expect(Object.keys(overview.recentEvents[0]).sort()).toEqual(["_id", "label", "eventTime", "cardNo", "category", "severity"].sort());
    expect(overview).not.toHaveProperty("online");
    expect(overview.device).not.toHaveProperty("hikWorkStatus");
    expect(JSON.stringify(overview)).not.toContain("private blob");
  });
  it.each(["hikvision", "ide_smart"] as const)("reads only three bounded %s statuses and never terminal or other-brand queues", async brand => {
    const f = await fixture();
    const calls: { table: string; method: string; args: unknown[] }[] = [];
    function trace(target: object, table: string): object {
      return new Proxy(target, {
        get(obj, key) {
          const value: unknown = Reflect.get(obj, key);
          if (typeof value !== "function") return value;
          return (...args: unknown[]) => {
            calls.push({ table, method: String(key), args: [...args] });
            if (key === "withIndex" && typeof args[1] === "function") {
              const callback = args[1];
              args[1] = (q: object) => Reflect.apply(callback, undefined, [trace(q, table)]);
            }
            const result: unknown = Reflect.apply(value, obj, args);
            return result !== null && typeof result === "object" && ["withIndex", "eq", "order"].includes(String(key)) ? trace(result, table) : result;
          };
        },
      });
    }
    await f.caller.run(async ctx => {
      const db = new Proxy(ctx.db, {
        get(target, key) {
          if (key !== "query") return Reflect.get(target, key);
          return (table: string) => {
            const result: object = Reflect.apply(target.query, target, [table]);
            return trace(result, table);
          };
        },
      });
      const query = getOverview as unknown as { _handler: (ctx: QueryCtx, args: { deviceId: typeof f.hikId }) => Promise<unknown> };
      await query._handler({ ...ctx, db }, { deviceId: brand === "hikvision" ? f.hikId : f.ideId });
    });
    const queueReads = calls.filter(call => call.table.endsWith("PendingOperations"));
    expect(new Set(queueReads.map(call => call.table))).toEqual(new Set([brand === "hikvision" ? "hikPendingOperations" : "idePendingOperations"]));
    expect(queueReads.filter(call => call.method === "take").map(call => call.args)).toEqual([[101], [101], [101]]);
    expect(queueReads.filter(call => call.method === "eq" && call.args[0] === "status").map(call => call.args[1]).sort()).toEqual(brand === "hikvision" ? ["failed", "pending", "processing"] : ["failed", "pending", "sent"]);
    expect(queueReads.some(call => call.method === "collect")).toBe(false);
  });
  it("caps 257 doors and 1025 readers without breaking overview", async () => {
    const f = await fixture();
    await f.t.run(async ctx => {
      for (let i = 0; i < 256; i++) await ctx.db.insert("doors", { name: `Kapı ${i}`, deviceId: f.hikId, projectId: f.projectId });
      for (let i = 0; i < 1024; i++) await ctx.db.insert("readers", { name: `Okuyucu ${i}`, doorId: f.doorId, deviceId: f.hikId, projectId: f.projectId, direction: "entry", createdAt: now.toISOString(), updatedAt: now.toISOString() });
    });
    const overview = await f.caller.query(api.deviceCenter.getOverview, { deviceId: f.hikId });
    expect(overview?.doors).toHaveLength(256);
    expect(overview?.readers).toHaveLength(1024);
    expect(overview?.limits).toEqual({ doorsCapped: true, readersCapped: true });
  });
  it("does not cap exactly 100 rows", async () => {
    const f = await fixture();
    await f.t.run(async ctx => {
      for (let i = 0; i < 100; i++) await ctx.db.insert("hikPendingOperations", { deviceId: f.hikId, status: "pending", operation: "openDoor", payload: {}, attemptCount: 0, createdAt: Date.now() });
    });
    expect((await f.caller.query(api.deviceCenter.getOverview, { deviceId: f.hikId }))?.queues.hikvision.pending).toEqual({ count: 100, capped: false });
  });
});

describe("gateway heartbeat throttle", () => {
  it("skips unchanged heartbeats before 60s, writes at 60s and immediately on monitored changes", async () => {
    const f = await fixture();
    const heartbeat = (online = true, extra = {}) => f.t.mutation(internal.devices.applyGatewayHeartbeat, { hikDevIndex: "hik-index", online, ...extra });
    await heartbeat();
    const first = await f.t.run(ctx => ctx.db.get(f.hikId));
    vi.setSystemTime(now.getTime() + 59_999); await heartbeat();
    expect(await f.t.run(ctx => ctx.db.get(f.hikId))).toEqual(first);
    vi.setSystemTime(now.getTime() + 60_000); await heartbeat();
    expect((await f.t.run(ctx => ctx.db.get(f.hikId)))?.hikLastSeenAt).toBe(now.getTime() + 60_000);
    vi.setSystemTime(now.getTime() + 60_001); await heartbeat(false);
    expect((await f.t.run(ctx => ctx.db.get(f.hikId)))?.hikOfflineHint).toBe("Gateway çevrimdışı");
    vi.setSystemTime(now.getTime() + 60_002); await heartbeat(true, { deviceIp: "10.0.0.1", model: "test-model" });
    expect(await f.t.run(ctx => ctx.db.get(f.hikId))).toMatchObject({ deviceIp: "10.0.0.1", hikModel: "test-model", hikLastSeenAt: now.getTime() + 60_002 });
    expect((await f.t.run(ctx => ctx.db.get(f.hikId)))?.hikOfflineHint).toBeUndefined();
    vi.setSystemTime(now.getTime() + 60_003); await heartbeat(true, { deviceIp: "10.0.0.2", model: "other" });
    expect((await f.t.run(ctx => ctx.db.get(f.hikId)))?.hikLastSeenAt).toBe(now.getTime() + 60_002);
  });
  it("preserves project scope and does not write rejected heartbeats", async () => {
    const f = await fixture();
    const before = await f.t.run(ctx => ctx.db.get(f.hikId));
    expect(await f.t.mutation(internal.devices.applyGatewayHeartbeat, { hikDevIndex: "hik-index", online: true, allowedProjectIds: [] })).toBe(false);
    expect(await f.t.run(ctx => ctx.db.get(f.hikId))).toEqual(before);
  });
});
