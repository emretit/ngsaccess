// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import type { FunctionArgs } from "convex/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const now = "2026-10-26T12:00:00.000Z";
type Args = FunctionArgs<typeof internal.cardReadings.processCardReading>;

async function fixture(brand: "hikvision" | "ide_smart" = "hikvision") {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(now));
  vi.spyOn(console, "log").mockImplementation(() => {});
  const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.stubEnv("IDE_BRIDGE_SECRET", "bridge-secret");
  vi.stubEnv("CARD_READER_ALLOW_UNAUTHENTICATED", "");
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "Local" });
    const otherProjectId = await ctx.db.insert("projects", { name: "Other" });
    const employeeId = await ctx.db.insert("employees", { projectId, firstName: "Ada", lastName: "Test", cardNumber: "CARD", email: "ada@example.test", isActive: true });
    const deviceId = await ctx.db.insert("devices", {
      projectId, brand, name: "Panel", deviceSerial: "SERIAL", apiToken: "device-token",
      hikDevIndex: "dev-1", ideUuid: "9001", accessDirection: "both", isActive: true,
      createdAt: now, updatedAt: now,
    });
    const otherId = await ctx.db.insert("devices", {
      projectId: otherProjectId, brand, name: "Other panel", deviceSerial: "OTHER", apiToken: "other-token",
      hikDevIndex: "dev-2", ideUuid: "9002", accessDirection: "both", isActive: true,
      createdAt: now, updatedAt: now,
    });
    return { deviceId, otherId, employeeId, projectId };
  });
  const run = (overrides: Partial<Args> = {}) => t.mutation(internal.cardReadings.processCardReading, {
    cardNo: "CARD", deviceSerial: "SERIAL", hikMajorEventType: 5, hikSubEventType: 1,
    hikSerialNo: 10, hikDateTime: "2026-10-26T13:00:00+03:00",
    ideIoId: 2, ideResult: 1, ideTime: "2026-10-26 13:00:00", ...overrides,
  });
  const rows = () => t.run(ctx => ctx.db.query("cardReadings").collect());
  const sideEffects = () => t.run(async ctx => ({
    device: await ctx.db.get(ids.deviceId),
    events: await ctx.db.query("deviceEvents").collect(),
    audit: await ctx.db.query("auditLog").collect(),
    jobs: await ctx.db.system.query("_scheduled_functions").collect(),
  }));
  return { t, ...ids, run, rows, sideEffects, warning };
}

afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("C-05 live event idempotency", () => {
  it.each([true, false])("Hik retries preserve the first granted=%s result, row, direction and side effects", async granted => {
    const f = await fixture();
    expect(await f.run({ hikSubEventType: granted ? 1 : 9 })).toEqual({ granted });
    const before = await f.rows();
    const effects = await f.sideEffects();
    expect(before).toHaveLength(1);
    expect(before[0]?.direction).toBe("entry");
    expect(await f.run({ hikSubEventType: granted ? 1 : 9 })).toEqual({ granted });
    expect(await f.rows()).toEqual(before);
    expect(await f.sideEffects()).toEqual(effects);
    await f.run({ hikSerialNo: 11 });
    expect((await f.rows()).map(row => row.direction)).toEqual(["entry", granted ? "exit" : "entry"]);
    const afterNew = await f.sideEffects();
    await f.run();
    expect(await f.sideEffects()).toEqual(afterNew); // Old replay must not regress last serial to 10.
    expect((await f.rows())).toHaveLength(2);
  });

  it("Hik dedup shares the history key and is scoped to device (serial zero is valid)", async () => {
    const f = await fixture();
    await f.t.run(ctx => ctx.db.insert("cardReadings", {
      deviceId: f.deviceId, projectId: f.projectId, cardNo: "CARD", hikSerialNo: 0,
      accessTime: now, accessStatus: "reddedildi", createdAt: now, updatedAt: now,
    }));
    expect(await f.run({ hikSerialNo: 0, hikDateTime: undefined })).toEqual({ granted: false });
    expect((await f.sideEffects()).device?.hikLastSerialNo).toBeUndefined();
    await f.run({ authedDeviceId: f.otherId, hikSerialNo: 0 });
    expect(await f.rows()).toHaveLength(2);
  });

  it("Hik events without a serial retain the previous insert behavior", async () => {
    const f = await fixture();
    await f.run({ hikSerialNo: undefined });
    await f.run({ hikSerialNo: undefined });
    expect((await f.rows()).map(row => row.direction)).toEqual(["entry", "exit"]);
  });

  it.each(["card", "time"] as const)("Hik serial reuse with a different %s persists the new decision and deduplicates its retry", async kind => {
    const f = await fixture();
    await f.run({ hikSubEventType: 9 });
    // A new event may reuse the serial after reset; its panel decision must win.
    await f.t.run(ctx => ctx.db.patch(f.deviceId, { hikLastSerialNo: 99 }));
    f.warning.mockClear();
    const input = kind === "card" ? { cardNo: "NEW-CARD" } : { hikDateTime: "2026-10-26T12:00:00Z" };
    expect(await f.run(input)).toEqual({ granted: true });
    expect(await f.rows()).toHaveLength(2);
    expect((await f.rows())[1]).toMatchObject({ accessStatus: "izin_verildi", ...(kind === "time" ? { direction: "entry" } : {}) });
    expect((await f.sideEffects()).device?.hikLastSerialNo).toBe(10);
    expect(f.warning.mock.calls.some(([message]) => typeof message === "string" && message.startsWith("[hik-serial-reset] device=Panel serial=10"))).toBe(true);
    const effects = await f.sideEffects();
    f.warning.mockClear();
    expect(await f.run(input)).toEqual({ granted: true });
    expect(await f.rows()).toHaveLength(2);
    expect(await f.sideEffects()).toEqual(effects);
    expect(f.warning).not.toHaveBeenCalled();
  });

  it.each([5, 10, 11])("Hik without device time deduplicates receive times within ten minutes (%s)", async minutes => {
    const f = await fixture();
    await f.run({ hikDateTime: undefined });
    vi.setSystemTime(new Date(Date.parse(now) + minutes * 60 * 1000));
    await f.run({ hikDateTime: undefined });
    expect(await f.rows()).toHaveLength(minutes <= 10 ? 1 : 2);
    expect(f.warning).toHaveBeenCalledTimes(minutes <= 10 ? 0 : 1);
  });

  it("Hik canonical device time deduplicates a retry even outside the access time window", async () => {
    const f = await fixture();
    await f.run();
    vi.setSystemTime(new Date(Date.parse(now) + 8 * 24 * 60 * 60 * 1000));
    f.warning.mockClear();
    await f.run({ hikDateTime: "2026-10-26T10:00:00Z" });
    expect(await f.rows()).toHaveLength(1);
    expect(f.warning).not.toHaveBeenCalled();
  });

  it.each([true, false])("IDE retries preserve original granted=%s and do not toggle direction", async granted => {
    const f = await fixture("ide_smart");
    expect(await f.run({ ideResult: granted ? 1 : 0 })).toEqual({ granted });
    const before = await f.rows();
    const effects = await f.sideEffects();
    expect(await f.run({ ideResult: granted ? 1 : 0 })).toEqual({ granted });
    expect(await f.rows()).toEqual(before);
    expect(await f.sideEffects()).toEqual(effects);
    expect(await f.run({ ideResult: granted ? 0 : 1 })).toEqual({ granted });
    expect(await f.rows()).toEqual(before);
    expect(await f.sideEffects()).toEqual(effects);
    await f.run({ ideTime: "2026-10-26 13:00:01" });
    expect((await f.rows()).map(row => row.direction)).toEqual(["entry", granted ? "exit" : "entry"]);
  });

  it("IDE preserves different cards in one second, distinct io and distinct devices", async () => {
    const f = await fixture("ide_smart");
    await f.run();
    await f.run({ cardNo: "OTHER-CARD" });
    await f.run({ ideIoId: 3 });
    await f.run({ authedDeviceId: f.otherId });
    await f.run({ cardNo: "OTHER-CARD" });
    expect(await f.rows()).toHaveLength(4);
  });

  it.each([undefined, "invalid"])("IDE without a resolved panel time (%s) keeps both deliveries", async ideTime => {
    const f = await fixture("ide_smart");
    await f.run({ ideTime });
    await f.run({ ideTime });
    expect((await f.rows()).map(row => row.direction)).toEqual(["entry", "exit"]);
    expect(f.warning.mock.calls).toEqual(Array.from({ length: 2 }, () => [
      `[ide-event-no-time] device=Panel io=2 ideTime=${ideTime}`,
    ]));
  });

  it("IDE deduplicates a resolved timestamp even when io is absent", async () => {
    const f = await fixture("ide_smart");
    await f.run({ ideIoId: undefined });
    await f.run({ ideIoId: undefined });
    expect(await f.rows()).toHaveLength(1);
  });
});

describe("Hik device access time", () => {
  it.each([-11, -10, 10, 11])("clock skew warning requires more than ten minutes (%s)", async minutes => {
    const f = await fixture();
    const hikDateTime = new Date(Date.parse(now) + minutes * 60 * 1000).toISOString();
    await f.run({ hikDateTime });
    expect(f.warning.mock.calls).toEqual(Math.abs(minutes) > 10 ? [[
      `[hik-clock-skew] device=Panel deviceTime=${hikDateTime} receivedTime=${now}`,
    ]] : []);
  });

  it.each([
    ["2026-10-26T13:00:00+03:00", "2026-10-26T10:00:00.000Z"],
    ["2026-10-26 13:00:00", "2026-10-26T10:00:00.000Z"],
    ["2026-10-26T12:05:00Z", "2026-10-26T12:05:00.000Z"],
    ["2026-10-19T12:00:00Z", "2026-10-19T12:00:00.000Z"],
    ["2026-10-26T12:10:00Z", now],
    ["2026-10-19T11:59:59Z", now],
    ["2026-02-30T10:00:00Z", now],
    ["invalid", now],
    [undefined, now],
  ])("%s is stored as %s while raw metadata and receive time remain intact", async (hikDateTime, expected) => {
    const f = await fixture();
    await f.run({ hikDateTime });
    expect((await f.rows())[0]).toMatchObject({ accessTime: expected, createdAt: now, updatedAt: now });
    expect((await f.rows())[0]?.hikDateTime).toBe(hikDateTime);
  });

  it("direction uses event time when an older live event arrives after a newer entry", async () => {
    const f = await fixture();
    await f.run({ hikDateTime: "2026-10-26T11:00:00Z" });
    await f.run({ hikSerialNo: 11, hikDateTime: "2026-10-26T10:00:00Z" });
    expect((await f.rows()).map(row => row.direction)).toEqual(["entry", "entry"]);
  });
});

describe("HTTP event transport", () => {
  it("card-reader carries Hik device time and serial through repeated authenticated HTTP requests", async () => {
    const f = await fixture();
    const body = JSON.stringify({ EventNotificationAlert: {
      devIndex: "dev-1", dateTime: "2026-10-26T13:00:00+03:00", eventType: "AccessControllerEvent",
      AccessControllerEvent: { cardNo: "CARD", serialNumber: "SERIAL", majorEventType: 5, subEventType: 1, serialNo: 88 },
    } });
    for (let i = 0; i < 2; i++) {
      const response = await f.t.fetch("/card-reader", { method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer device-token" }, body });
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ checkResult: "success" });
    }
    expect(await f.rows()).toHaveLength(1);
    expect((await f.rows())[0]).toMatchObject({ accessTime: "2026-10-26T10:00:00.000Z", hikSerialNo: 88, direction: "entry" });
    expect((await f.t.fetch("/card-reader", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer wrong" }, body })).status).toBe(401);
    expect((await f.t.fetch("/card-reader", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer other-token" }, body })).status).toBe(403);
    expect(await f.rows()).toHaveLength(1);
  });

  it("IDE bridge transports the panel event key and rejects unauthenticated delivery", async () => {
    const f = await fixture("ide_smart");
    const body = JSON.stringify({ topic: "event/access/online", body: JSON.stringify({
      transaction: { "src-id": 9001 }, payload: { card: "CARD", actuator: 2, result: 1, time: "2026-10-26 13:00:00" },
    }) });
    for (let i = 0; i < 2; i++) {
      const response = await f.t.fetch("/ide-bridge/event", { method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer bridge-secret" }, body });
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ granted: true });
    }
    expect(await f.rows()).toHaveLength(1);
    expect((await f.rows())[0]).toMatchObject({ ideIoId: 2, accessTime: "2026-10-26T10:00:00.000Z" });
    expect((await f.t.fetch("/ide-bridge/event", { method: "POST", headers: { "Content-Type": "application/json" }, body })).status).toBe(401);
    expect(await f.rows()).toHaveLength(1);
  });
});
