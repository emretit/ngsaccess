import { describe, expect, it, vi } from "vitest";
import { ConvexError } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import * as shifts from "./shifts";
import * as departments from "./departments";
import * as accessRules from "./accessRules";
import * as zones from "./zones";
import * as doors from "./doors";

// Keep the real scope helpers; substitute only authentication/registration and external sync.
vi.mock("./lib/customFunctions", () => {
  const register = (definition: { handler: unknown }, admin = false) => ({
    _handler: async (ctx: TestCtx, args: Record<string, unknown>) => {
      if (admin && ctx.user.role === "project_user") throw new Error("Bu işlem için yetkiniz yok");
      return (definition.handler as Handler)(ctx, args);
    },
  });
  return { adminQuery: register, authedQuery: register, authedMutation: register, authedAction: register,
    adminMutation: (definition: { handler: unknown }) => register(definition, true) };
});
vi.mock("./lib/auth", async importOriginal => {
  const original = await importOriginal<typeof import("./lib/auth")>();
  return { ...original, getProjectIdsForUser: async (ctx: TestCtx) =>
    ctx.user.role === "super_admin" ? ["own", "other"] : ctx.memberships };
});
vi.mock("./lib/accessGraph", () => ({
  resolveRuleIdeDeviceIds: vi.fn(async () => []),
  reconcileRemovedEmployeeIde: vi.fn(async () => undefined),
  reconcilePanelRosterIde: vi.fn(async () => undefined),
}));
import { reconcileRemovedEmployeeIde } from "./lib/accessGraph";
vi.mock("./deviceSyncRuns", async importOriginal => ({
  ...await importOriginal<typeof import("./deviceSyncRuns")>(),
  createRuleDiffRun: vi.fn(async () => null),
}));
import { createRuleDiffRun } from "./deviceSyncRuns";

type Row = Record<string, unknown> & { _id: string; table: string; projectId?: string };
type Role = Doc<"users">["role"];
type TestCtx = MutationCtx & { user: Doc<"users">; memberships: string[] };
type Handler = (ctx: TestCtx, args: Record<string, unknown>) => Promise<unknown>;
function handler(fn: unknown): Handler { return (fn as { _handler: Handler })._handler; }

function fixture(role: Role, projectId: string | undefined, memberships = ["own"]) {
  const rows: Row[] = [
    { _id: "target", table: "target", projectId, name: "Kayıt", startTime: "08:00", endTime: "17:00",
      employeeId: "employee", groupId: "rule", deviceId: "device", status: "pending",
      startDate: "2026-10-01", endDate: "2026-10-02" },
    { _id: "employee", table: "employees", projectId },
    { _id: "rule", table: "accessRules", projectId },
    { _id: "device", table: "devices", projectId, isActive: true, brand: "ide_smart" },
    { _id: "balance", table: "leaveBalances", employeeId: "employee", year: 2026 },
    ...memberships.map((id, i) => ({ _id: `membership-${i}`, table: "userProjects", userId: "actor", projectId: id })),
  ];
  const patch = vi.fn(); const remove = vi.fn(); const insert = vi.fn(); const schedule = vi.fn();
  const query = (table: string) => {
    const filters: [string, unknown][] = [];
    const q = { eq: (key: string, value: unknown) => { filters.push([key, value]); return q; }, lte: () => q };
    const selected = () => rows.filter(row => row.table === table && filters.every(([key, value]) => row[key] === value));
    const chain = {
      withIndex: (_name: string, index: (builder: typeof q) => unknown) => { index(q); return chain; },
      collect: async () => selected(), take: async (n: number) => selected().slice(0, n), order: () => chain,
    };
    return chain;
  };
  const ctx = { user: { _id: "actor", role }, memberships,
    db: { get: async (id: string) => rows.find(row => row._id === id) ?? null, query, patch, delete: remove, insert },
    scheduler: { runAfter: schedule },
  } as unknown as TestCtx;
  return { ctx, rows, patch, remove, insert, schedule };
}
const operations = [
  { name: "shifts.removeAssignment", fn: shifts.removeAssignment, args: { assignmentId: "target" } },
  { name: "shifts.update", fn: shifts.update, args: { shiftId: "target", name: "Yeni" } },
  { name: "shifts.remove", fn: shifts.remove, args: { shiftId: "target" } },
  { name: "departments.update", fn: departments.update, args: { departmentId: "target", name: "Yeni" } },
  { name: "departments.remove", fn: departments.remove, args: { departmentId: "target" } },
  { name: "accessRules.remove", fn: accessRules.remove, args: { ruleId: "target" } },
];
function expectNoEffects(f: ReturnType<typeof fixture>) {
  expect(f.patch).not.toHaveBeenCalled(); expect(f.remove).not.toHaveBeenCalled();
  expect(f.insert).not.toHaveBeenCalled(); expect(f.schedule).not.toHaveBeenCalled();
  expect(reconcileRemovedEmployeeIde).not.toHaveBeenCalled();
}

describe.each(operations)("$name project boundary", operation => {
  for (const role of ["project_user", "project_admin", "super_admin"] as const) {
    for (const scope of ["orphan", "own", "other", "no-membership"] as const) {
      it(`${role}: ${scope}`, async () => {
        vi.clearAllMocks();
        const f = fixture(role, scope === "orphan" ? undefined : scope === "other" ? "other" : "own", scope === "no-membership" ? [] : ["own"]);
        const allowed = role === "super_admin" || scope === "own";
        const result = handler(operation.fn)(f.ctx, operation.args);
        if (allowed) {
          await result;
          expect(f.patch.mock.calls.length + f.remove.mock.calls.length).toBeGreaterThan(0);
        } else {
          await expect(result).rejects.toThrow(); expectNoEffects(f);
        }
      });
    }
  }
});

describe("related records are checked before any effect", () => {
  for (const role of ["project_user", "project_admin"] as const) {
    for (const projectId of [undefined, "other"] as const) {
      for (const operation of operations.filter(op => op.name === "shifts.removeAssignment")) {
        it(`${operation.name}: ${role} employee ${projectId ?? "orphan"}`, async () => {
          vi.clearAllMocks(); const f = fixture(role, "own"); f.rows[1].projectId = projectId;
          await expect(handler(operation.fn)(f.ctx, operation.args)).rejects.toThrow(); expectNoEffects(f);
        });
      }
      for (const operation of operations.filter(op => op.name.startsWith("accessRules."))) {
        const relatedIds = ["device", "employee"];
        for (const id of relatedIds) {
          it(`${operation.name}: ${role} ${id} ${projectId ?? "orphan"}`, async () => {
            vi.clearAllMocks(); const f = fixture(role, "own");
            const row = f.rows.find(row => row._id === id); if (!row) throw new Error("fixture missing"); row.projectId = projectId;
            const groupId = "target";
            f.rows.push({ _id: "member-link", table: "groupMembers", groupId, employeeId: "employee", projectId: "own" },
              { _id: "device-link", table: "groupDevices", groupId, deviceId: "device", projectId: "own" });
            await expect(handler(operation.fn)(f.ctx, operation.args)).rejects.toThrow(); expectNoEffects(f);
          });
        }
        it(`${operation.name}: ${role} child ${projectId ?? "orphan"}`, async () => {
          vi.clearAllMocks(); const f = fixture(role, "own");
          const groupId = "target";
          f.rows.push({ _id: "bad-child", table: "groupDevices", groupId, deviceId: "device", projectId });
          await expect(handler(operation.fn)(f.ctx, operation.args)).rejects.toThrow(); expectNoEffects(f);
        });
      }
    }
  }
});

describe("access rule relation and sync regressions", () => {
  for (const operation of operations.filter(op => op.name.startsWith("accessRules."))) {
    for (const role of ["project_user", "project_admin", "super_admin"] as const) {
      const scopes = role === "super_admin" ? [undefined, "own"] : ["own"];
      for (const projectId of scopes) {
        it(`${operation.name}: ${role} valid linked records ${projectId ?? "orphan"}`, async () => {
          vi.clearAllMocks(); const f = fixture(role, projectId);
          const groupId = "target";
          f.rows.push({ _id: "member-link", table: "groupMembers", groupId, employeeId: "employee", projectId },
            { _id: "device-link", table: "groupDevices", groupId, deviceId: "device", projectId });
          await handler(operation.fn)(f.ctx, operation.args);
          expect(f.remove).toHaveBeenCalled(); expect(f.schedule).toHaveBeenCalled();
          expect(reconcileRemovedEmployeeIde).toHaveBeenCalled();
        });
      }
    }
    for (const role of ["project_user", "project_admin"] as const) {
      for (const projectId of [undefined, "other"] as const) {
        for (const bad of ["link", "door", "panel"] as const) {
          it(`${operation.name}: ${role} ${bad} ${projectId ?? "orphan"}`, async () => {
            vi.clearAllMocks(); const f = fixture(role, "own");
            const groupId = "target";
            f.rows.push({ _id: "door-link", table: "groupDoors", groupId, doorId: "door", projectId: bad === "link" ? projectId : "own" },
              { _id: "door", table: "doors", projectId: bad === "door" ? projectId : "own", deviceId: "device" });
            if (bad === "panel") f.rows[3].projectId = projectId;
            await expect(handler(operation.fn)(f.ctx, operation.args)).rejects.toThrow(); expectNoEffects(f);
          });
        }
      }
    }
  }
});

describe("deleted relations remain removable", () => {
  for (const operation of operations.filter(op => op.name.startsWith("accessRules."))) {
    for (const role of ["project_admin", "super_admin"] as const) {
      for (const missing of ["door", "device", "employee", "door-panel"] as const) {
        it(`${operation.name}: ${role} tolerates deleted ${missing}`, async () => {
          vi.clearAllMocks();
          const f = fixture(role, "own");
          const groupId = "target";
          f.rows.push(
            { _id: "member-link", table: "groupMembers", groupId, employeeId: "employee", projectId: "own" },
            { _id: "device-link", table: "groupDevices", groupId, deviceId: "device", projectId: "own" },
            { _id: "door-link", table: "groupDoors", groupId, doorId: "door", projectId: "own" },
            { _id: "door", table: "doors", projectId: "own", deviceId: missing === "door-panel" ? "deleted-panel" : "device" },
          );
          if (missing !== "door-panel") {
            const index = f.rows.findIndex(row => row._id === missing);
            f.rows.splice(index, 1);
          }
          f.remove.mockImplementation((id: string) => {
            const index = f.rows.findIndex(row => row._id === id);
            if (index >= 0) f.rows.splice(index, 1);
          });
          await handler(operation.fn)(f.ctx, operation.args);
          expect(f.remove).toHaveBeenCalledWith("target");
          for (const id of ["member-link", "device-link", "door-link"]) expect(f.remove).toHaveBeenCalledWith(id);
          expect(f.schedule).toHaveBeenCalled();
          expect(reconcileRemovedEmployeeIde).toHaveBeenCalled();
        });
      }
    }
  }
});

describe("zone/door creation requires an accessible project", () => {
  for (const role of ["project_user", "project_admin", "super_admin"] as const) {
    for (const operation of [{ name: "zone", fn: zones.create }, { name: "door", fn: doors.create }]) {
      for (const projectId of [undefined, "other"] as const) {
        it(`${operation.name}: ${role} rejects ${projectId ?? "missing project"} before writes`, async () => {
          vi.clearAllMocks();
          const f = fixture(role, "own");
          const args = { name: "Yeni", projectId: projectId === "other" && role === "super_admin" ? "unknown" : projectId };
          await expect(handler(operation.fn)(f.ctx, args)).rejects.toThrow();
          expectNoEffects(f);
        });
      }
      it(`${operation.name}: ${role} creates in an accessible project`, async () => {
        vi.clearAllMocks();
        const f = fixture(role, "own");
        await handler(operation.fn)(f.ctx, { name: "Yeni", projectId: "own" });
        expect(f.insert).toHaveBeenCalledWith(operation.name === "zone" ? "zones" : "doors",
          expect.objectContaining({ name: "Yeni", projectId: "own" }));
      });
    }
    for (const source of ["zone", "device", "both"] as const) {
      it(`door: ${role} derives project from ${source} for door and reader`, async () => {
        vi.clearAllMocks();
        const f = fixture(role, "own");
        f.rows.push({ _id: "zone", table: "zones", projectId: "own" });
        await handler(doors.create)(f.ctx, { name: "Yeni", zoneId: source !== "device" ? "zone" : undefined,
          deviceId: source !== "zone" ? "device" : undefined });
        expect(f.insert).toHaveBeenCalledWith("doors", expect.objectContaining({ projectId: "own" }));
        expect(f.insert).toHaveBeenCalledWith("readers", expect.objectContaining({ projectId: "own" }));
      });
    }
  }
  for (const bad of ["missing-zone", "missing-device", "orphan-zone", "orphan-device", "other-zone", "other-device", "mismatch"] as const) {
    it(`door rejects ${bad} before writes`, async () => {
      vi.clearAllMocks();
      const f = fixture("project_admin", "own", ["own", "other"]);
      f.rows.push({ _id: "zone", table: "zones", projectId: bad === "orphan-zone" ? undefined : bad === "other-zone" || bad === "mismatch" ? "other" : "own" });
      f.rows[3].projectId = bad === "orphan-device" ? undefined : bad === "other-device" ? "other" : "own";
      await expect(handler(doors.create)(f.ctx, { name: "Yeni", projectId: "own",
        zoneId: bad === "missing-zone" ? "missing" : "zone", deviceId: bad === "missing-device" ? "missing" : "device" })).rejects.toThrow();
      expectNoEffects(f);
    });
  }
  for (const role of ["project_user", "project_admin"] as const) {
    it(`${role} without project membership cannot create`, async () => {
      vi.clearAllMocks();
      const f = fixture(role, "own", []);
      for (const fn of [zones.create, doors.create]) {
        await expect(handler(fn)(f.ctx, { name: "Yeni", projectId: "own" })).rejects.toThrow();
      }
      expectNoEffects(f);
    });
  }
});

describe("door removal deletes access-rule links", () => {
  it("deletes all groupDoors for the door and preserves other doors' links", async () => {
    vi.clearAllMocks();
    const f = fixture("project_admin", "own");
    f.rows[3].brand = "hikvision";
    f.rows.push({ _id: "link-own", table: "groupDoors", doorId: "target", projectId: "own" },
      { _id: "link-legacy", table: "groupDoors", doorId: "target" },
      { _id: "link-other", table: "groupDoors", doorId: "another-door", projectId: "own" });
    f.remove.mockImplementation((id: string) => {
      const index = f.rows.findIndex(row => row._id === id);
      if (index >= 0) f.rows.splice(index, 1);
    });
    await handler(doors.remove)(f.ctx, { doorId: "target" });
    for (const id of ["link-own", "link-legacy", "target"]) expect(f.remove).toHaveBeenCalledWith(id);
    expect(f.remove).not.toHaveBeenCalledWith("link-other");
    const deleted = f.remove.mock.calls.map(([id]) => id);
    expect(deleted.indexOf("link-own")).toBeLessThan(deleted.indexOf("target"));
  });

  function linkedRuleFixture() {
    const f = fixture("project_admin", "own");
    f.rows[3].brand = "hikvision";
    f.rows.push({ _id: "link-a", table: "groupDoors", doorId: "target", groupId: "rule", projectId: "own" },
      { _id: "link-b", table: "groupDoors", doorId: "target", groupId: "rule", projectId: "own" },
      { _id: "member", table: "groupMembers", groupId: "rule", employeeId: "employee", projectId: "own" });
    f.remove.mockImplementation((id: string) => {
      const index = f.rows.findIndex(row => row._id === id);
      if (index >= 0) f.rows.splice(index, 1);
    });
    return f;
  }

  it("schedules one rule resync per linked rule after deleting the door", async () => {
    vi.clearAllMocks();
    const f = linkedRuleFixture();
    await handler(doors.remove)(f.ctx, { doorId: "target" });
    expect(f.remove).toHaveBeenCalledWith("target");
    expect(f.schedule).toHaveBeenCalledTimes(1);
    expect(f.schedule).toHaveBeenCalledWith(0, expect.anything(),
      { ruleId: "rule", memberIds: ["employee"], beforeDeviceIds: ["device"], startedBy: "actor" });
    expect(createRuleDiffRun).not.toHaveBeenCalled();
  });

  it("resync merges the delete-time snapshot so members removed meanwhile are still revoked", async () => {
    vi.clearAllMocks();
    const f = linkedRuleFixture();
    f.rows.splice(f.rows.findIndex(row => row._id === "link-a"), 2);
    await handler(doors.syncRuleAfterDoorRemoval)(f.ctx,
      { ruleId: "rule", memberIds: ["employee", "removed-meanwhile"], beforeDeviceIds: ["device"], startedBy: "actor" });
    expect(createRuleDiffRun).toHaveBeenCalledWith(f.ctx, expect.objectContaining({
      ruleId: "rule", projectId: "own", startedBy: "actor", beforeDeviceIds: ["device"],
      plan: expect.objectContaining({
        syncMembers: ["employee", "removed-meanwhile"], removed: [], syncRule: true, reconcileRoster: true,
      }),
    }));
  });

  it("resync skips quietly when the diff run hits its limits", async () => {
    vi.clearAllMocks();
    const f = linkedRuleFixture();
    vi.mocked(createRuleDiffRun).mockRejectedValueOnce(new ConvexError("Fark gönderim sınırı aşıldı"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await expect(handler(doors.syncRuleAfterDoorRemoval)(f.ctx,
      { ruleId: "rule", memberIds: ["employee"], beforeDeviceIds: ["device"], startedBy: "actor" })).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
