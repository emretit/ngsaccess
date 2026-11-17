// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

const modules = import.meta.glob("./**/*.ts");
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-11T10:00:00Z")); });
afterEach(() => vi.useRealTimers());
async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "Proje" });
    const otherProjectId = await ctx.db.insert("projects", { name: "Diğer" });
    const companyId = await ctx.db.insert("companies", { name: "Şirket", projectId });
    const userId = await ctx.db.insert("users", { role: "project_user", verified: true });
    await ctx.db.insert("userProjects", { userId, projectId, role: "admin" });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 86400000 });
    const a = await ctx.db.insert("departments", { name: "A", projectId, companyId });
    const b = await ctx.db.insert("departments", { name: "B", projectId, companyId });
    const child = await ctx.db.insert("departments", { name: "Alt", projectId, companyId, parentId: a });
    const foreign = await ctx.db.insert("departments", { name: "Yabancı", projectId: otherProjectId });
    const now = new Date().toISOString();
    const deviceId = await ctx.db.insert("devices", { name: "Panel", projectId, brand: "hikvision", hikTransport: "gateway", hikDevIndex: "test", isActive: true, createdAt: now, updatedAt: now });
    return { projectId, a, b, child, foreign, deviceId, userId, sessionId };
  });
  const caller = t.withIdentity({ subject: `${ids.userId}|${ids.sessionId}` });
  let card = 1000;
  const person = (departmentId: Id<"departments">, extra: { accessRuleId?: Id<"accessRules">; isActive?: boolean } = {}) => caller.mutation(api.employees.create, {
    firstName: "Ada", lastName: "Test", email: "", cardNumber: String(++card), projectId: ids.projectId, departmentId, ...extra,
  });
  const rule = (departmentId: Id<"departments">, includeChildren = true, employeeIds: Id<"employees">[] = []) => caller.mutation(api.accessRules.createWithGroups, {
    name: "Departman", projectId: ids.projectId, targetType: "individual", days: ["Monday"], deviceIds: [ids.deviceId], employeeIds,
    departmentSelections: [{ departmentId, includeChildren }],
  });
  const members = (groupId: Id<"accessRules">) => t.run(ctx => ctx.db.query("groupMembers").withIndex("by_group", q => q.eq("groupId", groupId)).collect());
  return { t, ids, caller, person, rule, members };
}

describe("dynamic department access", () => {
  it("keeps an empty department selection and enrolls future people on create", async () => {
    const f = await fixture();
    const ruleId = await f.rule(f.ids.a);
    expect(await f.members(ruleId)).toHaveLength(0);
    const id = await f.person(f.ids.a);
    expect(await f.members(ruleId)).toMatchObject([{ employeeId: id, source: "department" }]);
    expect((await f.caller.query(api.accessRules.getDetails, { ruleId, projectId: f.ids.projectId })).departmentSelections).toMatchObject([{ departmentId: f.ids.a, includeChildren: true, name: "A" }]);
  });

  it("revokes only inherited membership and preserves explicit and other-rule access", async () => {
    const f = await fixture();
    const inherited = await f.person(f.ids.a);
    const manual = await f.person(f.ids.a);
    const ruleId = await f.rule(f.ids.a, true, [manual]);
    const otherRule = await f.rule(f.ids.b, true, [inherited]);
    await f.caller.mutation(api.employees.bulkUpdateDepartment, { employeeIds: [inherited, manual], departmentId: f.ids.b });
    expect(await f.members(ruleId)).toMatchObject([{ employeeId: manual, source: "manual" }]);
    expect((await f.members(otherRule)).map(member => member.employeeId).sort()).toEqual([inherited, manual].sort());
    const jobs = await f.t.run(ctx => ctx.db.system.query("_scheduled_functions").collect());
    expect(jobs.filter(job => job.name === "actions/hikvisionSync:deleteEmployeeFromDevicesInternal")).toHaveLength(0);
  });

  it("queues removal from a device only when the person's last rule is lost", async () => {
    const f = await fixture();
    const id = await f.person(f.ids.a);
    const ruleId = await f.rule(f.ids.a);
    await f.caller.mutation(api.employees.update, { employeeId: id, departmentId: f.ids.b });
    expect(await f.members(ruleId)).toHaveLength(0);
    const jobs = await f.t.run(ctx => ctx.db.system.query("_scheduled_functions").collect());
    expect(jobs).toContainEqual(expect.objectContaining({ name: "actions/hikvisionSync:deleteEmployeeFromDevicesInternal", args: [expect.objectContaining({ employeeId: id, snapshot: expect.objectContaining({ devices: [expect.objectContaining({ _id: f.ids.deviceId })] }) })] }));
  });

  it("follows child department moves and distinguishes direct-only rules", async () => {
    const f = await fixture();
    const id = await f.person(f.ids.child);
    const recursive = await f.rule(f.ids.a, true);
    const direct = await f.rule(f.ids.a, false);
    expect((await f.members(recursive)).map(member => member.employeeId)).toEqual([id]);
    expect(await f.members(direct)).toHaveLength(0);
    await f.caller.mutation(api.departments.update, { departmentId: f.ids.child, parentId: f.ids.b });
    expect(await f.members(recursive)).toHaveLength(0);
  });

  it("removes department selections through tracked diff saves while retaining manual links", async () => {
    const f = await fixture();
    const inherited = await f.person(f.ids.a);
    const manual = await f.person(f.ids.a);
    const ruleId = await f.rule(f.ids.a, true, [manual]);
    const empty = { added: [], removed: [] };
    await f.caller.mutation(api.accessRules.updateWithGroupsTracked, {
      ruleId, departmentSelections: [], relationDiff: { employees: empty, devices: empty, doors: empty },
    });
    expect((await f.members(ruleId)).map(member => member.employeeId)).toEqual([manual]);
    expect((await f.members(ruleId)).some(member => member.employeeId === inherited)).toBe(false);
  });

  it("never infers a dynamic selection from legacy manual membership", async () => {
    const f = await fixture();
    const id = await f.person(f.ids.a);
    const ruleId = await f.caller.mutation(api.accessRules.createWithGroups, { name: "Eski", projectId: f.ids.projectId, days: ["Monday"], employeeIds: [id], deviceIds: [f.ids.deviceId] });
    const newcomer = await f.person(f.ids.a);
    await f.caller.mutation(api.employees.update, { employeeId: id, departmentId: f.ids.b });
    expect((await f.members(ruleId)).map(member => member.employeeId)).toEqual([id]);
    expect((await f.members(ruleId)).some(member => member.employeeId === newcomer)).toBe(false);
  });

  it("rejects cross-project and visitor department selections transactionally", async () => {
    const f = await fixture();
    await expect(f.rule(f.ids.foreign)).rejects.toThrow("bu projede");
    await expect(f.caller.mutation(api.accessRules.createWithGroups, { name: "Ziyaret", projectId: f.ids.projectId, targetType: "visitor", days: ["Monday"], departmentSelections: [{ departmentId: f.ids.a, includeChildren: true }] })).rejects.toThrow("Ziyaretçi kuralına");
    expect(await f.t.run(ctx => ctx.db.query("accessRules").collect())).toHaveLength(0);
  });

  it("can explicitly preserve inherited access as a manual assignment", async () => {
    const f = await fixture();
    const ruleId = await f.rule(f.ids.a);
    const id = await f.person(f.ids.a);
    await f.caller.mutation(api.employees.update, { employeeId: id, accessRuleId: ruleId });
    await f.caller.mutation(api.employees.update, { employeeId: id, departmentId: f.ids.b });
    expect(await f.members(ruleId)).toMatchObject([{ employeeId: id, source: "manual" }]);
  });

  it("preserves an explicit assignment made in the same update as department departure", async () => {
    const f = await fixture();
    const ruleId = await f.rule(f.ids.a);
    const id = await f.person(f.ids.a);
    await f.caller.mutation(api.employees.update, { employeeId: id, departmentId: f.ids.b, accessRuleId: ruleId });
    expect(await f.members(ruleId)).toMatchObject([{ employeeId: id, source: "manual" }]);
    const jobs = await f.t.run(ctx => ctx.db.system.query("_scheduled_functions").collect());
    expect(jobs.filter(job => job.name === "actions/hikvisionSync:deleteEmployeeFromDevicesInternal")).toHaveLength(0);
  });
});
