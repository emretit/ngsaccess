/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import schema from "./schema";
import { internal } from "./_generated/api";
import { upsertGrantStatus } from "./lib/grantStatus";

const modules = import.meta.glob("./**/*.ts");
async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "Attempts" });
    const employeeId = await ctx.db.insert("employees", { projectId, firstName: "A", lastName: "B", email: "a@test.invalid", cardNumber: "123" });
    const deviceId = await ctx.db.insert("devices", { projectId, name: "Hik", brand: "hikvision", hikTransport: "localBridge", apiToken: "attempt-test", createdAt: "now", updatedAt: "now" });
    return { projectId, employeeId, deviceId };
  });
  return { t, ...ids };
}

it("ignores replaced and re-claimed attempts, including ambiguous legacy ACKs", async () => {
  const { t, ...ids } = await fixture();
  const enqueue = (name: string) => t.mutation(internal.hikvisionSync.enqueueLocalBridgeOperation, { projectId: ids.projectId, deviceId: ids.deviceId, operation: "addPerson", payload: { employeeId: ids.employeeId, employeeNo: "123", name } });
  const opId = await enqueue("first");
  const first = await t.mutation(internal.hikvisionSync.claimLocalBridgeOperations, { token: "attempt-test" });
  const attempt = first.operations[0]?.attempt;
  expect(attempt).toBeDefined();
  expect(await enqueue("second")).toBe(opId);
  await t.mutation(internal.hikvisionSync.ackLocalBridgeOperation, { token: "attempt-test", opId, attempt, ok: true });
  expect((await t.run(ctx => ctx.db.get(opId)))?.status).toBe("pending");
  const second = await t.mutation(internal.hikvisionSync.claimLocalBridgeOperations, { token: "attempt-test" });
  await t.mutation(internal.hikvisionSync.ackLocalBridgeOperation, { token: "attempt-test", opId, attempt, ok: true });
  expect(await t.mutation(internal.hikvisionSync.ackLocalBridgeOperation, { token: "attempt-test", opId, ok: true })).toMatchObject({ ok: false, requiresAttempt: true });
  const response = await t.fetch("/hik-bridge/ack", { method: "POST", headers: { Authorization: "Bearer attempt-test", "Content-Type": "application/json" }, body: JSON.stringify({ opId, ok: true }) });
  expect(response.status).toBe(409);
  expect((await t.run(ctx => ctx.db.get(opId)))?.status).toBe("processing");
  expect((await t.run(ctx => ctx.db.query("accessGrantStatus").first()))?.state).toBe("pending");
  await t.mutation(internal.hikvisionSync.ackLocalBridgeOperation, { token: "attempt-test", opId, attempt: second.operations[0]?.attempt, ok: true });
  expect((await t.run(ctx => ctx.db.get(opId)))?.status).toBe("done");
  expect((await t.run(ctx => ctx.db.query("accessGrantStatus").first()))?.state).toBe("effective");
});

it.each(["removed", "pending"] as const)("gateway generation cannot overwrite later %s", async state => {
  const { t, ...ids } = await fixture();
  const started = await t.mutation(internal.hikvisionSync.beginGatewayGrants, { employeeId: ids.employeeId, deviceIds: [ids.deviceId] });
  const expectedGeneration = started[0]?.generation;
  await t.run(ctx => upsertGrantStatus(ctx, { ...ids, state }));
  await t.mutation(internal.hikvisionSync.finishGatewayGrants, { results: [{ ...ids, state: "effective", expectedGeneration }] });
  expect((await t.run(ctx => ctx.db.query("accessGrantStatus").first()))?.state).toBe(state);
  const jobs = await t.run(ctx => ctx.db.system.query("_scheduled_functions").take(10));
  expect(jobs.some(job => job.name === "actions/hikvisionSync:syncEmployeeToDevicesInternal" &&
    JSON.stringify(job.args).includes(ids.deviceId))).toBe(state === "removed");
  const current = await t.mutation(internal.hikvisionSync.beginGatewayGrants, { employeeId: ids.employeeId, deviceIds: [ids.deviceId] });
  await t.mutation(internal.hikvisionSync.finishGatewayGrants, { results: [{ ...ids, state: "effective", expectedGeneration: current[0]?.generation }] });
  expect((await t.run(ctx => ctx.db.query("accessGrantStatus").first()))?.state).toBe("effective");
});

it.each([true, false])("Hik ACK persists mobile terminal outcome: %s", async ok => {
  const { t, ...ids } = await fixture();
  const opId = await t.run(async ctx => {
    const sessionId = await ctx.db.insert("employeeSessions", { employeeId: ids.employeeId, token: "session", expiresAt: "2030-01-01", createdAt: "now" });
    const mobileId = await ctx.db.insert("mobileAccessOperations", { ...ids, sessionId, authVersion: 1, requestId: "request", deviceName: "Hik", requestedAt: "now", status: "sent", transport: "hik_local_bridge", actuator: 1 });
    const id = await ctx.db.insert("hikPendingOperations", { deviceId: ids.deviceId, projectId: ids.projectId, operation: "openDoor", payload: { mobileOperationId: mobileId }, status: "processing", attemptCount: 1, attempt: 1, createdAt: Date.now() });
    await ctx.db.patch(mobileId, { hikOperationId: id });
    return id;
  });
  await t.mutation(internal.hikvisionSync.ackLocalBridgeOperation, { token: "attempt-test", opId, attempt: 1, ok });
  expect((await t.run(ctx => ctx.db.query("mobileAccessOperations").first()))?.status).toBe(ok ? "confirmed" : "unknown");
});

it("IDE requires matching msxId and permits a legacy ACK only for the sole sent operation", async () => {
  const { t, deviceId } = await fixture();
  const insert = () => t.run(ctx => ctx.db.insert("idePendingOperations", { deviceId, opType: "openDoor", payload: { ioId: 1 }, status: "sent", msxId: 12, idempotencyKey: "test", attempts: 1, createdAt: Date.now() }));
  const opId = await insert();
  await t.mutation(internal.ideSync.markAck, { opId, msxId: 13, result: "success" });
  expect((await t.run(ctx => ctx.db.get(opId)))?.status).toBe("sent");
  const other = await insert();
  await t.mutation(internal.ideSync.markAck, { opId, result: "success" });
  expect((await t.run(ctx => ctx.db.get(opId)))?.status).toBe("sent");
  await t.run(ctx => ctx.db.patch(other, { status: "pending" }));
  await t.mutation(internal.ideSync.markAck, { opId, result: "success" });
  expect((await t.run(ctx => ctx.db.get(opId)))?.status).toBe("acked");
});


it("legacy ACKs accept unchanged payloads across retries and identical dedupe", async () => {
  const { t, ...ids } = await fixture();
  const enqueue = () => t.mutation(internal.hikvisionSync.enqueueLocalBridgeOperation, {
    deviceId: ids.deviceId, projectId: ids.projectId, operation: "addPerson", payload: { employeeId: ids.employeeId, employeeNo: "123" },
  });
  const opId = await enqueue();
  // Repeated enqueue before the first claim is also safe for old consumers.
  expect(await enqueue()).toBe(opId);
  await t.mutation(internal.hikvisionSync.claimLocalBridgeOperations, { token: "attempt-test" });
  await t.mutation(internal.hikvisionSync.ackLocalBridgeOperation, { token: "attempt-test", opId, ok: false });
  expect((await t.run(ctx => ctx.db.get(opId)))?.status).toBe("failed");
  expect(await enqueue()).toBe(opId);
  await t.mutation(internal.hikvisionSync.claimLocalBridgeOperations, { token: "attempt-test" });
  // An identical payload arriving during processing does not invalidate a legacy ACK.
  expect(await enqueue()).toBe(opId);
  await t.mutation(internal.hikvisionSync.claimLocalBridgeOperations, { token: "attempt-test" });
  expect(await t.mutation(internal.hikvisionSync.ackLocalBridgeOperation, { token: "attempt-test", opId, ok: true })).toEqual({ ok: true });
  expect((await t.run(ctx => ctx.db.get(opId)))?.status).toBe("done");
});


it.each(["claimTimeout", "cronTimeout", "notDeliverable"] as const)("settles mobile history on %s", async path => {
  const { t, ...ids } = await fixture();
  const mobileId = await t.run(async ctx => {
    const sessionId = await ctx.db.insert("employeeSessions", { employeeId: ids.employeeId, token: "expired", expiresAt: "2000-01-01", createdAt: "now" });
    const mobileId = await ctx.db.insert("mobileAccessOperations", { ...ids, sessionId, authVersion: 1, requestId: path, deviceName: "Hik", requestedAt: "2000-01-01", status: "sent", transport: "hik_local_bridge", actuator: 1 });
    const id = await ctx.db.insert("hikPendingOperations", { deviceId: ids.deviceId, projectId: ids.projectId, operation: "openDoor", payload: { mobileOperationId: mobileId },
      status: path === "notDeliverable" ? "pending" : "processing", attemptCount: path === "notDeliverable" ? 0 : 1,
      processingStartedAt: Date.now() - 180000, createdAt: Date.now() - 180000 });
    await ctx.db.patch(mobileId, { hikOperationId: id });
    return mobileId;
  });
  if (path === "cronTimeout") await t.mutation(internal.hikvisionSync.requeueStaleLocalBridgeOperations, {});
  else await t.mutation(internal.hikvisionSync.claimLocalBridgeOperations, { token: "attempt-test" });
  expect((await t.run(ctx => ctx.db.get(mobileId)))?.status).toBe(path === "notDeliverable" ? "failed" : "unknown");
  const { settleMobileHikOperation } = await import("./lib/mobileAccess");
  await t.run(async ctx => {
    const row = await ctx.db.get(mobileId);
    const op = row?.hikOperationId ? await ctx.db.get(row.hikOperationId) : null;
    if (!op) throw new Error("missing operation");
    await settleMobileHikOperation(ctx, op, "acked");
  });
  expect((await t.run(ctx => ctx.db.get(mobileId)))?.status).toBe(path === "notDeliverable" ? "failed" : "confirmed");
});

it("a historical failure counter alone is not proof of bridge delivery", async () => {
  const { t, ...ids } = await fixture();
  const opId = await t.run(ctx => ctx.db.insert("hikPendingOperations", {
    deviceId: ids.deviceId, projectId: ids.projectId, operation: "addPerson", status: "failed", attemptCount: 5,
    payload: { employeeId: ids.employeeId, employeeNo: "123", name: "old" }, createdAt: Date.now(),
  }));
  expect(await t.mutation(internal.hikvisionSync.enqueueLocalBridgeOperation, {
    deviceId: ids.deviceId, projectId: ids.projectId, operation: "addPerson", payload: { employeeId: ids.employeeId, employeeNo: "123", name: "new" },
  })).toBe(opId);
  await t.mutation(internal.hikvisionSync.claimLocalBridgeOperations, { token: "attempt-test" });
  expect(await t.mutation(internal.hikvisionSync.ackLocalBridgeOperation, { token: "attempt-test", opId, ok: true })).toEqual({ ok: true });
});

it("overlapping generations do not schedule corrective actions for pending or effective grants", async () => {
  const { t, ...ids } = await fixture();
  const first = await t.mutation(internal.hikvisionSync.beginGatewayGrants, { employeeId: ids.employeeId, deviceIds: [ids.deviceId] });
  const second = await t.mutation(internal.hikvisionSync.beginGatewayGrants, { employeeId: ids.employeeId, deviceIds: [ids.deviceId] });
  const stale = { ...ids, state: "effective" as const, expectedGeneration: first[0]?.generation };
  await t.mutation(internal.hikvisionSync.finishGatewayGrants, { results: [stale] });
  expect((await t.run(ctx => ctx.db.query("accessGrantStatus").first()))?.state).toBe("pending");
  await t.mutation(internal.hikvisionSync.finishGatewayGrants, { results: [{ ...ids, state: "effective", expectedGeneration: second[0]?.generation }] });
  await t.mutation(internal.hikvisionSync.finishGatewayGrants, { results: [stale] });
  expect((await t.run(ctx => ctx.db.query("accessGrantStatus").first()))?.state).toBe("effective");
  const jobs = await t.run(ctx => ctx.db.system.query("_scheduled_functions").take(10));
  expect(jobs.filter(job => job.name === "actions/hikvisionSync:syncEmployeeToDevicesInternal")).toHaveLength(0);
});

it.each(["removed", "failed"] as const)("coalesces stale results after %s and allows one corrective hop per begin", async state => {
  const { t, ...ids } = await fixture();
  const other = await t.run(ctx => ctx.db.insert("devices", { projectId: ids.projectId, name: "Other", brand: "hikvision", createdAt: "now", updatedAt: "now" }));
  const started = await t.mutation(internal.hikvisionSync.beginGatewayGrants, { employeeId: ids.employeeId, deviceIds: [ids.deviceId, other] });
  await t.run(async ctx => {
    for (const deviceId of [ids.deviceId, other]) await upsertGrantStatus(ctx, { ...ids, deviceId, state });
  });
  const stale = started.map(row => ({ ...ids, deviceId: row.deviceId, expectedGeneration: row.generation, state: "effective" as const }));
  await t.mutation(internal.hikvisionSync.finishGatewayGrants, { results: [...stale, ...stale] });
  const jobs = () => t.run(async ctx => (await ctx.db.system.query("_scheduled_functions").take(10))
    .filter(job => job.name === "actions/hikvisionSync:syncEmployeeToDevicesInternal"));
  expect(await jobs()).toHaveLength(1);
  expect((await jobs())[0]?.args[0]).toMatchObject({ employeeId: ids.employeeId, targetDeviceIds: expect.arrayContaining([ids.deviceId, other]) });
  const corrective = await t.mutation(internal.hikvisionSync.beginGatewayGrants, { employeeId: ids.employeeId, deviceIds: [ids.deviceId, other] });
  await t.mutation(internal.hikvisionSync.finishGatewayGrants, { results: corrective.map(row => ({ ...ids, deviceId: row.deviceId, expectedGeneration: row.generation, state })) });
  expect((await t.run(ctx => ctx.db.query("accessGrantStatus").first()))?.state).toBe(state);
  await t.mutation(internal.hikvisionSync.finishGatewayGrants, { results: stale });
  expect(await jobs()).toHaveLength(2);
  await t.mutation(internal.hikvisionSync.finishGatewayGrants, { results: [...stale, ...stale] });
  expect(await jobs()).toHaveLength(2);
});

it("legacy payload replacement stops claiming after five uncorrelated attempts", async () => {
  const { t, ...ids } = await fixture();
  const enqueue = (name: string) => t.mutation(internal.hikvisionSync.enqueueLocalBridgeOperation, {
    deviceId: ids.deviceId, projectId: ids.projectId, operation: "addPerson", payload: { employeeId: ids.employeeId, employeeNo: "123", name },
  });
  const opId = await enqueue("old");
  await t.mutation(internal.hikvisionSync.claimLocalBridgeOperations, { token: "attempt-test" });
  expect(await enqueue("new")).toBe(opId);
  for (let index = 0; index < 5; index++) {
    const claim = await t.mutation(internal.hikvisionSync.claimLocalBridgeOperations, { token: "attempt-test" });
    expect(claim.operations.map(op => op.opId)).toEqual([opId]);
    const ack = await t.mutation(internal.hikvisionSync.ackLocalBridgeOperation, { token: "attempt-test", opId, ok: true });
    expect(ack).toMatchObject({ ok: false, requiresAttempt: true });
    expect(ack).not.toHaveProperty("retry");
    await t.run(ctx => ctx.db.patch(opId, { processingStartedAt: Date.now() - 180000 }));
    await t.mutation(internal.hikvisionSync.requeueStaleLocalBridgeOperations, {});
  }
  for (let index = 0; index < 2; index++) {
    expect((await t.mutation(internal.hikvisionSync.claimLocalBridgeOperations, { token: "attempt-test" })).operations).toHaveLength(0);
    expect(await t.run(ctx => ctx.db.get(opId))).toMatchObject({ status: "failed", attemptCount: 5, lastError: "bridge_attempt_required" });
  }
  expect((await t.run(ctx => ctx.db.query("accessGrantStatus").first()))?.state).toBe("failed");
});
