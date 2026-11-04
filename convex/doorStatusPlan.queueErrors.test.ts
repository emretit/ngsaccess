import { describe, expect, it, vi } from "vitest";
import { ConvexError } from "convex/values";
import { getFunctionName } from "convex/server";
import type { ActionCtx } from "./_generated/server";
import { processHikQueue } from "./actions/hikQueueWorker";

describe("GK-04: retry error allowlist", () => {
  it.each([
    new Error("password=secret"),
    new ConvexError("password=secret"),
    new ConvexError({ code: "OTHER_ERROR", message: "password=secret" }),
    { data: { code: "DOOR_TARGET_CONFLICT", message: "password=secret" } },
  ])("does not persist unknown error details: %#", async error => {
    const candidate = { _id: "operation", operation: "syncDoorStatusPlan", payload: { doorId: "door" }, device: { _id: "device", hikDevIndex: "test" } };
    const runQuery = vi.fn(async () => { throw error; });
    const runMutation = vi.fn(async (ref: Parameters<typeof getFunctionName>[0], _args: unknown) => getFunctionName(ref).endsWith(":listRetryCandidates") ? [candidate] : null);
    const ctx = { runQuery, runMutation } as unknown as ActionCtx;
    const handler = (processHikQueue as unknown as { _handler: (ctx: ActionCtx, args: object) => Promise<unknown> })._handler;
    expect(await handler(ctx, {})).toEqual({ retried: 1, ok: 0, failed: 1 });
    expect(runMutation.mock.calls.find(([ref]) => getFunctionName(ref).endsWith(":markOpRetried"))?.[1]).toEqual({ id: "operation", lastError: "Cihaz işlemi tamamlanamadı" });
  });
});
