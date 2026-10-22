// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";

const modules = import.meta.glob("./**/*.ts");
const now = Date.parse("2026-10-22T12:00:00Z");
const day = 86400000;
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(now); });
afterEach(() => vi.useRealTimers());

async function fixture(fields: Partial<Doc<"devices">> = {}) {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "Proje" });
    const otherProjectId = await ctx.db.insert("projects", { name: "Diğer" });
    const userId = await ctx.db.insert("users", { role: "project_user" });
    const adminId = await ctx.db.insert("users", { role: "project_admin" });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: now + day });
    const adminSessionId = await ctx.db.insert("authSessions", { userId: adminId, expirationTime: now + day });
    await ctx.db.insert("userProjects", { userId, projectId });
    await ctx.db.insert("userProjects", { userId: adminId, projectId });
    const deviceId = await ctx.db.insert("devices", {
      name: "Panel", brand: "other", projectId, lastSeen: new Date(now - 600000).toISOString(),
      createdAt: new Date(now).toISOString(), updatedAt: new Date(now).toISOString(), ...fields,
    });
    return { projectId, otherProjectId, userId, adminId, sessionId, adminSessionId, deviceId };
  });
  return {
    t, ...ids,
    caller: t.withIdentity({ subject: `${ids.userId}|${ids.sessionId}` }),
    admin: t.withIdentity({ subject: `${ids.adminId}|${ids.adminSessionId}` }),
  };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
const events = (f: Fixture) => f.t.run(ctx => ctx.db.query("deviceEvents").take(600));
const history = (f: Fixture) => f.caller.query(api.deviceEvents.getConnectivityHistory, { deviceId: f.deviceId });

const paths = ["gateway", "localBridge", "ideMqtt", "ideCommand", "esp32", "httpOther", "settings"] as const;
type Path = typeof paths[number];
async function pathFixture(path: Path, signal: number | undefined) {
  const fields: Partial<Doc<"devices">> = {
    brand: path === "gateway" || path === "localBridge" ? "hikvision" : path === "ideMqtt" || path === "ideCommand" ? "ide_smart" : "other",
    hikTransport: path === "localBridge" ? "localBridge" : undefined,
    hikDevIndex: path === "gateway" ? "gateway" : undefined,
    ideUuid: path === "ideMqtt" ? "mqtt-uuid" : undefined,
    lastSeen: signal === undefined ? undefined : new Date(signal).toISOString(),
    hikLastSeenAt: path === "gateway" ? signal : undefined,
  };
  return fixture(fields);
}
async function heartbeat(f: Fixture, path: Path) {
  if (path === "gateway") return f.t.mutation(internal.devices.applyGatewayHeartbeat, { hikDevIndex: "gateway", online: true });
  if (path === "ideCommand") return f.t.mutation(internal.devices.markIdeOnline, { deviceId: f.deviceId });
  if (path === "ideMqtt") return f.t.mutation(internal.devices.updateLastSeen, { ideUuid: "mqtt-uuid" });
  if (path === "settings") return f.admin.mutation(api.devices.update, { deviceId: f.deviceId, lastSeen: new Date(Date.now()).toISOString() });
  return f.t.mutation(internal.devices.updateLastSeen, { deviceId: f.deviceId });
}

describe("connectivity writers", () => {
  it("gateway quiet gap without an offline hint is not an outage (card-event-only signal)", async () => {
    const f = await pathFixture("gateway", now - 6 * 60000);
    await heartbeat(f, "gateway");
    expect(await events(f)).toEqual([]);
  });
  it.each(paths.filter(path => path !== "gateway"))("%s records one long gap, then no repeated event", async path => {
    const f = await pathFixture(path, now - 600000);
    await heartbeat(f, path);
    await heartbeat(f, path);
    const rows = await events(f);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ category: "status", severity: "warning", label: "Çevrimdışı dönemi", eventTime: new Date(now).toISOString(), source: path === "localBridge" ? "hikvision" : path === "ideMqtt" || path === "ideCommand" ? "ide_smart" : "system" });
    expect(JSON.parse(rows[0].rawData ?? "null")).toEqual({ offlineFrom: now - 600000, offlineTo: now, durationMs: 600000 });
  });
  it.each(paths)("%s ignores short gaps, never and future signals", async path => {
    for (const signal of [now - 60000, undefined, now + 60000]) {
      const f = await pathFixture(path, signal);
      await heartbeat(f, path);
      expect(await events(f)).toHaveLength(0);
    }
  });
  it("gateway hint transition records once before throttle and offline probes retain successful signal", async () => {
    const f = await pathFixture("gateway", now - 1000);
    await f.t.mutation(internal.devices.applyGatewayHeartbeat, { hikDevIndex: "gateway", online: false });
    expect((await f.t.run(ctx => ctx.db.get(f.deviceId)))?.hikLastSeenAt).toBe(now - 1000);
    expect(await events(f)).toHaveLength(0);
    await heartbeat(f, "gateway");
    const after = await f.t.run(ctx => ctx.db.get(f.deviceId));
    vi.setSystemTime(now + 1);
    await heartbeat(f, "gateway");
    expect(await f.t.run(ctx => ctx.db.get(f.deviceId))).toEqual(after);
    expect(await events(f)).toHaveLength(1);
    expect(JSON.parse((await events(f))[0].rawData ?? "null").durationMs).toBe(1000);
  });
  it("keeps offline gateway probes throttled without overwriting the last successful signal", async () => {
    const f = await pathFixture("gateway", now - 600000);
    await f.t.mutation(internal.devices.applyGatewayHeartbeat, { hikDevIndex: "gateway", online: false });
    const after = await f.t.run(ctx => ctx.db.get(f.deviceId));
    vi.setSystemTime(now + 1);
    await f.t.mutation(internal.devices.applyGatewayHeartbeat, { hikDevIndex: "gateway", online: false });
    expect(await f.t.run(ctx => ctx.db.get(f.deviceId))).toEqual(after);
    expect(after?.hikLastSeenAt).toBe(now - 600000);
    expect(await events(f)).toHaveLength(0);
  });
  it("writes a reconnect signal even if another transport timestamp would throttle the heartbeat", async () => {
    const f = await fixture({ brand: "hikvision", hikTransport: "localBridge", hikDevIndex: "gateway", hikLastSeenAt: now - 1 });
    await heartbeat(f, "gateway"); await heartbeat(f, "gateway");
    expect(await events(f)).toHaveLength(1);
    expect((await f.t.run(ctx => ctx.db.get(f.deviceId)))?.lastSeen).toBe(new Date(now).toISOString());
  });
  it("rejected gateway scope cannot create a period", async () => {
    const f = await pathFixture("gateway", now - 600000);
    expect(await f.t.mutation(internal.devices.applyGatewayHeartbeat, { hikDevIndex: "gateway", online: true, allowedProjectIds: [] })).toBe(false);
    expect(await events(f)).toHaveLength(0);
  });
  it("HTTP clears an offline hint along with the signal to prevent duplicate periods", async () => {
    const f = await fixture({ brand: "hikvision", hikOfflineHint: "Çevrimdışı", hikLastSeenAt: now - 1000 });
    await heartbeat(f, "httpOther"); await heartbeat(f, "httpOther");
    expect(await events(f)).toHaveLength(1);
    expect((await f.t.run(ctx => ctx.db.get(f.deviceId)))?.hikOfflineHint).toBeUndefined();
  });
});

async function insertPeriod(f: Fixture, from: number, to: number) {
  await f.t.run(ctx => ctx.db.insert("deviceEvents", {
    deviceId: f.deviceId, projectId: f.projectId, source: "system", category: "status", severity: "warning", label: "Çevrimdışı dönemi",
    eventTime: new Date(to).toISOString(), createdAt: new Date(to).toISOString(), updatedAt: new Date(to).toISOString(),
    rawData: JSON.stringify({ offlineFrom: from, offlineTo: to, durationMs: to - from }),
  }));
}

describe("connectivity history", () => {
  it("permits project_user and rejects another project's device", async () => {
    const f = await fixture();
    expect((await history(f)).ongoing).toEqual({ since: now - 600000 });
    await f.t.run(ctx => ctx.db.patch(f.deviceId, { projectId: f.otherProjectId }));
    await expect(history(f)).rejects.toThrow("erişim yetkiniz yok");
  });
  it("applies the 30-day window, clips crossing periods, and calculates totals and longest", async () => {
    const f = await fixture({ lastSeen: new Date(now).toISOString() });
    await insertPeriod(f, now - 32 * day, now - 31 * day);
    await insertPeriod(f, now - 31 * day, now - 29 * day);
    await insertPeriod(f, now - 3600000, now - 600000);
    const result = await history(f);
    expect(result).toMatchObject({ count: 2, totalMs: day + 3000000, longestMs: day, truncated: false });
    expect(result.periods[0].durationMs).toBe(3000000);
    expect(result.periods[1].offlineFrom).toBe(now - 31 * day);
    expect(result.ongoing).toBeUndefined();
  });
  it("includes the open period without writing and clips its aggregate to the window", async () => {
    const f = await fixture({ lastSeen: new Date(now - 31 * day).toISOString() });
    expect(await history(f)).toMatchObject({ count: 1, totalMs: 30 * day, longestMs: 30 * day, periods: [], ongoing: { since: now - 31 * day } });
    expect(await events(f)).toEqual([]);
  });
  it("gateway history shows an ongoing outage only after an explicit offline hint", async () => {
    const quiet = await fixture({ brand: "hikvision", hikTransport: "gateway", hikLastSeenAt: now - 3600000 });
    expect(await history(quiet)).toMatchObject({ count: 0, periodicHeartbeat: false });
    expect(await history(quiet)).not.toHaveProperty("ongoing");
    const hinted = await fixture({ brand: "hikvision", hikTransport: "gateway", hikLastSeenAt: now - 3600000, hikOfflineHint: "Gateway çevrimdışı" });
    expect(await history(hinted)).toMatchObject({ count: 1, ongoing: { since: now - 3600000 }, periodicHeartbeat: false });
  });
  it.each([undefined, "invalid", new Date(now + 1).toISOString()])("does not invent ongoing periods for %s", async lastSeen => {
    const f = await fixture({ lastSeen });
    expect(await history(f)).toEqual({ asOf: now, count: 0, totalMs: 0, longestMs: 0, periods: [], truncated: false, periodicHeartbeat: true });
  });
  it("takes at most 501 periods and returns the last 20; exactly 500 is not truncated", async () => {
    const f = await fixture({ lastSeen: new Date(now).toISOString() });
    for (let i = 0; i < 500; i++) await insertPeriod(f, now - (i + 1) * 600000, now - i * 600000);
    expect(await history(f)).toMatchObject({ count: 500, totalMs: 300000000, truncated: false });
    await insertPeriod(f, now - 501 * 600000, now - 500 * 600000);
    const result = await history(f);
    expect(result).toMatchObject({ count: 500, totalMs: 300000000, longestMs: 600000, truncated: true });
    expect(result.periods).toHaveLength(20);
    expect(result.periods[0].offlineTo).toBe(now);
    expect(result.periods[19].offlineTo).toBe(now - 19 * 600000);
  });
  it("ignores other events, malformed raw data, and future periods", async () => {
    const f = await fixture({ lastSeen: new Date(now).toISOString() });
    await insertPeriod(f, now - 600000, now + 1);
    await f.t.run(async ctx => {
      const base = { deviceId: f.deviceId, source: "system" as const, category: "status" as const, severity: "warning" as const, label: "Çevrimdışı dönemi", eventTime: new Date(now).toISOString(), createdAt: new Date(now).toISOString(), updatedAt: new Date(now).toISOString() };
      for (const rawData of ["{", "null", "{}", JSON.stringify({ offlineFrom: now - 10, offlineTo: now, durationMs: 20 })]) await ctx.db.insert("deviceEvents", { ...base, rawData });
      await ctx.db.insert("deviceEvents", { ...base, label: "Başka durum" });
      await ctx.db.insert("deviceEvents", { ...base, category: "operation" });
    });
    expect((await history(f)).count).toBe(0);
  });
  it("validates the requested window", async () => {
    const f = await fixture();
    for (const days of [0, -1, 31, 1.5]) await expect(f.caller.query(api.deviceEvents.getConnectivityHistory, { deviceId: f.deviceId, days })).rejects.toThrow("Gün sayısı");
  });
});
