import { beforeEach, expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";
import type { ActionCtx } from "../_generated/server";
import type { SearchPersonResult } from "../lib/gateway/persons";
import { reconcileHikDeviceRoster } from "./hikRosterReconcile";

const wire = vi.hoisted(() => ({ search: vi.fn(), remove: vi.fn() }));
vi.mock("../lib/gateway/persons", () => ({ searchPersonOnDevice: wire.search, deletePersonFromDevice: wire.remove }));
const device = { _id: "device", projectId: "project", hikDevIndex: "index", hikTransport: "gateway", brand: "hikvision", isActive: true };
function fixture(expected: string[] | null = ["keep"]) {
  const runQuery = vi.fn(async () => ({ device, employeeNos: expected, skippedReason: expected === null ? "unsupported_device" : null }));
  const getDevice = vi.fn(async () => device);
  const dispatchQuery = (ref: Parameters<typeof getFunctionName>[0], _args: object) =>
    getFunctionName(ref) === "devices:getByIdInternal" ? getDevice() : runQuery();
  const runMutation = vi.fn(async () => null);
  const runAfter = vi.fn(async () => null);
  const ctx = { runQuery: dispatchQuery, runMutation, scheduler: { runAfter } } as unknown as ActionCtx;
  const handler = (reconcileHikDeviceRoster as unknown as { _handler: (ctx: ActionCtx, args: object) => Promise<{ onDevice: number; expected: number; extra: number; deleted: number; failed: number; skippedReason?: string }> })._handler;
  return { runQuery, getDevice, runMutation, runAfter, run: (dryRun = false, reason: "register" | "manual" = "manual", attempt?: number) => handler(ctx, { deviceId: "device", dryRun, reason, ...(attempt === undefined ? {} : { attempt }) }) };
}
function pages(identities: string[], size = 2) {
  wire.search.mockImplementation(async (_index: string, args: { searchResultPosition: number }): Promise<SearchPersonResult> => {
    const persons = identities.slice(args.searchResultPosition, args.searchResultPosition + size).map(employeeNo => ({ employeeNo }));
    return { ok: true, persons, total: identities.length, nextPosition: args.searchResultPosition + persons.length };
  });
}
beforeEach(() => { vi.clearAllMocks(); wire.search.mockReset(); wire.remove.mockReset().mockResolvedValue({ ok: true }); });
it("reads every page before deleting extras, preserves expected identities and returns counts", async () => {
  pages(["old-a", "keep", "old-b"]);
  const f = fixture();
  expect(await f.run()).toEqual({ onDevice: 3, expected: 1, extra: 2, deleted: 2, failed: 0 });
  expect(wire.search).toHaveBeenCalledTimes(3);
  expect(wire.remove.mock.calls).toEqual([["index", "old-a"], ["index", "old-b"]]);
  expect(wire.search.mock.invocationCallOrder[wire.search.mock.invocationCallOrder.length - 1]).toBeLessThan(wire.remove.mock.invocationCallOrder[0]);
  expect(f.runAfter).not.toHaveBeenCalled();
});
it("dry-run reports differences without deletion or scheduling", async () => {
  pages(["old", "keep"]);
  const f = fixture();
  expect(await f.run(true)).toMatchObject({ extra: 1, deleted: 0 });
  expect(wire.remove).not.toHaveBeenCalled();
  expect(f.runAfter).not.toHaveBeenCalled();
});
it("does not read unsupported devices or delete with empty/failed expected state", async () => {
  expect(await fixture(null).run()).toMatchObject({ skippedReason: "unsupported_device" });
  expect(wire.search).not.toHaveBeenCalled();
  pages(["old"]);
  expect(await fixture([]).run()).toMatchObject({ skippedReason: "expected_empty" });
  const f = fixture();
  f.runQuery.mockRejectedValue(new Error("query limit"));
  expect(await f.run()).toMatchObject({ skippedReason: "expected_unavailable" });
  expect(wire.remove).not.toHaveBeenCalled();
});
it("never deletes a partially scanned device roster", async () => {
  wire.search.mockResolvedValueOnce({ ok: true, total: 2, persons: [{ employeeNo: "old" }], nextPosition: 1 }).mockResolvedValue({ ok: false });
  expect(await fixture().run()).toMatchObject({ skippedReason: "device_roster_unavailable" });
  expect(wire.remove).not.toHaveBeenCalled();
});
it("refreshes rights every 25 candidates and preserves newly granted identities", async () => {
  pages(Array.from({ length: 27 }, (_, i) => `old-${i}`), 30);
  const f = fixture();
  f.runQuery.mockResolvedValueOnce({ device, employeeNos: ["keep"], skippedReason: null })
    .mockResolvedValueOnce({ device, employeeNos: ["keep"], skippedReason: null })
    .mockResolvedValue({ device, employeeNos: ["keep", "old-25"], skippedReason: null });
  expect(await f.run()).toMatchObject({ extra: 27, deleted: 26 });
  expect(f.runQuery).toHaveBeenCalledTimes(3);
  expect(f.getDevice).toHaveBeenCalledTimes(27);
  expect(wire.remove).not.toHaveBeenCalledWith("index", "old-25");
});
it("stops when the device project changes during the scan", async () => {
  pages(["old"]);
  const f = fixture();
  f.runQuery.mockResolvedValueOnce({ device, employeeNos: ["keep"], skippedReason: null })
    .mockResolvedValue({ device: { ...device, projectId: "moved" }, employeeNos: ["keep"], skippedReason: null });
  expect(await f.run()).toMatchObject({ skippedReason: "device_changed" });
  expect(wire.remove).not.toHaveBeenCalled();
});
it("limits deletions to 500 and schedules a fresh scan", async () => {
  pages(Array.from({ length: 501 }, (_, i) => `old-${i}`), 30);
  const f = fixture();
  expect(await f.run()).toMatchObject({ extra: 501, deleted: 500, failed: 0 });
  expect(wire.remove).toHaveBeenCalledTimes(500);
  expect(f.runAfter).toHaveBeenCalledTimes(1);
  const call = f.runAfter.mock.calls[0] as unknown as [number, Parameters<typeof getFunctionName>[0], object];
  expect(getFunctionName(call[1])).toBe("actions/hikRosterReconcile:reconcileHikDeviceRoster");
  expect(call[2]).toEqual({ deviceId: "device", dryRun: false, reason: "manual" });
  expect(f.runQuery).toHaveBeenCalledTimes(21);
  expect(f.getDevice).toHaveBeenCalledTimes(500);
});
it("counts failed deletions without creating an endless continuation loop", async () => {
  pages(Array.from({ length: 501 }, (_, i) => `old-${i}`), 30);
  wire.remove.mockRejectedValue(new Error("offline"));
  const f = fixture();
  expect(await f.run()).toMatchObject({ deleted: 0, failed: 500 });
  expect(f.runAfter).not.toHaveBeenCalled();
});

it("cleans every old identity on registration with an empty expected roster", async () => {
  pages(["old-a", "old-b"]);
  expect(await fixture([]).run(false, "register")).toMatchObject({ extra: 2, deleted: 2 });
  expect(wire.remove).toHaveBeenCalledTimes(2);
});
it.each([0, 1, 2, 3, 4])("retries offline registration with bounded delay at attempt %i", async attempt => {
  wire.search.mockResolvedValue({ ok: false });
  const f = fixture([]);
  expect(await f.run(false, "register", attempt)).toMatchObject({ skippedReason: "device_roster_unavailable" });
  expect(f.runAfter).toHaveBeenCalledWith([1, 5, 15, 30, 60][attempt] * 60_000, expect.anything(), {
    deviceId: "device", dryRun: false, reason: "register", attempt: attempt + 1,
  });
  expect(f.runMutation).not.toHaveBeenCalled();
  expect(wire.remove).not.toHaveBeenCalled();
});
it("defaults the first registration retry to one minute and does not retry manual or dry-run", async () => {
  wire.search.mockRejectedValue(new Error("offline"));
  const f = fixture();
  await f.run(false, "register");
  expect(f.runAfter).toHaveBeenCalledWith(60_000, expect.anything(), expect.objectContaining({ attempt: 1 }));
  f.runAfter.mockClear();
  await f.run();
  await f.run(true, "register");
  expect(f.runAfter).not.toHaveBeenCalled();
  expect(f.runMutation).not.toHaveBeenCalled();
});
it("retries incomplete registration snapshots without deleting", async () => {
  wire.search.mockResolvedValueOnce({ ok: true, persons: [{ employeeNo: "old" }], total: 2, nextPosition: 1 })
    .mockResolvedValue({ ok: true, persons: [], total: 2, nextPosition: 1 });
  const f = fixture([]);
  expect(await f.run(false, "register")).toMatchObject({ skippedReason: "incomplete_device_roster" });
  expect(f.runAfter).toHaveBeenCalledTimes(1);
  expect(wire.remove).not.toHaveBeenCalled();
});
it.each(["device_roster_unavailable", "incomplete_device_roster"])("writes the visible offline hint after the final %s failure", async reason => {
  wire.search.mockResolvedValue(reason === "device_roster_unavailable"
    ? { ok: false }
    : { ok: true, persons: [], total: 1, nextPosition: 0 });
  const f = fixture();
  expect(await f.run(false, "register", 5)).toMatchObject({ skippedReason: reason });
  expect(f.runAfter).not.toHaveBeenCalled();
  expect(f.runMutation).toHaveBeenCalledWith(expect.anything(), {
    deviceId: "device",
    hint: "Cihazdaki eski kişiler temizlenemedi (cihaz çevrimdışı). Cihaz çevrimiçi olunca destekle iletişime geçin.",
  });
  const call = f.runMutation.mock.calls[0] as unknown as [Parameters<typeof getFunctionName>[0], object];
  expect(getFunctionName(call[0])).toBe("devices:setHikOfflineHint");
});
it("retains per-deletion project checks between full roster refreshes", async () => {
  pages(["old-a", "old-b"]);
  const f = fixture();
  f.getDevice.mockResolvedValueOnce(device).mockResolvedValue({ ...device, projectId: "moved" });
  expect(await f.run(false, "register")).toMatchObject({ deleted: 1, skippedReason: "device_changed" });
  expect(f.runQuery).toHaveBeenCalledTimes(2);
  expect(f.runAfter).not.toHaveBeenCalled();
});
it("never retries unsupported or unavailable expected registration rosters", async () => {
  const f = fixture(null);
  expect(await f.run(false, "register")).toMatchObject({ skippedReason: "unsupported_device" });
  f.runQuery.mockRejectedValue(new Error("unavailable"));
  expect(await f.run(false, "register")).toMatchObject({ skippedReason: "expected_unavailable" });
  expect(f.runAfter).not.toHaveBeenCalled();
  expect(wire.search).not.toHaveBeenCalled();
});
