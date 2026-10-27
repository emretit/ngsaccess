// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { internal } from "./_generated/api";
import { afterEach, expect, it, vi } from "vitest";
import schema from "./schema";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { DAY_MS } from "./privacyRetention";

const modules = import.meta.glob("./**/*.ts");
const runAt = Date.parse("2026-10-26T00:40:00.000Z");
const old = runAt - 500 * DAY_MS;
const iso = (time: number) => new Date(time).toISOString();
const ref = (name: "purgeHik" | "purgeIde" | "purgeSyncRuns" | "purgeDeviceEvents" | "purgeCheckInTokens" | "purgeEmployeeSessions" | "purgeMobileOperations") => internal.privacyRetention[name];
const cases = [
  ["purgeHik", 0], ["purgeHik", 1], ["purgeIde", 2], ["purgeIde", 3],
  ["purgeSyncRuns", 4], ["purgeSyncRuns", 5], ["purgeSyncRuns", 6],
  ["purgeDeviceEvents", 7], ["purgeCheckInTokens", 8], ["purgeCheckInTokens", 9],
  ["purgeEmployeeSessions", 10], ["purgeMobileOperations", 11], ["purgeMobileOperations", 12], ["purgeMobileOperations", 13],
] as const;
async function fixture() {
  vi.useFakeTimers(); vi.setSystemTime(runAt);
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "Retention" });
    const employeeId = await ctx.db.insert("employees", { projectId, firstName: "Test", lastName: "Retention", email: "retention@example.test", cardNumber: "retention" });
    const deviceId = await ctx.db.insert("devices", { projectId, name: "Test", deviceSerial: "retention-test", createdAt: iso(old), updatedAt: iso(old) });
    const startedBy = await ctx.db.insert("users", {});
    const sessionId = await ctx.db.insert("employeeSessions", { employeeId, token: "active", createdAt: iso(old), expiresAt: iso(runAt + DAY_MS) });
    return { projectId, employeeId, deviceId, startedBy, sessionId };
  });
  return { t, ids };
}
type Ids = Awaited<ReturnType<typeof fixture>>["ids"];
async function insert(ctx: MutationCtx, ids: Ids, stage: number, time = old, active = false) {
  const status = stage === 0 ? "done" : "failed";
  if (stage < 2) return ctx.db.insert("hikPendingOperations", { deviceId: ids.deviceId, operation: "deletePerson", payload: {}, status: active ? "pending" : status, attemptCount: 1, createdAt: time, completedAt: time, dismissedAt: status === "failed" ? time : undefined });
  if (stage < 4) return ctx.db.insert("idePendingOperations", { deviceId: ids.deviceId, opType: "deleteUser", payload: {}, status: active ? "sent" : stage === 2 ? "acked" : "failed", attempts: 1, idempotencyKey: crypto.randomUUID(), createdAt: time, ackedAt: time, dismissedAt: stage === 3 ? time : undefined });
  if (stage < 7) return ctx.db.insert("deviceSyncRuns", { projectId: ids.projectId, startedBy: ids.startedBy, kind: "project_resync", startedAt: time, finishedAt: time, status: active ? "running" : stage === 4 ? "done" : stage === 5 ? "partial" : "failed", counts: { queued: 0, sent: 0, verified: 0, failed: 0, skipped: 0, unknown: 0 } });
  if (stage === 7) return ctx.db.insert("deviceEvents", { source: "system", eventTime: iso(time), category: "status", severity: "info", label: "Test", createdAt: iso(time), updatedAt: iso(time) });
  if (stage < 10) return ctx.db.insert("checkInTokens", { employeeId: ids.employeeId, token: crypto.randomUUID(), createdAt: iso(old), expiresAt: iso(active ? runAt + DAY_MS : stage === 9 ? runAt + DAY_MS : time), usedAt: stage === 9 && !active ? iso(time) : undefined });
  if (stage === 10) return ctx.db.insert("employeeSessions", { employeeId: ids.employeeId, token: crypto.randomUUID(), createdAt: iso(old), expiresAt: iso(active ? runAt + DAY_MS : time) });
  return ctx.db.insert("mobileAccessOperations", { projectId: ids.projectId, employeeId: ids.employeeId, sessionId: ids.sessionId, deviceId: ids.deviceId, deviceName: "Test", authVersion: 0, requestId: crypto.randomUUID(), requestedAt: iso(time), status: active ? "pending" : stage === 11 ? "confirmed" : stage === 12 ? "failed" : "unknown", transport: "ide_mqtt", actuator: 1 });
}
afterEach(() => vi.useRealTimers());
it.each(cases)("%s stage %i deletes 450 old records in three batches and keeps recent/active records", async (name, stage) => {
  const { t, ids } = await fixture();
  const { expired, recent, active } = await t.run(async ctx => {
    const expired = [];
    for (let i = 0; i < 450; i++) expired.push(await insert(ctx, ids, stage));
    return { expired, recent: await insert(ctx, ids, stage, runAt), active: stage === 7 ? null : await insert(ctx, ids, stage, old, true) };
  });
  await t.mutation(ref(name), { stage, batch: 0, runAt });
  expect(await t.run(async ctx => (await Promise.all(expired.map(id => ctx.db.get(id)))).filter(row => row !== null).length)).toBe(250);
  const jobs = await t.run(ctx => ctx.db.system.query("_scheduled_functions").collect());
  expect(jobs).toHaveLength(1);
  expect(jobs[0].name).toBe(`privacyRetention:${name}`);
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(await t.run(async ctx => (await Promise.all(expired.map(id => ctx.db.get(id)))).filter(row => row !== null).length)).toBe(0);
  expect(await t.run(ctx => ctx.db.get(recent))).not.toBeNull();
  if (active) expect(await t.run(ctx => ctx.db.get(active))).not.toBeNull();
  const allJobs = await t.run(ctx => ctx.db.system.query("_scheduled_functions").collect());
  // Run pages can need a final empty read; exactly three nonempty pages always suffice.
  expect(allJobs.filter(job => job.name === `privacyRetention:${name}` && job.args[0].stage === stage)).toHaveLength(2);
  expect(allJobs.length + 1).toBeLessThanOrEqual(20);
});
it("keeps recent terminal updates and unresolved failed revocations", async () => {
  const { t, ids } = await fixture();
  const keep = await t.run(async ctx => {
    const hik = await insert(ctx, ids, 0); await ctx.db.patch(hik, { completedAt: runAt });
    const ide = await insert(ctx, ids, 2); await ctx.db.patch(ide, { ackedAt: runAt });
    const failedHik = await insert(ctx, ids, 1); await ctx.db.patch(failedHik, { dismissedAt: undefined });
    const failedIde = await insert(ctx, ids, 3); await ctx.db.patch(failedIde, { dismissedAt: undefined });
    return [hik, ide, failedHik, failedIde];
  });
  await t.mutation(ref("purgeHik"), { stage: 0, batch: 0, runAt });
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  for (const id of keep) expect(await t.run(ctx => ctx.db.get(id))).not.toBeNull();
});
it("deletes target pages before deleting their completed parent; keeps running run targets", async () => {
  const { t, ids } = await fixture();
  const runId = await t.run(ctx => ctx.db.insert("deviceSyncRuns", { projectId: ids.projectId, startedBy: ids.startedBy, kind: "project_resync", startedAt: old, finishedAt: old, status: "done", counts: { queued: 0, sent: 0, verified: 0, failed: 0, skipped: 0, unknown: 0 } }));
  const running = await t.run(async ctx => {
    const run = await ctx.db.get(runId);
    if (!run) throw new Error("Missing test run");
    const runningId = await ctx.db.insert("deviceSyncRuns", { projectId: run.projectId, kind: run.kind, startedBy: run.startedBy, startedAt: old, finishedAt: old, status: "running", counts: run.counts });
    const targetId = await ctx.db.insert("deviceSyncRunTargets", { runId: runningId, deviceId: ids.deviceId, deviceName: "Test", brand: "other", status: "queued", updatedAt: old });
    return { runningId, targetId };
  });
  await t.run(async ctx => { for (let i = 0; i < 450; i++) await ctx.db.insert("deviceSyncRunTargets", { runId, deviceId: ids.deviceId, deviceName: "Test", brand: "other", status: "verified", updatedAt: old }); });
  await t.mutation(ref("purgeSyncRuns"), { stage: 4, batch: 0, runAt });
  expect(await t.run(ctx => ctx.db.get(runId))).not.toBeNull();
  expect(await t.run(ctx => ctx.db.query("deviceSyncRunTargets").withIndex("by_run", q => q.eq("runId", runId)).collect())).toHaveLength(250);
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(await t.run(ctx => ctx.db.get(runId))).toBeNull();
  expect(await t.run(ctx => ctx.db.query("deviceSyncRunTargets").withIndex("by_run", q => q.eq("runId", runId)).collect())).toHaveLength(0);
  expect(await t.run(ctx => ctx.db.get(running.runningId))).not.toBeNull();
  expect(await t.run(ctx => ctx.db.get(running.targetId))).not.toBeNull();
});
it("stops at the group 20 invocation limit with backlog preserved", async () => {
  const { t, ids } = await fixture();
  await t.run(async ctx => { for (let i = 0; i < 450; i++) await insert(ctx, ids, 7); });
  await t.mutation(ref("purgeDeviceEvents"), { stage: 7, batch: 19, runAt });
  expect(await t.run(ctx => ctx.db.query("deviceEvents").collect())).toHaveLength(250);
  expect(await t.run(ctx => ctx.db.system.query("_scheduled_functions").collect())).toHaveLength(0);
});

it("preserves all active operation states and recently used expired tokens across the daily orchestrator", async () => {
  const { t, ids } = await fixture();
  const keep = await t.run(async ctx => {
    const processing = await insert(ctx, ids, 0); await ctx.db.patch(processing, { status: "processing" });
    const pending = await insert(ctx, ids, 2); await ctx.db.patch(pending, { status: "pending" });
    const sent = await insert(ctx, ids, 11); await ctx.db.patch(sent, { status: "sent" });
    const token = await insert(ctx, ids, 8); await ctx.db.patch(token, { usedAt: iso(runAt) });
    return [processing, pending, sent, token];
  });
  for (const group of ["operations", "events", "access"] as const) {
    await t.mutation(internal.privacyRetention.startDailyPurge, { group });
  }
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  for (const id of keep) expect(await t.run(ctx => ctx.db.get(id))).not.toBeNull();
});

it.each([0, 1, 2, 3])("ignores future retry timestamps for terminal stage %i and drains sentinel pages", async stage => {
  const { t, ids } = await fixture();
  const expired = await t.run(async ctx => {
    const result = [];
    for (let i = 0; i < 451; i++) {
      if (stage < 2) result.push(await ctx.db.insert("hikPendingOperations", {
        deviceId: ids.deviceId, operation: "openDoor", payload: {}, status: stage === 0 ? "done" : "failed",
        attemptCount: 1, createdAt: old + i, completedAt: old,
        nextRetryAt: i < 450 ? Number.MAX_SAFE_INTEGER : runAt + DAY_MS,
      }));
      else result.push(await ctx.db.insert("idePendingOperations", {
        deviceId: ids.deviceId, opType: "openDoor", payload: {}, status: stage === 2 ? "acked" : "failed",
        attempts: 1, idempotencyKey: crypto.randomUUID(), createdAt: old + i, ackedAt: old,
        nextRetryAt: i < 450 ? Number.MAX_SAFE_INTEGER : runAt + DAY_MS,
      }));
    }
    return result;
  });
  await t.mutation(ref(stage < 2 ? "purgeHik" : "purgeIde"), { stage, batch: 0, runAt });
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  for (const id of expired) expect(await t.run(ctx => ctx.db.get(id))).toBeNull();
});

it("keeps recent elapsed retries and active operations with future retries", async () => {
  const { t, ids } = await fixture();
  const keep = await t.run(async ctx => {
    const hik = await insert(ctx, ids, 0);
    await ctx.db.patch(hik, { nextRetryAt: runAt - DAY_MS });
    const ide = await insert(ctx, ids, 2);
    await ctx.db.patch(ide, { nextRetryAt: runAt - DAY_MS });
    const pendingHik = await insert(ctx, ids, 0, old, true);
    await ctx.db.patch(pendingHik, { nextRetryAt: Number.MAX_SAFE_INTEGER });
    const sentIde = await insert(ctx, ids, 2, old, true);
    await ctx.db.patch(sentIde, { nextRetryAt: runAt + DAY_MS });
    return [hik, ide, pendingHik, sentIde];
  });
  await t.mutation(internal.privacyRetention.startDailyPurge, { group: "operations" });
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  for (const id of keep) expect(await t.run(ctx => ctx.db.get(id))).not.toBeNull();
});

it("preserves unresolved failed person/user changes and deletes old dismissed changes", async () => {
  const { t, ids } = await fixture();
  const { keep, remove } = await t.run(async ctx => {
    const keep: Id<"hikPendingOperations" | "idePendingOperations">[] = [];
    const remove: typeof keep = [];
    for (const operation of ["addPerson", "updatePerson"] as const) {
      for (const dismissedAt of [undefined, old]) {
        const id = await ctx.db.insert("hikPendingOperations", { deviceId: ids.deviceId, operation,
          payload: { endTime: iso(old) }, status: "failed", attemptCount: 1, createdAt: old,
          nextRetryAt: Number.MAX_SAFE_INTEGER, dismissedAt });
        (dismissedAt === undefined ? keep : remove).push(id);
      }
    }
    for (const dismissedAt of [undefined, old]) {
      const id = await ctx.db.insert("idePendingOperations", { deviceId: ids.deviceId, opType: "upsertUser",
        payload: { userRecord: { end: iso(old) } }, status: "failed", attempts: 1,
        idempotencyKey: crypto.randomUUID(), createdAt: old, dismissedAt });
      (dismissedAt === undefined ? keep : remove).push(id);
    }
    return { keep, remove };
  });
  await t.mutation(internal.privacyRetention.startDailyPurge, { group: "operations" });
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  for (const id of keep) expect(await t.run(ctx => ctx.db.get(id))).not.toBeNull();
  for (const id of remove) expect(await t.run(ctx => ctx.db.get(id))).toBeNull();
});

it("drains 450 events in 200/200/50 independently of an operations backlog", async () => {
  const { t, ids } = await fixture();
  await t.run(async ctx => {
    for (let i = 0; i < 450; i++) { await insert(ctx, ids, 0); await insert(ctx, ids, 7); }
  });
  await t.mutation(internal.privacyRetention.startDailyPurge, { group: "events" });
  const first = await t.run(ctx => ctx.db.system.query("_scheduled_functions").collect());
  expect(first).toHaveLength(1);
  expect(first[0].args[0]).toMatchObject({ stage: 7, batch: 0 });
  // Inspect each page directly, without running the queued first call twice.
  const pageSizes = [200, 200, 50];
  for (let batch = 0; batch < pageSizes.length; batch++) {
    const pending = await t.run(ctx => ctx.db.system.query("_scheduled_functions").collect());
    const job = pending[pending.length - 1];
    await t.mutation(internal.privacyRetention.purgeDeviceEvents, { stage: 7, batch, runAt,
      ...(typeof job.args[0].cursor === "string" ? { cursor: job.args[0].cursor } : {}) });
    expect(await t.run(ctx => ctx.db.query("deviceEvents").collect())).toHaveLength([250, 50, 0][batch]);
  }
  expect(await t.run(ctx => ctx.db.query("hikPendingOperations").collect())).toHaveLength(450);
  const jobs = await t.run(ctx => ctx.db.system.query("_scheduled_functions").collect());
  expect(jobs).toHaveLength(3);
  expect(jobs.every(job => job.name === "privacyRetention:purgeDeviceEvents")).toBe(true);
});

it.each([
  ["operations", 0, 6], ["events", 7, 7], ["access", 8, 14],
] as const)("bounds the %s chain to 20 calls and stays within its stages", async (group, first, last) => {
  const { t, ids } = await fixture();
  await t.run(async ctx => { for (let i = 0; i < 4100; i++) await insert(ctx, ids, first); });
  await t.mutation(internal.privacyRetention.startDailyPurge, { group });
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  const jobs = await t.run(ctx => ctx.db.system.query("_scheduled_functions").collect());
  expect(jobs).toHaveLength(20);
  expect(jobs.every(job => job.args[0].stage >= first && job.args[0].stage <= last)).toBe(true);
  for (let stage = first; stage <= last; stage++) expect(jobs.some(job => job.args[0].stage === stage)).toBe(true);
});


async function visitorFixture(days: number | null = 90) {
  const { t, ids } = await fixture();
  const privacyId = await t.run(ctx => ctx.db.insert("projectPrivacySettings", { projectId: ids.projectId,
    ...(days === null ? {} : { visitorRetentionDays: days }), updatedAt: iso(runAt) }));
  return { t, ids, privacyId };
}
async function addVisitor(ctx: MutationCtx, projectId: Id<"projects">, patch: Partial<import("./_generated/dataModel").Doc<"employees">> = {}) {
  return ctx.db.insert("employees", { projectId, firstName: "Visitor", lastName: "Retention", email: "visitor@example.test", cardNumber: crypto.randomUUID(),
    isVisitor: true, isActive: false, visitorStatus: "checkedOut", accessExpiresAt: iso(runAt - 100 * DAY_MS), updatedAt: iso(runAt), ...patch });
}
it("visitor retention is disabled by default", async () => {
  const { t, ids } = await visitorFixture(null);
  const id = await t.run(ctx => addVisitor(ctx, ids.projectId));
  await t.mutation(internal.privacyRetention.startDailyPurge, { group: "access" });
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(await t.run(ctx => ctx.db.get(id))).not.toBeNull();
});
it("purges only expired inactive visitors in enabled projects through the manual deletion cascade", async () => {
  const { t, ids } = await visitorFixture();
  const data = await t.run(async ctx => {
    const otherProject = await ctx.db.insert("projects", { name: "Other" });
    const expired = await addVisitor(ctx, ids.projectId);
    const oldPreRegistration = await addVisitor(ctx, ids.projectId, { visitorStatus: "preRegistered" });
    const fallback = await addVisitor(ctx, ids.projectId, { accessExpiresAt: undefined, updatedAt: iso(runAt - 100 * DAY_MS) });
    const keep = [
      await addVisitor(ctx, ids.projectId, { accessExpiresAt: iso(runAt - 80 * DAY_MS) }),
      await addVisitor(ctx, ids.projectId, { isActive: true }),
      await addVisitor(ctx, ids.projectId, { visitorStatus: "preRegistered", accessExpiresAt: iso(runAt + DAY_MS) }),
      await addVisitor(ctx, ids.projectId, { visitorStatus: "preRegistered", accessExpiresAt: iso(runAt - 10 * DAY_MS) }),
      await addVisitor(ctx, ids.projectId, { isVisitor: false }),
      await addVisitor(ctx, otherProject),
    ];
    const token = await ctx.db.insert("checkInTokens", { employeeId: expired, token: "visitor-token", createdAt: iso(runAt), expiresAt: iso(runAt + DAY_MS) });
    const consent = await ctx.db.insert("employeeConsents", { employeeId: expired, consentType: "visitor_kvkk", grantedAt: iso(old) });
    return { expired, oldPreRegistration, fallback, keep, token, consent };
  });
  await t.mutation(internal.privacyRetention.startDailyPurge, { group: "access" });
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(await t.run(ctx => ctx.db.get(data.expired))).toBeNull();
  expect(await t.run(ctx => ctx.db.get(data.fallback))).toBeNull();
  expect(await t.run(ctx => ctx.db.get(data.oldPreRegistration))).toBeNull();
  expect(await t.run(ctx => ctx.db.get(data.token))).toBeNull();
  expect(await t.run(ctx => ctx.db.get(data.consent))).toMatchObject({ revokedAt: iso(runAt) });
  for (const id of data.keep) expect(await t.run(ctx => ctx.db.get(id))).not.toBeNull();
  const audit = await t.run(ctx => ctx.db.query("auditLog").collect());
  expect(audit.filter(row => row.note === "Saklama süresi doldu (sistem)")).toHaveLength(3);
  expect(audit.every(row => row.userId === undefined)).toBe(true);
});
it("bounds visitor deletion to 25 per call, chains and rechecks disabled settings", async () => {
  const { t, ids, privacyId } = await visitorFixture();
  await t.run(async ctx => { for (let i = 0; i < 30; i++) await addVisitor(ctx, ids.projectId); });
  await t.mutation(internal.privacyRetention.purgeVisitors, { stage: 14, batch: 0, runAt });
  const remaining = await t.run(ctx => ctx.db.query("employees").withIndex("by_project_visitor", q => q.eq("projectId", ids.projectId).eq("isVisitor", true)).collect());
  expect(remaining).toHaveLength(30);
  const queued = await t.run(ctx => ctx.db.system.query("_scheduled_functions").collect());
  expect(queued.filter(job => job.name === "privacyRetention:removeRetainedVisitor")).toHaveLength(25);
  await t.run(ctx => ctx.db.patch(privacyId, { visitorRetentionDays: undefined }));
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  for (const row of remaining) expect(await t.run(ctx => ctx.db.get(row._id))).not.toBeNull();
});
it("preserves visitor backlog at the shared 20-call limit", async () => {
  const { t, ids } = await visitorFixture();
  await t.run(async ctx => { for (let i = 0; i < 30; i++) await addVisitor(ctx, ids.projectId); });
  await t.mutation(internal.privacyRetention.purgeVisitors, { stage: 14, batch: 19, runAt });
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  const rows = await t.run(ctx => ctx.db.query("employees").withIndex("by_project_visitor", q => q.eq("projectId", ids.projectId).eq("isVisitor", true)).collect());
  expect(rows).toHaveLength(5);
  const jobs = await t.run(ctx => ctx.db.system.query("_scheduled_functions").collect());
  expect(jobs.filter(job => job.name === "privacyRetention:purgeVisitors")).toHaveLength(0);
});

it("rechecks state and project at deletion time and is idempotent", async () => {
  const { t, ids } = await visitorFixture();
  const data = await t.run(async ctx => {
    const other = await ctx.db.insert("projects", { name: "Other" });
    const active = await addVisitor(ctx, ids.projectId, { isActive: true });
    const extended = await addVisitor(ctx, ids.projectId, { accessExpiresAt: iso(runAt + DAY_MS) });
    const reassigned = await addVisitor(ctx, other);
    const expired = await addVisitor(ctx, ids.projectId);
    return { keep: [active, extended, reassigned], expired };
  });
  for (const visitorId of data.keep) await t.mutation(internal.privacyRetention.removeRetainedVisitor, { visitorId, projectId: ids.projectId });
  for (const id of data.keep) expect(await t.run(ctx => ctx.db.get(id))).not.toBeNull();
  await t.mutation(internal.privacyRetention.removeRetainedVisitor, { visitorId: data.expired, projectId: ids.projectId });
  await t.mutation(internal.privacyRetention.removeRetainedVisitor, { visitorId: data.expired, projectId: ids.projectId });
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(await t.run(ctx => ctx.db.get(data.expired))).toBeNull();
  const audit = await t.run(ctx => ctx.db.query("auditLog").collect());
  expect(audit.filter(row => row.note === "Saklama süresi doldu (sistem)")).toHaveLength(1);
});
it("continues beyond the first visitor page and across enabled projects", async () => {
  const { t, ids } = await visitorFixture();
  const all = await t.run(async ctx => {
    const other = await ctx.db.insert("projects", { name: "Enabled" });
    await ctx.db.insert("projectPrivacySettings", { projectId: other, visitorRetentionDays: 90, updatedAt: iso(runAt) });
    const result = [await addVisitor(ctx, other)];
    for (let i = 0; i < 30; i++) result.push(await addVisitor(ctx, ids.projectId));
    return result;
  });
  await t.mutation(internal.privacyRetention.startDailyPurge, { group: "access" });
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  for (const id of all) expect(await t.run(ctx => ctx.db.get(id))).toBeNull();
  const jobs = await t.run(ctx => ctx.db.system.query("_scheduled_functions").collect());
  expect(jobs.filter(job => job.name === "privacyRetention:purgeVisitors").length).toBeLessThanOrEqual(14);
});

it.each([30, 180])("restarts a visitor page when retention changes from 90 to %i days", async days => {
  const { t, ids, privacyId } = await visitorFixture();
  await t.run(async ctx => { for (let i = 0; i < 30; i++) await addVisitor(ctx, ids.projectId); });
  await t.mutation(internal.privacyRetention.purgeVisitors, { stage: 14, batch: 0, runAt });
  const jobs = await t.run(ctx => ctx.db.system.query("_scheduled_functions").collect());
  const continuation = jobs.find(job => job.name === "privacyRetention:purgeVisitors");
  expect(continuation?.args[0]).toMatchObject({ days: 90, visitorProjectId: ids.projectId });
  expect(continuation?.args[0].cursor).toEqual(expect.any(String));
  await t.run(ctx => ctx.db.patch(privacyId, { visitorRetentionDays: days }));
  // A cursor from a different index range must never reach paginate, even if invalid.
  await t.mutation(internal.privacyRetention.purgeVisitors, { stage: 14, batch: 1, runAt,
    visitorProjectId: ids.projectId, days: 90, cursor: "obsolete-range-cursor" });
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  const remaining = await t.run(ctx => ctx.db.query("employees").withIndex("by_project_visitor", q => q.eq("projectId", ids.projectId).eq("isVisitor", true)).collect());
  expect(remaining).toHaveLength(days === 30 ? 0 : 30);
});

it("audits failed retention deletion, rolls back its partial cascade and continues other visitors", async () => {
  const { t, ids } = await visitorFixture();
  const data = await t.run(async ctx => {
    const blocked = await addVisitor(ctx, ids.projectId);
    const healthy = await addVisitor(ctx, ids.projectId);
    const session = await ctx.db.insert("employeeSessions", { employeeId: blocked, token: "keep-on-failure", createdAt: iso(runAt), expiresAt: iso(runAt + DAY_MS) });
    for (let i = 0; i < 1001; i++) await ctx.db.insert("attendanceCorrections", {
      employeeId: blocked, projectId: ids.projectId, date: "2026-01-01", correctionType: "checkIn",
      reason: "Limit fixture", status: "pending", createdAt: iso(runAt), updatedAt: iso(runAt),
    });
    return { blocked, healthy, session };
  });
  await t.mutation(internal.privacyRetention.startDailyPurge, { group: "access" });
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(await t.run(ctx => ctx.db.get(data.blocked))).not.toBeNull();
  expect(await t.run(ctx => ctx.db.get(data.session))).not.toBeNull();
  expect(await t.run(ctx => ctx.db.get(data.healthy))).toBeNull();
  const audit = await t.run(ctx => ctx.db.query("auditLog").collect());
  expect(audit.some(row => row.targetId === data.blocked && row.note?.startsWith("Saklama silmesi atlandı: ") && row.note.includes("talep geçmişi"))).toBe(true);
  const jobs = await t.run(ctx => ctx.db.system.query("_scheduled_functions").collect());
  expect(jobs.some(job => job.name.includes("deleteEmployeeFromDevicesInternal") && job.args[0].employeeId === data.blocked)).toBe(false);
});
