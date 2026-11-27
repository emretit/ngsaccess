// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import { api, internal } from "../_generated/api";
import schema from "../schema";
const modules = { ...Object.fromEntries(Object.entries(import.meta.glob("../**/*.ts")).map(([key, value]) => [key.replace(/^\.\.\//, "./"), value])) };
async function fixture(legacy = false, assigned = false) {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "A" });
    const userId = await ctx.db.insert("users", { role: "project_admin" });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 86400000 });
    await ctx.db.insert("userProjects", { userId, projectId });
    const employeeId = await ctx.db.insert("employees", { projectId, firstName: "Ada", lastName: "Test", email: "", cardNumber: legacy ? "123" : assigned ? "456" : "", hikCardless: !assigned, ...(legacy ? {} : { hikEmployeeNo: "123" }), isActive: true });
    return { employeeId, userId, sessionId };
  });
  return { t, ...ids, caller: t.withIdentity({ subject: `${ids.userId}|${ids.sessionId}` }) };
}
it.each([false, true])("assigns the first real card without deleting the imported person or fingerprints (legacy=%s)", async legacy => {
  const f = await fixture(legacy);
  expect(await f.caller.mutation(api.employeeImport.assignCards, { assignments: [{ employeeId: f.employeeId, cardNumber: "789" }] })).toMatchObject([{ status: "assigned" }]);
  expect(await f.t.run(ctx => ctx.db.get(f.employeeId))).toMatchObject({ cardNumber: "789", hikEmployeeNo: "123", hikCardless: false });
  expect(await f.t.query(internal.hikvisionSync.getEmployeeWithDevices, { employeeId: f.employeeId })).toMatchObject({ employee: { cardNumber: "789", hikEmployeeNo: "123" } });
  const jobs = await f.t.run(ctx => ctx.db.system.query("_scheduled_functions").collect());
  expect(jobs.map(job => job.name)).toEqual(["actions/hikvisionSync:syncEmployeeToDevicesInternal", "actions/ideGatewayDevice:syncEmployeeToIdePanels"]);
});
it("D6: preserves cardless status when resubmitting the same placeholder", async () => {
  const f = await fixture(true);
  await f.caller.mutation(api.employeeImport.assignCards, { assignments: [{ employeeId: f.employeeId, cardNumber: "123" }] });
  expect(await f.t.run(ctx => ctx.db.get(f.employeeId))).toMatchObject({ cardNumber: "123", hikCardless: true });
  expect(await f.t.run(ctx => ctx.db.system.query("_scheduled_functions").collect())).toEqual([]);
});
it("replaces an assigned card by scheduling card-only removal, preserving the device person identity", async () => {
  const f = await fixture(false, true);
  await f.caller.mutation(api.employeeImport.assignCards, { assignments: [{ employeeId: f.employeeId, cardNumber: "789" }] });
  const jobs = await f.t.run(ctx => ctx.db.system.query("_scheduled_functions").collect());
  expect(jobs[0]).toMatchObject({ name: "actions/hikvisionSync:deleteEmployeeCardOnlyInternal", args: [{ cardNumber: "456" }] });
  expect(jobs.some(job => job.name.includes("deleteEmployeeFromDevices") || job.name.includes("purgeFingerprint"))).toBe(false);
  expect(await f.t.run(ctx => ctx.db.get(f.employeeId))).toMatchObject({ hikEmployeeNo: "123" });
});

it.each([false, true])("bridge target permits first assignment but rejects replacing an existing physical card (assigned=%s)", async assigned => {
  const f = await fixture(false, assigned);
  await f.t.run(async ctx => {
    const employee = await ctx.db.get(f.employeeId);
    if (!employee?.projectId) throw new Error("Missing fixture");
    const deviceId = await ctx.db.insert("devices", { projectId: employee.projectId, name: "Bridge", brand: "hikvision", hikTransport: "localBridge", isActive: true, createdAt: "", updatedAt: "" });
    const groupId = await ctx.db.insert("accessRules", { projectId: employee.projectId, name: "Rule", isActive: true });
    await ctx.db.insert("groupMembers", { projectId: employee.projectId, groupId, employeeId: f.employeeId, createdAt: "" });
    await ctx.db.insert("groupDevices", { projectId: employee.projectId, groupId, deviceId, createdAt: "" });
  });
  const assign = f.caller.mutation(api.employeeImport.assignCards, { assignments: [{ employeeId: f.employeeId, cardNumber: "789" }] });
  if (assigned) {
    await expect(assign).rejects.toThrow("Bu cihaz köprüsünde kart değişimi desteklenmiyor");
    expect(await f.t.run(ctx => ctx.db.get(f.employeeId))).toMatchObject({ cardNumber: "456", hikEmployeeNo: "123" });
    expect(await f.t.run(ctx => ctx.db.system.query("_scheduled_functions").collect())).toEqual([]);
  } else await expect(assign).resolves.toMatchObject([{ status: "assigned" }]);
});

it("D5: first real card revokes a legacy IDE placeholder before sending the new card", async () => {
  const f = await fixture(true);
  const panel = await f.t.run(async ctx => {
    const employee = await ctx.db.get(f.employeeId);
    if (!employee?.projectId) throw new Error("fixture");
    const deviceId = await ctx.db.insert("devices", { projectId: employee.projectId, name: "IDE", brand: "ide_smart", ideUuid: "panel", isActive: true, createdAt: "", updatedAt: "" });
    const groupId = await ctx.db.insert("accessRules", { projectId: employee.projectId, name: "Rule", isActive: true });
    await ctx.db.insert("groupMembers", { projectId: employee.projectId, groupId, employeeId: f.employeeId, createdAt: "" });
    await ctx.db.insert("groupDevices", { projectId: employee.projectId, groupId, deviceId, createdAt: "" });
    return { deviceId, projectId: employee.projectId };
  });
  await f.caller.mutation(api.employeeImport.assignCards, { assignments: [{ employeeId: f.employeeId, cardNumber: "789" }] });
  const jobs = await f.t.run(ctx => ctx.db.system.query("_scheduled_functions").collect());
  expect(jobs[0]).toMatchObject({ name: "actions/ideGatewayDevice:deleteIdeUserFromPanels", args: [{ employeeId: f.employeeId, cardNumber: "123" }] });
  expect(jobs.some(job => job.name.includes("deleteEmployeeCardOnly") || job.name.includes("deleteEmployeeFromDevices"))).toBe(false);
  await f.t.action(internal.actions.ideGatewayDevice.deleteIdeUserFromPanels, { employeeId: f.employeeId, cardNumber: "123", deviceIds: [panel.deviceId], projectId: panel.projectId });
  expect(await f.t.run(ctx => ctx.db.query("idePendingOperations").collect())).toEqual(expect.arrayContaining([expect.objectContaining({ opType: "deleteUser", payload: expect.objectContaining({ ideUserId: 123 }) })]));
});
it("D6: API update of the same legacy placeholder keeps it cardless", async () => {
  const f = await fixture(true);
  await f.caller.mutation(api.employees.update, { employeeId: f.employeeId, cardNumber: "123" });
  expect(await f.t.run(ctx => ctx.db.get(f.employeeId))).toMatchObject({ hikCardless: true });
  expect(await f.t.run(ctx => ctx.db.system.query("_scheduled_functions").collect())).toEqual([]);
});
