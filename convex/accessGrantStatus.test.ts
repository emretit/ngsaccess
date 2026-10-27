// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import type { Id } from "./_generated/dataModel";
import { counts as grantCounts } from "./accessGrantStatus";
import { getFunctionName, type FunctionReference, type FunctionArgs, type FunctionReturnType } from "convex/server";
import type { Value } from "convex/values";
import type { ActionCtx, QueryCtx } from "./_generated/server";
import { syncEmployeeToDevicesInternal, syncWeekPlanToDevicesInternal } from "./actions/hikvisionSync";
import { enqueueIdeOpInTransaction } from "./ideSync";
import { enqueueLocalBridgeOperationInTransaction } from "./hikvisionSync";
import { upsertGrantStatus } from "./lib/grantStatus";
const wire = vi.hoisted(() => ({ card: vi.fn(async (): Promise<{ ok: boolean; error?: string }> => ({ ok: true })), send: vi.fn(async (): Promise<{ ok: boolean; error?: string }> => ({ ok: true })) }));
vi.mock("./lib/hikGateway", async original => ({
  ...await original<typeof import("./lib/hikGateway")>(),
  upsertPersonToDevice: wire.send, setWeekPlanOnDevice: wire.send, setPlanTemplate: wire.send,
  addCardToDevice: wire.card, deletePersonFromDevice: wire.send,
}));
const modules = import.meta.glob("./**/*.ts");
const now = "2026-10-22T09:00:00.000Z";
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(now)); wire.send.mockReset().mockResolvedValue({ ok: true }); wire.card.mockReset().mockResolvedValue({ ok: true }); });
afterEach(() => vi.useRealTimers());
async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "A" });
    const otherProjectId = await ctx.db.insert("projects", { name: "B" });
    const adminId = await ctx.db.insert("users", { role: "project_admin" });
    const readerId = await ctx.db.insert("users", { role: "project_user" });
    const adminSession = await ctx.db.insert("authSessions", { userId: adminId, expirationTime: Date.now() + 86400000 });
    const readerSession = await ctx.db.insert("authSessions", { userId: readerId, expirationTime: Date.now() + 86400000 });
    for (const userId of [adminId, readerId]) await ctx.db.insert("userProjects", { userId, projectId });
    const departmentId = await ctx.db.insert("departments", { name: "Arge", projectId });
    const employeeId = await ctx.db.insert("employees", { projectId, departmentId, firstName: "Deniz", lastName: "Test", email: "test@example.test", cardNumber: "123", isActive: true });
    const base = { projectId, name: "Panel", isActive: true, createdAt: now, updatedAt: now, status: "online" };
    const ideId = await ctx.db.insert("devices", { ...base, brand: "ide_smart", ideUuid: "uuid", ideUser: "a", idePassword: "b" });
    const hikId = await ctx.db.insert("devices", { ...base, brand: "hikvision", hikDevIndex: "index", hikDoorCount: 2, hikLastSeenAt: Date.now() });
    const bridgeId = await ctx.db.insert("devices", { ...base, brand: "hikvision", hikTransport: "localBridge", hikDoorCount: 2, apiToken: "token" });
    const ruleId = await ctx.db.insert("accessRules", { projectId, name: "Mesai", isActive: true, hikWeekPlanNo: 2, idePermissionNo: 5, updatedAt: now });
    await ctx.db.insert("groupMembers", { projectId, groupId: ruleId, employeeId, createdAt: now });
    for (const deviceId of [ideId, hikId, bridgeId]) await ctx.db.insert("groupDevices", { projectId, groupId: ruleId, deviceId, createdAt: now });
    const ideDoorId = await ctx.db.insert("doors", { projectId, deviceId: ideId, name: "IDE kapı", ioId: 0 });
    const hikDoorId = await ctx.db.insert("doors", { projectId, deviceId: hikId, name: "Hik seçili", hikDoorNo: 1 });
    const unauthorizedDoorId = await ctx.db.insert("doors", { projectId, deviceId: hikId, name: "Hik kapalı", hikDoorNo: 2 });
    await ctx.db.insert("groupDoors", { projectId, groupId: ruleId, doorId: hikDoorId, deviceId: hikId, createdAt: now });
    return { projectId, otherProjectId, adminId, adminSession, readerId, readerSession, employeeId, departmentId, ideId, hikId, bridgeId, ruleId, ideDoorId, hikDoorId, unauthorizedDoorId };
  });
  const admin = t.withIdentity({ subject: `${ids.adminId}|${ids.adminSession}` });
  const reader = t.withIdentity({ subject: `${ids.readerId}|${ids.readerSession}` });
  const status = (deviceId = ids.ideId) => t.run(ctx => ctx.db.query("accessGrantStatus").withIndex("by_employee_device", q => q.eq("employeeId", ids.employeeId).eq("deviceId", deviceId)).unique());
  const write = (state: "pending" | "effective" | "failed" | "removed", deviceId = ids.ideId) => t.run(ctx => upsertGrantStatus(ctx, { projectId: ids.projectId, employeeId: ids.employeeId, deviceId, state, ruleIds: [ids.ruleId], lastError: state === "failed" ? "Hata" : undefined }));
  return { t, ids, admin, reader, status, write };
}

describe("grant status writes in existing queue transactions", () => {
  it("IDE enqueue pending, dedupe, success effective, inactive employee delete success removed", async () => {
    const { t, ids, status } = await fixture();
    const enqueue = () => t.mutation(internal.ideSync.enqueueIdeOp, { projectId: ids.projectId, deviceId: ids.ideId, opType: "upsertUser", payload: { employeeId: ids.employeeId, ruleIds: [ids.ruleId], userRecord: { id: 123, permissions: [5] } } });
    const opId = await enqueue();
    expect(await status()).toMatchObject({ state: "pending", departmentId: ids.departmentId, ruleIds: [ids.ruleId] });
    expect(await enqueue()).toBe(opId);
    await t.mutation(internal.ideSync.markSent, { opId, msxId: 1 });
    await t.mutation(internal.ideSync.markAck, { opId, result: "success", msxId: 1 });
    expect(await status()).toMatchObject({ state: "effective", appliedAt: Date.now() });
    await t.run(ctx => ctx.db.patch(ids.employeeId, { isActive: false }));
    const del = await t.mutation(internal.ideSync.enqueueIdeOp, { projectId: ids.projectId, deviceId: ids.ideId, opType: "deleteUser", payload: { employeeId: ids.employeeId, ideUserId: 123 } });
    await t.mutation(internal.ideSync.markSent, { opId: del, msxId: 2 });
    await t.mutation(internal.ideSync.markAck, { opId: del, result: "success", msxId: 2 });
    expect(await status()).toMatchObject({ state: "removed" });
    expect(await t.run(ctx => ctx.db.query("accessGrantStatus").take(10))).toHaveLength(1);
  });
  it("IDE fail stores message; retry success clears it; missing employeeId is skipped", async () => {
    const { t, ids, status } = await fixture();
    const opId = await t.mutation(internal.ideSync.enqueueIdeOp, { deviceId: ids.ideId, opType: "upsertUser", payload: { employeeId: ids.employeeId, userRecord: { id: 123 } } });
    await t.mutation(internal.ideSync.markSent, { opId, msxId: 1 });
    await t.mutation(internal.ideSync.markAck, { opId, result: "fail", message: "Cihaz reddetti" });
    expect(await status()).toMatchObject({ state: "failed", lastError: "Cihaz reddetti" });
    await t.mutation(internal.ideSync.markSent, { opId, msxId: 2 });
    await t.mutation(internal.ideSync.markAck, { opId, result: "success" });
    expect((await status())?.lastError).toBeUndefined();
    const legacy = await t.mutation(internal.ideSync.enqueueIdeOp, { deviceId: ids.ideId, opType: "deleteUser", payload: { ideUserId: 123 } });
    await t.mutation(internal.ideSync.markSent, { opId: legacy, msxId: 3 });
    await t.mutation(internal.ideSync.markAck, { opId: legacy, result: "success" });
    expect((await status())?.state).toBe("effective");
  });
  it("IDE terminal timeout and delete already absent have terminal status", async () => {
    const { t, ids, status } = await fixture();
    const opId = await t.mutation(internal.ideSync.enqueueIdeOp, { deviceId: ids.ideId, opType: "upsertUser", maxAttempts: 1, payload: { employeeId: ids.employeeId, userRecord: { id: 123 } } });
    await t.mutation(internal.ideSync.markSent, { opId, msxId: 1 });
    await t.mutation(internal.ideSync.markAck, { opId, result: "timeout" });
    expect(await status()).toMatchObject({ state: "failed", lastError: "timeout" });
    const del = await t.mutation(internal.ideSync.enqueueIdeOp, { deviceId: ids.ideId, opType: "deleteUser", payload: { employeeId: ids.employeeId, ideUserId: 123 } });
    await t.mutation(internal.ideSync.markSent, { opId: del, msxId: 2 });
    await t.mutation(internal.ideSync.markAck, { opId: del, result: "fail", message: "not found" });
    expect((await status())?.state).toBe("removed");
  });
  it("Hik bridge pending, ack effective/failed and removal; wrong token cannot write", async () => {
    const { t, ids, status } = await fixture();
    const opId = await t.mutation(internal.hikvisionSync.enqueueLocalBridgeOperation, { projectId: ids.projectId, deviceId: ids.bridgeId, operation: "addPerson", payload: { employeeId: ids.employeeId, employeeNo: "123", ruleIds: [ids.ruleId] } });
    expect((await status(ids.bridgeId))?.state).toBe("pending");
    await t.mutation(internal.hikvisionSync.ackLocalBridgeOperation, { token: "bad", opId, ok: true });
    expect((await status(ids.bridgeId))?.state).toBe("pending");
    await t.mutation(internal.hikvisionSync.claimLocalBridgeOperations, { token: "token" });
    await t.mutation(internal.hikvisionSync.ackLocalBridgeOperation, { token: "token", opId, ok: false, message: "Bağlantı yok" });
    expect(await status(ids.bridgeId)).toMatchObject({ state: "failed", lastError: "Bağlantı yok" });
    await t.run(ctx => ctx.db.patch(opId, { status: "processing" }));
    await t.mutation(internal.hikvisionSync.ackLocalBridgeOperation, { token: "token", opId, ok: true });
    expect(await status(ids.bridgeId)).toMatchObject({ state: "effective", appliedAt: Date.now() });
    await t.run(ctx => ctx.db.patch(ids.employeeId, { isActive: false }));
    const del = await t.mutation(internal.hikvisionSync.enqueueLocalBridgeOperation, { deviceId: ids.bridgeId, operation: "deleteCard", payload: { employeeId: ids.employeeId, cardNumber: "123" } });
    await t.mutation(internal.hikvisionSync.claimLocalBridgeOperations, { token: "token" });
    await t.mutation(internal.hikvisionSync.ackLocalBridgeOperation, { token: "token", opId: del, ok: true });
    expect((await status(ids.bridgeId))?.state).toBe("removed");
  });
  it("gateway HTTP success/failure/removal writes durable person-device results", async () => {
    const { t, ids, status } = await fixture();
    await t.action(internal.actions.hikvisionSync.syncEmployeeToDevicesInternal, { employeeId: ids.employeeId, targetDeviceIds: [ids.hikId] });
    expect(await status(ids.hikId)).toMatchObject({ state: "effective", ruleIds: [ids.ruleId] });
    wire.send.mockResolvedValue({ ok: false, error: "HTTP başarısız" });
    await t.action(internal.actions.hikvisionSync.syncEmployeeToDevicesInternal, { employeeId: ids.employeeId, targetDeviceIds: [ids.hikId] });
    expect(await status(ids.hikId)).toMatchObject({ state: "failed", lastError: "HTTP başarısız" });
    wire.send.mockResolvedValue({ ok: true });
    await t.run(ctx => ctx.db.patch(ids.employeeId, { isActive: false }));
    await t.action(internal.actions.hikvisionSync.deleteEmployeeFromDevicesInternal, { employeeId: ids.employeeId, targetDeviceIds: [ids.hikId] });
    expect((await status(ids.hikId))?.state).toBe("removed");
  });
  it("batch result writer upserts mixed success/failure/deletion and keeps departed employee rows", async () => {
    const { t, ids, status } = await fixture();
    await t.mutation(internal.accessGrantStatus.recordGrantResults, { results: [
      { projectId: ids.projectId, employeeId: ids.employeeId, deviceId: ids.ideId, state: "effective", ruleIds: [ids.ruleId] },
      { projectId: ids.projectId, employeeId: ids.employeeId, deviceId: ids.hikId, state: "failed", lastError: "Reddedildi" },
    ] });
    expect((await status())?.state).toBe("effective");
    expect((await status(ids.hikId))?.lastError).toBe("Reddedildi");
    await t.run(ctx => ctx.db.delete(ids.employeeId));
    await t.mutation(internal.accessGrantStatus.recordGrantResults, { results: [{ projectId: ids.projectId, employeeId: ids.employeeId, deviceId: ids.ideId, state: "removed" }] });
    expect(await status()).toMatchObject({ state: "removed", departmentId: ids.departmentId });
  });
});

describe("grant status queries", () => {
  it("03-H2: unresolved doors preserve effective state across list, filters, counts and failed redistribution", async () => {
    const { t, ids, admin, write, status } = await fixture();
    await write("effective");
    await t.run(ctx => ctx.db.patch(ids.ideDoorId, { ioId: undefined }));
    const original = await status();
    const args = { projectId: ids.projectId, paginationOpts: { numItems: 50, cursor: null } };
    expect((await admin.query(api.accessGrantStatus.listByProject, args)).page[0]).toMatchObject({ state: "effective", doorUnresolved: true });
    expect((await admin.query(api.accessGrantStatus.listByProject, { ...args, state: "effective" })).page[0]).toMatchObject({ state: "effective", doorUnresolved: true });
    expect((await admin.query(api.accessGrantStatus.listByProject, { ...args, state: "failed" })).page).toEqual([]);
    expect((await admin.query(api.accessGrantStatus.listByProject, { ...args, state: "failed", deviceId: ids.ideId })).page).toEqual([]);
    expect((await admin.query(api.accessGrantStatus.byEmployee, { employeeId: ids.employeeId })).rows.find(row => row.deviceId === ids.ideId)).toMatchObject({ state: "effective", doorUnresolved: true });
    expect(await admin.query(api.accessGrantStatus.counts, { projectId: ids.projectId })).toMatchObject({ effective: 1, failed: 0 });
    expect(await admin.query(api.accessGrantStatus.counts, { projectId: ids.projectId, deviceId: ids.ideId })).toMatchObject({ effective: 1, failed: 0 });
    await expect(admin.mutation(api.accessGrantStatus.redistribute, { projectId: ids.projectId, onlyFailed: true })).rejects.toThrow();
    expect(await status()).toEqual(original);
  });
  it("03-H2: unresolved doors remain a separate warning for unknown and stored pending, failed and removed states", async () => {
    const { t, ids, admin, write } = await fixture();
    await t.run(ctx => ctx.db.patch(ids.ideDoorId, { ioId: undefined }));
    const detail = () => admin.query(api.accessGrantStatus.byEmployee, { employeeId: ids.employeeId });
    expect((await detail()).rows.find(row => row.deviceId === ids.ideId)).toMatchObject({ state: "unknown", doorUnresolved: true });
    for (const state of ["pending", "failed", "removed"] as const) {
      await write(state);
      expect((await detail()).rows.find(row => row.deviceId === ids.ideId)).toMatchObject({ state, doorUnresolved: true });
    }
  });
  it("denies project_user for all reads and writes and foreign project admin reads", async () => {
    const { admin, reader, ids } = await fixture();
    await expect(reader.query(api.accessGrantStatus.listByProject, { projectId: ids.projectId, paginationOpts: { numItems: 50, cursor: null } })).rejects.toThrow("yetkiniz");
    await expect(reader.query(api.accessGrantStatus.counts, { projectId: ids.projectId })).rejects.toThrow("yetkiniz");
    await expect(reader.query(api.accessGrantStatus.byEmployee, { employeeId: ids.employeeId })).rejects.toThrow("yetkiniz");
    await expect(reader.mutation(api.accessGrantStatus.redistribute, { projectId: ids.projectId })).rejects.toThrow("yetkiniz");
    await expect(admin.query(api.accessGrantStatus.counts, { projectId: ids.otherProjectId })).rejects.toThrow("yetkiniz");
  });
  it("paginates indexed rows and filters complete bounded sets before paging", async () => {
    const { admin, ids, write } = await fixture();
    await write("effective"); await write("failed", ids.hikId); await write("removed", ids.bridgeId);
    const args = { projectId: ids.projectId, paginationOpts: { numItems: 1, cursor: null } };
    const first = await admin.query(api.accessGrantStatus.listByProject, args);
    expect(first.page).toHaveLength(1); expect(first.isDone).toBe(false);
    const second = await admin.query(api.accessGrantStatus.listByProject, { ...args, paginationOpts: { numItems: 1, cursor: first.continueCursor } });
    expect(second.page[0]?._id).not.toBe(first.page[0]?._id);
    const filtered = await admin.query(api.accessGrantStatus.listByProject, { ...args, state: "failed", departmentId: ids.departmentId, deviceId: ids.hikId, ruleId: ids.ruleId, search: "deniz" });
    expect(filtered.page).toHaveLength(1); expect(filtered.boundedScan).toBe(true);
    expect(filtered.page[0]).toMatchObject({ employeeName: "Deniz Test", departmentName: "Arge", doorNames: ["Hik seçili"], ruleNames: ["Mesai"] });
    await expect(admin.query(api.accessGrantStatus.listByProject, { ...args, paginationOpts: { numItems: 51, cursor: null } })).rejects.toThrow("50");
  });
  it("marks rule changes stale without rewriting grant rows", async () => {
    const { t, ids, admin, write, status } = await fixture();
    await write("effective");
    const original = await status();
    const args = { projectId: ids.projectId, ruleId: ids.ruleId, paginationOpts: { numItems: 50, cursor: null } };
    expect((await admin.query(api.accessGrantStatus.listByProject, args)).page[0]?.stale).toBe(false);
    await t.run(ctx => ctx.db.patch(ids.ruleId, { updatedAt: new Date(Date.now() + 1).toISOString() }));
    const result = await admin.query(api.accessGrantStatus.listByProject, args);
    expect(result.page[0]).toMatchObject({ stale: true, ruleNames: ["Mesai"] });
    expect(await status()).toEqual(original);
    expect((await admin.query(api.accessGrantStatus.byEmployee, { employeeId: ids.employeeId })).rows.find(row => row.deviceId === ids.ideId)?.stale).toBe(true);
  });
  it("byEmployee separates unknown, removalRequired, and unauthorized doors", async () => {
    const { t, ids, admin, write } = await fixture();
    const initial = await admin.query(api.accessGrantStatus.byEmployee, { employeeId: ids.employeeId });
    expect(initial.rows).toHaveLength(3);
    expect(initial.rows.every(row => row.state === "unknown" && row.authorized)).toBe(true);
    expect(initial.unauthorizedDoors).toEqual([{ doorId: ids.unauthorizedDoorId, doorName: "Hik kapalı", deviceId: ids.hikId, state: "unauthorized" }]);
    await write("effective");
    await t.run(ctx => ctx.db.patch(ids.ruleId, { isActive: false }));
    const after = await admin.query(api.accessGrantStatus.byEmployee, { employeeId: ids.employeeId });
    expect(after.rows).toHaveLength(1); expect(after.rows[0]).toMatchObject({ authorized: false, removalRequired: true, state: "effective" });
    expect(after.unauthorizedDoors).toHaveLength(3);
  });
  it("counts unknown graph pairs and department filters", async () => {
    const { admin, ids, write } = await fixture();
    expect(await admin.query(api.accessGrantStatus.counts, { projectId: ids.projectId })).toEqual({ personCount: 1, all: 3, effective: 0, pending: 0, failed: 0, removed: 0, unknown: 3, capped: false });
    await write("effective"); await write("failed", ids.hikId);
    expect(await admin.query(api.accessGrantStatus.counts, { projectId: ids.projectId, departmentId: ids.departmentId })).toEqual({ personCount: 1, all: 3, effective: 1, pending: 0, failed: 1, removed: 0, unknown: 1, capped: false });
  });
  it("lists unknown graph pairs with filters and scan paging; stored pairs drop out", async () => {
    const { admin, ids, write } = await fixture();
    const args = { projectId: ids.projectId, state: "unknown" as const, paginationOpts: { numItems: 2, cursor: null } };
    const first = await admin.query(api.accessGrantStatus.listByProject, args);
    expect(first.page).toHaveLength(2); expect(first.isDone).toBe(false); expect(first.boundedScan).toBe(true);
    expect(first.page[0]).toMatchObject({ _id: null, state: "unknown", employeeName: "Deniz Test", ruleNames: ["Mesai"] });
    const second = await admin.query(api.accessGrantStatus.listByProject, { ...args, paginationOpts: { numItems: 2, cursor: first.continueCursor } });
    expect(second.page).toHaveLength(1); expect(second.isDone).toBe(true);
    expect(new Set([...first.page, ...second.page].map(row => row.deviceId))).toEqual(new Set([ids.ideId, ids.hikId, ids.bridgeId]));
    const hik = await admin.query(api.accessGrantStatus.listByProject, { ...args, deviceId: ids.hikId, departmentId: ids.departmentId, ruleId: ids.ruleId, search: "deniz" });
    expect(hik.page).toHaveLength(1); expect(hik.page[0]).toMatchObject({ deviceId: ids.hikId, doorNames: ["Hik seçili"], departmentName: "Arge" });
    expect((await admin.query(api.accessGrantStatus.listByProject, { ...args, search: "yok" })).page).toEqual([]);
    await write("effective");
    const rest = await admin.query(api.accessGrantStatus.listByProject, { ...args, paginationOpts: { numItems: 50, cursor: null } });
    expect(rest.page.map(row => row.deviceId).sort()).toEqual([ids.hikId, ids.bridgeId].sort());
    expect((await admin.query(api.accessGrantStatus.counts, { projectId: ids.projectId })).unknown).toBe(rest.page.length);
  });
  it("03-O2: counts unique people across stored and unknown pairs independently of list search", async () => {
    const { t, ids, admin, write } = await fixture();
    await write("effective");
    await t.run(async ctx => {
      const secondEmployee = await ctx.db.insert("employees", { projectId: ids.projectId, departmentId: ids.departmentId, firstName: "Ayşe", lastName: "Yılmaz", email: "ayse@example.test", cardNumber: "234", isActive: true });
      await ctx.db.insert("groupMembers", { projectId: ids.projectId, groupId: ids.ruleId, employeeId: secondEmployee, createdAt: now });
      // A stored-only person remains part of the summary even without an active rule.
      const storedEmployee = await ctx.db.insert("employees", { projectId: ids.projectId, firstName: "Ece", lastName: "Test", email: "ece@example.test", cardNumber: "345", isActive: false });
      await upsertGrantStatus(ctx, { projectId: ids.projectId, employeeId: storedEmployee, deviceId: ids.ideId, state: "removed", ruleIds: [] });
    });
    const summary = await admin.query(api.accessGrantStatus.counts, { projectId: ids.projectId });
    expect(summary).toMatchObject({ personCount: 3, all: 7, unknown: 5, capped: false });
    const unfiltered = await admin.query(api.accessGrantStatus.listByProject, { projectId: ids.projectId, paginationOpts: { numItems: 50, cursor: null } });
    const searched = await admin.query(api.accessGrantStatus.listByProject, { projectId: ids.projectId, search: "Deniz", paginationOpts: { numItems: 50, cursor: null } });
    expect(unfiltered.page).toHaveLength(2);
    expect(searched.page).toHaveLength(1);
    expect(await admin.query(api.accessGrantStatus.counts, { projectId: ids.projectId })).toEqual(summary);
    expect(await admin.query(api.accessGrantStatus.counts, { projectId: ids.projectId, departmentId: ids.departmentId })).toMatchObject({ personCount: 2, all: 6, unknown: 5 });
    expect(await admin.query(api.accessGrantStatus.counts, { projectId: ids.projectId, deviceId: ids.ideId })).toMatchObject({ personCount: 2, all: 2 });
    expect(await admin.query(api.accessGrantStatus.counts, { projectId: ids.projectId, deviceId: ids.hikId })).toMatchObject({ personCount: 0, all: 0 });
  });
  it("counts device-scoped persisted pairs without enumerating unknown graph pairs", async () => {
    const { admin, ids, write } = await fixture();
    await write("effective"); await write("failed", ids.hikId);
    expect(await admin.query(api.accessGrantStatus.counts, { projectId: ids.projectId, deviceId: ids.ideId, departmentId: ids.departmentId })).toEqual({ personCount: 1, all: 1, effective: 1, pending: 0, failed: 0, removed: 0, unknown: 0, capped: false });
    expect(await admin.query(api.accessGrantStatus.counts, { projectId: ids.projectId, deviceId: ids.hikId })).toMatchObject({ all: 1, failed: 1, effective: 0 });
    expect(await admin.query(api.accessGrantStatus.counts, { projectId: ids.projectId, deviceId: ids.bridgeId })).toMatchObject({ all: 0, unknown: 0 });
  });
  it("device counts bound reads before department filtering and count mixed states", async () => {
    const { t, ids, admin } = await fixture();
    await t.run(async ctx => {
      for (let i = 0; i < 1002; i++) {
        await ctx.db.insert("accessGrantStatus", { projectId: ids.projectId, employeeId: ids.employeeId, deviceId: ids.ideId,
          departmentId: i % 2 === 0 ? ids.departmentId : undefined,
          state: i % 4 === 0 ? "effective" : i % 4 === 1 ? "pending" : i % 4 === 2 ? "failed" : "removed",
          ruleIds: [], updatedAt: Date.now() });
      }
    });
    const counted = await admin.query(async ctx => {
      const queries = vi.spyOn(ctx.db, "query");
      try {
        // Registered functions expose this hook at runtime; the public d.ts omits it.
        const registered = grantCounts as unknown as {
          _handler: (ctx: QueryCtx, args: FunctionArgs<typeof api.accessGrantStatus.counts>) => Promise<FunctionReturnType<typeof api.accessGrantStatus.counts>>;
        };
        const result = await registered._handler(ctx, { projectId: ids.projectId, deviceId: ids.ideId });
        expect(queries.mock.calls.filter(([table]) => table === "accessGrantStatus")).toHaveLength(1);
        return result;
      } finally { queries.mockRestore(); }
    });
    expect(counted).toEqual({ personCount: 1, all: 1000, effective: 250, pending: 250, failed: 250, removed: 250, unknown: 0, capped: true });
    expect(await admin.query(api.accessGrantStatus.counts, { projectId: ids.projectId, deviceId: ids.ideId, departmentId: ids.departmentId })).toEqual({ personCount: 1, all: 1000, effective: 250, pending: 250, failed: 250, removed: 250, unknown: 0, capped: true });
    expect(await admin.query(api.accessGrantStatus.counts, { projectId: ids.otherProjectId, deviceId: ids.ideId }).catch(() => null)).toBeNull();
    expect(await admin.query(api.accessGrantStatus.counts, { projectId: ids.projectId, deviceId: ids.hikId })).toMatchObject({ all: 0, capped: false });
  });
  it("caps counters at 1000 and refuses nonindexed scans beyond 1000", async () => {
    const { t, admin, ids } = await fixture();
    await t.run(async ctx => {
      for (let i = 0; i < 1001; i++) {
        const employeeId = await ctx.db.insert("employees", { projectId: ids.projectId, firstName: "Bulk", lastName: `${i}`, email: `${i}@example.test`, cardNumber: `${i + 200}`, isActive: true });
        await ctx.db.insert("accessGrantStatus", { projectId: ids.projectId, employeeId, deviceId: ids.ideId, state: "effective", ruleIds: [], updatedAt: Date.now() });
      }
    });
    expect(await admin.query(api.accessGrantStatus.counts, { projectId: ids.projectId })).toMatchObject({ all: 1000, effective: 1000, capped: true });
    expect(await admin.query(api.accessGrantStatus.counts, { projectId: ids.projectId, deviceId: ids.ideId })).toMatchObject({ all: 1000, effective: 1000, capped: true });
    await expect(admin.query(api.accessGrantStatus.listByProject, { projectId: ids.projectId, search: "Bulk", paginationOpts: { numItems: 50, cursor: null } })).rejects.toThrow("1000");
  });
});

describe("redistribution", () => {
  it("creates one run and target per distinct selected device; blocks active runs", async () => {
    const { t, admin, ids } = await fixture();
    const result = await admin.mutation(api.accessGrantStatus.redistribute, { projectId: ids.projectId, pairs: [{ employeeId: ids.employeeId, deviceId: ids.ideId }, { employeeId: ids.employeeId, deviceId: ids.hikId }, { employeeId: ids.employeeId, deviceId: ids.ideId }] });
    expect(await t.run(ctx => ctx.db.query("deviceSyncRuns").take(10))).toHaveLength(1);
    expect(await t.run(ctx => ctx.db.query("deviceSyncRunTargets").withIndex("by_run", q => q.eq("runId", result.runId)).take(10))).toHaveLength(2);
    await expect(admin.mutation(api.accessGrantStatus.redistribute, { projectId: ids.projectId, pairs: [{ employeeId: ids.employeeId, deviceId: ids.ideId }] })).rejects.toThrow("zaten çalışıyor");
  });
  it("rejects >100 pairs before starting a run and checks pair ownership", async () => {
    const { t, admin, ids } = await fixture();
    await expect(admin.mutation(api.accessGrantStatus.redistribute, { projectId: ids.projectId, pairs: Array.from({ length: 101 }, () => ({ employeeId: ids.employeeId, deviceId: ids.ideId })) })).rejects.toThrow("100");
    await t.run(ctx => ctx.db.patch(ids.hikId, { projectId: ids.otherProjectId }));
    await expect(admin.mutation(api.accessGrantStatus.redistribute, { projectId: ids.projectId, pairs: [{ employeeId: ids.employeeId, deviceId: ids.hikId }] })).rejects.toThrow("aynı projede");
    expect(await t.run(ctx => ctx.db.query("deviceSyncRuns").take(10))).toHaveLength(0);
  });
  it("onlyFailed selects failed pairs and all-project starts one existing resync run", async () => {
    const { t, admin, ids, write } = await fixture();
    await write("effective"); await write("failed", ids.hikId);
    const { runId } = await admin.mutation(api.accessGrantStatus.redistribute, { projectId: ids.projectId, onlyFailed: true });
    const targets = await t.run(ctx => ctx.db.query("deviceSyncRunTargets").withIndex("by_run", q => q.eq("runId", runId)).take(10));
    expect(targets).toHaveLength(1); expect(targets[0]?.deviceId).toBe(ids.hikId);
    await t.run(ctx => ctx.db.patch(runId, { status: "done" }));
    const all = await admin.mutation(api.accessGrantStatus.redistribute, { projectId: ids.projectId });
    expect((await t.run(ctx => ctx.db.get(all.runId)))?.kind).toBe("project_resync");
  });
});


describe("grant write call budgets", () => {
  it("uses zero nested Convex calls when enqueueing IDE and local bridge users", async () => {
    const { t, ids } = await fixture();
    const nested = vi.fn(async () => { throw new Error("Unexpected nested function call"); });
    await t.run(async ctx => {
      const tracked = { ...ctx, runMutation: nested, runQuery: nested };
      await enqueueIdeOpInTransaction(tracked, { projectId: ids.projectId, deviceId: ids.ideId, opType: "upsertUser", payload: { employeeId: ids.employeeId, ruleIds: [ids.ruleId], userRecord: { id: 123 } } });
      await enqueueLocalBridgeOperationInTransaction(tracked, { projectId: ids.projectId, deviceId: ids.bridgeId, operation: "addPerson", payload: { employeeId: ids.employeeId, ruleIds: [ids.ruleId], employeeNo: "123" } });
    });
    expect(nested).not.toHaveBeenCalled();
  });
  it.each(["person", "rule"] as const)("writes one result batch per gateway %s action across two devices", async kind => {
    const { t, ids } = await fixture();
    await t.run(async ctx => {
      const existing = await ctx.db.get(ids.hikId);
      if (!existing) throw new Error("missing device");
      const { _id: _ignoredId, _creationTime: _ignoredTime, ...data } = existing;
      const deviceId = await ctx.db.insert("devices", { ...data, name: "Second", hikDevIndex: "second" });
      await ctx.db.insert("groupDevices", { projectId: ids.projectId, groupId: ids.ruleId, deviceId, createdAt: now });
    });
    const mutationCalls = vi.fn(async (ref: Parameters<typeof getFunctionName>[0], args: Record<string, Value>) =>
      t.mutation(ref as FunctionReference<"mutation", "internal">, args));
    const ctx = { runQuery: async (ref: Parameters<typeof getFunctionName>[0], args: Record<string, Value>) => t.query(ref as FunctionReference<"query", "internal">, args), runMutation: mutationCalls } as unknown as ActionCtx;
    const fn = kind === "person" ? syncEmployeeToDevicesInternal : syncWeekPlanToDevicesInternal;
    const handler = (fn as unknown as { _handler: (ctx: ActionCtx, args: object) => Promise<unknown> })._handler;
    await handler(ctx, kind === "person" ? { employeeId: ids.employeeId } : { accessRuleId: ids.ruleId });
    const batches = mutationCalls.mock.calls.filter(([ref]) => getFunctionName(ref) === "accessGrantStatus:recordGrantResults");
    expect(batches).toHaveLength(1);
    expect(batches[0]?.[1].results).toHaveLength(2);
  });
});


describe("grant graph and dispatch boundaries", () => {
  it("caps unknown graph enumeration rather than materializing every pair", async () => {
    const { t, ids, admin } = await fixture();
    await t.run(async ctx => {
      for (let i = 0; i < 334; i++) {
        const employeeId = await ctx.db.insert("employees", { projectId: ids.projectId, firstName: "Unknown", lastName: `${i}`, email: `${i}@example.test`, cardNumber: `${i + 200}`, isActive: true });
        await ctx.db.insert("groupMembers", { projectId: ids.projectId, groupId: ids.ruleId, employeeId, createdAt: now });
      }
    });
    expect(await admin.query(api.accessGrantStatus.counts, { projectId: ids.projectId })).toMatchObject({ all: 1000, unknown: 1000, capped: true });
    const list = { projectId: ids.projectId, state: "unknown" as const, paginationOpts: { numItems: 50, cursor: null } };
    await expect(admin.query(api.accessGrantStatus.listByProject, list)).rejects.toThrow("Bilinmiyor taraması sınırı");
    expect((await admin.query(api.accessGrantStatus.listByProject, { ...list, departmentId: ids.departmentId })).page).toHaveLength(3);
    const smallRuleId = await t.run(async ctx => {
      const ruleId = await ctx.db.insert("accessRules", { projectId: ids.projectId, name: "Küçük", isActive: true, updatedAt: now });
      await ctx.db.insert("groupMembers", { projectId: ids.projectId, groupId: ruleId, employeeId: ids.employeeId, createdAt: now });
      await ctx.db.insert("groupDevices", { projectId: ids.projectId, groupId: ruleId, deviceId: ids.ideId, createdAt: now });
      return ruleId;
    });
    expect((await admin.query(api.accessGrantStatus.listByProject, { ...list, ruleId: smallRuleId })).page).toMatchObject([{ deviceId: ids.ideId, state: "unknown" }]);
  });
  it.each([99, 100, 101, 150])("onlyFailed batches %i failures in index order into one run", async (size) => {
    const { t, ids, admin } = await fixture();
    const employeeIds = await t.run(async ctx => {
      const employeeIds = [];
      for (let i = 0; i < size; i++) {
        const employeeId = await ctx.db.insert("employees", { projectId: ids.projectId, firstName: "Failed", lastName: `${i}`, email: `${i}@example.test`, cardNumber: `${i + 200}`, isActive: true });
        employeeIds.push(employeeId);
        await ctx.db.insert("accessGrantStatus", { projectId: ids.projectId, employeeId, deviceId: ids.ideId, state: "failed", ruleIds: [], updatedAt: Date.now() - i });
      }
      return employeeIds;
    });
    const result = await admin.mutation(api.accessGrantStatus.redistribute, { projectId: ids.projectId, onlyFailed: true });
    expect(result).toMatchObject({ pairCount: Math.min(size, 100), remainingFailed: size > 100 ? 1 : 0, remainingCapped: size > 100 });
    expect(await t.run(ctx => ctx.db.query("deviceSyncRuns").take(10))).toHaveLength(1);
    const scheduled = await t.run(ctx => ctx.db.system.query("_scheduled_functions").collect());
    const grantJobs = scheduled.filter(job => job.name.includes("executeGrantTarget"));
    expect(grantJobs).toHaveLength(1);
    expect(grantJobs[0]?.args[0]).toMatchObject({ employeeIds: employeeIds.slice(0, 100) });
  });
  it("selected gateway target dispatches and settles through existing run evidence", async () => {
    const { t, ids, admin, status } = await fixture();
    const { runId } = await admin.mutation(api.accessGrantStatus.redistribute, { projectId: ids.projectId, pairs: [{ employeeId: ids.employeeId, deviceId: ids.hikId }] });
    const target = await t.run(ctx => ctx.db.query("deviceSyncRunTargets").withIndex("by_run", q => q.eq("runId", runId)).unique());
    if (!target) throw new Error("missing target");
    await t.action(internal.deviceSyncRuns.executeGrantTarget, { targetId: target._id, employeeIds: [ids.employeeId] });
    expect(await status(ids.hikId)).toMatchObject({ state: "effective", lastRunId: runId });
    await t.mutation(internal.deviceSyncRuns.refreshSummary, { runId, pollAttempt: 1 });
    expect((await t.run(ctx => ctx.db.get(runId)))?.status).toBe("done");
  });
  it("selected pair outside the rule graph removes the old IDE grant", async () => {
    const { t, ids, admin, status, write } = await fixture();
    await write("effective");
    await t.run(ctx => ctx.db.patch(ids.ruleId, { isActive: false }));
    const { runId } = await admin.mutation(api.accessGrantStatus.redistribute, { projectId: ids.projectId, pairs: [{ employeeId: ids.employeeId, deviceId: ids.ideId }] });
    const target = await t.run(ctx => ctx.db.query("deviceSyncRunTargets").withIndex("by_run", q => q.eq("runId", runId)).unique());
    if (!target) throw new Error("missing target");
    await t.action(internal.deviceSyncRuns.executeGrantTarget, { targetId: target._id, employeeIds: [ids.employeeId] });
    expect((await status())?.state).toBe("pending");
    const op = await t.run(ctx => ctx.db.query("idePendingOperations").withIndex("by_run_device", q => q.eq("runId", runId).eq("deviceId", ids.ideId)).unique());
    if (!op) throw new Error("missing op");
    expect(op.opType).toBe("deleteUser");
    await t.mutation(internal.ideSync.markSent, { opId: op._id, msxId: 1 });
    await t.mutation(internal.ideSync.markAck, { opId: op._id, result: "success" });
    expect((await status())?.state).toBe("removed");
  });
  it("refreshes denormalized department from employee, including removal", async () => {
    const { t, ids, status, write } = await fixture();
    await write("effective");
    await t.run(ctx => ctx.db.patch(ids.employeeId, { departmentId: undefined }));
    await write("pending");
    expect((await status())?.departmentId).toBeUndefined();
  });
});


it("project redistribution preparation includes door-only rules", async () => {
  const { t, ids } = await fixture();
  await t.run(async ctx => {
    const links = await ctx.db.query("groupDevices").withIndex("by_project_group", q => q.eq("projectId", ids.projectId).eq("groupId", ids.ruleId)).take(10);
    for (const link of links) await ctx.db.delete(link._id);
  });
  expect(await t.query(internal.deviceSyncRuns.prepareRule, { projectId: ids.projectId, ruleId: ids.ruleId, deviceId: ids.hikId })).toEqual([ids.employeeId]);
});


it("does not expose names of records moved to another project", async () => {
  const { t, ids, admin, write } = await fixture();
  await write("effective");
  await t.run(async ctx => {
    await ctx.db.patch(ids.employeeId, { projectId: ids.otherProjectId, firstName: "Secret" });
    await ctx.db.patch(ids.ideId, { projectId: ids.otherProjectId, name: "Secret device" });
    await ctx.db.patch(ids.departmentId, { projectId: ids.otherProjectId, name: "Secret department" });
  });
  const result = await admin.query(api.accessGrantStatus.listByProject, { projectId: ids.projectId, paginationOpts: { numItems: 50, cursor: null } });
  expect(result.page[0]).toMatchObject({ employeeName: "Silinmiş kişi", deviceName: "Silinmiş cihaz", departmentName: null });
});


it("late IDE delete acknowledgements cannot overwrite a newer accepted credential", async () => {
  const { t, ids, status } = await fixture();
  const old = await t.mutation(internal.ideSync.enqueueIdeOp, { deviceId: ids.ideId, opType: "deleteUser", payload: { employeeId: ids.employeeId, ideUserId: 123 } });
  const latest = await t.mutation(internal.ideSync.enqueueIdeOp, { deviceId: ids.ideId, opType: "upsertUser", payload: { employeeId: ids.employeeId, ruleIds: [ids.ruleId], userRecord: { id: 456 } } });
  await t.mutation(internal.ideSync.markSent, { opId: latest, msxId: 2 });
  await t.mutation(internal.ideSync.markAck, { opId: latest, result: "success" });
  await t.mutation(internal.ideSync.markSent, { opId: old, msxId: 1 });
  await t.mutation(internal.ideSync.markAck, { opId: old, result: "success" });
  expect((await status())?.state).toBe("effective");
});


describe("W4.2a audit regressions", () => {
  it("old-card delete enqueued after new-card upsert preserves effective after both acks", async () => {
    const { t, ids, status } = await fixture();
    await t.run(ctx => ctx.db.patch(ids.employeeId, { cardNumber: "456" }));
    const latest = await t.mutation(internal.ideSync.enqueueIdeOp, { deviceId: ids.ideId, opType: "upsertUser", payload: { employeeId: ids.employeeId, userRecord: { id: 456 } } });
    const old = await t.mutation(internal.ideSync.enqueueIdeOp, { deviceId: ids.ideId, opType: "deleteUser", payload: { employeeId: ids.employeeId, ideUserId: 123 } });
    await t.mutation(internal.ideSync.markSent, { opId: latest, msxId: 2 });
    await t.mutation(internal.ideSync.markAck, { opId: latest, result: "success", msxId: 2 });
    await t.mutation(internal.ideSync.markSent, { opId: old, msxId: 1 });
    await t.mutation(internal.ideSync.markAck, { opId: old, result: "success", msxId: 1 });
    expect((await status())?.state).toBe("effective");
  });
  it("late bridge ack leaves replaced payload pending and deliverable", async () => {
    const { t, ids, status } = await fixture();
    const enqueue = (name: string) => t.mutation(internal.hikvisionSync.enqueueLocalBridgeOperation, { deviceId: ids.bridgeId, operation: "addPerson", payload: { employeeId: ids.employeeId, employeeNo: "123", name } });
    const opId = await enqueue("Old");
    await t.mutation(internal.hikvisionSync.claimLocalBridgeOperations, { token: "token" });
    expect(await enqueue("New")).toBe(opId);
    expect(await t.mutation(internal.hikvisionSync.ackLocalBridgeOperation, { token: "token", opId, ok: true })).toEqual({ ok: true });
    expect((await t.run(ctx => ctx.db.get(opId)))?.status).toBe("pending");
    expect((await status(ids.bridgeId))?.state).toBe("pending");
    const next = await t.mutation(internal.hikvisionSync.claimLocalBridgeOperations, { token: "token" });
    expect(next.operations?.[0]?.payload).toMatchObject({ name: "New" });
  });
  it("successful gateway scope deletion records removed while preserving run failure accounting", async () => {
    const { t, ids, status } = await fixture();
    await t.run(ctx => ctx.db.patch(ids.hikDoorId, { hikDoorNo: 3 }));
    const result = await t.action(internal.actions.hikvisionSync.syncEmployeeToDevicesInternal, { employeeId: ids.employeeId, targetDeviceIds: [ids.hikId] });
    expect(result.failed).toBe(1);
    expect((await status(ids.hikId))?.state).toBe("removed");
  });
  it("gateway card error records failed without changing non-run return", async () => {
    const { t, ids, status } = await fixture();
    wire.card.mockResolvedValue({ ok: false, error: "Card rejected" });
    const result = await t.action(internal.actions.hikvisionSync.syncEmployeeToDevicesInternal, { employeeId: ids.employeeId, targetDeviceIds: [ids.hikId] });
    expect(result).toMatchObject({ synced: 1, failed: 0 });
    expect(await status(ids.hikId)).toMatchObject({ state: "failed", lastError: "Card rejected" });
  });
  it("pending deletion preserves rule IDs without graph reads; upsert computes graph once", async () => {
    const { t, ids, write, status } = await fixture();
    await write("effective");
    const tables: string[] = [];
    await t.run(async ctx => {
      const reads = vi.spyOn(ctx.db, "query");
      await enqueueIdeOpInTransaction(ctx, { deviceId: ids.ideId, opType: "deleteUser", payload: { employeeId: ids.employeeId, ideUserId: 123 } });
      tables.push(...reads.mock.calls.map(([table]) => table));
      reads.mockRestore();
    });
    expect(tables.filter(table => table === "groupMembers")).toHaveLength(0);
    expect((await status())?.ruleIds).toEqual([ids.ruleId]);
    tables.length = 0;
    await t.run(async ctx => {
      const reads = vi.spyOn(ctx.db, "query");
      await enqueueIdeOpInTransaction(ctx, { deviceId: ids.ideId, opType: "upsertUser", payload: { employeeId: ids.employeeId, userRecord: { id: 123 } } });
      tables.push(...reads.mock.calls.map(([table]) => table));
      reads.mockRestore();
    });
    expect(tables.filter(table => table === "groupMembers")).toHaveLength(1);
  });
  it("active runs allow rule and project runs but still reject redistribution", async () => {
    const { admin, ids } = await fixture();
    await admin.mutation(internal.deviceSyncRuns.createRun, { ruleId: ids.ruleId });
    await expect(admin.mutation(internal.deviceSyncRuns.createRun, { ruleId: ids.ruleId })).resolves.toBeTruthy();
    await expect(admin.mutation(internal.deviceSyncRuns.createRun, { projectId: ids.projectId })).resolves.toBeTruthy();
    await expect(admin.mutation(api.accessGrantStatus.redistribute, { projectId: ids.projectId, pairs: [{ employeeId: ids.employeeId, deviceId: ids.hikId }] })).rejects.toThrow("zaten çalışıyor");
  });
  it("manual doors are excluded from unauthorized doors", async () => {
    const { t, admin, ids } = await fixture();
    await t.run(ctx => ctx.db.insert("doors", { projectId: ids.projectId, name: "Manual" }));
    expect((await admin.query(api.accessGrantStatus.byEmployee, { employeeId: ids.employeeId })).unauthorizedDoors).toHaveLength(1);
  });
  it("devices sharing a gateway key retain their own rule IDs", async () => {
    const { t, ids, status } = await fixture();
    const alias = await t.run(async ctx => {
      const device = await ctx.db.get(ids.hikId);
      if (!device) throw new Error("missing device");
      const { _id: _id, _creationTime: _time, ...data } = device;
      const alias = await ctx.db.insert("devices", { ...data, name: "Alias" });
      const ruleId = await ctx.db.insert("accessRules", { projectId: ids.projectId, name: "Alias rule", hikWeekPlanNo: 3, isActive: true });
      await ctx.db.insert("groupMembers", { projectId: ids.projectId, groupId: ruleId, employeeId: ids.employeeId, createdAt: now });
      await ctx.db.insert("groupDevices", { projectId: ids.projectId, groupId: ruleId, deviceId: alias, createdAt: now });
      return { deviceId: alias, ruleId };
    });
    await t.action(internal.actions.hikvisionSync.syncEmployeeToDevicesInternal, { employeeId: ids.employeeId });
    expect(await status(ids.hikId)).toMatchObject({ ruleIds: [ids.ruleId] });
    expect(await status(alias.deviceId)).toMatchObject({ ruleIds: [alias.ruleId], state: "effective" });
  });
  it("1200 gateway pairs deliver HTTP and write three bounded grant batches", async () => {
    const { t, ids } = await fixture();
    await t.run(async ctx => {
      for (let index = 1; index < 1200; index++) {
        const employeeId = await ctx.db.insert("employees", { projectId: ids.projectId, firstName: "Bulk", lastName: String(index), email: `${index}@test.test`, cardNumber: String(index + 1000), isActive: true });
        await ctx.db.insert("groupMembers", { projectId: ids.projectId, groupId: ids.ruleId, employeeId, createdAt: now });
      }
    });
    const mutationCalls = vi.fn(async (ref: Parameters<typeof getFunctionName>[0], args: Record<string, Value>) => t.mutation(ref as FunctionReference<"mutation", "internal">, args));
    const ctx = { runQuery: async (ref: Parameters<typeof getFunctionName>[0], args: Record<string, Value>) => t.query(ref as FunctionReference<"query", "internal">, args), runMutation: mutationCalls } as unknown as ActionCtx;
    const handler = (syncWeekPlanToDevicesInternal as unknown as { _handler: (ctx: ActionCtx, args: object) => Promise<unknown> })._handler;
    await handler(ctx, { accessRuleId: ids.ruleId, targetDeviceIds: [ids.hikId] });
    expect(wire.card).toHaveBeenCalledTimes(1200);
    const batches = mutationCalls.mock.calls.filter(([ref]) => getFunctionName(ref) === "accessGrantStatus:recordGrantResults");
    expect(batches.map(([, args]) => Array.isArray(args.results) ? args.results.length : 0)).toEqual([500, 500, 200]);
  }, 30000);
});

it("inactive numeric IDE credential with leading zeros still records removal", async () => {
  const { t, ids, status } = await fixture();
  await t.run(ctx => ctx.db.patch(ids.employeeId, { cardNumber: "00123", isActive: false }));
  const opId = await t.mutation(internal.ideSync.enqueueIdeOp, { deviceId: ids.ideId, opType: "deleteUser", payload: { employeeId: ids.employeeId, ideUserId: 123 } });
  await t.mutation(internal.ideSync.markSent, { opId, msxId: 1 });
  await t.mutation(internal.ideSync.markAck, { opId, result: "success", msxId: 1 });
  expect((await status())?.state).toBe("removed");
});

it("K-09: list and counts use current department after a move, without rewriting grant snapshots", async () => {
  const { t, ids, admin, write } = await fixture();
  await write("effective");
  const departmentId = await t.run(async ctx => {
    const id = await ctx.db.insert("departments", { projectId: ids.projectId, name: "Yeni" });
    await ctx.db.patch(ids.employeeId, { departmentId: id });
    return id;
  });
  const list = (id: Id<"departments">) => admin.query(api.accessGrantStatus.listByProject, { projectId: ids.projectId, departmentId: id, paginationOpts: { cursor: null, numItems: 10 } });
  expect((await list(ids.departmentId)).page).toEqual([]);
  expect((await list(departmentId)).page[0]).toMatchObject({ departmentId, departmentName: "Yeni" });
  expect((await admin.query(api.accessGrantStatus.byEmployee, { employeeId: ids.employeeId })).rows[0]).toMatchObject({ departmentId, departmentName: "Yeni" });
  expect(await admin.query(api.accessGrantStatus.counts, { projectId: ids.projectId, departmentId })).toMatchObject({ effective: 1 });
  expect(await admin.query(api.accessGrantStatus.counts, { projectId: ids.projectId, departmentId: ids.departmentId })).toMatchObject({ all: 0 });
});

it("K-09: department list, pagination and counts ignore 1500 unrelated project grants", async () => {
  const { t, ids, admin, reader } = await fixture();
  const departmentId = await t.run(async ctx => {
    const selected = await ctx.db.insert("departments", { projectId: ids.projectId, name: "Seçilen" });
    for (let i = 0; i < 502; i++) {
      const employeeId = await ctx.db.insert("employees", { projectId: ids.projectId, departmentId: i >= 500 ? selected : ids.departmentId, firstName: "Kişi", lastName: String(i), email: `${i}@example.test`, cardNumber: String(i + 1000) });
      for (const [index, deviceId] of [ids.ideId, ids.hikId, ids.bridgeId].entries()) {
        await ctx.db.insert("accessGrantStatus", { projectId: ids.projectId, employeeId, deviceId, departmentId: ids.departmentId,
          state: index === 0 ? "effective" : index === 1 ? "pending" : "failed", ruleIds: [], updatedAt: Date.now() });
      }
    }
    return selected;
  });
  const args = { projectId: ids.projectId, departmentId, paginationOpts: { cursor: null, numItems: 4 } };
  const first = await admin.query(api.accessGrantStatus.listByProject, args);
  expect(first.page).toHaveLength(4);
  expect(first.isDone).toBe(false);
  const second = await admin.query(api.accessGrantStatus.listByProject, { ...args, paginationOpts: { numItems: 4, cursor: first.continueCursor } });
  expect(second.page).toHaveLength(2);
  expect(second.isDone).toBe(true);
  expect(new Set([...first.page, ...second.page].map(row => row._id)).size).toBe(6);
  expect([...first.page, ...second.page].every(row => row.departmentId === departmentId && row.departmentName === "Seçilen")).toBe(true);
  expect(await admin.query(api.accessGrantStatus.counts, { projectId: ids.projectId, departmentId })).toMatchObject({ all: 6, effective: 2, pending: 2, failed: 2, removed: 0, unknown: 0, capped: false });
  expect((await admin.query(api.accessGrantStatus.listByProject, { ...args, deviceId: ids.ideId, state: "effective" })).page).toHaveLength(2);
  expect(await admin.query(api.accessGrantStatus.counts, { projectId: ids.projectId, departmentId, deviceId: ids.ideId })).toMatchObject({ all: 2, effective: 2, capped: false });
  await expect(reader.query(api.accessGrantStatus.listByProject, args)).rejects.toThrow();
  await expect(reader.query(api.accessGrantStatus.counts, { projectId: ids.projectId, departmentId })).rejects.toThrow();
  const foreignDepartmentId = await t.run(ctx => ctx.db.insert("departments", { projectId: ids.otherProjectId, name: "Başka proje" }));
  expect((await admin.query(api.accessGrantStatus.listByProject, { ...args, departmentId: foreignDepartmentId })).page).toEqual([]);
  await expect(admin.query(api.accessGrantStatus.listByProject, { ...args, projectId: ids.otherProjectId })).rejects.toThrow();
  // A genuinely oversized selected department remains bounded and reports truncation explicitly.
  await expect(admin.query(api.accessGrantStatus.listByProject, { ...args, departmentId: ids.departmentId })).rejects.toThrow("Departman yetki okuma sınırı");
  expect(await admin.query(api.accessGrantStatus.counts, { projectId: ids.projectId, departmentId: ids.departmentId })).toMatchObject({ all: 1000, capped: true });
});

it("K-09: department unknown counts ignore unrelated rule members beyond the project member limit", async () => {
  const { t, ids, admin, write } = await fixture();
  await write("effective");
  await t.run(async ctx => {
    const unrelated = await ctx.db.insert("employees", { projectId: ids.projectId, firstName: "Diğer", lastName: "Kişi", email: "other@example.test", cardNumber: "456" });
    for (let i = 0; i < 1001; i++) await ctx.db.insert("groupMembers", { projectId: ids.projectId, employeeId: unrelated, groupId: ids.ruleId, createdAt: now });
  });
  expect(await admin.query(api.accessGrantStatus.counts, { projectId: ids.projectId, departmentId: ids.departmentId })).toEqual({ personCount: 1, all: 3, effective: 1, pending: 0, failed: 0, removed: 0, unknown: 2, capped: false });
});
