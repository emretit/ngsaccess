/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, expect, it, vi } from "vitest";
import { getFunctionName, type FunctionReference } from "convex/server";
import schema from "../schema";
import { internal } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";
import { runBackfillAllDevicesEvents, runBackfillContinuation } from "./gatewayBackfill";
import { searchAcsEventsOnDevice } from "./hikGateway";

vi.mock("./hikGateway", () => ({ searchAcsEventsOnDevice: vi.fn() }));
const modules = import.meta.glob("../**/*.ts");
const now = Date.parse("2026-11-03T12:00:00Z");
const completedAt = now - 48 * 3600000;
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

async function fixture() {
  vi.useFakeTimers(); vi.setSystemTime(now);
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const t = convexTest(schema, modules);
  const deviceId = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "Test" });
    return ctx.db.insert("devices", {
      name: "Cihaz", projectId, brand: "hikvision", hikTransport: "gateway", hikDevIndex: "index",
      hikLastBackfillAt: completedAt, hikLastSeenAt: now, isActive: true,
      createdAt: new Date(now).toISOString(), updatedAt: new Date(now).toISOString(),
    });
  });
  const imported: number[] = [];
  const runAfter = vi.fn();
  const ctx = {
    runQuery: (ref: FunctionReference<"query", "internal">, args: Record<string, unknown>) => t.query(ref, args),
    runMutation: async (ref: FunctionReference<"mutation", "internal">, args: Record<string, unknown>) => {
      if (getFunctionName(ref) === "cardReadings:backfillHikEventRow") {
        imported.push((args.event as { serialNo: number }).serialNo);
        return { inserted: true };
      }
      return t.mutation(ref, args);
    },
    scheduler: { runAfter },
  } as unknown as ActionCtx;
  const device = () => t.run(ctx => ctx.db.get(deviceId));
  const start = {
    deviceId, devIndex: "index", searchID: "grouped", position: 0, startedAt: now,
    startTime: new Date(completedAt - 300000).toISOString(), maxPages: 1,
  };
  return { t, ctx, deviceId, device, start, imported, runAfter };
}

it.each(["chain limit", "continuation error", "scheduler error"])(
  "CIH-04 preserves the completed window through %s and resumes the older group", async mode => {
    const f = await fixture();
    const search = vi.mocked(searchAcsEventsOnDevice).mockReset();
    search.mockResolvedValueOnce({
      ok: true, events: [{ serialNo: 900, time: "2026-11-03T11:00:00Z", cardNo: "C", major: 5, minor: 75 }],
      total: 2, numMatches: 1, nextPosition: 1, hasMore: true,
    });
    if (mode === "scheduler error") f.runAfter.mockRejectedValueOnce(new Error("scheduler unavailable"));
    const run = runBackfillContinuation(f.ctx, { ...f.start, hop: mode === "chain limit" ? 10 : 1 });
    if (mode === "scheduler error") await expect(run).rejects.toThrow("scheduler unavailable");
    else await run;
    const afterFirstPage = await f.device();
    expect(afterFirstPage?.hikLastBackfillAt).toBe(completedAt);
    expect(afterFirstPage?.hikBackfillPending).toMatchObject({ searchID: "grouped", position: 1, startedAt: now, startTime: f.start.startTime });
    const pending = afterFirstPage?.hikBackfillPending;
    if (!pending) throw new Error("Missing durable continuation");
    if (mode === "continuation error") {
      search.mockResolvedValueOnce({ ok: false, events: [], total: 0, numMatches: 0, nextPosition: 1, hasMore: false, error: "badParameters" });
      await expect(runBackfillContinuation(f.ctx, { ...pending, deviceId: f.deviceId })).rejects.toThrow("badParameters");
      // Y-01 counts a failed attempt while preserving its search/window/position.
      expect((await f.device())?.hikBackfillPending).toEqual({ ...pending, failCount: 1 });
      expect((await f.device())?.hikLastBackfillAt).toBe(completedAt);
    }
    // This older group would have fallen outside a window advanced to the first group's timestamp.
    search.mockResolvedValueOnce({
      ok: true, events: [{ serialNo: 3, time: "2026-11-01T13:00:00Z", cardNo: "C", major: 5, minor: 75 }],
      total: 2, numMatches: 1, nextPosition: 2, hasMore: false,
    });
    expect(await runBackfillAllDevicesEvents(f.ctx)).toEqual({ devices: 1, errors: [] });
    expect(search).toHaveBeenLastCalledWith("index", {
      searchID: "grouped", position: 1, maxResults: 30, startTime: f.start.startTime, endTime: new Date(now).toISOString(),
    });
    expect(f.imported).toEqual([900, 3]);
    expect((await f.device())?.hikLastBackfillAt).toBe(now);
    expect((await f.device())?.hikBackfillPending).toBeUndefined();
    // Delayed old scheduler work cannot recreate or overwrite a completed window.
    search.mockClear();
    await runBackfillContinuation(f.ctx, { ...pending, deviceId: f.deviceId });
    expect(search).not.toHaveBeenCalled();
  },
);

it("keeps the durable position on an HTTP/ISAPI failure before the first page", async () => {
  const f = await fixture();
  vi.mocked(searchAcsEventsOnDevice).mockReset().mockResolvedValue({ ok: false, events: [], total: 0, numMatches: 0, nextPosition: 0, hasMore: false, error: "ISAPI" });
  expect(await runBackfillAllDevicesEvents(f.ctx)).toMatchObject({ errors: [expect.stringContaining("ISAPI")] });
  expect((await f.device())?.hikLastBackfillAt).toBe(completedAt);
  expect((await f.device())?.hikBackfillPending).toMatchObject({ position: 0, startedAt: now });
  expect(f.runAfter).not.toHaveBeenCalled();
});

it("CAS rejects competing initial scans, stale page updates and stale completion", async () => {
  const f = await fixture();
  const { deviceId, ...pending } = f.start;
  expect(await f.t.mutation(internal.devices.setHikBackfillPending, { deviceId, pending })).toBe(true);
  expect(await f.t.mutation(internal.devices.setHikBackfillPending, { deviceId, pending: { ...pending, searchID: "other" } })).toBe(false);
  expect(await f.t.mutation(internal.devices.setHikBackfillPending, { deviceId, pending: { ...pending, position: 30 }, expectedSearchID: pending.searchID, expectedPosition: 0 })).toBe(true);
  expect(await f.t.mutation(internal.devices.setHikBackfillPending, { deviceId, pending: { ...pending, position: 1 }, expectedSearchID: pending.searchID, expectedPosition: 0 })).toBe(false);
  expect(await f.t.mutation(internal.devices.setHikBackfillProgress, { deviceId, at: now, searchID: pending.searchID, position: 0 })).toBe(false);
  expect((await f.device())?.hikLastBackfillAt).toBe(completedAt);
  expect((await f.device())?.hikBackfillPending?.position).toBe(30);
  await f.t.run(ctx => ctx.db.patch(deviceId, { hikDevIndex: "changed" }));
  expect(await f.t.mutation(internal.devices.setHikBackfillProgress, { deviceId, at: now, searchID: pending.searchID, position: 30 })).toBe(false);
});
