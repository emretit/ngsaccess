// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
const modules = import.meta.glob("./**/*.ts");
it("keeps invalid IDE credentials in the IDE error queue and retries only the IDE adapter", async () => {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "A" });
    const userId = await ctx.db.insert("users", { role: "project_admin" });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 86400000 });
    await ctx.db.insert("userProjects", { userId, projectId });
    const employeeId = await ctx.db.insert("employees", { projectId, firstName: "Ada", lastName: "Test", email: "", cardNumber: "SENSITIVE-CARD" });
    const deviceId = await ctx.db.insert("devices", { projectId, name: "IDE", brand: "ide_smart", createdAt: "", updatedAt: "" });
    return { employeeId, deviceId, userId, sessionId };
  });
  const args = { employeeId: ids.employeeId, deviceIds: [ids.deviceId], lastError: "Kart numarası IDE için pozitif, güvenli bir tam sayı olmalı" };
  await t.mutation(internal.ideSync.recordEmployeeCardFailures, args);
  await t.mutation(internal.ideSync.recordEmployeeCardFailures, args);
  const ops = await t.run(ctx => ctx.db.query("idePendingOperations").collect());
  expect(ops).toHaveLength(1);
  expect(ops[0]).toMatchObject({ status: "failed", payload: { employeeId: ids.employeeId, errorCode: "card_invalid" } });
  expect(JSON.stringify(ops)).not.toContain("SENSITIVE-CARD");
  const actor = t.withIdentity({ subject: `${ids.userId}|${ids.sessionId}` });
  await actor.mutation(api.ideSync.retrySyncIssue, { opId: ops[0]._id });
  expect(await t.run(ctx => ctx.db.get(ops[0]._id))).toMatchObject({ status: "failed" });
  expect(await t.run(ctx => ctx.db.query("hikPendingOperations").collect())).toEqual([]);
  const jobs = await t.run(ctx => ctx.db.system.query("_scheduled_functions").collect());
  expect(jobs).toHaveLength(1);
  expect(jobs[0]).toMatchObject({ name: "actions/ideGatewayDevice:syncEmployeeToIdePanels", args: [{ employeeId: ids.employeeId, targetDeviceIds: [ids.deviceId] }] });
  await t.run(ctx => ctx.db.patch(ids.employeeId, { cardNumber: "123" }));
  await t.mutation(internal.ideSync.enqueueIdeOp, { deviceId: ids.deviceId, opType: "upsertUser", payload: { employeeId: ids.employeeId, userRecord: { id: 123, status: 1, permissions: [] } } });
  expect(await t.run(ctx => ctx.db.get(ops[0]._id))).toMatchObject({ status: "acked", responseMessage: expect.stringContaining("Kart doğrulandı") });
});
