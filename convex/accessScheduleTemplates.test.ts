// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { emptyWeek, effectiveSchedule, isAllowedAt, type WeekSchedule } from "./lib/accessSchedule";
import { mobileRuleAllows } from "./lib/mobileAccess";
import { resolveActiveMatchingRuleIds } from "./lib/cardReadingProcess";
const wire = vi.hoisted(() => ({ send: vi.fn(async (..._args: unknown[]) => ({ ok: true })) }));
vi.mock("./lib/gateway/core", () => ({ gatewayApiCallChecked: wire.send }));
const modules = import.meta.glob("./**/*.ts");
const now = "2026-10-19T09:00:00.000Z";
function week(k = 1): WeekSchedule {
  return { ...emptyWeek(), Monday: Array.from({ length: k }, (_, i) => ({ start: `${String(8 + i * 2).padStart(2, "0")}:00`, end: `${String(9 + i * 2).padStart(2, "0")}:00` })) };
}
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(now)); wire.send.mockClear(); });
afterEach(() => vi.useRealTimers());
async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "A", isActive: true });
    const foreignProjectId = await ctx.db.insert("projects", { name: "B", isActive: true });
    const adminId = await ctx.db.insert("users", { role: "project_admin" });
    const readerId = await ctx.db.insert("users", { role: "project_user" });
    const adminSession = await ctx.db.insert("authSessions", { userId: adminId, expirationTime: Date.now() + 86400000 });
    const readerSession = await ctx.db.insert("authSessions", { userId: readerId, expirationTime: Date.now() + 86400000 });
    for (const userId of [adminId, readerId]) await ctx.db.insert("userProjects", { userId, projectId });
    const employeeId = await ctx.db.insert("employees", { projectId, firstName: "Deniz", lastName: "Test", email: "deniz@example.test", cardNumber: "12345", isActive: true });
    const base = { projectId, name: "Panel", isActive: true, createdAt: now, updatedAt: now, status: "online" };
    const ideId = await ctx.db.insert("devices", { ...base, brand: "ide_smart", ideUuid: "uuid", ideUser: "user", idePassword: "pass" });
    const hikId = await ctx.db.insert("devices", { ...base, brand: "hikvision", hikDevIndex: "index", hikLastSeenAt: Date.now() });
    const bridgeId = await ctx.db.insert("devices", { ...base, brand: "hikvision", hikTransport: "localBridge", deviceIp: "192.0.2.1", deviceUsername: "user", devicePassword: "pass" });
    return { projectId, foreignProjectId, adminId, adminSession, readerId, readerSession, employeeId, ideId, hikId, bridgeId };
  });
  const admin = t.withIdentity({ subject: `${ids.adminId}|${ids.adminSession}` });
  const reader = t.withIdentity({ subject: `${ids.readerId}|${ids.readerSession}` });
  const templateId = await admin.mutation(api.accessScheduleTemplates.create, { projectId: ids.projectId, name: "Mesai", week: week() });
  async function link(devices = [ids.ideId]) {
    return await t.run(async ctx => {
      const ruleId = await ctx.db.insert("accessRules", { projectId: ids.projectId, scheduleTemplateId: templateId, name: "Rule", isActive: true, days: ["Monday"], startTime: "10:00", endTime: "18:00", hikWeekPlanNo: 2, idePermissionNo: 5 });
      await ctx.db.insert("groupMembers", { projectId: ids.projectId, groupId: ruleId, employeeId: ids.employeeId, createdAt: now });
      for (const deviceId of devices) await ctx.db.insert("groupDevices", { projectId: ids.projectId, groupId: ruleId, deviceId, createdAt: now });
      return ruleId;
    });
  }
  return { t, ids, admin, reader, templateId, link };
}
describe("schedule template API and rule binding", () => {
  it("enforces write role and project scope, unique trimmed names", async () => {
    const { admin, reader, ids, templateId } = await fixture();
    await expect(reader.mutation(api.accessScheduleTemplates.create, { projectId: ids.projectId, name: "No", week: week() })).rejects.toThrow("yetkiniz");
    await expect(admin.mutation(api.accessScheduleTemplates.create, { projectId: ids.foreignProjectId, name: "No", week: week() })).rejects.toThrow("yetkiniz");
    await expect(admin.mutation(api.accessScheduleTemplates.create, { projectId: ids.projectId, name: " Mesai ", week: week() })).rejects.toThrow("aynı adlı");
    await expect(reader.mutation(api.accessScheduleTemplates.update, { templateId, week: week(2) })).rejects.toThrow("yetkiniz");
    const copied = await admin.mutation(api.accessScheduleTemplates.duplicate, { templateId, name: "Kopya" });
    expect((await admin.query(api.accessScheduleTemplates.get, { templateId: copied })).version).toBe(1);
  });
  it("protects attached deletion, archives without disabling existing rules, rejects new archived links", async () => {
    const { admin, templateId, link, ids } = await fixture();
    await link();
    await expect(admin.mutation(api.accessScheduleTemplates.remove, { templateId })).rejects.toThrow("1 kural kullanıyor");
    await admin.mutation(api.accessScheduleTemplates.setArchived, { templateId, isArchived: true });
    expect(await admin.query(api.accessScheduleTemplates.list, { projectId: ids.projectId })).toEqual([]);
    expect(await admin.query(api.accessScheduleTemplates.list, { projectId: ids.projectId, includeArchived: true })).toHaveLength(1);
    await expect(admin.mutation(api.accessRules.create, { projectId: ids.projectId, name: "Yeni", scheduleTemplateId: templateId })).rejects.toThrow("Arşivli");
  });
  it("counts rule/device union and segments in preview", async () => {
    const { admin, ids, templateId, link } = await fixture();
    await link([ids.ideId, ids.hikId]);
    expect(await admin.query(api.accessScheduleTemplates.previewImpact, { templateId, week: week(2) })).toEqual({ ruleCount: 1, deviceCount: 2, hikMaxSegmentsPerDay: 2, ideRecordCount: 2, ideOverLimit: [] });
  });
  it("rejects >16 total employee-panel records on update and binding, transactionally", async () => {
    const { t, admin, ids, templateId, link } = await fixture();
    await link();
    await t.run(async ctx => {
      for (let i = 0; i < 15; i++) {
        const ruleId = await ctx.db.insert("accessRules", { projectId: ids.projectId, name: `Other ${i}`, isActive: true });
        await ctx.db.insert("groupMembers", { projectId: ids.projectId, groupId: ruleId, employeeId: ids.employeeId, createdAt: now });
        await ctx.db.insert("groupDevices", { projectId: ids.projectId, groupId: ruleId, deviceId: ids.ideId, createdAt: now });
      }
    });
    expect((await admin.query(api.accessScheduleTemplates.previewImpact, { templateId, week: week(2) })).ideOverLimit).toEqual([{ employeeId: ids.employeeId, deviceId: ids.ideId, total: 17, employeeName: "Deniz Test", deviceName: "Panel" }]);
    await expect(admin.mutation(api.accessScheduleTemplates.update, { templateId, week: week(2) })).rejects.toThrow("Deniz Test / Panel: 17");
    expect((await admin.query(api.accessScheduleTemplates.get, { templateId })).version).toBe(1);
    await expect(admin.mutation(api.accessRules.createWithGroups, { projectId: ids.projectId, name: "Over", scheduleTemplateId: templateId, employeeIds: [ids.employeeId], deviceIds: [ids.ideId] })).rejects.toThrow("Deniz Test / Panel");
  });
  it("uses template in mobile/cloud; unlink restores embedded schedule; foreign and non-admin links denied", async () => {
    const { t, admin, reader, ids, templateId, link } = await fixture();
    const ruleId = await link();
    await t.run(async ctx => {
      const rule = await ctx.db.get(ruleId);
      const template = await ctx.db.get(templateId);
      if (!rule) throw new Error("missing");
      expect(mobileRuleAllows(rule, Date.parse(now), template)).toBe(false);
      expect((await resolveActiveMatchingRuleIds(ctx, [ruleId], [ruleId], Date.parse(now))).openRuleIds.size).toBe(0);
      expect(isAllowedAt(effectiveSchedule(rule, template), Date.parse("2026-10-19T05:30:00Z"))).toBe(true);
    });
    await expect(reader.mutation(api.accessRules.update, { ruleId, scheduleTemplateId: null })).rejects.toThrow("yetkiniz");
    const foreign = await t.run(ctx => ctx.db.insert("accessScheduleTemplates", { projectId: ids.foreignProjectId, name: "Other", week: week(), version: 1, createdAt: now, updatedAt: now }));
    await expect(admin.mutation(api.accessRules.update, { ruleId, scheduleTemplateId: foreign })).rejects.toThrow("projeye ait");
    await admin.mutation(api.accessRules.update, { ruleId, scheduleTemplateId: null });
    await t.run(async ctx => {
      const rule = await ctx.db.get(ruleId);
      if (!rule) throw new Error("missing");
      expect(rule.startTime).toBe("10:00");
      expect(mobileRuleAllows(rule, Date.parse(now))).toBe(true);
      expect((await resolveActiveMatchingRuleIds(ctx, [ruleId], [ruleId], Date.parse(now))).openRuleIds.has(ruleId)).toBe(true);
    });
    await vi.advanceTimersByTimeAsync(20_000);
    await t.finishInProgressScheduledFunctions();
    await vi.advanceTimersByTimeAsync(1);
    await t.finishInProgressScheduledFunctions();
  });
  it("rejects reading a foreign template and normalizes adjacent API intervals", async () => {
    const { t, admin, ids, templateId } = await fixture();
    const foreign = await t.run(ctx => ctx.db.insert("accessScheduleTemplates", { projectId: ids.foreignProjectId, name: "Foreign", week: week(), version: 1, createdAt: now, updatedAt: now }));
    await expect(admin.query(api.accessScheduleTemplates.get, { templateId: foreign })).rejects.toThrow("yetkiniz");
    await admin.mutation(api.accessScheduleTemplates.update, { templateId, week: { ...emptyWeek(), Monday: [{ start: "08:00", end: "12:00" }, { start: "12:00", end: "17:00" }] } });
    expect((await admin.query(api.accessScheduleTemplates.get, { templateId })).week.Monday).toEqual([{ start: "08:00", end: "17:00" }]);
  });
  it("missing template closes mobile and cloud; archived template still grants", async () => {
    const { t, admin, templateId, link } = await fixture();
    const ruleId = await link();
    await admin.mutation(api.accessScheduleTemplates.setArchived, { templateId, isArchived: true });
    const allowedTime = Date.parse("2026-10-19T05:30:00Z");
    await t.run(async ctx => {
      const rule = await ctx.db.get(ruleId);
      const template = await ctx.db.get(templateId);
      if (!rule) throw new Error("missing");
      expect(mobileRuleAllows(rule, allowedTime, template)).toBe(true);
      expect((await resolveActiveMatchingRuleIds(ctx, [ruleId], [ruleId], allowedTime)).openRuleIds.size).toBe(1);
      await ctx.db.delete(templateId);
      expect(mobileRuleAllows(rule, allowedTime, null)).toBe(false);
      expect((await resolveActiveMatchingRuleIds(ctx, [ruleId], [ruleId], allowedTime)).openRuleIds.size).toBe(0);
    });
  });

});
describe("template_sync schedule-only dispatch", () => {
  it("debounces five writes into one run; gateway sends only two plan requests per rule", async () => {
    const { t, admin, ids, templateId, link } = await fixture();
    await link([ids.hikId]);
    for (let i = 0; i < 5; i++) await admin.mutation(api.accessScheduleTemplates.update, { templateId, week: week(i % 2 + 2) });
    const scheduled = await t.run(ctx => ctx.db.system.query("_scheduled_functions").collect());
    expect(scheduled.filter(s => s.name === "deviceSyncRuns:createTemplateRun" && s.state.kind === "pending")).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(20_000);
    await t.finishInProgressScheduledFunctions();
    await vi.advanceTimersByTimeAsync(1);
    await t.finishInProgressScheduledFunctions();
    const runs = await t.run(ctx => ctx.db.query("deviceSyncRuns").take(10));
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ kind: "template_sync", status: "done" });
    expect(wire.send.mock.calls.map(call => call[0])).toEqual(["/ISAPI/AccessControl/UserRightWeekPlanCfg/2", "/ISAPI/AccessControl/UserRightPlanTemplate/2"]);
  });
  it("IDE unchanged K writes permission only; growing/shrinking K updates user and deletes retired records", async () => {
    const { t, admin, ids, templateId, link } = await fixture();
    const ruleId = await link();
    await admin.mutation(api.accessScheduleTemplates.update, { templateId, week: { ...emptyWeek(), Monday: [{ start: "07:00", end: "09:00" }] } });
    await vi.advanceTimersByTimeAsync(20_000);
    await t.finishInProgressScheduledFunctions();
    await vi.advanceTimersByTimeAsync(1);
    await t.finishInProgressScheduledFunctions();
    let ops = await t.run(ctx => ctx.db.query("idePendingOperations").take(100));
    expect(ops.map(o => o.opType)).toEqual(["upsertPermission"]);
    await admin.mutation(api.accessScheduleTemplates.update, { templateId, week: week(2) });
    await vi.advanceTimersByTimeAsync(20_000);
    await t.finishInProgressScheduledFunctions();
    await vi.advanceTimersByTimeAsync(1);
    await t.finishInProgressScheduledFunctions();
    ops = await t.run(ctx => ctx.db.query("idePendingOperations").take(100));
    expect(ops.filter(o => o.opType === "upsertUser")).toHaveLength(1);
    const allocated = await t.run(ctx => ctx.db.get(ruleId));
    expect(allocated?.ideExtraPermissionNos).toHaveLength(1);
    await admin.mutation(api.accessScheduleTemplates.update, { templateId, week: week() });
    await vi.advanceTimersByTimeAsync(20_000);
    await t.finishInProgressScheduledFunctions();
    await vi.advanceTimersByTimeAsync(1);
    await t.finishInProgressScheduledFunctions();
    ops = await t.run(ctx => ctx.db.query("idePendingOperations").take(100));
    expect(ops.filter(o => o.opType === "deletePermission")).toHaveLength(1);
    expect(ops.filter(o => o.opType === "upsertUser")).toHaveLength(2);
    expect(ops.filter(o => o.deviceId !== ids.ideId)).toEqual([]);
  });
  it("local bridge carries multiple schedule segments in one operation", async () => {
    const { t, admin, ids, templateId, link } = await fixture();
    await link([ids.bridgeId]);
    await admin.mutation(api.accessScheduleTemplates.update, { templateId, week: week(2) });
    await vi.advanceTimersByTimeAsync(20_000);
    await t.finishInProgressScheduledFunctions();
    await vi.advanceTimersByTimeAsync(1);
    await t.finishInProgressScheduledFunctions();
    const ops = await t.run(ctx => ctx.db.query("hikPendingOperations").take(10));
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({ operation: "syncWeekPlan", payload: { schedule: [{ week: "Monday", beginTime: "08:00:00", endTime: "09:00:59" }, { week: "Monday", beginTime: "10:00:00", endTime: "11:00:59" }] } });
  });
  it("marks IDE target failed when later memberships exceed the 16-record limit", async () => {
    const { t, admin, ids, templateId, link } = await fixture();
    const affectedRule = await link();
    await admin.mutation(api.accessScheduleTemplates.update, { templateId, week: week(2) });
    await t.run(async ctx => {
      const nextEmployee = await ctx.db.insert("employees", { projectId: ids.projectId, firstName: "Next", lastName: "Person", email: "next@example.test", cardNumber: "9876", isActive: true });
      await ctx.db.insert("groupMembers", { projectId: ids.projectId, groupId: affectedRule, employeeId: nextEmployee, createdAt: now });
      for (let i = 0; i < 15; i++) {
        const ruleId = await ctx.db.insert("accessRules", { projectId: ids.projectId, name: `Late ${i}`, isActive: true, idePermissionNo: 100 + i });
        await ctx.db.insert("groupMembers", { projectId: ids.projectId, groupId: ruleId, employeeId: ids.employeeId, createdAt: now });
        await ctx.db.insert("groupDevices", { projectId: ids.projectId, groupId: ruleId, deviceId: ids.ideId, createdAt: now });
      }
    });
    await vi.advanceTimersByTimeAsync(20_000);
    await t.finishInProgressScheduledFunctions();
    await vi.advanceTimersByTimeAsync(1);
    await t.finishInProgressScheduledFunctions();
    const targets = await t.run(ctx => ctx.db.query("deviceSyncRunTargets").take(10));
    expect(targets).toHaveLength(1);
    expect(targets[0]).toMatchObject({ status: "failed", reason: expect.stringContaining("Deniz Test: IDE 16 izin sınırı aşıldı") });
    const ops = await t.run(ctx => ctx.db.query("idePendingOperations").take(20));
    expect(ops.filter(op => op.opType === "upsertPermission")).toHaveLength(2);
    expect(ops.filter(op => op.opType === "upsertUser")).toHaveLength(1);
  });
  it("K=0 deletes old permission and sends an empty user permission list", async () => {
    const { t, admin, templateId, link } = await fixture();
    await link();
    await admin.mutation(api.accessScheduleTemplates.update, { templateId, week: emptyWeek() });
    await vi.advanceTimersByTimeAsync(20_000);
    await t.finishInProgressScheduledFunctions();
    await vi.advanceTimersByTimeAsync(1);
    await t.finishInProgressScheduledFunctions();
    const ops = await t.run(ctx => ctx.db.query("idePendingOperations").take(10));
    expect(ops.map(o => o.opType)).toEqual(["deletePermission", "upsertUser"]);
    expect(ops[1]).toMatchObject({ payload: { userRecord: { permissions: [] } } });
  });

});


describe("audit regressions", () => {
  it("enqueues after 1000 acked records and patches the newest open operation", async () => {
    const { t, ids } = await fixture();
    const args = { deviceId: ids.ideId, opType: "deletePermission" as const, payload: { ideId: 77 } };
    const first = await t.mutation(internal.ideSync.enqueueIdeOp, args);
    await t.run(async ctx => {
      const op = await ctx.db.get(first);
      if (!op) throw new Error("missing op");
      await ctx.db.patch(first, { status: "acked" });
      const { _id: ignoredId, _creationTime: ignoredTime, ...row } = op;
      void ignoredId; void ignoredTime;
      for (let i = 0; i < 1001; i++) await ctx.db.insert("idePendingOperations", { ...row, status: "acked" });
    });
    const next = await t.mutation(internal.ideSync.enqueueIdeOp, args);
    expect(next).not.toBe(first);
    expect(await t.mutation(internal.ideSync.enqueueIdeOp, args)).toBe(next);
  });
  it("bootstraps above all permission history and allocates sequential/concurrent unique numbers", async () => {
    const { t, ids, link } = await fixture();
    const ruleId = await link();
    await t.run(async ctx => {
      await ctx.db.patch(ruleId, { ideExtraPermissionNos: [50] });
      for (const [opType, payload] of [
        ["upsertPermission", { permissionRecord: { id: 70 } }],
        ["deletePermission", { ideId: 80 }],
        ["upsertUser", { ideId: 60000 }],
      ] as const) await ctx.db.insert("idePendingOperations", { deviceId: ids.ideId, opType, payload, status: "acked", idempotencyKey: opType, attempts: 1, createdAt: 0 });
    });
    const rules = await t.run(async ctx => await Promise.all(Array.from({ length: 4 }, (_, i) => ctx.db.insert("accessRules", { projectId: ids.projectId, name: `Allocate ${i}` }))));
    const first = rules[0];
    if (!first) throw new Error("missing rule");
    expect(await t.mutation(internal.ideSync.ensureIdePermissionNo, { accessRuleId: first })).toBe(81);
    const values = await Promise.all(rules.slice(1).map(accessRuleId => t.mutation(internal.ideSync.ensureIdePermissionNo, { accessRuleId })));
    expect(values.sort((a, b) => a - b)).toEqual([82, 83, 84]);
    expect(await t.run(ctx => ctx.db.query("ideSequences").unique())).toMatchObject({ last: 84 });
    // Historical tables exceeding the bootstrap bound no longer affect initialized allocation.
    await t.run(async ctx => {
      for (let i = 0; i < 10001; i++) await ctx.db.insert("idePendingOperations", { deviceId: ids.ideId, opType: "deletePermission", payload: { ideId: 1 }, status: "acked", idempotencyKey: "history", attempts: 1, createdAt: 0 });
      await ctx.db.patch(first, { idePermissionNo: undefined });
    });
    expect(await t.mutation(internal.ideSync.ensureIdePermissionNo, { accessRuleId: first })).toBe(85);
  });
  it("never recycles retired numbers and preserves the 65535 limit", async () => {
    const { t, ids, link } = await fixture();
    const ruleId = await link();
    await t.run(async ctx => {
      await ctx.db.insert("ideSequences", { name: "permissionNo", last: 65534 });
      await ctx.db.patch(ruleId, { idePermissionNo: undefined });
    });
    expect(await t.mutation(internal.ideSync.ensureIdePermissionNo, { accessRuleId: ruleId })).toBe(65535);
    await t.run(ctx => ctx.db.patch(ruleId, { idePermissionNo: undefined }));
    await expect(t.mutation(internal.ideSync.ensureIdePermissionNo, { accessRuleId: ruleId })).rejects.toThrow("65535");
    expect(await t.run(ctx => ctx.db.query("ideSequences").unique())).toMatchObject({ last: 65535 });
    void ids;
  });
  it("metadata updates clear description without scheduling or canceling schedule work", async () => {
    const { t, admin, templateId } = await fixture();
    await admin.mutation(api.accessScheduleTemplates.update, { templateId, description: "Details", name: "Renamed" });
    expect(await t.run(ctx => ctx.db.system.query("_scheduled_functions").take(10))).toHaveLength(0);
    await admin.mutation(api.accessScheduleTemplates.update, { templateId, description: "" });
    expect((await admin.query(api.accessScheduleTemplates.get, { templateId })).description).toBeUndefined();
    await admin.mutation(api.accessScheduleTemplates.update, { templateId, description: "Details", week: week(2) });
    const pending = (await admin.query(api.accessScheduleTemplates.get, { templateId })).pendingSyncJobId;
    await admin.mutation(api.accessScheduleTemplates.update, { templateId, description: null, week: week(2) });
    expect(await admin.query(api.accessScheduleTemplates.get, { templateId })).toMatchObject({ pendingSyncJobId: pending });
    expect((await admin.query(api.accessScheduleTemplates.get, { templateId })).description).toBeUndefined();
  });
  it("malformed stored weeks fail closed in mobile and cloud decisions", async () => {
    const { t, templateId, link } = await fixture();
    const ruleId = await link();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await t.run(async ctx => {
      await ctx.db.patch(templateId, { week: { ...emptyWeek(), Monday: [{ start: "bad", end: "09:00" }] } });
      const rule = await ctx.db.get(ruleId);
      const template = await ctx.db.get(templateId);
      if (!rule) throw new Error("missing rule");
      expect(mobileRuleAllows(rule, Date.parse(now), template)).toBe(false);
      expect((await resolveActiveMatchingRuleIds(ctx, [ruleId], [ruleId], Date.parse(now))).openRuleIds.size).toBe(0);
    });
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });
  it("template dispatch reads other template numbers without allocating or retiring them", async () => {
    const { t, admin, ids, templateId, link } = await fixture();
    await link();
    const otherTemplate = await admin.mutation(api.accessScheduleTemplates.create, { projectId: ids.projectId, name: "Other", week: week(2) });
    const otherRule = await t.run(async ctx => {
      const ruleId = await ctx.db.insert("accessRules", { projectId: ids.projectId, name: "Other", isActive: true, scheduleTemplateId: otherTemplate, idePermissionNo: 40 });
      await ctx.db.insert("groupMembers", { projectId: ids.projectId, groupId: ruleId, employeeId: ids.employeeId, createdAt: now });
      await ctx.db.insert("groupDevices", { projectId: ids.projectId, groupId: ruleId, deviceId: ids.ideId, createdAt: now });
      await ctx.db.patch(ids.employeeId, { accessStartsAt: "2026-10-31T21:00:00.000Z" });
      return ruleId;
    });
    await admin.mutation(api.accessScheduleTemplates.update, { templateId, week: week(2) });
    await vi.advanceTimersByTimeAsync(20_000); await t.finishInProgressScheduledFunctions();
    await vi.advanceTimersByTimeAsync(1); await t.finishInProgressScheduledFunctions();
    expect(await t.run(ctx => ctx.db.get(otherRule))).toMatchObject({ idePermissionNo: 40 });
    expect((await t.run(ctx => ctx.db.get(otherRule)))?.ideExtraPermissionNos).toBeUndefined();
    const ops = await t.run(ctx => ctx.db.query("idePendingOperations").take(20));
    expect(ops.filter(op => op.opType === "deletePermission")).toHaveLength(0);
    expect(ops.find(op => op.opType === "upsertUser")).toMatchObject({ payload: { userRecord: { start: 1793480400, permissions: [5, 40, 41] } } });
  });
  it("K=0 rule dispatch succeeds without operations, and retired deletion evidence determines its result", async () => {
    for (const retired of [false, true]) {
      const { t, admin, ids, templateId, link } = await fixture();
      const ruleId = await link();
      await t.run(async ctx => {
        await ctx.db.patch(templateId, { week: emptyWeek() });
        if (!retired) await ctx.db.patch(ruleId, { idePermissionNo: undefined });
        const members = await ctx.db.query("groupMembers").take(10);
        for (const member of members) await ctx.db.delete(member._id);
      });
      const { runId } = await admin.action(api.deviceSyncRuns.startRuleSync, { ruleId });
      await vi.advanceTimersByTimeAsync(1); await t.finishInProgressScheduledFunctions();
      await t.mutation(internal.deviceSyncRuns.refreshSummary, { runId });
      const target = await t.run(ctx => ctx.db.query("deviceSyncRunTargets").withIndex("by_run", q => q.eq("runId", runId)).take(10)).then(rows => rows.find(row => row.deviceId === ids.ideId));
      if (!target) throw new Error("missing target");
      expect(target.status).toBe(retired ? "queued" : "verified");
      if (retired) {
        const ops = await t.run(ctx => ctx.db.query("idePendingOperations").withIndex("by_run_device", q => q.eq("runId", runId).eq("deviceId", ids.ideId)).take(10));
        expect(ops.map(op => op.opType)).toEqual(["deletePermission"]);
        await t.run(async ctx => { for (const op of ops) await ctx.db.patch(op._id, { status: "failed", lastError: "delete rejected" }); });
        await t.mutation(internal.deviceSyncRuns.refreshSummary, { runId });
        expect(await t.run(ctx => ctx.db.get(target._id))).toMatchObject({ status: "failed", reason: "delete rejected" });
      }
    }
  });
  it("continues syncing remaining employees after one returns ok:false", async () => {
    const { t, ids, templateId, link } = await fixture();
    const ruleId = await link();
    await t.run(async ctx => {
      await ctx.db.patch(templateId, { week: week(2) });
      await ctx.db.patch(ids.employeeId, { cardNumber: "invalid" });
      const employeeId = await ctx.db.insert("employees", { projectId: ids.projectId, firstName: "Next", lastName: "Person", email: "next@example.test", cardNumber: "9876", isActive: true, accessStartsAt: "2026-10-31T21:00:00.000Z" });
      await ctx.db.insert("groupMembers", { projectId: ids.projectId, groupId: ruleId, employeeId, createdAt: now });
    });
    const result = await t.action(internal.actions.ideGatewayDevice.syncPermissionToIdePanels, { accessRuleId: ruleId });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("sayısal");
    expect(await t.run(ctx => ctx.db.query("idePendingOperations").take(20))).toEqual(expect.arrayContaining([expect.objectContaining({ opType: "upsertUser", payload: expect.objectContaining({ userRecord: expect.objectContaining({ id: 9876, start: 1793480400 }) }) })]));
  });
});


it("preserves W4.0 door-only push scope for IDE and non-Hik devices", async () => {
  const { t, ids, link } = await fixture();
  const ruleId = await link([]);
  await t.run(async ctx => {
    const other = await ctx.db.insert("devices", { projectId: ids.projectId, name: "Other", brand: "other", isActive: true, createdAt: now, updatedAt: now });
    for (const deviceId of [ids.ideId, ids.hikId, other]) {
      const doorId = await ctx.db.insert("doors", { projectId: ids.projectId, name: "Door", deviceId, hikDoorNo: 1, ioId: 0 });
      await ctx.db.insert("groupDoors", { projectId: ids.projectId, groupId: ruleId, doorId, deviceId, createdAt: now });
    }
  });
  const employee = await t.query(internal.hikvisionSync.getEmployeeWithDevices, { employeeId: ids.employeeId });
  expect(employee?.deviceRules.map(entry => entry.device._id)).toEqual([ids.hikId]);
  const rule = await t.query(internal.hikvisionSync.getAccessRuleWithDevices, { accessRuleId: ruleId });
  expect(rule?.devices.map(device => device._id)).toEqual([ids.hikId]);
});
