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
  return { adminQuery: register, authedAction: register, authedQuery: register, authedMutation: register, adminMutation: register };
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
    const bounds = { eq: (field: string, value: unknown) => { rows = rows.filter(row => row[field] === value); return bounds; }, gte: (field: string, value: number) => { rows = rows.filter(row => Number(row[field]) >= value); return bounds; } };
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


import type { Id } from "../_generated/dataModel";
import { ruleDiffSyncPlan } from "./accessRuleDiff";

describe("durable diff dispatch", () => {
  const employee = (id: string) => id as Id<"employees">;
  const runArgs = {
    ruleId: "rule" as Id<"accessRules">, projectId: "project" as Id<"projects">, startedBy: "admin" as Id<"users">,
    beforeDeviceIds: ["hik" as Id<"devices">],
  };
  it("creates no run or scheduler work for an empty diff", async () => {
    const f = memory();
    const result = await runs.createRuleDiffRun(f.ctx as unknown as MutationCtx, { ...runArgs,
      plan: { syncMembers: [], removed: [], syncRule: false, reconcileRoster: false } });
    expect(result).toBeNull();
    expect(f.tables.deviceSyncRuns).toHaveLength(1);
    expect(f.runAfter).not.toHaveBeenCalled();
  });
  it("atomically creates targets and sends only the planner's changed people", async () => {
    const f = memory();
    f.tables.devices = [
      { _id: "hik", projectId: "project", name: "Hik", brand: "hikvision", hikDevIndex: "index" },
      { _id: "ide", projectId: "project", name: "IDE", brand: "ide_smart", ideUuid: "u", ideUser: "a", idePassword: "p" },
      { _id: "offline", projectId: "project", name: "Offline", brand: "hikvision", status: "offline" },
    ];
    const plan = ruleDiffSyncPlan({ live: [employee("old"), employee("unchanged")], next: [employee("new"), employee("unchanged")],
      scopeChanged: false, settingsChanged: false, activeChanged: false });
    const id = await runs.createRuleDiffRun(f.ctx as unknown as MutationCtx, { ...runArgs, plan });
    const targets = f.tables.deviceSyncRunTargets.filter(row => row.runId === id);
    expect(targets.map(t => t.status)).toEqual(["queued", "queued", "skipped"]);
    const jobs = f.runAfter.mock.calls.filter(([, ref]) => getFunctionName(ref) === "deviceSyncRuns:executeRuleDiffTarget");
    expect(jobs).toHaveLength(2);
    for (const [, , args] of jobs) {
      expect(args).toMatchObject({ syncMembers: ["new"], removed: ["old"], syncRule: false });
      expect(args).not.toHaveProperty("added");
    }
    expect(f.tables.deviceSyncRuns.find(row => row._id === id)).toMatchObject({ ruleId: "rule", startedBy: "admin", counts: { queued: 2, skipped: 1 } });
  });

  function actionFixture(brand: "hikvision" | "ide_smart", hasAccess = true) {
    const device = { _id: "device", projectId: "project", name: "Panel", brand, hikDevIndex: "index", ideUuid: "u", ideUser: "a", idePassword: "p" };
    const runQuery = vi.fn(async (ref: Ref, args: { employeeId?: string }) => {
      switch (getFunctionName(ref)) {
        case "deviceSyncRuns:loadTarget": return { device, run: { _id: "run", projectId: "project", startedAt: Date.now() }, target: { _id: "target", status: "queued" } };
        case "hikvisionSync:getAccessRuleWithDevices": return { rule: { projectId: "project", isActive: true }, devices: [device] };
        case "deviceSyncRuns:diffIdeContext": return { authorizedCards: [], orphanCards: [] };
        case "hikvisionSync:getEmployeeWithDevices": return { employee: { _id: args.employeeId, projectId: "project", cardNumber: "123", isActive: true }, deviceRules: hasAccess ? [{ device }] : [] };
        default: throw new Error(getFunctionName(ref));
      }
    });
    const runMutation = vi.fn(async (_ref: Ref, _args: object) => 2);
    const runAction = vi.fn(async (_ref: Ref, _args: object) => ({ synced: 1, removed: 1, failed: 0, errors: [], employeesSynced: 0, ok: true, queued: 1, skipped: [] }));
    const args = { targetId: "target", ruleId: "rule", syncMembers: ["new"], removed: [], syncRule: false, reconcileRoster: false, wasRuleTarget: true };
    return { device, runQuery, runMutation, runAction, args };
  }
  it.each(["hikvision", "ide_smart"] as const)("links only the added person on %s to this run", async brand => {
    const f = actionFixture(brand);
    await invoke(runs.executeRuleDiffTarget, f, f.args);
    expect(f.runAction).toHaveBeenCalledOnce();
    expect(f.runAction.mock.calls[0][1]).toMatchObject({ employeeId: "new", runId: "run", targetDeviceIds: ["device"] });
    expect(f.runMutation.mock.calls[f.runMutation.mock.calls.length - 1]?.[1]).toMatchObject({ targetId: "target", directSent: brand === "hikvision", failure: undefined, skipped: undefined });
  });
  it.each(["hikvision", "ide_smart"] as const)("revokes former %s targets after removal and retains run evidence", async brand => {
    const f = actionFixture(brand, false);
    await invoke(runs.executeRuleDiffTarget, f, { ...f.args, syncMembers: [], removed: ["old"] });
    expect(f.runAction).toHaveBeenCalledOnce();
    const [ref, args] = f.runAction.mock.calls[0];
    expect(getFunctionName(ref)).toBe(brand === "hikvision" ? "actions/hikvisionSync:deleteEmployeeFromDevicesInternal" : "actions/ideGatewayDevice:deleteIdeUserFromPanels");
    expect(args).toMatchObject({ runId: "run" });
    if (brand === "hikvision") expect(args).toMatchObject({ snapshot: { cardNumber: "123", devices: [{ _id: "device" }] } });
    else expect(args).toMatchObject({ cardNumber: "123", deviceIds: ["device"] });
  });
  it("sends a missing plan without resending unchanged people", async () => {
    const f = actionFixture("hikvision");
    await invoke(runs.executeRuleDiffTarget, f, { ...f.args, syncRule: true });
    expect(f.runAction.mock.calls.map(([ref]) => getFunctionName(ref))).toEqual([
      "actions/hikvisionSync:syncWeekPlanToDevicesInternal", "actions/hikvisionSync:syncEmployeeToDevicesInternal",
    ]);
    expect(f.runAction.mock.calls[0][1]).toMatchObject({ targetEmployeeIds: [], runId: "run" });
    expect(f.runAction.mock.calls[1][1]).toMatchObject({ employeeId: "new" });
  });
  it("preserves an explicit device failure instead of claiming delivery", async () => {
    const f = actionFixture("hikvision");
    f.runAction.mockRejectedValueOnce(new Error("gateway unavailable"));
    await invoke(runs.executeRuleDiffTarget, f, f.args);
    expect(f.runMutation.mock.calls[f.runMutation.mock.calls.length - 1]?.[1]).toMatchObject({ failure: "gateway unavailable", directSent: true });
    const db = memory();
    await invoke(runs.finishTarget, db.ctx, { targetId: "hik-target", failure: "gateway unavailable", directSent: true });
    expect(db.targets[0]).toMatchObject({ status: "failed", reason: "gateway unavailable" });
  });
  it("uses the same full member refresh only when the scope changes", () => {
    const plan = ruleDiffSyncPlan({ live: ["unchanged", "old"], next: ["unchanged", "new"], scopeChanged: true, settingsChanged: false, activeChanged: false });
    expect(plan.syncMembers).toEqual(["unchanged", "new"]);
    expect(plan.removed).toEqual(["old"]);
    expect(plan.syncRule).toBe(true);
  });
});

import { syncEmployeeToDevicesInternal, deleteEmployeeFromDevicesInternal, syncWeekPlanToDevicesInternal } from "../actions/hikvisionSync";
import { deleteIdeUserFromPanels } from "../actions/ideGatewayDevice";

describe("diff operation correlation at the action boundary", () => {
  const device = { _id: "bridge", name: "Bridge", brand: "hikvision", projectId: "project", hikTransport: "localBridge" };
  const rule = { _id: "rule", name: "Rule", projectId: "project", hikWeekPlanNo: 2 };
  const employee = { _id: "new", cardNumber: "123", firstName: "New", lastName: "Person", projectId: "project", isActive: true };
  it("stamps plan/person operations and restricts the actual Hik employee action to the target", async () => {
    const runMutation = vi.fn(async (_ref: Ref, _args: object) => "op");
    const runQuery = vi.fn(async () => ({ employee, deviceRules: [{ device, rule }, { device: { ...device, _id: "other" }, rule }] }));
    await invoke(syncEmployeeToDevicesInternal, { runQuery, runMutation }, { employeeId: "new", runId: "run", targetDeviceIds: ["bridge"] });
    const writes = runMutation.mock.calls.filter(([ref]) => getFunctionName(ref) === "hikvisionSync:enqueueLocalBridgeOperation");
    expect(writes.map(([, args]) => args)).toEqual([
      expect.objectContaining({ deviceId: "bridge", operation: "syncWeekPlan", runId: "run" }),
      expect.objectContaining({ deviceId: "bridge", operation: "addPerson", runId: "run", payload: expect.objectContaining({ employeeId: "new" }) }),
    ]);
  });
  it("stamps the actual Hik delete queue operation using the former-target snapshot", async () => {
    const runMutation = vi.fn(async (_ref: Ref, _args: object) => "op");
    await invoke(deleteEmployeeFromDevicesInternal, { runMutation }, {
      employeeId: "old", runId: "run", targetDeviceIds: ["bridge"],
      snapshot: { cardNumber: "123", projectId: "project", devices: [device] },
    });
    expect(runMutation.mock.calls[0][1]).toMatchObject({ deviceId: "bridge", operation: "deleteCard", runId: "run" });
  });
  it("plan-only diff calls avoid every employee, while omitted optional args preserve full sync", async () => {
    const runQuery = vi.fn(async (ref: Ref, args: { employeeIds?: string[] }) => getFunctionName(ref) === "hikvisionSync:getEmployeesWithDevices"
      ? args.employeeIds?.map(id => ({ employee: { ...employee, _id: id }, deviceRules: [{ device, rule }] }))
      : { rule, devices: [device], employees: [employee, { ...employee, _id: "unchanged" }] });
    const runMutation = vi.fn(async (_ref: Ref, _args: object) => "op");
    await invoke(syncWeekPlanToDevicesInternal, { runQuery, runMutation }, { accessRuleId: "rule", runId: "run", targetEmployeeIds: [] });
    const writes = () => runMutation.mock.calls.filter(([ref]) => getFunctionName(ref) === "hikvisionSync:enqueueLocalBridgeOperation").map(([, args]) => args);
    expect(writes()).toEqual([expect.objectContaining({ operation: "syncWeekPlan", runId: "run" })]);
    runMutation.mockClear();
    await invoke(syncWeekPlanToDevicesInternal, { runQuery, runMutation }, { accessRuleId: "rule" });
    expect(writes()).toHaveLength(3);
    expect(runQuery.mock.calls.filter(([ref]) => getFunctionName(ref) === "hikvisionSync:getEmployeeWithDevices")).toHaveLength(0);
    expect(runQuery.mock.calls.filter(([ref]) => getFunctionName(ref) === "hikvisionSync:getEmployeesWithDevices")).toHaveLength(1);
    expect(runMutation.mock.calls.filter(([ref, args]) => getFunctionName(ref) === "hikvisionSync:resolveTargetFailures" && "employeeIds" in args)).toHaveLength(1);
    expect(writes().filter(op => "operation" in op && op.operation === "addPerson")).toHaveLength(2);
  });
  it("stamps the actual IDE orphan deletion operation", async () => {
    const runMutation = vi.fn(async (_ref: Ref, _args: object) => "op");
    const runQuery = vi.fn(async () => ({ _id: "ide", brand: "ide_smart", ideUuid: "u", projectId: "project" }));
    await invoke(deleteIdeUserFromPanels, { runQuery, runMutation }, { cardNumber: "123", deviceIds: ["ide"], runId: "run" });
    expect(runMutation.mock.calls[0][1]).toMatchObject({ deviceId: "ide", runId: "run", opType: "deleteUser", payload: { ideUserId: 123 } });
  });
});


it("finishTarget keeps bridge and IDE operations queued until evidence arrives", async () => {
  const f = memory();
  for (const targetId of ["hik-target", "ide-target"]) await invoke(runs.finishTarget, f.ctx, { targetId });
  expect(f.targets.map(target => target.status)).toEqual(["queued", "queued"]);
  await invoke(runs.refreshSummary, f.ctx, { runId: "run" });
  expect(f.targets.map(target => target.status)).toEqual(["queued", "queued"]);
  expect(f.run.status).toBe("running");
});
