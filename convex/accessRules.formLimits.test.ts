// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, expect, it, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
afterEach(() => vi.useRealTimers());

async function fixture(memberCount: number) {
  vi.useFakeTimers();
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "Form sınırları" });
    const userId = await ctx.db.insert("users", { role: "super_admin", verified: true });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 86400000 });
    const ruleId = await ctx.db.insert("accessRules", { projectId, name: "Mevcut kural", isActive: true, hikWeekPlanNo: 2, idePermissionNo: 10 });
    for (const brand of ["ide_smart", "hikvision"] as const) {
      const deviceId = await ctx.db.insert("devices", {
        projectId, name: brand, brand, isActive: true, status: "online", createdAt: "", updatedAt: "",
        ...(brand === "ide_smart" ? { ideUuid: "123456789012345", ideUser: "test", idePassword: "test" } : { hikDevIndex: "test", hikTransport: "gateway" as const, hikLastSeenAt: Date.now() }),
      });
      await ctx.db.insert("groupDevices", { projectId, groupId: ruleId, deviceId, createdAt: "" });
    }
    const employeeIds = [];
    for (let i = 0; i < memberCount; i++) {
      const employeeId = await ctx.db.insert("employees", { projectId, firstName: "Üye", lastName: String(i), email: `${i}@example.test`, cardNumber: String(1000 + i), isActive: true });
      await ctx.db.insert("groupMembers", { projectId, groupId: ruleId, employeeId, createdAt: "" });
      employeeIds.push(employeeId);
    }
    return { projectId, ruleId, employeeIds, userId, sessionId };
  });
  const snapshot = () => t.run(async ctx => ({
    rule: await ctx.db.get(ids.ruleId),
    members: await ctx.db.query("groupMembers").collect(),
    employees: await ctx.db.query("employees").collect(),
    grants: await ctx.db.query("accessGrantStatus").collect(),
    devices: await ctx.db.query("groupDevices").collect(),
    doors: await ctx.db.query("groupDoors").collect(),
    runs: await ctx.db.query("deviceSyncRuns").collect(),
    targets: await ctx.db.query("deviceSyncRunTargets").collect(),
    hikOperations: await ctx.db.query("hikPendingOperations").collect(),
    ideOperations: await ctx.db.query("idePendingOperations").collect(),
    jobs: await ctx.db.system.query("_scheduled_functions").collect(),
  }));
  return { ...ids, snapshot, caller: t.withIdentity({ subject: `${ids.userId}|${ids.sessionId}` }) };
}

it.each([101, 600])("Y-02 form guard: legacy %i-member replacement is rejected without writes or jobs", async count => {
  const f = await fixture(count);
  const before = await f.snapshot();
  await expect(f.caller.mutation(api.accessRules.updateWithGroups, {
    ruleId: f.ruleId, name: "Kaydedilmemeli", isActive: false,
    // A partial legacy details view must never replace the full membership list.
    employeeIds: f.employeeIds.slice(0, 100),
  })).rejects.toThrow("RULE_MEMBERS_TRUNCATED");
  expect(await f.snapshot()).toEqual(before);
  expect(before.jobs).toEqual([]);
});

it("Y-02 form guard: tracked deactivation of 600 members rolls back at the 500-member limit", async () => {
  const f = await fixture(600);
  const before = await f.snapshot();
  await expect(f.caller.mutation(api.accessRules.updateWithGroupsTracked, {
    ruleId: f.ruleId, name: "Kaydedilmemeli", isActive: false,
    relationDiff: { employees: { added: [], removed: [] }, devices: { added: [], removed: [] }, doors: { added: [], removed: [] } },
  })).rejects.toThrow("500 değişen kişi");
  expect(await f.snapshot()).toEqual(before);
  expect(before.jobs).toEqual([]);
});
