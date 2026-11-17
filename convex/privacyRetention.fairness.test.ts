// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, expect, it, vi } from "vitest";
import schema from "./schema";
import { internal } from "./_generated/api";
import { DAY_MS } from "./privacyRetention";

const modules = import.meta.glob("./**/*.ts");
const now = Date.parse("2026-11-14T00:55:00Z");
afterEach(() => vi.useRealTimers());

it("rotates all 25 projects across two daily budgets, including projects behind a failing cascade", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  const t = convexTest(schema, modules);
  const data = await t.run(async ctx => {
    const rows = [];
    for (let i = 0; i < 25; i++) {
      const projectId = await ctx.db.insert("projects", { name: String(i) });
      const privacyId = await ctx.db.insert("projectPrivacySettings", {
        projectId, visitorRetentionDays: 90, visitorRetentionLastProcessedAt: 0, updatedAt: new Date(now).toISOString(),
      });
      const visitorId = await ctx.db.insert("employees", {
        projectId, firstName: "Visitor", lastName: String(i), email: "test@example.test", cardNumber: String(i),
        isVisitor: true, isActive: false, visitorStatus: "checkedOut",
        accessExpiresAt: new Date(now - 100 * DAY_MS).toISOString(),
      });
      rows.push({ projectId, privacyId, visitorId });
    }
    // A permanent cascade failure in the first project must not starve the others.
    for (let i = 0; i < 1001; i++) await ctx.db.insert("attendanceCorrections", {
      projectId: rows[0].projectId, employeeId: rows[0].visitorId, date: "2026-01-01",
      correctionType: "checkIn", reason: "Limit", status: "pending",
      createdAt: new Date(now).toISOString(), updatedAt: new Date(now).toISOString(),
    });
    return rows;
  });
  await t.mutation(internal.privacyRetention.startDailyPurge, { group: "access" });
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  const first = await t.run(async ctx => Promise.all(data.map(row => ctx.db.get(row.privacyId))));
  expect(first.filter(row => (row?.visitorRetentionLastProcessedAt ?? 0) > 0).length).toBe(14);
  vi.setSystemTime(now + DAY_MS);
  await t.mutation(internal.privacyRetention.startDailyPurge, { group: "access" });
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  const second = await t.run(async ctx => Promise.all(data.map(row => ctx.db.get(row.privacyId))));
  expect(second.every(row => (row?.visitorRetentionLastProcessedAt ?? 0) > 0)).toBe(true);
  expect(await t.run(ctx => ctx.db.get(data[0].visitorId))).not.toBeNull();
  for (const row of data.slice(1)) expect(await t.run(ctx => ctx.db.get(row.visitorId))).toBeNull();
});

it("resumes a project's cursor with its original cutoff on the following day", async () => {
  vi.useFakeTimers(); vi.setSystemTime(now);
  const t = convexTest(schema, modules);
  const privacyId = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "Large" });
    const id = await ctx.db.insert("projectPrivacySettings", { projectId, visitorRetentionDays: 90, visitorRetentionLastProcessedAt: 0, updatedAt: new Date(now).toISOString() });
    for (let i = 0; i < 55; i++) await ctx.db.insert("employees", {
      projectId, firstName: "V", lastName: String(i), email: "v@example.test", cardNumber: String(i),
      isVisitor: true, isActive: false, visitorStatus: "checkedOut",
      accessExpiresAt: new Date(now - 100 * DAY_MS).toISOString(),
    });
    return id;
  });
  await t.mutation(internal.privacyRetention.purgeVisitors, { stage: 14, batch: 19, runAt: now });
  const progress = await t.run(ctx => ctx.db.get(privacyId));
  expect(progress?.visitorRetentionCursor).toEqual(expect.any(String));
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  vi.setSystemTime(now + DAY_MS);
  await t.mutation(internal.privacyRetention.purgeVisitors, { stage: 14, batch: 19, runAt: now + DAY_MS });
  expect((await t.run(ctx => ctx.db.get(privacyId)))?.visitorRetentionRunAt).toBe(now);
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(await t.run(ctx => ctx.db.query("employees").collect())).toHaveLength(5);
});

it("bootstraps enabled settings beyond disabled pages without writing disabled rows on either day", async () => {
  vi.useFakeTimers(); vi.setSystemTime(now);
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const disabled = [];
    for (let i = 0; i < 120; i++) {
      const projectId = await ctx.db.insert("projects", { name: String(i) });
      disabled.push(await ctx.db.insert("projectPrivacySettings", { projectId, aiMaskNames: true, updatedAt: "unchanged" }));
    }
    const projectId = await ctx.db.insert("projects", { name: "Enabled legacy setting" });
    const enabled = await ctx.db.insert("projectPrivacySettings", { projectId, visitorRetentionDays: 90, updatedAt: "unchanged" });
    return { disabled, enabled };
  });
  const before = await t.run(ctx => Promise.all(ids.disabled.map(id => ctx.db.get(id))));
  for (let day = 0; day < 2; day++) {
    vi.setSystemTime(now + day * DAY_MS);
    await t.mutation(internal.privacyRetention.startDailyPurge, { group: "access" });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await t.run(ctx => Promise.all(ids.disabled.map(id => ctx.db.get(id))))).toEqual(before);
    expect((await t.run(ctx => ctx.db.get(ids.enabled)))?.visitorRetentionLastProcessedAt).toBeGreaterThan(0);
  }
});

it("attempts a permanently failing visitor only once per daily run and audits it once", async () => {
  vi.useFakeTimers(); vi.setSystemTime(now);
  const t = convexTest(schema, modules);
  const visitorId = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "Blocked visitor" });
    await ctx.db.insert("projectPrivacySettings", {
      projectId, visitorRetentionDays: 90, visitorRetentionLastProcessedAt: 0, updatedAt: "unchanged",
    });
    const employeeId = await ctx.db.insert("employees", {
      projectId, firstName: "Blocked", lastName: "Visitor", email: "blocked@example.test", cardNumber: "blocked",
      isVisitor: true, isActive: false, visitorStatus: "checkedOut",
      accessExpiresAt: new Date(now - 100 * DAY_MS).toISOString(),
    });
    for (let i = 0; i < 1001; i++) await ctx.db.insert("attendanceCorrections", {
      projectId, employeeId, date: "2026-01-01", correctionType: "checkIn", reason: "Limit",
      status: "pending", createdAt: "now", updatedAt: "now",
    });
    return employeeId;
  });
  for (let day = 0; day < 2; day++) {
    vi.setSystemTime(now + day * DAY_MS);
    await t.mutation(internal.privacyRetention.startDailyPurge, { group: "access" });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await t.run(ctx => ctx.db.get(visitorId))).not.toBeNull();
    const audit = await t.run(ctx => ctx.db.query("auditLog").collect());
    expect(audit.filter(row => row.targetId === visitorId && row.note?.startsWith("Saklama silmesi atlandı: "))).toHaveLength(day + 1);
    const jobs = await t.run(ctx => ctx.db.system.query("_scheduled_functions").collect());
    expect(jobs.filter(job => job.name === "privacyRetention:removeRetainedVisitor" && job.args[0].visitorId === visitorId)).toHaveLength(day + 1);
  }
});

it("removes invalid settings from the queue and processes the next enabled project", async () => {
  vi.useFakeTimers(); vi.setSystemTime(now);
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const brokenProject = await ctx.db.insert("projects", { name: "Invalid days" });
    const broken = await ctx.db.insert("projectPrivacySettings", {
      projectId: brokenProject, visitorRetentionDays: 29, visitorRetentionLastProcessedAt: 0,
      visitorRetentionCursor: "obsolete", visitorRetentionRunAt: now, visitorRetentionCursorDays: 29, updatedAt: "unchanged",
    });
    const projectId = await ctx.db.insert("projects", { name: "Healthy" });
    const healthy = await ctx.db.insert("projectPrivacySettings", {
      projectId, visitorRetentionDays: 90, visitorRetentionLastProcessedAt: 1, updatedAt: "unchanged",
    });
    const visitor = await ctx.db.insert("employees", {
      projectId, firstName: "Healthy", lastName: "Visitor", email: "healthy@example.test", cardNumber: "healthy",
      isVisitor: true, isActive: false, visitorStatus: "checkedOut",
      accessExpiresAt: new Date(now - 100 * DAY_MS).toISOString(),
    });
    return { broken, healthy, visitor };
  });
  await t.mutation(internal.privacyRetention.startDailyPurge, { group: "access" });
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  const broken = await t.run(ctx => ctx.db.get(ids.broken));
  expect(broken?.visitorRetentionLastProcessedAt).toBeUndefined();
  expect(broken?.visitorRetentionCursor).toBeUndefined();
  expect(broken?.visitorRetentionRunAt).toBeUndefined();
  expect(broken?.visitorRetentionCursorDays).toBeUndefined();
  expect(broken?.visitorRetentionDays).toBe(29);
  expect(await t.run(ctx => ctx.db.get(ids.visitor))).toBeNull();
  expect((await t.run(ctx => ctx.db.get(ids.healthy)))?.visitorRetentionLastProcessedAt).toBeGreaterThanOrEqual(now);
});
