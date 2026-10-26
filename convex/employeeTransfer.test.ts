// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import rateLimiterTest from "@convex-dev/rate-limiter/test";
import bcrypt from "bcryptjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { upsertGrantStatus } from "./lib/grantStatus";
import { TRANSFER_WINDOW_MS } from "./lib/accessTransfer";
const modules = import.meta.glob("./**/*.ts");
const now = "2026-10-26T10:00:00.000Z";
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(now)); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
async function fixture(options: { noDevices?: boolean; localBridge?: boolean } = {}) {
  const t = convexTest(schema, modules);
  rateLimiterTest.register(t);
  const ids = await t.run(async ctx => {
    const sourceProjectId = await ctx.db.insert("projects", { name: "A" });
    const targetProjectId = await ctx.db.insert("projects", { name: "B" });
    const userId = await ctx.db.insert("users", { role: "project_admin" });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 7 * TRANSFER_WINDOW_MS });
    const sourceMembershipId = await ctx.db.insert("userProjects", { userId, projectId: sourceProjectId, role: "admin" });
    const targetMembershipId = await ctx.db.insert("userProjects", { userId, projectId: targetProjectId, role: "admin" });
    const departmentId = await ctx.db.insert("departments", { projectId: targetProjectId, name: "B departman" });
    const sourceDepartmentId = await ctx.db.insert("departments", { projectId: sourceProjectId, name: "A departman" });
    const employeeId = await ctx.db.insert("employees", { projectId: sourceProjectId, firstName: "Ada", lastName: "Test", email: "ada@example.test", cardNumber: "00123", payrollCode: "S01", tcNo: "12345678901", departmentId: sourceDepartmentId, notes: "Profil notu", isActive: true });
    await ctx.db.insert("employeeAuth", { employeeId, projectId: sourceProjectId, email: "ada@example.test", passwordHash: "old", createdAt: now, updatedAt: now });
    await ctx.db.insert("employeeSessions", { employeeId, token: "old-token", expiresAt: "2030-01-01T00:00:00Z", createdAt: now });
    const readingId = await ctx.db.insert("cardReadings", { projectId: sourceProjectId, employeeId, cardNo: "00123", accessTime: now, accessStatus: "izin_verildi" });
    const sourceRuleId = await ctx.db.insert("accessRules", { projectId: sourceProjectId, name: "A kural", isActive: true, hikWeekPlanNo: 1, idePermissionNo: 1 });
    const targetRuleId = await ctx.db.insert("accessRules", { projectId: targetProjectId, name: "B kural", isActive: true, hikWeekPlanNo: 2, idePermissionNo: 2 });
    await ctx.db.insert("groupMembers", { projectId: sourceProjectId, employeeId, groupId: sourceRuleId, createdAt: now });
    const base = { isActive: true, createdAt: now, updatedAt: now, lastSeen: now };
    const hikId = await ctx.db.insert("devices", { ...base, projectId: sourceProjectId, name: "A Hik", brand: "hikvision", hikDevIndex: "hik-A", hikLastSeenAt: Date.now(), ...(options.localBridge ? { hikTransport: "localBridge" as const, apiToken: "bridge-token" } : {}) });
    const ideId = await ctx.db.insert("devices", { ...base, projectId: sourceProjectId, name: "A IDE", brand: "ide_smart", ideUuid: "123456789012345" });
    const targetHikId = await ctx.db.insert("devices", { ...base, projectId: targetProjectId, name: "B Hik", brand: "hikvision", hikDevIndex: "hik-B" });
    const targetIdeId = await ctx.db.insert("devices", { ...base, projectId: targetProjectId, name: "B IDE", brand: "ide_smart", ideUuid: "223456789012345" });
    for (const [projectId, groupId, deviceIds] of [[sourceProjectId, sourceRuleId, options.noDevices ? [] : [hikId, ideId]], [targetProjectId, targetRuleId, [targetHikId, targetIdeId]]] as const) {
      for (const deviceId of deviceIds) await ctx.db.insert("groupDevices", { projectId, groupId, deviceId, createdAt: now });
    }
    await ctx.db.insert("doors", { projectId: sourceProjectId, deviceId: ideId, name: "A IDE kapı", ioId: 0 });
    await ctx.db.insert("doors", { projectId: targetProjectId, deviceId: targetIdeId, name: "B IDE kapı", ioId: 0 });
    return { sourceProjectId, targetProjectId, userId, sessionId, sourceMembershipId, targetMembershipId, departmentId, sourceDepartmentId, employeeId, readingId, sourceRuleId, targetRuleId, hikId, ideId, targetHikId, targetIdeId };
  });
  const caller = t.withIdentity({ subject: `${ids.userId}|${ids.sessionId}` });
  const start = () => caller.mutation(api.employeeTermination.startTransfer, { employeeId: ids.employeeId, targetProjectId: ids.targetProjectId, accessRuleIds: [ids.targetRuleId], departmentId: ids.departmentId });
  const state = (transferId: Id<"accessTransfers">) => t.run(ctx => ctx.db.get(transferId));
  const targets = (transferId: Id<"accessTransfers">) => t.run(ctx => ctx.db.query("accessTransferTargets").withIndex("by_transfer_state", q => q.eq("transferId", transferId)).collect());
  const targetState = async (transferId: Id<"accessTransfers">, deviceId: Id<"devices">) => (await targets(transferId)).find(row => row.deviceId === deviceId)?.state;
  const jobs = () => t.run(ctx => ctx.db.system.query("_scheduled_functions").collect());
  const ops = () => t.run(async ctx => ({ hik: await ctx.db.query("hikPendingOperations").collect(), ide: await ctx.db.query("idePendingOperations").collect() }));
  const hikDone = async () => {
    const op = (await ops()).hik.find(op => op.deviceId === ids.hikId && op.operation === "deletePerson");
    if (!op) throw new Error("Hik silme işi yok");
    await t.mutation(internal.hikvisionSync.markOpDone, { id: op._id });
  };
  const ideAck = async (result: "success" | "not_found" = "success") => {
    const op = (await ops()).ide.find(op => op.deviceId === ids.ideId && op.opType === "deleteUser" && op.status === "pending");
    if (!op) throw new Error("IDE silme işi yok");
    await t.mutation(internal.ideSync.markSent, { opId: op._id, msxId: 7 });
    await t.mutation(internal.ideSync.markAck, { opId: op._id, msxId: 7, result: result === "success" ? "success" : "fail", ...(result === "not_found" ? { errorCode: "not_found", message: "not found" } : {}) });
    return op._id;
  };
  return { t, caller, ids, start, state, targets, targetState, jobs, ops, hikDone, ideAck };
}

async function expectTransferError(promise: Promise<unknown>, code: string, text?: string) {
  const error = await promise.then(() => null, (error: unknown) => error);
  expect(error).toHaveProperty("data.code", code);
  if (text) expect(error).toHaveProperty("data.message", expect.stringContaining(text));
}

describe("K-02 physical revocation barrier", () => {
  it.each(["success", "not_found"] as const)("waits for Hik + IDE %s before releasing the card and provisioning B", async result => {
    const f = await fixture();
    const transfer = await f.start();
    const source = await f.t.run(ctx => ctx.db.get(f.ids.employeeId));
    const target = await f.t.run(ctx => ctx.db.get(transfer.targetEmployeeId));
    expect(source).toMatchObject({ isActive: false, cardNumber: "00123", terminationType: "transfer", employmentEndDate: "2026-10-26", transferredToEmployeeId: transfer.targetEmployeeId });
    expect(target).toMatchObject({ isActive: true, projectId: f.ids.targetProjectId, cardNumber: "", email: source?.email, tcNo: source?.tcNo, payrollCode: "S01", departmentId: f.ids.departmentId, transferredFromEmployeeId: f.ids.employeeId });
    for (const field of ["companyId", "positionId", "shiftId", "accessRuleId"] as const) expect(target?.[field]).toBeUndefined();
    expect((await f.ops()).ide).toHaveLength(1);
    expect((await f.ops()).ide[0]).toMatchObject({ maxAttempts: 50, payload: { employeeId: f.ids.employeeId, ideUserId: 123 } });
    expect((await f.ops()).hik).toHaveLength(1);
    expect((await f.targets(transfer.transferId)).map(row => row.state)).toEqual(["pending", "pending"]);
    expect((await f.jobs()).some(job => JSON.stringify(job.args).includes(transfer.targetEmployeeId))).toBe(false);
    expect(await f.t.run(ctx => ctx.db.query("groupMembers").withIndex("by_project_employee", q => q.eq("projectId", f.ids.sourceProjectId).eq("employeeId", f.ids.employeeId)).collect())).toHaveLength(0);
    for (const table of ["employeeSessions", "employeeAuth"] as const) expect(await f.t.run(ctx => ctx.db.query(table).withIndex("by_employee", q => q.eq("employeeId", f.ids.employeeId)).collect())).toHaveLength(0);
    await f.hikDone();
    expect((await f.state(transfer.transferId))?.status).toBe("revoking");
    expect(await f.targetState(transfer.transferId, f.ids.hikId)).toBe("confirmed");
    await f.t.mutation(internal.employeeTermination.completeTransfer, { transferId: transfer.transferId });
    expect((await f.t.run(ctx => ctx.db.get(transfer.targetEmployeeId)))?.cardNumber).toBe("");
    await f.ideAck(result);
    expect((await f.state(transfer.transferId))?.status).toBe("revoked");
    expect((await f.jobs()).some(job => job.name === "employeeTermination:completeTransfer")).toBe(true);
    await f.t.mutation(internal.employeeTermination.completeTransfer, { transferId: transfer.transferId });
    expect(await f.state(transfer.transferId)).toMatchObject({ status: "done", completedAt: Date.now() });
    expect(await f.t.run(ctx => ctx.db.get(f.ids.employeeId))).toMatchObject({ cardNumber: "", transferredCardNumber: "00123", isActive: false });
    expect(await f.t.run(ctx => ctx.db.get(transfer.targetEmployeeId))).toMatchObject({ cardNumber: "00123" });
    expect(await f.t.run(ctx => ctx.db.get(f.ids.readingId))).toMatchObject({ employeeId: f.ids.employeeId, projectId: f.ids.sourceProjectId, cardNo: "00123" });
    expect(await f.t.run(ctx => ctx.db.query("groupMembers").withIndex("by_project_employee", q => q.eq("projectId", f.ids.targetProjectId).eq("employeeId", transfer.targetEmployeeId)).collect())).toMatchObject([{ groupId: f.ids.targetRuleId }]);
    expect((await f.jobs()).filter(job => JSON.stringify(job.args).includes(transfer.targetEmployeeId)).map(job => job.name)).toEqual(["actions/hikvisionSync:syncEmployeeToDevicesInternal", "actions/ideGatewayDevice:syncEmployeeToIdePanels"]);
    await expectTransferError(f.caller.mutation(api.employeeTermination.reinstate, { employeeId: f.ids.employeeId }), "TRANSFER_REINSTATE_FORBIDDEN");
    await f.t.mutation(internal.employeeTermination.completeTransfer, { transferId: transfer.transferId });
    expect((await f.jobs()).filter(job => JSON.stringify(job.args).includes(transfer.targetEmployeeId))).toHaveLength(2);
  });

  it("also confirms through the local bridge acknowledgement, never its dispatch", async () => {
    const f = await fixture({ localBridge: true });
    const transfer = await f.start();
    const op = (await f.ops()).hik[0];
    expect(op).toMatchObject({ operation: "deleteCard", status: "pending" });
    await f.t.run(ctx => ctx.db.patch(op._id, { status: "processing" }));
    await f.t.mutation(internal.hikvisionSync.ackLocalBridgeOperation, { token: "bridge-token", opId: op._id, ok: false, message: "cihaz kapalı" });
    expect(await f.targetState(transfer.transferId, f.ids.hikId)).toBe("pending");
    await f.t.run(ctx => ctx.db.patch(op._id, { status: "processing" }));
    await f.t.mutation(internal.hikvisionSync.ackLocalBridgeOperation, { token: "bridge-token", opId: op._id, ok: true });
    expect(await f.targetState(transfer.transferId, f.ids.hikId)).toBe("confirmed");
    expect((await f.state(transfer.transferId))?.status).toBe("revoking");
  });

  it("gateway aggregate results wait for the tracked fresh deletion acknowledgement", async () => {
    const f = await fixture(); const transfer = await f.start();
    await f.t.mutation(internal.accessGrantStatus.recordGrantResults, { results: [{ projectId: f.ids.sourceProjectId, employeeId: f.ids.employeeId, deviceId: f.ids.hikId, state: "removed" }] });
    expect(await f.targetState(transfer.transferId, f.ids.hikId)).toBe("pending");
    await f.hikDone();
    expect(await f.targetState(transfer.transferId, f.ids.hikId)).toBe("confirmed");
    expect((await f.state(transfer.transferId))?.status).toBe("revoking");
  });

  it("a targetless person completes immediately with a new record", async () => {
    const f = await fixture({ noDevices: true }); const transfer = await f.start();
    expect((await f.state(transfer.transferId))?.status).toBe("done");
    expect(await f.targets(transfer.transferId)).toHaveLength(0);
    expect((await f.t.run(ctx => ctx.db.get(transfer.targetEmployeeId)))?.cardNumber).toBe("00123");
  });

  it("cardless B cannot produce device jobs through either normal sync action", async () => {
    const f = await fixture(); const transfer = await f.start();
    await f.t.run(ctx => ctx.db.insert("groupMembers", { projectId: f.ids.targetProjectId, employeeId: transfer.targetEmployeeId, groupId: f.ids.targetRuleId, createdAt: now }));
    const before = await f.ops();
    await f.t.action(internal.actions.hikvisionSync.syncEmployeeToDevicesInternal, { employeeId: transfer.targetEmployeeId });
    await f.t.action(internal.actions.ideGatewayDevice.syncEmployeeToIdePanels, { employeeId: transfer.targetEmployeeId });
    expect(await f.ops()).toEqual(before);
    expect((await f.state(transfer.transferId))?.status).toBe("revoking");
  });

  it("a cardless source has no physical targets even when it belongs to device rules", async () => {
    const f = await fixture();
    await f.t.run(ctx => ctx.db.patch(f.ids.employeeId, { cardNumber: "" }));
    const transfer = await f.start();
    expect(await f.targets(transfer.transferId)).toHaveLength(0);
    expect((await f.state(transfer.transferId))?.status).toBe("done");
    expect(await f.ops()).toEqual({ hik: [], ide: [] });
  });

  it("freezes roster-only, nonremoved grant and pending-deletion devices", async () => {
    const f = await fixture({ noDevices: true });
    await f.t.run(async ctx => {
      await ctx.db.insert("idePanelUsers", { ideUuid: "123456789012345", deviceId: f.ids.ideId, projectId: f.ids.sourceProjectId, cardNumber: "123", syncedAt: Date.now() });
      await ctx.db.insert("accessGrantStatus", { projectId: f.ids.sourceProjectId, employeeId: f.ids.employeeId, deviceId: f.ids.hikId, state: "effective", ruleIds: [], updatedAt: Date.now() });
      await ctx.db.insert("hikPendingOperations", { projectId: f.ids.sourceProjectId, deviceId: f.ids.hikId, operation: "deletePerson", payload: { employeeId: f.ids.employeeId, cardNumber: "00123" }, status: "failed", attemptCount: 5, createdAt: Date.now() });
    });
    const transfer = await f.start();
    expect(await f.targets(transfer.transferId)).toHaveLength(2);
    expect((await f.ops()).ide).toMatchObject([{ deviceId: f.ids.ideId, opType: "deleteUser", payload: { employeeId: f.ids.employeeId }, maxAttempts: 50 }]);
  });

  it("pending Hik deletion without a current graph or grant still blocks release", async () => {
    const f = await fixture({ noDevices: true });
    await f.t.run(ctx => ctx.db.insert("hikPendingOperations", { projectId: f.ids.sourceProjectId, deviceId: f.ids.hikId, operation: "deletePerson", payload: { employeeId: f.ids.employeeId, cardNumber: "00123" }, status: "failed", attemptCount: 5, createdAt: Date.now() }));
    const transfer = await f.start();
    expect((await f.targets(transfer.transferId)).map(row => row.deviceId)).toEqual([f.ids.hikId]);
    expect((await f.t.run(ctx => ctx.db.get(transfer.targetEmployeeId)))?.cardNumber).toBe("");
  });

  it("also freezes legacy deletions and creates a fresh IDE deletion with the transfer retry limit", async () => {
    const f = await fixture({ noDevices: true });
    await f.t.run(ctx => ctx.db.insert("hikPendingOperations", { projectId: f.ids.sourceProjectId, deviceId: f.ids.hikId, operation: "deletePerson", payload: { cardNumber: "00123" }, status: "failed", attemptCount: 1, createdAt: Date.now() }));
    const ideOpId = await f.t.mutation(internal.ideSync.enqueueIdeOp, { projectId: f.ids.sourceProjectId, deviceId: f.ids.ideId, opType: "deleteUser", payload: { ideUserId: 123 }, maxAttempts: 5 });
    const transfer = await f.start();
    expect(await f.targets(transfer.transferId)).toHaveLength(2);
    expect(await f.t.run(ctx => ctx.db.get(ideOpId))).toMatchObject({ maxAttempts: 5, payload: { ideUserId: 123 } });
    expect((await f.ops()).ide.find(op => op._id !== ideOpId)).toMatchObject({ maxAttempts: 50, payload: { employeeId: f.ids.employeeId, ideUserId: 123 } });
  });
});

describe("transfer rejection and locks", () => {
  it("rejects an offline device by name without writes and exposes preflight reasons", async () => {
    const f = await fixture();
    await f.t.run(ctx => ctx.db.patch(f.ids.ideId, { lastSeen: undefined }));
    const preflight = await f.caller.query(api.employeeTermination.transferPreflight, { employeeId: f.ids.employeeId, targetProjectId: f.ids.targetProjectId });
    expect(preflight).toMatchObject({ targetDeviceCount: 2, offlineDevices: [{ name: "A IDE" }], reasons: [{ code: "TRANSFER_DEVICE_OFFLINE" }] });
    await expectTransferError(f.start(), "TRANSFER_DEVICE_OFFLINE", "A IDE");
    expect(await f.t.run(ctx => ctx.db.query("accessTransfers").collect())).toHaveLength(0);
    expect((await f.t.run(ctx => ctx.db.get(f.ids.employeeId)))?.isActive).toBe(true);
  });

  it("rejects active hosted visitors and includes the count", async () => {
    const f = await fixture();
    await f.t.run(ctx => ctx.db.insert("employees", { projectId: f.ids.sourceProjectId, hostEmployeeId: f.ids.employeeId, isVisitor: true, isActive: true, firstName: "Misafir", lastName: "Test", email: "", cardNumber: "999", visitorStatus: "checkedIn" }));
    await expectTransferError(f.start(), "TRANSFER_ACTIVE_VISITORS", "1 aktif");
  });

  it.each(["visitor", "inactive", "ended", "same"] as const)("rejects %s source", async kind => {
    const f = await fixture();
    const patches = { visitor: { isVisitor: true }, inactive: { isActive: false }, ended: { employmentEndDate: "2026-10-26" }, same: {} };
    await f.t.run(ctx => ctx.db.patch(f.ids.employeeId, patches[kind]));
    await expectTransferError(f.caller.mutation(api.employeeTermination.startTransfer, { employeeId: f.ids.employeeId, targetProjectId: kind === "same" ? f.ids.sourceProjectId : f.ids.targetProjectId, accessRuleIds: [] }), { visitor: "TRANSFER_VISITOR", inactive: "TRANSFER_INACTIVE", ended: "TRANSFER_INACTIVE", same: "TRANSFER_SAME_PROJECT" }[kind]);
  });

  it("locks both records for another transfer, card/project/activation change, deletion and lifecycle", async () => {
    const f = await fixture(); const transfer = await f.start();
    for (const employeeId of [f.ids.employeeId, transfer.targetEmployeeId]) {
      await expectTransferError(f.caller.mutation(api.employeeTermination.startTransfer, { employeeId, targetProjectId: employeeId === f.ids.employeeId ? f.ids.targetProjectId : f.ids.sourceProjectId, accessRuleIds: [] }), "TRANSFER_IN_PROGRESS");
      await expectTransferError(f.caller.mutation(api.employees.update, { employeeId, cardNumber: "456" }), "TRANSFER_IN_PROGRESS");
      await expectTransferError(f.caller.mutation(api.employees.update, { employeeId, projectId: employeeId === f.ids.employeeId ? f.ids.targetProjectId : f.ids.sourceProjectId }), "TRANSFER_IN_PROGRESS");
      await expectTransferError(f.t.mutation(internal.employees.setProjectId, { employeeId, projectId: f.ids.targetProjectId }), "TRANSFER_IN_PROGRESS");
      await expectTransferError(f.caller.mutation(api.employees.remove, { employeeId }), "TRANSFER_IN_PROGRESS");
      await expectTransferError(f.caller.mutation(api.employees.bulkDelete, { employeeIds: [employeeId] }), "TRANSFER_IN_PROGRESS");
      await expectTransferError(f.caller.mutation(api.employeeTermination.reinstate, { employeeId }), "TRANSFER_IN_PROGRESS");
      await expectTransferError(f.caller.mutation(api.employeeTermination.terminate, { employeeId, employmentEndDate: "2026-10-26", terminationType: "other" }), "TRANSFER_IN_PROGRESS");
    }
    await expectTransferError(f.caller.mutation(api.employees.update, { employeeId: f.ids.employeeId, isActive: true }), "TRANSFER_IN_PROGRESS");
    expect((await f.t.run(ctx => ctx.db.get(transfer.targetEmployeeId)))?.cardNumber).toBe("");
  });

  it.each(["manage", "sourcePay", "targetPay", "ruleManage"] as const)("requires %s permission in the correct project", async missing => {
    const f = await fixture();
    if (missing === "manage") await f.t.run(ctx => ctx.db.patch(f.ids.targetMembershipId, { role: "viewer" }));
    if (missing === "ruleManage") await f.t.run(ctx => ctx.db.patch(f.ids.targetMembershipId, { role: "hr" }));
    if (missing === "sourcePay" || missing === "targetPay") await f.t.run(async ctx => {
      await ctx.db.patch(f.ids.employeeId, { monthlySalary: 50000 });
      await ctx.db.patch(missing === "sourcePay" ? f.ids.sourceMembershipId : f.ids.targetMembershipId, { role: "security" });
      await ctx.db.insert("projectRolePermissions", { projectId: missing === "sourcePay" ? f.ids.sourceProjectId : f.ids.targetProjectId, role: "security", permissions: ["employees.view", "employees.manage", "accessRules.manage"], updatedAt: Date.now(), updatedBy: f.ids.userId });
    });
    await expectTransferError(f.start(), missing === "manage" ? "TRANSFER_PERMISSION_DENIED" : missing === "ruleManage" ? "TRANSFER_RULE_PERMISSION" : "TRANSFER_PAY_PERMISSION");
  });

  it("rejects foreign rules and departments", async () => {
    const f = await fixture();
    await expectTransferError(f.caller.mutation(api.employeeTermination.startTransfer, { employeeId: f.ids.employeeId, targetProjectId: f.ids.targetProjectId, accessRuleIds: [f.ids.sourceRuleId] }), "TRANSFER_RULE_PROJECT");
    await expectTransferError(f.caller.mutation(api.employeeTermination.startTransfer, { employeeId: f.ids.employeeId, targetProjectId: f.ids.targetProjectId, accessRuleIds: [], departmentId: f.ids.sourceDepartmentId }), "TRANSFER_DEPARTMENT_PROJECT");
  });

  it("requires authentication and refuses cancellation/retry before an eligible state", async () => {
    const f = await fixture();
    await expect(f.t.mutation(api.employeeTermination.startTransfer, { employeeId: f.ids.employeeId, targetProjectId: f.ids.targetProjectId, accessRuleIds: [] })).rejects.toThrow("Giriş");
    const transfer = await f.start();
    await expectTransferError(f.caller.mutation(api.employeeTermination.retryTransfer, { transferId: transfer.transferId }), "TRANSFER_CANNOT_RETRY");
    await f.hikDone(); await f.ideAck();
    await expectTransferError(f.caller.mutation(api.employeeTermination.cancelTransfer, { transferId: transfer.transferId }), "TRANSFER_CANNOT_CANCEL");
  });

  it("copies pay only after both projects authorize it and preserves unrelated identifiers", async () => {
    const f = await fixture({ noDevices: true });
    await f.t.run(ctx => ctx.db.patch(f.ids.employeeId, { hourlyRate: 100, monthlySalary: 30000, accessRuleId: f.ids.sourceRuleId }));
    const transfer = await f.start();
    expect(await f.t.run(ctx => ctx.db.get(transfer.targetEmployeeId))).toMatchObject({ hourlyRate: 100, monthlySalary: 30000, departmentId: f.ids.departmentId, tcNo: "12345678901", payrollCode: "S01" });
    expect((await f.t.run(ctx => ctx.db.get(transfer.targetEmployeeId)))?.accessRuleId).toBeUndefined();
    const another = await fixture({ noDevices: true });
    await another.t.run(ctx => ctx.db.insert("employees", { projectId: another.ids.targetProjectId, firstName: "Başka", lastName: "Kişi", email: "ada@example.test", cardNumber: "9999", isActive: true }));
    await expectTransferError(another.start(), "TRANSFER_PROFILE_CONFLICT");
  });
});

describe("stuck, cancellation, late success and device removal", () => {
  it.each(["worker", "protection"] as const)("Hik %s supersession is stuck, cannot retry, and cancellation restores A", async path => {
    const f = await fixture(); const transfer = await f.start();
    const op = (await f.ops()).hik[0];
    if (path === "worker") await f.t.mutation(internal.hikvisionSync.markOpSuperseded, { id: op._id, reason: "superseded" });
    else {
      await f.t.run(async ctx => {
        await ctx.db.patch(f.ids.employeeId, { isActive: true });
        await ctx.db.insert("groupMembers", { projectId: f.ids.sourceProjectId, groupId: f.ids.sourceRuleId, employeeId: f.ids.employeeId, createdAt: now });
      });
      await f.t.mutation(internal.hikvisionSync.protectPersonDeletion, { deviceId: f.ids.hikId, cardNumber: "00123" });
    }
    expect((await f.state(transfer.transferId))?.status).toBe("stuck");
    expect(await f.targetState(transfer.transferId, f.ids.hikId)).toBe("superseded");
    await expectTransferError(f.caller.mutation(api.employeeTermination.retryTransfer, { transferId: transfer.transferId }), "TRANSFER_SUPERSEDED");
    await f.caller.mutation(api.employeeTermination.cancelTransfer, { transferId: transfer.transferId });
    expect((await f.state(transfer.transferId))?.status).toBe("cancelled");
    expect(await f.t.run(ctx => ctx.db.get(f.ids.employeeId))).toMatchObject({ isActive: true, cardNumber: "00123" });
    expect(await f.t.run(ctx => ctx.db.get(transfer.targetEmployeeId))).toBeNull();
    expect((await f.t.run(ctx => ctx.db.get(f.ids.employeeId)))?.terminationType).toBeUndefined();
    expect((await f.jobs()).slice(-2).map(job => job.name)).toEqual(["actions/hikvisionSync:syncEmployeeToDevicesInternal", "actions/ideGatewayDevice:syncEmployeeToIdePanels"]);
    expect(await f.t.run(ctx => ctx.db.get(f.ids.readingId))).toMatchObject({ cardNo: "00123" });
  });

  it("expires via the indexed cron, retries failed deletion with +24h, and accepts a late old ACK", async () => {
    const f = await fixture(); const transfer = await f.start();
    const op = (await f.ops()).ide[0];
    await f.t.mutation(internal.ideSync.markSent, { opId: op._id, msxId: 44 });
    await f.t.run(ctx => ctx.db.patch(op._id, { attempts: 50 }));
    await f.t.mutation(internal.ideSync.markAck, { opId: op._id, msxId: 44, result: "fail", message: "deneme sınırı" });
    expect(await f.targetState(transfer.transferId, f.ids.ideId)).toBe("failed");
    expect((await f.state(transfer.transferId))?.status).toBe("revoking");
    vi.setSystemTime(Date.now() + TRANSFER_WINDOW_MS + 1);
    expect(await f.t.mutation(internal.employeeTermination.expireTransfers, {})).toEqual({ stuck: 1 });
    await f.caller.mutation(api.employeeTermination.retryTransfer, { transferId: transfer.transferId });
    expect(await f.state(transfer.transferId)).toMatchObject({ status: "revoking", deadlineAt: Date.now() + TRANSFER_WINDOW_MS });
    expect((await f.ops()).ide.filter(row => row.status === "pending")).toHaveLength(1);
    await f.t.mutation(internal.ideSync.markAck, { opId: op._id, msxId: 45, result: "success" });
    expect(await f.targetState(transfer.transferId, f.ids.ideId)).toBe("pending");
    await f.t.mutation(internal.ideSync.markAck, { opId: op._id, msxId: 44, result: "success" });
    expect(await f.targetState(transfer.transferId, f.ids.ideId)).toBe("confirmed");
    await f.t.mutation(internal.ideSync.markAck, { opId: op._id, msxId: 44, result: "fail" });
    expect(await f.targetState(transfer.transferId, f.ids.ideId)).toBe("confirmed");
  });

  it("a terminal IDE timeout marks the transfer target failed and its late success confirms it", async () => {
    const f = await fixture(); const transfer = await f.start();
    const op = (await f.ops()).ide[0];
    await f.t.mutation(internal.ideSync.markSent, { opId: op._id, msxId: 9 });
    await f.t.run(ctx => ctx.db.patch(op._id, { attempts: 50 }));
    vi.setSystemTime(Date.now() + 120000);
    await f.t.mutation(internal.ideSync.requeueTimedOut, {});
    expect(await f.targetState(transfer.transferId, f.ids.ideId)).toBe("failed");
    vi.setSystemTime(Date.now() + TRANSFER_WINDOW_MS);
    await f.t.mutation(internal.employeeTermination.expireTransfers, {});
    expect((await f.state(transfer.transferId))?.status).toBe("stuck");
    await f.t.mutation(internal.ideSync.markAck, { opId: op._id, msxId: 9, result: "success" });
    expect(await f.targetState(transfer.transferId, f.ids.ideId)).toBe("confirmed");
    await f.hikDone();
    expect((await f.state(transfer.transferId))?.status).toBe("revoked");
  });

  it("removing the last unresolved source device closes deviceRemoved with audit and completes safely", async () => {
    const f = await fixture(); const transfer = await f.start();
    await f.hikDone();
    await f.caller.mutation(api.devices.remove, { deviceId: f.ids.ideId });
    expect(await f.targetState(transfer.transferId, f.ids.ideId)).toBe("deviceRemoved");
    expect((await f.state(transfer.transferId))?.status).toBe("revoked");
    expect(await f.t.run(ctx => ctx.db.query("auditLog").collect())).toEqual(expect.arrayContaining([expect.objectContaining({ userId: f.ids.userId, note: "Taşıma hedefi kapandı: cihaz kaynak projeden kaldırıldı" })]));
    await f.t.mutation(internal.employeeTermination.completeTransfer, { transferId: transfer.transferId });
    expect((await f.state(transfer.transferId))?.status).toBe("done");
  });

  it("returning a source panel to the pool closes the target through the same cascade", async () => {
    const f = await fixture(); const transfer = await f.start();
    await f.caller.mutation(api.devices.releaseDevice, { deviceId: f.ids.ideId });
    expect(await f.targetState(transfer.transferId, f.ids.ideId)).toBe("deviceRemoved");
    expect((await f.state(transfer.transferId))?.status).toBe("revoking");
    await f.hikDone();
    expect((await f.state(transfer.transferId))?.status).toBe("revoked");
  });

  it("a removed superseded device is the safe exit from a stuck revocation", async () => {
    const f = await fixture(); const transfer = await f.start();
    const op = (await f.ops()).hik[0];
    await f.t.mutation(internal.hikvisionSync.markOpSuperseded, { id: op._id, reason: "superseded" });
    await f.ideAck();
    expect((await f.state(transfer.transferId))?.status).toBe("stuck");
    await f.caller.mutation(api.devices.remove, { deviceId: f.ids.hikId });
    expect(await f.targetState(transfer.transferId, f.ids.hikId)).toBe("deviceRemoved");
    expect((await f.state(transfer.transferId))?.status).toBe("revoked");
  });

  it("deadline scan is paged and leaves future revocations untouched", async () => {
    const f = await fixture(); const transfer = await f.start();
    expect(await f.t.mutation(internal.employeeTermination.expireTransfers, {})).toEqual({ stuck: 0 });
    const current = await f.state(transfer.transferId);
    if (!current) throw new Error("Taşıma yok");
    const { _id: _transferId, _creationTime: _created, ...value } = current;
    await f.t.run(async ctx => {
      for (let i = 0; i < 51; i++) await ctx.db.insert("accessTransfers", { ...value, deadlineAt: Date.now() - 1 });
    });
    expect(await f.t.mutation(internal.employeeTermination.expireTransfers, {})).toEqual({ stuck: 50 });
    const continuation = (await f.jobs()).find(job => job.name === "employeeTermination:expireTransfers");
    expect(continuation).toBeDefined();
    const args: unknown = continuation?.args[0];
    const cursor = args && typeof args === "object" && "cursor" in args ? args.cursor : null;
    if (typeof cursor !== "string") throw new Error("Sayfalama cursor'ı yok");
    expect(await f.t.mutation(internal.employeeTermination.expireTransfers, { cursor })).toEqual({ stuck: 1 });
    expect((await f.state(transfer.transferId))?.status).toBe("revoking");
  });

  it("rechecks card uniqueness after acknowledgements before changing either record", async () => {
    const f = await fixture(); const transfer = await f.start();
    await f.hikDone(); await f.ideAck();
    await f.t.run(ctx => ctx.db.insert("employees", { projectId: f.ids.targetProjectId, firstName: "Çakışan", lastName: "Kişi", email: "other@test", cardNumber: "123", isActive: true }));
    await f.t.mutation(internal.employeeTermination.completeTransfer, { transferId: transfer.transferId });
    expect((await f.state(transfer.transferId))?.status).toBe("stuck");
    expect((await f.t.run(ctx => ctx.db.get(f.ids.employeeId)))?.cardNumber).toBe("00123");
    expect((await f.t.run(ctx => ctx.db.get(transfer.targetEmployeeId)))?.cardNumber).toBe("");
  });

  it("shows status from both records but hides counterpart employee/device data without project view", async () => {
    const f = await fixture(); const transfer = await f.start();
    const sourceView = await f.caller.query(api.employeeTermination.getEmployeeTransfer, { employeeId: f.ids.employeeId });
    expect(sourceView).toMatchObject({ status: "revoking", counterpartProjectName: "B", counterpartEmployeeId: transfer.targetEmployeeId, canCancel: true, canRetry: false });
    await f.t.run(ctx => ctx.db.delete(f.ids.sourceMembershipId));
    const targetView = await f.caller.query(api.employeeTermination.getEmployeeTransfer, { employeeId: transfer.targetEmployeeId });
    expect(targetView).toMatchObject({ counterpartProjectName: "A", counterpartEmployeeId: null, targets: [], canCancel: false });
    await expectTransferError(f.caller.query(api.employeeTermination.getEmployeeTransfer, { employeeId: f.ids.employeeId }), "TRANSFER_PERMISSION_DENIED");
    await expectTransferError(f.caller.mutation(api.employeeTermination.cancelTransfer, { transferId: transfer.transferId }), "TRANSFER_PERMISSION_DENIED");
  });

  it("mobile login selects the active B record with the historical A email", async () => {
    const f = await fixture({ noDevices: true }); const transfer = await f.start();
    const password = "Transferred-Synthetic-2026";
    await f.t.run(ctx => ctx.db.insert("employeeAuth", { employeeId: transfer.targetEmployeeId, projectId: f.ids.targetProjectId, passwordHash: bcrypt.hashSync(password, 4), createdAt: now, updatedAt: now }));
    const login = await f.t.mutation(api.employeeAuth.signIn, { email: "ada@example.test", password });
    expect(login).toMatchObject({ employee: { id: transfer.targetEmployeeId } });
  });
});


describe("transfer queue delivery guards", () => {
  it.each([false, true])("invalidates pending/failed IDE upserts including run jobs (%s) through completion", async withRun => {
    const f = await fixture();
    const runId = withRun ? await f.t.run(ctx => ctx.db.insert("deviceSyncRuns", { projectId: f.ids.sourceProjectId, kind: "project_resync", startedBy: f.ids.userId, startedAt: Date.now(), status: "running", counts: { queued: 0, sent: 0, verified: 0, failed: 0, skipped: 0, unknown: 0 } })) : undefined;
    const opId = await f.t.mutation(internal.ideSync.enqueueIdeOp, { deviceId: f.ids.ideId, projectId: f.ids.sourceProjectId, runId, opType: "upsertUser", payload: { userRecord: { id: 123, status: 1, permissions: [1] } } });
    if (withRun) await f.t.run(ctx => ctx.db.patch(opId, { status: "failed" }));
    const transfer = await f.start();
    expect(await f.t.run(ctx => ctx.db.get(opId))).toMatchObject({ status: "acked", lastError: "Taşıma başladı: geçersiz" });
    expect((await f.t.query(internal.ideSync.listPendingForBridge, {})).ops.every(op => op.opType !== "upsertUser")).toBe(true);
    await f.hikDone(); await f.ideAck();
    await f.t.mutation(internal.employeeTermination.completeTransfer, { transferId: transfer.transferId });
    expect((await f.state(transfer.transferId))?.status).toBe("done");
    expect((await f.t.mutation(internal.ideSync.pollForBridge, {})).ops).toEqual([]);
    expect((await f.ops()).ide.filter(op => op.opType === "upsertUser")).toMatchObject([{ status: "acked" }]);
  });

  it.each(["pending", "failed"] as const)("invalidates all Hik %s additions without marking a grant effective", async status => {
    const f = await fixture();
    const ids = await f.t.run(async ctx => {
      const ids: Id<"hikPendingOperations">[] = [];
      for (const operation of ["addPerson", "updatePerson", "addCard", "addFace", "addFingerprint"] as const) ids.push(await ctx.db.insert("hikPendingOperations", { deviceId: f.ids.hikId, projectId: f.ids.sourceProjectId, operation, payload: { employeeId: f.ids.employeeId }, status, attemptCount: 0, createdAt: Date.now() }));
      return ids;
    });
    await f.start();
    for (const id of ids) expect(await f.t.run(ctx => ctx.db.get(id))).toMatchObject({ status: "done", lastError: "Taşıma başladı: geçersiz" });
    expect(await f.t.run(ctx => ctx.db.query("accessGrantStatus").withIndex("by_employee_device", q => q.eq("employeeId", f.ids.employeeId).eq("deviceId", f.ids.hikId)).unique())).toMatchObject({ state: "pending" });
  });

  it.each(["ide", "hik"] as const)("rejects in-flight %s additions in preflight and start with no transfer writes", async brand => {
    const f = await fixture();
    if (brand === "ide") {
      const id = await f.t.mutation(internal.ideSync.enqueueIdeOp, { deviceId: f.ids.ideId, projectId: f.ids.sourceProjectId, opType: "upsertUser", payload: { employeeId: f.ids.employeeId, userRecord: { id: 123 } } });
      await f.t.mutation(internal.ideSync.markSent, { opId: id, msxId: 1 });
    } else await f.t.run(ctx => ctx.db.insert("hikPendingOperations", { deviceId: f.ids.hikId, projectId: f.ids.sourceProjectId, operation: "updatePerson", payload: { employeeId: f.ids.employeeId }, status: "processing", attemptCount: 1, createdAt: Date.now() }));
    expect((await f.caller.query(api.employeeTermination.transferPreflight, { employeeId: f.ids.employeeId, targetProjectId: f.ids.targetProjectId })).reasons).toContainEqual({ code: "TRANSFER_DEVICE_BUSY", message: `A ${brand === "ide" ? "IDE" : "Hik"} cihazına giden bir işlem sürüyor; birkaç dakika sonra tekrar deneyin.` });
    await expectTransferError(f.start(), "TRANSFER_DEVICE_BUSY", "birkaç dakika");
    expect(await f.t.run(ctx => ctx.db.query("accessTransfers").collect())).toEqual([]);
  });

  it("reserves polled IDE upserts before returning them and accepts the bridge sent callback", async () => {
    const f = await fixture();
    const id = await f.t.mutation(internal.ideSync.enqueueIdeOp, { deviceId: f.ids.ideId, projectId: f.ids.sourceProjectId, opType: "upsertUser", payload: { employeeId: f.ids.employeeId, userRecord: { id: 123 } } });
    expect((await f.t.mutation(internal.ideSync.pollForBridge, {})).ops).toMatchObject([{ opId: id }]);
    expect(await f.t.mutation(internal.ideSync.markSent, { opId: id, msxId: 33 })).toBe(true);
  });

  it("does not treat an unpublished IDE reservation as busy and invalidates it on start", async () => {
    const f = await fixture();
    const id = await f.t.mutation(internal.ideSync.enqueueIdeOp, { deviceId: f.ids.ideId, projectId: f.ids.sourceProjectId, opType: "upsertUser", payload: { employeeId: f.ids.employeeId, userRecord: { id: 123 } } });
    expect((await f.t.mutation(internal.ideSync.pollForBridge, {})).ops).toMatchObject([{ opId: id }]);
    expect((await f.caller.query(api.employeeTermination.transferPreflight, { employeeId: f.ids.employeeId, targetProjectId: f.ids.targetProjectId })).reasons).toEqual([]);
    await f.start();
    expect(await f.t.run(ctx => ctx.db.get(id))).toMatchObject({ status: "acked", lastError: "Taşıma başladı: geçersiz" });
    expect(await f.t.mutation(internal.ideSync.markSent, { opId: id, msxId: 33 })).toBe(false);
  });

  it("keeps IDE retry attempts after pre-delivery reservations and terminalizes exhausted retries", async () => {
    const f = await fixture();
    const id = await f.t.mutation(internal.ideSync.enqueueIdeOp, { deviceId: f.ids.ideId, projectId: f.ids.sourceProjectId, opType: "upsertUser", maxAttempts: 2, payload: { employeeId: f.ids.employeeId, userRecord: { id: 123 } } });
    for (const attempt of [1, 2]) {
      expect((await f.t.mutation(internal.ideSync.pollForBridge, {})).ops).toMatchObject([{ opId: id }]);
      expect(await f.t.run(ctx => ctx.db.get(id))).toMatchObject({ status: "sent", attempts: attempt - 1 });
      expect(await f.t.mutation(internal.ideSync.markSent, { opId: id, msxId: attempt })).toBe(true);
      expect(await f.t.run(ctx => ctx.db.get(id))).toMatchObject({ attempts: attempt });
      await f.t.mutation(internal.ideSync.markAck, { opId: id, msxId: attempt, result: "fail", message: "yeniden dene" });
      vi.advanceTimersByTime(120000);
    }
    expect(await f.t.run(ctx => ctx.db.get(id))).toMatchObject({ status: "failed", attempts: 2 });
  });

  it("treats dismissed processing Hik additions as in flight and leaves dismissed failed jobs alone", async () => {
    const f = await fixture();
    const id = await f.t.run(ctx => ctx.db.insert("hikPendingOperations", { deviceId: f.ids.hikId, projectId: f.ids.sourceProjectId, operation: "addPerson", payload: { employeeId: f.ids.employeeId }, status: "processing", attemptCount: 1, dismissedAt: Date.now(), createdAt: Date.now() }));
    await expectTransferError(f.start(), "TRANSFER_DEVICE_BUSY");
    await f.t.run(ctx => ctx.db.patch(id, { status: "failed" }));
    await f.start();
    expect(await f.t.run(ctx => ctx.db.get(id))).toMatchObject({ status: "failed", dismissedAt: Date.now() });
  });

  it.each([true, false])("terminalizes gateway retries with/without a stored plan (%s), including after done", async plan => {
    const f = await fixture(); const transfer = await f.start();
    await f.hikDone(); await f.ideAck();
    await f.t.mutation(internal.employeeTermination.completeTransfer, { transferId: transfer.transferId });
    const opId = await f.t.run(ctx => ctx.db.insert("hikPendingOperations", { deviceId: f.ids.hikId, projectId: f.ids.sourceProjectId, operation: plan ? "addPerson" : "updatePerson", payload: { employeeId: f.ids.employeeId, ...(plan ? { planTemplateNo: 1 } : {}) }, status: "failed", attemptCount: 1, createdAt: Date.now() }));
    const fetch = vi.fn(() => { throw new Error("Cihaz isteği gönderilmemeli"); }); vi.stubGlobal("fetch", fetch);
    expect(await f.t.action(internal.actions.hikQueueWorker.processHikOperation, { issueId: opId })).toEqual({ retried: 0, ok: 0, failed: 0 });
    expect(fetch).not.toHaveBeenCalled();
    expect(await f.t.run(ctx => ctx.db.get(opId))).toMatchObject({ status: "done", lastError: "Taşıma başladı: geçersiz" });
  });

  it("reserves eligible Hik retries and recovers a crashed worker reservation", async () => {
    const f = await fixture();
    const id = await f.t.run(ctx => ctx.db.insert("hikPendingOperations", { deviceId: f.ids.hikId, projectId: f.ids.sourceProjectId, operation: "addPerson", payload: { employeeId: f.ids.employeeId, planTemplateNo: 1 }, status: "failed", attemptCount: 1, createdAt: Date.now() }));
    expect(await f.t.mutation(internal.hikvisionSync.listRetryCandidates, { issueId: id, limit: 1, maxAttempts: 5, onlineWindowMs: 300000 })).toHaveLength(1);
    await expectTransferError(f.start(), "TRANSFER_DEVICE_BUSY");
    vi.advanceTimersByTime(120001);
    expect(await f.t.mutation(internal.hikvisionSync.listRetryCandidates, { issueId: id, limit: 1, maxAttempts: 5, onlineWindowMs: 300000 })).toHaveLength(1);
    expect(await f.t.run(ctx => ctx.db.get(id))).toMatchObject({ status: "processing", processingStartedAt: Date.now() });
  });

  it("blocks legacy IDE, local bridge, and active-source additions without relying on isActive", async () => {
    const f = await fixture({ localBridge: true }); const transfer = await f.start();
    await f.t.run(ctx => ctx.db.patch(f.ids.employeeId, { terminationType: undefined, isActive: true }));
    const ideId = await f.t.mutation(internal.ideSync.enqueueIdeOp, { deviceId: f.ids.ideId, projectId: f.ids.sourceProjectId, opType: "upsertUser", payload: { userRecord: { id: 123, status: 1 } } });
    const hikId = await f.t.mutation(internal.hikvisionSync.enqueueLocalBridgeOperation, { deviceId: f.ids.hikId, projectId: f.ids.sourceProjectId, operation: "addPerson", payload: { employeeId: f.ids.employeeId, cardNumber: "00123" } });
    expect((await f.t.query(internal.ideSync.listPendingForBridge, {})).ops.some(op => op.opId === ideId)).toBe(false);
    expect((await f.t.mutation(internal.ideSync.pollForBridge, {})).ops.some(op => op.opId === ideId)).toBe(false);
    expect(await f.t.run(ctx => ctx.db.get(ideId))).toMatchObject({ status: "acked", lastError: "Taşıma başladı: geçersiz" });
    const claimed = await f.t.mutation(internal.hikvisionSync.claimLocalBridgeOperations, { token: "bridge-token", max: 25 });
    expect(JSON.stringify(claimed)).not.toContain(hikId);
    expect(await f.t.run(ctx => ctx.db.get(hikId))).toMatchObject({ status: "done", lastError: "Taşıma başladı: geçersiz" });
    expect((await f.targets(transfer.transferId)).every(row => row.state === "pending")).toBe(true);
  });

  it.each(["ide", "hik"] as const)("does not block ordinary inactive %s additions", async brand => {
    const f = await fixture({ localBridge: true });
    await f.t.run(ctx => ctx.db.patch(f.ids.employeeId, { isActive: false }));
    if (brand === "ide") {
      const id = await f.t.mutation(internal.ideSync.enqueueIdeOp, { deviceId: f.ids.ideId, projectId: f.ids.sourceProjectId, opType: "upsertUser", payload: { employeeId: f.ids.employeeId, userRecord: { id: 123, status: 0 } } });
      expect((await f.t.mutation(internal.ideSync.pollForBridge, {})).ops).toMatchObject([{ opId: id }]);
    } else {
      const id = await f.t.mutation(internal.hikvisionSync.enqueueLocalBridgeOperation, { deviceId: f.ids.hikId, projectId: f.ids.sourceProjectId, operation: "addPerson", payload: { employeeId: f.ids.employeeId, cardNumber: "00123" } });
      expect(JSON.stringify(await f.t.mutation(internal.hikvisionSync.claimLocalBridgeOperations, { token: "bridge-token" }))).toContain(id);
    }
  });

  it.each(["ide", "hik"] as const)("ignores pre-transfer %s deletion ACKs even when they arrive late", async brand => {
    const f = await fixture();
    const oldId = brand === "ide"
      ? await f.t.mutation(internal.ideSync.enqueueIdeOp, { deviceId: f.ids.ideId, projectId: f.ids.sourceProjectId, opType: "deleteUser", payload: { employeeId: f.ids.employeeId, ideUserId: 123 } })
      : await f.t.mutation(internal.hikvisionSync.beginPersonDeletion, { deviceId: f.ids.hikId, projectId: f.ids.sourceProjectId, employeeId: f.ids.employeeId, cardNumber: "00123" });
    vi.advanceTimersByTime(1000);
    const transfer = await f.start();
    if (brand === "ide") {
      await f.t.mutation(internal.ideSync.markSent, { opId: oldId as Id<"idePendingOperations">, msxId: 88 });
      await f.t.mutation(internal.ideSync.markAck, { opId: oldId as Id<"idePendingOperations">, msxId: 88, result: "success" });
    } else await f.t.mutation(internal.hikvisionSync.markOpDone, { id: oldId as Id<"hikPendingOperations"> });
    expect((await f.targets(transfer.transferId)).every(row => row.state === "pending")).toBe(true);
    await f.hikDone();
    // hikDone may address the already completed old deletion; acknowledge the fresh row explicitly.
    const freshHik = (await f.ops()).hik.find(op => op.operation === "deletePerson" && op.status !== "done");
    if (freshHik) await f.t.mutation(internal.hikvisionSync.markOpDone, { id: freshHik._id });
    await f.ideAck();
    expect((await f.state(transfer.transferId))?.status).toBe("revoked");
  });

  it("does not count 600 unrelated failures per candidate device against transfer limits", async () => {
    const f = await fixture({ noDevices: true });
    await f.t.run(async ctx => {
      for (let i = 0; i < 600; i++) {
        await ctx.db.insert("hikPendingOperations", { deviceId: f.ids.hikId, projectId: f.ids.sourceProjectId, operation: "addPerson", payload: { cardNumber: `other-${i}` }, status: "failed", attemptCount: 1, createdAt: Date.now() });
        await ctx.db.insert("idePendingOperations", { deviceId: f.ids.ideId, projectId: f.ids.sourceProjectId, opType: "upsertUser", payload: { userRecord: { id: 1000 + i } }, idempotencyKey: `unrelated-${i}`, status: "failed", attempts: 1, createdAt: Date.now() });
      }
      await ctx.db.insert("hikPendingOperations", { deviceId: f.ids.hikId, projectId: f.ids.sourceProjectId, operation: "deletePerson", payload: { cardNumber: "00123" }, status: "failed", attemptCount: 1, createdAt: Date.now() });
    });
    expect(await f.caller.query(api.employeeTermination.transferPreflight, { employeeId: f.ids.employeeId, targetProjectId: f.ids.targetProjectId })).toMatchObject({ reasons: [], targetDeviceCount: 1 });
    const transfer = await f.start();
    expect((await f.targets(transfer.transferId)).map(row => row.deviceId)).toEqual([f.ids.hikId]);
    expect((await f.ops()).hik.filter(op => op.payload.cardNumber?.startsWith("other-") && op.status === "failed")).toHaveLength(600);
  });

  it("sets the administrative password on active B instead of transferred A", async () => {
    const f = await fixture({ noDevices: true }); const transfer = await f.start();
    expect((await f.t.query(internal.employees.getByEmailInternal, { email: " ADA@example.test " }))?._id).toBe(transfer.targetEmployeeId);
    const password = "NewSecure123!";
    expect(await f.t.action(internal.actions.setPassword.adminSetEmployeePassword, { email: "ada@example.test", password })).toEqual({ success: true });
    expect(await f.t.run(ctx => ctx.db.query("employeeAuth").withIndex("by_employee", q => q.eq("employeeId", f.ids.employeeId)).collect())).toEqual([]);
    const login = await f.t.mutation(api.employeeAuth.signIn, { email: "ada@example.test", password });
    expect(login).toMatchObject({ employee: { id: transfer.targetEmployeeId } });
  });
});


describe("K-02 fix2 regressions", () => {
  it("keeps old bridge reservations retryable without consuming attempts across six login-less polls", async () => {
    const f = await fixture();
    const id = await f.t.mutation(internal.ideSync.enqueueIdeOp, { deviceId: f.ids.ideId, projectId: f.ids.sourceProjectId, opType: "upsertUser", payload: { employeeId: f.ids.employeeId, userRecord: { id: 123 } } });
    for (let i = 0; i < 6; i++) {
      expect((await f.t.mutation(internal.ideSync.pollForBridge, {})).ops).toMatchObject([{ opId: id }]);
      expect(await f.t.run(ctx => ctx.db.get(id))).toMatchObject({ status: "sent", attempts: 0 });
      vi.advanceTimersByTime(90001);
    }
    await f.t.mutation(internal.ideSync.requeueTimedOut, {});
    expect(await f.t.run(ctx => ctx.db.get(id))).toMatchObject({ status: "pending", attempts: 0 });
  });

  it("counts new bridge /sent calls and terminalizes at five actual attempts", async () => {
    const f = await fixture();
    const id = await f.t.mutation(internal.ideSync.enqueueIdeOp, { deviceId: f.ids.ideId, projectId: f.ids.sourceProjectId, opType: "upsertUser", payload: { employeeId: f.ids.employeeId, userRecord: { id: 123 } } });
    for (let attempt = 1; attempt <= 5; attempt++) {
      await f.t.mutation(internal.ideSync.pollForBridge, {});
      expect(await f.t.mutation(internal.ideSync.markSent, { opId: id, msxId: attempt })).toBe(true);
      vi.advanceTimersByTime(90001);
      await f.t.mutation(internal.ideSync.requeueTimedOut, {});
      expect(await f.t.run(ctx => ctx.db.get(id))).toMatchObject({ attempts: attempt, status: attempt === 5 ? "failed" : "pending" });
    }
  });

  it.each(["revoked", "done"] as const)("requeues late effective writes after %s using the source credential", async status => {
    const f = await fixture(); const transfer = await f.start();
    await f.hikDone(); await f.ideAck();
    if (status === "done") await f.t.mutation(internal.employeeTermination.completeTransfer, { transferId: transfer.transferId });
    const before = (await f.ops()).hik.length;
    await f.t.run(ctx => upsertGrantStatus(ctx, { projectId: f.ids.sourceProjectId, employeeId: f.ids.employeeId, deviceId: f.ids.hikId, state: "effective" }));
    const jobs = (await f.ops()).hik;
    expect(jobs).toHaveLength(before + 1);
    expect(jobs[jobs.length - 1]).toMatchObject({ status: "failed", operation: "deletePerson", payload: { employeeId: f.ids.employeeId, cardNumber: "00123", transferId: transfer.transferId } });
    expect((await f.targets(transfer.transferId)).find(row => row.deviceId === f.ids.hikId)).toMatchObject({ state: "pending" });
    expect(await f.t.run(ctx => ctx.db.query("accessGrantStatus").withIndex("by_employee_device", q => q.eq("employeeId", f.ids.employeeId).eq("deviceId", f.ids.hikId)).unique())).not.toMatchObject({ state: "effective" });
    expect((await f.t.run(ctx => ctx.db.query("auditLog").collect())).some(row => row.note?.includes("geç yazım yakalandı"))).toBe(true);
    if (status === "revoked") expect((await f.state(transfer.transferId))?.status).toBe("revoking");
    const cleanup = jobs[jobs.length - 1];
    if (!cleanup) throw new Error("Missing cleanup");
    await f.t.mutation(internal.hikvisionSync.markOpDone, { id: cleanup._id });
    expect(await f.targetState(transfer.transferId, f.ids.hikId)).toBe("confirmed");
  });

  it.each([true, false])("matches deletion acknowledgement by transferId before timestamp (matching=%s)", async matching => {
    const f = await fixture(); const transfer = await f.start();
    const op = (await f.ops()).hik[0];
    if (!op) throw new Error("Missing deletion");
    await f.t.run(async ctx => {
      // Same-transfer explicit identity must beat an intentionally newer requestedAt.
      await ctx.db.patch(transfer.transferId, { requestedAt: Date.now() + 1000 });
      if (!matching) await ctx.db.patch(op._id, { payload: { ...op.payload, transferId: "different-transfer" } });
    });
    await f.t.mutation(internal.hikvisionSync.markOpDone, { id: op._id });
    expect(await f.targetState(transfer.transferId, f.ids.hikId)).toBe(matching ? "confirmed" : "pending");
  });

  it("skips an over-limit legacy addition while delivering other poll/retry jobs", async () => {
    const f = await fixture({ localBridge: true }); const transfer = await f.start();
    await f.t.run(async ctx => {
      for (let i = 0; i < 501; i++) for (const deviceId of [f.ids.ideId, f.ids.hikId]) {
        await ctx.db.insert("accessTransferTargets", { transferId: transfer.transferId, employeeId: f.ids.employeeId, deviceId, brand: deviceId === f.ids.ideId ? "ide_smart" : "hikvision", state: "pending", updatedAt: Date.now() });
      }
    });
    const legacy = await f.t.mutation(internal.ideSync.enqueueIdeOp, { deviceId: f.ids.ideId, projectId: f.ids.sourceProjectId, opType: "upsertUser", payload: { userRecord: { id: 98765 } } });
    const other = await f.t.mutation(internal.ideSync.enqueueIdeOp, { deviceId: f.ids.ideId, projectId: f.ids.sourceProjectId, opType: "upsertPermission", payload: { permissionRecord: { id: 45 } } });
    const poll = await f.t.mutation(internal.ideSync.pollForBridge, {});
    expect(poll.ops.some(op => op.opId === legacy)).toBe(false);
    expect(poll.ops.some(op => op.opId === other)).toBe(true);
    const legacyHik = await f.t.run(ctx => ctx.db.insert("hikPendingOperations", { deviceId: f.ids.hikId, projectId: f.ids.sourceProjectId, operation: "addPerson", payload: { cardNumber: "98765" }, status: "failed", attemptCount: 1, createdAt: Date.now() }));
    expect(await f.t.mutation(internal.hikvisionSync.listRetryCandidates, { issueId: legacyHik, limit: 1, maxAttempts: 5, onlineWindowMs: 300000 })).toEqual([]);
  });
});


it.each(["ide", "localBridge"] as const)("uses transferId before timestamp for %s acknowledgements", async brand => {
  for (const matching of [true, false]) {
    const f = await fixture({ localBridge: true }); const transfer = await f.start();
    const jobs = await f.ops();
    await f.t.run(ctx => ctx.db.patch(transfer.transferId, { requestedAt: Date.now() + 1000 }));
    if (brand === "ide") {
      const op = jobs.ide[0];
      if (!op) throw new Error("Missing IDE deletion");
      expect(op.payload.transferId).toBe(transfer.transferId);
      if (!matching) await f.t.run(ctx => ctx.db.patch(op._id, { payload: { ...op.payload, transferId: "different-transfer" } }));
      await f.t.mutation(internal.ideSync.markSent, { opId: op._id, msxId: 1 });
      await f.t.mutation(internal.ideSync.markAck, { opId: op._id, msxId: 1, result: "success" });
    } else {
      const op = jobs.hik[0];
      if (!op) throw new Error("Missing local deletion");
      expect(op.payload.transferId).toBe(transfer.transferId);
      if (!matching) await f.t.run(ctx => ctx.db.patch(op._id, { payload: { ...op.payload, transferId: "different-transfer" } }));
      await f.t.mutation(internal.hikvisionSync.claimLocalBridgeOperations, { token: "bridge-token" });
      await f.t.mutation(internal.hikvisionSync.ackLocalBridgeOperation, { token: "bridge-token", opId: op._id, ok: true });
    }
    expect(await f.targetState(transfer.transferId, brand === "ide" ? f.ids.ideId : f.ids.hikId)).toBe(matching ? "confirmed" : "pending");
  }
});

it.each(["revoking", "done"] as const)("finds the current %s source transfer behind many cancelled runs", async status => {
  const f = await fixture(); const transfer = await f.start();
  const crowd = async () => f.t.run(async ctx => {
    const current = await ctx.db.get(transfer.transferId);
    if (!current) throw new Error("Missing transfer");
    const { _id, _creationTime, ...fields } = current;
    for (let index = 0; index < 55; index++) await ctx.db.insert("accessTransfers", { ...fields, status: "cancelled", requestedAt: fields.requestedAt + index + 1 });
  });
  if (status === "revoking") {
    await crowd();
    await f.hikDone(); await f.ideAck();
    expect((await f.state(transfer.transferId))?.status).toBe("revoked");
    return;
  }
  await f.hikDone(); await f.ideAck();
  await f.t.mutation(internal.employeeTermination.completeTransfer, { transferId: transfer.transferId });
  await crowd();
  const before = (await f.ops()).hik.length;
  await f.t.run(ctx => upsertGrantStatus(ctx, { projectId: f.ids.sourceProjectId, employeeId: f.ids.employeeId, deviceId: f.ids.hikId, state: "effective" }));
  const jobs = (await f.ops()).hik;
  expect(jobs).toHaveLength(before + 1);
  expect(jobs[jobs.length - 1]).toMatchObject({ payload: { transferId: transfer.transferId } });
});

it("keeps a failed late-write cleanup visible on a done transfer target", async () => {
  const f = await fixture(); const transfer = await f.start();
  await f.hikDone(); await f.ideAck();
  await f.t.mutation(internal.employeeTermination.completeTransfer, { transferId: transfer.transferId });
  const before = (await f.ops()).ide.length;
  await f.t.run(ctx => upsertGrantStatus(ctx, { projectId: f.ids.sourceProjectId, employeeId: f.ids.employeeId, deviceId: f.ids.ideId, state: "effective" }));
  const cleanup = (await f.ops()).ide[before];
  if (!cleanup) throw new Error("Missing cleanup");
  await f.t.mutation(internal.ideSync.markSent, { opId: cleanup._id, msxId: 77 });
  await f.t.run(ctx => ctx.db.patch(cleanup._id, { attempts: 50 }));
  vi.setSystemTime(Date.now() + 120000);
  await f.t.mutation(internal.ideSync.requeueTimedOut, {});
  expect(await f.targetState(transfer.transferId, f.ids.ideId)).toBe("failed");
  expect((await f.state(transfer.transferId))?.status).toBe("done");
});

it("suppresses active-source effective writes even before termination metadata, within source project only", async () => {
  const f = await fixture(); const transfer = await f.start();
  await f.t.run(ctx => ctx.db.patch(f.ids.employeeId, { terminationType: undefined }));
  const before = (await f.ops()).hik.length;
  await f.t.run(ctx => upsertGrantStatus(ctx, { projectId: f.ids.targetProjectId, employeeId: f.ids.employeeId, deviceId: f.ids.hikId, state: "effective" }));
  expect((await f.ops()).hik).toHaveLength(before);
  await f.t.run(ctx => upsertGrantStatus(ctx, { projectId: f.ids.sourceProjectId, employeeId: f.ids.employeeId, deviceId: f.ids.hikId, state: "effective" }));
  expect((await f.ops()).hik).toHaveLength(before + 1);
  expect(await f.targetState(transfer.transferId, f.ids.hikId)).toBe("pending");
});
