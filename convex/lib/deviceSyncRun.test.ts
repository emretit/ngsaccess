import { describe, expect, it, vi } from "vitest";
import { refreshDelay, summaryChanged, operationStatus, skippedReason, skipReasons, summarizeRun, targetStatus } from "./deviceSyncRun";

describe("device sync evidence", () => {
  it("never promotes Hik done to verified", () => {
    expect(operationStatus("hikvision", { status: "done" })).toBe("sent");
    expect(operationStatus("ide_smart", { status: "acked" })).toBe("unknown");
    expect(operationStatus("ide_smart", { status: "acked", ackedAt: 0 })).toBe("verified");
    expect(operationStatus("ide_smart", { status: "sent" })).toBe("queued");
  });
  it("requires every operation, preserves failures and expires missing evidence", () => {
    expect(targetStatus(["verified", "queued"])).toBe("queued");
    expect(targetStatus(["failed", "queued"])).toBe("queued");
    expect(targetStatus(["failed", "queued"], true)).toBe("failed");
    expect(targetStatus(["verified", "queued"], true)).toBe("unknown");
    expect(targetStatus([])).toBe("unknown");
    expect(targetStatus(["verified", "unknown"])).toBe("unknown");
    expect(targetStatus(["verified", "verified"])).toBe("verified");
    expect(targetStatus(["sent", "sent"])).toBe("sent");
  });
  it("does not finish before dispatch or while targets are queued", () => {
    expect(summarizeRun(["sent"], false).status).toBe("running");
    expect(summarizeRun(["queued", "failed"], true).status).toBe("running");
    expect(summarizeRun(["sent", "verified"], true).status).toBe("done");
    expect(summarizeRun(["verified", "skipped"], true).status).toBe("partial");
    expect(summarizeRun(["failed", "unknown"], true).status).toBe("failed");
    expect(summarizeRun(["skipped"], true).status).toBe("partial");
    expect(summarizeRun(["sent", "sent", "failed"], true).counts.sent).toBe(2);
  });
  it("uses the shared connection evidence without inventing offline evidence", () => {
    expect(skippedReason({ brand: "hikvision", hikDevIndex: "x", hikOfflineHint: "disconnected" }, 400000)).toBe(skipReasons.offline);
    expect(skippedReason({ brand: "hikvision", hikDevIndex: "x", hikLastSeenAt: 1 }, 400000)).toBe(skipReasons.offline);
    expect(skippedReason({ brand: "hikvision", hikDevIndex: "x", hikLastSeenAt: 399999 }, 400000)).toBeUndefined();
    expect(skippedReason({ brand: "ide_smart", ideUuid: "u", ideUser: "a", idePassword: "p", lastSeen: "invalid" }, 400000)).toBeUndefined();
  });
  it("explains unsupported, offline, inactive and missing configuration targets", () => {
    expect(skippedReason({ brand: "other" }, 1000)).toBe(skipReasons.unsupported);
    expect(skippedReason({ brand: "hikvision", status: "offline" }, 1000)).toBe(skipReasons.offline);
    expect(skippedReason({ isActive: false }, 1000)).toBe(skipReasons.inactive);
    expect(skippedReason({ brand: "ide_smart", ideUuid: "uuid" }, 1000)).toBe(skipReasons.configuration);
    expect(skippedReason({ brand: "hikvision", hikDevIndex: "index" }, 1000)).toBeUndefined();
    expect(skippedReason({ brand: "hikvision", hikTransport: "localBridge", deviceIp: "ip" }, 1000)).toBe(skipReasons.configuration);
  });
});


import { getFunctionName } from "convex/server";
import type { MutationCtx, ActionCtx } from "../_generated/server";
import * as runs from "../deviceSyncRuns";
vi.mock("./customFunctions", () => {
  const register = (definition: { handler: unknown }) => ({ _handler: definition.handler });
  return { authedAction: register, authedQuery: register };
});
vi.mock("./auth", () => ({ requireAdmin: async () => ({ _id: "admin" }), getProjectIdsForUser: async () => ["project"] }));

type Row = Record<string, unknown>;
type Ref = Parameters<typeof getFunctionName>[0];
async function invoke<T = unknown>(fn: unknown, ctx: unknown, args: object): Promise<T> {
  return (fn as { _handler: (ctx: MutationCtx | ActionCtx, args: object) => Promise<T> })._handler(ctx as MutationCtx, args);
}
function memory() {
  const run: Row = { _id: "run", projectId: "project", startedAt: Date.now(), status: "running", dispatchFinished: true,
    counts: summarizeRun(["queued", "queued"], true).counts };
  const targets: Row[] = [
    { _id: "hik-target", runId: "run", deviceId: "hik", brand: "hikvision", status: "queued", dispatchFinished: true, updatedAt: 0 },
    { _id: "ide-target", runId: "run", deviceId: "ide", brand: "ide_smart", status: "queued", dispatchFinished: true, updatedAt: 0 },
  ];
  const tables: Record<string, Row[]> = { deviceSyncRuns: [run], deviceSyncRunTargets: targets,
    hikPendingOperations: [{ runId: "run", deviceId: "hik", status: "pending" }],
    idePendingOperations: [{ runId: "run", deviceId: "ide", status: "pending" }],
  };
  const indexes: string[] = [];
  const query = (table: string) => {
    let rows = [...(tables[table] ?? [])];
    const bounds = { eq: (field: string, value: unknown) => { rows = rows.filter(row => row[field] === value); return bounds; } };
    const chain = {
      withIndex: (name: string, callback: (q: typeof bounds) => unknown) => { indexes.push(name); callback(bounds); return chain; },
      take: async (limit: number) => rows.slice(0, limit),
      order: () => { rows.sort((a, b) => Number(b.startedAt) - Number(a.startedAt)); return chain; },
    };
    return chain;
  };
  const patch = vi.fn(async (id: string, updates: Row) => {
    const row = Object.values(tables).flat().find(item => item._id === id);
    if (!row) throw new Error("Fixture missing");
    Object.assign(row, updates);
  });
  const runAfter = vi.fn(async (_delay: number, _ref: Ref, _args: object) => "scheduled");
  const ctx = { db: { query, get: async (id: string) => structuredClone(Object.values(tables).flat().find(item => item._id === id) ?? null), patch,
    insert: async (table: string, row: Row) => { const id = `${table}-${tables[table]?.length ?? 0}`;
      (tables[table] ??= []).push({ ...row, _id: id }); return id; } }, scheduler: { runAfter } };
  return { run, targets, tables, ctx, patch, runAfter, indexes };
}

describe("run-wide refresh and IDE dispatch", () => {
  it("backs off 5 → 15 → 30 → 60 seconds and compares summaries without timestamp churn", () => {
    expect([0, 1, 2, 3, 20].map(refreshDelay)).toEqual([5000, 15000, 30000, 60000, 60000]);
    const summary = summarizeRun(["queued"], true);
    expect(summaryChanged(summary, { ...summary, counts: { ...summary.counts } })).toBe(false);
    expect(summaryChanged(summary, summarizeRun(["sent"], true))).toBe(true);
  });
  it("polls the whole run once without patches when evidence is unchanged", async () => {
    const f = memory();
    await invoke(runs.refreshSummary, f.ctx, { runId: "run", pollAttempt: 1 });
    expect(f.patch).not.toHaveBeenCalled();
    expect(f.runAfter).toHaveBeenCalledOnce();
    expect(f.runAfter.mock.calls.map(([delay, ref]) => [delay, getFunctionName(ref)]))
      .toEqual([[15000, "deviceSyncRuns:refreshSummary"]]);
  });
  it("stops scheduling on terminal evidence and retains honest Hik sent / IDE verified", async () => {
    const f = memory();
    f.tables.hikPendingOperations[0].status = "done";
    Object.assign(f.tables.idePendingOperations[0], { status: "acked", ackedAt: 1 });
    await invoke(runs.refreshSummary, f.ctx, { runId: "run" });
    expect(f.targets.map(target => target.status)).toEqual(["sent", "verified"]);
    expect(f.run).toMatchObject({ status: "done", counts: { sent: 1, verified: 1, queued: 0 } });
    expect(f.patch).toHaveBeenCalledTimes(3);
    expect(f.runAfter).not.toHaveBeenCalled();
    f.patch.mockClear();
    await invoke(runs.refreshSummary, f.ctx, { runId: "run" });
    await invoke(runs.expireRun, f.ctx, { runId: "run" });
    expect(f.patch).not.toHaveBeenCalled();
  });
  it("expires incomplete dispatch and pending evidence without creating target jobs", async () => {
    const f = memory();
    f.run.startedAt = Date.now() - 600001;
    f.targets[0].dispatchFinished = false;
    await invoke(runs.expireRun, f.ctx, { runId: "run" });
    expect(f.targets.map(target => target.status)).toEqual(["unknown", "unknown"]);
    expect(f.run.status).toBe("failed");
    expect(f.runAfter).not.toHaveBeenCalled();
  });
  it("finishTarget is idempotent and creates no per-target polling chain", async () => {
    const f = memory();
    f.targets[0].dispatchFinished = false;
    await invoke(runs.finishTarget, f.ctx, { targetId: "hik-target" });
    await invoke(runs.finishTarget, f.ctx, { targetId: "hik-target" });
    expect(f.patch).toHaveBeenCalledOnce();
    expect(f.runAfter).not.toHaveBeenCalled();
    await invoke(runs.refreshTarget, f.ctx, { targetId: "hik-target" });
    expect(f.runAfter).not.toHaveBeenCalled();
  });
  it("creates one refresh and one IDE dispatch for 50 eligible panels", async () => {
    const f = memory();
    f.tables.deviceSyncRuns = [];
    f.tables.deviceSyncRunTargets = [];
    f.tables.devices = Array.from({ length: 50 }, (_, i) => ({ _id: `panel-${i}`, projectId: "project", name: `Panel ${i}`,
      brand: "ide_smart", ideUuid: "u", ideUser: "a", idePassword: "p", isActive: true }));
    f.tables.accessRules = [{ _id: "rule", projectId: "project", isActive: true }];
    await invoke(runs.createRun, f.ctx, { projectId: "project" });
    const functions = f.runAfter.mock.calls.map(([, ref]) => getFunctionName(ref));
    expect(functions.sort()).toEqual(["deviceSyncRuns:executeIdeTargets", "deviceSyncRuns:expireRun", "deviceSyncRuns:refreshSummary"]);
    expect(f.tables.deviceSyncRunTargets).toHaveLength(50);
  });
  it("sends the same person once per run across overlapping rules and panels", async () => {
    const run = { _id: "run", projectId: "project", startedAt: Date.now() };
    const runQuery = vi.fn(async (ref: Ref, args: { targetId?: string; ruleId?: string }) => {
      if (getFunctionName(ref) === "deviceSyncRuns:loadTarget") {
        const id = args.targetId === "target1" ? "panel1" : "panel2";
        return { run, target: { _id: args.targetId, status: "queued" },
          device: { _id: id, brand: "ide_smart", ideUuid: "u", ideUser: "a", idePassword: "p" } };
      }
      return { employeeIds: ["employee"], deviceIds: args.ruleId === "rule1" ? ["panel1"] : ["panel1", "panel2"] };
    });
    const runAction = vi.fn(async (_ref: Ref, _args: object) => ({ ok: true, queued: 2, skipped: [], opIds: [] }));
    const runMutation = vi.fn(async (_ref: Ref, _args: object) => null);
    await invoke(runs.executeIdeTargets, { runQuery, runAction, runMutation }, { targetIds: ["target1", "target2"], ruleIds: ["rule1", "rule2"] });
    const employeeCalls = runAction.mock.calls.filter(call => getFunctionName(call[0]) === "actions/ideGatewayDevice:syncEmployeeToIdePanels");
    expect(employeeCalls).toHaveLength(1);
    expect(employeeCalls[0]).toEqual([expect.anything(), { employeeId: "employee", runId: "run", targetDeviceIds: ["panel1", "panel2"] }]);
    expect(runMutation).toHaveBeenCalledTimes(2);
    expect(runMutation.mock.calls).toEqual([
      [expect.anything(), { targetId: "target1", failure: undefined, skipped: undefined }],
      [expect.anything(), { targetId: "target2", failure: undefined, skipped: undefined }],
    ]);
  });
  it("rule history uses its own index and rejects foreign projects", async () => {
    const f = memory();
    f.tables.accessRules = [{ _id: "rule", projectId: "project" }];
    f.run.ruleId = "rule";
    f.tables.deviceSyncRuns.push({ ...f.run, _id: "foreign", projectId: "other" });
    const result = await invoke<Row[]>(runs.listRecent, f.ctx, { projectId: "project", ruleId: "rule" });
    expect(result.map(row => row._id)).toEqual(["run"]);
    expect(f.indexes).toContain("by_rule_started");
    f.tables.accessRules[0].projectId = "other";
    await expect(invoke(runs.listRecent, f.ctx, { projectId: "project", ruleId: "rule" })).rejects.toThrow("Kural bu projeye ait değil");
  });
});
