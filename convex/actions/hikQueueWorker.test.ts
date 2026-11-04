import { describe, expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";
import type { ActionCtx } from "../_generated/server";
import { processHikQueue } from "./hikQueueWorker";

describe("fingerprint retry replay", () => {
  it.each([true, false])("awaits actual scoped push result: %s", async ok => {
    const candidate = { _id: "op-a", operation: "addFingerprint", payload: { employeeId: "employee-a", fingerPrintID: 2 }, device: { _id: "device-a", hikDevIndex: "dev" } };
    const runQuery = vi.fn(async () => null);
    const runAction = vi.fn(async () => ({ ok }));
    const runAfter = vi.fn(async () => null);
    const runMutation = vi.fn(async (ref: Parameters<typeof getFunctionName>[0]) => getFunctionName(ref).endsWith(":listRetryCandidates") ? [candidate] : null);
    const ctx = { runQuery, runMutation, runAction, scheduler: { runAfter } } as unknown as ActionCtx;
    const handler = (processHikQueue as unknown as { _handler: (ctx: ActionCtx, input: object) => Promise<unknown> })._handler;
    await expect(handler(ctx, {})).resolves.toEqual({ retried: 1, ok: ok ? 1 : 0, failed: ok ? 0 : 1 });
    const calls = runAction.mock.calls as unknown as [Parameters<typeof getFunctionName>[0], object][];
    expect(getFunctionName(calls[0][0])).toBe("actions/hikFingerprint:pushFingerprintToDevices");
    expect(calls[0][1]).toEqual({ employeeId: "employee-a", fingerNo: 2, deviceIds: ["device-a"], retrying: true });
    expect(runAfter).not.toHaveBeenCalled();
    expect(JSON.stringify(candidate)).not.toContain("fingerData");
  });
});

vi.mock("../lib/hikGateway", () => ({ deleteFaceFromDevice: vi.fn(async () => ({ ok: true })) }));
import { deleteFaceFromDevice } from "../lib/hikGateway";

describe("HSP-03 face deletion identity", () => {
  it.each([
    { payload: { employeeNo: "old", cardNumber: "other" }, employee: { cardNumber: "new" }, expected: "old" },
    { payload: { cardNumber: "old" }, employee: null, expected: "old" },
    { payload: {}, employee: { cardNumber: "legacy" }, expected: "legacy" },
  ])("uses captured identity and preserves legacy fallback: %j", async ({ payload, employee, expected }) => {
    vi.mocked(deleteFaceFromDevice).mockClear();
    const candidate = { _id: "op", operation: "deleteFace", payload, employee, device: { _id: "device", hikDevIndex: "dev" } };
    const ctx = { runMutation: vi.fn(async (ref: Parameters<typeof getFunctionName>[0]) => getFunctionName(ref).endsWith(":listRetryCandidates") ? [candidate] : null) } as unknown as ActionCtx;
    const handler = (processHikQueue as unknown as { _handler: (ctx: ActionCtx, input: object) => Promise<unknown> })._handler;
    await expect(handler(ctx, {})).resolves.toEqual({ retried: 1, ok: 1, failed: 0 });
    expect(deleteFaceFromDevice).toHaveBeenCalledWith("dev", expected);
  });
});

describe("GK-01 rights-only retry", () => {
  it.each([true, false])("uses the no-deletion action even with no remaining employee scope: %s", async ok => {
    const candidate = { _id: "rights-op", operation: "updatePerson", payload: { rightsOnly: true, employeeId: "employee" }, employee: null, device: { _id: "device", hikDevIndex: "dev" } };
    const runAction = vi.fn(async () => ({ ok, ...(ok ? {} : { error: "offline" }) }));
    const runMutation = vi.fn(async (ref: Parameters<typeof getFunctionName>[0]) => getFunctionName(ref).endsWith(":listRetryCandidates") ? [candidate] : null);
    const ctx = { runMutation, runAction } as unknown as ActionCtx;
    const handler = (processHikQueue as unknown as { _handler: (ctx: ActionCtx, args: object) => Promise<unknown> })._handler;
    expect(await handler(ctx, {})).toEqual({ retried: 1, ok: ok ? 1 : 0, failed: ok ? 0 : 1 });
    const calls = runAction.mock.calls as unknown as [Parameters<typeof getFunctionName>[0], object][];
    expect(calls).toHaveLength(1);
    expect(getFunctionName(calls[0][0])).toBe("actions/hikvisionSync:syncDoorRightsOperation");
    expect(calls[0][1]).toEqual({ operationId: "rights-op", retrying: true });
  });
});
