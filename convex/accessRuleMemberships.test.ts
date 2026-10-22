// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { listAccessRuleMemberships } from "./lib/accessRuleRead";
import type { Doc } from "./_generated/dataModel";

const modules = import.meta.glob("./**/*.ts");
const roles = ["project_user", "project_admin", "super_admin"] as const;

async function fixture(role: Doc<"users">["role"] = "project_admin") {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "A" });
    const otherProjectId = await ctx.db.insert("projects", { name: "B" });
    const userId = await ctx.db.insert("users", { role });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 86400000 });
    const membershipId = await ctx.db.insert("userProjects", { userId, projectId });
    const ruleId = await ctx.db.insert("accessRules", { projectId, name: "Active", isActive: true, description: "Not needed" });
    const inactiveId = await ctx.db.insert("accessRules", { projectId, name: "Inactive", isActive: false });
    const legacyId = await ctx.db.insert("accessRules", { projectId, name: "Legacy" });
    const otherRuleId = await ctx.db.insert("accessRules", { projectId: otherProjectId, name: "Other", isActive: true });
    const orphanId = await ctx.db.insert("accessRules", { name: "Orphan" });
    const employeeId = await ctx.db.insert("employees", { projectId, firstName: "Ada", lastName: "Test", email: "ada@test", cardNumber: "123", isActive: true });
    const deletedEmployeeId = await ctx.db.insert("employees", { projectId, firstName: "Deleted", lastName: "Test", email: "deleted@test", cardNumber: "456", isActive: true });
    const deviceId = await ctx.db.insert("devices", { projectId, name: "Panel", brand: "hikvision", isActive: true, createdAt: "now", updatedAt: "now" });
    const deletedDeviceId = await ctx.db.insert("devices", { projectId, name: "Deleted", brand: "hikvision", isActive: true, createdAt: "now", updatedAt: "now" });
    for (const id of [employeeId, employeeId, deletedEmployeeId]) {
      await ctx.db.insert("groupMembers", { projectId, groupId: ruleId, employeeId: id, createdAt: "now" });
    }
    for (const id of [deviceId, deviceId, deletedDeviceId]) {
      await ctx.db.insert("groupDevices", { projectId, groupId: ruleId, deviceId: id, createdAt: "now" });
    }
    // Inconsistent legacy links stay excluded by the same compound indexes as list.
    await ctx.db.insert("groupMembers", { projectId: otherProjectId, groupId: ruleId, employeeId, createdAt: "now" });
    await ctx.db.insert("groupDevices", { groupId: ruleId, deviceId, createdAt: "now" });
    await ctx.db.delete(deletedEmployeeId);
    await ctx.db.delete(deletedDeviceId);
    return { projectId, otherProjectId, userId, sessionId, membershipId, ruleId, inactiveId, legacyId, otherRuleId, orphanId, employeeId, deletedEmployeeId, deviceId, deletedDeviceId };
  });
  return { t, ...ids, caller: t.withIdentity({ subject: `${ids.userId}|${ids.sessionId}` }) };
}

describe("accessRules.listMemberships", () => {
  it.each(roles)("%s has the same default and selected project scope as list", async role => {
    const f = await fixture(role);
    for (const args of [{}, { projectId: f.projectId }]) {
      const full = await f.caller.query(api.accessRules.list, args);
      const light = await f.caller.query(api.accessRules.listMemberships, args);
      expect(light).toEqual(full.map(rule => ({
        _id: rule._id,
        name: rule.name,
        ...(rule.isActive === undefined ? {} : { isActive: rule.isActive }),
        groupMembers: rule.groupMembers.map(({ employeeId }) => ({ employeeId })),
        groupDevices: rule.groupDevices.map(({ deviceId }) => ({ deviceId })),
      })));
      expect(light.map(rule => rule._id)).toEqual(
        role === "super_admin" && !("projectId" in args)
          ? [f.ruleId, f.inactiveId, f.legacyId, f.otherRuleId]
          : [f.ruleId, f.inactiveId, f.legacyId],
      );
      expect(light.some(rule => rule._id === f.orphanId)).toBe(false);
    }
  });

  it.each(roles)("%s preserves explicit foreign project authorization", async role => {
    const f = await fixture(role);
    for (const query of [api.accessRules.list, api.accessRules.listMemberships]) {
      const result = f.caller.query(query, { projectId: f.otherProjectId });
      if (role === "super_admin") expect((await result).map(rule => rule._id)).toEqual([f.otherRuleId]);
      else await expect(result).rejects.toThrow("Bu projeye erişim yetkiniz yok");
    }
  });

  it("returns exactly the consumed fields, keeping duplicate and dangling relations and optional active state", async () => {
    const f = await fixture();
    const result = await f.caller.query(api.accessRules.listMemberships, { projectId: f.projectId });
    expect(result).toEqual([
      { _id: f.ruleId, name: "Active", isActive: true,
        groupMembers: [{ employeeId: f.employeeId }, { employeeId: f.employeeId }, { employeeId: f.deletedEmployeeId }],
        groupDevices: [{ deviceId: f.deviceId }, { deviceId: f.deviceId }, { deviceId: f.deletedDeviceId }] },
      { _id: f.inactiveId, name: "Inactive", isActive: false, groupMembers: [], groupDevices: [] },
      { _id: f.legacyId, name: "Legacy", groupMembers: [], groupDevices: [] },
    ]);
  });

  it.each(["project_user", "project_admin"] as const)("%s without project memberships sees no rules, just like list", async role => {
    const f = await fixture(role);
    await f.t.run(ctx => ctx.db.delete(f.membershipId));
    for (const query of [api.accessRules.list, api.accessRules.listMemberships]) {
      await expect(f.caller.query(query, {})).resolves.toEqual([]);
      await expect(f.caller.query(query, { projectId: f.projectId })).rejects.toThrow("Bu projeye erişim yetkiniz yok");
    }
  });

  it("requires a valid authenticated session, just like list", async () => {
    const f = await fixture();
    for (const query of [api.accessRules.list, api.accessRules.listMemberships]) {
      await expect(f.t.query(query, {})).rejects.toThrow("Giriş yapmanız gerekiyor");
    }
    await f.t.run(ctx => ctx.db.delete(f.sessionId));
    for (const query of [api.accessRules.list, api.accessRules.listMemberships]) {
      await expect(f.caller.query(query, {})).rejects.toThrow("Giriş yapmanız gerekiyor");
    }
  });

  it("reads only scoped rules and relation tables, without document gets or groupDoors", async () => {
    const f = await fixture();
    await f.t.run(async ctx => {
      const user = await ctx.db.get(f.userId);
      if (!user) throw new Error("Missing test user");
      const get = vi.spyOn(ctx.db, "get");
      const query = vi.spyOn(ctx.db, "query");
      try {
        await listAccessRuleMemberships({ ...ctx, user }, { projectId: f.projectId });
        expect(get).not.toHaveBeenCalled();
        expect(query.mock.calls.map(([table]) => table)).toEqual([
          "userProjects", "accessRules", "groupMembers", "groupMembers", "groupMembers",
          "groupDevices", "groupDevices", "groupDevices",
        ]);
      } finally {
        get.mockRestore();
        query.mockRestore();
      }
    });
  });
});
