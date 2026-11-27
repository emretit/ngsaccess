// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import type { MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { beginGatewayGrants, getEmployeesWithDevices } from "./hikvisionSync";
import { upsertGrantStatus } from "./lib/grantStatus";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
it("gateway reservation reads each grant once, shares its device snapshot and returns the written generation", async () => {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "Reads" });
    const deviceId = await ctx.db.insert("devices", { projectId, name: "Hik", brand: "hikvision", isActive: true, createdAt: "", updatedAt: "" });
    const ruleId = await ctx.db.insert("accessRules", { projectId, name: "Rule", isActive: true });
    const employees = [];
    for (let i = 0; i < 3; i++) employees.push(await ctx.db.insert("employees", { projectId, firstName: "Person", lastName: String(i), email: "", cardNumber: String(i + 1), isActive: true }));
    const first = employees[0];
    if (!first) throw new Error("Fixture");
    await ctx.db.insert("accessGrantStatus", { projectId, employeeId: first, deviceId, state: "effective", syncGeneration: 4, ruleIds: [ruleId], updatedAt: Date.now() });
    return { projectId, deviceId, employees, first, ruleId };
  });
  const pairs = ids.employees.map(employeeId => ({ employeeId, deviceId: ids.deviceId }));
  const firstPair = pairs[0];
  if (!firstPair) throw new Error("Fixture");
  let grantReads = 0;
  let deviceReads = 0;
  const handler = (beginGatewayGrants as unknown as { _handler: (ctx: MutationCtx, args: FunctionArgs<typeof internal.hikvisionSync.beginGatewayGrants>) => Promise<FunctionReturnType<typeof internal.hikvisionSync.beginGatewayGrants>> })._handler;
  const generations = await t.run(ctx => {
    const db = new Proxy(ctx.db, { get(target, key, receiver) {
      const value: unknown = Reflect.get(target, key, receiver);
      if ((key === "query" || key === "get") && typeof value === "function") return (...args: unknown[]) => {
        if (key === "query" && args[0] === "accessGrantStatus") grantReads++;
        if (key === "get" && args[0] === ids.deviceId) deviceReads++;
        return Reflect.apply(value, target, args);
      };
      return value;
    } });
    return handler({ ...ctx, db }, { pairs: [...pairs, firstPair] });
  });
  expect(grantReads).toBe(3);
  expect(deviceReads).toBe(1);
  expect(generations.map(row => row.generation)).toEqual([5, 1, 1]);
  const grantId = generations[0]?.grantId;
  if (!grantId) throw new Error("Missing reservation token");
  const read = () => t.run(ctx => ctx.db.query("accessGrantStatus").withIndex("by_employee_device", q => q.eq("employeeId", ids.first).eq("deviceId", ids.deviceId)).unique());
  expect(await read()).toMatchObject({ state: "pending", ruleIds: [ids.ruleId], syncGeneration: 5 });
  await t.mutation(internal.hikvisionSync.finishGatewayGrants, { results: [{ projectId: ids.projectId, employeeId: ids.first, deviceId: ids.deviceId, state: "effective", expectedGeneration: 4 }] });
  expect(await read()).toMatchObject({ state: "pending", syncGeneration: 5 });
  await t.mutation(internal.hikvisionSync.finishGatewayGrants, { results: [{ projectId: ids.projectId, employeeId: ids.first, deviceId: ids.deviceId, state: "effective", expectedGeneration: 5 }] });
  expect(await read()).toMatchObject({ state: "effective", syncGeneration: 6 });
  await t.run(async ctx => {
    let completionReads = 0;
    const db = new Proxy(ctx.db, { get(target, key, receiver) {
      if (key === "query") return (table: Parameters<typeof ctx.db.query>[0]) => { if (table === "accessGrantStatus") completionReads++; return target.query(table); };
      return Reflect.get(target, key, receiver);
    } });
    await upsertGrantStatus({ ...ctx, db }, { projectId: ids.projectId, employeeId: ids.first, deviceId: ids.deviceId, state: "effective", expectedGeneration: 6, expectedGrantId: grantId });
    expect(completionReads).toBe(0);
  });
  const other = ids.employees[1];
  const otherGrantId = generations[1]?.grantId;
  if (!other || !otherGrantId) throw new Error("Fixture");
  await t.mutation(internal.hikvisionSync.finishGatewayGrants, { results: [
    { projectId: ids.projectId, employeeId: other, deviceId: ids.deviceId, state: "effective", expectedGeneration: 7, expectedGrantId: grantId },
    { projectId: ids.projectId, employeeId: other, deviceId: ids.deviceId, state: "effective", expectedGeneration: 1, expectedGrantId: otherGrantId },
  ] });
  expect(await read()).toMatchObject({ employeeId: ids.first, state: "effective", syncGeneration: 7 });
  expect(await t.run(ctx => ctx.db.get(otherGrantId))).toMatchObject({ employeeId: other, state: "effective", syncGeneration: 2 });
  expect(await t.run(ctx => ctx.db.query("auditLog").collect())).toMatchObject([{ targetTable: "accessGrantStatus", targetId: grantId, newValue: { reason: "grant_target_mismatch" } }]);
});

it("batched graph reads share rule targets while retaining inactive revocation targets", async () => {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "Snapshot reads" });
    const employees = [];
    for (let i = 0; i < 3; i++) employees.push(await ctx.db.insert("employees", { projectId, firstName: "Person", lastName: String(i), email: "", cardNumber: String(i + 1), isActive: true }));
    const activeId = await ctx.db.insert("devices", { projectId, name: "Active", brand: "hikvision", isActive: true, hikDevIndex: "active", createdAt: "", updatedAt: "" });
    const inactiveId = await ctx.db.insert("devices", { projectId, name: "Inactive", brand: "hikvision", isActive: false, hikDevIndex: "inactive", createdAt: "", updatedAt: "" });
    for (const deviceId of [activeId, inactiveId]) {
      const groupId = await ctx.db.insert("accessRules", { projectId, name: String(deviceId), isActive: deviceId === activeId });
      await ctx.db.insert("groupDevices", { projectId, groupId, deviceId, createdAt: "" });
      for (const employeeId of employees) await ctx.db.insert("groupMembers", { projectId, groupId, employeeId, createdAt: "" });
    }
    return { employees, activeId, inactiveId };
  });
  let targetReads = 0;
  const handler = (getEmployeesWithDevices as unknown as { _handler: (ctx: MutationCtx, args: FunctionArgs<typeof internal.hikvisionSync.getEmployeesWithDevices>) => Promise<FunctionReturnType<typeof internal.hikvisionSync.getEmployeesWithDevices>> })._handler;
  const data = await t.run(ctx => {
    const db = new Proxy(ctx.db, { get(target, key, receiver) {
      if (key === "query") return (table: Parameters<typeof ctx.db.query>[0]) => { if (table === "groupDevices") targetReads++; return target.query(table); };
      return Reflect.get(target, key, receiver);
    } });
    return handler({ ...ctx, db }, { employeeIds: ids.employees });
  });
  expect(targetReads).toBe(3); // Active write graph once, full snapshot graph once/rule.
  expect(data).toHaveLength(3);
  for (const row of data) {
    expect(row?.deviceRules.map(target => target.device._id)).toEqual([ids.activeId]);
    expect(row?.previousDevices.map(device => device._id)).toEqual([ids.activeId, ids.inactiveId]);
  }
  const first = ids.employees[0];
  if (!first) throw new Error("Fixture");
  const writable = await t.query(internal.hikvisionSync.getEmployeesWithDevices, { employeeIds: [first], skipUnusedSnapshot: true });
  expect(writable[0]?.previousDevices).toEqual([]);
  await t.run(ctx => ctx.db.patch(first, { isActive: false }));
  const inactive = await t.query(internal.hikvisionSync.getEmployeesWithDevices, { employeeIds: [first], skipUnusedSnapshot: true });
  expect(inactive[0]?.previousDevices.map(device => device._id)).toEqual([ids.activeId, ids.inactiveId]);
  await t.run(async ctx => {
    await ctx.db.patch(first, { isActive: true });
    for (const rule of await ctx.db.query("accessRules").collect()) await ctx.db.patch(rule._id, { isActive: false });
  });
  const targetless = await t.query(internal.hikvisionSync.getEmployeesWithDevices, { employeeIds: [first], skipUnusedSnapshot: true });
  expect(targetless[0]?.deviceRules).toEqual([]);
  expect(targetless[0]?.previousDevices.map(device => device._id)).toEqual([ids.activeId, ids.inactiveId]);
});
