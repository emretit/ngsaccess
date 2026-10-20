// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const wire = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("./lib/gateway/core", () => ({ gatewayApiCallChecked: wire.send }));
const modules = import.meta.glob("./**/*.ts");
const now = "2026-10-19T09:00:00.000Z";

async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "Synthetic gateway project" });
    const employeeId = await ctx.db.insert("employees", { projectId, firstName: "Synthetic", lastName: "Owner", email: "owner@example.test", cardNumber: "synthetic-card", isActive: true });
    await ctx.db.insert("employeeAuth", { employeeId, passwordHash: "synthetic-hash", passwordVersion: 1, createdAt: now, updatedAt: now });
    const sessionId = await ctx.db.insert("employeeSessions", { employeeId, token: "session-a", passwordVersion: 1, expiresAt: "2030-01-01T00:00:00Z", createdAt: now });
    const deviceId = await ctx.db.insert("devices", { projectId, name: "Synthetic gateway", brand: "hikvision", hikTransport: "gateway", hikDevIndex: "synthetic-index", hikDoorCount: 1, isActive: true, createdAt: now, updatedAt: now });
    const ruleId = await ctx.db.insert("accessRules", { projectId, name: "Monday", days: ["Monday"], isActive: true });
    await ctx.db.insert("groupMembers", { projectId, employeeId, groupId: ruleId, createdAt: now });
    await ctx.db.insert("groupDevices", { projectId, deviceId, groupId: ruleId, createdAt: now });
    return { deviceId, employeeId, sessionId };
  });
  return { t, ...ids };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(now));
  wire.send.mockReset();
});
afterEach(() => vi.useRealTimers());

describe("mobile gateway private action", () => {
  it.each(["ack", "negative", "timeout"] as const)("dispatches once on %s and never writes attendance", async result => {
    const { t, deviceId } = await fixture();
    if (result === "timeout") wire.send.mockRejectedValue(new Error("synthetic transport failure"));
    else wire.send.mockResolvedValue({ ok: result === "ack", alreadyExists: false, error: result === "negative" ? "synthetic panel rejected" : undefined });
    const args = { sessionToken: "session-a", requestId: "synthetic-gateway-request", deviceId };
    const queued = await t.mutation(api.mobileAccess.requestOpen, args);
    await vi.advanceTimersByTimeAsync(0);
    await t.finishInProgressScheduledFunctions();
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());
    expect(wire.send).toHaveBeenCalledExactlyOnceWith("/ISAPI/AccessControl/RemoteControl/door/1", "PUT", { RemoteControlDoor: { cmd: "open" } }, "synthetic-index");
    expect(await t.query(api.mobileAccess.getOperation, { sessionToken: "session-a", operationId: queued.operationId })).toMatchObject({ status: result === "ack" ? "confirmed" : "unknown" });
    expect(await t.mutation(api.mobileAccess.requestOpen, args)).toMatchObject({ operationId: queued.operationId, status: result === "ack" ? "confirmed" : "unknown" });
    expect(wire.send).toHaveBeenCalledTimes(1);
    expect(await t.run(ctx => ctx.db.query("cardReadings").take(20))).toEqual([]);
  });

  it("rechecks logout before the scheduled gateway action can send", async () => {
    const { t, deviceId, sessionId } = await fixture();
    const queued = await t.mutation(api.mobileAccess.requestOpen, { sessionToken: "session-a", requestId: "synthetic-logout-request", deviceId });
    await t.run(ctx => ctx.db.delete(sessionId));
    await vi.advanceTimersByTimeAsync(0);
    await t.finishInProgressScheduledFunctions();
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());
    expect(wire.send).not.toHaveBeenCalled();
    const id = await t.run(async ctx => ctx.db.normalizeId("mobileAccessOperations", queued.operationId));
    if (!id) throw new Error("Missing operation ID");
    expect(await t.run(ctx => ctx.db.get(id))).toMatchObject({ status: "failed", errorCode: "TARGET_NOT_ALLOWED" });
  });

  it("claims a scheduled gateway operation once even when an action is delivered twice", async () => {
    const { t, deviceId } = await fixture();
    const queued = await t.mutation(api.mobileAccess.requestOpen, { sessionToken: "session-a", requestId: "synthetic-claim-request", deviceId });
    const operationId = await t.run(async ctx => ctx.db.normalizeId("mobileAccessOperations", queued.operationId));
    if (!operationId) throw new Error("Missing operation ID");
    expect(await t.mutation(internal.mobileAccess.claimGateway, { operationId })).toEqual({ devIndex: "synthetic-index", actuator: 1 });
    expect(await t.mutation(internal.mobileAccess.claimGateway, { operationId })).toBeNull();
    await vi.advanceTimersByTimeAsync(0);
    await t.finishInProgressScheduledFunctions();
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());
    expect(wire.send).not.toHaveBeenCalled();
    expect(await t.query(api.mobileAccess.getOperation, { sessionToken: "session-a", operationId })).toMatchObject({ status: "unknown" });
  });
});
