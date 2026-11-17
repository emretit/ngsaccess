// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { visitorDoorRuleName } from "./lib/visitorDoorRule";

const modules = import.meta.glob("./**/*.ts");
const now = Date.parse("2026-11-05T09:00:00Z");
const createdAt = new Date(now).toISOString();
const expires = "2026-11-05T18:00:00.000Z";

async function fixture() {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "Ziyaret" });
    const otherProjectId = await ctx.db.insert("projects", { name: "Başka" });
    // Güvenlik rolü: visitors.manage var, accessRules.manage yok.
    const userId = await ctx.db.insert("users", { role: "project_user", verified: true });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: now + 86400000 });
    await ctx.db.insert("userProjects", { userId, projectId, role: "security" });
    const deviceId = await ctx.db.insert("devices", { name: "Panel", projectId, createdAt, updatedAt: createdAt });
    const lobby = await ctx.db.insert("doors", { name: "Lobi", projectId, deviceId });
    const office = await ctx.db.insert("doors", { name: "Ofis", projectId, deviceId });
    const otherDeviceId = await ctx.db.insert("devices", { name: "Dış panel", projectId: otherProjectId, createdAt, updatedAt: createdAt });
    const foreign = await ctx.db.insert("doors", { name: "Dış", projectId: otherProjectId, deviceId: otherDeviceId });
    return { projectId, userId, sessionId, deviceId, lobby, office, foreign };
  });
  return { t, ...ids, caller: t.withIdentity({ subject: `${ids.userId}|${ids.sessionId}` }) };
}
afterEach(() => vi.useRealTimers());

const visitorArgs = (cardNumber: string) => ({
  firstName: "Ada", lastName: "Ziyaretçi", cardNumber, accessExpiresAt: expires, isActive: true,
});

describe("visitor door selection", () => {
  it("creates one always-open visitor rule per door set and reuses it", async () => {
    const f = await fixture();
    const first = await f.caller.mutation(api.visitors.create, { ...visitorArgs("10000001"), projectId: f.projectId, doorIds: [f.lobby] });
    const second = await f.caller.mutation(api.visitors.create, { ...visitorArgs("10000002"), projectId: f.projectId, doorIds: [f.lobby, f.lobby] });
    const third = await f.caller.mutation(api.visitors.create, { ...visitorArgs("10000003"), projectId: f.projectId, doorIds: [f.office, f.lobby] });

    const state = await f.t.run(async ctx => {
      const rules = await ctx.db.query("accessRules").withIndex("by_project", q => q.eq("projectId", f.projectId)).collect();
      const visitors = await Promise.all([first, second, third].map(id => ctx.db.get(id)));
      const members = await ctx.db.query("groupMembers").collect();
      const doorLinks = await ctx.db.query("groupDoors").collect();
      const deviceLinks = await ctx.db.query("groupDevices").collect();
      return { rules, visitors, members, doorLinks, deviceLinks };
    });
    expect(state.rules).toHaveLength(2);
    const [single, pair] = [state.visitors[0]?.accessRuleId, state.visitors[2]?.accessRuleId];
    expect(state.visitors[1]?.accessRuleId).toBe(single);
    expect(pair).not.toBe(single);
    expect(state.rules.find(rule => rule._id === single)).toMatchObject({
      name: "Ziyaretçi · Lobi", targetType: "visitor", accessDirection: "both", isActive: true,
      days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
    });
    expect(state.rules.find(rule => rule._id === pair)?.name).toBe("Ziyaretçi · Lobi, Ofis");
    expect(state.doorLinks.filter(link => link.groupId === single).map(link => link.doorId)).toEqual([f.lobby]);
    expect(state.deviceLinks.filter(link => link.groupId === pair).map(link => link.deviceId)).toEqual([f.deviceId]);
    expect(state.members.map(member => member.employeeId).sort()).toEqual([first, second, third].sort());
  });

  it("does not reuse a visitor rule with a narrower schedule", async () => {
    const f = await fixture();
    const scheduled = await f.t.run(async ctx => {
      const ruleId = await ctx.db.insert("accessRules", { projectId: f.projectId, name: "Mesai", targetType: "visitor",
        days: ["Monday"], startTime: "09:00", endTime: "17:00", isActive: true });
      await ctx.db.insert("groupDoors", { groupId: ruleId, doorId: f.lobby, deviceId: f.deviceId, projectId: f.projectId, createdAt });
      await ctx.db.insert("groupDevices", { groupId: ruleId, deviceId: f.deviceId, projectId: f.projectId, createdAt });
      return ruleId;
    });
    const id = await f.caller.mutation(api.visitors.create, { ...visitorArgs("10000004"), projectId: f.projectId, doorIds: [f.lobby] });
    expect((await f.t.run(ctx => ctx.db.get(id)))?.accessRuleId).not.toBe(scheduled);
  });

  it("rejects missing, mixed or foreign door selections without writing a rule", async () => {
    const f = await fixture();
    const base = { ...visitorArgs("10000005"), projectId: f.projectId };
    await expect(f.caller.mutation(api.visitors.create, base)).rejects.toThrow("kapıları seçin");
    await expect(f.caller.mutation(api.visitors.create, { ...base, doorIds: [] })).rejects.toThrow("en az bir kapı");
    await expect(f.caller.mutation(api.visitors.create, { ...base, doorIds: [f.foreign] })).rejects.toThrow("bu projede bulunamadı");
    const presetRuleId = await f.t.run(ctx => ctx.db.insert("accessRules", { projectId: f.projectId, name: "Şablon", targetType: "visitor" }));
    await expect(f.caller.mutation(api.visitors.create, { ...base, presetRuleId, doorIds: [f.lobby] })).rejects.toThrow("kapıları seçin");
    expect((await f.t.run(ctx => ctx.db.query("accessRules").collect())).map(rule => rule._id)).toEqual([presetRuleId]);
  });
});

it("names large door sets compactly", () => {
  expect(visitorDoorRuleName(["Ofis", "Arşiv", "Lobi", "Depo", "Çatı"])).toBe("Ziyaretçi · Arşiv, Çatı, Depo +2");
});
