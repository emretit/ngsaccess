import { describe, expect, it, vi } from "vitest";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import * as leaves from "./leaves";
import * as shifts from "./shifts";
import * as departments from "./departments";
import * as positions from "./positions";
import * as companies from "./companies";
import * as accessRules from "./accessRules";

// Keep the real scope helpers; substitute only authentication/registration and external sync.
vi.mock("./lib/customFunctions", () => {
  const register = (definition: { handler: unknown }, admin = false) => ({
    _handler: async (ctx: TestCtx, args: Record<string, unknown>) => {
      if (admin && ctx.user.role === "project_user") throw new Error("Bu işlem için yetkiniz yok");
      return (definition.handler as Handler)(ctx, args);
    },
  });
  return { authedQuery: register, authedMutation: register, authedAction: register,
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
  { name: "leaves.approve", fn: leaves.approve, args: { leaveId: "target" }, admin: true },
  { name: "leaves.reject", fn: leaves.reject, args: { leaveId: "target" }, admin: true },
  { name: "shifts.removeAssignment", fn: shifts.removeAssignment, args: { assignmentId: "target" } },
  { name: "shifts.update", fn: shifts.update, args: { shiftId: "target", name: "Yeni" } },
  { name: "shifts.remove", fn: shifts.remove, args: { shiftId: "target" } },
  { name: "departments.update", fn: departments.update, args: { departmentId: "target", name: "Yeni" } },
  { name: "departments.remove", fn: departments.remove, args: { departmentId: "target" } },
  { name: "positions.remove", fn: positions.remove, args: { positionId: "target" } },
  { name: "companies.update", fn: companies.update, args: { companyId: "target", name: "Yeni" } },
  { name: "companies.remove", fn: companies.remove, args: { companyId: "target" } },
  { name: "accessRules.remove", fn: accessRules.remove, args: { ruleId: "target" } },
  { name: "accessRules.removeGroupMember", fn: accessRules.removeGroupMember, args: { memberId: "target" } },
  { name: "accessRules.removeGroupDevice", fn: accessRules.removeGroupDevice, args: { groupDeviceId: "target" } },
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
        const allowed = role === "super_admin" || (scope === "own" && !(operation.admin && role === "project_user"));
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

describe("getBalances preserves the empty unauthorized shape", () => {
  for (const role of ["project_user", "project_admin", "super_admin"] as const) {
    for (const scope of [undefined, "own", "other"] as const) {
      it(`${role}: ${scope ?? "orphan"}`, async () => {
        vi.clearAllMocks(); const f = fixture(role, scope);
        const result = await handler(leaves.getBalances)(f.ctx, { employeeId: "employee" as Id<"employees">, year: 2026 });
        expect(result).toEqual(role === "super_admin" || scope === "own" ? [f.rows[4]] : []);
        expectNoEffects(f);
      });
    }
  }
});

describe("related records are checked before any effect", () => {
  for (const role of ["project_user", "project_admin"] as const) {
    for (const projectId of [undefined, "other"] as const) {
      for (const operation of operations.filter(op => ["leaves.approve", "leaves.reject", "shifts.removeAssignment", "accessRules.removeGroupMember"].includes(op.name))) {
        it(`${operation.name}: ${role} employee ${projectId ?? "orphan"}`, async () => {
          vi.clearAllMocks(); const f = fixture(role, "own"); f.rows[1].projectId = projectId;
          await expect(handler(operation.fn)(f.ctx, operation.args)).rejects.toThrow(); expectNoEffects(f);
        });
      }
      for (const operation of operations.filter(op => op.name.startsWith("accessRules."))) {
        const relatedIds = operation.name === "accessRules.removeGroupMember" ? ["rule", "device"] : operation.name === "accessRules.removeGroupDevice" ? ["rule", "device", "employee"] : ["device", "employee"];
        for (const id of relatedIds) {
          it(`${operation.name}: ${role} ${id} ${projectId ?? "orphan"}`, async () => {
            vi.clearAllMocks(); const f = fixture(role, "own");
            const row = f.rows.find(row => row._id === id); if (!row) throw new Error("fixture missing"); row.projectId = projectId;
            const groupId = operation.name === "accessRules.remove" ? "target" : "rule";
            f.rows.push({ _id: "member-link", table: "groupMembers", groupId, employeeId: "employee", projectId: "own" },
              { _id: "device-link", table: "groupDevices", groupId, deviceId: "device", projectId: "own" });
            await expect(handler(operation.fn)(f.ctx, operation.args)).rejects.toThrow(); expectNoEffects(f);
          });
        }
        it(`${operation.name}: ${role} child ${projectId ?? "orphan"}`, async () => {
          vi.clearAllMocks(); const f = fixture(role, "own");
          const groupId = operation.name === "accessRules.remove" ? "target" : "rule";
          f.rows.push({ _id: "bad-child", table: "groupDevices", groupId, deviceId: "device", projectId });
          if (operation.name === "accessRules.removeGroupDevice") {
            f.rows.push({ _id: "bad-member", table: "groupMembers", groupId, employeeId: "employee", projectId });
          }
          await expect(handler(operation.fn)(f.ctx, operation.args)).rejects.toThrow(); expectNoEffects(f);
        });
      }
    }
  }
  for (const fn of [leaves.approve, leaves.reject]) {
    it(`${fn === leaves.approve ? "approve requires matching projects" : "reject permits a transfer"} when both projects are accessible`, async () => {
      vi.clearAllMocks(); const f = fixture("project_admin", "own", ["own", "other"]); f.rows[1].projectId = "other";
      if (fn === leaves.approve) {
        await expect(handler(fn)(f.ctx, { leaveId: "target" })).rejects.toThrow("aynı projede"); expectNoEffects(f);
      } else {
        await handler(fn)(f.ctx, { leaveId: "target" });
        expect(f.patch).toHaveBeenCalledWith("target", expect.objectContaining({ status: "rejected" }));
      }
    });
  }
});

describe("access rule relation and sync regressions", () => {
  for (const operation of operations.filter(op => op.name.startsWith("accessRules."))) {
    for (const role of ["project_user", "project_admin", "super_admin"] as const) {
      const scopes = role === "super_admin" ? [undefined, "own"] : ["own"];
      for (const projectId of scopes) {
        it(`${operation.name}: ${role} valid linked records ${projectId ?? "orphan"}`, async () => {
          vi.clearAllMocks(); const f = fixture(role, projectId);
          const groupId = operation.name === "accessRules.remove" ? "target" : "rule";
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
            const groupId = operation.name === "accessRules.remove" ? "target" : "rule";
            f.rows.push({ _id: "door-link", table: "groupDoors", groupId, doorId: "door", projectId: bad === "link" ? projectId : "own" },
              { _id: "door", table: "doors", projectId: bad === "door" ? projectId : "own", deviceId: "device" });
            if (bad === "panel") f.rows[3].projectId = projectId;
            await expect(handler(operation.fn)(f.ctx, operation.args)).rejects.toThrow(); expectNoEffects(f);
          });
        }
      }
    }
  }
  for (const fn of [accessRules.removeGroupDevice, accessRules.removeGroupMember]) {
    it("rejects a missing parent before effects", async () => {
      vi.clearAllMocks(); const f = fixture("project_admin", "own");
      const index = f.rows.findIndex(row => row._id === "rule"); f.rows.splice(index, 1);
      await expect(handler(fn)(f.ctx, { groupDeviceId: "target", memberId: "target" })).rejects.toThrow(); expectNoEffects(f);
    });
  }
});


describe("deleted relations remain removable", () => {
  for (const operation of operations.filter(op => op.name.startsWith("accessRules."))) {
    for (const role of ["project_admin", "super_admin"] as const) {
      for (const missing of ["door", "device", "employee", "door-panel"] as const) {
        it(`${operation.name}: ${role} tolerates deleted ${missing}`, async () => {
          vi.clearAllMocks();
          const f = fixture(role, "own");
          const groupId = operation.name === "accessRules.remove" ? "target" : "rule";
          f.rows.push(
            { _id: "member-link", table: "groupMembers", groupId, employeeId: "employee", projectId: "own" },
            ...(operation.name === "accessRules.removeGroupDevice" ? [] : [
              { _id: "device-link", table: "groupDevices", groupId, deviceId: "device", projectId: "own" },
            ]),
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
          if (operation.name === "accessRules.remove") {
            for (const id of ["member-link", "device-link", "door-link"]) expect(f.remove).toHaveBeenCalledWith(id);
          }
          if (operation.name === "accessRules.removeGroupDevice" && missing === "device") {
            expect(f.remove).toHaveBeenCalledWith("door-link");
          }
          expect(f.schedule).toHaveBeenCalled();
          expect(reconcileRemovedEmployeeIde).toHaveBeenCalled();
        });
      }
    }
  }
  it("rejects member/rule project mismatch even when both projects are accessible", async () => {
    vi.clearAllMocks();
    const f = fixture("project_admin", "own", ["own", "other"]);
    f.rows[2].projectId = "other";
    await expect(handler(accessRules.removeGroupMember)(f.ctx, { memberId: "target" })).rejects.toThrow();
    expectNoEffects(f);
  });
});

describe("leave decisions after an employee project transfer", () => {
  for (const fn of [leaves.approve, leaves.reject]) {
    for (const projectId of ["other", undefined]) {
      it(`super_admin can decide an old leave after transfer to ${projectId ?? "orphan"}`, async () => {
        vi.clearAllMocks();
        const f = fixture("super_admin", "own");
        f.rows[1].projectId = projectId;
        await handler(fn)(f.ctx, { leaveId: "target" });
        expect(f.patch).toHaveBeenCalledWith("target", expect.objectContaining({
          status: fn === leaves.approve ? "approved" : "rejected",
        }));
      });
    }
    for (const scope of ["employee", "leave"] as const) {
      it(`project_admin cannot decide when ${scope} is outside scope`, async () => {
        vi.clearAllMocks();
        const f = fixture("project_admin", "own");
        f.rows[scope === "employee" ? 1 : 0].projectId = "other";
        await expect(handler(fn)(f.ctx, { leaveId: "target" })).rejects.toThrow();
        expectNoEffects(f);
      });
    }
  }
  it("project_admin can reject a transferred employee's leave with access to both projects", async () => {
    vi.clearAllMocks();
    const f = fixture("project_admin", "own", ["own", "other"]);
    f.rows[1].projectId = "other";
    await handler(leaves.reject)(f.ctx, { leaveId: "target" });
    expect(f.patch).toHaveBeenCalledWith("target", expect.objectContaining({ status: "rejected" }));
  });
});
