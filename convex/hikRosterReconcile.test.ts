// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import schema from "./schema";
import { internal } from "./_generated/api";

const modules = import.meta.glob("./**/*.ts");
it("includes rule employees, visitors, fingerprint and queued identities only in the current project", async () => {
  const t = convexTest(schema, modules);
  const deviceId = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "Current" });
    const oldProject = await ctx.db.insert("projects", { name: "Old" });
    const userId = await ctx.db.insert("users", { name: "Operator" });
    const deviceId = await ctx.db.insert("devices", { createdAt: "now", updatedAt: "now", name: "Hik", projectId, brand: "hikvision", hikTransport: "gateway", hikDevIndex: "index", isActive: true });
    const otherDevice = await ctx.db.insert("devices", { createdAt: "now", updatedAt: "now", name: "Other", projectId, isActive: true });
    const rule = await ctx.db.insert("accessRules", { name: "Current", projectId, isActive: true });
    const inactiveRule = await ctx.db.insert("accessRules", { name: "Inactive", projectId, isActive: false });
    const otherRule = await ctx.db.insert("accessRules", { name: "Other device", projectId, isActive: true });
    const door = await ctx.db.insert("doors", { name: "Door", projectId, deviceId, hikDoorNo: 1 });
    await ctx.db.insert("groupDoors", { groupId: rule, doorId: door, projectId, deviceId, createdAt: "now" });
    await ctx.db.insert("groupDevices", { groupId: inactiveRule, deviceId, projectId, createdAt: "now" });
    await ctx.db.insert("groupDevices", { groupId: otherRule, deviceId: otherDevice, projectId, createdAt: "now" });
    for (const [cardNumber, groupId, scope, isVisitor] of [
      ["00123", rule, projectId, false], ["visitor", rule, projectId, true],
      ["foreign", rule, oldProject, false], ["inactive-rule", inactiveRule, projectId, false],
      ["other-device", otherRule, projectId, false],
    ] as const) {
      const employeeId = await ctx.db.insert("employees", { email: "", projectId: scope, firstName: "Test", lastName: "Person", cardNumber, isActive: true, isVisitor });
      await ctx.db.insert("groupMembers", { projectId, groupId, employeeId, createdAt: "now" });
    }
    const employeeId = await ctx.db.insert("employees", { email: "", projectId, firstName: "Fingerprint", lastName: "Person", cardNumber: "fp-current" });
    await ctx.db.insert("deviceFingerprintEnrollments", { projectId, deviceId, employeeId, enrolledEmployeeNo: "fp-enrolled", fingerNo: 1, enrolledAt: "now", enrolledBy: userId });
    for (const scope of [projectId, oldProject]) await ctx.db.insert("hikPendingOperations", { projectId: scope, deviceId, operation: "addPerson", payload: { employeeNo: scope === projectId ? "queued" : "foreign-queued" }, status: "pending", attemptCount: 0, createdAt: 0 });
    return deviceId;
  });
  const result = await t.query(internal.hikRosterReconcile.getExpectedRoster, { deviceId });
  expect(result.employeeNos?.sort()).toEqual(["00123", "fp-current", "fp-enrolled", "queued", "visitor"]);
  expect(result.skippedReason).toBeNull();
  await t.run(ctx => ctx.db.patch(deviceId, { hikTransport: "localBridge" }));
  expect(await t.query(internal.hikRosterReconcile.getExpectedRoster, { deviceId })).toMatchObject({ employeeNos: null, skippedReason: "unsupported_device" });
});

it.each([true, false])("resumes pending cleanup once on online events, already online=%s", async alreadyOnline => {
  const t = convexTest(schema, modules);
  const deviceId = await t.run(ctx => ctx.db.insert("devices", {
    name: "Hik", createdAt: "now", updatedAt: "now", brand: "hikvision",
    hikTransport: "gateway", hikDevIndex: "index", hikIsupOnline: alreadyOnline,
  }));
  await t.mutation(internal.hikRosterReconcile.markReconcilePending, { deviceId, hint: "Cleanup pending" });
  expect(await t.run(ctx => ctx.db.get(deviceId))).toMatchObject({
    hikRosterReconcilePending: true, hikOfflineHint: "Cleanup pending",
  });
  const at = Date.now();
  for (const offset of [0, 1]) await t.mutation(internal.devices.applyIsupStatus, {
    deviceId, devIndex: "index", status: "online", at: at + offset,
  });
  expect((await t.run(ctx => ctx.db.get(deviceId)))?.hikRosterReconcilePending).toBeUndefined();
  const jobs = await t.run(ctx => ctx.db.system.query("_scheduled_functions").collect());
  expect(jobs).toHaveLength(1);
  expect(jobs[0]).toMatchObject({
    name: "actions/hikRosterReconcile:reconcileHikDeviceRoster",
    args: [{ deviceId, dryRun: false, reason: "register", attempt: 0 }],
  });
});
it("does not schedule cleanup on online events without the pending flag", async () => {
  const t = convexTest(schema, modules);
  const deviceId = await t.run(ctx => ctx.db.insert("devices", {
    name: "Hik", createdAt: "now", updatedAt: "now", brand: "hikvision",
    hikTransport: "gateway", hikDevIndex: "index", hikIsupOnline: false,
  }));
  await t.mutation(internal.devices.applyIsupStatus, { deviceId, devIndex: "index", status: "online", at: Date.now() });
  expect(await t.run(ctx => ctx.db.system.query("_scheduled_functions").collect())).toEqual([]);
});
