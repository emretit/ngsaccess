/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, expect, it, vi } from "vitest";
import { getFunctionName, type FunctionReference } from "convex/server";
import schema from "../schema";
import { internal } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { runBackfillAllDevicesEvents, runBackfillContinuation, runBackfillDeviceEvents } from "./gatewayBackfill";
import { searchAcsEventsOnDevice } from "./hikGateway";

vi.mock("./hikGateway", () => ({ searchAcsEventsOnDevice: vi.fn() }));
vi.mock("./gatewayCommand", () => ({ auditDeviceCommand: async (_ctx: unknown, _id: unknown, _label: unknown, run: () => Promise<unknown>) => run() }));
const modules = import.meta.glob("../**/*.ts");
const now = Date.parse("2026-11-03T12:00:00Z");
const completedAt = now - 48 * 3600000;
const event = { serialNo: 10, time: "2026-11-02T12:00:00Z", cardNo: "CARD", major: 5, minor: 75 };
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

async function fixture(age = 0, failCount = 0) {
  vi.useFakeTimers(); vi.setSystemTime(now);
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "Test" });
    const userId = await ctx.db.insert("users", { role: "project_admin" });
    const deviceId = await ctx.db.insert("devices", {
      name: "Cihaz", projectId, brand: "hikvision", hikTransport: "gateway", hikDevIndex: "index",
      hikLastBackfillAt: completedAt, hikLastSeenAt: now, isActive: true,
      createdAt: new Date(now).toISOString(), updatedAt: new Date(now).toISOString(),
      hikBackfillPending: { devIndex: "index", searchID: "stuck", position: 1, startedAt: now - age,
        startTime: new Date(completedAt - 300000).toISOString(), maxPages: 1, lastPageKey: "10", failCount },
    });
    return { deviceId, projectId, userId };
  });
  const runAfter = vi.fn();
  const ctx = {
    runQuery: (ref: FunctionReference<"query", "internal">, args: Record<string, unknown>) => {
      if (getFunctionName(ref) === "users:listProjectIdsForCurrentUser") return [ids.projectId];
      if (getFunctionName(ref) === "roles:checkPermission") return true;
      return t.query(ref, args);
    },
    runMutation: (ref: FunctionReference<"mutation", "internal">, args: Record<string, unknown>) => t.mutation(ref, args),
    scheduler: { runAfter },
    user: { _id: ids.userId } as Doc<"users">,
  } as unknown as ActionCtx & { user: Doc<"users"> };
  return { t, ctx, ...ids, runAfter, device: () => t.run(ctx => ctx.db.get(ids.deviceId)) };
}

it.each(["cursor", "page", "throw"])("Y-01 replaces a stuck %s after three failures and deduplicates replayed events", async mode => {
  const f = await fixture();
  expect(await f.t.mutation(internal.cardReadings.backfillHikEventRow, { deviceId: f.deviceId, event })).toEqual({ inserted: true });
  const old = (await f.device())?.hikBackfillPending;
  if (!old) throw new Error("Missing pending");
  const search = vi.mocked(searchAcsEventsOnDevice).mockReset();
  if (mode === "throw") search.mockRejectedValue(new Error("transport failed"));
  else search.mockResolvedValue({ ok: mode === "cursor", events: mode === "cursor" ? [event] : [], total: 2,
    numMatches: mode === "cursor" ? 1 : 0, nextPosition: 1, hasMore: mode === "cursor", error: "badParameters" });
  for (let failures = 1; failures <= 3; failures++) {
    await runBackfillAllDevicesEvents(f.ctx);
    const device = await f.device();
    expect(device?.hikLastBackfillAt).toBe(completedAt);
    if (failures < 3) expect(device?.hikBackfillPending).toMatchObject({ searchID: "stuck", position: 1, failCount: failures });
    else expect(device?.hikBackfillPending).toMatchObject({ searchID: expect.not.stringMatching(/^stuck$/), position: 0 });
  }
  const fresh = (await f.device())?.hikBackfillPending;
  if (!fresh) throw new Error("Missing restarted search");
  search.mockClear();
  await runBackfillContinuation(f.ctx, { ...old, deviceId: f.deviceId });
  expect(search).not.toHaveBeenCalled();
  search.mockResolvedValue({ ok: true, events: [event, { ...event, serialNo: 11 }], total: 2, numMatches: 2, nextPosition: 2, hasMore: false });
  expect(await runBackfillAllDevicesEvents(f.ctx)).toEqual({ devices: 1, errors: [] });
  expect(search).toHaveBeenCalledExactlyOnceWith("index", expect.objectContaining({ searchID: fresh.searchID, position: 0, startTime: new Date(completedAt - 300000).toISOString() }));
  const rows = await f.t.run(ctx => ctx.db.query("cardReadings").withIndex("by_device_hik_serial", q => q.eq("deviceId", f.deviceId)).take(10));
  expect(rows.map(row => row.hikSerialNo).sort()).toEqual([10, 11]);
  expect((await f.device())?.hikLastBackfillAt).toBe(now);
});

it.each(["cron", "scheduler"])("Y-01 restarts a failing six-hour-old checkpoint from completed time via %s", async source => {
  const f = await fixture(6 * 3600000 + 1, 1);
  const old = (await f.device())?.hikBackfillPending;
  if (!old) throw new Error("Missing pending");
  const search = vi.mocked(searchAcsEventsOnDevice).mockReset().mockResolvedValue({ ok: false, events: [], total: 0, numMatches: 0, nextPosition: 0, hasMore: false, error: "offline" });
  if (source === "cron") await runBackfillAllDevicesEvents(f.ctx);
  else await expect(runBackfillContinuation(f.ctx, { ...old, deviceId: f.deviceId })).rejects.toThrow("offline");
  expect(search).toHaveBeenCalledWith("index", expect.objectContaining({ searchID: expect.not.stringMatching(/^stuck$/), position: 0,
    startTime: new Date(completedAt - 300000).toISOString(), endTime: new Date(now).toISOString() }));
  expect((await f.device())?.hikLastBackfillAt).toBe(completedAt);
});

it.each([{ fromAll: true }, { startTime: "2026-10-01T00:00:00+03:00" }])("Y-01 explicit manual range replaces pending: %j", async range => {
  const f = await fixture();
  const search = vi.mocked(searchAcsEventsOnDevice).mockReset().mockResolvedValue({ ok: false, events: [], total: 0, numMatches: 0, nextPosition: 0, hasMore: false, error: "offline" });
  await runBackfillDeviceEvents(f.ctx, { deviceId: f.deviceId, ...range });
  expect(search).toHaveBeenCalledWith("index", expect.objectContaining({ searchID: expect.not.stringMatching(/^stuck$/), position: 0,
    startTime: "fromAll" in range ? "2000-01-01T00:00:00+03:00" : range.startTime }));
  expect((await f.device())?.hikLastBackfillAt).toBe(completedAt);
});

it("Y-01 resets consecutive failures after a committed page and counts skipped rows", async () => {
  const f = await fixture();
  const search = vi.mocked(searchAcsEventsOnDevice).mockReset().mockResolvedValue({ ok: false, events: [], total: 0, numMatches: 0, nextPosition: 1, hasMore: false, error: "offline" });
  await runBackfillAllDevicesEvents(f.ctx);
  await runBackfillAllDevicesEvents(f.ctx);
  expect((await f.device())?.hikBackfillPending?.failCount).toBe(2);
  search.mockResolvedValueOnce({ ok: true, events: [{ ...event, serialNo: 11 }], skipped: 2, total: 10, numMatches: 3, nextPosition: 4, hasMore: true });
  expect(await runBackfillDeviceEvents(f.ctx, { deviceId: f.deviceId })).toMatchObject({ scanned: 3, inserted: 1, skipped: 2, partial: true });
  expect((await f.device())?.hikBackfillPending).toMatchObject({ searchID: "stuck", position: 4, failCount: 0, lastProgressAt: now });
  expect(f.runAfter).toHaveBeenCalledWith(0, internal.actions.hikQueueWorker.continueHikBackfill,
    expect.objectContaining({ lastProgressAt: now, position: 4, hop: 2 }));
  await runBackfillAllDevicesEvents(f.ctx);
  expect((await f.device())?.hikBackfillPending).toMatchObject({ searchID: "stuck", position: 4, failCount: 1 });
  expect((await f.device())?.hikLastBackfillAt).toBe(completedAt);
});

it.each(["failure", "page"])("Y-01 an in-flight %s cannot overwrite a manual replacement", async outcome => {
  const f = await fixture();
  const pending = (await f.device())?.hikBackfillPending;
  if (!pending) throw new Error("Missing pending");
  vi.mocked(searchAcsEventsOnDevice).mockReset().mockImplementationOnce(async () => {
    expect(await f.t.mutation(internal.devices.setHikBackfillPending, {
      deviceId: f.deviceId, expectedSearchID: pending.searchID, expectedPosition: pending.position, expectedFailCount: 0, restart: true,
      pending: { ...pending, searchID: "manual", position: 0 },
    })).toBe(true);
    return { ok: outcome === "page", events: outcome === "page" ? [{ ...event, serialNo: 11 }] : [],
      numMatches: 1, nextPosition: 2, total: 2, hasMore: false, error: "offline" };
  });
  await runBackfillAllDevicesEvents(f.ctx);
  expect((await f.device())?.hikBackfillPending).toMatchObject({ searchID: "manual", position: 0 });
  expect((await f.device())?.hikLastBackfillAt).toBe(completedAt);
});

it("Y-01 CAS rejects stale restart and failure writes at the same position", async () => {
  const f = await fixture();
  const pending = (await f.device())?.hikBackfillPending;
  if (!pending) throw new Error("Missing pending");
  const expected = { deviceId: f.deviceId, expectedSearchID: pending.searchID, expectedPosition: pending.position, expectedFailCount: 0 };
  expect(await f.t.mutation(internal.devices.setHikBackfillPending, { ...expected, pending: { ...pending, failCount: 1 } })).toBe(true);
  expect(await f.t.mutation(internal.devices.setHikBackfillPending, { ...expected, pending: { ...pending, failCount: 2 } })).toBe(false);
  expect(await f.t.mutation(internal.devices.setHikBackfillPending, { ...expected, restart: true, pending: { ...pending, searchID: "stale", position: 0 } })).toBe(false);
  expect((await f.device())?.hikBackfillPending).toMatchObject({ searchID: "stuck", position: 1, failCount: 1 });
});

it("Y-01 a first-ever scan retains its original range when its search expires", async () => {
  const f = await fixture(6 * 3600000 + 1, 1);
  const pending = (await f.device())?.hikBackfillPending;
  if (!pending) throw new Error("Missing pending");
  await f.t.run(ctx => ctx.db.patch(f.deviceId, { hikLastBackfillAt: undefined,
    hikBackfillPending: { ...pending, startTime: "2000-01-01T00:00:00+03:00" } }));
  const search = vi.mocked(searchAcsEventsOnDevice).mockReset().mockResolvedValue({ ok: false, events: [], total: 0, numMatches: 0, nextPosition: 0, hasMore: false, error: "offline" });
  await runBackfillAllDevicesEvents(f.ctx);
  expect(search).toHaveBeenCalledWith("index", expect.objectContaining({ searchID: expect.not.stringMatching(/^stuck$/), position: 0, startTime: "2000-01-01T00:00:00+03:00" }));
  expect((await f.device())?.hikLastBackfillAt).toBeUndefined();
});


it.each(["cron", "scheduler"])("N-01 resumes a healthy day-old checkpoint via %s", async source => {
  const f = await fixture(24 * 3600000);
  const pending = (await f.device())?.hikBackfillPending;
  if (!pending) throw new Error("Missing pending");
  const search = vi.mocked(searchAcsEventsOnDevice).mockReset().mockResolvedValue({
    ok: true, events: [{ ...event, serialNo: 11 }], total: 2, numMatches: 1, nextPosition: 2, hasMore: false,
  });
  if (source === "cron") await runBackfillAllDevicesEvents(f.ctx);
  else await runBackfillContinuation(f.ctx, { ...pending, deviceId: f.deviceId });
  expect(search).toHaveBeenCalledExactlyOnceWith("index", expect.objectContaining({
    searchID: "stuck", position: 1, startTime: pending.startTime, endTime: new Date(pending.startedAt).toISOString(),
  }));
  expect((await f.device())?.hikLastBackfillAt).toBe(pending.startedAt);
  expect((await f.device())?.hikBackfillPending).toBeUndefined();
});

it("N-01 completes 15030 events across daily cron chains and deduplicates overlap", async () => {
  const f = await fixture();
  await f.t.run(ctx => ctx.db.patch(f.deviceId, { hikBackfillPending: undefined }));
  // Seed a live-delivered event inside the historical window: the real mutation must deduplicate it.
  await f.t.mutation(internal.cardReadings.backfillHikEventRow, { deviceId: f.deviceId, event });
  const total = 15030;
  // Keep the pagination stress test fast: exercise the real event mutation for
  // the live overlap and the tail, and record the other rows in memory. The
  // three recovery cases above also verify real database replay deduplication.
  const imported = new Set([event.serialNo]);
  let duplicates = 0;
  const runMutation = f.ctx.runMutation;
  vi.spyOn(f.ctx, "runMutation").mockImplementation(async (ref, args?: unknown) => {
    const input: unknown = args;
    if (getFunctionName(ref) !== "cardReadings:backfillHikEventRow") return runMutation(ref, args);
    if (typeof input !== "object" || input === null || !("event" in input) ||
        typeof input.event !== "object" || input.event === null || !("serialNo" in input.event) ||
        typeof input.event.serialNo !== "number") throw new Error("Missing event serial");
    const serialNo = input.event.serialNo;
    const inserted = !imported.has(serialNo);
    if (!inserted) duplicates++;
    imported.add(serialNo);
    if (serialNo === event.serialNo || serialNo === total) {
      const result: unknown = await runMutation(ref, args);
      expect(result).toMatchObject({ inserted });
      return result;
    }
    return { inserted };
  });
  const search = vi.mocked(searchAcsEventsOnDevice).mockReset().mockImplementation(async (_devIndex, opts) => {
    const position = opts.position ?? 0;
    const nextPosition = Math.min(position + 30, total);
    return { ok: true, total, nextPosition, hasMore: nextPosition < total, numMatches: nextPosition - position,
      events: Array.from({ length: nextPosition - position }, (_, i) => ({ ...event, serialNo: position + i + 1 })),
    };
  });
  await runBackfillAllDevicesEvents(f.ctx);
  // Drain the same bounded scheduler chain the production cron starts (10 x 50 x 30).
  for (let i = 0; i < f.runAfter.mock.calls.length; i++) {
    const args: unknown = f.runAfter.mock.calls[i]?.[2];
    if (typeof args !== "object" || args === null || !("hop" in args) || typeof args.hop !== "number") throw new Error("Missing scheduled hop");
    const pending = (await f.device())?.hikBackfillPending;
    if (!pending) throw new Error("Missing pending");
    await runBackfillContinuation(f.ctx, { ...pending, deviceId: f.deviceId, hop: args.hop });
  }
  const pending = (await f.device())?.hikBackfillPending;
  if (!pending) throw new Error("Missing day-one checkpoint");
  expect(pending).toMatchObject({ position: 15000, startedAt: now, lastProgressAt: now, failCount: 0 });
  expect((await f.device())?.hikLastBackfillAt).toBe(completedAt);
  expect(f.runAfter).toHaveBeenCalledTimes(9);
  vi.setSystemTime(now + 24 * 3600000);
  await f.t.run(ctx => ctx.db.patch(f.deviceId, { hikLastSeenAt: Date.now() }));
  expect(await runBackfillAllDevicesEvents(f.ctx)).toEqual({ devices: 1, errors: [] });
  expect(search).toHaveBeenLastCalledWith("index", expect.objectContaining({
    searchID: pending.searchID, position: 15000, startTime: pending.startTime, endTime: new Date(now).toISOString(),
  }));
  expect((await f.device())?.hikLastBackfillAt).toBe(now);
  expect((await f.device())?.hikBackfillPending).toBeUndefined();
  expect(imported.size).toBe(total);
  expect(duplicates).toBe(1);
  expect(search).toHaveBeenCalledTimes(501);
  const rows = await f.t.run(ctx => ctx.db.query("cardReadings")
    .withIndex("by_device_hik_serial", q => q.eq("deviceId", f.deviceId)).take(10));
  expect(rows.map(row => row.hikSerialNo)).toEqual([event.serialNo, total]);
});


it.each([1, 6])("N-01 measures failing checkpoint age from the last committed page (%s hours)", async hours => {
  const f = await fixture(48 * 3600000, 1);
  const pending = (await f.device())?.hikBackfillPending;
  if (!pending) throw new Error("Missing pending");
  const lastProgressAt = now - hours * 3600000;
  await f.t.run(ctx => ctx.db.patch(f.deviceId, { hikBackfillPending: { ...pending, lastProgressAt } }));
  const search = vi.mocked(searchAcsEventsOnDevice).mockReset().mockResolvedValue({
    ok: true, events: [{ ...event, serialNo: 11 }], total: 3, numMatches: 1, nextPosition: 2, hasMore: true,
  });
  await runBackfillAllDevicesEvents(f.ctx);
  expect(search).toHaveBeenCalledExactlyOnceWith("index", expect.objectContaining(hours === 1
    ? { searchID: "stuck", position: 1 }
    : { searchID: expect.not.stringMatching(/^stuck$/), position: 0 }));
  expect((await f.device())?.hikBackfillPending).toMatchObject({ lastProgressAt: now, failCount: 0 });
  expect((await f.device())?.hikLastBackfillAt).toBe(completedAt);
});

it("N-01 a failed page preserves the last successful page time", async () => {
  const f = await fixture(48 * 3600000);
  const pending = (await f.device())?.hikBackfillPending;
  if (!pending) throw new Error("Missing pending");
  const lastProgressAt = now - 3600000;
  await f.t.run(ctx => ctx.db.patch(f.deviceId, { hikBackfillPending: { ...pending, lastProgressAt } }));
  vi.mocked(searchAcsEventsOnDevice).mockReset().mockResolvedValue({
    ok: false, events: [], total: 0, numMatches: 0, nextPosition: 1, hasMore: false, error: "offline",
  });
  await runBackfillAllDevicesEvents(f.ctx);
  expect((await f.device())?.hikBackfillPending).toMatchObject({ searchID: "stuck", position: 1, failCount: 1, lastProgressAt });
  expect((await f.device())?.hikLastBackfillAt).toBe(completedAt);
});
