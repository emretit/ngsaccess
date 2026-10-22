// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { deviceConnection, deviceLastSignal, hasPeriodicHeartbeat } from "./lib/deviceConnection";

const modules = import.meta.glob("./**/*.ts");
const start = Date.parse("2026-10-22T12:00:00Z");
const minute = 60_000;
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(start); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

async function fixture(fields: Partial<Doc<"devices">> = {}) {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "ISUP" });
    const otherProjectId = await ctx.db.insert("projects", { name: "Diğer" });
    const userId = await ctx.db.insert("users", { role: "super_admin" });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: start + 86400000 });
    const base = { brand: "hikvision" as const, name: "Panel", createdAt: new Date(start).toISOString(), updatedAt: new Date(start).toISOString() };
    const deviceId = await ctx.db.insert("devices", {
      ...base, projectId, apiToken: "device-token", hikDevIndex: "dev-1",
      hikIsupOnline: true, hikIsupStatusAt: start - 1,
      lastSeen: new Date(start - 3600000).toISOString(), ...fields,
    });
    const otherId = await ctx.db.insert("devices", { ...base, projectId: otherProjectId, apiToken: "other-token", hikDevIndex: "dev-2" });
    await ctx.db.insert("alarmSettings", { projectId, emailEnabled: true, recipients: ["alarm@example.com"], minSeverity: "warning", updatedAt: new Date(start).toISOString() });
    return { projectId, otherProjectId, deviceId, otherId, userId, sessionId };
  });
  return { t, ...ids, caller: t.withIdentity({ subject: `${ids.userId}|${ids.sessionId}` }) };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
const status = (f: Fixture, value: "online" | "offline", at = Date.now(), snapshot = false) => f.t.mutation(internal.devices.applyIsupStatus, {
  deviceId: f.deviceId, devIndex: "dev-1", status: value, at, ...(snapshot ? { source: "snapshot" as const } : {}),
});
const device = (f: Fixture) => f.t.run(ctx => ctx.db.get(f.deviceId));
const events = (f: Fixture) => f.t.run(ctx => ctx.db.query("deviceEvents").take(50));
const jobs = (f: Fixture) => f.t.run(ctx => ctx.db.system.query("_scheduled_functions").take(50));
const history = (f: Fixture) => f.caller.query(api.deviceEvents.getConnectivityHistory, { deviceId: f.deviceId });
async function advance(f: Fixture, ms: number) {
  await vi.advanceTimersByTimeAsync(ms);
  await f.t.finishInProgressScheduledFunctions();
}
const post = (f: Fixture, body: unknown, token = "device-token") => f.t.fetch("/hik-gateway/device-status", {
  method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(body),
});

describe("ISUP outage ownership", () => {
  it("1 second outage changes UI immediately and leaves no alarm or period", async () => {
    const f = await fixture();
    await status(f, "offline");
    expect(deviceConnection((await device(f)) ?? {}, Date.now())).toBe("offline");
    await advance(f, 1000);
    expect((await history(f)).count).toBe(0);
    await status(f, "online");
    await advance(f, 5 * minute);
    expect(await events(f)).toEqual([]);
    expect((await history(f)).count).toBe(0);
    expect(await device(f)).toMatchObject({ hikIsupOnline: true });
    expect((await device(f))?.hikOfflineHint).toBeUndefined();
  });

  it("6 minute outage queues one email, creates one open exception and resolves it on reconnect", async () => {
    const f = await fixture();
    await status(f, "offline");
    // Run the same scheduler target directly so the email action remains inspectable and does not make network calls.
    vi.setSystemTime(start + 6 * minute);
    await f.t.mutation(internal.devices.confirmIsupOffline, { deviceId: f.deviceId, offlineFrom: start });
    await f.t.mutation(internal.devices.confirmIsupOffline, { deviceId: f.deviceId, offlineFrom: start });
    const before = await events(f);
    expect(before).toHaveLength(1);
    expect(before[0]).toMatchObject({ category: "exception", label: "Arıza: cihaz çevrimdışı", alarmEmailStatus: "queued" });
    expect(before[0].resolvedAt).toBeUndefined();
    expect((await jobs(f)).filter(job => job.name === "actions/sendAlarmEmail:send")).toHaveLength(1);
    expect(await history(f)).toMatchObject({ count: 1, ongoing: { since: start }, totalMs: 6 * minute, periodicHeartbeat: true });
    await status(f, "online");
    const after = await events(f);
    expect(after).toHaveLength(2);
    expect(after.filter(event => event.category === "exception")).toHaveLength(1);
    expect(after.find(event => event.category === "exception")?.resolvedAt).toBe(new Date(start + 6 * minute).toISOString());
    expect(JSON.parse(after.find(event => event.category === "status")?.rawData ?? "{}")).toEqual({ offlineFrom: start, offlineTo: start + 6 * minute, durationMs: 6 * minute });
    expect((await jobs(f)).filter(job => job.name === "actions/sendAlarmEmail:send")).toHaveLength(1);
  });

  it("resolves the ISUP alarm behind a newer legacy resolved alarm after bridge silence", async () => {
    const f = await fixture();
    await status(f, "offline");
    vi.setSystemTime(start + 6 * minute);
    await f.t.mutation(internal.devices.confirmIsupOffline, { deviceId: f.deviceId, offlineFrom: start });
    const isupAlarm = (await events(f))[0];
    expect(JSON.parse(isupAlarm.rawData ?? "{}")).toEqual({ source: "isup", offlineFrom: start });
    vi.setSystemTime(start + 3 * 3600000);
    // An actual legacy heartbeat writes a newer resolved alarm once ISUP is stale.
    await f.t.mutation(internal.devices.applyGatewayHeartbeat, { hikDevIndex: "dev-1", online: true });
    const legacyAlarm = (await events(f)).find(event => event.category === "exception" && event._id !== isupAlarm._id);
    expect(legacyAlarm?.resolvedAt).toBeDefined();
    expect(legacyAlarm?.eventTime).toBe(new Date(Date.now()).toISOString());
    // Reconfirmation must still find the original alarm and cannot duplicate it.
    await f.t.mutation(internal.devices.confirmIsupOffline, { deviceId: f.deviceId, offlineFrom: start });
    expect((await events(f)).filter(event => event.category === "exception")).toHaveLength(2);
    await status(f, "online", Date.now(), true);
    const resolved = (await events(f)).find(event => event._id === isupAlarm._id);
    expect(resolved?.resolvedAt).toBe(new Date(Date.now()).toISOString());
  });

  it("ignores ancient offline/online sequences without transitions, alarms or scheduled work", async () => {
    // Start without an ISUP timestamp so timestamp ordering cannot mask age validation.
    const f = await fixture({ hikIsupStatusAt: undefined });
    const before = await device(f);
    for (const [value, at] of [["offline", 1], ["online", 300001], ["offline", 300002], ["online", start - 10 * minute - 1]] as const) {
      expect(await status(f, value, at)).toBe(false);
      expect((await post(f, { devIndex: "dev-1", status: value, at })).status).toBe(400);
    }
    expect(await device(f)).toEqual(before);
    expect(await events(f)).toEqual([]);
    expect(await jobs(f)).toEqual([]);
    // The exact lower boundary is valid for both HTTP and internal ingestion.
    expect((await post(f, { devIndex: "dev-1", status: "online", at: start - 10 * minute })).status).toBe(200);
    expect((await device(f))?.hikIsupStatusAt).toBe(start - 10 * minute);
    expect(await jobs(f)).toEqual([]);
  });

  it("scheduled confirmation waits five minutes and an older outage cannot confirm a new one", async () => {
    const f = await fixture();
    await f.t.run(async ctx => {
      const settings = await ctx.db.query("alarmSettings").first();
      if (settings) await ctx.db.patch(settings._id, { emailEnabled: false });
    });
    await status(f, "offline");
    await advance(f, minute);
    await status(f, "online");
    await advance(f, minute);
    await status(f, "offline");
    await advance(f, 3 * minute);
    expect(await events(f)).toEqual([]);
    await advance(f, 2 * minute - 1);
    expect(await events(f)).toEqual([]);
    await advance(f, 1);
    expect(await events(f)).toHaveLength(1);
    expect((await events(f))[0].resolvedAt).toBeUndefined();
  });

  it("older events and repeated snapshots cannot create transitions or restart the timer", async () => {
    const f = await fixture();
    await status(f, "offline");
    vi.setSystemTime(start + minute);
    await status(f, "offline", Date.now(), true);
    await status(f, "online", start + 1000);
    await status(f, "online", Date.now()); // same-timestamp conflicting replay is ignored
    expect(await device(f)).toMatchObject({ hikIsupOnline: false, hikIsupOfflineSince: start, hikIsupStatusAt: start + minute });
    expect(await jobs(f)).toHaveLength(1);
    expect(await events(f)).toEqual([]);
    expect((await jobs(f))[0].scheduledTime).toBe(start + 5 * minute);
  });

  it("a delayed reconnect records the period without generating a reconnect exception", async () => {
    const f = await fixture();
    await status(f, "offline");
    vi.setSystemTime(start + 6 * minute);
    await status(f, "online");
    await f.t.mutation(internal.devices.confirmIsupOffline, { deviceId: f.deviceId, offlineFrom: start });
    expect((await events(f)).map(row => row.category)).toEqual(["status"]);
  });

  it("fresh online survives an hour without cards; three hours falls back to the card signal", async () => {
    const f = await fixture();
    const row = (await device(f)) ?? {};
    expect(deviceConnection(row, start + 3600000)).toBe("online");
    expect(deviceConnection(row, start + 3 * 3600000)).toBe("offline");
    expect(deviceConnection({ ...row, hikLastSeenAt: start + 3 * 3600000 }, start + 3 * 3600000)).toBe("online");
    expect(hasPeriodicHeartbeat(row, start)).toBe(true);
    expect(hasPeriodicHeartbeat(row, start + 3 * 3600000)).toBe(false);
    expect(deviceConnection({ ...row, hikTransport: "localBridge" }, start)).toBe("offline");
  });

  it("an old card event and gateway heartbeat cannot overturn fresh ISUP offline or record a transition", async () => {
    const f = await fixture();
    await status(f, "offline");
    vi.setSystemTime(start + minute);
    const res = await f.t.fetch("/card-reader", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer device-token" },
      body: JSON.stringify({ EventNotificationAlert: { devIndex: "dev-1", eventType: "AccessControllerEvent", dateTime: new Date(start - 3600000).toISOString(), AccessControllerEvent: { majorEventType: 5, subEventType: 27 } } }),
    });
    expect(res.status).toBe(200);
    await f.t.mutation(internal.devices.applyGatewayHeartbeat, { hikDevIndex: "dev-1", online: true });
    const row = (await device(f)) ?? {};
    expect(deviceConnection(row, Date.now())).toBe("offline");
    expect(deviceLastSignal(row)).toBe(start);
    expect(row).toMatchObject({ hikOfflineHint: "Cihaz gateway bağlantısı koptu" });
    expect((await events(f)).filter(event => event.label === "Çevrimdışı dönemi" || event.label === "Arıza: cihaz çevrimdışı")).toEqual([]);
  });

  it("selected UI fields and assigned admin inventory carry ISUP status", async () => {
    const f = await fixture();
    await f.t.run(ctx => ctx.db.insert("adminDevices", { name: "Panel", brand: "hikvision", assignedDeviceId: f.deviceId, assignedProjectId: f.projectId, createdAt: new Date(start).toISOString(), updatedAt: new Date(start).toISOString() }));
    const overview = await f.caller.query(api.deviceCenter.getOverview, { deviceId: f.deviceId });
    expect(overview?.device).toMatchObject({ hikIsupOnline: true, hikIsupStatusAt: start - 1 });
    const list = await f.caller.query(api.devices.list, { projectId: f.projectId });
    expect(list[0]).toMatchObject({ hikIsupOnline: true });
    const inventory = await f.caller.query(api.adminDevices.adminListPage, { connection: "online", paginationOpts: { numItems: 10, cursor: null } });
    expect(inventory.page).toHaveLength(1);
    expect(deviceConnection(inventory.page[0], start)).toBe("online");
  });
});

describe("ISUP HTTP authentication and body validation", () => {
  it("pins changes to the token device and rejects another project devIndex", async () => {
    const f = await fixture();
    const otherBefore = await f.t.run(ctx => ctx.db.get(f.otherId));
    expect((await post(f, { devIndex: "dev-2", status: "offline", at: start })).status).toBe(403);
    expect((await post(f, { devIndex: "dev-1", status: "offline", at: start })).status).toBe(200);
    expect(await f.t.run(ctx => ctx.db.get(f.otherId))).toEqual(otherBefore);
    expect((await device(f))?.hikIsupOnline).toBe(false);
  });
  it("rejects missing/wrong tokens, localBridge and non-Hik devices", async () => {
    const f = await fixture();
    const body = { devIndex: "dev-1", status: "offline", at: start };
    expect((await post(f, body, "wrong")).status).toBe(401);
    expect((await post(f, body, "")).status).toBe(401);
    await f.t.run(ctx => ctx.db.patch(f.deviceId, { hikTransport: "localBridge" }));
    expect((await post(f, body)).status).toBe(403);
    await f.t.run(ctx => ctx.db.patch(f.deviceId, { hikTransport: undefined, brand: "other" }));
    expect((await post(f, body)).status).toBe(403);
    expect(await jobs(f)).toEqual([]);
  });
  it("rejects malformed payloads and accepts a snapshot", async () => {
    const f = await fixture();
    for (const body of [null, [], {}, { devIndex: "dev-1", status: "unknown", at: start }, { devIndex: "dev-1", status: "offline", at: "now" }, { devIndex: "dev-1", status: "offline", at: -1 }, { devIndex: "dev-1", status: "offline", at: start + 121000 }, { devIndex: "dev-1", status: "offline", at: start, source: "untrusted" }]) {
      expect((await post(f, body)).status).toBe(400);
    }
    expect((await post(f, { devIndex: "dev-1", status: "online", at: start, source: "snapshot" })).status).toBe(200);
    expect(await jobs(f)).toEqual([]);
  });
});
