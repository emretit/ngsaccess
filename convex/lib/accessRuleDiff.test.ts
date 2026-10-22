import { describe, expect, it } from "vitest";
import { applyRelationDiff, assertLegacyRuleReplacement, buildRelationDiff, retainedDiffDoorIds, ruleDiffSyncPlan } from "./accessRuleDiff";

describe("rule editor explicit relation intent", () => {
  it("preserves another admin's addition while an old editor saves", () => {
    const opening = ["a", "b"];
    const intent = buildRelationDiff(opening, ["b", "d"]);
    expect(intent).toEqual({ added: ["d"], removed: ["a"] });
    expect(applyRelationDiff(["a", "b", "concurrent"], intent)).toEqual(["b", "concurrent", "d"]);
  });
  it("an unchanged partial snapshot cannot remove unseen members", () => {
    expect(applyRelationDiff(["a", "unseen"], buildRelationDiff(["a"], ["a"]))).toEqual(["a", "unseen"]);
  });
  it("does not re-add a member another admin removed when the editor never touched it", () => {
    expect(applyRelationDiff(["b"], buildRelationDiff(["a", "b"], ["a", "b", "c"]))).toEqual(["b", "c"]);
  });
  it("applies the same preservation rule to panel and door ids", () => {
    for (const kind of ["panel", "door"]) {
      expect(applyRelationDiff([`${kind}1`, `${kind}2`], { added: [`${kind}3`], removed: [`${kind}1`] })).toEqual([`${kind}2`, `${kind}3`]);
    }
  });
  it("deduplicates ids and repeated requests are idempotent", () => {
    const intent = { added: ["b", "b"], removed: ["a", "a"] };
    const first = applyRelationDiff(["a", "c"], intent);
    expect(applyRelationDiff(first, intent)).toEqual(["c", "b"]);
  });
  it("rejects contradictory intent", () => {
    expect(() => applyRelationDiff(["a"], { added: ["b"], removed: ["b"] })).toThrow("RULE_DIFF_CONFLICT");
  });
});

describe("legacy replacement safety", () => {
  it("accepts complete snapshots up to the inclusive limits", () => {
    expect(() => assertLegacyRuleReplacement({ members: 100, devices: 50, doors: 50 })).not.toThrow();
  });
  it.each([{ members: 101, devices: 0, doors: 0 }, { members: 0, devices: 51, doors: 0 }, { members: 0, devices: 0, doors: 51 }])("rejects any truncated relation without applying replacement: %j", counts => {
    expect(() => assertLegacyRuleReplacement(counts)).toThrow("RULE_MEMBERS_TRUNCATED");
  });
});

describe("diff sync work", () => {
  const base = { live: ["a", "concurrent"], next: ["concurrent", "b"], scopeChanged: false, settingsChanged: false, activeChanged: false };
  it("sends only new members and revokes only removed members for membership edits", () => {
    expect(ruleDiffSyncPlan(base)).toEqual({ added: ["b"], removed: ["a"], syncMembers: ["b"], syncRule: false, reconcileRoster: false });
  });
  it("does no redundant work for repeated/no-op membership changes", () => {
    expect(ruleDiffSyncPlan({ ...base, next: base.live })).toEqual({ added: [], removed: [], syncMembers: [], syncRule: false, reconcileRoster: false });
  });
  it.each(["scopeChanged", "activeChanged"] as const)("refreshes all survivors including concurrent members when %s", key => {
    expect(ruleDiffSyncPlan({ ...base, [key]: true })).toMatchObject({ syncMembers: ["concurrent", "b"], syncRule: true, reconcileRoster: true });
  });
  it("keeps plan sync for schedule changes without separately resending unchanged members", () => {
    expect(ruleDiffSyncPlan({ ...base, next: base.live, settingsChanged: true })).toMatchObject({ syncMembers: [], syncRule: true, reconcileRoster: false });
  });
});

// Exercise the actual handlers with an in-memory transaction surface; no live DB/device work.
import { vi } from "vitest";
import { type FunctionArgs, type FunctionReturnType } from "convex/server";
import { getDetails, updateWithGroups } from "../accessRules";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

const graph = vi.hoisted(() => ({ removed: vi.fn(), roster: vi.fn(), tracked: vi.fn(async () => "run") }));
vi.mock("../deviceSyncRuns", () => ({ createRuleDiffRun: graph.tracked }));
vi.mock("./customFunctions", () => {
  const register = (definition: { handler: unknown }) => ({ _handler: definition.handler });
  return { adminQuery: register, adminMutation: register, authedAction: register, authedMutation: register, authedQuery: register };
});
vi.mock("./auth", () => ({ getProjectIdsForUser: async () => ["project"] }));
vi.mock("./projectScope", () => ({ resolveProjectScope: async () => ["project"] }));
vi.mock("./accessScopeRelations", () => ({ validateRuleAccessRelations: async () => undefined, validateAccessRelations: async () => undefined }));
vi.mock("./accessGraph", () => ({
  resolveRuleIdeDeviceIds: async () => ["panel"],
  reconcileRemovedEmployeeIde: graph.removed,
  reconcilePanelRosterIde: graph.roster,
}));
const updateHandler = (updateWithGroups as unknown as {
  _handler: (ctx: MutationCtx, args: FunctionArgs<typeof api.accessRules.updateWithGroups>) => Promise<Id<"accessRules">>;
})._handler;
const detailsHandler = (getDetails as unknown as {
  _handler: (ctx: QueryCtx, args: FunctionArgs<typeof api.accessRules.getDetails>) => Promise<FunctionReturnType<typeof api.accessRules.getDetails>>;
})._handler;
const ruleId = "rule" as Id<"accessRules">;
const employeeId = (value: string) => value as Id<"employees">;
const emptyDiff = () => ({ employees: { added: [] as Id<"employees">[], removed: [] as Id<"employees">[] }, devices: { added: [] as Id<"devices">[], removed: [] as Id<"devices">[] }, doors: { added: [] as Id<"doors">[], removed: [] as Id<"doors">[] } });

type FakeRow = { _id: string; employeeId?: string; deviceId?: string; doorId?: string };
function transaction(memberIds: string[], deviceCount = 0, doorCount = 0) {
  graph.removed.mockClear(); graph.roster.mockClear(); graph.tracked.mockClear();
  const rule = { _id: ruleId, projectId: "project", name: "Rule", days: ["Monday"], targetType: "individual", isActive: true, hikWeekPlanNo: 2 as number | undefined };
  const rows: Record<string, FakeRow[]> = {
    groupMembers: memberIds.map(id => ({ _id: `member-${id}`, employeeId: id })),
    groupDevices: Array.from({ length: deviceCount }, (_, i) => ({ _id: `link-device-${i}`, deviceId: `device-${i}` })),
    groupDoors: Array.from({ length: doorCount }, (_, i) => ({ _id: `link-door-${i}`, doorId: `door-${i}` })),
    doors: [],
  };
  const take = vi.fn(); const collect = vi.fn();
  const db = {
    get: vi.fn(async (id: string) => id === ruleId ? { ...rule } : { _id: id, projectId: "project", name: id, firstName: id, lastName: "Test", isActive: true, brand: "ide_smart" }),
    query: (table: string) => {
      const q = {
        withIndex: () => q,
        take: async (limit: number) => { take(table, limit); return (rows[table] ?? []).slice(0, limit); },
        collect: async () => { collect(table); return [...(rows[table] ?? [])]; },
      };
      return q;
    },
    patch: vi.fn(async (_id: string, patch: Record<string, unknown>) => { Object.assign(rule, patch); }),
    delete: vi.fn(async (id: string) => { for (const table of Object.keys(rows)) rows[table] = rows[table].filter(row => row._id !== id); }),
    insert: vi.fn(async (table: string, row: FakeRow) => { rows[table].push({ ...row, _id: `new-${rows[table].length}` }); }),
  };
  const runAfter = vi.fn(async () => undefined);
  return { ctx: { db, user: { _id: "admin" }, scheduler: { runAfter } } as unknown as MutationCtx, db, rule, rows, take, collect, runAfter };
}

describe("actual updateWithGroups transaction contract", () => {
  it("writes only the opening snapshot diff and preserves a concurrent addition's existing row", async () => {
    const tx = transaction(["a", "b", "concurrent"]);
    const diff = emptyDiff();
    diff.employees = buildRelationDiff([employeeId("a"), employeeId("b")], [employeeId("b"), employeeId("new")]);
    await updateHandler(tx.ctx, { ruleId, relationDiff: diff });
    expect(tx.rows.groupMembers.map(row => row.employeeId)).toEqual(["b", "concurrent", "new"]);
    expect(tx.db.delete.mock.calls).toEqual([["member-a"]]);
    expect(tx.db.insert).toHaveBeenCalledTimes(1);
    expect(tx.runAfter).not.toHaveBeenCalled();
    expect(graph.tracked).toHaveBeenCalledWith(tx.ctx, expect.objectContaining({
      ruleId, startedBy: "admin", plan: { added: ["new"], removed: ["a"], syncMembers: ["new"], syncRule: false, reconcileRoster: false },
    }));
    expect(graph.removed).not.toHaveBeenCalled(); expect(graph.roster).not.toHaveBeenCalled();
  });
  it("rejects a legacy truncated replacement before writes, full scans or schedules", async () => {
    const tx = transaction(Array.from({ length: 101 }, (_, i) => `person-${i}`));
    await expect(updateHandler(tx.ctx, { ruleId, name: "unsafe", employeeIds: [] })).rejects.toThrow("RULE_MEMBERS_TRUNCATED");
    expect(tx.db.patch).not.toHaveBeenCalled(); expect(tx.db.delete).not.toHaveBeenCalled();
    expect(tx.db.insert).not.toHaveBeenCalled(); expect(tx.runAfter).not.toHaveBeenCalled();
    expect(tx.collect).not.toHaveBeenCalled();
  });
  it.each([[51, 0], [0, 51]])("guards legacy scope truncation (%i panels, %i doors)", async (devices, doors) => {
    const tx = transaction(["a"], devices, doors);
    await expect(updateHandler(tx.ctx, { ruleId, deviceIds: [], doorIds: [] })).rejects.toThrow("RULE_MEMBERS_TRUNCATED");
    expect(tx.db.patch).not.toHaveBeenCalled(); expect(tx.db.delete).not.toHaveBeenCalled();
  });
  it("keeps legacy complete-list replacement available for small rules", async () => {
    const tx = transaction(["a", "b"]);
    await updateHandler(tx.ctx, { ruleId, employeeIds: [employeeId("b")] });
    expect(tx.rows.groupMembers.map(row => row.employeeId)).toEqual(["b"]);
    expect(tx.runAfter).toHaveBeenCalled();
  });
  it("rejects mixed modes and conflicting diffs before a write", async () => {
    const tx = transaction(["a"]);
    await expect(updateHandler(tx.ctx, { ruleId, employeeIds: [], relationDiff: emptyDiff() })).rejects.toThrow("RULE_DIFF_MIXED_MODE");
    const diff = emptyDiff(); diff.employees = { added: [employeeId("a")], removed: [employeeId("a")] };
    await expect(updateHandler(tx.ctx, { ruleId, relationDiff: diff })).rejects.toThrow("RULE_DIFF_CONFLICT");
    expect(tx.db.patch).not.toHaveBeenCalled(); expect(tx.db.delete).not.toHaveBeenCalled();
  });
  it("does not resend anyone for an unchanged diff", async () => {
    const tx = transaction(["a", "concurrent"]);
    await updateHandler(tx.ctx, { ruleId, relationDiff: emptyDiff() });
    expect(tx.db.delete).not.toHaveBeenCalled(); expect(tx.db.insert).not.toHaveBeenCalled();
    expect(tx.runAfter).not.toHaveBeenCalled(); expect(graph.removed).not.toHaveBeenCalled();
  });
  it("preserves visitor memberships even if employee changes were supplied", async () => {
    const tx = transaction(["visitor"]); tx.rule.targetType = "visitor";
    const diff = emptyDiff(); diff.employees.removed = [employeeId("visitor")];
    await updateHandler(tx.ctx, { ruleId, relationDiff: diff });
    expect(tx.rows.groupMembers.map(row => row.employeeId)).toEqual(["visitor"]);
    expect(tx.db.delete).not.toHaveBeenCalled();
  });
  it("retains rule schedule sync with a diff request", async () => {
    const tx = transaction(["a"]);
    await updateHandler(tx.ctx, { ruleId, days: ["Tuesday"], relationDiff: emptyDiff() });
    expect(graph.tracked).toHaveBeenCalledWith(tx.ctx, expect.objectContaining({ plan: expect.objectContaining({ syncRule: true, syncMembers: [] }) }));
  });
});

describe("actual getDetails bounded reads", () => {
  it("returns a capped member preview and truthful overflow flag without collect", async () => {
    const tx = transaction(Array.from({ length: 101 }, (_, i) => `person-${i}`));
    const result = await detailsHandler(tx.ctx, { ruleId });
    expect(result.groupMembers).toHaveLength(100); expect(result.membersTruncated).toBe(true);
    expect(tx.take.mock.calls).toContainEqual(["groupMembers", 101]);
    expect(tx.collect).not.toHaveBeenCalled();
  });
  it("marks omitted panel/door lists as truncated when scope cannot be reconstructed", async () => {
    const tx = transaction([], 51, 2);
    const result = await detailsHandler(tx.ctx, { ruleId });
    expect(result.scopeTruncated).toBe(true); expect(result.devicesTruncated).toBe(true); expect(result.doorsTruncated).toBe(false);
    expect(tx.take.mock.calls).toContainEqual(["groupDevices", 51]);
    expect(tx.take.mock.calls).toContainEqual(["groupDoors", 51]);
    expect(tx.collect).not.toHaveBeenCalled();
  });
});

describe("diff scope propagation", () => {
  it("preserves concurrent door relationships when the editor only removed a panel", async () => {
    const tx = transaction(["a", "concurrent"], 1, 1);
    const diff = emptyDiff(); diff.devices.removed = ["device-0" as Id<"devices">];
    await updateHandler(tx.ctx, { ruleId, relationDiff: diff });
    expect(tx.rows.groupDevices).toEqual([]);
    expect(tx.rows.groupDoors).toHaveLength(1);
    expect(tx.db.delete.mock.calls).toEqual([["link-device-0"]]);
    expect(graph.tracked).toHaveBeenCalledWith(tx.ctx, expect.objectContaining({ plan: expect.objectContaining({ syncMembers: ["a", "concurrent"], reconcileRoster: true }) }));
  });
  it("resends every surviving member to newly added panels, including concurrent members", async () => {
    const tx = transaction(["a", "concurrent"]);
    const diff = emptyDiff(); diff.devices.added = ["new-panel" as Id<"devices">];
    await updateHandler(tx.ctx, { ruleId, relationDiff: diff });
    expect(tx.rows.groupDevices.map(row => row.deviceId)).toEqual(["new-panel"]);
    expect(graph.tracked).toHaveBeenCalledWith(tx.ctx, expect.objectContaining({ plan: expect.objectContaining({ syncMembers: ["a", "concurrent"], reconcileRoster: true }) }));
    expect(graph.roster).not.toHaveBeenCalled();
  });
  it("reconciles previous panels and resends surviving members when active state changes", async () => {
    const tx = transaction(["a", "concurrent"]);
    await updateHandler(tx.ctx, { ruleId, isActive: false, relationDiff: emptyDiff() });
    expect(graph.tracked).toHaveBeenCalledWith(tx.ctx, expect.objectContaining({ plan: expect.objectContaining({ syncMembers: ["a", "concurrent"], reconcileRoster: true }) }));
    expect(graph.roster).not.toHaveBeenCalled();
  });
});


describe("review regressions", () => {
  it("assigns a missing week plan on member addition without selecting unchanged people", () => {
    expect(ruleDiffSyncPlan({ live: ["old"], next: ["old", "new"], scopeChanged: false, settingsChanged: false, activeChanged: false, missingWeekPlan: true }))
      .toMatchObject({ syncRule: true, syncMembers: ["new"] });
    expect(ruleDiffSyncPlan({ live: ["old"], next: ["old"], scopeChanged: false, settingsChanged: false, activeChanged: false, missingWeekPlan: true }))
      .toMatchObject({ syncRule: false, syncMembers: [] });
  });
  it("removes stale and concurrently inserted old door links but keeps explicitly added doors", () => {
    const devices = new Map([["old", "removed"], ["concurrent", "removed"], ["added", "removed"], ["other", "kept"]]);
    expect(retainedDiffDoorIds(["old", "concurrent", "added", "other"], devices, new Set(["removed"]), new Set(["added"])))
      .toEqual(["added", "other"]);
  });
  it("uses live door ownership and preserves an explicit addition in the actual save", async () => {
    const tx = transaction([], 1, 2);
    const originalGet = tx.db.get.getMockImplementation();
    if (!originalGet) throw new Error("Missing fixture implementation");
    tx.db.get.mockImplementation(async (id: string) => {
      const row = await originalGet(id);
      return { ...row, deviceId: id.startsWith("door-") ? "device-0" : undefined };
    });
    const diff = emptyDiff();
    diff.devices.removed = ["device-0" as Id<"devices">];
    diff.doors.added = ["door-1" as Id<"doors">];
    await updateHandler(tx.ctx, { ruleId, relationDiff: diff });
    expect(tx.rows.groupDoors.map(row => row.doorId)).toEqual(["door-1"]);
    expect(tx.db.delete.mock.calls).toContainEqual(["link-door-0"]);
    expect(tx.db.delete.mock.calls).not.toContainEqual(["link-door-1"]);
  });
  it("reports each relationship's own truncation limit", async () => {
    const tx = transaction([], 2, 51);
    const result = await detailsHandler(tx.ctx, { ruleId });
    expect(result.devicesTruncated).toBe(false);
    expect(result.doorsTruncated).toBe(true);
  });
});
