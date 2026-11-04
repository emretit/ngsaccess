// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import type { FunctionArgs } from "convex/server";
import { reconcilePanelRosterIde, reconcileRemovedEmployeeIde } from "./lib/accessGraph";

const modules = import.meta.glob("./**/*.ts");
afterEach(() => vi.useRealTimers());
async function fixture() {
  vi.useFakeTimers();
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "A" });
    const userId = await ctx.db.insert("users", { role: "super_admin", verified: true });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 86400000 });
    const deviceId = await ctx.db.insert("devices", {
      projectId, name: "IDE", brand: "ide_smart", ideUuid: "123456789012345", isActive: true,
      ideUser: "admin", idePassword: "secret", createdAt: "2026-11-03", updatedAt: "2026-11-03",
    });
    const ruleId = await ctx.db.insert("accessRules", { projectId, name: "Rule", isActive: true });
    await ctx.db.insert("groupDevices", { projectId, groupId: ruleId, deviceId, createdAt: "2026-11-03" });
    const legacyId = await ctx.db.insert("idePanelUsers", { projectId, deviceId, ideUuid: "123456789012345", cardNumber: "300", syncedAt: 0 });
    return { projectId, userId, sessionId, deviceId, ruleId, legacyId };
  });
  const ack = async (card: number, mode?: string) => {
    const opId = await t.mutation(internal.ideSync.enqueueIdeOp, {
      deviceId: ids.deviceId, projectId: ids.projectId, opType: "upsertUser", payload: { userRecord: { id: card }, ...(mode ? { mode } : {}) },
    });
    await t.mutation(internal.ideSync.markSent, { opId, msxId: card });
    await t.mutation(internal.ideSync.markAck, { opId, msxId: card, result: "success" });
  };
  const roster = () => t.run(ctx => ctx.db.query("idePanelUsers").collect());
  const processed = new Set<string>();
  const dispatchSizes: number[] = [];
  const deletions = async () => {
    // Execute only revocation dispatchers; inspect their durable jobs without network I/O.
    for (;;) {
      const jobs = await t.run(ctx => ctx.db.system.query("_scheduled_functions").collect());
      const job = jobs.find(job => !processed.has(job._id) && /accessRules:reconcileIde(RemovalBatch|RosterPage)$/.test(job.name));
      if (!job) return jobs.filter(job => job.name.includes("deleteIdeUserFromPanels"));
      processed.add(job._id);
      if (job.name.endsWith("reconcileIdeRemovalBatch")) await t.mutation(internal.accessRules.reconcileIdeRemovalBatch, job.args[0] as FunctionArgs<typeof internal.accessRules.reconcileIdeRemovalBatch>);
      else await t.mutation(internal.accessRules.reconcileIdeRosterPage, job.args[0] as FunctionArgs<typeof internal.accessRules.reconcileIdeRosterPage>);
      dispatchSizes.push((await t.run(ctx => ctx.db.system.query("_scheduled_functions").collect())).length - jobs.length);
    }
  };
  return { t, ...ids, ack, roster, deletions, dispatchSizes, as: t.withIdentity({ subject: `${ids.userId}|${ids.sessionId}` }) };
}

it("CIH-07: seed records local provenance and cannot overwrite managed provenance", async () => {
  const f = await fixture();
  await f.t.mutation(internal.ideSync.seedPanelUsers, { deviceId: f.deviceId, rawCards: [100, "00100", "bad"] });
  await f.ack(200);
  await f.ack(100);
  await f.ack(300);
  await f.ack(400, "update");
  await f.t.mutation(internal.ideSync.seedPanelUsers, { deviceId: f.deviceId, rawCards: [200] });
  const rows = await f.roster();
  expect(rows.find(row => row.cardNumber === "100")).toMatchObject({ managedByNgsplus: false });
  expect(rows.find(row => row.cardNumber === "200")).toMatchObject({ managedByNgsplus: true });
  expect(rows.find(row => row.cardNumber === "300")?.managedByNgsplus).toBeUndefined();
  expect(rows.find(row => row.cardNumber === "400")).toMatchObject({ managedByNgsplus: false });
});

it.each(["reconcile", "deactivate"])("CIH-07: %s never schedules local/unknown excess users, keeps managed revocation", async method => {
  const f = await fixture();
  await f.t.mutation(internal.ideSync.seedPanelUsers, { deviceId: f.deviceId, rawCards: [100] });
  await f.ack(200);
  if (method === "reconcile") await f.t.run(ctx => reconcilePanelRosterIde(ctx, f));
  else await f.as.mutation(api.accessRules.update, { ruleId: f.ruleId, isActive: false });
  expect((await f.deletions()).map(job => job.args[0])).toEqual([
    { cardNumber: "200", deviceIds: [f.deviceId], projectId: f.projectId },
  ]);
  expect((await f.roster()).map(row => row.cardNumber).sort()).toEqual(["100", "200", "300"]);
});

it("CIH-07: tracked diff retains visible extras but only deletes managed extras", async () => {
  const f = await fixture();
  await f.t.mutation(internal.ideSync.seedPanelUsers, { deviceId: f.deviceId, rawCards: [100] });
  await f.ack(200);
  const diff = await f.t.query(internal.deviceSyncRuns.diffIdeContext, { deviceId: f.deviceId, reconcileRoster: true });
  expect(diff.orphanCards.sort()).toEqual(["100", "200", "300"]);
  expect(diff).toMatchObject({ removableOrphanCards: ["200"] });
});

it("CIH-07: targeted employee revocation remains independent of imported roster provenance", async () => {
  const f = await fixture();
  await f.t.mutation(internal.ideSync.seedPanelUsers, { deviceId: f.deviceId, rawCards: [100] });
  const employeeId = await f.t.run(ctx => ctx.db.insert("employees", {
    projectId: f.projectId, firstName: "Managed", lastName: "Employee", email: "employee@example.test", cardNumber: "100", isActive: true,
  }));
  await f.t.run(ctx => reconcileRemovedEmployeeIde(ctx, { employeeId, projectId: f.projectId, candidatePanels: [f.deviceId] }));
  expect((await f.deletions()).map(job => job.args[0])).toEqual([
    { employeeId, cardNumber: "100", deviceIds: [f.deviceId], projectId: f.projectId },
  ]);
});

it.each(["update", "updateWithGroups"] as const)("CIH-07: %s deactivation still revokes an imported employee's access", async method => {
  const f = await fixture();
  await f.t.mutation(internal.ideSync.seedPanelUsers, { deviceId: f.deviceId, rawCards: [100] });
  const employeeId = await f.t.run(async ctx => {
    const id = await ctx.db.insert("employees", { projectId: f.projectId, firstName: "Imported", lastName: "Employee", email: "imported@example.test", cardNumber: "100", isActive: true });
    await ctx.db.insert("groupMembers", { projectId: f.projectId, groupId: f.ruleId, employeeId: id, createdAt: "2026-11-03" });
    return id;
  });
  await f.as.mutation(api.accessRules[method], { ruleId: f.ruleId, isActive: false });
  expect((await f.deletions()).map(job => job.args[0])).toContainEqual({ employeeId, cardNumber: "100", deviceIds: [f.deviceId], projectId: f.projectId });
});

it("Y-02: deactivating 600 IDE members schedules a bounded revocation chain", async () => {
  const f = await fixture();
  const employeeIds = await f.t.run(async ctx => {
    const ids = [];
    for (let i = 0; i < 600; i++) {
      const employeeId = await ctx.db.insert("employees", { projectId: f.projectId, firstName: "Üye", lastName: String(i), email: `${i}@example.test`, cardNumber: String(1000 + i), isActive: true });
      await ctx.db.insert("groupMembers", { projectId: f.projectId, groupId: f.ruleId, employeeId, createdAt: "" });
      ids.push(employeeId);
    }
    return ids;
  });
  await f.as.mutation(api.accessRules.update, { ruleId: f.ruleId, isActive: false });
  expect(await f.t.run(ctx => ctx.db.get(f.ruleId))).toMatchObject({ isActive: false });
  const jobs = await f.t.run(ctx => ctx.db.system.query("_scheduled_functions").collect());
  expect(jobs.length).toBeLessThanOrEqual(5);
  expect(await f.deletions()).toHaveLength(employeeIds.length);
  expect(new Set((await f.deletions()).map(job => job.args[0].employeeId))).toEqual(new Set(employeeIds));
  expect(Math.max(...f.dispatchSizes)).toBeLessThanOrEqual(201);
  const dispatched = await f.t.run(ctx => ctx.db.system.query("_scheduled_functions").collect());
  expect(dispatched.filter(job => job.name === "accessRules:reconcileIdeRemovalBatch")).toHaveLength(6);
}, 20_000);

it("Y-02: managed-roster cleanup is paged and never schedules local or unknown cards", async () => {
  const f = await fixture();
  await f.t.run(async ctx => {
    for (let i = 0; i < 250; i++) await ctx.db.insert("idePanelUsers", { projectId: f.projectId, deviceId: f.deviceId, ideUuid: "123456789012345", cardNumber: String(1000 + i), syncedAt: 0, managedByNgsplus: true });
    await ctx.db.insert("idePanelUsers", { projectId: f.projectId, deviceId: f.deviceId, ideUuid: "123456789012345", cardNumber: "local", syncedAt: 0, managedByNgsplus: false });
  });
  await f.as.mutation(api.accessRules.update, { ruleId: f.ruleId, isActive: false });
  expect((await f.t.run(ctx => ctx.db.system.query("_scheduled_functions").collect())).length).toBeLessThanOrEqual(4);
  const deletions = await f.deletions();
  expect(deletions).toHaveLength(250);
  expect(deletions.some(job => ["300", "local"].includes(job.args[0].cardNumber))).toBe(false);
  expect(Math.max(...f.dispatchSizes)).toBeLessThanOrEqual(101);
});

it("Y-02: a reactivated rule is respected when the deferred revocation runs", async () => {
  const f = await fixture();
  await f.t.run(async ctx => {
    const employeeId = await ctx.db.insert("employees", { projectId: f.projectId, firstName: "Üye", lastName: "Test", email: "a@example.test", cardNumber: "100", isActive: true });
    await ctx.db.insert("groupMembers", { projectId: f.projectId, groupId: f.ruleId, employeeId, createdAt: "" });
  });
  await f.as.mutation(api.accessRules.update, { ruleId: f.ruleId, isActive: false });
  await f.t.run(ctx => ctx.db.patch(f.ruleId, { isActive: true }));
  expect(await f.deletions()).toEqual([]);
});


it("N3-03: deletion action rechecks reactivated membership immediately before enqueue", async () => {
  const f = await fixture();
  await f.ack(200);
  const employeeId = await f.t.run(async ctx => {
    const employeeId = await ctx.db.insert("employees", { projectId: f.projectId, firstName: "Üye", lastName: "Test", email: "test@example.test", cardNumber: "200", isActive: true });
    await ctx.db.insert("groupMembers", { projectId: f.projectId, groupId: f.ruleId, employeeId, createdAt: "" });
    return employeeId;
  });
  expect(await f.t.action(internal.actions.ideGatewayDevice.deleteIdeUserFromPanels, { employeeId, cardNumber: "200", deviceIds: [f.deviceId], projectId: f.projectId })).toEqual({ ok: true, queued: 0 });
  await f.t.run(ctx => ctx.db.patch(f.ruleId, { isActive: false }));
  expect(await f.t.action(internal.actions.ideGatewayDevice.deleteIdeUserFromPanels, { employeeId, cardNumber: "200", deviceIds: [f.deviceId], projectId: f.projectId })).toEqual({ ok: true, queued: 1 });
});

it("N3-05: roster continuation carries the panel authorization snapshot", async () => {
  const f = await fixture();
  await f.t.run(async ctx => {
    for (let i = 0; i < 110; i++) await ctx.db.insert("idePanelUsers", { projectId: f.projectId, deviceId: f.deviceId, ideUuid: "123456789012345", cardNumber: String(1000 + i), syncedAt: 0, managedByNgsplus: true });
  });
  await f.t.mutation(internal.accessRules.reconcileIdeRosterPage, { projectId: f.projectId, panels: [f.deviceId], cursor: null });
  const jobs = await f.t.run(ctx => ctx.db.system.query("_scheduled_functions").collect());
  const next = jobs.find(job => job.name.endsWith("reconcileIdeRosterPage"));
  expect(next?.args[0]).toMatchObject({ authorizedCards: [] });
});


it("N3-03: targeted inactive employees remain removable with active memberships", async () => {
  const f = await fixture();
  const employeeId = await f.t.run(async ctx => {
    const employeeId = await ctx.db.insert("employees", { projectId: f.projectId, firstName: "Pasif", lastName: "Kişi", email: "inactive@example.test", cardNumber: "200", isActive: false });
    await ctx.db.insert("groupMembers", { projectId: f.projectId, groupId: f.ruleId, employeeId, createdAt: "" });
    return employeeId;
  });
  expect(await f.t.action(internal.actions.ideGatewayDevice.deleteIdeUserFromPanels, { employeeId, cardNumber: "200", deviceIds: [f.deviceId], projectId: f.projectId })).toEqual({ ok: true, queued: 1 });
});

it("N3-03: roster deletion action preserves local and unknown records", async () => {
  const f = await fixture();
  await f.t.mutation(internal.ideSync.seedPanelUsers, { deviceId: f.deviceId, rawCards: [100] });
  for (const cardNumber of ["100", "300", "400"]) {
    expect(await f.t.action(internal.actions.ideGatewayDevice.deleteIdeUserFromPanels, { cardNumber, deviceIds: [f.deviceId], projectId: f.projectId })).toEqual({ ok: true, queued: 0 });
  }
});

it("N3-05: continuation uses its snapshot rather than recomputing the changed graph", async () => {
  const f = await fixture();
  await f.ack(200);
  await f.t.run(async ctx => {
    const employeeId = await ctx.db.insert("employees", { projectId: f.projectId, firstName: "Üye", lastName: "Test", email: "member@example.test", cardNumber: "200", isActive: true });
    await ctx.db.insert("groupMembers", { projectId: f.projectId, groupId: f.ruleId, employeeId, createdAt: "" });
  });
  await f.t.mutation(internal.accessRules.reconcileIdeRosterPage, { projectId: f.projectId, panels: [f.deviceId], cursor: null, authorizedCards: [] });
  const jobs = await f.t.run(ctx => ctx.db.system.query("_scheduled_functions").collect());
  expect(jobs.filter(job => job.name.includes("deleteIdeUserFromPanels"))).toHaveLength(1);
  // The final atomic check still protects an authorization added after snapshot.
  expect(await f.t.action(internal.actions.ideGatewayDevice.deleteIdeUserFromPanels, { cardNumber: "200", deviceIds: [f.deviceId], projectId: f.projectId })).toEqual({ ok: true, queued: 0 });
});


it("N3-03: a padded card authorized through a door protects the current panel", async () => {
  const f = await fixture();
  await f.ack(200);
  await f.t.run(async ctx => {
    const links = await ctx.db.query("groupDevices").withIndex("by_device", q => q.eq("deviceId", f.deviceId)).collect();
    for (const link of links) await ctx.db.delete(link._id);
    const doorId = await ctx.db.insert("doors", { projectId: f.projectId, deviceId: f.deviceId, name: "Kapı", ioId: 0 });
    await ctx.db.insert("groupDoors", { projectId: f.projectId, groupId: f.ruleId, doorId, createdAt: "" });
    const employeeId = await ctx.db.insert("employees", { projectId: f.projectId, firstName: "Üye", lastName: "Test", email: "pad@example.test", cardNumber: "000200", isActive: true });
    await ctx.db.insert("groupMembers", { projectId: f.projectId, groupId: f.ruleId, employeeId, createdAt: "" });
  });
  expect(await f.t.action(internal.actions.ideGatewayDevice.deleteIdeUserFromPanels, { cardNumber: "200", deviceIds: [f.deviceId], projectId: f.projectId })).toEqual({ ok: true, queued: 0 });
});

it("N3-05: panel transitions discard the preceding panel's snapshot", async () => {
  const f = await fixture();
  const nextId = await f.t.run(ctx => ctx.db.insert("devices", { projectId: f.projectId, name: "Diğer", brand: "ide_smart", ideUuid: "next", isActive: true, createdAt: "", updatedAt: "" }));
  await f.t.mutation(internal.accessRules.reconcileIdeRosterPage, { projectId: f.projectId, panels: [f.deviceId, nextId], cursor: null, authorizedCards: ["200"] });
  const jobs = await f.t.run(ctx => ctx.db.system.query("_scheduled_functions").collect());
  const next = jobs.find(job => job.name.endsWith("reconcileIdeRosterPage"));
  expect(next?.args[0]).toMatchObject({ panels: [nextId], cursor: null });
  expect(next?.args[0]).not.toHaveProperty("authorizedCards");
});

it("N3-05: oversized snapshots are rejected before scheduling", async () => {
  const f = await fixture();
  await expect(f.t.mutation(internal.accessRules.reconcileIdeRosterPage, { projectId: f.projectId, panels: [f.deviceId], cursor: null, authorizedCards: Array.from({ length: 4001 }, (_, i) => String(i)) })).rejects.toThrow("Cihaz yetki listesi sınırı");
});
