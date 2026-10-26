import { afterEach, expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";
import type { ActionCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { runBackfillDeviceFromGroups, runBackfillAllDevicesEvents, runBackfillContinuation, runBackfillDeviceEvents } from "./gatewayBackfill";
import { searchAcsEventsOnDevice } from "./hikGateway";
import { auditDeviceCommand } from "./gatewayCommand";
import type { Doc } from "../_generated/dataModel";

vi.mock("./hikGateway", () => ({ searchAcsEventsOnDevice: vi.fn() }));
vi.mock("./gatewayCommand", () => ({ auditDeviceCommand: vi.fn() }));
it("schedules cleanup only after registration backfill plans and people finish", async () => {
  const runQuery = vi.fn(async () => ({ employeeIds: ["employee"], accessRuleIds: ["rule"] }));
  const order: string[] = [];
  const runAction = vi.fn(async (ref: Parameters<typeof getFunctionName>[0]) => { order.push(getFunctionName(ref)); });
  const runAfter = vi.fn(async (_delay: number, ref: Parameters<typeof getFunctionName>[0], args: object) => { order.push(getFunctionName(ref)); expect(args).toEqual({ deviceId: "device", dryRun: false, reason: "register" }); });
  const ctx = { runQuery, runAction, scheduler: { runAfter } } as unknown as ActionCtx;
  expect(await runBackfillDeviceFromGroups(ctx, { deviceId: "device" as Id<"devices"> })).toEqual({ employees: 1, rules: 1 });
  expect(order).toEqual(["actions/hikvisionSync:syncWeekPlanToDevicesInternal", "actions/hikvisionSync:syncEmployeeToDevicesInternal", "actions/hikRosterReconcile:reconcileHikDeviceRoster"]);
});
it("still schedules the safety check when the new registration has no groups", async () => {
  const runAfter = vi.fn();
  const ctx = { runQuery: async () => ({ employeeIds: [], accessRuleIds: [] }), runAction: vi.fn(), scheduler: { runAfter } } as unknown as ActionCtx;
  await runBackfillDeviceFromGroups(ctx, { deviceId: "device" as Id<"devices"> });
  expect(runAfter).toHaveBeenCalledTimes(1);
});


afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

function historyContext() {
  const deviceId = "device" as Id<"devices">;
  const device = { _id: deviceId, brand: "hikvision", hikTransport: "gateway", hikDevIndex: "index", projectId: "project", hikLastBackfillAt: Date.now() - 3600000 };
  const runQuery = vi.fn(async (ref: Parameters<typeof getFunctionName>[0]): Promise<unknown> => getFunctionName(ref).endsWith(":getByIdInternal") ? device : [device]);
  const runMutation = vi.fn(async (_ref: Parameters<typeof getFunctionName>[0], _args: object) => ({ inserted: true }));
  const runAfter = vi.fn();
  const ctx = { runQuery, runMutation, scheduler: { runAfter } } as unknown as ActionCtx;
  return { ctx, device, deviceId, runQuery, runMutation, runAfter };
}

it("C-07 caps each run at 1500 events, records the event time and resumes the same search", async () => {
  vi.useFakeTimers();
  const startedAt = Date.parse("2026-10-26T12:00:00Z");
  vi.setSystemTime(startedAt);
  const f = historyContext();
  const eventTime = "2026-10-26T11:30:00Z";
  const search = vi.mocked(searchAcsEventsOnDevice).mockReset();
  search.mockImplementation(async (_index, args) => ({
    ok: true, total: 1501, numMatches: 30, nextPosition: args.position + 30, hasMore: true,
    events: Array.from({ length: 30 }, (_, i) => ({ time: eventTime, serialNo: args.position + i + 1, cardNo: "CARD", major: 5, minor: 75 })),
  }));
  const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
  const result = await runBackfillAllDevicesEvents(f.ctx);
  expect(result).toMatchObject({ devices: 1, errors: [expect.stringContaining("kısmen")] });
  expect(search).toHaveBeenCalledTimes(50);
  expect(getFunctionName(f.runMutation.mock.calls[f.runMutation.mock.calls.length - 1]?.[0] as Parameters<typeof getFunctionName>[0])).toBe("devices:setHikBackfillProgress");
  expect(f.runMutation.mock.calls[f.runMutation.mock.calls.length - 1]?.[1]).toEqual({ deviceId: f.deviceId, cursor: 1500, at: Date.parse(eventTime) });
  expect(warning).toHaveBeenCalledTimes(1);
  const scheduled = f.runAfter.mock.calls[0];
  expect(getFunctionName(scheduled[1])).toBe("actions/hikQueueWorker:continueHikBackfill");
  expect(scheduled[2]).toMatchObject({ deviceId: f.deviceId, position: 1500, startedAt, lastEventAt: Date.parse(eventTime), maxPages: 50 });
  const continuation = scheduled[2] as Parameters<typeof runBackfillContinuation>[1];
  search.mockReset().mockResolvedValue({ ok: true, total: 1501, numMatches: 1, nextPosition: 1501, hasMore: false,
    events: [{ time: eventTime, serialNo: 1501, cardNo: "LAST", major: 5, minor: 75 }],
  });
  vi.setSystemTime(startedAt + 10000);
  await runBackfillContinuation(f.ctx, continuation);
  expect(search).toHaveBeenCalledExactlyOnceWith("index", {
    searchID: continuation.searchID, position: 1500, maxResults: 30,
    startTime: continuation.startTime, endTime: new Date(startedAt).toISOString(),
  });
  expect(getFunctionName(f.runMutation.mock.calls[f.runMutation.mock.calls.length - 1]?.[0] as Parameters<typeof getFunctionName>[0])).toBe("devices:setHikBackfillProgress");
  expect(f.runMutation.mock.calls[f.runMutation.mock.calls.length - 1]?.[1]).toEqual({ deviceId: f.deviceId, cursor: 1501, at: startedAt });
  expect(f.runAfter).toHaveBeenCalledTimes(1);
});

it.each([1, 50])("completes an exhausted search at %i pages without scheduling more work", async pages => {
  const f = historyContext();
  vi.mocked(searchAcsEventsOnDevice).mockReset().mockImplementation(async (_index, args) => ({
    ok: true, events: [], total: pages, numMatches: 1, nextPosition: args.position + 1, hasMore: args.position + 1 < pages,
  }));
  expect(await runBackfillAllDevicesEvents(f.ctx)).toEqual({ devices: 1, errors: [] });
  expect(searchAcsEventsOnDevice).toHaveBeenCalledTimes(pages);
  expect(f.runAfter).not.toHaveBeenCalled();
  expect(f.runMutation).toHaveBeenCalledTimes(1);
});

it("does not advance progress or schedule a continuation when the device search fails", async () => {
  const f = historyContext();
  vi.mocked(searchAcsEventsOnDevice).mockReset().mockResolvedValue({ ok: false, events: [], total: 0, numMatches: 0, nextPosition: 0, hasMore: false, error: "Bağlantı yok" });
  expect(await runBackfillAllDevicesEvents(f.ctx)).toMatchObject({ errors: ["device: Bağlantı yok"] });
  expect(f.runMutation).not.toHaveBeenCalled();
  expect(f.runAfter).not.toHaveBeenCalled();
});

it("rejects a continuation if the device has been moved to another gateway index", async () => {
  const f = historyContext();
  vi.mocked(searchAcsEventsOnDevice).mockClear();
  await expect(runBackfillContinuation(f.ctx, { deviceId: f.deviceId, devIndex: "old-index", searchID: "search", position: 1500, startedAt: Date.now(), maxPages: 50 })).rejects.toThrow("bağlantısı değişti");
  expect(searchAcsEventsOnDevice).not.toHaveBeenCalled();
});

it.each(["project", "role"] as const)("rejects manual backfill without %s permission before reading events", async denied => {
  const f = historyContext();
  f.runQuery.mockImplementation(async (ref: Parameters<typeof getFunctionName>[0]) => {
    const name = getFunctionName(ref);
    if (name.endsWith(":getByIdInternal")) return f.device;
    if (name.endsWith(":listProjectIdsForCurrentUser")) return denied === "project" ? [] : ["project"];
    return false;
  });
  vi.mocked(searchAcsEventsOnDevice).mockClear();
  vi.mocked(auditDeviceCommand).mockClear();
  const ctx = { ...f.ctx, user: { _id: "user" } as Doc<"users"> };
  if (denied === "project") expect(await runBackfillDeviceEvents(ctx, { deviceId: f.deviceId })).toMatchObject({ ok: false, error: expect.stringContaining("yetkiniz yok") });
  else await expect(runBackfillDeviceEvents(ctx, { deviceId: f.deviceId })).rejects.toThrow("yetkiniz yok");
  expect(searchAcsEventsOnDevice).not.toHaveBeenCalled();
  expect(auditDeviceCommand).not.toHaveBeenCalled();
});

it("returns a visible partial result for authorized manual backfill, including duplicate events", async () => {
  const f = historyContext();
  f.runQuery.mockImplementation(async ref => {
    const name = getFunctionName(ref);
    if (name.endsWith(":getByIdInternal")) return f.device;
    if (name.endsWith(":listProjectIdsForCurrentUser")) return ["project"];
    return true;
  });
  f.runMutation.mockResolvedValue({ inserted: false });
  vi.mocked(auditDeviceCommand).mockImplementation(async (_ctx, _deviceId, _label, run) => await run());
  const eventAt = Date.now() - 600000;
  vi.mocked(searchAcsEventsOnDevice).mockReset().mockResolvedValue({
    ok: true, events: [{ time: new Date(eventAt).toISOString(), serialNo: 42, cardNo: "DUP", major: 5, minor: 75 }],
    total: 2, numMatches: 1, nextPosition: 1, hasMore: true,
  });
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const result = await runBackfillDeviceEvents({ ...f.ctx, user: { _id: "user" } as Doc<"users"> }, { deviceId: f.deviceId, maxPages: 1 });
  expect(result).toMatchObject({ ok: false, partial: true, scanned: 1, skipped: 1, error: expect.stringContaining("devam işi planlandı") });
  expect(f.runMutation.mock.calls[f.runMutation.mock.calls.length - 1]?.[1]).toMatchObject({ at: eventAt });
  expect(f.runAfter).toHaveBeenCalledTimes(1);
});

it("stops the whole continuation chain after ten runs", async () => {
  const f = historyContext();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.mocked(searchAcsEventsOnDevice).mockReset().mockImplementation(async (_index, args) => ({
    ok: true, events: [{ time: new Date().toISOString(), serialNo: args.position + 1, cardNo: "CARD", major: 5, minor: 75 }],
    total: 100, numMatches: 1, nextPosition: args.position + 1, hasMore: true,
  }));
  let continuation: Parameters<typeof runBackfillContinuation>[1] = {
    deviceId: f.deviceId, devIndex: "index", searchID: "bounded", position: 0, startedAt: Date.now(), maxPages: 1, hop: 1,
  };
  for (let run = 1; run <= 10; run++) {
    f.runAfter.mockClear();
    await runBackfillContinuation(f.ctx, continuation);
    if (run < 10) {
      expect(f.runAfter).toHaveBeenCalledTimes(1);
      continuation = f.runAfter.mock.calls[0][2] as typeof continuation;
      expect(continuation.hop).toBe(run + 1);
    } else expect(f.runAfter).not.toHaveBeenCalled();
  }
  expect(searchAcsEventsOnDevice).toHaveBeenCalledTimes(10);
  expect(console.warn).toHaveBeenLastCalledWith(expect.stringContaining("toplam tarama sınırına"));
});

it.each(["cursor", "events"])("stops without scheduling when %s does not advance", async stuck => {
  const f = historyContext();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const eventAt = Date.now() - 7200000;
  vi.mocked(searchAcsEventsOnDevice).mockReset().mockResolvedValue({
    ok: true, events: [{ time: new Date(eventAt).toISOString(), serialNo: 42, cardNo: "CARD", major: 5, minor: 75 }],
    total: 100, numMatches: 1, nextPosition: stuck === "cursor" ? 30 : 60, hasMore: true,
  });
  await runBackfillContinuation(f.ctx, {
    deviceId: f.deviceId, devIndex: "index", searchID: "stuck", position: 30, startedAt: Date.now(), maxPages: 50,
    lastEventAt: eventAt, observedSerialNo: stuck === "events" ? 42 : undefined,
  });
  expect(searchAcsEventsOnDevice).toHaveBeenCalledTimes(1);
  expect(f.runAfter).not.toHaveBeenCalled();
  expect(f.runMutation).toHaveBeenCalledExactlyOnceWith(expect.anything(), {
    deviceId: f.deviceId, cursor: undefined, at: f.device.hikLastBackfillAt,
  });
  expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("ilerlemediği"));
});

it("defaults an authorized manual scan to the last 24 hours", async () => {
  vi.useFakeTimers();
  const now = Date.parse("2026-10-26T12:00:00Z");
  vi.setSystemTime(now);
  const f = historyContext();
  f.runQuery.mockImplementation(async ref => {
    const name = getFunctionName(ref);
    if (name.endsWith(":getByIdInternal")) return f.device;
    return name.endsWith(":listProjectIdsForCurrentUser") ? ["project"] : true;
  });
  vi.mocked(auditDeviceCommand).mockImplementation(async (_ctx, _id, _label, run) => await run());
  vi.mocked(searchAcsEventsOnDevice).mockReset().mockResolvedValue({ ok: true, events: [], total: 0, numMatches: 0, nextPosition: 0, hasMore: false });
  expect(await runBackfillDeviceEvents({ ...f.ctx, user: { _id: "user" } as Doc<"users"> }, { deviceId: f.deviceId })).toMatchObject({ ok: true });
  expect(searchAcsEventsOnDevice).toHaveBeenCalledExactlyOnceWith("index", expect.objectContaining({
    startTime: "2026-10-25T12:00:00.000Z", endTime: "2026-10-26T12:00:00.000Z",
  }));
});
