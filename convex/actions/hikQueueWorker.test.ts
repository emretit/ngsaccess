import { describe, expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";
import type { ActionCtx } from "../_generated/server";
import { processHikQueue } from "./hikQueueWorker";

describe("fingerprint retry replay", () => {
  it.each([true, false])("awaits actual scoped push result: %s", async ok => {
    const candidate = { _id: "op-a", operation: "addFingerprint", payload: { employeeId: "employee-a", fingerPrintID: 2 }, device: { _id: "device-a", hikDevIndex: "dev" } };
    const runQuery = vi.fn(async (ref: Parameters<typeof getFunctionName>[0]) => getFunctionName(ref).endsWith(":listRetryCandidates") ? [candidate] : null);
    const runAction = vi.fn(async () => ({ ok }));
    const runAfter = vi.fn(async () => null);
    const runMutation = vi.fn(async () => null);
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
