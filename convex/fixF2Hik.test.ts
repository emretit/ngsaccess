// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const wire = vi.hoisted(() => ({ remove: vi.fn(async () => ({ ok: true })) }));
vi.mock("./lib/hikGateway", async original => ({
  ...await original<typeof import("./lib/hikGateway")>(), deletePersonFromDevice: wire.remove,
}));
const modules = import.meta.glob("./**/*.ts");
const now = Date.parse("2026-10-26T12:00:00Z");
const selection = { limit: 20, maxAttempts: 5, onlineWindowMs: 300000 };
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(now); wire.remove.mockClear(); });
afterEach(() => vi.useRealTimers());

async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "Hik retry" });
    const otherProjectId = await ctx.db.insert("projects", { name: "Other" });
    const userId = await ctx.db.insert("users", { role: "project_admin" });
    const viewerId = await ctx.db.insert("users", { role: "project_user" });
    await ctx.db.insert("userProjects", { userId, projectId });
    await ctx.db.insert("userProjects", { userId: viewerId, projectId });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: now + 86400000 });
    const viewerSessionId = await ctx.db.insert("authSessions", { userId: viewerId, expirationTime: now + 86400000 });
    const base = { brand: "hikvision" as const, hikTransport: "gateway" as const, name: "Hik", createdAt: "", updatedAt: "", hikDevIndex: "gateway", hikLastSeenAt: now };
    const deviceId = await ctx.db.insert("devices", { ...base, projectId });
    const offlineId = await ctx.db.insert("devices", { ...base, projectId, hikIsupOnline: false, hikIsupStatusAt: now });
    const foreignId = await ctx.db.insert("devices", { ...base, projectId: otherProjectId });
    return { projectId, otherProjectId, userId, sessionId, viewerId, viewerSessionId, deviceId, offlineId, foreignId };
  });
  const admin = t.withIdentity({ subject: `${ids.userId}|${ids.sessionId}` });
  const viewer = t.withIdentity({ subject: `${ids.viewerId}|${ids.viewerSessionId}` });
  return { t, ids, admin, viewer };
}

describe("C-08 fair due Hik retry", () => {
  it("selects an old revocation behind 120 terminal/offline entries and defers blockers", async () => {
    const { t, ids } = await fixture();
    const { deletion, blockers } = await t.run(async ctx => {
      const blockers = [];
      for (let i = 0; i < 120; i++) blockers.push(await ctx.db.insert("hikPendingOperations", {
        projectId: ids.projectId, deviceId: i % 2 ? ids.offlineId : ids.deviceId,
        operation: "deletePerson", payload: { employeeNo: `BLOCK-${i}` }, status: "failed",
        attemptCount: i % 2 ? 0 : 5, createdAt: now, nextRetryAt: now - 10000,
      }));
      const deletion = await ctx.db.insert("hikPendingOperations", {
        projectId: ids.projectId, deviceId: ids.deviceId, operation: "deletePerson", payload: { employeeNo: "OLD" },
        status: "failed", attemptCount: 0, createdAt: now - 86400000, nextRetryAt: now - 5000,
      });
      return { deletion, blockers };
    });
    expect((await t.mutation(internal.hikvisionSync.listRetryCandidates, selection)).map(op => op._id)).toEqual([deletion]);
    const rows = await t.run(ctx => Promise.all(blockers.map(id => ctx.db.get(id))));
    expect(rows.every(row => row?.status === "failed" && (row.nextRetryAt ?? 0) > now)).toBe(true);
    expect((await t.mutation(internal.hikvisionSync.listRetryCandidates, selection)).map(op => op._id)).toEqual([deletion]);
  });

  it("advances beyond a bounded page of terminal revocations without deleting them", async () => {
    const { t, ids } = await fixture();
    const target = await t.run(async ctx => {
      for (let i = 0; i < 210; i++) await ctx.db.insert("hikPendingOperations", {
        projectId: ids.projectId, deviceId: ids.deviceId, operation: "deletePerson", payload: { employeeNo: `TERMINAL-${i}` },
        status: "failed", attemptCount: 5, createdAt: now, nextRetryAt: now - 10000,
      });
      return ctx.db.insert("hikPendingOperations", {
        projectId: ids.projectId, deviceId: ids.deviceId, operation: "deletePerson", payload: { employeeNo: "TARGET" },
        status: "failed", attemptCount: 0, createdAt: now, nextRetryAt: now - 5000,
      });
    });
    expect(await t.mutation(internal.hikvisionSync.listRetryCandidates, selection)).toEqual([]);
    expect((await t.mutation(internal.hikvisionSync.listRetryCandidates, selection)).map(op => op._id)).toEqual([target]);
    expect(await t.run(ctx => ctx.db.query("hikPendingOperations").take(220))).toHaveLength(211);
  });

  it("keeps due order and revocation priority, excludes future/dismissed jobs", async () => {
    const { t, ids } = await fixture();
    await t.run(async ctx => {
      for (const [operation, nextRetryAt, dismissedAt] of [
        ["rebootDevice", now - 9000, undefined], ["deletePerson", now - 3000, undefined],
        ["deletePerson", now - 6000, undefined], ["deletePerson", now + 1, undefined],
        ["deletePerson", now - 12000, now],
      ] as const) await ctx.db.insert("hikPendingOperations", {
        projectId: ids.projectId, deviceId: ids.deviceId, operation, payload: { employeeNo: String(nextRetryAt) },
        status: "failed", attemptCount: 0, createdAt: now, nextRetryAt, dismissedAt,
      });
    });
    const rows = await t.mutation(internal.hikvisionSync.listRetryCandidates, selection);
    expect(rows.map(row => row.payload.employeeNo)).toEqual([String(now - 6000), String(now - 3000), String(now - 9000)]);
  });

  it("manual retry schedules and executes only the selected terminal deletion", async () => {
    const { t, ids, admin } = await fixture();
    const [otherId, selectedId] = await t.run(async ctx => Promise.all(["OTHER", "SELECTED"].map(employeeNo => ctx.db.insert("hikPendingOperations", {
      projectId: ids.projectId, deviceId: ids.deviceId, operation: "deletePerson", payload: { employeeNo },
      status: "failed", attemptCount: 5, createdAt: now, nextRetryAt: Number.MAX_SAFE_INTEGER,
    }))));
    expect(await admin.mutation(api.hikvisionSync.retrySyncIssue, { issueId: selectedId })).toEqual({ queued: true });
    const jobs = await t.run(ctx => ctx.db.system.query("_scheduled_functions").take(10));
    expect(jobs).toEqual([expect.objectContaining({ name: "actions/hikQueueWorker:processHikOperation", args: [{ issueId: selectedId }] })]);
    await vi.advanceTimersByTimeAsync(1);
    await t.finishInProgressScheduledFunctions();
    expect(wire.remove).toHaveBeenCalledExactlyOnceWith("gateway", "SELECTED");
    expect(await t.run(ctx => ctx.db.get(otherId))).toMatchObject({ status: "failed", attemptCount: 5 });
    expect(await t.run(ctx => ctx.db.get(selectedId))).toMatchObject({ status: "done" });
  });

  it("rejects manual retry for a foreign project and a role without device permission", async () => {
    const { t, ids, admin, viewer } = await fixture();
    const [localId, foreignId] = await t.run(async ctx => Promise.all([ids.deviceId, ids.foreignId].map(deviceId => ctx.db.insert("hikPendingOperations", {
      projectId: deviceId === ids.deviceId ? ids.projectId : ids.otherProjectId,
      deviceId, operation: "deletePerson", payload: { employeeNo: "OLD" }, status: "failed", attemptCount: 5, createdAt: now,
    }))));
    await expect(admin.mutation(api.hikvisionSync.retrySyncIssue, { issueId: foreignId })).rejects.toThrow();
    await expect(viewer.mutation(api.hikvisionSync.retrySyncIssue, { issueId: localId })).rejects.toThrow();
    expect(await t.run(ctx => ctx.db.system.query("_scheduled_functions").take(10))).toEqual([]);
    expect(wire.remove).not.toHaveBeenCalled();
  });
});

it("parks permanently ineligible jobs once, preserves revocations and reopens manual retry", async () => {
  const { t, ids, admin } = await fixture();
  const operations = await t.run(async ctx => {
    await ctx.db.insert("projectPrivacySettings", { projectId: ids.projectId, biometricEnabled: false, updatedAt: "" });
    const localId = await ctx.db.insert("devices", { name: "Local", brand: "hikvision", hikTransport: "localBridge", projectId: ids.projectId, createdAt: "", updatedAt: "" });
    const missingId = await ctx.db.insert("devices", { name: "Deleted", createdAt: "", updatedAt: "" });
    await ctx.db.delete(missingId);
    const noIndex = await ctx.db.insert("devices", { name: "No index", brand: "hikvision", projectId: ids.projectId, createdAt: "", updatedAt: "" });
    const rows = [];
    for (const deviceId of [localId, missingId, noIndex, ids.foreignId]) rows.push(await ctx.db.insert("hikPendingOperations", {
      projectId: ids.projectId, deviceId, operation: "deletePerson", payload: { employeeNo: "KEEP" }, status: "failed", attemptCount: 0, createdAt: now,
    }));
    rows.push(await ctx.db.insert("hikPendingOperations", {
      projectId: ids.projectId, deviceId: ids.deviceId, operation: "addFace", payload: {}, status: "failed", attemptCount: 0, createdAt: now,
    }));
    return rows;
  });
  expect(await t.mutation(internal.hikvisionSync.listRetryCandidates, selection)).toEqual([]);
  const first = await t.run(ctx => Promise.all(operations.map(id => ctx.db.get(id))));
  expect(first.every(row => row?.status === "failed" && row.nextRetryAt === Number.MAX_SAFE_INTEGER)).toBe(true);
  vi.setSystemTime(now + 4 * 60000);
  expect(await t.mutation(internal.hikvisionSync.listRetryCandidates, selection)).toEqual([]);
  expect(await t.run(ctx => Promise.all(operations.map(id => ctx.db.get(id))))).toEqual(first);
  const issueId = operations[0];
  if (!issueId) throw new Error("Test kaydı yok");
  expect(await admin.mutation(api.hikvisionSync.retrySyncIssue, { issueId })).toEqual({ queued: true });
  expect(await t.run(ctx => ctx.db.get(issueId))).toMatchObject({ status: "pending", nextRetryAt: now + 4 * 60000 });
});
