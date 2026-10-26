// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import schema from "./schema";
import { NUMERIC_CARD_CONFLICT } from "./lib/cardIdentity";
import { grantStatusForOperation, upsertGrantStatus } from "./lib/grantStatus";

const modules = import.meta.glob("./**/*.ts");
const person = { firstName: "Test", lastName: "Kişi", email: "new@example.test", cardNumber: "123" };
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-26T10:00:00Z")); });
afterEach(() => vi.useRealTimers());

async function fixture(role: "admin" | "viewer" = "admin") {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "A" });
    const otherProjectId = await ctx.db.insert("projects", { name: "B" });
    const userId = await ctx.db.insert("users", { role: "project_user", verified: true });
    await ctx.db.insert("userProjects", { userId, projectId, role });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 86400000 });
    const ruleId = await ctx.db.insert("accessRules", { projectId, name: "Visitor", targetType: "visitor", isActive: true });
    const employeeId = await ctx.db.insert("employees", { ...person, email: "employee@example.test", cardNumber: "EMP", projectId, isActive: true });
    const visitorId = await ctx.db.insert("employees", { ...person, email: "visitor@example.test", cardNumber: "789", projectId,
      isVisitor: true, isActive: true, visitorStatus: "checkedIn", accessRuleId: ruleId, accessExpiresAt: "2030-01-01T00:00:00Z" });
    const hikId = await ctx.db.insert("devices", { projectId, name: "Hik", brand: "hikvision", isActive: true, hikDevIndex: "synthetic",
      createdAt: "2026-10-26T00:00:00Z", updatedAt: "2026-10-26T00:00:00Z" });
    const ideId = await ctx.db.insert("devices", { projectId, name: "IDE", brand: "ide_smart", isActive: true,
      createdAt: "2026-10-26T00:00:00Z", updatedAt: "2026-10-26T00:00:00Z" });
    await ctx.db.insert("groupMembers", { projectId, groupId: ruleId, employeeId: visitorId, createdAt: "2026-10-26T00:00:00Z" });
    for (const deviceId of [hikId, ideId]) await ctx.db.insert("groupDevices", { projectId, groupId: ruleId, deviceId, createdAt: "2026-10-26T00:00:00Z" });
    return { projectId, otherProjectId, userId, sessionId, ruleId, employeeId, visitorId, hikId, ideId };
  });
  const caller = t.withIdentity({ subject: `${ids.userId}|${ids.sessionId}` });
  const employee = (cardNumber: string, overrides: Partial<Doc<"employees">> = {}) => t.run(ctx => ctx.db.insert("employees", {
    ...person, projectId: ids.projectId, email: `${cardNumber}@example.test`, cardNumber, isActive: true, ...overrides,
  }));
  const jobs = () => t.run(ctx => ctx.db.system.query("_scheduled_functions").collect());
  const visitorArgs = { projectId: ids.projectId, firstName: "New", lastName: "Visitor", cardNumber: "123", presetRuleId: ids.ruleId, accessExpiresAt: "2030-01-01T00:00:00Z" };
  return { t, caller, employee, jobs, visitorArgs, ...ids };
}

describe("K-04: numeric card uniqueness", () => {
  it.each([101, 200])("rejects %s assignments without any writes", async count => {
    const f = await fixture();
    const before = await f.t.run(ctx => ctx.db.get(f.employeeId));
    await expect(f.caller.mutation(api.employeeImport.assignCards, { assignments: Array.from({ length: count }, (_, i) => ({
      employeeId: f.employeeId, cardNumber: String(1000 + i),
    })) })).rejects.toThrow("en fazla 100 kart");
    expect(await f.t.run(ctx => ctx.db.get(f.employeeId))).toEqual(before);
    expect(await f.jobs()).toEqual([]);
  });

  it("assigns 200 numeric cards in two batches of 100", async () => {
    const f = await fixture();
    const assignments = await f.t.run(async ctx => {
      const rows = [];
      for (let i = 0; i < 200; i++) {
        const employeeId = await ctx.db.insert("employees", { ...person, projectId: f.projectId,
          email: `batch${i}@example.test`, cardNumber: `PRE:${i}`, isActive: true });
        rows.push({ employeeId, cardNumber: String(1000 + i) });
      }
      return rows;
    });
    for (let index = 0; index < assignments.length; index += 100) {
      const results = await f.caller.mutation(api.employeeImport.assignCards, { assignments: assignments.slice(index, index + 100) });
      expect(results).toHaveLength(100);
      expect(results.every(row => row.status === "assigned")).toBe(true);
    }
    const cards = await f.t.run(async ctx => Promise.all(assignments.map(row => ctx.db.get(row.employeeId))));
    expect(cards.map(row => row?.cardNumber)).toEqual(assignments.map(row => row.cardNumber));
  });

  it.each([["00123", "123"], ["123", "00123"], ["000", "0"], ["0", "000"]])("create/update reject %s vs %s globally", async (existing, incoming) => {
    const f = await fixture();
    await f.employee(existing, { projectId: f.otherProjectId });
    await expect(f.caller.mutation(api.employees.create, { ...person, projectId: f.projectId, cardNumber: incoming })).rejects.toThrow(NUMERIC_CARD_CONFLICT);
    await expect(f.caller.mutation(api.employees.update, { employeeId: f.employeeId, cardNumber: incoming })).rejects.toThrow(NUMERIC_CARD_CONFLICT);
    expect((await f.t.run(ctx => ctx.db.get(f.employeeId)))?.cardNumber).toBe("EMP");
    expect(await f.jobs()).toEqual([]);
  });

  it("allows distinct numeric cards, own aliases and distinct text cards; exact text duplicates still fail", async () => {
    const f = await fixture();
    await f.employee("00123");
    const id = await f.caller.mutation(api.employees.create, { ...person, projectId: f.projectId, cardNumber: "124" });
    await f.caller.mutation(api.employees.update, { employeeId: id, cardNumber: "00124" });
    await f.employee("00ABC");
    const text = await f.caller.mutation(api.employees.create, { ...person, email: "text@example.test", projectId: f.projectId, cardNumber: "ABC" });
    expect((await f.t.run(ctx => ctx.db.get(text)))?.cardNumber).toBe("ABC");
    await expect(f.caller.mutation(api.employees.update, { employeeId: text, cardNumber: "00ABC" })).rejects.toThrow("Bu kart numarası başka bir personelde kullanılıyor");
  });

  it.each([true, false])("import checks persisted aliases and in-file aliases (dryRun=%s)", async dryRun => {
    const f = await fixture();
    await f.employee("00123", { projectId: f.otherProjectId });
    const rows = [
      { ...person, cardNumber: "123", rowNumber: 2 },
      { ...person, cardNumber: "00456", email: "first@example.test", rowNumber: 3 },
      { ...person, cardNumber: "456", email: "second@example.test", rowNumber: 4 },
      { ...person, cardNumber: "457", email: "third@example.test", rowNumber: 5 },
    ];
    expect(await f.caller.mutation(api.employeeImport.importChunk, { projectId: f.projectId, rows, dryRun })).toMatchObject([
      { status: "skippedDuplicate", message: NUMERIC_CARD_CONFLICT }, { status: "created" },
      { status: "error", message: NUMERIC_CARD_CONFLICT }, { status: "created" },
    ]);
  });

  it("bulk assignment rejects aliases from storage and earlier assignments, and allows its own alias", async () => {
    const f = await fixture();
    await f.employee("00123");
    const second = await f.employee("SECOND");
    expect(await f.caller.mutation(api.employeeImport.assignCards, { assignments: [
      { employeeId: f.employeeId, cardNumber: "123" }, { employeeId: f.employeeId, cardNumber: "00456" },
      { employeeId: second, cardNumber: "456" }, { employeeId: f.employeeId, cardNumber: "456" },
    ] })).toMatchObject([{ status: "error", message: NUMERIC_CARD_CONFLICT }, { status: "assigned" },
      { status: "error", message: NUMERIC_CARD_CONFLICT }, { status: "assigned" }]);
  });

  it("visitor create/update/activation reject numeric conflicts, including an inactive alias", async () => {
    const f = await fixture();
    await f.employee("00123", { isVisitor: true, isActive: false });
    await expect(f.caller.mutation(api.visitors.create, f.visitorArgs)).rejects.toThrow(NUMERIC_CARD_CONFLICT);
    await expect(f.caller.mutation(api.visitors.update, { visitorId: f.visitorId, cardNumber: "123" })).rejects.toThrow(NUMERIC_CARD_CONFLICT);
    await f.t.run(ctx => ctx.db.patch(f.visitorId, { cardNumber: "123", isActive: false }));
    await expect(f.caller.mutation(api.visitors.update, { visitorId: f.visitorId, isActive: true })).rejects.toThrow(NUMERIC_CARD_CONFLICT);
    expect((await f.t.run(ctx => ctx.db.get(f.visitorId)))?.isActive).toBe(false);
    expect(await f.jobs()).toEqual([]);
  });

  it("visitor allows another number and Hik-only text cards", async () => {
    const f = await fixture();
    const id = await f.caller.mutation(api.visitors.create, f.visitorArgs);
    await f.caller.mutation(api.visitors.update, { visitorId: id, cardNumber: "124" });
    const textRule = await f.t.run(ctx => ctx.db.insert("accessRules", { projectId: f.projectId, name: "Text cards", targetType: "visitor", isActive: true }));
    await f.employee("00ABC");
    const text = await f.caller.mutation(api.visitors.create, { ...f.visitorArgs, cardNumber: "ABC", presetRuleId: textRule });
    expect((await f.t.run(ctx => ctx.db.get(text)))?.cardNumber).toBe("ABC");
  });
});

describe("A6-6/A6-7: preserve visitor revocation identity and grant owner", () => {
  it.each(["ide", "hik"] as const)("%s deletion ACK closes the grant after checkout and release", async brand => {
    const f = await fixture();
    const deviceId = brand === "ide" ? f.ideId : f.hikId;
    await f.t.run(async ctx => {
      if (brand === "hik") await ctx.db.patch(deviceId, { hikTransport: "localBridge", apiToken: "test-token" });
      await upsertGrantStatus(ctx, { projectId: f.projectId, employeeId: f.visitorId, deviceId, state: "effective", ruleIds: [f.ruleId] });
    });
    await f.caller.mutation(api.visitors.checkOut, { visitorId: f.visitorId });
    await f.caller.mutation(api.visitors.releaseCard, { visitorId: f.visitorId });
    if (brand === "ide") {
      const opId = await f.t.mutation(internal.ideSync.enqueueIdeOp, { projectId: f.projectId, deviceId,
        opType: "deleteUser", payload: { employeeId: f.visitorId, ideUserId: 789 } });
      await f.t.mutation(internal.ideSync.markSent, { opId, msxId: 1 });
      await f.t.mutation(internal.ideSync.markAck, { opId, result: "success", msxId: 1 });
    } else {
      const opId = await f.t.mutation(internal.hikvisionSync.enqueueLocalBridgeOperation, { projectId: f.projectId, deviceId,
        operation: "deleteCard", payload: { employeeId: f.visitorId, cardNumber: "789" } });
      await f.t.mutation(internal.hikvisionSync.claimLocalBridgeOperations, { token: "test-token" });
      await f.t.mutation(internal.hikvisionSync.ackLocalBridgeOperation, { token: "test-token", opId, ok: true });
    }
    expect(await f.t.run(ctx => ctx.db.query("accessGrantStatus").withIndex("by_employee_device",
      q => q.eq("employeeId", f.visitorId).eq("deviceId", deviceId)).unique())).toMatchObject({ state: "removed", ruleIds: [f.ruleId] });
  });

  it.each(["ide", "hik"] as const)("%s old-card cleanup cannot close a new active grant", async brand => {
    const f = await fixture();
    const deviceId = brand === "ide" ? f.ideId : f.hikId;
    await f.caller.mutation(api.visitors.checkOut, { visitorId: f.visitorId });
    await f.caller.mutation(api.visitors.releaseCard, { visitorId: f.visitorId });
    await f.t.run(async ctx => {
      await ctx.db.patch(f.visitorId, { cardNumber: "790", isActive: true });
      await upsertGrantStatus(ctx, { projectId: f.projectId, employeeId: f.visitorId, deviceId, state: "effective" });
      const op = { projectId: f.projectId, deviceId, _id: "old-delete",
        ...(brand === "ide" ? { opType: "deleteUser", payload: { employeeId: f.visitorId, ideUserId: 789 } }
          : { operation: "deletePerson", payload: { employeeId: f.visitorId, employeeNo: "789" } }) };
      await grantStatusForOperation(ctx, op, "pending");
      await grantStatusForOperation(ctx, op, "removed");
    });
    expect(await f.t.run(ctx => ctx.db.query("accessGrantStatus").withIndex("by_employee_device",
      q => q.eq("employeeId", f.visitorId).eq("deviceId", deviceId)).unique())).toMatchObject({ state: "effective" });
  });

  it("checkout followed immediately by release preserves old Hik/IDE identity on both removal jobs", async () => {
    const f = await fixture();
    await f.caller.mutation(api.visitors.checkOut, { visitorId: f.visitorId });
    await f.caller.mutation(api.visitors.releaseCard, { visitorId: f.visitorId });
    expect((await f.t.run(ctx => ctx.db.get(f.visitorId)))?.cardNumber).toBe(`IADE:789:${f.visitorId}`);
    const jobs = await f.jobs();
    expect(jobs).toHaveLength(4);
    for (const job of jobs.filter(job => job.name.includes("hikvisionSync"))) expect(job.args).toMatchObject([{
      employeeId: f.visitorId, snapshot: { cardNumber: "789", projectId: f.projectId, devices: [{ _id: f.hikId }] },
    }]);
    for (const job of jobs.filter(job => job.name.includes("ideGatewayDevice"))) expect(job.args).toEqual([{
      employeeId: f.visitorId, cardNumber: "789", deviceIds: [f.ideId], projectId: f.projectId,
    }]);
    await f.caller.mutation(api.visitors.releaseCard, { visitorId: f.visitorId });
    expect(await f.jobs()).toHaveLength(4);
  });

  it("release alone snapshots a passive visitor, and refuses an active visitor", async () => {
    const f = await fixture();
    await expect(f.caller.mutation(api.visitors.releaseCard, { visitorId: f.visitorId })).rejects.toThrow("Önce ziyaretçiyi çıkış yaptırın");
    expect(await f.jobs()).toEqual([]);
    await f.t.run(ctx => ctx.db.patch(f.visitorId, { isActive: false }));
    await f.caller.mutation(api.visitors.releaseCard, { visitorId: f.visitorId });
    expect((await f.jobs()).find(job => job.name.includes("hikvisionSync"))?.args).toMatchObject([{
      employeeId: f.visitorId, snapshot: { cardNumber: "789", devices: [{ _id: f.hikId }] },
    }]);
  });

  it("expiration carries the visitor owner and old snapshot through immediate badge release", async () => {
    const f = await fixture();
    await f.t.run(ctx => ctx.db.patch(f.visitorId, { accessExpiresAt: "2026-10-25T00:00:00Z" }));
    expect(await f.t.mutation(internal.visitors.expireVisitorAccess, {})).toEqual({ expired: 1 });
    await f.caller.mutation(api.visitors.releaseCard, { visitorId: f.visitorId });
    expect(await f.jobs()).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "actions/ideGatewayDevice:deleteIdeUserFromPanels", args: [{ employeeId: f.visitorId, cardNumber: "789", deviceIds: [f.ideId], projectId: f.projectId }] }),
      expect.objectContaining({ name: "actions/hikvisionSync:deleteEmployeeFromDevicesInternal", args: [expect.objectContaining({ snapshot: expect.objectContaining({ cardNumber: "789" }) })] }),
    ]));
  });

  it("card changes snapshot the old Hik identity and include the IDE grant owner", async () => {
    const f = await fixture();
    await f.caller.mutation(api.visitors.update, { visitorId: f.visitorId, cardNumber: "790" });
    expect(await f.jobs()).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "actions/hikvisionSync:deleteEmployeeFromDevicesInternal", args: [expect.objectContaining({ employeeId: f.visitorId, syncAfter: true, snapshot: expect.objectContaining({ cardNumber: "789" }) })] }),
      expect.objectContaining({ name: "actions/ideGatewayDevice:deleteIdeUserFromPanels", args: [{ employeeId: f.visitorId, cardNumber: "789", deviceIds: [f.ideId], projectId: f.projectId }] }),
    ]));
  });

  it("automatic exact-card reclaim snapshots the previous visitor before changing their card", async () => {
    const f = await fixture();
    await f.t.run(ctx => ctx.db.patch(f.visitorId, { isActive: false }));
    const id = await f.caller.mutation(api.visitors.create, { ...f.visitorArgs, cardNumber: "789" });
    expect(id).not.toBe(f.visitorId);
    expect((await f.t.run(ctx => ctx.db.get(f.visitorId)))?.cardNumber).toBe(`IADE:789:${f.visitorId}`);
    expect((await f.jobs()).find(job => job.name.includes("deleteEmployeeFromDevicesInternal"))?.args).toMatchObject([{
      employeeId: f.visitorId, snapshot: { cardNumber: "789", devices: [{ _id: f.hikId }] },
    }]);
  });
});

describe("card mutation authorization", () => {
  it.each(["viewer", "foreign"] as const)("rejects %s before changing cards or scheduling jobs", async kind => {
    const f = await fixture(kind === "viewer" ? "viewer" : "admin");
    const projectId = kind === "foreign" ? f.otherProjectId : f.projectId;
    if (kind === "foreign") await f.t.run(async ctx => {
      await ctx.db.patch(f.employeeId, { projectId });
      await ctx.db.patch(f.visitorId, { projectId });
    });
    const before = await f.t.run(ctx => ctx.db.query("employees").collect());
    await expect(f.caller.mutation(api.employees.create, { ...person, projectId })).rejects.toThrow();
    await expect(f.caller.mutation(api.employees.update, { employeeId: f.employeeId, cardNumber: "NEW" })).rejects.toThrow();
    await expect(f.caller.mutation(api.employeeImport.importChunk, { projectId, rows: [{ ...person, rowNumber: 2 }], dryRun: false })).rejects.toThrow();
    if (kind === "viewer") await expect(f.caller.mutation(api.employeeImport.assignCards, { assignments: [{ employeeId: f.employeeId, cardNumber: "NEW" }] })).rejects.toThrow();
    else expect(await f.caller.mutation(api.employeeImport.assignCards, { assignments: [{ employeeId: f.employeeId, cardNumber: "NEW" }] })).toMatchObject([{ status: "error" }]);
    await expect(f.caller.mutation(api.visitors.create, { ...f.visitorArgs, projectId })).rejects.toThrow();
    await expect(f.caller.mutation(api.visitors.update, { visitorId: f.visitorId, cardNumber: "NEW" })).rejects.toThrow();
    await expect(f.caller.mutation(api.visitors.checkOut, { visitorId: f.visitorId })).rejects.toThrow();
    await expect(f.caller.mutation(api.visitors.releaseCard, { visitorId: f.visitorId })).rejects.toThrow();
    expect(await f.t.run(ctx => ctx.db.query("employees").collect())).toEqual(before);
    expect(await f.jobs()).toEqual([]);
  });
});
